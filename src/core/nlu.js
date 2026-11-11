// Interpretador de frases do Peep.
//
// Em vez de uma pilha de expressões para cada frase, ele trabalha em 4 passos:
//   1. palavras    -> a frase vira uma lista de palavras, números, horas e pontuação
//   2. marcações   -> acha o que é data, hora, valor, repetição e lembrete
//   3. pedaços     -> separa a fala corrida em itens (pontuação, "e", verbo novo)
//   4. itens       -> decide o tipo (tarefa, estudo, dinheiro...) e monta o título
//
// Tudo roda no celular, sem internet. Não depende do React.
import { addDays, addMonths, daysInMonth, fromISO, hhmm, toISO, cap } from './dates.js';

// ───────────────────────── 1. palavras ─────────────────────────

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const TOKEN_RE =
  /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)|(\d{1,2}:\d{2})(?!\d)|(\d{1,2})\s?h(?:s|rs)?(\d{2})?(?![\p{L}\d])|(r\$)|(\d+\.\d{1,2}(?!\d)|\d+(?:\.\d{3})*(?:,\d{1,2})?)|([\p{L}][\p{L}\d]*(?:-[\p{L}\d]+)*)|([.,;!?])/giu;

export function tokenize(text) {
  const out = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(String(text || '')))) {
    const raw = m[0];
    if (m[1]) {
      const [d, mo, y] = m[1].split('/').map(Number);
      out.push({ raw, n: raw, kind: 'date', d, mo, y: y ? (y < 100 ? 2000 + y : y) : null });
    } else if (m[2]) {
      const [h, mi] = m[2].split(':').map(Number);
      if (h < 24 && mi < 60) out.push({ raw, n: raw, kind: 'time', h, mi });
      else out.push({ raw, n: raw, kind: 'w' });
    } else if (m[3] !== undefined) {
      const h = Number(m[3]);
      const mi = m[4] ? Number(m[4]) : 0;
      if (h < 24 && mi < 60) out.push({ raw, n: norm(raw), kind: 'time', h, mi });
      else out.push({ raw, n: norm(raw), kind: 'w' });
    } else if (m[5]) out.push({ raw, n: 'r$', kind: 'cur' });
    else if (m[6]) {
      const s = m[6];
      const val = /^\d+\.\d{1,2}$/.test(s) ? parseFloat(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
      out.push({ raw, n: s, kind: 'num', val, dec: /[.,]\d{1,2}$/.test(s) && !/^\d+(\.\d{3})+$/.test(s) });
    } else if (m[7]) out.push({ raw, n: norm(raw).replace(/-feiras?$/, ''), kind: 'w' });
    else out.push({ raw, n: raw, kind: 'p' });
  }
  return out;
}

const UNITS = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const HUNDREDS = { cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };

const magnitude = (n) => (n in HUNDREDS ? 3 : n in TENS ? 2 : n in UNITS ? (UNITS[n] >= 10 ? 2 : 1) : n === 'mil' ? 4 : 0);

// Lê um número na posição i: "60", "1.200", "2 mil", "vinte e cinco", "mil e duzentos".
// "um"/"uma" sozinhos só valem com article = true (quem chama sabe que espera número).
export function readNum(t, i, article = false) {
  const a = t[i];
  if (!a) return null;
  if (a.kind === 'num') {
    if (t[i + 1] && t[i + 1].n === 'mil' && !a.dec) {
      const rest = t[i + 2] && t[i + 2].kind === 'num' && t[i + 2].val < 1000 && !t[i + 2].dec ? t[i + 2] : null;
      return { val: a.val * 1000 + (rest ? rest.val : 0), len: rest ? 3 : 2, digits: true };
    }
    return { val: a.val, len: 1, digits: true, dec: a.dec };
  }
  if (a.kind !== 'w' || !magnitude(a.n)) return null;
  let total = 0;
  let cur = 0;
  let j = i;
  let last = 9;
  while (j < t.length) {
    const w = t[j];
    if (w.kind !== 'w') break;
    const mag = magnitude(w.n);
    if (mag === 4) {
      total += (cur || 1) * 1000;
      cur = 0;
      last = 4;
      j++;
    } else if (mag && (mag < last || last === 4)) {
      cur += HUNDREDS[w.n] ?? TENS[w.n] ?? UNITS[w.n];
      last = mag;
      j++;
    } else if (w.n === 'e' && j > i && t[j + 1] && t[j + 1].kind === 'w' && magnitude(t[j + 1].n) && (magnitude(t[j + 1].n) < last || last === 4) && magnitude(t[j + 1].n) !== 4) {
      j++;
    } else break;
  }
  const len = j - i;
  if (!len) return null;
  if (len === 1 && (a.n === 'um' || a.n === 'uma') && !article) return null;
  return { val: total + cur, len, digits: false };
}

// ───────────────────────── 2. marcações ─────────────────────────

const WEEKDAY = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };
const WEEKDAY_FULL = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingos: 0, segundas: 1, tercas: 2, quartas: 3, quintas: 4, sextas: 5, sabados: 6 };
const MONTH = { janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12 };
const MONTH_FULL = new Set(['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']);
const PERIOD = { manha: 'manha', manhazinha: 'manha', tarde: 'tarde', tardezinha: 'tarde', noite: 'noite', noitinha: 'noite', madrugada: 'madrugada' };
const PERIOD_TIME = { manha: '09:00', tarde: '15:00', noite: '20:00', madrugada: '05:00' };
const MONEY_WORD = new Set(['reais', 'real', 'conto', 'contos', 'pila', 'pilas', 'mangos', 'pau', 'paus', 'dinheiros']);
const TIME_UNIT = { minuto: 'min', minutos: 'min', min: 'min', hora: 'h', horas: 'h', dia: 'd', dias: 'd', semana: 'w', semanas: 'w', mes: 'mo', meses: 'mo' };

const is = (t, i, ...words) => !!t[i] && t[i].kind !== 'p' && words.includes(t[i].n);
const seq = (t, i, words) => words.every((w, k) => t[i + k] && t[i + k].kind !== 'p' && t[i + k].n === w);

function weekdayAt(t, i) {
  const w = t[i];
  if (!w || w.kind !== 'w') return null;
  if (w.n in WEEKDAY_FULL) return WEEKDAY_FULL[w.n];
  // abreviações ("seg", "qua") só quando há outra pista de dia por perto
  return null;
}

// lista de dias: "segunda", "segunda e quarta", "terça, quinta e sábado"
function weekdayList(t, i) {
  const first = weekdayAt(t, i);
  if (first === null) return null;
  const days = [first];
  let j = i + 1;
  if (is(t, j, 'feira', 'feiras')) j++;
  for (;;) {
    let k = j;
    if (t[k] && (t[k].n === ',' || is(t, k, 'e'))) k++;
    if (t[k - 1] && t[k - 1].n === ',' && is(t, k, 'e')) k++;
    const d = weekdayAt(t, k);
    if (d === null) break;
    days.push(d);
    j = k + 1;
    if (is(t, j, 'feira')) j++;
  }
  return { days: [...new Set(days)], len: j - i };
}

function nextWeekday(now, wd, strict = true) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let add = (wd - d.getDay() + 7) % 7;
  if (add === 0 && strict) add = 7;
  d.setDate(d.getDate() + add);
  return toISO(d);
}

function dayOfMonth(now, day, month, year) {
  const today = toISO(now);
  if (month) {
    let y = year || now.getFullYear();
    if (day > daysInMonth(y, month - 1)) return null;
    let iso = toISO(new Date(y, month - 1, day));
    // sem ano: uma data que já passou há mais de 2 meses é do ano que vem
    if (!year && iso < addMonths(today, -2)) iso = toISO(new Date(y + 1, month - 1, day));
    return iso;
  }
  let y = now.getFullYear();
  let m = now.getMonth();
  if (day < now.getDate()) m += 1;
  const base = new Date(y, m, 1);
  if (day > daysInMonth(base.getFullYear(), base.getMonth())) return null;
  return toISO(new Date(base.getFullYear(), base.getMonth(), day));
}

function periodAt(t, i) {
  // "da tarde", "de manhã", "à noite", "pela manhã"
  if (is(t, i, 'da', 'de', 'a', 'na', 'pela', 'no') && t[i + 1] && PERIOD[t[i + 1].n] && t[i + 1].kind === 'w') return { period: PERIOD[t[i + 1].n], len: 2 };
  return null;
}

function resolveHour(h, period) {
  if (period === 'tarde') return h < 12 ? h + 12 : h;
  if (period === 'noite') return h === 12 ? 0 : h >= 5 && h < 12 ? h + 12 : h;
  return h;
}

