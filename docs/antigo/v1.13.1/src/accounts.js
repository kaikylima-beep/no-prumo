// Contas (corrente, poupança, cartão…), saldo real de cada uma e transferências entre elas.
// Tudo aqui é cálculo puro: não lê nem grava nada.
//
// Lançamento de finanças:
//   entrada/saída:   { type: 'in' | 'out', account: id | null, ... }
//   transferência:   { type: 'transfer', from: id | null, to: id | null, ... }
//                    null = "outra conta sua que não está no app"
// Conta: { id, name, kind, number, anchor: { date, balance, at, importId } | null }
//   anchor = saldo conhecido num dia (o do extrato, ou o que você digitou). O saldo de hoje
//   é esse número mais o que entrou e saiu depois dele.

export const ACCOUNT_KINDS = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
  cartao: 'Cartão de crédito',
  carteira: 'Dinheiro vivo',
};
export const ACCOUNT_KIND_KEYS = ['corrente', 'poupanca', 'investimento', 'cartao', 'carteira'];
export const SAVING_KINDS = new Set(['poupanca', 'investimento']);

const dayNum = (iso) => Date.parse(`${iso}T12:00:00Z`) / 864e5;
const daysApart = (a, b) => Math.abs(dayNum(a) - dayNum(b));
const sameMoney = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.005;

// Quanto um lançamento mexe numa conta: +valor, −valor ou 0
export function effectOn(item, accId) {
  if (!accId || item.status === 'pending') return 0;
  if (item.type === 'transfer') {
    if (item.to === accId) return item.amount;
    if (item.from === accId) return -item.amount;
    return 0;
  }
  if (item.account !== accId) return 0;
  return item.type === 'in' ? item.amount : -item.amount;
}

// O lançamento conta depois do saldo conhecido?
export function afterAnchor(item, anchor) {
  if (!anchor) return true;
  if (item.date > anchor.date) return true;
  if (item.date < anchor.date) return false;
  // no mesmo dia: só o que foi lançado depois e não veio do mesmo extrato
  return (item.createdAt || 0) > (anchor.at || 0) && (!anchor.importId || item.importId !== anchor.importId);
}

// Saldo de hoje. Num cartão de crédito o número é negativo: é o que você deve.
export function accountBalance(acc, finance) {
  let total = acc.anchor ? Number(acc.anchor.balance) || 0 : 0;
  for (const it of finance) {
    const e = effectOn(it, acc.id);
    if (e && afterAnchor(it, acc.anchor)) total += e;
  }
  return Math.round(total * 100) / 100;
}

// Só entra em "Dinheiro nas contas" a conta com saldo conhecido. Sem saldo inicial, o app sabe o que
// passou por ela, mas não quanto tem nela: somar esse histórico inventaria dinheiro que não existe.
export const isCountable = (a) => a.kind !== 'cartao' && !!a.anchor;

export function accountsSummary(accounts, finance) {
  const rows = accounts.map((a) => ({ ...a, balance: accountBalance(a, finance), known: a.kind === 'cartao' || !!a.anchor }));
  const countable = rows.filter(isCountable);
  const money = countable.reduce((s, a) => s + a.balance, 0);
  const cardDebt = rows.filter((a) => a.kind === 'cartao').reduce((s, a) => s + Math.max(0, -a.balance), 0);
  const unassigned = finance.filter((t) => t.type !== 'transfer' && !t.account).length;
  return {
    rows,
    money: Math.round(money * 100) / 100,
    cardDebt: Math.round(cardDebt * 100) / 100,
    unassigned,
    unknown: rows.filter((a) => !a.known).length, // contas sem saldo informado (fora do total)
    hasKnown: countable.length > 0,
  };
}

/**
 * De onde veio o saldo de UMA conta no mês ym (AAAA-MM):
 * saldo no início + entrou + entre contas − saiu = saldo.
 * Só existe para conta com saldo conhecido e a partir do mês desse saldo: antes dele o extrato
 * pode não cobrir o mês inteiro, e o número do início seria inventado.
 */
