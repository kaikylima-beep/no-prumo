// Backup do Peep e importação do backup do Prumo (No Prumo), para ninguém começar do zero.
import { DEFAULT_SETTINGS, EMPTY_STATE, makeBlock, newId } from './model.js';
import { addMonths, todayISO, daysInMonth } from './dates.js';

export function makeBackup(state, now = new Date()) {
  return { app: 'peep', format: 1, createdAt: now.toISOString(), counts: { items: state.items.length, blocks: state.blocks.length }, data: state };
}

// garante que o que foi lido tem o formato esperado (nunca devolve nada quebrado)
export function sanitize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    v: 1,
    items: Array.isArray(s.items) ? s.items.filter((i) => i && i.id && typeof i.title === 'string') : [],
    blocks: Array.isArray(s.blocks) ? s.blocks.filter((b) => b && b.id && typeof b.name === 'string').map((b) => ({ grades: [], absences: [], slots: [], aliases: [], ...b })) : [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}), learned: { ...((s.settings || {}).learned || {}) } },
  };
}

const CATEGORY_MAP = { Alimentação: 'Alimentação', Transporte: 'Transporte', Contas: 'Moradia', Saúde: 'Saúde', Estudos: 'Estudos', Lazer: 'Lazer', Parcelas: 'Compras', Cartão: 'Outros', Outros: 'Outros', Salário: 'Salário', Bônus: 'Extra', Extra: 'Extra', Investimentos: 'Extra' };

// Lê um arquivo de backup (do Peep ou do Prumo). Devolve { state, from, counts } ou { error }.
export function readBackup(text, now = new Date()) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: 'Esse arquivo não é um backup.' };
  }
  if (json && json.app === 'peep' && json.data) {
    const state = sanitize(json.data);
    return { state, from: 'peep', counts: { items: state.items.length, blocks: state.blocks.length } };
  }
  if (json && json.app === 'no-prumo' && json.data) return fromPrumo(json.data, now);
  return { error: 'Não reconheci esse arquivo. Escolha um backup do Peep ou do Prumo.' };
}

function fromPrumo(data, now) {
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
  let skipped = 0;
  (get('finance') || []).forEach((o) => {
    if (o.type === 'transfer') return (skipped += 1);
    const it = base(o, 'money');
    it.time = null;
    it.amount = Math.abs(Number(o.amount) || 0);
    it.flow = o.type === 'in' ? 'in' : 'out';
    it.category = CATEGORY_MAP[o.category] || (it.flow === 'in' ? 'Extra' : 'Outros');
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
    it.category = CATEGORY_MAP[o.category] || (it.flow === 'in' ? 'Extra' : 'Outros');
    it.repeat = { freq: 'monthly', day };
    // o lançamento deste mês que o Prumo já tinha criado fica como está; aqui só vale o próximo
    for (let i = items.length - 1; i >= 0; i--) if (items[i].type === 'money' && !items[i].done && items[i].title === it.title && items[i].date >= today) items.splice(i, 1);
    if (it.title) items.push(it);
  });
  const old = get('settings') || {};
  const budget = old.budget || {};
  const settings = { ...DEFAULT_SETTINGS, name: (old.profile && old.profile.name) || '', monthLimit: budget.salary ? Math.max(0, (Number(budget.salary) || 0) - (Number(budget.target) || 0)) : 0, hideMoney: !!old.hideBalance, onboarded: true };
  const learned = {};
  Object.entries((old.voice && old.voice.learned) || {}).forEach(([k, v]) => {
    if (v && v.to) learned[k] = { to: v.to, n: v.n || 1 };
  });
  settings.learned = learned;
  return { state: { ...EMPTY_STATE, items, blocks, settings }, from: 'prumo', counts: { items: items.length, blocks: blocks.length, skipped } };
}