function mTime(t, i) {
  let j = i;
  let lead = false;
  // "lá para as", "por volta das", "umas", "às", "pelas"
  if (is(t, j, 'la')) j++;
  if (seq(t, j, ['por', 'volta'])) j += 2;
  if (is(t, j, 'para', 'pra', 'ate') && is(t, j + 1, 'as', 'a', 'umas', 'o') ) j++;
  if (is(t, j, 'as', 'pelas', 'umas', 'das', 'la') || (is(t, j, 'a', 'ao', 'o') && t[j + 1] && (t[j + 1].kind === 'time' || is(t, j + 1, 'meio', 'meio-dia', 'meia-noite', 'uma')))) {
    lead = true;
    j++;
  }
  if (is(t, j, 'umas')) j++;
  const a = t[j];
  if (!a) return null;
  // meio-dia, meia-noite
  if (a.n === 'meio-dia' || seq(t, j, ['meio', 'dia'])) return { kind: 'time', len: j - i + (a.n === 'meio-dia' ? 1 : 2), h: 12, mi: 0, sure: true };
  if (a.n === 'meia-noite' || seq(t, j, ['meia', 'noite'])) return { kind: 'time', len: j - i + (a.n === 'meia-noite' ? 1 : 2), h: 0, mi: 0, sure: true };
  if (a.kind === 'time') {
    let len = j - i + 1;
    let h = a.h;
    let sure = /:/.test(a.raw) || a.h > 12 || a.h === 0;
    const p = periodAt(t, j + 1);
    if (p && p.period !== 'madrugada') {
      h = resolveHour(h, p.period);
      len += p.len;
      sure = true;
    }
    return { kind: 'time', len, h, mi: a.mi, sure };
  }
  const num = readNum(t, j, true);
  if (!num || num.dec || num.val > 24 || num.val < 0 || !Number.isInteger(num.val)) return null;
  let k = j + num.len;
  let hasHoras = false;
  if (is(t, k, 'horas', 'hora', 'h', 'hrs')) {
    hasHoras = true;
    k++;
  }
  let mi = 0;
  if (is(t, k, 'e') && is(t, k + 1, 'meia')) {
    mi = 30;
    k += 2;
  } else if (is(t, k, 'e')) {
    const mm = readNum(t, k + 1);
    if (mm && Number.isInteger(mm.val) && mm.val > 0 && mm.val < 60 && (lead || hasHoras) && !MONEY_WORD.has((t[k + 1 + mm.len] || {}).n)) {
      mi = mm.val;
      k += 1 + mm.len;
      if (is(t, k, 'minutos', 'min')) k++;
    }
  }
  const p = periodAt(t, k);
  let h = num.val;
  if (p && p.period !== 'madrugada' && !(is(t, k, 'a', 'na', 'pela', 'no') && !lead && !hasHoras)) {
    h = resolveHour(h, p.period);
    k += p.len;
    return h < 24 ? { kind: 'time', len: k - i, h, mi, sure: true } : null;
  }
  if (!lead && !hasHoras) return null;
  // "2 horas" sem "às" é duração ("estudar 2 horas"), não horário
  if (!lead) return null;
  // depois de "às N" não pode vir uma unidade ("às 3 páginas" não existe; "as 10 camisas" sim)
  if (!hasHoras && t[k] && t[k].kind === 'w' && (MONEY_WORD.has(t[k].n) || /s$/.test(t[k].n)) && !(t[k].n in WEEKDAY_FULL) && !['mas', 'depois', 'mais'].includes(t[k].n) && is(t, j - 1, 'as', 'umas')) {
    if (is(t, i, 'as') && j === i + 1 && !mi) return null;
  }
  if (h === 24) h = 0;
  return { kind: 'time', len: k - i, h, mi, sure: h > 12 || h === 0 };
}

// "das 13 às 18", "de 13h até 18h"
function mTimeRange(t, i) {
  if (!is(t, i, 'das', 'de', 'da', 'do')) return null;
  const a = readClock(t, i + 1);
  if (!a) return null;
  let j = i + 1 + a.len;
  if (!is(t, j, 'as', 'a', 'ate', 'ao')) return null;
  j++;
  if (is(t, j, 'as', 'a', 'o')) j++;
  const b = readClock(t, j);
  if (!b) return null;
  j += b.len;
  let { h: h1 } = a;
  let { h: h2 } = b;
  const p = periodAt(t, j);
  if (p) {
    h2 = resolveHour(h2, p.period);
    if (h1 < h2 - 12) h1 = resolveHour(h1, p.period);
    j += p.len;
  }
  if (h2 <= h1 && h2 < 12) h2 += 12;
  if (h1 > 23 || h2 > 24) return null;
  return { kind: 'time', len: j - i, h: h1, mi: a.mi, h2: h2 % 24, mi2: b.mi, sure: true };
}
function readClock(t, i) {
  const a = t[i];
  if (!a) return null;
  if (a.kind === 'time') return { h: a.h, mi: a.mi, len: 1 };
  if (a.n === 'meio-dia') return { h: 12, mi: 0, len: 1 };
  const num = readNum(t, i, true);
  if (!num || num.dec || num.val > 24 || !Number.isInteger(num.val)) return null;
  let len = num.len;
  if (is(t, i + len, 'horas', 'hora', 'h')) len++;
  let mi = 0;
  if (is(t, i + len, 'e') && is(t, i + len + 1, 'meia')) {
    mi = 30;
    len += 2;
  }
  return { h: num.val, mi, len };
}

function mPartOfDay(t, i) {
  // "de manhã", "à tarde", "hoje à noite" (o "hoje" é marcado à parte)
  if (is(t, i, 'de', 'a', 'pela', 'na', 'no', 'da') && t[i + 1] && t[i + 1].kind === 'w' && PERIOD[t[i + 1].n]) {
    if (is(t, i, 'da', 'no', 'na') && !is(t, i - 1, 'hoje', 'amanha') && !(t[i - 1] && t[i - 1].n in WEEKDAY_FULL)) {
      if (!is(t, i, 'na', 'no')) return null;
      if (is(t, i - 1, 'boa', 'bom', 'toda', 'todo')) return null;
    }
    if (is(t, i - 1, 'boa', 'bom')) return null;
    return { kind: 'part', len: 2, period: PERIOD[t[i + 1].n] };
  }
  if (is(t, i, 'cedo') || seq(t, i, ['bem', 'cedo'])) return { kind: 'part', len: is(t, i, 'cedo') ? 1 : 2, period: 'manha' };
  return null;
}

function mRelative(t, i, now) {
  // "daqui a 2 dias", "daqui 10 minutos", "em 4 horas", "em meia hora", "daqui a pouco"
  let j = i;
  let strong = false;
  if (is(t, j, 'daqui')) {
    strong = true;
    j++;
    if (is(t, j, 'a', 'ha', 'uns', 'umas')) j++;
    if (is(t, j, 'uns', 'umas')) j++;
  } else if (is(t, j, 'em', 'dentro')) {
    j++;
    if (is(t, j, 'de')) j++;
    if (is(t, j, 'uns', 'umas')) j++;
  } else return null;
  if (strong && is(t, j, 'pouco')) return { kind: 'rel', len: j + 1 - i, minutes: 30 };
  let val;
  if (is(t, j, 'meia') && is(t, j + 1, 'hora')) {
    return { kind: 'rel', len: j + 2 - i, minutes: 30 };
  }
  const num = readNum(t, j, true);
  if (!num) return null;
  val = num.val;
  j += num.len;
  const u = t[j] && t[j].kind === 'w' ? TIME_UNIT[t[j].n] : null;
  if (!u) return null;
  j++;
  let extra = 0;
  if (u === 'h' && is(t, j, 'e') && is(t, j + 1, 'meia')) {
    extra = 30;
    j += 2;
  }
  if (u === 'min') return { kind: 'rel', len: j - i, minutes: val };
  if (u === 'h') return { kind: 'rel', len: j - i, minutes: val * 60 + extra };
  const today = toISO(now);
  if (u === 'd') return { kind: 'date', len: j - i, date: addDays(today, val) };
  if (u === 'w') return { kind: 'date', len: j - i, date: addDays(today, val * 7) };
  return { kind: 'date', len: j - i, date: addMonths(today, val) };
}

function mDate(t, i, now) {
  const today = toISO(now);
  const a = t[i];
  if (seq(t, i, ['depois', 'de', 'amanha'])) return { kind: 'date', len: 3, date: addDays(today, 2) };
  if (is(t, i, 'amanha')) return { kind: 'date', len: 1, date: addDays(today, 1) };
  if (is(t, i, 'hoje')) return { kind: 'date', len: 1, date: today, today: true };
  if (is(t, i, 'ontem')) return { kind: 'date', len: 1, date: addDays(today, -1) };
  if (is(t, i, 'anteontem')) return { kind: 'date', len: 1, date: addDays(today, -2) };
  if (seq(t, i, ['semana', 'que', 'vem'])) return { kind: 'date', len: 3, date: addDays(today, 7) };
  if (seq(t, i, ['proxima', 'semana'])) return { kind: 'date', len: 2, date: addDays(today, 7) };
  if (seq(t, i, ['mes', 'que', 'vem'])) return { kind: 'date', len: 3, date: addMonths(today, 1) };
  if (seq(t, i, ['proximo', 'mes'])) return { kind: 'date', len: 2, date: addMonths(today, 1) };
  if ((is(t, i, 'fim', 'final') && is(t, i + 1, 'de') && is(t, i + 2, 'semana')) || is(t, i, 'fds')) return { kind: 'date', len: is(t, i, 'fds') ? 1 : 3, date: nextWeekday(now, 6, false) };
  if (is(t, i, 'fim', 'final') && is(t, i + 1, 'do') && is(t, i + 2, 'mes')) {
    return { kind: 'date', len: 3, date: toISO(new Date(now.getFullYear(), now.getMonth(), daysInMonth(now.getFullYear(), now.getMonth()))) };
  }
  if (a.kind === 'date') {
    const date = dayOfMonth(now, a.d, a.mo, a.y);
    return date && a.mo <= 12 ? { kind: 'date', len: 1, date, explicit: true } : null;
  }
  // "dia 20", "dia 2 de dezembro", "20 de novembro", "dia primeiro"
  let j = i;
  const hasDia = is(t, j, 'dia');
  if (hasDia) j++;
  let day = null;
  let nlen = 0;
  if (hasDia && is(t, j, 'primeiro')) {
    day = 1;
    nlen = 1;
  } else {
    const num = t[j] && t[j].kind === 'num' ? readNum(t, j) : hasDia ? readNum(t, j, true) : null;
    if (num && Number.isInteger(num.val) && num.val >= 1 && num.val <= 31 && !(num.digits && num.len > 1)) {
      day = num.val;
      nlen = num.len;
    }
  }
  if (day) {
    let k = j + nlen;
    let month = null;
    let year = null;
    if (is(t, k, 'de', 'do') && t[k + 1] && (MONTH_FULL.has(t[k + 1].n) || (hasDia && MONTH[t[k + 1].n] && t[k + 1].kind === 'w'))) {
      month = MONTH[t[k + 1].n];
      k += 2;
      if (is(t, k, 'de') && t[k + 1] && t[k + 1].kind === 'num' && t[k + 1].val >= 2000 && t[k + 1].val < 2100) {
        year = t[k + 1].val;
        k += 2;
      }
    }
    if (hasDia || month) {
      // "dia 5" seguido de dinheiro ou hora continua sendo dia
      const date = dayOfMonth(now, day, month, year);
      if (date) return { kind: 'date', len: k - i, date, explicit: !!month, dom: month ? null : day };
    }
  }
  // dia da semana: "sexta", "sexta que vem", "segunda e quarta"
  const list = weekdayList(t, i);
  if (list) {
    let len = list.len;
    let date = nextWeekday(now, list.days[0], false);
    if (seq(t, i + len, ['que', 'vem'])) {
      len += 2;
      const nextMonday = nextWeekday(now, 1, true);
      if (date < nextMonday) date = addDays(date, 7);
    } else if (seq(t, i + len, ['agora'])) len += 1;
    else if (date === today && is(t, i - 1, 'proxima', 'proximo')) date = addDays(date, 7);
    return { kind: 'date', len, date, days: list.days, weekday: true, plural: /s$/.test(t[i].n) };
  }
  return null;
}