export function accountBridge(acc, finance, ym) {
  if (acc.kind === 'cartao' || !acc.anchor) return null;
  const anchor = acc.anchor;
  const anchorYm = anchor.date.slice(0, 7);
  if (ym < anchorYm) return null;
  const list = finance.filter((t) => t.date && t.date.startsWith(ym) && effectOn(t, acc.id));
  if (!list.length) return null;
  const inAnchorMonth = ym === anchorYm;
  const counted = inAnchorMonth ? list.filter((t) => !afterAnchor(t, anchor)) : list;
  const r2 = (n) => Math.round(n * 100) / 100;
  let incomes = 0;
  let outs = 0;
  let moved = 0;
  for (const t of counted) {
    if (t.type === 'in') incomes += t.amount;
    else if (t.type === 'out') outs += t.amount;
    else moved += effectOn(t, acc.id);
  }
  const change = incomes - outs + moved;
  const base = Number(anchor.balance) || 0;
  let start = base - change;
  if (!inAnchorMonth) {
    start = base;
    for (const t of finance) {
      if (t.date && t.date < `${ym}-01` && afterAnchor(t, anchor)) start += effectOn(t, acc.id);
    }
  }
  const later = inAnchorMonth ? list.filter((t) => afterAnchor(t, anchor)).reduce((s, t) => s + effectOn(t, acc.id), 0) : 0;
  const end = start + change;
  return {
    start: r2(start),
    incomes: r2(incomes),
    outs: r2(outs),
    moved: r2(moved),
    end: r2(end),
    endDate: inAnchorMonth ? anchor.date : null, // saldo que veio do extrato ou que você digitou
    fromStatement: inAnchorMonth && !!anchor.importId,
    later: r2(later), // o que entrou e saiu no mês depois desse saldo
    now: r2(end + later),
  };
}

// Transferências do mês para poupança ou investimento (menos o que saiu de lá) = guardado
export function savedInMonth(finance, accounts, ym) {
  const saving = new Set(accounts.filter((a) => SAVING_KINDS.has(a.kind)).map((a) => a.id));
  if (!saving.size) return null;
  let total = 0;
  for (const t of finance) {
    if (t.type !== 'transfer' || t.status === 'pending' || !t.date.startsWith(ym)) continue;
    const intoSaving = saving.has(t.to);
    const outOfSaving = saving.has(t.from);
    if (intoSaving && !outOfSaving) total += t.amount;
    else if (outOfSaving && !intoSaving) total -= t.amount;
  }
  return Math.round(total * 100) / 100;
}

export function accountLabel(id, accounts, fallback = 'outra conta sua') {
  if (!id) return fallback;
  const a = accounts.find((x) => x.id === id);
  return a ? accountDisplayName(a, accounts) : fallback;
}

// ---------- importação: o que já existe, o que é a outra ponta de uma transferência ----------

// Sinal de um lançamento visto de uma conta: +1 entra, −1 sai, 0 não mexe
function signFor(item, accId) {
  if (item.type === 'in') return item.account == null || item.account === accId ? 1 : 0;
  if (item.type === 'out') return item.account == null || item.account === accId ? -1 : 0;
  if (item.type === 'transfer') {
    if (item.to === accId) return 1;
    if (item.from === accId) return -1;
  }
  return 0;
}
// sinal de um item novo do extrato (transferência do extrato traz dir: +1 / −1)
const newSign = (n) => (n.type === 'in' ? 1 : n.type === 'out' ? -1 : n.dir || 0);
const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtMoney = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/**
 * Prepara os itens de um extrato para a conta escolhida.
 * Devolve cada item com:
 *   action: 'add' (novo) | 'dup' (já existe) | 'link' (outra ponta de uma transferência já no app)
 *   targetId, convert (o existente vira transferência), hint (texto para a revisão), selected
 */
