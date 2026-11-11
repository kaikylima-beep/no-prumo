// 1.13 · Notas e faltas. Funções puras (sem tela), testadas em scripts/test-parser.mjs.
//
// Regras da faculdade ficam em settings.academic (cada faculdade tem as suas):
//   passGrade     média para passar (UTFPR: 6)
//   maxGrade      nota máxima (10)
//   classMinutes  duração de uma aula (UTFPR: 50 min). Um horário de 100 min = 2 aulas = 2 faltas.
//   absencePct    limite de faltas, em % das aulas do semestre (25)
//   askAttendance perguntar depois da aula se a pessoa foi (aviso com Fui / Faltei)
//
// Na matéria: grades [{ id, name, score, max, weight, date }] (score null = ainda sem nota),
// formula (texto livre, como no caderno) e absences [{ id, date, count }].
import { fold, wordsToNumbers } from './parser';
import { findSubject } from './subjects';
import { holidaysOfYear } from './holidays';
import { toISO, fromISO } from './utils';

export const DEFAULT_ACADEMIC = { passGrade: 6, maxGrade: 10, classMinutes: 50, absencePct: 25, askAttendance: false };
export const academicOf = (settings) => ({ ...DEFAULT_ACADEMIC, ...((settings && settings.academic) || {}) });

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const minutes = (hm) => {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

// ---------- aulas e faltas ----------

// quantas aulas tem um horário: 100 min com aula de 50 = 2
export function lessonsInBlock(start, end, classMinutes = 50) {
  const len = minutes(end) - minutes(start);
  if (len <= 0) return 1;
  return Math.max(1, Math.round(len / Math.max(1, Number(classMinutes) || 50)));
}

// horários da matéria num dia
export const blocksOn = (subject, iso) => (subject.schedules || []).filter((h) => (h.days || []).includes(fromISO(iso).getDay()));

// quantas aulas da matéria caem num dia (0 = não tem aula)
export function lessonsOn(subject, iso, classMinutes = 50) {
  return blocksOn(subject, iso).reduce((a, h) => a + lessonsInBlock(h.start, h.end, classMinutes), 0);
}

export function weeklyLessons(subject, classMinutes = 50) {
  return (subject.schedules || []).reduce((a, h) => a + (h.days || []).length * lessonsInBlock(h.start, h.end, classMinutes), 0);
}

// dias sem aula: feriados nacionais e do estado (ponto facultativo conta como dia de aula)
function holidaySet(start, end, state) {
  const set = new Set();
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    holidaysOfYear(y, state).forEach((h) => {
      if (h.type !== 'facultativo') set.add(h.date);
    });
  }
  return set;
}

// total de aulas do semestre, pelos horários da matéria, sem os feriados. null = falta o semestre ou o horário
export function semesterLessons(subject, semester, classMinutes = 50, state = null) {
  if (!semester || !semester.start || !semester.end || !(subject.schedules || []).length) return null;
  const off = holidaySet(semester.start, semester.end, state);
  let total = 0;
  const d = fromISO(semester.start);
  for (let guard = 0; guard < 400; guard++) {
    const iso = toISO(d);
    if (iso > semester.end) break;
    if (!off.has(iso)) total += lessonsOn(subject, iso, classMinutes);
    d.setDate(d.getDate() + 1);
  }
  return total;
}

export const absenceCount = (subject) => (subject.absences || []).reduce((a, x) => a + (Number(x.count) || 1), 0);

// { count, total, limit, left, status: 'ok' | 'near' | 'over' | null }
export function absenceSummary(subject, academic = DEFAULT_ACADEMIC, semester = null, state = null) {
  const count = absenceCount(subject);
  const total = semesterLessons(subject, semester, academic.classMinutes, state);
  if (total === null) return { count, total: null, limit: null, left: null, status: null };
  const limit = Math.floor((total * (Number(academic.absencePct) || 25)) / 100);
  const left = limit - count;
  // perto do limite: o que falta cabe em uma semana de aulas (no mínimo 2)
  const week = Math.max(2, weeklyLessons(subject, academic.classMinutes));
  const status = left < 0 ? 'over' : left <= week ? 'near' : 'ok';
  return { count, total, limit, left, status };
}

export function absenceLine(sum) {
  if (sum.total === null) return sum.count ? `${sum.count} ${sum.count === 1 ? 'falta' : 'faltas'}` : 'Nenhuma falta';
  return `Faltas ${sum.count} de ${sum.limit}`;
}

export function absenceStatusText(sum) {
  if (sum.status === 'over') return `Passou ${-sum.left} do limite de faltas`;
  if (sum.left === null) return 'Informe o semestre para ver o limite de faltas';
  if (sum.left === 0) return 'Não pode faltar mais';
  return `Pode faltar mais ${sum.left} ${sum.left === 1 ? 'aula' : 'aulas'}`;
}

