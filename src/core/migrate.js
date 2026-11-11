// Backup e conversão dos dados da 1.12 (chaves @org2/*) para o formato da 1.13.
import { mapCategory } from './money.js';
import { DEFAULT_SETTINGS, EMPTY_STATE, makeBlock, newId } from './model.js';
import { addMonths, todayISO, daysInMonth } from './dates.js';

export function makeBackup(state, now = new Date()) {
  return { app: 'no-prumo', format: 2, createdAt: now.toISOString(), counts: { items: state.items.length, blocks: state.blocks.length, accounts: (state.accounts || []).length }, data: state };
}

// garante que o que foi lido tem o formato esperado (nunca devolve nada quebrado)
export function sanitize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    v: 1,
    items: Array.isArray(s.items) ? s.items.filter((i) => i && i.id && typeof i.title === 'string') : [],
    blocks: Array.isArray(s.blocks) ? s.blocks.filter((b) => b && b.id && typeof b.name === 'string').map((b) => ({ grades: [], absences: [], slots: [], aliases: [], ...b })) : [],
    accounts: Array.isArray(s.accounts) ? s.accounts.filter((a) => a && a.id && typeof a.name === 'string') : [],
    heardLog: Array.isArray(s.heardLog) ? s.heardLog.slice(0, 200) : [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}), learned: { ...((s.settings || {}).learned || {}) }, semester: { ...DEFAULT_SETTINGS.semester, ...((s.settings || {}).semester || {}) } },
  };
}


// Lê um arquivo de backup (do Peep ou do Prumo). Devolve { state, from, counts } ou { error }.
export function readBackup(text, now = new Date()) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: 'Esse arquivo não é um backup.' };
  }
  if (json && json.data && (json.app === 'peep' || (json.app === 'no-prumo' && json.format >= 2))) {
    const state = sanitize(json.data);
    return { state, from: 'novo', counts: { items: state.items.length, blocks: state.blocks.length, accounts: state.accounts.length } };
  }
  if (json && json.app === 'no-prumo' && json.data) return fromPrumo(json.data, now);
  return { error: 'Não reconheci esse arquivo. Escolha um backup do Prumo.' };
}

