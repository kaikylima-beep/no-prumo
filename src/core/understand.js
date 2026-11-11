// Entender o que a pessoa falou ou escreveu (1.14).
//
// O motor é o da 1.13.1 (src/legacy/parser.js + normalize.js): fala natural, horas e datas faladas,
// vários pedidos numa frase, medido em 278 frases. Em cima dele, o que só o Prumo novo faz:
//   - perguntas ("o que eu tenho amanhã?", "qual é o meu saldo?")      → nlu.parseQuery
//   - nota e falta ("tirei 7,5 na P1", "faltei hoje")                   → legacy/academic.parseAcademic
//   - horário de matéria ou fixo, com vários dias e horários            → nlu.js (ação "schedule")
//   - duração ("tenho 10 minutos para…", "depois disso … em 30 minutos") → nlu.js
// O resultado sai no formato do Prumo novo: { items, actions, query }.
import { parseInput, splitSegments } from '../legacy/parser.js';
import { cleanSpeech, fold } from '../legacy/normalize.js';
import { enrichParsed } from '../legacy/subjects.js';
import { isAcademicStart, parseAcademic } from '../legacy/academic.js';
import { parse as nluParse, parseQuery } from './nlu.js';
import { mapCategory } from './money.js';
import { toISO } from './dates.js';

// matéria do Prumo novo no formato que os módulos da 1.13.1 esperam
export const asSubject = (b) => ({ ...b, schedules: b.slots || b.schedules || [] });

const studyKindOf = (title) => (/\b(prova|p\d|exame|semin|apresenta|teste|simulado|avalia|quiz)/i.test(fold(title)) ? 'prova' : /\b(trabalho|lista|relat|entreg|projeto|tcc|atividade|resenha|fichamento|exercicio)/i.test(fold(title)) ? 'entrega' : 'estudo');

// item da 1.13.1 → item do Prumo novo
function convert(it) {
  const base = {
    title: it.title || '',
    date: it.date || null,
    time: it.time || null,
    endTime: null,
    repeat: null,
    remind: it.lead ? it.lead * 1440 : null,
    raw: it.raw || '',
  };
  if (it.repeat && it.repeat.freq) {
    const r = it.repeat;
    base.repeat = r.freq === 'weekly' ? { freq: 'weekly', days: r.days && r.days.length ? r.days : null } : r.freq === 'monthly' ? { freq: 'monthly', day: r.day || null } : { freq: 'daily' };
    if (r.freq === 'weekly' && !base.repeat.days) delete base.repeat.days;
    if (r.freq === 'monthly' && !base.repeat.day) delete base.repeat.day;
    // remédio "3 vezes ao dia", água "de 2 em 2 horas": vários horários por dia
    if (r.interval && it.times && it.times.length > 1) base.times = it.times.slice();
  }
  if (it.askDay) base.askDay = true;
  if (it.askPlace) base.askPlace = true;
  if (it.kind === 'finance') {
    const flow = it.type === 'in' ? 'in' : it.type === 'transfer' ? 'transfer' : 'out';
    return { ...base, type: 'money', time: null, flow, amount: Number(it.amount) || 0, paid: it.status === 'paid', category: flow === 'transfer' ? 'Transferência' : mapCategory(it.category, flow) };
  }
  if (it.kind === 'study') return { ...base, type: 'study', studyKind: studyKindOf(base.title), subjectId: it.subjectId || null };
  return { ...base, type: 'task' };
}

const WEEKDAY_START = /^(?:e\s+)?(?:na\s+|nas\s+|a\s+|as\s+)?(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?\b/;
const SEQ_START = /^(?:e\s+)?(?:disso|depois|em seguida|dai|ai)\b/;
const REL_MINUTES = /\bem\s+(\d+)\s+(minutos?|min|horas?)\b/;

export function understand(text, { now = new Date(), blocks = [], settings = {} } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return { items: [], actions: [], query: null };
  const today = toISO(now);
  const subjects = blocks.filter((b) => b.kind !== 'fixed' && !b.archived).map(asSubject);
  const ctx = { now, subjects: blocks };

  const query = parseQuery(raw, ctx);
  if (query) return { items: [], actions: [], query };

  // 1. nota e falta saem antes (como na 1.13.0)
  const actions = [];
  let rest = raw;
  const segs = splitSegments(cleanSpeech(raw));
  if (segs.some(isAcademicStart)) {
    const others = [];
    segs.forEach((sg) => {
      const r = isAcademicStart(sg) ? parseAcademic(sg, subjects, today, settings.academic) : [];
      if (r.length) r.forEach((a) => actions.push(a.kind === 'grade' ? { type: 'grade', subjectId: a.subjectId, subjectName: a.subjectId ? null : null, name: a.title, score: a.score, max: a.max, date: a.date } : { type: 'absence', subjectId: a.subjectId, date: a.date, count: a.count }));
      else others.push(sg);
    });
    rest = others.join(', ');
  }
  if (!rest.trim()) return { items: [], actions, query: null };

  // 2. o motor da 1.13.1
  const legacy = enrichParsed(parseInput(rest, today, now, { short: !!settings.shortTitles }), subjects, { occupation: settings.occupation, occupationName: settings.occupationName });
  const items = [];
  let last = null; // último resultado: { kind: 'item' | 'action', ref }
  legacy.forEach((li) => {
    const f = fold(li.raw || li.title || '');
    const extra = li.raw ? nluParse(li.raw, ctx) : { items: [], actions: [] };
    // horário de matéria ou fixo ("aula de cálculo segunda e quarta das 10 às 12")
    const sched = extra.actions.find((a) => a.type === 'schedule');
    if (sched && !extra.items.length) {
      actions.push(sched);
      last = { kind: 'action', ref: sched };
      return;
    }
    // "… e sexta das 18:20 às 20:20": continua o horário que acabou de ser dito
    if (last && last.kind === 'action' && last.ref.type === 'schedule' && WEEKDAY_START.test(f) && li.time) {
      const probe = nluParse(`aulas ${li.raw}`, { now, subjects: [] }).actions.find((a) => a.type === 'schedule');
      if (probe) {
        const slots = last.ref.slots || [{ days: last.ref.days, start: last.ref.start, end: last.ref.end }];
        last.ref.slots = [...slots, ...(probe.slots || [{ days: probe.days, start: probe.start, end: probe.end }])];
        return;
      }
    }
    const item = convert(li);
    const mine = extra.items.length === 1 ? extra.items[0] : null;
    // duração ("tenho 10 minutos para lavar a louça")
    if (mine && mine.duration) Object.assign(item, { title: mine.title, duration: mine.duration, date: mine.date || item.date, time: mine.time || null });
    // "depois disso arrumar o quarto em 30 minutos": depois de algo com duração, é duração também
    const prev = last && last.kind === 'item' ? last.ref : null;
    const rel = REL_MINUTES.exec(f);
    if (prev && prev.duration && !prev.time && rel && (SEQ_START.test(f) || li.after)) {
      item.duration = /^h/.test(rel[2]) ? Number(rel[1]) * 60 : Number(rel[1]);
      item.date = prev.date;
      item.time = null;
      delete item.askDay;
      if (mine) item.title = mine.title;
    }
    // faixa de horário ("reunião das 14 às 16"): o fim fica guardado
    if (mine && mine.endTime && item.time === mine.time) item.endTime = mine.endTime;
    if (item.time && !item.date) item.date = today;
    items.push(item);
    last = { kind: 'item', ref: item };
  });
  return { items, actions, query: null };
}