function mRecurrence(t, i, now) {
  let j = i;
  // "de segunda a sexta"
  if (is(t, j, 'de') && weekdayAt(t, j + 1) !== null) {
    let k = j + 2;
    if (is(t, k, 'feira')) k++;
    if (is(t, k, 'a', 'ate') && weekdayAt(t, k + 1) !== null) {
      const from = weekdayAt(t, j + 1);
      const to = weekdayAt(t, k + 1);
      const days = [];
      for (let d = from; ; d = (d + 1) % 7) {
        days.push(d);
        if (d === to || days.length > 7) break;
      }
      k += 2;
      if (is(t, k, 'feira')) k++;
      return { kind: 'rec', len: k - i, repeat: { freq: 'weekly', days } };
    }
  }
  if (is(t, j, 'diariamente')) return { kind: 'rec', len: 1, repeat: { freq: 'daily' } };
  if (is(t, j, 'semanalmente')) return { kind: 'rec', len: 1, repeat: { freq: 'weekly' } };
  if (is(t, j, 'mensalmente')) return { kind: 'rec', len: 1, repeat: { freq: 'monthly' } };
  // "de 2 em 2 horas", "a cada 4 horas"
  if (is(t, j, 'de')) {
    const a = readNum(t, j + 1, true);
    if (a && is(t, j + 1 + a.len, 'em')) {
      const b = readNum(t, j + 2 + a.len, true);
      const u = b && t[j + 2 + a.len + b.len];
      if (b && u && TIME_UNIT[u.n]) return everyN(a.val, TIME_UNIT[u.n], j + 3 + a.len + b.len - i);
    }
  }
  if (seq(t, j, ['a', 'cada'])) {
    const a = readNum(t, j + 2, true);
    const u = a && t[j + 2 + a.len];
    if (a && u && TIME_UNIT[u.n]) return everyN(a.val, TIME_UNIT[u.n], 3 + a.len);
    if (u === undefined && !a && t[j + 2] && TIME_UNIT[t[j + 2].n]) return everyN(1, TIME_UNIT[t[j + 2].n], 3);
  }
  if (seq(t, j, ['por', 'mes']) || seq(t, j, ['ao', 'mes'])) return { kind: 'rec', len: 2, repeat: { freq: 'monthly' } };
  // "todo ...", "toda ...", "todos os ...", "todas as ..."
  if (!is(t, j, 'todo', 'toda', 'todos', 'todas')) return null;
  j++;
  if (is(t, j, 'os', 'as', 'o', 'a')) j++;
  if (is(t, j, 'santo')) j++;
  if (is(t, j, 'dia', 'dias')) {
    const num = t[j + 1] && t[j + 1].kind === 'num' ? t[j + 1] : null;
    if (num && Number.isInteger(num.val) && num.val >= 1 && num.val <= 31 && !MONEY_WORD.has((t[j + 2] || {}).n)) {
      let k = j + 2;
      if (seq(t, k, ['do', 'mes']) || seq(t, k, ['de', 'cada'])) k += 2 + (is(t, k + 2, 'mes') ? 1 : 0);
      return { kind: 'rec', len: k - i, repeat: { freq: 'monthly', day: num.val } };
    }
    let k = j + 1;
    if (is(t, k, 'util', 'uteis')) return { kind: 'rec', len: k + 1 - i, repeat: { freq: 'weekly', days: [1, 2, 3, 4, 5] } };
    return { kind: 'rec', len: k - i, repeat: { freq: 'daily' } };
  }
  if (is(t, j, 'semana', 'semanas')) return { kind: 'rec', len: j + 1 - i, repeat: { freq: 'weekly' } };
  if (is(t, j, 'mes', 'meses')) {
    let k = j + 1;
    let day;
    if (is(t, k, 'no')) k++;
    if (is(t, k, 'dia') && t[k + 1] && t[k + 1].kind === 'num' && t[k + 1].val <= 31) {
      day = t[k + 1].val;
      k += 2;
    } else k = j + 1;
    return { kind: 'rec', len: k - i, repeat: day ? { freq: 'monthly', day } : { freq: 'monthly' } };
  }
  if (t[j] && t[j].kind === 'w' && PERIOD[t[j].n]) return { kind: 'rec', len: j + 1 - i, repeat: { freq: 'daily' }, period: PERIOD[t[j].n] };
  const list = weekdayList(t, j);
  if (list) return { kind: 'rec', len: j + list.len - i, repeat: { freq: 'weekly', days: list.days } };
  return null;
}
function everyN(n, unit, len) {
  if (unit === 'h') return { kind: 'rec', len, repeat: { freq: 'hours', every: n } };
  if (unit === 'd') return { kind: 'rec', len, repeat: n === 1 ? { freq: 'daily' } : { freq: 'daily', interval: n } };
  if (unit === 'w') return { kind: 'rec', len, repeat: { freq: 'weekly', interval: n } };
  if (unit === 'mo') return { kind: 'rec', len, repeat: { freq: 'monthly', interval: n } };
  return null;
}

// duração: "tenho 10 minutos para", "por 30 minutos", "durante 1 hora"
function mDuration(t, i) {
  let j = i;
  let lead = null;
  if (is(t, j, 'tenho', 'tem', 'temos')) {
    lead = 'tenho';
    j++;
    if (is(t, j, 'so', 'uns', 'umas', 'apenas')) j++;
  } else if (is(t, j, 'por', 'durante')) {
    lead = 'por';
    j++;
    if (is(t, j, 'uns', 'umas')) j++;
  } else return null;
  let minutes;
  if (is(t, j, 'meia') && is(t, j + 1, 'hora')) {
    minutes = 30;
    j += 2;
  } else {
    const num = readNum(t, j, true);
    const u = num && t[j + num.len] && TIME_UNIT[t[j + num.len].n];
    if (!num || (u !== 'min' && u !== 'h')) return null;
    minutes = u === 'h' ? num.val * 60 : num.val;
    j += num.len + 1;
    if (u === 'h' && is(t, j, 'e') && is(t, j + 1, 'meia')) {
      minutes += 30;
      j += 2;
    }
  }
  if (lead === 'tenho') {
    if (!is(t, j, 'para', 'pra')) return null;
    j++;
  }
  return { kind: 'dur', len: j - i, minutes };
}

// "me lembra 4 dias antes", "avisar 2 horas antes", "3 dias antes"
function mRemind(t, i) {
  let j = i;
  if (is(t, j, 'e')) j++;
  if (is(t, j, 'me')) j++;
  let verb = false;
  if (t[j] && /^(lembr|avis)(a|e|ar|ando)$/.test(t[j].n)) {
    verb = true;
    j++;
    if (is(t, j, 'me')) j++;
    if (is(t, j, 'com', 'uns', 'umas')) j++;
  }
  const num = readNum(t, j, true);
  if (!num) return null;
  const u = t[j + num.len] && TIME_UNIT[t[j + num.len].n];
  if (!u || !is(t, j + num.len + 1, 'antes')) return null;
  if (!verb && j !== i) return null;
  const minutes = u === 'min' ? num.val : u === 'h' ? num.val * 60 : u === 'd' ? num.val * 1440 : u === 'w' ? num.val * 10080 : null;
  if (minutes === null) return null;
  return { kind: 'remind', len: j + num.len + 2 - i, minutes };
}

function mMoney(t, i) {
  let j = i;
  if (t[j].kind === 'cur') {
    const num = readNum(t, j + 1);
    if (!num) return null;
    return { kind: 'money', len: 1 + num.len, amount: num.val };
  }
  const num = readNum(t, j);
  if (!num) return null;
  // "18,90" já é dinheiro, mesmo sem dizer "reais"
  if (num.len === 1 && /,\d{2}$/.test(t[j].n) && !MONEY_WORD.has((t[j + 1] || {}).n)) return { kind: 'money', len: 1, amount: num.val };
  j += num.len;
  let amount = num.val;
  // "60 e 50 reais" = 60,50
  if (!num.dec && is(t, j, 'e') && t[j + 1] && t[j + 1].kind === 'num' && Number.isInteger(t[j + 1].val) && t[j + 1].val < 100 && t[j + 2] && MONEY_WORD.has(t[j + 2].n)) {
    return { kind: 'money', len: j + 3 - i, amount: amount + t[j + 1].val / 100 };
  }
  if (!t[j] || !MONEY_WORD.has(t[j].n)) return null;
  j++;
  // "60 reais e 50 (centavos)"
  if (is(t, j, 'e') && t[j + 1] && t[j + 1].kind === 'num' && Number.isInteger(t[j + 1].val) && t[j + 1].val < 100 && (is(t, j + 2, 'centavos') || !t[j + 2] || t[j + 2].kind === 'p')) {
    amount += t[j + 1].val / 100;
    j += 2;
    if (is(t, j, 'centavos')) j++;
  }
  return { kind: 'money', len: j - i, amount };
}

