// Contas, saldo e extrato. As regras de saldo e de conferência são as mesmas da 1.12
// (src/legacy/accounts.js, já conferidas com extrato real); aqui só se traduz o formato.
import { accountsSummary, dupChanges, linkChanges, reconcile } from '../legacy/accounts.js';
import { newId } from './model.js';

const CAT_IN = { Salário: 'Salário', Bônus: 'Extra', Extra: 'Extra', Investimentos: 'Extra', Outros: 'Extra' };
const CAT_OUT = { Alimentação: 'Alimentação', Transporte: 'Transporte', Contas: 'Moradia', Saúde: 'Saúde', Estudos: 'Estudos', Lazer: 'Lazer', Parcelas: 'Compras', Cartão: 'Outros', Outros: 'Outros' };
export const mapCategory = (cat, flow) => (flow === 'in' ? CAT_IN[cat] || 'Extra' : CAT_OUT[cat] || (cat && Object.values(CAT_OUT).includes(cat) ? cat : 'Outros'));

export const ACCOUNT_KINDS = [
  { v: 'corrente', label: 'Conta' },
  { v: 'poupanca', label: 'Poupança' },
  { v: 'investimento', label: 'Investimento' },
  { v: 'cartao', label: 'Cartão de crédito' },
  { v: 'carteira', label: 'Dinheiro vivo' },
];

// item do Prumo novo -> formato que as regras antigas entendem
export const toLegacy = (it) => ({ id: it.id, title: it.title, amount: it.amount, date: it.date, type: it.flow, status: it.done ? 'paid' : 'pending', category: it.category, account: it.account || null, from: it.from || null, to: it.to || null, importId: it.importId || null, createdAt: it.createdAt });
const legacyMoney = (items) => items.filter((i) => i.type === 'money' && i.date).map(toLegacy);

// Saldo de cada conta e o total ("Saldo atual")
export function balances(state) {
  return accountsSummary(state.accounts || [], legacyMoney(state.items));
}

export function makeAccount(p) {
  return { id: newId(), name: (p.name || 'Conta').trim(), kind: p.kind || 'corrente', number: p.number || null, bank: p.bank || null, anchor: p.anchor || null, createdAt: Date.now() };
}
export const withBalance = (acc, balance, date, importId = null) => ({ ...acc, anchor: { balance, date, at: Date.now(), importId } });

// ───────── títulos que vêm do banco ─────────
// tira o que é código do banco e não nome: data grudada, prefixo sem vogal, número solto
export function cleanTitle(title) {
  let t = String(title || '').trim();
  t = t.replace(/^(?:(?:[BCDFGHJ-NP-TV-Z]{3,6}|PAY|PAG|PG|COMPRA|DEB|CRED)\s+)+(?=\S)/, (m) => (/^(?:COMPRA|DEB|CRED)\s/i.test(m) && !/^[A-Z ]+$/.test(t) ? m : ''));
  t = t.replace(/(\p{L})\s?\d{4}$/u, '$1'); // "Mercado Bom0711"
  t = t.replace(/\s\d{4,}\S*$/u, ''); // "Pix enviado 5725…"
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || String(title || '').trim();
}

const REFUND = /\bdev(?:\.|olu[cç][aã]o)?\s*(?:de\s+)?pix\b|\bpix\s+devolvido\b|\bestorno\b/i;

// ───────── importar extrato ─────────

// qual conta combina com o arquivo: id de uma existente, 'new' ou 'none'
export function guessAccount(meta = {}, docKind, accounts = []) {
  const want = docKind === 'fatura' ? 'cartao' : 'corrente';
  const digits = (n) => String(n || '').replace(/\D/g, '').replace(/^0+/, '');
  const byNumber = meta.number && accounts.find((a) => a.number && digits(a.number) === digits(meta.number));
  if (byNumber) return byNumber.id;
  const byBank = meta.bank && accounts.find((a) => a.kind === want && (a.bank === meta.bank || a.name.toLowerCase().includes(meta.bank.toLowerCase())));
  if (byBank) return byBank.id;
  if (meta.payslip) return 'none';
  return 'new';
}
export const NEW_ACCOUNT = '__nova__';