export function reconcile(items, existing, accId, accounts = []) {
  const used = new Set();
  const cards = accounts.filter((a) => a.kind === 'cartao' && a.id !== accId);
  const cardHasPurchases = (cid) => existing.some((e) => e.type === 'out' && e.account === cid);
  const accName = (id) => accountLabel(id, accounts);
  const sameEntry = (e, n, dates) =>
    !used.has(e.id) &&
    dates.includes(e.date) &&
    sameMoney(e.amount, n.amount) &&
    signFor(e, accId) === newSign(n) &&
    (e.type === 'transfer' || e.account == null || e.account === accId);
  // 1.13.1: primeiro o que já está no app no mesmo dia; depois, o mesmo lançamento com a outra data
  // em que ele aparece em outro extrato (dia da compra × dia em que o banco lançou, `sameAs`).
  // Fazer o mesmo dia antes evita confundir duas compras iguais em dias diferentes.
  const exact = items.map((n) => {
    const e = existing.find((x) => sameEntry(x, n, [n.date]));
    if (e) used.add(e.id);
    return e || null;
  });

  return items.map((raw, k) => {
    const n = { ...raw };
    const s = newSign(n);
    const out = { ...n, action: 'add', targetId: null, convert: false, hint: n.hint || '', selected: n.selected !== false };
    delete out.sameAs;

    // 1) já está no app (reimportar o mesmo extrato, ou lançado antes à mão sem conta)
    let dup = exact[k];
    if (!dup && n.sameAs && n.sameAs.length) {
      dup = existing.find((x) => sameEntry(x, n, n.sameAs)) || null;
    }
    if (dup) {
      used.add(dup.id);
      const otherDay = dup.date !== n.date;
      const convert = n.type === 'transfer' && dup.type !== 'transfer';
      return {
        ...out,
        action: 'dup',
        targetId: dup.id,
        convert,
        selected: false,
        hint: convert
          ? `Já está no app como ${dup.type === 'in' ? 'entrada' : 'saída'}; vai virar transferência entre suas contas`
          : otherDay
            ? `Já está no app em ${fmtDay(dup.date)} (o banco mostra a mesma compra com outra data)`
            : 'Já está no app (mesmo dia e valor)',
      };
    }

    // 1b) o mesmo salário, vindo de outro lugar (holerite × extrato × planilha), em qualquer conta
    if (n.type === 'in' && n.category === 'Salário') {
      const twin =
        existing.find((e) => !used.has(e.id) && sameSalary(n, e)) || existing.find((e) => !used.has(e.id) && payslipTwin(n, e));
      if (twin) {
        used.add(twin.id);
        const fix = twin.category !== 'Salário';
        return {
          ...out,
          action: 'dup',
          targetId: twin.id,
          convert: false,
          salaryFix: fix,
          selected: false,
          hint: n.payslip
            ? `Confirmado pelo holerite: o salário de ${fmtMoney(twin.amount)} em ${fmtDay(twin.date)} já está no app${fix ? ' e passa a contar como salário' : ''}`
            : `Já está no app: salário de ${fmtMoney(twin.amount)} em ${fmtDay(twin.date)}`,
        };
      }
    }

    // 2) outra ponta de uma transferência que já está no app, vinda de outra conta
    const isTransferish = n.type === 'transfer';
    const window = cards.length || accounts.find((a) => a.id === accId && a.kind === 'cartao') ? 3 : 1;
    const pair = existing.find((e) => {
      if (used.has(e.id) || !sameMoney(e.amount, n.amount) || daysApart(e.date, n.date) > window) return false;
      if (e.type === 'transfer') {
        // transferência com a ponta em aberto, saindo/entrando de outra conta
        if (s > 0) return e.to == null && e.from && e.from !== accId;
        if (s < 0) return e.from == null && e.to && e.to !== accId;
        return false;
      }
      // entrada/saída comum em outra conta, no sentido oposto, quando este lado é transferência sua
      return isTransferish && e.account && e.account !== accId && signFor(e, e.account) === -s;
    });
    if (pair) {
      used.add(pair.id);
      const other = pair.type === 'transfer' ? (s > 0 ? pair.from : pair.to) : pair.account;
      return {
        ...out,
        action: 'link',
        targetId: pair.id,
        convert: pair.type !== 'transfer',
        selected: true,
        hint: `Outra ponta da transferência de ${fmtDay(pair.date)} ${s > 0 ? 'vinda de' : 'para'} ${accName(other)}: vira uma transferência só`,
      };
    }

    // 3) fatura paga na conta corrente, quando as compras do cartão já estão no app
    if (n.type === 'out' && /^fatura do cart/i.test(n.title || '') && cards.length === 1 && cardHasPurchases(cards[0].id)) {
      return {
        ...out,
        type: 'transfer',
        dir: -1,
        toAccount: cards[0].id,
        hint: `Pagamento da fatura do ${cards[0].name}: as compras já contam como gasto, então isto vira transferência`,
      };
    }

    return out;
  });
}