const PREFIX = {
  date: new Set(['as', 'aos', 'nas', 'nos', 'na', 'no', 'nessa', 'nesta', 'neste', 'nesse', 'essa', 'esse', 'esta', 'este', 'em', 'para', 'pra', 'pro', 'ate', 'la', 'ja', 'proxima', 'proximo', 'desde']),
  time: new Set(['para', 'pra', 'ate', 'la']),
  money: new Set(['de', 'por', 'valor', 'custou', 'custa', 'deu', 'sao', 'uns', 'no']),
  rel: new Set(['para', 'pra', 'la']),
  dur: new Set(['eu']),
  part: new Set(),
  rec: new Set(),
  remind: new Set(['e', 'para', 'pra']),
};
const ARTICLE_AFTER_PREP = new Set(['o', 'a', 'os', 'as']);

// Devolve as marcações (spans) achadas na frase, sem sobreposição.
export function tag(t, now, protect = []) {
  const spans = [];
  const taken = new Array(t.length).fill(false);
  protect.forEach((p) => {
    for (let k = p.s; k < p.e; k++) taken[k] = true;
  });
  const matchers = [mRemind, mDuration, mRecurrence, mRelative, mTimeRange, mMoney, mDate, mTime, mPartOfDay];
  let i = 0;
  while (i < t.length) {
    if (taken[i] || t[i].kind === 'p') {
      i++;
      continue;
    }
    let found = null;
    for (const m of matchers) {
      const r = m(t, i, now);
      if (r && r.len > 0) {
        let free = true;
        for (let k = i; k < i + r.len; k++) if (taken[k]) free = false;
        if (free) {
          found = r;
          break;
        }
      }
    }
    if (!found) {
      i++;
      continue;
    }
    const span = { ...found, s: i, e: i + found.len };
    // leva junto a preposição que só existia por causa da marcação ("na sexta", "para amanhã", "de R$ 60")
    const pre = PREFIX[span.kind] || PREFIX.date;
    let s = span.s;
    if (s > 0 && !taken[s - 1] && ARTICLE_AFTER_PREP.has(t[s - 1].n) && s > 1 && !taken[s - 2] && ['para', 'pra', 'ate'].includes(t[s - 2].n) && span.kind === 'date') s -= 1;
    while (s > 0 && !taken[s - 1] && t[s - 1].kind === 'w' && pre.has(t[s - 1].n)) s--;
    if (span.kind === 'money' && s === span.s && s > 0 && !taken[s - 1] && is(t, s - 1, 'de')) s--;
    span.s = s;
    for (let k = span.s; k < span.e; k++) taken[k] = true;
    spans.push(span);
    i = span.e;
  }
  return spans;
}

// ───────────────────────── 3. pedaços ─────────────────────────

const NOT_VERB = new Set(['celular', 'lugar', 'mulher', 'lar', 'bar', 'mar', 'ar', 'par', 'familiar', 'particular', 'popular', 'dolar', 'lazer', 'prazer', 'colher', 'qualquer', 'talher', 'ser', 'militar', 'escolar', 'jantar', 'almocar', 'vestibular', 'exemplar', 'auxiliar', 'titular', 'polegar', 'hangar', 'radar', 'bazar', 'cesar', 'guilhermer', 'walter', 'peter', 'junior', 'quer', 'souber', 'tiver', 'der', 'puder', 'chofer', 'suporter', 'poster', 'master', 'folder', 'cheddar', 'acucar', 'colar', 'solar', 'luar', 'pomar', 'altar', 'andar', 'hamburguer', 'notebook', 'elixir', 'emir', 'faquir', 'vizir', 'souvenir', 'computer', 'uber', 'cooler', 'trailer', 'lider', 'poder', 'dever', 'haver', 'ter', 'mister', 'cancer', 'carater', 'eter', 'cadaver', 'revolver', 'reporter', 'esfincter', 'nectar', 'ambar', 'joker', 'poker', 'sair', 'ir']);
const MEAL_VERB = new Set(['jantar', 'almocar', 'sair', 'ir', 'ler', 'ver', 'dar']);
const PAST_MONEY = new Set(['paguei', 'gastei', 'comprei', 'recebi', 'ganhei', 'mandei', 'enviei', 'transferi', 'depositei', 'fiz', 'torrei', 'pagamos', 'emprestei', 'devolvi', 'vendi', 'saquei']);
const PAST_OTHER = new Set(['tirei', 'faltei']);
const BINDERS = new Set(['para', 'pra', 'de', 'a', 'vou', 'vai', 'vamos', 'preciso', 'precisa', 'precisamos', 'tenho', 'tem', 'temos', 'que', 'quero', 'queria', 'devo', 'deve', 'posso', 'pode', 'nao', 'sem', 'ate', 'ao', 'tentar', 'comecar', 'terminar', 'ir', 'ja', 'e', 'ou', 'eu', 'pro', 'do', 'da', 'no', 'na', 'o', 'um', 'uma', 'meu', 'minha', 'conseguir', 'esquecer', 'lembrar', 'antes', 'depois', 'como', 'onde', 'se', 'so', 'tambem', 'ainda', 'vir', 'voltar', 'deixar', 'mandar', 'fazer']);
const INTENT_NOUN = new Set(['prova', 'trabalho', 'pix', 'boleto', 'conta', 'aluguel', 'seminario', 'lista', 'relatorio', 'reuniao', 'consulta', 'aula', 'fatura', 'dentista', 'medico', 'academia', 'mercado', 'luz', 'agua', 'internet', 'exame', 'entrega', 'apresentacao', 'salario', 'bolsa', 'mensalidade', 'parcela', 'p1', 'p2', 'p3', 'gas', 'condominio']);
const SKIP_AFTER_E = new Set(['disso', 'que', 'o', 'a', 'os', 'as', 'um', 'uma', 'eu', 'meu', 'minha', 'ainda', 'tambem']);
const MUST = new Set(['preciso', 'tenho', 'vou', 'quero', 'devo', 'precisamos', 'temos']);
const CONNECTOR = new Set(['e', 'depois', 'tambem', 'ai', 'mais', 'dai', 'entao']);

const isInfinitive = (w) => w.kind === 'w' && ((/(ar|er|ir)$/.test(w.n) && w.n.length >= 4 && !NOT_VERB.has(w.n)) || MEAL_VERB.has(w.n));
const isAction = (w) => isInfinitive(w) || (w.kind === 'w' && (PAST_MONEY.has(w.n) || PAST_OTHER.has(w.n)));

function split(t, spans) {
  const inSpan = new Array(t.length).fill(null);
  spans.forEach((sp) => {
    for (let k = sp.s; k < sp.e; k++) inSpan[k] = sp;
  });
  const free = (k) => t[k] && !inSpan[k] && t[k].kind !== 'p';
  const endsWithNum = (a, b) => {
    let k = b - 1;
    while (k > a && (inSpan[k] || t[k].kind === 'p')) k--;
    return k > a && t[k].kind === 'num' && !inSpan[k];
  };
  const anyNum = (a, b) => t.slice(a, b).some((w, k) => w.kind === 'num' && !inSpan[a + k]);
  const hasMoneyBetween = (a, b) => spans.some((sp) => sp.kind === 'money' && sp.s >= a && sp.e <= b) || endsWithNum(a, b);
  const nextBoundary = (k) => {
    let j = k;
    while (j < t.length && !(t[j].kind === 'p' && !inSpan[j]) && !(free(j) && t[j].n === 'e')) j++;
    return j;
  };
  const segs = [];
  let start = 0;
  let head = false; // o pedaço atual já tem ação (verbo, palavra-chave ou valor)
  let words = 0;
  const cut = (end, next) => {
    if (end > start) segs.push({ s: start, e: end });
    start = next;
    head = false;
    words = 0;
  };
  for (let i = 0; i < t.length; i++) {
    const w = t[i];
    if (inSpan[i]) {
      if (inSpan[i].kind === 'money') head = true;
      continue;
    }
    if (w.kind === 'p') {
      if (w.n !== ',') {
        cut(i, i + 1);
        continue;
      }
      // vírgula: separa se o que vem depois se sustenta sozinho
      let k = i + 1;
      while (free(k) && CONNECTOR.has(t[k].n)) k++;
      const nx = t[k];
      const standalone = nx && !inSpan[k] && (isAction(nx) || INTENT_NOUN.has(nx.n));
      const moneyList = (hasMoneyBetween(start, i) || anyNum(start, i)) && hasMoneyBetween(i + 1, nextBoundary(i + 1));
      if ((standalone && head) || moneyList) cut(i, i + 1);
      continue;
    }
    if (CONNECTOR.has(w.n) && words > 0) {
      let k = i + 1;
      while (free(k) && CONNECTOR.has(t[k].n)) k++;
      let a = k;
      while (free(a) && SKIP_AFTER_E.has(t[a].n)) a++;
      const nx = t[a];
      const standalone = nx && !inSpan[a] && (isAction(nx) || INTENT_NOUN.has(nx.n) || (a > k && MUST.has(t[a - 1].n)) || MUST.has(nx.n));
      const moneyList = (hasMoneyBetween(start, i) || anyNum(start, i)) && hasMoneyBetween(i + 1, nextBoundary(i + 1));
      if (head && (standalone || moneyList)) {
        cut(i, k);
        i = k - 1;
        continue;
      }
    }
    if (isAction(w)) {
      const prev = t[i - 1];
      const bound = prev && !inSpan[i - 1] && prev.kind === 'w' && BINDERS.has(prev.n);
      if (head && words >= 2 && !bound) {
        cut(i, i);
      }
      head = true;
    } else if (INTENT_NOUN.has(w.n)) head = true;
    words++;
  }
  cut(t.length, t.length);
  return segs;
}

