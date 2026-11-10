// Indicadores de Finanças: recebimentos separados (salário, extras, entre suas contas),
// gasto do mês comparado com os meses anteriores, quanto deveria ter guardado, o que mais
// subiu, para onde o saldo vai se continuar assim e de onde veio o saldo de hoje.
// Tudo aqui é cálculo puro: não lê nem grava nada.
import { daysInMonth, addMonthsYm, MONTHS } from './utils';
import { isWorkIncome, isExtraIncome, isRefund, monthBudget } from './budget';
import { accountsSummary, effectOn, isCountable, SAVING_KINDS } from './accounts';

const r2 = (n) => Math.round(n * 100) / 100;
const sum = (list) => r2(list.reduce((a, t) => a + (t.amount || 0), 0));
const dayOf = (iso) => Number(iso.slice(8, 10));
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthShort = (ym) => monthName(ym).slice(0, 3).toLowerCase();

// ---------- recebimentos ----------

// 'salary' (salário e bônus) | 'extra' (Pix de alguém, reembolso, rendimento…) | 'own' (de outra conta sua) | null
export function incomeKind(t, accounts = []) {
  if (isRefund(t)) return null; // 1.13: Pix devolvido não é recebimento
  if (t.type === 'in') return isWorkIncome(t) ? 'salary' : isExtraIncome(t) ? 'extra' : null;
  if (t.type === 'transfer') {
    const to = accounts.find((a) => a.id === t.to);
    // pagamento de fatura (para o cartão) não é recebimento
    if (to && to.kind === 'cartao') return null;
    if (t.to || !t.from) return 'own';
  }
  return null;
}

export function receipts(finance, accounts, ym) {
  const items = finance.filter((t) => t.date && t.date.startsWith(ym));
  const groups = { salary: [], extra: [], own: [] };
  for (const t of items) {
    const k = incomeKind(t, accounts);
    if (k) groups[k].push(t);
  }
  const byDate = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
  Object.values(groups).forEach((g) => g.sort(byDate));
  // totais só do que já caiu; o que está "a receber" aparece na lista, mas à parte
  const done = (g) => g.filter((t) => t.status !== 'pending');
  const pend = (g) => g.filter((t) => t.status === 'pending');
  return {
    ...groups,
    totals: { salary: sum(done(groups.salary)), extra: sum(done(groups.extra)), own: sum(done(groups.own)) },
    pending: { salary: sum(pend(groups.salary)), extra: sum(pend(groups.extra)), own: sum(pend(groups.own)) },
    // dinheiro novo de verdade: o que entrou de fora (transferências suas não contam)
    newMoney: r2(sum(done(groups.salary)) + sum(done(groups.extra))),
  };
}

// ---------- números de um mês ----------

const cardIds = (accounts) => new Set(accounts.filter((a) => a.kind === 'cartao').map((a) => a.id));

// cutoff = só os dias até este (para comparar "até o dia 7" com "até o dia 7")
export function monthStats(finance, accounts, ym, cutoff = 31) {
  const cards = cardIds(accounts);
  const items = finance.filter((t) => t.date && t.date.startsWith(ym) && dayOf(t.date) <= cutoff && !isRefund(t));
  const outs = items.filter((t) => t.type === 'out');
  const ins = items.filter((t) => t.type === 'in');
  const byCat = {};
  for (const t of outs) byCat[t.category || 'Outros'] = r2((byCat[t.category || 'Outros'] || 0) + t.amount);
  // no cartão: compras lançadas num cartão de crédito; sem cartão no app, a fatura paga
  const card = cards.size ? sum(outs.filter((t) => cards.has(t.account))) : sum(outs.filter((t) => t.category === 'Cartão'));
  return {
    ym,
    salary: sum(ins.filter(isWorkIncome)),
    extras: sum(ins.filter(isExtraIncome)),
    spend: sum(outs),
    byCat,
    card,
    count: items.length,
  };
}

// meses anteriores com algum lançamento (até `max`, olhando no máximo 12 para trás).
// skip (1.10): meses que você marcou como fora do comum ficam fora das médias.
function previousMonths(finance, accounts, ym, max = 3, cutoff = 31, skip = null) {
  const out = [];
  for (let k = 1; k <= 12 && out.length < max; k++) {
    const m = addMonthsYm(ym, -k);
    if (skip && skip.has(m)) continue;
    const full = monthStats(finance, accounts, m);
    if (!full.count) continue;
    out.push(cutoff < 31 ? monthStats(finance, accounts, m, cutoff) : full);
  }
  return out;
}