// Confere as linhas do arquivo com o que já está no app, para a conta escolhida.
export function prepareImport(read, state, accChoice) {
  const accounts = state.accounts || [];
  const isCard = read.kind === 'fatura';
  const accId = accChoice === 'new' ? NEW_ACCOUNT : accChoice === 'none' ? null : accChoice;
  const list = accChoice === 'new' ? [...accounts, { id: NEW_ACCOUNT, name: 'Nova', kind: isCard ? 'cartao' : 'corrente' }] : accounts;
  const plain = read.items.map((it) => ({ title: cleanTitle(it.title), category: it.category, amount: it.amount, type: it.type, dir: it.type === 'transfer' ? it.dir || 0 : undefined, date: it.date, hint: it.hint || '', payslip: !!it.payslip || !!(read.meta && read.meta.payslip), source: it.source || '', selected: true }));
  // Pix que foi e voltou: os dois lados deixam de contar como gasto e como entrada
  plain.forEach((r, i) => {
    if (r.type !== 'in' || !REFUND.test(`${r.source} ${r.title}`)) return;
    const j = plain.findIndex((o, k) => k !== i && o.type === 'out' && !o.refund && Math.abs(o.amount - r.amount) < 0.005 && o.date <= r.date && (Date.parse(r.date) - Date.parse(o.date)) / 864e5 <= 5);
    if (j < 0) return;
    [[r, 1], [plain[j], -1]].forEach(([x, dir]) => Object.assign(x, { type: 'transfer', dir, refund: true, hint: 'Pix devolvido: não conta como gasto nem como entrada' }));
  });
  const rec = reconcile(plain, legacyMoney(state.items), accId, list);
  return rec.map((x, k) => ({ ...x, key: `r${k}`, source: plain[k].source, refund: !!plain[k].refund, selected: x.action === 'dup' ? false : true }));
}

// Grava a importação. Devolve { state, added, linked, adopted }.
export function applyImport(state, read, rows, { accChoice, newName, useBalance = true } = {}, now = new Date()) {
  const importId = `imp${now.getTime()}`;
  const meta = read.meta || {};
  let accounts = (state.accounts || []).slice();
  let accId = accChoice === 'none' ? null : accChoice;
  if (accChoice === 'new') {
    const acc = makeAccount({ name: newName || meta.bank || (read.kind === 'fatura' ? 'Cartão' : 'Conta'), kind: read.kind === 'fatura' ? 'cartao' : 'corrente', number: meta.number, bank: meta.bank });
    accounts.push(acc);
    accId = acc.id;
  }
  const changes = {};
  let linked = 0;
  let adopted = 0;
  const legacy = legacyMoney(state.items);
  rows.forEach((r) => {
    const ex = r.targetId && legacy.find((e) => e.id === r.targetId);
    if (!ex) return;
    if (r.action === 'dup' && (!r.selected || r.convert)) {
      const c = dupChanges(ex, r, accId);
      if (c) {
        changes[ex.id] = c;
        adopted++;
      }
    } else if (r.action === 'link' && r.selected) {
      changes[ex.id] = linkChanges(ex, r, accId);
      linked++;
    }
  });
  const fromChange = (c) => {
    const out = {};
    if (c.type) out.flow = c.type;
    if ('account' in c) out.account = c.account;
    if ('from' in c) out.from = c.from;
    if ('to' in c) out.to = c.to;
    if (c.category && c.category !== 'Transferência') out.category = mapCategory(c.category, c.type || 'in');
    if (c.type === 'transfer') out.category = 'Transferência';
    return out;
  };
  let items = state.items.map((it) => (changes[it.id] ? { ...it, ...fromChange(changes[it.id]) } : it));
  const added = [];
  rows.forEach((r) => {
    if (!r.selected || r.action === 'link' || (r.action === 'dup' && r.convert)) return;
    const base = { id: newId(), type: 'money', title: r.title, date: r.date, time: null, endTime: null, repeat: null, remind: null, note: r.source && r.source !== r.title ? r.source : '', done: true, doneAt: now.getTime(), createdAt: now.getTime(), amount: r.amount, importId };
    if (r.type === 'transfer') {
      const dir = r.dir || 0;
      added.push({ ...base, flow: 'transfer', category: 'Transferência', account: null, from: dir < 0 ? accId : r.fromAccount || null, to: dir > 0 ? accId : r.toAccount || null });
    } else added.push({ ...base, flow: r.type, category: mapCategory(r.category, r.type), account: accId });
  });
  items = [...items, ...added];
  if (accId && useBalance && meta.balance !== null && meta.balance !== undefined && read.kind !== 'fatura') {
    accounts = accounts.map((a) => (a.id === accId ? withBalance(a, meta.balance, meta.balanceDate || added.reduce((m, i) => (i.date > m ? i.date : m), '') || now.toISOString().slice(0, 10), importId) : a));
  }
  return { state: { ...state, items, accounts }, added: added.length, linked, adopted, importId };
}
