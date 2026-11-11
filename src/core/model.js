// Regras do Peep, sem tela: itens, rotina fixa, o dia, o mês, notas e faltas.
import { DEFAULT_ACADEMIC, absenceStatusText, absenceSummary, academicOf, gradeSummary, lessonsOn } from '../legacy/academic.js';
import { addDays, addMonths, at, daysInMonth, diffDays, fromISO, hhmm, minutesOf, monthKey, toISO, todayISO, weekdayOf, formatMoney, dayLabel } from './dates.js';

export const DEFAULT_SETTINGS = {
  name: '',
  theme: 'auto', // 'auto' | 'light' | 'dark'
  monthLimit: 0, // quanto a pessoa quer gastar no mês, no máximo (0 = sem limite)
  hideMoney: false,
  morning: '07:00', // resumo do dia (null = desligado)
  classAlert: 10, // minutos antes da aula (0 = desligado)
  sound: true,
  learned: {}, // { 'pics': { to: 'pix', n: 2 } }
  onboarded: false,
  // vindos da 1.12
  age: '',
  photo: null,
  occupation: null, // 'trabalho' | 'estagio' | 'outros' | 'so_estudo'
  occupationName: '',
  state: '', // UF, para os feriados
  shortTitles: false,
  autoListen: true,
  voiceOnDevice: true,
  semester: { start: null, end: null },
  testMode: false,
  backupAt: null,
  academic: DEFAULT_ACADEMIC, // média para passar, nota máxima, duração da aula, % de faltas, "Foi na aula?"
};
export const EMPTY_STATE = { v: 1, items: [], blocks: [], accounts: [], heardLog: [], settings: DEFAULT_SETTINGS };

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const BLOCK_COLORS = 8;

// ───────── itens ─────────

export function makeItem(p, now = new Date()) {
  const item = {
    id: newId(),
    type: p.type || 'task',
    title: (p.title || '').trim(),
    date: p.date || null,
    time: p.time || null,
    endTime: p.endTime || null,
    repeat: p.repeat || null,
    remind: p.remind ?? null,
    note: p.note || '',
    duration: p.duration || null,
    times: p.times && p.times.length > 1 ? p.times.slice() : null,
    done: false,
    doneAt: null,
    createdAt: now.getTime(),
  };
  if (p.heard) item.heard = p.heard;
  if (item.type === 'study') {
    item.studyKind = p.studyKind || 'estudo';
    item.subjectId = p.subjectId || null;
  }
  if (item.type === 'money') {
    item.amount = Number(p.amount) || 0;
    item.flow = p.flow === 'in' || p.flow === 'transfer' ? p.flow : 'out';
    item.category = item.flow === 'transfer' ? 'Transferência' : p.category || (item.flow === 'in' ? 'Extra' : 'Outros');
    item.account = item.flow === 'transfer' ? null : p.account || null;
    if (item.flow === 'transfer') {
      item.from = p.from || null;
      item.to = p.to || null;
    }
    if (p.importId) item.importId = p.importId;
    item.time = null;
    item.endTime = null;
    if (p.paid) {
      item.done = true;
      item.doneAt = now.getTime();
      if (!item.date) item.date = todayISO(now);
    }
  }
  return item;
}