// meses com lançamento antes de ym (até `max`), marcando os que não contam: para a lista na tela
export function historyMonths(finance, accounts, ym, skip = new Set(), max = 6) {
  const out = [];
  for (let k = 1; k <= 12 && out.length < max; k++) {
    const m = addMonthsYm(ym, -k);
    const st = monthStats(finance, accounts, m);
    if (st.count) out.push({ ym: m, label: monthShort(m), skip: skip.has(m), net: r2(st.salary + st.extras - st.spend) });
  }
  return out;
}

const avgOf = (list, key) => (list.length ? r2(list.reduce((a, x) => a + x[key], 0) / list.length) : 0);

// ---------- saldo ----------

// saldo das contas (sem cartão) no fim de um dia: o de hoje menos o que aconteceu depois
export function moneyAt(finance, accounts, iso) {
  const money = accountsSummary(accounts, finance).money;
  const ids = accounts.filter(isCountable).map((a) => a.id);
  let later = 0;
  for (const t of finance) {
    if (t.date > iso) for (const id of ids) later += effectOn(t, id);
  }
  return r2(money - later);
}

/**
 * De onde veio o saldo de hoje, no mês ym:
 * saldo no início do mês + entradas − saídas − faturas pagas ± transferências de/para fora = saldo de hoje.
 * Transferências entre duas contas suas no app não mudam o total (aparecem em `internal`).
 */