// ---------- notas ----------

// nota na escala da nota máxima da faculdade (uma lista valendo 2 com nota 1,5 → 7,5 de 10)
const scaled = (g, maxGrade) => (Number(g.score) / (Number(g.max) || maxGrade)) * maxGrade;
const hasScore = (g) => g.score !== null && g.score !== undefined && g.score !== '' && Number.isFinite(Number(g.score));

// Média e quanto falta. O app só calcula com os pesos de todas as avaliações (cada professor
// calcula de um jeito; sem pesos, só mostra as notas e a fórmula anotada).
export function gradeSummary(subject, academic = DEFAULT_ACADEMIC) {
  const grades = subject.grades || [];
  const graded = grades.filter(hasScore);
  const maxGrade = Number(academic.maxGrade) || 10;
  const pass = Number(academic.passGrade) || 6;
  const withWeights = grades.length > 0 && grades.every((g) => Number(g.weight) > 0);
  if (!withWeights || !graded.length) return { graded: graded.length, total: grades.length, withWeights, average: null, needed: null, status: null };
  const wAll = grades.reduce((a, g) => a + Number(g.weight), 0);
  const wDone = graded.reduce((a, g) => a + Number(g.weight), 0);
  const acc = graded.reduce((a, g) => a + Number(g.weight) * scaled(g, maxGrade), 0);
  const average = r2(acc / wDone);
  if (wDone >= wAll - 1e-9) {
    const final = r2(acc / wAll);
    return { graded: graded.length, total: grades.length, withWeights, average: final, needed: null, status: final >= pass - 1e-9 ? 'passed' : 'failed' };
  }
  const needed = r2((pass * wAll - acc) / (wAll - wDone));
  const status = needed <= 0 ? 'safe' : needed > maxGrade ? 'impossible' : 'needs';
  return { graded: graded.length, total: grades.length, withWeights, average, needed: Math.max(0, needed), status };
}

export const fmtGrade = (n) => (n === null || n === undefined ? '—' : String(r1(Number(n))).replace('.', ','));

export function gradeLine(sum) {
  if (sum.average !== null) return `Média ${fmtGrade(sum.average)}`;
  if (!sum.total) return 'Sem notas';
  return `${sum.graded} de ${sum.total} ${sum.total === 1 ? 'nota' : 'notas'}`;
}

export function gradeStatusText(sum, academic = DEFAULT_ACADEMIC) {
  const pass = fmtGrade(academic.passGrade);
  if (sum.status === 'passed') return `Passou: média final ${fmtGrade(sum.average)} (precisa de ${pass})`;
  if (sum.status === 'failed') return `Média final ${fmtGrade(sum.average)}, abaixo de ${pass}`;
  if (sum.status === 'safe') return `Já tem a média para passar (${pass})`;
  if (sum.status === 'impossible') return `Precisaria de ${fmtGrade(sum.needed)} nas próximas, acima da nota máxima`;
  if (sum.status === 'needs') return `Precisa de ${fmtGrade(sum.needed)} nas próximas para passar (média ${pass})`;
  if (sum.total && !sum.withWeights) return 'Coloque o peso de cada avaliação para o app calcular a média';
  return null;
}