// ───────────────────────── 4. itens ─────────────────────────

const STUDY_EXAM = new Set(['prova', 'provas', 'p1', 'p2', 'p3', 'p4', 'exame', 'quiz', 'seminario', 'apresentacao', 'avaliacao', 'substitutiva', 'sub', 'recuperacao', 'simulado', 'vestibular', 'enem', 'defesa', 'banca']);
const STUDY_DELIVERY = new Set(['trabalho', 'lista', 'relatorio', 'entrega', 'entregar', 'projeto', 'tcc', 'artigo', 'resenha', 'fichamento', 'exercicios', 'atividade', 'apd', 'aps']);
const STUDY_SESSION = new Set(['estudar', 'revisar', 'revisao', 'aula', 'monitoria', 'capitulo', 'resumo', 'resumir', 'ler']);
const STUDY_CONTEXT = new Set(['faculdade', 'facul', 'professor', 'professora', 'prof', 'materia', 'disciplina', 'aula', 'semestre', 'universidade', 'escola', 'curso']);
const WEAK_STUDY = new Set(['trabalho', 'relatorio', 'entrega', 'entregar', 'projeto', 'apresentacao', 'lista', 'ler', 'atividade', 'artigo', 'resumo', 'resumir', 'exame', 'defesa', 'banca', 'sub']);

const MONEY_VERB_OUT = new Set(['pagar', 'paguei', 'gastar', 'gastei', 'comprei', 'torrei', 'pagamos', 'emprestei']);
const MONEY_VERB_SEND = new Set(['transferir', 'transferi', 'depositar', 'depositei', 'mandar', 'mandei', 'enviar', 'enviei', 'fazer', 'fiz', 'devolver', 'devolvi']);
const MONEY_VERB_IN = new Set(['receber', 'recebi', 'ganhei', 'ganhar', 'caiu', 'entrou', 'vendi', 'cobrar']);
const MONEY_NOUN = new Set(['pix', 'boleto', 'fatura', 'aluguel', 'mensalidade', 'parcela', 'prestacao', 'divida', 'emprestimo', 'condominio', 'iptu', 'ipva', 'anuidade', 'assinatura', 'multa', 'taxa']);
const MONEY_NOUN_IN = new Set(['salario', 'bolsa', 'mesada', 'pagamento', 'reembolso', 'freela', 'freelance', 'comissao', 'estagio', 'decimo', 'ferias', 'vale']);
const BILL_NOUN = new Set(['luz', 'agua', 'internet', 'gas', 'telefone', 'celular', 'energia', 'netflix', 'spotify', 'cartao', 'academia', 'plano']);

export const CATEGORIES_OUT = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Estudos', 'Lazer', 'Compras', 'Outros'];
export const CATEGORIES_IN = ['Salário', 'Bolsa', 'Extra'];
const CATEGORY_WORDS = {
  Alimentação: ['mercado', 'supermercado', 'ifood', 'lanche', 'almoco', 'janta', 'jantar', 'pizza', 'restaurante', 'padaria', 'cafe', 'pao', 'comida', 'acai', 'hamburguer', 'marmita', 'feira', 'acougue', 'bandejao', 'ru', 'cantina', 'salgado', 'sorvete', 'cerveja', 'lanchonete', 'delivery', 'rappi', 'burger'],
  Transporte: ['uber', '99', 'onibus', 'gasolina', 'combustivel', 'passagem', 'metro', 'estacionamento', 'pedagio', 'taxi', 'bilhete', 'mecanico', 'oficina', 'ipva', 'etanol', 'posto', 'corrida'],
  Moradia: ['aluguel', 'luz', 'agua', 'internet', 'condominio', 'gas', 'energia', 'iptu', 'republica', 'telefone', 'celular', 'faxina', 'diarista'],
  Saúde: ['farmacia', 'remedio', 'medico', 'dentista', 'academia', 'consulta', 'exame', 'psicologo', 'terapia', 'plano', 'hospital'],
  Estudos: ['livro', 'xerox', 'mensalidade', 'curso', 'apostila', 'material', 'caderno', 'impressao', 'faculdade', 'matricula', 'inscricao', 'calculadora'],
  Lazer: ['cinema', 'bar', 'festa', 'jogo', 'netflix', 'spotify', 'show', 'role', 'balada', 'ingresso', 'viagem', 'steam', 'churrasco', 'streaming', 'assinatura'],
  Compras: ['roupa', 'tenis', 'shopping', 'presente', 'sapato', 'camisa', 'fone', 'carregador', 'mochila', 'amazon', 'shopee', 'mercadolivre'],
};
const CATEGORY_OF = {};
Object.entries(CATEGORY_WORDS).forEach(([c, ws]) => ws.forEach((w) => (CATEGORY_OF[w] = c)));

const LEAD_FILLER = /^(?:(?:por favor|oi|ola|ok|ei|entao|bom|bem|ah|e|ai|dai|tambem|depois|disso|em seguida|mais|ainda|eu(?= \S+(?:ar|er|ir) )|hoje|agora)\s+)+/;
const OBLIGATION = new RegExp(
  '^(?:eu\\s+|a gente\\s+|nos\\s+)?(?:' +
    [
      '(?:nao\\s+)?(?:posso\\s+|pode\\s+|podemos\\s+)?(?:me\\s+)?esquecer\\s+(?:de\\s+|que\\s+|da\\s+|do\\s+)?',
      '(?:me\\s+)?(?:lembr[ae]r?|lembrete|avis[ae]r?)(?:\\s+me)?\\s+(?:de\\s+|que\\s+|para\\s+|pra\\s+|da\\s+|do\\s+)?',
      '(?:preciso|precisa|precisamos)\\s+(?:de\\s+(?=\\S+(?:ar|er|ir)\\b))?',
      '(?:tenho|tem|temos)\\s+(?:que|de)\\s+',
      'vou\\s+ter\\s+(?:que|de)\\s+',
      '(?:vou|vamos|devo|quero|queria|gostaria de)\\s+(?=\\S+(?:ar|er|ir)\\b)',
      '(?:tenho|tem|temos|vai ter|vou ter)\\s+(?:um\\s+|uma\\s+|o\\s+|a\\s+)?',
      '(?:anot[ae]r?|adicion[ae]r?|coloc[ae]r?|bot[ae]r?|cri[ae]r?)\\s+(?:ai\\s+)?(?:(?:um\\s+|uma\\s+)?(?:lembrete|tarefa|compromisso)\\s+)?(?:que\\s+|para\\s+|pra\\s+|de\\s+)?(?=\\S)',
    ].join('|') +
    ')'
);
const CONTEXT_START = new Set(['quando', 'assim', 'logo', 'depois', 'antes', 'na', 'ao', 'apos']);
const TRAILING = new Set(['de', 'da', 'do', 'na', 'no', 'em', 'para', 'pra', 'pro', 'e', 'a', 'o', 'as', 'os', 'com', 'por', 'ate', 'que', 'la', 'dia', 'mas', 'ai', 'ne', 'tambem', 'depois', 'umas', 'um', 'uma', 'ja', 'so', 'isso']);

// acha a matéria citada: nome ou apelido inteiros, sem acento, "2" = "dois" = "ii"
const NUMERAL = { dois: '2', duas: '2', ii: '2', um: '1', uma: '1', i: '1', tres: '3', iii: '3', quatro: '4', iv: '4' };
const subjWords = (name) => tokenize(name).filter((w) => w.kind !== 'p').map((w) => NUMERAL[w.n] || w.n);
export function findSubject(t, s, e, subjects) {
  let best = null;
  (subjects || []).forEach((sub) => {
    if (sub.archived) return;
    [sub.name, ...(sub.aliases || [])].filter(Boolean).forEach((name) => {
      const ws = subjWords(name);
      if (!ws.length) return;
      for (let i = s; i <= e - ws.length; i++) {
        if (ws.every((w, k) => (NUMERAL[t[i + k].n] || t[i + k].n) === w)) {
          if (!best || ws.length > best.len) best = { id: sub.id, name: sub.name, s: i, e: i + ws.length, len: ws.length };
        }
      }
    });
  });
  if (best) return best;
  // uma palavra só do nome, se apenas uma matéria tiver essa palavra
  const hits = [];
  (subjects || []).forEach((sub) => {
    if (sub.archived) return;
    const ws = subjWords(sub.name).filter((w) => w.length > 3);
    for (let i = s; i < e; i++) {
      if (t[i].kind === 'w' && ws.includes(t[i].n) && !(t[i + 1] && t[i + 1].kind === 'num' && i + 1 < e)) hits.push({ id: sub.id, name: sub.name, s: i, e: i + 1, len: 1 });
    }
  });
  const ids = [...new Set(hits.map((h) => h.id))];
  return ids.length === 1 ? hits[0] : null;
}

function categoryFor(words, flow) {
  if (flow === 'in') {
    if (words.some((w) => ['salario', 'pagamento', 'estagio', 'decimo', 'ferias'].includes(w))) return 'Salário';
    if (words.some((w) => ['bolsa', 'mesada', 'auxilio'].includes(w))) return 'Bolsa';
    return 'Extra';
  }
  for (const w of words) if (CATEGORY_OF[w]) return CATEGORY_OF[w];
  return 'Outros';
}