export function balanceBridge(finance, accounts, ym, today) {
  const own = accounts.filter(isCountable);
  if (!own.length) return null;
  const ids = new Set(own.map((a) => a.id));
  const cards = cardIds(accounts);
  const end = ym === today.slice(0, 7) ? accountsSummary(accounts, finance).money : moneyAt(finance, accounts, `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`);
  const lastDay = ym === today.slice(0, 7) ? today : `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const items = finance.filter((t) => t.status !== 'pending' && t.date.startsWith(ym) && t.date <= lastDay);
  let incomes = 0;
  let outs = 0;
  let cardPay = 0;
  let extIn = 0;
  let extOut = 0;
  let internal = 0;
  for (const t of items) {
    if (t.type === 'in' && ids.has(t.account)) incomes += t.amount;
    else if (t.type === 'out' && ids.has(t.account)) outs += t.amount;
    else if (t.type === 'transfer') {
      const fromOwn = ids.has(t.from);
      const toOwn = ids.has(t.to);
      if (fromOwn && toOwn) internal += t.amount;
      else if (fromOwn && cards.has(t.to)) cardPay += t.amount;
      else if (fromOwn) extOut += t.amount;
      else if (toOwn) extIn += t.amount;
    }
  }
  const change = incomes - outs - cardPay + extIn - extOut;
  return {
    start: r2(end - change),
    incomes: r2(incomes),
    outs: r2(outs),
    cardPay: r2(cardPay),
    extIn: r2(extIn),
    extOut: r2(extOut),
    internal: r2(internal),
    end: r2(end),
  };
}

// "Previsto no fim do mês": dinheiro nas contas + a receber − a pagar (+ salário base ainda não lançado)
export function monthForecast(finance, accounts, budget, ym, today) {
  const items = finance.filter((t) => t.date && t.date.startsWith(ym));
  const pending = items.filter((t) => t.status === 'pending');
  const inPend = sum(pending.filter((t) => t.type === 'in'));
  const outPend = sum(pending.filter((t) => t.type === 'out'));
  const isCurrent = ym === today.slice(0, 7);
  const salaryPending =
    // renda que varia (1.10) não tem salário certo para somar antes de cair
    isCurrent && budget && budget.salary && budget.incomeType !== 'variable' && !items.some((t) => t.type === 'in' && t.category === 'Salário')
      ? Number(budget.salary)
      : 0;
  const hasAccounts = accounts.some(isCountable);
  if (hasAccounts && isCurrent) {
    const money = accountsSummary(accounts, finance).money;
    return { base: 'accounts', value: r2(money + inPend - outPend + salaryPending), inPend, outPend, salaryPending };
  }
  const paid = items.filter((t) => t.status !== 'pending');
  const result = sum(paid.filter((t) => t.type === 'in')) - sum(paid.filter((t) => t.type === 'out'));
  return { base: 'result', value: r2(result + inPend - outPend + salaryPending), inPend, outPend, salaryPending };
}

// Dinheiro que dá para usar até o fim do mês (1.9.3): o "Previsto no fim do mês" menos a fatura em
// aberto dos cartões (que ainda vai sair das contas, a não ser que já esteja lançada como "a pagar").
// null quando não é o mês atual ou não há conta com saldo: aí o app não sabe quanto você tem.
export function cashAvailable(finance, accounts, budget, ym, today) {
  if (ym !== today.slice(0, 7) || !accounts.some(isCountable)) return null;
  const fc = monthForecast(finance, accounts, budget, ym, today);
  const sumAcc = accountsSummary(accounts, finance);
  const faturaPending = finance.some(
    (t) => t.status === 'pending' && t.type === 'out' && t.date.startsWith(ym) && (t.category === 'Cartão' || /fatura/i.test(t.title || ''))
  );
  const debt = faturaPending ? 0 : sumAcc.cardDebt;
  return {
    value: r2(fc.value - debt),
    money: sumAcc.money,
    inPend: fc.inPend,
    outPend: fc.outPend,
    salaryPending: fc.salaryPending,
    debt,
  };
}

// 1.10: dinheiro que veio no mês de outra conta sua que não tem saldo no app (Pix com o seu nome,
// "outra conta sua"). Entra no saldo, não é renda; só entra no limite se você disser "usar no mês".
export function fromOtherAccounts(finance, accounts, ym) {
  const counted = accounts.filter(isCountable);
  const ids = new Set((counted.length ? counted : accounts.filter((a) => a.kind !== 'cartao')).map((a) => a.id));
  let total = 0;
  for (const t of finance) {
    if (t.type !== 'transfer' || t.status === 'pending' || !t.date || !t.date.startsWith(ym)) continue;
    const fromOutside = ids.size ? ids.has(t.to) && !ids.has(t.from) : !!t.to && !t.from;
    if (fromOutside) total += t.amount;
  }
  return r2(total);
}

// Orçamento do mês com tudo o que a tela precisa: teto no dinheiro real (1.9.3) e dinheiro de outras contas (1.10)
export function budgetFor(finance, accounts, budget, ym, today, now = new Date()) {
  const cash = cashAvailable(finance, accounts, budget, ym, today);
  const own = fromOtherAccounts(finance, accounts, ym);
  return { ...monthBudget(finance, budget, ym, now, cash ? cash.value : null, own), cashInfo: cash };
}

// ---------- indicadores ----------

export function financeInsights(finance, accounts, budget = {}, today) {
  const ym = today.slice(0, 7);
  const day = dayOf(today);
  const total = daysInMonth(ym);
  const cur = monthStats(finance, accounts, ym);
  const curSoFar = monthStats(finance, accounts, ym, day);
  const skip = new Set(budget.skipMonths || []);
  const prev = previousMonths(finance, accounts, ym, 3, 31, skip);
  const prevSoFar = previousMonths(finance, accounts, ym, 3, day, skip);
  const n = prev.length;

  // 1) gasto do mês x meses anteriores, até o mesmo dia (o aluguel do dia 5 pesa igual nos dois)
  const avgSpend = avgOf(prev, 'spend');
  const avgSpendSoFar = avgOf(prevSoFar, 'spend');
  const pace = {
    day,
    total,
    spentSoFar: curSoFar.spend,
    avgSoFar: avgSpendSoFar,
    diff: r2(curSoFar.spend - avgSpendSoFar),
    pct: avgSpendSoFar > 0 ? curSoFar.spend / avgSpendSoFar - 1 : null,
    avgMonth: avgSpend,
    // se seguir como os meses anteriores daqui até o fim do mês
    projected: r2(Math.max(cur.spend, curSoFar.spend + Math.max(0, avgSpend - avgSpendSoFar))),
    months: n,
  };

  // 2) quanto deveria ter guardado nos meses anteriores
  const avgSalary = avgOf(prev, 'salary');
  const avgExtras = avgOf(prev, 'extras');
  const leftover = r2(prev.reduce((a, x) => a + x.salary + x.extras - x.spend, 0));
  const target = Number(budget.target) || 0;
  const savingIds = new Set(accounts.filter((a) => SAVING_KINDS.has(a.kind)).map((a) => a.id));
  let savedReal = null;
  if (savingIds.size && n) {
    const months = new Set(prev.map((x) => x.ym));
    savedReal = 0;
    for (const t of finance) {
      if (t.type !== 'transfer' || t.status === 'pending' || !months.has(t.date.slice(0, 7))) continue;
      if (savingIds.has(t.to) && !savingIds.has(t.from)) savedReal += t.amount;
      else if (savingIds.has(t.from) && !savingIds.has(t.to)) savedReal -= t.amount;
    }
    savedReal = r2(savedReal);
  }
  const saving = {
    months: n,
    leftover, // entrou − saiu nesses meses: o que deveria ter sobrado
    goal: target ? r2(target * n) : null,
    savedReal,
    perMonth: n ? r2(leftover / n) : 0,
    // neste mês, pela meta, até hoje
    goalSoFar: target ? r2((target * day) / total) : null,
  };

  // 3) o que mais subiu (até o mesmo dia), cartão à parte
  const cats = new Set([...Object.keys(curSoFar.byCat), ...prevSoFar.flatMap((x) => Object.keys(x.byCat))]);
  const rises = [];
  for (const c of cats) {
    if (c === 'Cartão' && !accounts.some((a) => a.kind === 'cartao')) continue; // a fatura aparece no item do cartão
    const now = curSoFar.byCat[c] || 0;
    const avg = prevSoFar.length ? prevSoFar.reduce((a, x) => a + (x.byCat[c] || 0), 0) / prevSoFar.length : 0;
    const diff = r2(now - avg);
    if (diff >= 20 && (avg === 0 || diff / avg >= 0.15)) rises.push({ category: c, now: r2(now), avg: r2(avg), diff });
  }
  rises.sort((a, b) => b.diff - a.diff);
  const avgCard = avgOf(prevSoFar, 'card');
  const card = { now: curSoFar.card, avg: avgCard, diff: r2(curSoFar.card - avgCard), hasCard: accounts.some((a) => a.kind === 'cartao') };

  // 4) se continuar assim: saldo previsto nos próximos meses
  const salaryBase = Number(budget.salary) || 0;
  // 1.10: previsão pelo tipo de renda. Fixa (CLT, contrato): o salário de todo mês que você confirmou.
  // Varia (autônomo, bicos): a média dos meses normais, com o pior e o melhor mês como faixa.
  const profile = budget.incomeType || (salaryBase ? 'fixed' : 'variable');
  const extrasOf = (x) => (budget.countExtras || profile === 'variable' ? x.extras : 0);
  const nets = prev.map((x) => r2(x.salary + extrasOf(x) - x.spend));
  let monthlyIncome;
  let monthlyNet;
  let low = null;
  let high = null;
  if (profile === 'fixed') {
    monthlyIncome = salaryBase || avgSalary;
    monthlyNet = r2(monthlyIncome + (budget.countExtras ? avgExtras : 0) - avgSpend);
  } else {
    monthlyIncome = r2(avgSalary + avgExtras);
    monthlyNet = n ? r2(nets.reduce((a, x) => a + x, 0) / n) : 0;
    low = n ? Math.min(...nets) : 0;
    high = n ? Math.max(...nets) : 0;
  }
  const minMonths = profile === 'fixed' ? 1 : 2;
  const sumAcc = accountsSummary(accounts, finance);
  const hasAccounts = accounts.some(isCountable);
  // a fatura em aberto já conta como gasto, mas ainda vai sair das contas: desconta do ponto de partida
  const cash = cashAvailable(finance, accounts, budget, ym, today);
  const forecast = monthForecast(finance, accounts, budget, ym, today);
  const faturaPending = finance.some((t) => t.status === 'pending' && t.type === 'out' && t.date.startsWith(ym) && (t.category === 'Cartão' || /fatura/i.test(t.title || '')));
  const debt = cash ? cash.debt : faturaPending ? 0 : sumAcc.cardDebt;
  const start = cash ? cash.value : r2(forecast.value - debt);
  const ahead = [];
  for (let k = 1; k <= 3; k++) {
    const m = addMonthsYm(ym, k);
    const base = hasAccounts ? start : 0;
    ahead.push({
      ym: m,
      label: monthName(m),
      value: r2(base + k * monthlyNet),
      low: low === null ? null : r2(base + k * low),
      high: high === null ? null : r2(base + k * high),
    });
  }
  const projection = {
    ready: n >= minMonths && (monthlyIncome > 0 || avgSpend > 0),
    profile,
    minMonths,
    months: n,
    history: historyMonths(finance, accounts, ym, skip),
    base: hasAccounts ? 'accounts' : 'net',
    endOfMonth: start,
    debtTaken: debt,
    monthlyNet,
    monthlyIncome,
    low,
    high,
    avgSpend,
    cardDebt: sumAcc.cardDebt,
    ahead,
  };

  return {
    ym,
    pace,
    saving,
    rises: rises.slice(0, 4),
    card,
    projection,
    bridge: balanceBridge(finance, accounts, ym, today),
    receipts: receipts(finance, accounts, ym),
    history: [...prev].reverse().concat([cur]),
    enough: n >= 1,
  };
}