// próxima data de um item que se repete, depois de `after`
export function nextDate(repeat, date, after) {
  if (!repeat || repeat.freq === 'hours') return null;
  let d = date || after;
  const step = Math.max(1, repeat.interval || 1);
  for (let guard = 0; guard < 800; guard++) {
    if (repeat.freq === 'daily') d = addDays(d, step);
    else if (repeat.freq === 'weekly') {
      const days = repeat.days && repeat.days.length ? repeat.days : [weekdayOf(date || after)];
      let n = d;
      do {
        n = addDays(n, 1);
        // intervalo de semanas: só semanas "certas" a partir da data original
      } while (!days.includes(weekdayOf(n)) || (step > 1 && Math.floor(diffDays(startOfWeek(date || after), n) / 7) % step !== 0));
      d = n;
    } else if (repeat.freq === 'monthly') {
      const base = fromISO(d);
      const day = repeat.day || base.getDate();
      const m = new Date(base.getFullYear(), base.getMonth() + step, 1);
      d = toISO(new Date(m.getFullYear(), m.getMonth(), Math.min(day, daysInMonth(m.getFullYear(), m.getMonth()))));
    } else return null;
    if (d > after) return d;
  }
  return null;
}
export function occursOn(repeat, date, iso) {
  if (!repeat || iso <= date) return false;
  const step = Math.max(1, repeat.interval || 1);
  if (repeat.freq === 'daily') return diffDays(date, iso) % step === 0;
  if (repeat.freq === 'weekly') return (repeat.days && repeat.days.length ? repeat.days : [weekdayOf(date)]).includes(weekdayOf(iso)) && Math.floor(diffDays(startOfWeek(date), iso) / 7) % step === 0;
  if (repeat.freq === 'monthly') {
    const d = fromISO(iso);
    return d.getDate() === Math.min(repeat.day || fromISO(date).getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
  }
  return false;
}
const startOfWeek = (iso) => addDays(iso, -weekdayOf(iso));

// Marca como feito. Devolve a lista nova de itens.
// Item que se repete: anda para a próxima data (dinheiro guarda o pagamento no mês).
export function complete(items, id, now = new Date()) {
  const today = todayISO(now);
  const out = [];
  items.forEach((it) => {
    if (it.id !== id) return out.push(it);
    if (it.repeat && it.repeat.freq !== 'hours') {
      const next = nextDate(it.repeat, it.date, it.date && it.date > today ? it.date : today);
      if (it.type === 'money') out.push({ ...it, id: newId(), repeat: null, done: true, doneAt: now.getTime(), date: it.date && it.date < today ? it.date : today, from: it.id });
      out.push({ ...it, date: next || it.date, lastDone: today, doneCount: (it.doneCount || 0) + 1 });
    } else out.push({ ...it, done: true, doneAt: now.getTime(), date: it.type === 'money' && !it.date ? today : it.date });
  });
  return out;
}
export const reopen = (items, id) => items.map((it) => (it.id === id ? { ...it, done: false, doneAt: null } : it));
export const snooze = (items, id, days, now = new Date()) => items.map((it) => (it.id === id ? { ...it, date: addDays(todayISO(now), days) } : it));

export const isLate = (it, now = new Date()) => {
  if (it.done || !it.date) return false;
  const today = todayISO(now);
  if (it.date < today) return true;
  return it.date === today && !!it.time && it.type !== 'money' && minutesOf(it.time) + 60 < now.getHours() * 60 + now.getMinutes() && !it.repeat;
};

const byWhen = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt;

// Lista "Tudo": atrasados, hoje, amanhã, esta semana, depois, sem data, feitos
export function groupItems(items, now = new Date(), filter = null) {
  const today = todayISO(now);
  const g = { late: [], today: [], tomorrow: [], week: [], later: [], someday: [], done: [] };
  items.forEach((it) => {
    if (filter && it.type !== filter) return;
    if (it.done) return g.done.push(it);
    if (!it.date) return g.someday.push(it);
    const d = diffDays(today, it.date);
    if (d < 0) g.late.push(it);
    else if (d === 0) g.today.push(it);
    else if (d === 1) g.tomorrow.push(it);
    else if (d <= 7) g.week.push(it);
    else g.later.push(it);
  });
  Object.keys(g).forEach((k) => g[k].sort(byWhen));
  g.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  g.done = g.done.slice(0, 60);
  return g;
}

// ───────── rotina fixa (aulas, estágio...) ─────────

export function makeBlock(p, existing = []) {
  const used = existing.map((b) => b.color);
  let color = 0;
  for (let c = 0; c < BLOCK_COLORS; c++) if (!used.includes(c)) { color = c; break; }
  return { id: newId(), kind: p.kind === 'fixed' ? 'fixed' : 'class', name: (p.name || '').trim(), aliases: p.aliases || [], color: p.color ?? color, room: p.room || '', slots: p.slots || [], grades: [], absences: [], formula: '', archived: false, createdAt: Date.now() };
}

export function blocksOn(blocks, iso) {
  const wd = weekdayOf(iso);
  const out = [];
  blocks.forEach((b) => {
    if (b.archived) return;
    (b.slots || []).forEach((s) => {
      if ((s.days || []).includes(wd)) out.push({ kind: 'block', id: `${b.id}@${s.start}`, block: b, start: s.start, end: s.end, absent: (b.absences || []).some((a) => a.date === iso) });
    });
  });
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// Tudo de um dia, na ordem: primeiro o que tem hora (aulas e itens juntos), depois o resto.
export function dayAgenda(state, iso, now = new Date()) {
  const today = todayISO(now);
  const timed = blocksOn(state.blocks, iso).map((b) => ({ ...b, time: b.start }));
  const loose = [];
  const done = [];
  state.items.forEach((it) => {
    // item que se repete aparece também nos próximos dias em que vai cair
    if (it.repeat && !it.done && it.date && it.date < iso && iso > today && occursOn(it.repeat, it.date, iso)) {
      const ghost = { ...it, date: iso, ghost: true };
      if (it.time) timed.push({ kind: 'item', id: `${it.id}@${iso}`, item: ghost, time: it.time, end: it.endTime });
      else loose.push(ghost);
      return;
    }
    if (it.date !== iso) return;
    if (it.done) return done.push(it);
    if (it.time) timed.push({ kind: 'item', id: it.id, item: it, time: it.time, end: it.endTime });
    else loose.push(it);
  });
  timed.sort((a, b) => a.time.localeCompare(b.time));
  const late = iso === today ? state.items.filter((it) => !it.done && it.date && it.date < today).sort(byWhen) : [];
  loose.sort((a, b) => typeRank(a) - typeRank(b) || a.createdAt - b.createdAt);
  return { timed, loose, late, done };
}
const typeRank = (it) => (it.type === 'study' ? 0 : it.type === 'money' ? 1 : 2);

// O que está acontecendo agora e o que vem depois (para o cartão do topo)
export function nowAndNext(agenda, now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  let current = null;
  let next = null;
  agenda.timed.forEach((e) => {
    const s = minutesOf(e.time);
    const end = e.end ? minutesOf(e.end) : s + (e.kind === 'block' ? 100 : 30);
    if (e.kind === 'block' && e.absent) return;
    if (s <= m && m < end && !current) current = e;
    else if (s > m && !next) next = e;
  });
  return { current, next, minutesToNext: next ? minutesOf(next.time) - m : null };
}

// horários livres do dia entre 7h e 23h, com pelo menos 45 minutos
export function freeSlots(agenda, from = '07:00', to = '23:00') {
  const busy = agenda.timed.map((e) => [minutesOf(e.time), e.end ? minutesOf(e.end) : minutesOf(e.time) + (e.kind === 'block' ? 100 : 30)]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = minutesOf(from);
  busy.forEach(([s, e]) => {
    if (s - cur >= 45) out.push({ start: hhmm(Math.floor(cur / 60), cur % 60), end: hhmm(Math.floor(s / 60), s % 60), minutes: s - cur });
    cur = Math.max(cur, e);
  });
  const end = minutesOf(to);
  if (end - cur >= 45) out.push({ start: hhmm(Math.floor(cur / 60), cur % 60), end: to, minutes: end - cur });
  return out;
}

// ───────── dinheiro ─────────

export function monthMoney(items, key, settings = DEFAULT_SETTINGS, now = new Date()) {
  const r = { key, in: 0, out: 0, toPay: 0, toReceive: 0, byCategory: {}, paid: [], pending: [], moved: [] };
  items.forEach((it) => {
    if (it.type !== 'money' || !it.date || monthKey(it.date) !== key) return;
    // transferência entre contas suas não é gasto nem renda
    if (it.flow === 'transfer') return r.moved.push(it);
    if (it.done) {
      if (it.flow === 'in') r.in += it.amount;
      else {
        r.out += it.amount;
        r.byCategory[it.category] = (r.byCategory[it.category] || 0) + it.amount;
      }
      r.paid.push(it);
    } else {
      if (it.flow === 'in') r.toReceive += it.amount;
      else r.toPay += it.amount;
      r.pending.push(it);
    }
  });
  r.paid.sort((a, b) => b.date.localeCompare(a.date) || (b.doneAt || 0) - (a.doneAt || 0));
  r.pending.sort(byWhen);
  r.balance = r.in - r.out;
  r.limit = settings.monthLimit || 0;
  r.used = r.limit ? r.out / r.limit : null;
  r.left = r.limit ? r.limit - r.out - r.toPay : null;
  // quanto dá para gastar por dia até o fim do mês
  const today = todayISO(now);
  if (r.limit && monthKey(today) === key) {
    const [y, m] = key.split('-').map(Number);
    const daysLeft = daysInMonth(y, m - 1) - now.getDate() + 1;
    r.perDay = r.left > 0 ? r.left / daysLeft : 0;
    r.daysLeft = daysLeft;
  }
  r.categories = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total, share: r.out ? total / r.out : 0 }));
  return r;
}