// Converte um item do extrato (já reconciliado) em dados para salvar na conta escolhida
export function toFinanceData(row, accId, importId) {
  const base = {
    title: row.title,
    amount: row.amount,
    date: row.date,
    status: row.status || 'paid',
    note: row.note || row.source || null,
    importId,
  };
  if (row.type === 'transfer') {
    const s = row.dir || 0;
    return {
      ...base,
      type: 'transfer',
      category: 'Transferência',
      from: s < 0 ? accId : row.fromAccount || null,
      to: s > 0 ? accId : row.toAccount || null,
      account: null,
      essential: null,
    };
  }
  return { ...base, type: row.type, category: row.category, account: accId, essential: row.essential };
}

// Mudanças num lançamento existente ao ligar as duas pontas (ou converter em transferência)
export function linkChanges(existingItem, row, accId) {
  const s = newSign(row);
  if (existingItem.type === 'transfer') {
    return s > 0 ? { to: accId } : { from: accId };
  }
  // entrada/saída numa outra conta vira transferência entre ela e esta
  const other = existingItem.account || null;
  return {
    type: 'transfer',
    category: 'Transferência',
    essential: null,
    account: null,
    from: s > 0 ? other : accId,
    to: s > 0 ? accId : other,
  };
}

// Mudanças num lançamento duplicado: adota a conta e, se for o caso, vira transferência
export function dupChanges(existingItem, row, accId) {
  if (row.convert || (row.type === 'transfer' && existingItem.type !== 'transfer')) {
    const s = newSign(row);
    return {
      type: 'transfer',
      category: 'Transferência',
      essential: null,
      account: null,
      from: s < 0 ? accId : existingItem.from || null,
      to: s > 0 ? accId : existingItem.to || null,
    };
  }
  // holerite confirmando uma entrada do extrato: ela passa a ser salário (a conta continua a do extrato)
  if (row.salaryFix && existingItem.type === 'in') return { category: 'Salário', ...(existingItem.account ? {} : accId ? { account: accId } : {}) };
  if (row.payslip) return null; // o holerite não muda a conta de quem já está no app
  if (existingItem.type !== 'transfer' && !existingItem.account) return { account: accId };
  return null;
}

// ---------- 1.9.2: tipo do lançamento x título que veio do extrato ----------

const OWN_TRANSFER_TITLE = /^transfer[eê]ncia (?:de|para) outra conta sua$/i;

// "Transferência de outra conta sua" não pode ficar como título de uma entrada ou saída
export function titleForType(title, type) {
  const t = String(title || '').trim();
  if (type === 'transfer' || !(OWN_TRANSFER_TITLE.test(t) || /^transfer[eê]ncia$/i.test(t))) return title;
  return type === 'in' ? 'Pix recebido' : 'Pix enviado';
}

// entrada ou saída com título de transferência: quase sempre era Pix entre contas suas
export const looksLikeOwnTransfer = (t) => t.type !== 'transfer' && OWN_TRANSFER_TITLE.test(String(t.title || '').trim());

// O que muda num lançamento para ele virar transferência entre suas contas.
// A conta sai de `account`, ou da ponta antiga guardada (de quando já foi transferência).
export function ownTransferChanges(t) {
  const base = { type: 'transfer', category: 'Transferência', essential: null, account: null };
  if (t.type === 'out') return { ...base, from: t.account || t.from || null, to: null };
  return { ...base, from: null, to: t.account || t.to || null };
}

// ---------- 1.9.1: salário repetido, contas sem nome, nomes iguais ----------

const fold2 = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// o mesmo salário vindo de dois lugares (holerite × extrato × planilha): até R$ 1 e 3 dias de diferença
// Mesmo salário vindo de dois lugares (holerite × extrato × planilha). 1.9.3: vale no mesmo mês em
// qualquer dia (o holerite costuma vir com a data da competência, o extrato com a do depósito), ou até
// 3 dias de distância na virada do mês. Valor: até R$ 1 ou 0,5% de diferença.
export const nearSalary = (x, y) => Math.abs((x || 0) - (y || 0)) <= Math.max(1.0001, Math.max(x || 0, y || 0) * 0.005);
export function sameSalary(a, b) {
  return (
    a.type === 'in' &&
    b.type === 'in' &&
    (a.category || 'Salário') === 'Salário' &&
    (b.category || 'Salário') === 'Salário' &&
    nearSalary(a.amount, b.amount) &&
    !!a.date &&
    !!b.date &&
    (a.date.slice(0, 7) === b.date.slice(0, 7) || daysApart(a.date, b.date) <= 3)
  );
}

