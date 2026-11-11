// Matérias (1.12): achar a matéria citada numa frase, perguntar "Faculdade ou estágio?",
// horários e semestre. Funções puras (sem tela), testadas em scripts/test-parser.mjs.
import { fold } from './parser.js';
import { parseBR, parseTime, pad, toISO, fromISO } from './utils.js';

// ---------- comparar nomes ----------

const NUMBER_WORDS = { dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6' };
const ROMAN = { ii: '2', iii: '3', iv: '4', vi: '6' };

// "Cálculo II" e "calc2" e "cálculo dois": tudo na mesma forma
function norm(text, isName) {
  let s = fold(String(text || ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .trim();
  s = s
    .split(/\s+/)
    .map((w) => NUMBER_WORDS[w] || ROMAN[w] || w)
    .join(' ');
  // num nome, "Física I" termina em 1 e "Física V" em 5
  if (isName) s = s.replace(/ i$/, ' 1').replace(/ v$/, ' 5');
  return s;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// o "1" também pode ter sido dito "um" ou "uma"
const termRe = (term) => new RegExp(`(?:^| )${escapeRe(term).replace(/\b1\b/g, '(?:1|um|uma|i)')}(?: |$)`);

const GENERIC = new Set(['introducao', 'fundamentos', 'engenharia', 'topicos', 'laboratorio', 'teoria', 'pratica', 'principios', 'nocoes', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'para']);

// primeira palavra que identifica a matéria ("Circuitos Elétricos" → "circuitos")
function shortWord(name) {
  const w = norm(name, true).split(' ').find((x) => x.length >= 4 && !GENERIC.has(x) && !/^\d+$/.test(x));
  return w || null;
}

export const subjectTerms = (s) => [...new Set([s.name, ...(s.aliases || [])].map((t) => norm(t, true)).filter(Boolean))];

// Devolve { subject, exact } ou null. Nome ou apelido completos ganham; uma palavra só do nome
// vale quando só uma matéria ativa tem essa palavra e não vem número depois ("cálculo 3").
export function findSubject(text, subjects) {
  const active = (subjects || []).filter((s) => !s.archived);
  if (!active.length) return null;
  const t = norm(text, false);
  let best = null;
  active.forEach((subject) => {
    subjectTerms(subject).forEach((term) => {
      if (termRe(term).test(t) && (!best || term.length > best.term.length)) best = { subject, term };
    });
  });
  if (best) return { subject: best.subject, exact: true };
  const words = active.map((s) => shortWord(s.name));
  const hits = active.filter((s, i) => {
    const w = words[i];
    return w && words.filter((x) => x === w).length === 1 && new RegExp(`(?:^| )${escapeRe(w)}(?: (?!\\d)|$)`).test(t);
  });
  return hits.length === 1 ? { subject: hits[0], exact: false } : null;
}

// ---------- ocupação ----------

export const OCCUPATIONS = [
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'estagio', label: 'Estágio' },
  { key: 'outros', label: 'Outros' },
  { key: 'so_estudo', label: 'Só estudo' },
];

// Nome usado na pergunta ("estágio", "trabalho", "monitoria"). null = só estuda, sem pergunta.
export function occupationName(profile) {
  const o = profile && profile.occupation;
  if (o === 'so_estudo') return null;
  if (o === 'estagio') return 'estágio';
  if (o === 'outros') {
    const n = String(profile.occupationName || '').trim();
    return n ? n.charAt(0).toLowerCase() + n.slice(1) : 'trabalho';
  }
  return 'trabalho'; // 'trabalho' ou ainda não respondeu
}

export const placeQuestion = (name) => `Faculdade ou ${name}?`;

const AMBIGUOUS = /\b(relatorios?|entregas?|entregar|laboratorios?|apresentacao)\b/;
const SURELY_STUDY = /\b(faculdade|universidade|provas?|aulas?|professora?|materias?|disciplinas?|tcc|semestre)\b/;
const HOUSE_VERB = /^\s*(comprar|pagar|buscar|levar|pegar|lavar|limpar|arrumar|devolver|imprimir)\b/;

function mentionsOccupation(f, name, profile) {
  if (profile && profile.occupation === 'trabalho') return /\b(?:d[oa]|n[oa]|pr[oa]|para\s+[oa]|ao)\s+(?:trabalho|empresa|servico)\b/.test(f);
  if (!profile || !profile.occupation) return false;
  return new RegExp(`\\b${escapeRe(fold(name))}\\b`).test(f);
}

// Completa o que o interpretador devolveu: matéria citada e a pergunta "Faculdade ou estágio?".
// Não mexe em finanças. A pessoa ainda confere tudo antes de salvar.
export function enrichParsed(items, subjects, profile) {
  const name = occupationName(profile);
  return items.map((it) => {
    if (it.kind === 'finance') return it;
    const raw = it.raw || it.title || '';
    const f = fold(raw);
    const hit = findSubject(raw, subjects);
    // "calc 2 sexta às 10" sem palavra de estudo vai para Estudos; "comprar livro de calc 2" fica em Tarefas
    if (hit && (it.kind === 'study' || (hit.exact && !HOUSE_VERB.test(f)))) return { ...it, kind: 'study', subjectId: hit.subject.id };
    if (it.kind !== 'study' || !name || SURELY_STUDY.test(f)) return it;
    if (mentionsOccupation(f, name, profile)) return { ...it, kind: 'task' };
    return AMBIGUOUS.test(f) ? { ...it, askPlace: true } : it;
  });
}

// Itens de estudo sem matéria que citam o nome ou um apelido (só correspondência completa)
export function itemsToLink(study, subject) {
  return (study || []).filter((t) => {
    if (t.subjectId || t.done) return false;
    const hit = findSubject(`${t.title} ${t.note || ''}`, [{ ...subject, archived: false }]);
    return !!(hit && hit.exact);
  });
}

// ---------- horários ----------

export const WEEK_CHIPS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const DAY_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
const dayOrder = (d) => (d === 0 ? 7 : d);

export function scheduleLabel(h) {
  const days = [...(h.days || [])].sort((a, b) => dayOrder(a) - dayOrder(b)).map((d) => DAY_LABEL[d]).join(', ');
  return `${days} · ${h.start}–${h.end}`;
}

// Próxima aula a partir de agora: { date, start, end, today, tomorrow } ou null
export function nextClass(subject, now = new Date()) {
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const list = subject.schedules || [];
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const found = list
      .filter((h) => (h.days || []).includes(d.getDay()) && (offset > 0 || h.end > hm))
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (found) return { date: toISO(d), day: DAY_LABEL[d.getDay()], start: found.start, end: found.end, today: offset === 0, tomorrow: offset === 1 };
  }
  return null;
}

export function nextClassLabel(subject, now = new Date()) {
  const n = nextClass(subject, now);
  if (!n) return null;
  return `${n.today ? 'Hoje' : n.tomorrow ? 'Amanhã' : n.day}, ${n.start}`;
}

// ---------- formulário ----------

export function emptySubjectForm(color = 0) {
  return { name: '', aliasesText: '', color, room: '', schedules: [] };
}

export const emptySchedule = () => ({ days: [], startText: '', endText: '' });

export function toSubjectForm(s) {
  return {
    name: s.name,
    aliasesText: (s.aliases || []).join(', '),
    color: s.color || 0,
    room: s.room || '',
    schedules: (s.schedules || []).map((h) => ({ days: [...h.days], startText: h.start, endText: h.end })),
  };
}

// Valida e devolve { error } ou { data }. selfId = a matéria que está sendo editada.
export function readSubjectForm(form, subjects, selfId) {
  const name = String(form.name || '').trim();
  if (!name) return { error: 'Falta o nome da matéria.' };
  const aliases = [...new Set(String(form.aliasesText || '').split(/[,;]/).map((a) => a.trim()).filter(Boolean))];
  const others = (subjects || []).filter((s) => s.id !== selfId && !s.archived);
  const mine = new Set([name, ...aliases].map((t) => norm(t, true)));
  for (const other of others) {
    const clash = subjectTerms(other).find((t) => mine.has(t));
    if (clash) return { error: `"${clash}" já é usado em ${other.name}. Cada apelido só pode ser de uma matéria.` };
  }
  const schedules = [];
  for (const h of form.schedules || []) {
    if (!h.days.length && !h.startText && !h.endText) continue;
    if (!h.days.length) return { error: 'Escolha os dias de cada horário.' };
    const start = parseTime(h.startText);
    const end = parseTime(h.endText);
    if (!start || !end) return { error: 'Horário inválido. Use HH:MM, como 10:00.' };
    if (end <= start) return { error: 'O fim da aula precisa ser depois do início.' };
    schedules.push({ days: [...h.days], start, end });
  }
  return { data: { name, aliases, color: form.color || 0, room: String(form.room || '').trim() || null, schedules } };
}

// ---------- semestre ----------

export function readSemester(startText, endText) {
  const start = startText ? parseBR(startText) : null;
  const end = endText ? parseBR(endText) : null;
  if (!start || !end) return { error: 'Preencha início e fim, no formato DD/MM/AAAA.' };
  if (end <= start) return { error: 'O fim do semestre precisa ser depois do início.' };
  return { data: { start, end } };
}

export const semesterEnded = (semester, today) => !!(semester && semester.end && today > semester.end);

export function semesterLabel(semester) {
  if (!semester || !semester.start || !semester.end) return null;
  const f = (iso) => {
    const d = fromISO(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  return `${f(semester.start)} a ${f(semester.end)}`;
}