// ───────── notas e faltas ─────────

// Notas e faltas: as regras são as da 1.13.0 (src/legacy/academic.js). Uma matéria aqui tem
// slots (horários), grades [{ id, name, score, max, weight, date }] e absences [{ id, date, count }].
export const asSubject = (b) => ({ ...b, schedules: b.slots || [] });
export const gradeOf = (block, settings) => gradeSummary(block, academicOf(settings));
export const absencesOf = (block, settings = {}) => absenceSummary(asSubject(block), academicOf(settings), settings.semester || null, settings.state || null);
export const lessonsOnDay = (block, iso, settings) => lessonsOn(asSubject(block), iso, academicOf(settings).classMinutes) || 1;

// falta num dia: marca (com o número de aulas do dia) ou desmarca
export function toggleAbsence(block, iso, settings) {
  const has = (block.absences || []).some((a) => a.date === iso);
  return { ...block, absences: has ? block.absences.filter((a) => a.date !== iso) : [...(block.absences || []), { id: newId(), date: iso, count: lessonsOnDay(block, iso, settings) }] };
}
export function addAbsence(block, iso, count) {
  return { ...block, absences: [...(block.absences || []), { id: newId(), date: iso, count: Math.max(1, Number(count) || 1) }] };
}
// nota nova; se a matéria já tem a avaliação com esse nome e sem nota (ex.: "P2", com peso), preenche ela
export function addGrade(block, g) {
  const before = block.grades || [];
  const same = before.find((x) => (x.score === null || x.score === undefined) && String(x.name || '').trim().toLowerCase() === String(g.name || '').trim().toLowerCase());
  const grade = same ? { ...same, ...g, id: same.id, weight: g.weight || same.weight || null } : { id: newId(), max: null, weight: null, ...g };
  return { ...block, grades: same ? before.map((y) => (y.id === same.id ? grade : y)) : [...before, grade] };
}