// Holerite × entrada do extrato que não veio com a categoria "Salário" (ex.: "Pix recebido" da empresa)
export function payslipTwin(row, e) {
  return (
    !!row.payslip &&
    e.type === 'in' &&
    e.status !== 'pending' &&
    nearSalary(row.amount, e.amount) &&
    !!row.date &&
    !!e.date &&
    (row.date.slice(0, 7) === e.date.slice(0, 7) || daysApart(row.date, e.date) <= 3)
  );
}

// ids dos lançamentos que parecem repetidos (o segundo de cada par de salários iguais)
export function likelyRepeated(finance) {
  const sal = finance.filter((t) => t.type === 'in' && t.category === 'Salário').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const out = new Map();
  for (let i = 0; i < sal.length; i++) {
    if (out.has(sal[i].id)) continue;
    for (let j = i + 1; j < sal.length; j++) {
      if (!out.has(sal[j].id) && sameSalary(sal[i], sal[j])) out.set(sal[j].id, sal[i].id);
    }
  }
  return out; // id repetido → id do primeiro
}

// conta criada sozinha pela importação, sem nome de verdade ("Conta", "Cartão"), sem número e sem saldo
const GENERIC = new Set(['conta', 'nova conta', 'cartao', 'conta corrente', 'carteira']);
export function isPlaceholder(acc) {
  return GENERIC.has(fold2(acc.name)) && !acc.number && !acc.bank && !acc.anchor;
}
export function placeholderAccounts(accounts) {
  return accounts.filter(isPlaceholder);
}

// nome para mostrar: se duas contas têm o mesmo nome, acrescenta banco, final do número ou a ordem
export function accountDisplayName(acc, accounts = []) {
  if (!acc) return 'Sem conta';
  const twins = accounts.filter((a) => fold2(a.name) === fold2(acc.name));
  if (twins.length < 2) return acc.name;
  if (acc.number) return `${acc.name} · final ${String(acc.number).replace(/\D/g, '').slice(-4)}`;
  if (acc.bank && fold2(acc.bank) !== fold2(acc.name)) return `${acc.name} · ${acc.bank}`;
  return `${acc.name} ${twins.findIndex((a) => a.id === acc.id) + 1}`;
}

/**
 * Plano para juntar contas: o que muda em cada lançamento e quais parecem repetidos.
 * Nada some: os lançamentos das contas de origem passam para a conta de destino (ou "sem conta").
 * Repetidos = salário das contas de origem que já existe em outra conta (até R$ 1 e 3 dias).
 */
export function planMerge(finance, accounts, sourceIds, targetId) {
  const src = new Set(sourceIds);
  const moves = {};
  const repeated = [];
  const others = finance.filter((t) => !src.has(t.account) && !src.has(t.from) && !src.has(t.to));
  const taken = new Set();
  const kept = [];
  for (const t of finance) {
    const touches = src.has(t.account) || src.has(t.from) || src.has(t.to);
    if (!touches) continue;
    const ch = {};
    if (src.has(t.account)) ch.account = targetId || null;
    if (src.has(t.from)) ch.from = targetId || null;
    if (src.has(t.to)) ch.to = targetId || null;
    moves[t.id] = ch;
    // igual a um que fica (em outra conta) ou a outro destas mesmas contas que já passou
    const twin = others.find((o) => !taken.has(o.id) && sameSalary(t, o)) || kept.find((o) => !taken.has(o.id) && sameSalary(t, o));
    if (twin) {
      taken.add(twin.id);
      taken.add(t.id);
      repeated.push({ id: t.id, of: twin.id, title: t.title, amount: t.amount, date: t.date });
    } else kept.push(t);
  }
  const balance = sourceIds.reduce((s, id) => {
    const a = accounts.find((x) => x.id === id);
    return s + (a ? accountBalance(a, finance) : 0);
  }, 0);
  return { moves, repeated, count: Object.keys(moves).length, balance: Math.round(balance * 100) / 100 };
}