export function fromPrumo(data, now = new Date()) {
  const get = (k) => {
    const v = data[`@org2/${k}`];
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    }
    return v;
  };
  const today = todayISO(now);
  const blocks = [];
  const idMap = {};
  (get('subjects') || []).forEach((s) => {
    const b = makeBlock({ kind: 'class', name: s.name, aliases: s.aliases || [], color: (s.color || 0) % 8, room: s.room || '', slots: (s.schedules || []).filter((x) => x && x.start).map((x) => ({ days: x.days || [], start: x.start, end: x.end || x.start })) }, blocks);
    b.archived = !!s.archived;
    idMap[s.id] = b.id;
    blocks.push(b);
  });
  const items = [];
  const base = (o, type) => ({ id: newId(), type, title: o.title || '', date: o.date || null, time: o.time || null, endTime: null, repeat: null, remind: null, note: o.note || '', done: false, doneAt: null, createdAt: o.createdAt || now.getTime() });
  const rep = (r) => {
    if (!r) return null;
    if (r.freq === 'daily') return r.interval > 1 ? { freq: 'daily', interval: r.interval } : { freq: 'daily' };
    if (r.freq === 'weekly') return { freq: 'weekly', days: r.days || [] };
    if (r.freq === 'monthly') return { freq: 'monthly', day: r.day || 1 };
    return null;
  };
  [['tasks', 'task'], ['study', 'study']].forEach(([key, type]) => {
    (get(key) || []).forEach((o) => {
      const it = base(o, type);
      it.repeat = rep(o.repeat);
      if (it.repeat && !it.date) it.date = today;
      if (o.times && o.times[0] && !it.time) it.time = o.times[0];
      it.done = !!o.done && !it.repeat;
      if (it.done) it.doneAt = o.createdAt || now.getTime();
      if (o.lead) it.remind = o.lead * 1440;
      if (type === 'study') {
        it.subjectId = idMap[o.subjectId] || null;
        it.studyKind = /prova|exame|semin|apresenta/i.test(it.title) ? 'prova' : /trabalho|lista|relat|entreg/i.test(it.title) ? 'entrega' : 'estudo';
      }
      if (it.title) items.push(it);
    });
  });
  const accounts = (get('accounts') || []).filter((a) => a && a.id && a.name).map((a) => ({ id: a.id, name: a.name, kind: a.kind || 'corrente', number: a.number || null, bank: a.bank || null, anchor: a.anchor || null, createdAt: a.createdAt || now.getTime() }));
  const accIds = new Set(accounts.map((a) => a.id));
  const acc = (id) => (id && accIds.has(id) ? id : null);
  (get('finance') || []).forEach((o) => {
    const it = base(o, 'money');
    it.id = o.id || it.id; // mesmo id: o saldo conhecido de cada conta continua valendo
    it.time = null;
    it.amount = Math.abs(Number(o.amount) || 0);
    it.flow = o.type === 'in' ? 'in' : o.type === 'transfer' ? 'transfer' : 'out';
    if (it.flow === 'transfer') Object.assign(it, { category: 'Transferência', account: null, from: acc(o.from), to: acc(o.to) });
    else Object.assign(it, { category: mapCategory(o.category, it.flow), account: acc(o.account) });
    if (o.importId) it.importId = o.importId;
    it.done = o.status === 'paid';
    if (it.done) it.doneAt = o.createdAt || now.getTime();
    if (it.title && it.date) items.push(it);
  });
  // contas fixas: uma conta que se repete todo mês
  (get('recurrences') || []).forEach((o) => {
    if (o.type === 'transfer') return;
    const day = Math.min(o.day || 1, 28);
    let date = `${today.slice(0, 8)}${String(Math.min(day, daysInMonth(now.getFullYear(), now.getMonth()))).padStart(2, '0')}`;
    if ((o.generated || []).includes(today.slice(0, 7)) || date < today) date = addMonths(date, 1);
    const it = base({ title: o.title, date, createdAt: o.createdAt }, 'money');
    it.amount = Math.abs(Number(o.amount) || 0);
    it.flow = o.type === 'in' ? 'in' : 'out';
    it.category = mapCategory(o.category, it.flow);
    it.account = acc(o.account);
    it.repeat = { freq: 'monthly', day };
    // o lançamento deste mês que o Prumo já tinha criado fica como está; aqui só vale o próximo
    for (let i = items.length - 1; i >= 0; i--) if (items[i].type === 'money' && !items[i].done && items[i].title === it.title && items[i].date >= today) items.splice(i, 1);
    if (it.title) items.push(it);
  });
  const old = get('settings') || {};
  const budget = old.budget || {};
  const prof = old.profile || {};
  const settings = {
    ...DEFAULT_SETTINGS,
    name: prof.name || '',
    age: prof.age ? String(prof.age) : '',
    photo: prof.photo || null,
    occupation: prof.occupation || null,
    occupationName: prof.occupationName || '',
    state: prof.state || '',
    theme: old.theme === 'dark' || old.theme === 'light' ? old.theme : 'auto',
    sound: old.alertStyle !== 'vibrar',
    shortTitles: !!old.shortTitles,
    autoListen: old.autoListen !== false,
    voiceOnDevice: old.voiceOnDevice !== false,
    semester: { start: (old.semester && old.semester.start) || null, end: (old.semester && old.semester.end) || null },
    testMode: !!old.testMode,
    backupAt: (old.backup && old.backup.lastAt) || null,
    monthLimit: budget.salary ? Math.max(0, (Number(budget.salary) || 0) - (Number(budget.target) || 0)) : 0,
    hideMoney: !!old.hideBalance,
    onboarded: !!old.onboarded || !!prof.name,
  };
  const learned = {};
  Object.entries((old.voice && old.voice.learned) || {}).forEach(([k, v]) => {
    if (v && v.to) learned[k] = { to: v.to, n: v.n || 1 };
  });
  settings.learned = learned;
  const heardLog = (get('misheard') || []).slice(0, 200).map((m) => ({ id: m.id, text: m.text, heard: m.heard || m.text, alts: m.alts || [], fixed: (m.fixed || []).map((f) => f.title || f).filter(Boolean), at: m.at }));
  return { state: { ...EMPTY_STATE, items, blocks, accounts, heardLog, settings }, from: 'prumo', counts: { items: items.length, blocks: blocks.length, accounts: accounts.length } };
}

export const OLD_KEYS = ['tasks', 'study', 'finance', 'recurrences', 'accounts', 'subjects', 'misheard', 'settings'].map((k) => `@org2/${k}`);
// Primeira abertura da 1.13 por cima da 1.12: lê as chaves antigas (sem apagar) e devolve o estado novo, ou null.
export function fromOldStorage(pairs, now = new Date()) {
  const data = {};
  (pairs || []).forEach(([k, v]) => {
    if (v) data[k] = v;
  });
  if (!Object.keys(data).length) return null;
  try {
    return fromPrumo(data, now).state;
  } catch (e) {
    return null;
  }
}