// "7,5" "7.5" "7 e meio" → 7.5 ; aceita "8" ; null se não for número
export function parseGrade(text) {
  const t = String(text || '').trim().replace(/\s+e\s+meio$/i, ',5').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

// ---------- voz: "tirei 7,5 na P1 de cálculo", "faltei na aula de física", "faltei hoje" ----------

const EVAL_WORD = /\b(p\s?\d|prova|provas|teste|exame|trabalho|lista|seminario|apresentacao|atividade|relatorio|simulado|avaliacao|nota|projeto|quiz|laboratorio|lab)\b/;
const MONEY_WORD = /\b(reais|real|r\$|dinheiro|caixa|pix|conto|contos|centavos?)\b/;
const GRADE_RE = /^\s*(?:eu\s+)?(?:tirei|fiquei\s+com|peguei|minha\s+nota\s+foi)\s+(\d+(?:[.,]\d+)?(?:\s+e\s+meio)?)(?:\s+de\s+(\d+(?:[.,]\d+)?))?\s+(?:na|no|em|nas|nos)\s+(.+?)\s*[.!]?$/;
const ABSENCE_RE = /^\s*(?:eu\s+)?(?:faltei|nao\s+fui)\b(.*)$/;

function evalNameOf(rest, subject) {
  // "p1 de calculo 2" → "P1"; "trabalho de fisica" → "Trabalho"
  let name = rest;
  const cut = /\s+(?:de|da|do|em)\s+/.exec(name);
  if (subject && cut) name = name.slice(0, cut.index);
  name = name.replace(/\bp\s?(\d)\b/g, 'P$1').trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Avaliação';
}

function dayOf(rest, today) {
  if (/\banteontem\b/.test(rest)) return toISO(new Date(fromISO(today).getTime() - 2 * 86400000));
  if (/\bontem\b/.test(rest)) return toISO(new Date(fromISO(today).getTime() - 86400000));
  return today;
}

// Devolve uma lista de itens (vazia se a frase não é de nota nem de falta)
export function parseAcademic(segment, subjects = [], today, academic = DEFAULT_ACADEMIC) {
  const f = fold(wordsToNumbers(String(segment || '')));
  const g = GRADE_RE.exec(f);
  if (g && !MONEY_WORD.test(f)) {
    const score = parseGrade(g[1]);
    const max = g[2] ? parseGrade(g[2]) : null;
    const rest = g[3];
    const hit = findSubject(rest, subjects);
    const maxGrade = Number(academic.maxGrade) || 10;
    if (score !== null && score <= (max || maxGrade * 10) && (hit || EVAL_WORD.test(rest))) {
      return [{ kind: 'grade', raw: segment, subjectId: hit ? hit.subject.id : null, title: evalNameOf(rest, hit && hit.subject), score, max: max || null, date: today }];
    }
  }
  const a = ABSENCE_RE.exec(f);
  if (a) {
    const rest = a[1] || '';
    const date = dayOf(rest, today);
    const hit = findSubject(rest, subjects);
    const cm = academic.classMinutes;
    if (hit) return [{ kind: 'absence', raw: segment, subjectId: hit.subject.id, date, count: lessonsOn(hit.subject, date, cm) || 1, title: 'Faltei na aula' }];
    // "faltei hoje": todas as matérias com aula no dia
    const withClass = subjects.filter((s) => !s.archived && lessonsOn(s, date, cm) > 0);
    if (withClass.length && !/\baula\s+de\s+\w/.test(rest)) {
      return withClass.map((s) => ({ kind: 'absence', raw: segment, subjectId: s.id, date, count: lessonsOn(s, date, cm), title: 'Faltei na aula' }));
    }
    return [{ kind: 'absence', raw: segment, subjectId: null, date, count: 1, title: 'Falta' }];
  }
  return [];
}

// frases da captura que são de nota ou falta (para tirar do interpretador geral)
export const isAcademicStart = (segment) => /^\s*(?:eu\s+)?(?:tirei|fiquei\s+com|peguei|minha\s+nota\s+foi|faltei|nao\s+fui)\b/.test(fold(String(segment || '')));

// ---------- "Já saiu a nota?": provas e trabalhos de uma matéria que já passaram, sem nota ----------

const PAST_EVAL = /\b(prova|teste|exame|trabalho|seminario|apresentacao|lista|relatorio|simulado|avaliacao|projeto|p\s?\d)\b/;
export function gradesToAsk(study = [], subjects = [], today, days = 30) {
  const from = toISO(new Date(fromISO(today).getTime() - days * 86400000));
  return study.filter((t) => {
    if (!t.subjectId || !t.date || t.repeat || t.date >= today || t.date < from || t.gradeAsked) return false;
    if (!PAST_EVAL.test(fold(t.title || ''))) return false;
    const s = subjects.find((x) => x.id === t.subjectId && !x.archived);
    if (!s) return false;
    return !(s.grades || []).some((g) => g.studyId === t.id);
  });
}

// ---------- aviso "Foi na aula?" ----------

// aulas que já terminaram ou vão terminar nos próximos `days` dias: [{ subjectId, date, end, count }]
export function upcomingClassEnds(subjects = [], semester = null, academic = DEFAULT_ACADEMIC, state = null, now = new Date(), days = 21) {
  const out = [];
  const start = toISO(now);
  const last = toISO(new Date(now.getTime() + days * 86400000));
  const off = holidaySet(start, last, state);
  for (const s of subjects) {
    if (s.archived) continue;
    for (let k = 0; k <= days; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      const iso = toISO(d);
      if (semester && semester.start && iso < semester.start) continue;
      if (semester && semester.end && iso > semester.end) continue;
      if (off.has(iso)) continue;
      for (const h of blocksOn(s, iso)) {
        const [hh, mm] = h.end.split(':').map(Number);
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm + 5, 0, 0);
        if (at.getTime() <= now.getTime() + 30000) continue;
        out.push({ subjectId: s.id, name: s.name, date: iso, end: h.end, count: lessonsInBlock(h.start, h.end, academic.classMinutes), at });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