function pmGuess(h, sure) {
  // sem "da manhã/tarde": 1 a 6 é quase sempre de tarde
  return !sure && h >= 1 && h <= 6 ? h + 12 : h;
}

function buildItem(t, seg, spans, ctx) {
  const { now, subjects } = ctx;
  const today = toISO(now);
  const mine = spans.filter((sp) => sp.s >= seg.s && sp.e <= seg.e);
  const inSpan = new Array(t.length).fill(false);
  mine.forEach((sp) => {
    for (let k = sp.s; k < sp.e; k++) inSpan[k] = true;
  });
  const words = [];
  for (let k = seg.s; k < seg.e; k++) if (!inSpan[k] && t[k].kind !== 'p') words.push(t[k]);
  const ns = words.map((w) => w.n);
  const allNs = ns.join(' ');
  const has = (set) => ns.some((n) => set.has(n));
  const subject = findSubject(t, seg.s, seg.e, subjects);

  // ── o que foi marcado ──
  const item = { type: 'task', title: '', date: null, time: null, endTime: null, repeat: null, remind: null };
  let period = null;
  let timeSure = true;
  mine.forEach((sp) => {
    if (sp.kind === 'date' && !item.date) {
      item.date = sp.date;
      item.dated = true;
      item._dom = sp.dom || null;
      item._weekday = !!sp.weekday;
      if (sp.days && sp.days.length > 1) item._days = sp.days;
    } else if (sp.kind === 'time' && !item.time) {
      item.time = hhmm(sp.h, sp.mi);
      item._h = sp.h;
      timeSure = sp.sure;
      if (sp.h2 !== undefined) item.endTime = hhmm(sp.h2, sp.mi2);
    } else if (sp.kind === 'part' && !period) period = sp.period;
    else if (sp.kind === 'rel') {
      const d = new Date(now.getTime() + sp.minutes * 60000);
      item.date = toISO(d);
      item.time = hhmm(d.getHours(), d.getMinutes());
      item._rel = sp.minutes;
      timeSure = true;
    } else if (sp.kind === 'dur' && !item.duration) item.duration = sp.minutes;
    else if (sp.kind === 'rec' && !item.repeat) {
      item.repeat = { ...sp.repeat };
      if (sp.period) period = period || sp.period;
    } else if (sp.kind === 'remind' && item.remind === null) item.remind = sp.minutes;
    else if (sp.kind === 'money' && item.amount === undefined) item.amount = sp.amount;
  });
  if (item.time && period && item._h !== undefined && !timeSure) {
    item.time = hhmm(resolveHour(item._h, period), Number(item.time.slice(3)));
    timeSure = true;
  }
  if (!item.time && period) item.time = PERIOD_TIME[period];
  const unsure = !!item.time && !timeSure && item._h !== undefined;
  if (unsure) {
    const h = pmGuess(item._h, false);
    item.time = hhmm(h, Number(item.time.slice(3)));
    if (item.endTime && Number(item.endTime.slice(0, 2)) <= h) item.endTime = hhmm((Number(item.endTime.slice(0, 2)) + 12) % 24, Number(item.endTime.slice(3)));
  }

  // ── tipo ──
  const first = ns[0];
  const pastMoney = ns.some((n) => PAST_MONEY.has(n) || n === 'caiu' || n === 'entrou');
  const moneyCue = has(MONEY_VERB_OUT) || has(MONEY_VERB_IN) || has(MONEY_NOUN) || has(MONEY_NOUN_IN) || ns.some((n) => PAST_MONEY.has(n)) || (has(BILL_NOUN) && (ns.includes('conta') || ns.includes('fatura') || item.amount !== undefined));
  // valor dito sem "reais": o último número solto, quando a frase é de dinheiro
  const lastWord = words[words.length - 1];
  const looseMoney = lastWord && lastWord.kind === 'num' && words.length >= 2 && words.length <= 4 && ns.some((n) => CATEGORY_OF[n]) && !ns.some((n) => STUDY_EXAM.has(n) || n === 'comprar');
  const centsMoney = words.some((w) => w.kind === 'num' && /,\d{2}$/.test(w.n));
  if (item.amount === undefined && (moneyCue || ns.includes('conta') || looseMoney || centsMoney || ctx.moneyList)) {
    for (let k = seg.e - 1; k >= seg.s; k--) {
      const w = t[k];
      if (inSpan[k] || w.kind !== 'num' || w.val <= 0) continue;
      if (centsMoney && !moneyCue && !/,\d{2}$/.test(w.n)) continue;
      if (subject && k >= subject.s && k < subject.e) continue;
      const prev = t[k - 1];
      const next = t[k + 1];
      if (prev && prev.kind === 'w' && ['capitulo', 'cap', 'pagina', 'paginas', 'calc', 'calculo', 'fisica', 'quimica', 'unidade', 'aula', 'lista', 'numero', 'sala', 'bloco', 'dia'].includes(prev.n)) continue;
      if (next && next.kind === 'w' && k + 1 < seg.e && !inSpan[k + 1] && (TIME_UNIT[next.n] || ['vezes', 'x', 'paginas', 'capitulos', 'kg', 'km', 'litros', 'unidades', 'pessoas'].includes(next.n))) continue;
      item.amount = w.val;
      inSpan[k] = true;
      const idx = words.indexOf(w);
      if (idx >= 0) {
        words.splice(idx, 1);
        ns.splice(idx, 1);
      }
      // "de" que sobrou antes do valor ("pix do Bruno de 60")
      if (idx > 0 && idx === words.length && ['de', 'por'].includes(ns[idx - 1])) {
        words.pop();
        ns.pop();
      }
      break;
    }
  }
  const buying = ns.some((n) => ['comprar', 'comprei', 'compra'].includes(n));
  const strongStudy = ns.some((n) => (STUDY_EXAM.has(n) || STUDY_DELIVERY.has(n) || STUDY_SESSION.has(n)) && !WEAK_STUDY.has(n));
  const weakStudy = ns.some((n) => WEAK_STUDY.has(n));
  const studyCue = strongStudy || ((weakStudy || has(STUDY_CONTEXT)) && (!!subject || has(STUDY_CONTEXT))) || (!!subject && !buying);
  const workContext = ns.some((n, k) => ['trabalho', 'servico', 'estagio', 'empresa', 'chefe', 'cliente'].includes(n) && ['do', 'no', 'pro', 'da', 'na'].includes(ns[k - 1]) && k > 0);

  if (item.amount !== undefined && (moneyCue || !studyCue)) item.type = 'money';
  else if (moneyCue && !studyCue && (has(MONEY_NOUN) || first === 'pagar' || first === 'receber' || pastMoney) && !PAST_OTHER.has(first)) item.type = 'money';
  else if (studyCue && !(workContext && !strongStudy && !subject)) item.type = 'study';

  // ── título ──
  let list = words.slice();
  let joined = () => list.map((w) => w.n).join(' ') + ' ';
  const drop = (re) => {
    const m = joined().match(re);
    if (!m || !m[0].trim()) return false;
    const count = m[0].trim().split(/\s+/).length;
    if (count >= list.length) return false;
    list = list.slice(count);
    return true;
  };
  drop(LEAD_FILLER);
  // contexto no começo: "quando eu chegar em casa ...", "chegando em casa ...", "depois da aula ..."
  const firstN = list[0] ? list[0].n : '';
  const gerund = /ndo$/.test(firstN) && firstN.length > 5;
  if ((CONTEXT_START.has(firstN) && ['quando', 'assim', 'logo'].includes(firstN)) || gerund) {
    let cutAt = -1;
    for (let k = 1; k < list.length; k++) {
      const n = list[k].n;
      const rest = list.slice(k).map((w) => w.n).join(' ') + ' ';
      if (OBLIGATION.test(rest) && !/^(?:tenho|tem|temos)\s+(?!que|de)/.test(rest) ) {
        cutAt = k;
        break;
      }
      if (/^(eu )?(tenho|tem) /.test(rest)) {
        cutAt = k;
        break;
      }
      const skipVerb = !gerund && k <= 3 && ['quando', 'que', 'eu', 'a', 'gente'].includes(list[k - 1].n);
      if ((isAction(list[k]) || INTENT_NOUN.has(n)) && !skipVerb && k >= 2 && !BINDERS.has(list[k - 1].n)) {
        cutAt = k;
        break;
      }
    }
    if (cutAt > 0) list = list.slice(cutAt);
  }
  for (let n = 0; n < 3; n++) if (!drop(OBLIGATION)) break;

  let flow = 'out';
  let paid = false;
  if (item.type === 'money') {
    const all = list.map((w) => w.n);
    const sendVerb = all.find((n) => MONEY_VERB_SEND.has(n));
    if (all.some((n) => MONEY_VERB_IN.has(n)) || (has(MONEY_NOUN_IN) && !all.some((n) => MONEY_VERB_OUT.has(n) || MONEY_VERB_SEND.has(n)))) flow = 'in';
    paid = pastMoney || (flow === 'out' && !item.date && !item.repeat && !sendVerb && !all.some((n) => ['pagar', 'gastar', 'comprar', 'conta', 'boleto', 'fatura', 'aluguel', 'mensalidade', 'parcela'].includes(n)) && !has(BILL_NOUN) && !has(MONEY_NOUN));
    const owesMe = ns.includes('deve') && ns.includes('me');
    if (owesMe) {
      flow = 'in';
      paid = false;
    }
    if (ns.includes('devo')) paid = false;
    const payTo = /^(?:eu\s+)?(?:ja\s+)?(?:vou\s+)?(?:paguei|pagar|devo)\s+(?:pro|pra|para|ao)\s+/.test(joined());
    drop(/^(?:eu\s+)?(?:ja\s+)?(?:vou\s+)?(?:paguei|gastei|comprei|pagar|gastar|recebi|receber|ganhei|ganhar|torrei|caiu|entrou|pagamos|vendi|cobrar|devo)\s+(?:o\s+|a\s+|um\s+|uma\s+|os\s+|as\s+|meu\s+|minha\s+)?/);
    if (drop(/^(?:eu\s+)?(?:ja\s+)?(?:fiz|fazer|mandei|mandar|enviei|enviar|transferi|transferir|depositei|depositar|devolvi|devolver)\s+(?:o\s+|a\s+|um\s+|uma\s+)?/)) {
      if (list[0] && ['pro', 'pra', 'para', 'ao', 'a'].includes(list[0].n)) {
        let k = 1;
        if (list[k] && ['o', 'a'].includes(list[k].n)) k++;
        list = [{ raw: 'Pix', n: 'pix' }, { raw: 'para', n: 'para' }, ...list.slice(k)];
      }
    }
    if (payTo && list[0] && ['pro', 'pra', 'para', 'ao'].includes(list[0].n)) {
      let k = 1;
      if (list[k] && ['o', 'a'].includes(list[k].n)) k++;
      list = [{ raw: 'Pagar', n: 'pagar' }, ...list.slice(k)];
    }
    drop(/^(?:o|a|os|as)\s+/);
    drop(/^(?:de|com|no|na|em|do|da|pelo|pela)\s+/);
  } else {
    drop(/^(?:ir\s+)?(?:no|na|ao|a)\s+(?=dentista|medico|consulta|reuniao)/);
  }
  while (list.length > 1 && TRAILING.has(list[list.length - 1].n)) list.pop();
  while (list.length > 1 && ['e', 'que', 'de', 'ai'].includes(list[0].n)) list.shift();
  let title = list.map((w) => w.raw).join(' ').trim();
  if (/^[A-ZÀ-Ú\s\d]+$/.test(title) && title.length > 4) title = title.toLowerCase();
  title = cap(title);
  item.title = title;

  // ── acabamento por tipo ──
  if (item.type === 'money') {
    item.flow = flow;
    item.paid = paid;
    item.category = categoryFor(ns, flow);
    item.amount = item.amount === undefined ? 0 : Math.round(item.amount * 100) / 100;
    if (!paid && item.date && item.date < today && !item.repeat) paid = true;
    item.paid = paid;
    if (paid) {
      // o que já aconteceu não fica no futuro
      if (item.date && item.date > today) item.date = item._weekday ? addDays(item.date, -7) : item._dom ? addMonths(item.date, -1) : today;
      if (!item.date) item.date = today;
      item.time = null;
      item.endTime = null;
    }
    if (item.repeat && item.repeat.freq === 'monthly' && !item.repeat.day) item.repeat.day = item.date ? fromISO(item.date).getDate() : now.getDate();
  } else {
    delete item.amount;
    if (item.type === 'study') {
      item.studyKind = ns.some((n) => STUDY_EXAM.has(n)) ? 'prova' : ns.some((n) => STUDY_DELIVERY.has(n)) ? 'entrega' : 'estudo';
      if (subject) item.subjectId = subject.id;
    }
  }
  // repetição: completa o que faltou
  if (item.repeat) {
    const r = item.repeat;
    if (r.freq === 'weekly' && !r.days) r.days = [item.date ? fromISO(item.date).getDay() : now.getDay()];
    if (r.freq === 'monthly' && !r.day) r.day = item.date ? fromISO(item.date).getDate() : now.getDate();
    if (!item.date) {
      if (r.freq === 'weekly') {
        const order = r.days.map((d) => nextWeekday(now, d, false)).sort();
        item.date = order[0];
      } else if (r.freq === 'monthly') item.date = dayOfMonth(now, r.day) || today;
      else item.date = today;
    }
  } else if (item._days && item.type !== 'money') {
    item.repeat = { freq: 'weekly', days: item._days };
    item.date = item._days.map((d) => nextWeekday(now, d, false)).sort()[0];
  }
  // só horário, sem dia: é hoje (ou amanhã, se a hora já passou)
  if (item.time && (!item.date || item.date === today) && !item.repeat) {
    const nowT = hhmm(now.getHours(), now.getMinutes());
    const h = Number(item.time.slice(0, 2));
    // "às 10" dito às 14h quer dizer 22h
    if (item.time <= nowT && unsure && h < 12 && hhmm(h + 12, Number(item.time.slice(3))) > nowT) item.time = hhmm(h + 12, Number(item.time.slice(3)));
    if (!item.date) {
      const passed = item.time <= nowT;
      item.date = passed ? addDays(today, 1) : today;
      if (passed) item.guessedDay = true;
    }
  }
  // "tenho 10 minutos para lavar a louça" é para agora
  if (item.duration && !item.date && item.type !== 'money') item.date = today;
  if (/^(?:e )?(?:depois|em seguida|dai|ai)\b/.test(allNs)) item._seq = true;
  delete item._dom;
  delete item._weekday;
  delete item._days;
  delete item._h;
  return { item, words: ns, subject };
}