export function nextClass(block, now = new Date()) {
  const today = todayISO(now);
  const nowT = hhmm(now.getHours(), now.getMinutes());
  for (let i = 0; i < 8; i++) {
    const d = addDays(today, i);
    const wd = weekdayOf(d);
    const slots = (block.slots || []).filter((s) => (s.days || []).includes(wd) && (i > 0 || s.start > nowT)).sort((a, b) => a.start.localeCompare(b.start));
    if (slots.length) return { date: d, start: slots[0].start, end: slots[0].end };
  }
  return null;
}

// ───────── aplicar o que o interpretador entendeu ─────────

// ações (nota, falta, horário) viram mudanças nas matérias. Devolve { blocks, notes: [texto] }.
export function applyActions(blocks, actions, now = new Date(), settings = {}) {
  let out = blocks.slice();
  const notes = [];
  const byId = (id) => out.find((b) => b.id === id);
  const upsert = (b) => {
    out = out.some((x) => x.id === b.id) ? out.map((x) => (x.id === b.id ? b : x)) : [...out, b];
  };
  actions.forEach((a) => {
    if (a.type === 'schedule') {
      const b = byId(a.subjectId) || out.find((x) => !x.archived && x.name.toLowerCase() === String(a.name || '').toLowerCase()) || makeBlock({ kind: a.block, name: a.name }, out);
      let slots = b.slots || [];
      (a.slots || [{ days: a.days, start: a.start, end: a.end }]).forEach((slot) => {
        if (!slots.some((s) => s.start === slot.start && s.end === slot.end && s.days.join() === slot.days.join())) slots = [...slots, { days: slot.days, start: slot.start, end: slot.end }];
      });
      upsert({ ...b, slots });
      notes.push(`${b.name}: horário guardado`);
    } else if (a.type === 'grade') {
      const b = byId(a.subjectId);
      if (!b) return notes.push('Escolha a matéria da nota.');
      upsert(addGrade(b, { name: a.name || 'Avaliação', score: a.score, max: a.max || null, date: a.date || todayISO(now), ...(a.studyId ? { studyId: a.studyId } : null) }));
      notes.push(`${b.name}: ${a.name} ${String(a.score).replace('.', ',')}`);
    } else if (a.type === 'absence') {
      const b = byId(a.subjectId);
      if (!b) return notes.push('Escolha a matéria da falta.');
      const nb = addAbsence(b, a.date || todayISO(now), a.count || lessonsOnDay(b, a.date || todayISO(now), settings));
      upsert(nb);
      const sum = absencesOf(nb, settings);
      notes.push(`${b.name}: falta anotada${sum.status === 'near' || sum.status === 'over' ? ` · ${absenceStatusText(sum).toLowerCase()}` : ''}`);
    }
  });
  return { blocks: out, notes };
}

// ───────── texto curto de cada item (usado na tela e nos avisos) ─────────

export function whenText(it, now = new Date()) {
  if (!it.date) return it.time || '';
  const d = dayLabel(it.date, now);
  return it.time ? `${d} · ${it.time}${it.endTime ? `–${it.endTime}` : ''}` : d;
}
export function repeatText(r) {
  if (!r) return '';
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  if (r.freq === 'hours') return `a cada ${r.every} h`;
  if (r.freq === 'daily') return r.interval > 1 ? `a cada ${r.interval} dias` : 'todo dia';
  if (r.freq === 'weekly') {
    const days = (r.days || []).slice().sort();
    if (days.join() === '1,2,3,4,5') return 'seg a sex';
    return days.length === 7 ? 'todo dia' : `toda ${days.map((d) => names[d]).join(', ')}`;
  }
  if (r.freq === 'monthly') return `todo dia ${r.day || 1}`;
  return '';
}
export const moneyText = (it, hide) => `${it.flow === 'in' ? '+' : it.flow === 'transfer' ? '⇄' : '−'} ${hide ? 'R$ •••' : formatMoney(it.amount)}`;
export { at };