// ── pedidos que não são itens: nota, falta, horário de aula, pergunta ──

function specialOf(t, seg, spans, ctx, built) {
  const ns = [];
  for (let k = seg.s; k < seg.e; k++) if (t[k].kind !== 'p') ns.push(t[k].n);
  const text = ns.join(' ');
  const { subject, item } = built;
  // "tirei 7,5 na P1 de cálculo", "tirei 8 de 10 no trabalho de física"
  const g = text.match(/^(?:eu\s+)?(?:tirei|fiquei com|peguei|minha nota foi)\s+(\d+(?:[.,]\d+)?)(?:\s+(?:de|em)\s+(\d+(?:[.,]\d+)?))?\s+(?:na|no|em|de)\s+(.+)$/);
  if (g) {
    let name = g[3];
    if (subject) {
      const sw = [];
      for (let k = subject.s; k < subject.e; k++) sw.push(t[k].n);
      name = name.replace(new RegExp(`\\s*(?:de|da|do|em)?\\s*${sw.join('\\s+')}.*$`), '');
    } else name = name.replace(/\s+(?:de|da|do)\s+.+$/, (m) => m); // sem matéria conhecida, guarda o nome inteiro
    const subjName = subject ? subject.name : (g[3].match(/\s(?:de|da|do)\s+(.+)$/) || [])[1] || null;
    if (!subject && subjName) name = g[3].replace(/\s(?:de|da|do)\s+.+$/, '');
    return { type: 'grade', score: parseFloat(g[1].replace(',', '.')), max: g[2] ? parseFloat(g[2].replace(',', '.')) : 10, name: cap(name.trim() || 'Nota').replace(/^P(\d)$/i, 'P$1'), subjectId: subject ? subject.id : null, subjectName: subjName ? cap(subjName) : null };
  }
  // "faltei na aula de física", "faltei hoje", "não fui na aula de cálculo ontem"
  if (/^(?:eu\s+)?(?:faltei|nao fui|perdi a aula|matei aula|matei a aula)/.test(text)) {
    const m = text.match(/(?:aula|materia)\s+(?:de|da|do)\s+(.+?)(?:\s+(?:hoje|ontem|amanha))?$/);
    return { type: 'absence', date: item.date || toISO(ctx.now), subjectId: subject ? subject.id : null, subjectName: subject ? subject.name : m ? cap(m[1]) : null };
  }
  // "aula de cálculo 2 segunda e quarta das 10 às 12", "estágio de segunda a sexta das 13 às 18",
  // "aulas de análise de circuitos às quintas das 21:20 às 23 e sexta das 18:20 às 20:20"
  const fixedWord = /^(?:(?:eu\s+)?(?:tenho|faco)\s+)?(?:minhas?\s+|meus?\s+)?(aulas?|estagio|trabalho|academia|treino|monitoria|curso|ingles|laboratorio|lab)\b/.exec(text);
  if (!fixedWord) return null;
  const mine = spans.filter((sp) => sp.s >= seg.s && sp.e <= seg.e).sort((a, b) => a.s - b.s);
  const dayOf = (sp) => (sp.kind === 'rec' && sp.repeat.freq === 'weekly' && sp.repeat.days ? sp.repeat.days : sp.kind === 'date' && sp.weekday ? sp.days : null);
  const slots = [];
  let routine = /^aulas$/.test(fixedWord[1]);
  mine.forEach((sp, k) => {
    const days = dayOf(sp);
    if (!days) return;
    if (sp.kind === 'rec' || sp.plural || days.length > 1) routine = true;
    const next = mine.slice(k + 1).find((x) => x.kind === 'time' || dayOf(x));
    const time = next && next.kind === 'time' ? next : null;
    if (time) slots.push({ days, start: hhmm(pmGuess(time.h, time.sure || time.h2 !== undefined), time.mi), end: time.h2 !== undefined ? hhmm(time.h2, time.mi2) : null });
  });
  if (mine.filter((sp) => dayOf(sp)).length > 1) routine = true;
  const isClass = /^aula/.test(fixedWord[1]) || !!subject;
  if (!slots.length || !routine || !(isClass || slots.every((sl) => sl.end))) return null;
  slots.forEach((sl) => {
    if (!sl.end) sl.end = hhmm((Number(sl.start.slice(0, 2)) + 2) % 24, Number(sl.start.slice(3)));
  });
  // nome: o que foi dito antes do primeiro dia ou horário
  const firstSpan = mine.find((sp) => dayOf(sp) || sp.kind === 'time');
  let w = [];
  for (let k = seg.s; k < firstSpan.s; k++) if (t[k].kind !== 'p' && !mine.some((sp) => k >= sp.s && k < sp.e)) w.push(t[k]);
  while (w.length && ['eu', 'tenho', 'faco', 'minha', 'minhas', 'meu', 'meus'].includes(w[0].n)) w.shift();
  if (isClass && w.length && /^aulas?$/.test(w[0].n)) w.shift();
  while (w.length && ['de', 'da', 'do'].includes(w[0].n)) w.shift();
  while (w.length > 1 && TRAILING.has(w[w.length - 1].n)) w.pop();
  // a pessoa recomeçou o nome ("circuitos análise de circuitos"): vale a versão completa
  for (let k = 1; k * 2 <= w.length; k++) {
    if (w.slice(0, k).every((x, n) => x.n === w[w.length - k + n].n)) {
      w = w.slice(k);
      break;
    }
  }
  const name = subject ? subject.name : cap(w.map((x) => x.raw).join(' ')) || cap(fixedWord[1]);
  return { type: 'schedule', block: isClass ? 'class' : 'fixed', name, subjectId: subject ? subject.id : null, days: slots[0].days, start: slots[0].start, end: slots[0].end, ...(slots.length > 1 ? { slots } : null) };
}

const QUESTION = /^(?:o que|oque|quais?|quanto|quanta|quantas|quantos|quando (?:e|eh|vai|sera|que|tenho|eu tenho|vence|cai|sai|foi)\b|como (?:ta|esta|estao|anda)|(?:eu )?(?:tenho|tem) (?:alguma|algum|algo)|posso faltar)/;

export function parseQuery(text, ctx) {
  const t = tokenize(text);
  const ns = t.filter((w) => w.kind !== 'p').map((w) => w.n);
  const s = ns.join(' ');
  const asked = /\?\s*$/.test(String(text).trim());
  if (!QUESTION.test(s) && !asked) return null;
  if (!QUESTION.test(s) && !/(tenho|tem|gastei|falta|media|prova|pagar)/.test(s)) return null;
  const now = ctx.now;
  const today = toISO(now);
  const spans = tag(t, now);
  const dateSpan = spans.find((sp) => sp.kind === 'date');
  const subject = findSubject(t, 0, t.length, ctx.subjects);
  let range = null;
  if (/(essa|esta|nessa|nesta|da|na) semana/.test(s)) range = { from: today, to: addDays(today, 6 - ((now.getDay() + 6) % 7)), label: 'esta semana' };
  else if (/semana que vem|proxima semana/.test(s)) {
    const mon = nextWeekday(now, 1, true);
    range = { from: mon, to: addDays(mon, 6), label: 'semana que vem' };
  } else if (/(esse|este|nesse|neste|do|no) mes/.test(s)) range = { month: today.slice(0, 7), label: 'este mês' };
  else if (/mes passado/.test(s)) range = { month: addMonths(today.slice(0, 8) + '01', -1).slice(0, 7), label: 'mês passado' };
  else if (dateSpan) range = { from: dateSpan.date, to: dateSpan.date, label: null };
  const term = (re) => {
    const m = s.match(re);
    if (!m) return null;
    return m[1].replace(/\s*(?:hoje|ontem|amanha|(?:essa|esta|nessa|nesta) semana|(?:esse|este|nesse|neste) mes|mes passado|semana que vem)\s*$/, '').trim() || null;
  };
  if (/^quanto.*(gastei|gasto|saiu|torrei|paguei)/.test(s)) return { q: 'spent', term: term(/(?:gastei|gasto|saiu|torrei|paguei)\s+(?:com|de|no|na|em|o|a)\s+(?:o\s+|a\s+)?(.+)$/), range: range || { month: today.slice(0, 7), label: 'este mês' } };
  if (/^quanto.*(recebi|entrou|ganhei)/.test(s)) return { q: 'received', range: range || { month: today.slice(0, 7), label: 'este mês' } };
  if (/(quanto|o que|que|quais).*(tenho que pagar|a pagar|pra pagar|para pagar|devo|contas)/.test(s)) return { q: 'payable', range };
  if (/(quanto|qual).*(saldo|tenho na conta|tenho no banco|dinheiro eu tenho|tenho de dinheiro)/.test(s)) return { q: 'saldo' };
  if (/(quanto|qual).*(sobr|posso gastar|ainda tenho)/.test(s)) return { q: 'balance' };
  if (/(quantas faltas|posso faltar|faltas)/.test(s)) return { q: 'absences', subjectId: subject ? subject.id : null };
  if (/(media|quanto (?:eu )?preciso|nota)/.test(s)) return { q: 'grade', subjectId: subject ? subject.id : null };
  if (/^quando/.test(s)) return { q: 'when', term: term(/^quando\s+(?:e|eh|vai ser|sera|que e|tenho|eu tenho|vence|cai)?\s*(?:a\s+|o\s+|minha\s+|meu\s+|as\s+|os\s+)?(.+)$/), subjectId: subject ? subject.id : null };
  if (/(o que|oque|que|quais?|tem|tenho|como)/.test(s)) return { q: 'agenda', range: range || { from: today, to: today, label: null }, only: /prova/.test(s) ? 'prova' : /aula/.test(s) ? 'aula' : /conta|pagar/.test(s) ? 'money' : null };
  return null;
}

// Entrada principal. ctx = { now, subjects }.
// Devolve { items, actions, query }: itens para salvar, ações (nota, falta, horário) e pergunta.
export function parse(text, ctx = {}) {
  const now = ctx.now || new Date();
  const full = { now, subjects: ctx.subjects || [] };
  const raw = String(text || '').trim();
  if (!raw) return { items: [], actions: [], query: null };
  const query = parseQuery(raw, full);
  if (query) return { items: [], actions: [], query };

  const t = tokenize(raw);
  // números dentro do nome da matéria ("Cálculo 2") não são hora nem valor
  const protect = [];
  const whole = findSubject(t, 0, t.length, full.subjects);
  if (whole) protect.push(whole);
  const spans = tag(t, now, protect);
  const segs = split(t, spans);
  const out = [];
  const actions = [];
  const built = segs.map((seg) => ({ seg, ...buildItem(t, seg, spans, full) }));
  // "luz 180, água 95 e aluguel 1800": número solto entre contas também é valor
  built.forEach((b, i) => {
    const near = (built[i - 1] && built[i - 1].item.type === 'money') || (built[i + 1] && built[i + 1].item.type === 'money');
    const lastTok = t.slice(b.seg.s, b.seg.e).find((w, k) => w.kind === 'num' && !spans.some((sp) => b.seg.s + k >= sp.s && b.seg.s + k < sp.e));
    if (b.item.type === 'task' && near && lastTok && !b.item.time) Object.assign(b, buildItem(t, b.seg, spans, { ...full, moneyList: true }));
  });

  // pedaço só com marcações ("Todo dia às 9h.") completa o vizinho
  const merged = [];
  built.forEach((b) => {
    if (!b.item.title && merged.length) {
      const prev = merged[merged.length - 1].item;
      ['date', 'time', 'endTime', 'repeat', 'remind'].forEach((k) => {
        if (b.item[k] !== null && b.item[k] !== undefined && (prev[k] === null || prev[k] === undefined)) prev[k] = b.item[k];
      });
      if (b.item.amount && !prev.amount && prev.type === 'money') prev.amount = b.item.amount;
    } else merged.push(b);
  });
  // dia dito no começo vale para os seguintes; dia/repetição dito no fim de uma lista de contas vale para as anteriores
  const lead = merged[0];
  if (lead && !lead.item.title && merged.length > 1) {
    const next = merged[1].item;
    ['date', 'time', 'repeat'].forEach((k) => {
      if (lead.item[k] && !next[k]) next[k] = lead.item[k];
    });
    merged.shift();
  }
  if (merged.length > 1) {
    const firstSeg = merged[0];
    const leadDate = spans.find((sp) => sp.kind === 'date' && sp.s >= firstSeg.seg.s && sp.e <= firstSeg.seg.e);
    const firstWord = t.slice(firstSeg.seg.s, firstSeg.seg.e).findIndex((w, k) => w.kind === 'w' && !spans.some((sp) => firstSeg.seg.s + k >= sp.s && firstSeg.seg.s + k < sp.e));
    if (leadDate && (firstWord < 0 || leadDate.s <= firstSeg.seg.s + firstWord)) {
      merged.slice(1).forEach((b) => {
        if (!b.item.date && !b.item.repeat && !(b.item.type === 'money' && b.item.paid)) b.item.date = firstSeg.item.date;
      });
    }
    const last = merged[merged.length - 1].item;
    if (last.type === 'money' && (last.repeat || last.date)) {
      merged.slice(0, -1).forEach((b) => {
        if (b.item.type !== 'money' || b.item.repeat || b.item.dated) return;
        if (b.item.paid && !last.paid && !b.words.some((n) => PAST_MONEY.has(n))) b.item.paid = false;
        if (b.item.paid) return;
        b.item.date = last.date;
        if (last.repeat) b.item.repeat = { ...last.repeat };
      });
    }
  }
  // "... e depois disso arrumar o quarto em 30 minutos": depois de algo com duração, "em N minutos" também é duração
  merged.forEach((b, i) => {
    const prev = i > 0 ? merged[i - 1].item : null;
    const seq = b.item._seq || t.slice(Math.max(0, b.seg.s - 3), b.seg.s + 1).some((w) => ['depois', 'seguida', 'disso'].includes(w.n));
    if (seq && b.item._rel && prev && prev.duration && !prev.time) {
      b.item.duration = b.item._rel;
      b.item.date = prev.date;
      b.item.time = null;
    }
    delete b.item._seq;
    delete b.item._rel;
  });
  merged.forEach((b) => {
    const special = specialOf(t, b.seg, spans, full, b);
    if (special) {
      actions.push(special);
      return;
    }
    if (!b.item.title) {
      if (b.item.type === 'money' && b.item.amount) b.item.title = b.item.flow === 'in' ? 'Entrada' : 'Gasto';
      else return;
    }
    out.push(b.item);
  });
  return { items: out, actions, query: null };
}
