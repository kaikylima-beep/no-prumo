// Interpretador de frases em português do Brasil.
// Recebe o texto falado/digitado e devolve uma lista de itens prontos para salvar:
//   { kind: 'task' | 'finance' | 'study', title, date, time, lead,
//     amount, type, category, status, repeat, raw }
// Funciona 100% no aparelho, sem internet.

import { toISO, fromISO, parseMoney } from './utils';
import { intervalTimes, firstOccurrence } from './recurrence';
import { fold, cleanSpeech, canonSpeech } from './normalize';

export const CATEGORIES = {
  out: ['Cartão', 'Contas', 'Alimentação', 'Transporte', 'Saúde', 'Estudos', 'Lazer', 'Parcelas', 'Tarifas e juros', 'Devolvido', 'Outros'],
  in: ['Salário', 'Bônus', 'Extra', 'Investimentos', 'Devolvido', 'Outros'],
};

// ---------- utilidades de texto ----------

// fold (minúsculas, sem acento, mesmo tamanho) mora em normalize.js; continua exportado daqui
export { fold };

function makeCutter(text) {
  let o = text;
  let f = fold(text);
  return {
    get o() { return o; },
    get f() { return f; },
    // recorta o trecho achado, deixando um espaço no lugar
    take(re) {
      const m = re.exec(f);
      if (!m) return null;
      const a = m.index;
      const b = a + m[0].length;
      o = o.slice(0, a) + ' ' + o.slice(b);
      f = f.slice(0, a) + ' ' + f.slice(b);
      return m;
    },
    cutRange(a, b) {
      o = o.slice(0, a) + ' ' + o.slice(b);
      f = f.slice(0, a) + ' ' + f.slice(b);
    },
    // apaga o trecho achado (limpeza final do título)
    del(re) {
      const m = re.exec(f);
      if (!m || m[0].length === 0) return null;
      const a = m.index;
      const b = a + m[0].length;
      o = o.slice(0, a) + o.slice(b);
      f = f.slice(0, a) + f.slice(b);
      return m;
    },
  };
}

// ---------- números por extenso ("vinte e sete" -> 27) ----------

const UNITS = {
  zero: 0, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14,
  quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};
const TENS = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700,
  oitocentos: 800, novecentos: 900,
};

function wordValue(word, runStarted) {
  if (word in UNITS) return UNITS[word];
  if (word in TENS) return TENS[word];
  if (word in HUNDREDS) return HUNDREDS[word];
  if (word === 'mil') return 'MIL';
  if ((word === 'um' || word === 'uma') && runStarted) return 1;
  return null;
}

export function wordsToNumbers(text) {
  const parts = text.split(/(\s+)/); // mantém os espaços
  const out = [];
  let i = 0;
  while (i < parts.length) {
    const tok = parts[i];
    if (/^\s+$/.test(tok) || tok === '') {
      out.push(tok);
      i++;
      continue;
    }
    const trailMatch = /[.,;:!?]+$/.exec(tok);
    const w0 = fold(tok.replace(/[.,;:!?]+$/, ''));
    const v0 = wordValue(w0, false);
    if (v0 === null) {
      out.push(tok);
      i++;
      continue;
    }
    const values = [v0];
    if (v0 === 'MIL') {
      // "2 mil", "R$ 3 mil e quinhentos": o número antes do "mil" entra na conta
      let k = out.length - 1;
      while (k >= 0 && /^\s*$/.test(out[k])) k--;
      const before = k >= 0 ? /^(r\$)?(\d+)$/i.exec(out[k]) : null;
      if (before && Number(before[2]) > 0 && Number(before[2]) < 1000) {
        out.length = k;
        if (before[1]) out.push(before[1]);
        values.unshift(Number(before[2]));
      } else if (k >= 0 && /^(?:r\$)?\d+[.,]\d+$/i.test(out[k])) {
        // "1,5 mil": fica como está, quem lê é o valor
        out.push(tok);
        i++;
        continue;
      }
    }
    // dentro de cada grupo: centenas > dezenas > unidades
    const rankOf = (v) => (v === 'MIL' ? 4 : v >= 100 ? 3 : v >= 20 ? 2 : 1);
    let lastRank = rankOf(values[values.length - 1]);
    const fits = (nv) =>
      nv === 'MIL' ? lastRank !== 4 : rankOf(nv) < lastRank && !(lastRank === 2 && nv >= 10);
    const push = (nv) => {
      values.push(nv);
      lastRank = rankOf(nv);
    };
    let j = i;
    let trail = trailMatch ? trailMatch[0] : '';
    while (!trail) {
      const sp = parts[j + 1];
      const next = parts[j + 2];
      if (sp === undefined || next === undefined) break;
      const nTrail = /[.,;:!?]+$/.exec(next);
      const nw = fold(next.replace(/[.,;:!?]+$/, ''));
      const prev = values[values.length - 1];
      if (nw === 'e') {
        const sp2 = parts[j + 3];
        const next2 = parts[j + 4];
        if (sp2 === undefined || next2 === undefined) break;
        const n2Trail = /[.,;:!?]+$/.exec(next2);
        const n2w = fold(next2.replace(/[.,;:!?]+$/, ''));
        const v2 = wordValue(n2w, true);
        if (v2 === null || v2 === 'MIL' || !fits(v2)) break;
        push(v2);
        j += 4;
        trail = n2Trail ? n2Trail[0] : '';
        continue;
      }
      const nv = wordValue(nw, true);
      if (nv === null) break;
      if (nv === 'MIL') {
        if (!fits('MIL')) break;
        push('MIL');
        j += 2;
        trail = nTrail ? nTrail[0] : '';
        continue;
      }
      if (prev === 'MIL') {
        if (!fits(nv)) break;
        push(nv);
        j += 2;
        trail = nTrail ? nTrail[0] : '';
        continue;
      }
      break;
    }
    let total = 0;
    let cur = 0;
    values.forEach((v) => {
      if (v === 'MIL') {
        total += (cur || 1) * 1000;
        cur = 0;
      } else {
        cur += v;
      }
    });
    out.push(String(total + cur) + trail);
    i = j + 1;
  }
  return out.join('');
}

// ---------- datas ----------

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MONTH_RE = MONTH_NAMES.join('|');
const WEEKDAY_IDX = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// próximo dia N (hoje incluído) ou, se preferPast, o último dia N (hoje incluído)
function dayOfMonth(day, today, preferPast) {
  const t = fromISO(today);
  for (let k = 0; k < 14; k++) {
    const off = preferPast ? -k : k;
    const d = new Date(t.getFullYear(), t.getMonth() + off, day);
    if (d.getDate() !== day) continue;
    const iso = toISO(d);
    if (preferPast ? iso <= today : iso >= today) return iso;
  }
  return null;
}

function monthDay(day, month0, today, preferPast) {
  const t = fromISO(today);
  const years = preferPast
    ? [t.getFullYear(), t.getFullYear() - 1]
    : [t.getFullYear(), t.getFullYear() + 1];
  for (const y of years) {
    const d = new Date(y, month0, day);
    if (d.getMonth() !== month0 || d.getDate() !== day) continue;
    const iso = toISO(d);
    if (preferPast ? iso <= today : iso >= today) return iso;
  }
  return null;
}

function validDate(y, m0, d) {
  const dt = new Date(y, m0, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m0 || dt.getDate() !== d) return null;
  return toISO(dt);
}

// dia N daqui a n meses (dia 31 em mês curto vira o último dia)
function addMonths(iso, n, day) {
  const t = fromISO(iso);
  const first = new Date(t.getFullYear(), t.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(day || t.getDate(), last)));
}

const NEXT_MONTH = '(?:mes\\s+que\\s+vem|proximo\\s+mes)';
const WEEKDAY_WORD = '(?:segunda|terca|quarta|quinta|sexta)(?:-feira|\\s+feira)?|sabado|domingo';
// datas com nome, sempre no mesmo dia do ano
const NAMED_DAYS = [
  [/\bvespera\s+de\s+natal\b/, 11, 24],
  [/\bnatal\b/, 11, 25],
  [/\b(?:vespera\s+de\s+ano\s+novo|reveillon|virada\s+d[eo]\s+ano)\b/, 11, 31],
  [/\bano\s+novo\b/, 0, 1],
];

function extractDate(c, today, preferPast) {
  let m;
  // "daqui a pouco", "mais tarde", "agora": é hoje (vale se a frase não disser outro dia)
  const soon = c.take(/\b(?:daqui\s+a\s+pouco|mais\s+tarde|logo\s+mais|agora(?:\s+mesmo)?|ja\s+ja)\b/);
  const d = extractDay(c, today, preferPast);
  return d || (soon ? today : null);
}

function extractDay(c, today, preferPast) {
  let m;

  // "de 20 a 27 de dezembro": vale o primeiro dia
  m = c.take(new RegExp(`\\b(?:de\\s+|do\\s+dia\\s+|dia\\s+)?(\\d{1,2})\\s+(?:a|ate|ao)\\s+(?:o\\s+)?(?:dia\\s+)?\\d{1,2}\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?`));
  if (m) {
    const month0 = MONTH_NAMES.indexOf(m[2]);
    return m[3] ? validDate(Number(m[3]), month0, Number(m[1])) : monthDay(Number(m[1]), month0, today, preferPast);
  }

  // "27 de novembro", "dia 27 de novembro de 2026"
  m = c.take(new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?`));
  if (m) {
    const day = Number(m[1]);
    const month0 = MONTH_NAMES.indexOf(m[2]);
    if (m[3]) return validDate(Number(m[3]), month0, day);
    return monthDay(day, month0, today, preferPast);
  }

  // "27/11", "27/11/2026"
  m = c.take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const day = Number(m[1]);
    const month0 = Number(m[2]) - 1;
    if (month0 < 0 || month0 > 11) return null;
    if (m[3]) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return validDate(y, month0, day);
    }
    return monthDay(day, month0, today, preferPast);
  }

  // "dia 5 do mês que vem", "no mês que vem dia 5"
  m = c.take(new RegExp(`\\bdia\\s+(\\d{1,2})\\s+d[eo]\\s+${NEXT_MONTH}\\b`)) || c.take(new RegExp(`\\b(?:n[ao]\\s+)?${NEXT_MONTH}\\s*,?\\s+(?:n[ao]\\s+)?dia\\s+(\\d{1,2})\\b`));
  if (m) return addMonths(today, 1, Number(m[1]));
  // "no fim do mês", "no começo do mês que vem"
  m = c.take(new RegExp(`\\b(?:(?:n[ao]|pr[ao]|para\\s+o|ate\\s+o)\\s+)?(comeco|inicio|fim|final)\\s+d[eo]\\s+(?:(${NEXT_MONTH})|mes)\\b`));
  if (m) {
    const next = m[2] ? 1 : 0;
    if (m[1] === 'fim' || m[1] === 'final') return addMonths(today, next, 31);
    return today.endsWith('-01') && !next ? today : addMonths(today, 1, 1);
  }
  // "mês que vem": dia 1º do mês que vem
  if (c.take(new RegExp(`\\b(?:(?:n[ao]|pr[ao]|para\\s+o)\\s+)?${NEXT_MONTH}\\b`))) return addMonths(today, 1, 1);
  // Natal, Ano Novo: com "no" sai do título ("presente da Ana no Natal"); sem, o nome é o assunto
  if (!preferPast) {
    for (const [re, month0, day] of NAMED_DAYS) {
      const hit = re.exec(c.f);
      if (!hit) continue;
      const pre = /\b(?:n[ao]|pr[ao]|para\s+o|ate\s+o)\s+$/.exec(c.f.slice(0, hit.index));
      if (pre) c.cutRange(pre.index, hit.index + hit[0].length);
      return monthDay(day, month0, today, false);
    }
  }

  if (c.take(/\bdepois\s+de\s+amanha\b/)) return addDays(today, 2);
  if (c.take(/\banteontem\b/)) return addDays(today, -2);
  if (c.take(/\bontem\b/)) return addDays(today, -1);
  if (c.take(/\b(?:de\s+)?amanha\b/)) return addDays(today, 1);
  if (c.take(/\b(?:ainda\s+)?hoje(?:\s+mesmo)?\b/)) return today;

  // "daqui a 15 dias", "em 1 semana", "daqui 2 meses"
  m = c.take(/\b(?:daqui\s+a|daqui|em|dentro\s+de)\s+(\d+)\s+(dias?|semanas?|mes(?:es)?)\b/);
  if (m) {
    if (m[2].startsWith('mes')) return addMonths(today, Number(m[1]));
    return addDays(today, Number(m[1]) * (m[2].startsWith('semana') ? 7 : 1));
  }

  m = c.take(/\bha\s+(\d+)\s+dias?\b/);
  if (m) return addDays(today, -Number(m[1]));

  // "quarta da semana que vem": o dia dentro da semana que vem (que começa na segunda)
  m =
    c.take(new RegExp(`\\b(?:n[ao]\\s+)?(${WEEKDAY_WORD})\\s+d[ae]\\s+(?:semana\\s+que\\s+vem|proxima\\s+semana)\\b`)) ||
    c.take(new RegExp(`\\b(?:n[ao]\\s+)?(?:semana\\s+que\\s+vem|proxima\\s+semana)\\s*,?\\s+(?:n[ao]\\s+)?(${WEEKDAY_WORD})\\b`));
  if (m) {
    const idx = WEEKDAY_IDX[/^[a-z]+/.exec(m[1])[0]];
    const dow = fromISO(today).getDay();
    const nextMonday = addDays(today, ((8 - dow) % 7) || 7);
    return addDays(nextMonday, (idx + 6) % 7);
  }
  if (c.take(/\b(?:(?:n[ao]|pr[ao]|para\s+a)\s+)?(?:semana\s+que\s+vem|proxima\s+semana)\b/)) return addDays(today, 7);

  // "no fim de semana": o próximo sábado (ou hoje, se já for fim de semana)
  if (c.take(/\b(?:(?:n?es[st]e|no|pro|para\s+o|proximo)\s+)?(?:fim|final)\s+de\s+semana\b/)) {
    const dow = fromISO(today).getDay();
    return dow === 0 || dow === 6 ? today : addDays(today, 6 - dow);
  }

  m = c.take(/\b(?:(?:na|no|nesta|neste|nessa|nesse|esta|este|essa|esse|proxima|proximo|de)\s+)?(segunda|terca|quarta|quinta|sexta)(?:-feira|\s+feira)?(?:\s+que\s+vem|\s+proxima|\s+agora)?\b|\b(?:(?:no|neste|nesse|este|esse|proximo|de)\s+)?(sabado|domingo)(?:\s+que\s+vem|\s+agora)?\b/);
  if (m) {
    const idx = WEEKDAY_IDX[m[1] || m[2]];
    const dow = fromISO(today).getDay();
    if (preferPast) {
      const back = ((dow - idx + 7) % 7) || 7;
      return addDays(today, -back);
    }
    const delta = ((idx - dow + 7) % 7) || 7;
    return addDays(today, delta);
  }

  m = c.take(/\bdia\s+(\d{1,2})\b/);
  if (m) return dayOfMonth(Number(m[1]), today, preferPast);

  return null;
}

// ---------- horário ----------

const pad2 = (n) => String(n).padStart(2, '0');

function fixHour(h, period) {
  if (period === 'tarde' || period === 'noite') {
    if (h < 12) return h + 12;
  }
  if ((period === 'manha' || period === 'madrugada') && h === 12) return 0;
  return h;
}

// palavras que indicam o horário: "às", "a partir das", "pras"...
// inclui horários aproximados: "lá para umas 10", "por volta das 8", "umas 9"
const TIME_MARK =
  '(?:la\\s+(?:para|pra|pelas)(?:\\s+(?:as|umas))?|(?:para|pra)\\s+umas|por\\s+volta\\s+d[ao]s?|perto\\s+d[ao]s?|pelas|umas|a\\s+partir\\s+d[ao]s?|desde\\s+as|ate\\s+as|antes\\s+d[ao]s|depois\\s+d[ao]s|para\\s+as|pras|as|a|das)';

function extractTime(c) {
  let m;
  if (c.take(/\b(?:ao\s+)?meio[\s-]dia\b/)) return '12:00';
  if (c.take(/\b(?:a\s+)?meia[\s-]noite\b/)) return '00:00';

  // 19h, 19h30, 19:30 (com ou sem "às")
  m = c.take(
    new RegExp(`(?:\\b${TIME_MARK}\\s+)?\\b(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))(?!\\w)(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite|madrugada))?`)
  );
  if (!m) {
    // "às 19 horas", "lá para umas 10 horas": com a palavra de horário e "horas", é horário
    m = c.take(new RegExp(`\\b${TIME_MARK}\\s+(\\d{1,2})()()\\s*horas?\\b(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite|madrugada))?`));
  }
  if (!m) {
    // "às 7 da noite", "às 19". Sem "às", "2 horas" é duração, não horário.
    m = c.take(
      new RegExp(
        `\\b${TIME_MARK}\\s+(\\d{1,2})()()(?:\\s*horas?)?(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite|madrugada))?(?=\\s*(?:$|[,.;!?]|e\\s+(?:as\\s+)?\\d|(?:as|ate\\s+as|ate)\\s+\\d|(?:hoje|amanha|no|na|nos|nas|em|pra|para|com|todo|toda|todos|todas|de\\s+(?:hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)|eu|tenho|preciso|vou|devo|que|[a-z]+(?:ar|er|ir))\\b))`
      )
    );
  }
  if (!m) {
    // "7 da noite", "3 horas da tarde", "8h da manhã" sem "às": com o período, é sempre horário
    m = c.take(/\b(\d{1,2})()()(?:\s*horas?)?(?:\s+e\s+(\d{1,2})\s*min\w*)?\s+da\s+(manha|tarde|noite|madrugada)\b/);
  }
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || m[3] || m[4] || 0);
  h = fixHour(h, m[5]);
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

// todos os horários da frase: "às 8h e às 20h" -> ['08:00', '20:00']
function extractTimes(c) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const t = extractTime(c);
    if (!t) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// partes do dia: "de manhã" 08:00, "cedo" 07:00, "à tarde" 14:00, "à noite" 20:00
const PERIODS = [
  [/\b(?:no\s+)?(?:fim|final)\s+da\s+tarde\b/, '17:00'],
  [/\b(?:no\s+)?(?:fim|final)\s+do\s+dia\b/, '18:00'],
  [/\b(?:(?:bem|logo)\s+cedo|cedinho|de\s+manha\s+cedo)\b/, '07:00'],
  [/\b(?:n[ao]\s+)?hora\s+do\s+almoco\b/, '12:00'],
  [/\bdepois\s+do\s+almoco\b/, '13:00'],
  [/\bantes\s+do\s+almoco\b/, '11:00'],
  [/\bdepois\s+d[ao]\s+(?:jantar|janta)\b/, '20:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa|logo\s+de)\s+manha(?:zinha)?\b/, '08:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa)\s+tarde\b/, '14:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa)\s+noite(?:zinha)?\b/, '20:00'],
  [/\b(?:de|na|pela)\s+madrugada\b/, '05:00'],
];

// "cedo" só é horário (07:00) junto de um dia que ainda vem: "amanhã cedo", "sábado cedo".
// "dormir cedo", "chegar cedo hoje" continuam no título.
const DAY_BEFORE_CEDO = new RegExp(`(?:\\bamanha|${WEEKDAY_WORD}|\\bdia\\s+\\d{1,2}|\\bque\\s+vem)\\s*$`);
const DAY_AFTER_CEDO = new RegExp(`^\\s*(?:amanha\\b|(?:n[ao]\\s+)?(?:${WEEKDAY_WORD})\\b)`);

function extractPeriod(c) {
  let found = null;
  for (const [re, t] of PERIODS) {
    if (c.take(re) && !found) found = t;
  }
  const m = /\bcedo\b/.exec(c.f);
  if (m && (DAY_BEFORE_CEDO.test(c.f.slice(0, m.index)) || DAY_AFTER_CEDO.test(c.f.slice(m.index + 4)))) {
    c.cutRange(m.index, m.index + 4);
    if (!found) found = '07:00';
  }
  return found;
}

// ---------- aviso ("me lembrar em 4 dias", "avisar uma semana antes") ----------

const VERB = '(?:me\\s+)?(?:lembr\\w*|avis\\w*)(?:\\s+(?:de\\s+)?(?:isso|disso))?';

function extractLead(c) {
  let m;
  m = c.take(new RegExp(`\\b${VERB}\\s+(?:em|daqui\\s+a|com)\\s+(\\d+)\\s+dias?(?:\\s+antes)?`));
  if (m) return Number(m[1]);
  m = c.take(new RegExp(`(?:\\b${VERB}\\s+)?\\b(\\d+)\\s+dias?\\s+antes`));
  if (m) return Number(m[1]);
  if (c.take(new RegExp(`(?:\\b${VERB}\\s+)?\\b(?:uma|1)\\s+semana\\s+antes\\b`))) return 7;
  if (c.take(new RegExp(`(?:\\b${VERB}\\s+)?\\b(?:na\\s+vespera|um\\s+dia\\s+antes|no\\s+dia\\s+anterior)\\b`))) return 1;
  // "me lembra de ..." sem prazo: só tira as palavras
  c.take(/\b(?:me\s+)?(?:lembr\w*|avis\w*)\b(?:\s+(?:de|que)\b)?/);
  return null;
}

// ---------- repetição ----------
// Devolve { rep, date, periodTime }:
//   rep = null | { freq: 'monthly', day } | { freq: 'daily', interval? } | { freq: 'weekly', days }
//   date = dia indicado ("todo dia 5" -> próximo dia 5)
//   periodTime = horário da parte do dia ("toda manhã" -> 08:00)

const WD = '(?:segunda|terca|quarta|quinta|sexta)s?(?:[-\\s]feiras?)?|sabados?|domingos?';
const WD_INDEX = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0 };
const ART = '(?:as|aos|a|o|na|no|nas|nos)';
// "segunda, quarta e sexta" e também a fala corrida, sem vírgula: "segunda quarta e sexta"
const LIST_RE = new RegExp(
  `\\b(?:(todas?|todos?)\\s+(?:as\\s+|os\\s+)?)?(?:${ART}\\s+)?(${WD})((?:(?:\\s*(?:,|\\be\\b)\\s*|\\s+)(?:${ART}\\s+)?(?:${WD})\\b)*)`
);
const RANGE_RE = new RegExp(`\\b(?:de\\s+)?(${WD})\\s+a\\s+(${WD})\\b`);

const wdIndex = (token) => WD_INDEX[token.slice(0, 3)];
const wdTokens = (text) => (text.match(new RegExp(WD, 'g')) || []).map(wdIndex);

function extractRepeat(c, today, now) {
  let m;
  // mensal: "todo dia 5", "todo mês", "mensalmente"
  m = c.take(/\b(?:todo\s+(?:santo\s+)?dia\s+(\d{1,2})(?:\s+de\s+(?:todo|cada)\s+mes)?|todo\s+mes|todos\s+os\s+meses|mensal(?:mente)?|(?:(?:uma|1)\s+vez\s+)?(?:por|ao)\s+mes|mensalidade\s+de)\b/);
  if (m) {
    if (m[1]) {
      const day = Number(m[1]);
      return { rep: { freq: 'monthly', day }, date: dayOfMonth(day, today, false), periodTime: null };
    }
    return { rep: { freq: 'monthly', day: null }, date: null, periodTime: null };
  }

  // intervalo: "de 8 em 8 horas", "a cada 6 horas"
  m = c.take(/\b(?:de\s+(\d{1,2})\s+em\s+(\d{1,2})\s+horas?|a\s+cada\s+(\d{1,2})\s+horas?)\b/);
  if (m) {
    const n = Number(m[1] || m[3]);
    if (n >= 1 && n <= 24) return { rep: { freq: 'daily', interval: n }, date: null, periodTime: null };
  }

  // "de hora em hora"; "3 vezes ao dia" = de 8 em 8 horas
  if (c.take(/\b(?:de\s+hora\s+em\s+hora|a\s+cada\s+hora|toda\s+hora)\b/)) {
    return { rep: { freq: 'daily', interval: 1 }, date: null, periodTime: null };
  }
  m = c.take(/\b(\d{1,2}|uma)\s+vez(?:es)?\s+(?:ao|por|no)\s+dia\b/);
  if (m) {
    const n = m[1] === 'uma' ? 1 : Number(m[1]);
    c.take(/\b(?:todo\s+dia|todos\s+os\s+dias|diariamente)\b/);
    if (n <= 1) return { rep: { freq: 'daily' }, date: null, periodTime: null };
    if (n <= 24) return { rep: { freq: 'daily', interval: Math.max(1, Math.round(24 / n)) }, date: null, periodTime: null };
  }

  // diário: "todo dia", "todos os dias", "diariamente", "toda noite"
  m = c.take(/\b(?:todo\s+(?:santo\s+)?dia|todos\s+os\s+dias|diariamente|toda\s+(manha|tarde|noite)|todas\s+as\s+(manhas|tardes|noites))\b(?!\s+\d)/);
  if (m) {
    const p = m[1] || (m[2] && m[2].slice(0, -1));
    const periodTime = p === 'manha' ? '08:00' : p === 'tarde' ? '14:00' : p === 'noite' ? '20:00' : null;
    return { rep: { freq: 'daily' }, date: null, periodTime };
  }

  // semanal: "de segunda a sexta", "dias úteis", "fins de semana"
  m = c.take(RANGE_RE);
  if (m) {
    const a = wdIndex(m[1]);
    const b = wdIndex(m[2]);
    const days = [];
    for (let d = a, guard = 0; guard < 7; d = (d + 1) % 7, guard++) {
      days.push(d);
      if (d === b) break;
    }
    c.take(/\b(?:todas?|todos?)\s+(?:as\s+|os\s+)?semanas?\b/);
    return { rep: { freq: 'weekly', days }, date: null, periodTime: null };
  }
  if (c.take(/\b(?:(?:todos?\s+os\s+|nos\s+|em\s+)?dias\s+(?:de\s+semana|uteis)|durante\s+a\s+semana)\b/)) {
    return { rep: { freq: 'weekly', days: [1, 2, 3, 4, 5] }, date: null, periodTime: null };
  }
  if (c.take(/\b(?:todo\s+fim\s+de\s+semana|todos\s+os\s+fins\s+de\s+semana|(?:aos|nos)\s+fins\s+de\s+semana|fins\s+de\s+semana)\b/)) {
    return { rep: { freq: 'weekly', days: [6, 0] }, date: null, periodTime: null };
  }

  // "toda semana", "semanalmente" (+ dia opcional: "toda semana na quarta")
  const everyWeek = c.take(/\b(?:toda\s+semana|todas\s+as\s+semanas|semanalmente|(?:uma|1)\s+vez\s+por\s+semana)\b/);

  // lista de dias: "toda segunda", "às terças", "segunda, quarta e sexta"
  m = LIST_RE.exec(c.f);
  if (m) {
    const days = [...new Set(wdTokens(m[0]))];
    const plural = /(?:segundas|tercas|quartas|quintas|sextas|sabados|domingos|feiras)\b/.test(m[0]);
    if (everyWeek || m[1] || plural || days.length >= 2) {
      c.take(LIST_RE);
      return { rep: { freq: 'weekly', days: days.sort() }, date: null, periodTime: null };
    }
  }
  if (everyWeek) {
    return { rep: { freq: 'weekly', days: [fromISO(today).getDay()] }, date: null, periodTime: null };
  }
  return { rep: null, date: null, periodTime: null };
}

// horários de agora, arredondados para os próximos 5 minutos
function roundedNow(now) {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  const add = (5 - (d.getMinutes() % 5)) % 5;
  d.setMinutes(d.getMinutes() + add);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------- valores ----------

function toAmount(numText) {
  return parseMoney(numText.replace(/[.,]+$/, ''));
}

function extractAmount(c) {
  let m;
  m = c.take(/(?:r\$\s*)?(\d[\d.,]*)\s*mil\b(?:\s*reais)?/);
  if (m) {
    const n = Number(m[1].replace(',', '.'));
    if (!isNaN(n)) return n * 1000;
  }
  m = c.take(/r\$\s*(\d[\d.,]*)/);
  let value = null;
  if (m) value = toAmount(m[1]);
  if (value === null) {
    m = c.take(/(\d[\d.,]*)\s*(?:reais|real|contos?|pilas?)\b/);
    if (m) value = toAmount(m[1]);
  }
  if (value === null) {
    m = c.take(/\bvalor\s+(?:total\s+)?(?:de\s+)?(\d[\d.,]*)/);
    if (m) value = toAmount(m[1]);
  }
  if (value !== null) {
    const cents = c.take(/\be\s+(\d{1,2})\s+centavos?\b/);
    if (cents) value = Math.round((value + Number(cents[1]) / 100) * 100) / 100;
  }
  return value;
}

// Números que contam coisas, não dinheiro: "3 vezes", "2 litros", "30 páginas", "5 km";
// e números que dão nome: "lista 3", "sala 204", "capítulo 5". Regra geral: número seguido de
// unidade ou de palavra no plural é quantidade.
const QTY_AFTER =
  /\b\d[\d.,]*\s*(?:(?:x|vez|horas?|h|min|minutos?|dias?|semanas?|mes|anos?|km|kg|g|ml|l|graus?|litro|quilo|grama|metro|pagina|capitulo|unidade|pessoa|copo|caixa|pacote|lata|garrafa|dose|comprimido|gota|serie|volta|aula|folha|duzia|par|fatia|xicara|colher)\b|%|por\s+cento\b|(?!(?:reais|centavos|contos|pilas|mais|menos|antes|depois|apos|atras|pois)\b)[a-z]{3,}s\b)/g;
const LABEL_BEFORE =
  /\b(?:lista|capitulo|pagina|sala|questao|aula|unidade|modulo|exercicio|apartamento|apto|bloco|numero|linha|andar|turma|grupo|semestre|periodo|versao|parte|volume|episodio|temporada|fase|etapa|nivel|portao|plataforma|mesa|ramal|rota|atividade)\s+\d+\b/g;
const blank = (m) => ' '.repeat(m.length);
export const maskQuantities = (f) => f.replace(QTY_AFTER, blank).replace(LABEL_BEFORE, blank);

function lastLooseNumber(f0) {
  const f = maskQuantities(f0);
  const re = /\b(\d[\d.,]*)\b/g;
  let last = null;
  let m;
  let prev = null;
  while ((m = re.exec(f)) !== null) {
    prev = last;
    last = m;
  }
  // "conta de 240 por 4": dividir não muda o valor dito antes
  if (last && prev && /\b(?:por|dividido\s+(?:por|em)|entre)\s*$/.test(f.slice(0, last.index))) return prev;
  return last;
}

function extractLooseNumber(c) {
  const last = lastLooseNumber(c.f);
  if (!last) return null;
  c.cutRange(last.index, last.index + last[0].length);
  return toAmount(last[1]);
}

// ---------- classificação ----------

const FIN_KW = /\b(gastei|gasto|gastos|paguei|pagar|pago|pagamento|conta|contas|fatura|cartao|boleto|parcela|prestacao|financiamento|aluguel|condominio|luz|energia|agua|internet|mercado|supermercado|uber|99|taxi|celular|telefone|gas|botijao|restaurante|pizza|cinema|netflix|spotify|remedio|consulta|dentista|gasolina|combustivel|ifood|lanche|almoco|jantar|farmacia|academia|assinatura|compras|comprei|recebi|receber|recebo|salario|bonus|renda|freela|deposito|pix|transferencia|reais|real|valor|iptu|ipva|mensalidade|transferir|transferi|depositar|depositei|sacar|saquei|emprestar|emprestei|devo|deve|ganhei|vendi)\b/g;
const FIN_STRONG = /\b(salario|bonus|aluguel|fatura|boleto|gastei|paguei|recebi|cartao|parcela|pix)\b/g;
// dinheiro que entra: "recebi", "ganhei", "vendi", e alguém que paga para mim ("o Pedro me pagou", "me deve")
const ME_PAID = 'me\\s+(?:pagou|pagaram|deu|deram|devolveu|devolveram|mandou|mandaram|transferiu|passou|depositou|emprestou|deve|devem|pagar|devolver|transferir|depositar)';
const INCOME_KW = new RegExp(`\\b(recebi|receber|recebo|salario|bonus|renda|freela|freelance|deposito|rendimentos?|reembolso|vendi|ganhei|dividendos?|decimo\\s+terceiro|${ME_PAID})\\b`);
const ME_PAID_RE = new RegExp(`\\b${ME_PAID}\\b`);
// conta com vencimento: é dinheiro mesmo quando a frase cita a faculdade
const BILL_KW = /\b(boleto|fatura|mensalidade|parcela|prestacao|vence|vencimento)\b/;
const STUDY_KW = /\b(prova|provas|teste|exame|seminario|apresentacao|estudar|estudo|estudos|materias?|aulas?|simulados?|revisar|revisao|tcc|monografia|relatorio|laboratorio|entrega|entregar|faculdade|trabalho\s+de|lista\s+de\s+exercicios|exercicios|artigo|defesa|capitulo)\b/;
// "revisão do carro" e "levar a moto na revisão" são oficina, não estudo
const VEHICLE = '(?:carro|moto|veiculo|caminhao|caminhonete|bike|bicicleta|scooter)';
const VEHICLE_SERVICE = new RegExp(`\\brevis(?:ao|ar)\\s+(?:d[aeo]|[ao])\\s+(?:minha\\s+|meu\\s+)?${VEHICLE}\\b|\\b${VEHICLE}\\s+(?:n[ao]|para\\s+a|pra)\\s+revisao\\b`);
const isStudy = (f) => STUDY_KW.test(f.replace(VEHICLE_SERVICE, ' '));
const FUTURE_INTENT = /\b(preciso|tenho\s+que|tenho\s+de|nao\s+esquecer|vou|pagar|receber|vence|vencimento|a\s+pagar|devo|deve|devem|devendo|(?:conta|boleto|fatura)\b.*\bchegou|chegou\s+(?:a|o)\s+(?:conta|boleto|fatura)|fazer\s+(?:o|um|uma)\s+(?:pix|transferencia|deposito)|mandar|transferir|depositar)\b/;
const PAST_FIN_VERB = /\b(gastei|paguei|comprei|recebi|transferi|depositei|fiz|mandei|enviei)\b/;
// 1.12.3: dinheiro dito com o verbo no infinitivo no começo ("fazer o pix…", "mandar 50…",
// "transferir 100…") ainda vai acontecer: fica a pagar, qualquer que seja a palavra depois
const INTENT_START = /^\s*(?:(?:eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|vou|devo|nao\s+esquecer\s+de)\s+)?(?:fazer|mandar|enviar|transferir|depositar|pagar)\b/;
const TASK_VERB = /^\s*(?:(?:eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|vou|quero|devo|nao\s+esquecer\s+de|nao\s+esquece\s+de)\s+)?(comprar|lavar|limpar|arrumar|ligar|marcar|levar|buscar|trocar|consertar|fazer|ler|separar|organizar|tirar|cortar|regar|passar|cozinhar|varrer|devolver|enviar|mandar|responder|agendar|ver|visitar|tomar|colocar|guardar|estender|dobrar|montar|instalar|imprimir|escrever|correr|treinar|caminhar)\b/;

const count = (re, s) => (s.match(re) || []).length;

const BANKS = {
  itau: 'Itaú', nubank: 'Nubank', santander: 'Santander', bradesco: 'Bradesco',
  inter: 'Inter', c6: 'C6', caixa: 'Caixa', 'banco do brasil': 'Banco do Brasil',
  bb: 'BB', picpay: 'PicPay', 'mercado pago': 'Mercado Pago', xp: 'XP',
  sicredi: 'Sicredi', sicoob: 'Sicoob', neon: 'Neon', btg: 'BTG',
  renner: 'Renner', riachuelo: 'Riachuelo', porto: 'Porto',
};
const BANK_RE = new RegExp(`\\b(${Object.keys(BANKS).join('|')})\\b`);

// "99" só é o app de corrida quando a frase deixa claro ("99 pop", "corrida da 99", "peguei um 99",
// ou "99" seguido do valor); nunca quando é parte do valor ("23,99", "23 e 99")
const NINETY_NINE =
  /\b99\s*(?:pop|taxi|moto|app|food)\b|\b(?:corrida|viagem|carro)\s+(?:d[aeo]|n[ao]|pel[ao])\s+99\b|\b(?:peguei|pedi|chamei|usei)\s+(?:um\s+|uma\s+|o\s+|a\s+)?99\b|^\s*99\s+(?:r\$\s*)?\d/;

// [regra, título (null = usar o texto falado), categoria]
const OUT_RULES = [
  [/\b(luz|energia|eletrica|copel|cemig|enel|cpfl)\b/, 'Conta de luz', 'Contas'],
  [/\b(agua|sanepar|sabesp|saneamento)\b/, 'Conta de água', 'Contas'],
  [/\baluguel\b/, 'Aluguel', 'Contas'],
  [/\bcondominio\b/, 'Condomínio', 'Contas'],
  [/\b(internet|wifi|fibra)\b/, 'Internet', 'Contas'],
  [/\b(gas|botijao)\b/, 'Gás', 'Contas'],
  [/\b(telefone|celular)\b/, 'Telefone', 'Contas'],
  [/\biptu\b/, 'IPTU', 'Contas'],
  [/\bipva\b/, 'IPVA', 'Contas'],
  [/\b(imposto|taxa)\b/, null, 'Contas'],
  [/\b(parcela|prestacao|financiamento)\b/, null, 'Parcelas'],
  [/\b(mercado|supermercado|feira|padaria|acougue|hortifruti)\b/, 'Mercado', 'Alimentação'],
  [/\b(restaurante|ifood|lanche|almoco|jantar|pizza|hamburguer)\b/, 'Restaurante', 'Alimentação'],
  [/\buber\b/, 'Uber', 'Transporte'],
  [NINETY_NINE, '99', 'Transporte'],
  [/\b(gasolina|combustivel|etanol)\b/, 'Combustível', 'Transporte'],
  [/\b(taxi|onibus|metro|estacionamento|pedagio|passagem)\b/, null, 'Transporte'],
  [/\b(farmacia|drogaria)\b/, 'Farmácia', 'Saúde'],
  [/\b(remedio|remedios|consulta|medico|dentista|plano\s+de\s+saude|hospital)\b/, null, 'Saúde'],
  [/\b(faculdade|mensalidade|curso|livro|livros|material)\b/, null, 'Estudos'],
  [/\b(academia)\b/, 'Academia', 'Saúde'],
  [/\b(cinema|netflix|spotify|show|bar|viagem|festa|streaming|assinatura)\b/, null, 'Lazer'],
];

const IN_RULES = [
  [/\bdecimo\s+terceiro\b/, '13º salário', 'Salário'],
  [/\bsalario\b/, 'Salário', 'Salário'],
  [/\bbonus\b/, 'Bônus', 'Bônus'],
  [/\b(freela|freelance|extra|bico)\b/, null, 'Extra'],
  [/\b(rendimentos?|dividendos?|investimentos?|juros)\b/, 'Rendimentos', 'Investimentos'],
  [/\breembolso\b/, 'Reembolso', 'Outros'],
];

// forma de pagamento: "no cartão Nubank", "no crédito", "no pix"
const PAYMENT_RE = new RegExp(
  `\\b(?:no|na|pelo|pela|com\\s+o|com\\s+a|via)\\s+(?:cartao(?:\\s+de\\s+(?:credito|debito))?|credito|debito|pix)(?:\\s+(?:do\\s+|da\\s+)?(?:${Object.keys(BANKS).join('|')}))?\\b`
);

export function guessFinance(text, income) {
  // "23,99" e "1.800" são valores, não palavras (o "99" de "23,99" não é o app)
  const f0 = text.replace(/\d+(?:[.,]\d{3})*[.,]\d{2}\b/g, ' ');
  if (income) {
    for (const [re, label, cat] of IN_RULES) if (re.test(f0)) return { label, category: cat };
    return { label: null, category: 'Outros' };
  }
  if (/\b(cartao|fatura|credito)\b/.test(f0)) {
    const b = BANK_RE.exec(f0);
    return { label: b ? `Cartão ${BANKS[b[1]]}` : 'Cartão de crédito', category: 'Cartão' };
  }
  for (const [re, label, cat] of OUT_RULES) if (re.test(f0)) return { label, category: cat };
  const b = BANK_RE.exec(f0);
  if (b) return { label: BANKS[b[1]], category: 'Cartão' };
  return { label: null, category: 'Outros' };
}

// ---------- título ----------

const LEAD_RE = /^(?:[\s,.;:!?-]|\b(?:e|ai|entao|tambem|alem\s+disso|depois|eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|tenho|tem\s+que|tem|vai\s+ter|vou\s+ter|vou|quero|devo|nao\s+esquecer\s+de|nao\s+esquece\s+de|lembrete(?:\s+de)?|anot\w+|adicion\w+|colocar|coloca|um|uma|para|pra|que|de|da|do)\b)+/;
const LEAD_FIN_RE = /^(?:[\s,.;:!?-]|\b(?:e|eu|fazer|faz|fiz|mandar|manda|mandei|enviar|enviei|preciso(?:\s+de)?|tenho\s+que|vou|devo|gastei|paguei|comprei|recebi|transferi|vou\s+receber|vou\s+pagar|tenho\s+que\s+pagar|preciso\s+pagar|pagar|receber|pago|recebo|valor|total|de|do|da|no|na|em|um|uma|o|a|com|ai|meu|minha)\b)+/;
const TAIL_RE = /(?:[\s,.;:!?-]|\b(?:pro|pra|para|no|na|em|ate|de|do|da|dia|e|que|vence|vencimento|o|a|os|as|ai|com|as|por|sao|foi|foram|deu|ficou|custa|custou|saiu|chegou)\b)+$/;

function finishTitle(c, fin) {
  // "o Pedro me pagou" → "Pedro"
  if (fin) while (c.del(ME_PAID_RE)) {}
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 12) {
    changed = false;
    if (c.del(fin ? LEAD_FIN_RE : LEAD_RE)) changed = true;
    if (c.del(TAIL_RE)) changed = true;
  }
  let s = c.o.replace(/\s+/g, ' ').trim();
  // 1.12.3: o valor sai do meio e deixa duas preposições juntas ("transferência de pra mãe")
  s = s.replace(/\b(?:de|do|da)\s+(pra|pro|para)\b/gi, '$1').replace(/\bde\s+(d[ao]s?)\b/gi, '$1');
  // o dia ou o valor saiu do meio e deixou um "de" solto ("almoço de na casa da sogra")
  s = s.replace(/\bde\s+(?=(?:em|n[oa]s?|com|por|pel[oa])\b)/gi, '').replace(/\s+(?:de|em)$/i, '');
  // "pro João" sozinho no título fica "Para João"
  if (fin) s = s.replace(/^(?:pro|pra)\b/i, 'para');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// Hora dita sem "da manhã" nem "da tarde" para outro dia: de 1 a 6 quase sempre é à tarde
// ("reunião quinta às 3"). Fica de manhã quando a frase fala de acordar, viagem ou plantão.
const EARLY_CONTEXT = /\b(acordar|levantar|despertar|despertador|alarme|voo|aeroporto|embarque|madrugar|onibus|viagem|viajar|estrada|plantao|turno|correr|corrida|caminhar|caminhada|treinar|treino|academia)\b/;
export function afternoonIfBare(time, f) {
  if (!time || /\b(manha|tarde|noite|madrugada|cedo)\b/.test(f) || /\b0\d(?::|h)/.test(f) || EARLY_CONTEXT.test(f)) return time;
  const h = Number(time.slice(0, 2));
  return h >= 1 && h <= 6 ? `${pad2(h + 12)}${time.slice(2)}` : time;
}

// ---------- uma frase = um item ----------

// "daqui a 30 minutos", "em 2 horas", "daqui a meia hora", "daqui a uma hora e meia"
function extractRelative(c, now) {
  const m = c.take(
    /\b(?:daqui\s+a|daqui|em|dentro\s+de)\s+(?:(?:\d+|uma)\s*(?:horas?|h)\b(?:\s+e\s+(?:meia\b|\d+\s*(?:minutos?|min)\b))?|\d+\s*(?:minutos?|min)\b|meia\s+hora\b)/
  );
  if (!m) return null;
  const txt = m[0];
  let mins = 0;
  if (/meia\s+hora/.test(txt)) mins += 30;
  const h = /(\d+|uma)\s*(?:horas?|h)\b/.exec(txt);
  if (h) mins += (h[1] === 'uma' ? 1 : Number(h[1])) * 60;
  if (/horas?\s+e\s+meia|h\s+e\s+meia/.test(txt)) mins += 30;
  const mm = /(\d+)\s*(?:minutos?|min)\b/.exec(txt);
  if (mm) mins += Number(mm[1]);
  if (!mins) return null;
  const d = new Date(now.getTime() + mins * 60000);
  return { date: toISO(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
}

// Começa com verbo no infinitivo ("comer", "dormir", "assistir")? Então é ação, não gasto.
const INFINITIVE = /^\s*(?:(?:eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|vou|quero|devo|nao\s+esquecer\s+de)\s+)?[a-z]{2,}(?:ar|er|ir|or)\b/;

// ---------- título curto ("tomar remédio da diabetes" -> "Remédio diabetes") ----------

// verbos que não dizem muito quando vêm antes do assunto
const LIGHT_VERB = /^(tomar|fazer|ter|ir|dar|realizar|efetuar|ficar)$/;
const FILLER = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'pra', 'pro', 'pras', 'pros', 'para', 'no', 'na', 'nos', 'nas', 'em', 'com', 'que',
  'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'e', 'ao', 'aos', 'pela', 'pelo',
  'la', 'ai', 'tambem', 'ainda', 'isso', 'esse', 'essa', 'aquele', 'aquela', 'aqui', 'ali', 'ne',
]);
const MAX_SHORT_WORDS = 4;
const MODAL_WORD = /^(?:preciso|vou|devo|quero)$/;

export function abbreviate(title) {
  if (!title) return title;
  let words = title
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[,;:.!?]+$/, ''))
    .filter(Boolean);
  // 1.12.3: o título curto começa no verbo de ação ("… eu tenho que lavar o carro" → "Lavar carro"),
  // quando antes dele só vem contexto (nenhum outro verbo no infinitivo)
  const fw = words.map((w) => fold(w));
  const isInf = (w) => /^[a-z]{2,}(?:ar|er|ir|or)$/.test(w);
  const iv = fw.findIndex((w, i) => i > 0 && isInf(w) && (MODAL_WORD.test(fw[i - 1]) || (/^(?:que|de)$/.test(fw[i - 1]) && fw[i - 2] === 'tenho')));
  if (iv > 0 && !fw.slice(0, iv).some(isInf)) words = words.slice(iv);
  const verb = words[0];
  if (words.length > 1 && LIGHT_VERB.test(fold(words[0]))) words = words.slice(1);
  let kept = words.filter((w) => !FILLER.has(fold(w)));
  // "fazer comida" fica "Fazer comida": sem o verbo, uma palavra só perde o sentido
  if (kept.length === 1 && fold(verb) === 'fazer') kept = [verb, ...kept];
  if (!kept.length) return title;
  // listas ("arroz, feijão e leite") não perdem itens; o resto fica com até 4 palavras
  const isList = /,|\s+e\s+/.test(title);
  const short = (isList ? kept : kept.slice(0, MAX_SHORT_WORDS)).join(' ');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// o pedido que vem depois do contexto: "tenho que…", "preciso…" ou um verbo no infinitivo
const ASK = '(?:eu\\s+)?(?:tenho|preciso|vou|devo|quero|ir|[a-z]+(?:ar|er|ir))\\b';
// "quando eu chegar em casa…", "assim que eu acordar…", "depois que eu almoçar…": qualquer verbo
const CONDITION_RE = new RegExp(
  `\\b(?:quando|assim\\s+que|depois\\s+que|logo\\s+que|antes\\s+de)\\s+(?:eu\\s+)?(?:[a-z]{2,}(?:ar|er|ir)|estiver|for|tiver|puder|vier)\\b(?:\\s+(?!${ASK})[^\\s,]+){0,4}`
);
// 1.13.1: contexto com preposição no começo ("depois da aula…", "no caminho de casa…",
// "se der tempo…"): sai do título quando depois dele vem o pedido
const PREP_CONTEXT_RE = new RegExp(
  `^\\s*(?:(?:e|ai|entao)\\s+)?(?:(?:depois|antes|na\\s+volta|na\\s+saida|na\\s+ida|no\\s+caminho|a\\s+caminho|no\\s+intervalo)\\s+d[aeo]s?|(?:se|quando)\\s+(?:der|sobrar|puder|possivel))\\b(?:\\s+(?!${ASK})[^\\s,]+){0,4}?(?=\\s*,?\\s*${ASK})`
);

// 1.12.3: contexto no gerúndio no começo da frase não é o assunto: "chegando em casa eu tenho
// que lavar o carro", "saindo do trabalho preciso passar no mercado". Só sai quando depois dele
// vem o pedido (tenho que, preciso, vou… ou um verbo no infinitivo).
const GERUND_CONDITION_RE =
  /^\s*(?:(?:e|ai|entao)\s+)?(?!quando\b)(?:indo|[a-z]{2,}(?:ando|endo|indo))\b(?:\s+(?!(?:eu\s+)?(?:tenho|preciso|vou|devo|quero)\b)(?![a-z]+(?:ar|er|ir)\b)[^\s,]+){0,4}(?=\s*,?\s*(?:eu\s+)?(?:tenho|preciso|vou|devo|quero|ir|[a-z]+(?:ar|er|ir))\b)/;

// a frase sem o contexto do começo: é ela que decide a área e o verbo
const withoutContext = (f) => f.replace(GERUND_CONDITION_RE, ' ').replace(PREP_CONTEXT_RE, ' ').replace(CONDITION_RE, ' ').trim();

export function parseSegment(seg, today, forceKind, now = new Date(), opts = {}) {
  const f0 = fold(seg);
  const c = makeCutter(seg);
  // 1.13.1: gasto dito em sequência herda o verbo do primeiro ("vou pagar a luz 180 a água 95")
  const ownVerb = PAST_FIN_VERB.test(f0) || INCOME_KW.test(f0) || FUTURE_INTENT.test(f0);
  const fv = opts.ctx && !ownVerb ? `${opts.ctx} ${f0}` : f0;
  const pastVerb = PAST_FIN_VERB.test(f0) || /\b(ontem|anteontem|ha\s+\d+\s+dias?)\b/.test(f0);

  const R = extractRepeat(c, today, now);
  const rep = R.rep;
  const monthly = !!rep && rep.freq === 'monthly';
  const lead = extractLead(c);
  const rel = extractRelative(c, now);
  let times = rel ? [rel.time] : extractTimes(c);
  const period = extractPeriod(c);
  // horário que veio da parte do dia ("de madrugada", "depois do almoço") já está certo: não vira tarde/noite
  let saidTimes = null;
  const fromPeriod = !times.length && !!(period || R.periodTime);
  if (fromPeriod) times = [period || R.periodTime];
  let date = R.date || (rel && rel.date) || extractDate(c, today, pastVerb);
  const explicitDate = !!date;
  let amount = extractAmount(c);

  const finScore = count(FIN_KW, f0) + count(FIN_STRONG, f0);
  const looseNum = lastLooseNumber(c.f);
  // 1.12.3: o contexto do começo ("voltando da faculdade…") não decide a área nem o verbo
  const fAsk = withoutContext(f0);
  const startsWithTaskVerb = TASK_VERB.test(fAsk) || (finScore === 0 && INFINITIVE.test(fAsk));

  let kind = forceKind;
  if (!kind) {
    if (amount !== null) kind = 'finance';
    else if (looseNum && BILL_KW.test(f0)) kind = 'finance'; // "boleto da faculdade 890 vence dia 10"
    else if (isStudy(fAsk)) kind = 'study';
    else if (rep && !monthly) kind = 'task'; // "de 8 em 8 horas", "toda segunda": lembrete, não dinheiro
    else if (looseNum && (finScore >= 1 || (!startsWithTaskVerb && !explicitDate))) kind = 'finance';
    else if (finScore >= 2 && PAST_FIN_VERB.test(f0)) kind = 'finance';
    else if (monthly && finScore >= 1 && !startsWithTaskVerb) kind = 'finance';
    else kind = 'task';
  }

  if (kind === 'finance') {
    c.take(CONDITION_RE);
    c.take(GERUND_CONDITION_RE);
    if (amount === null) amount = extractLooseNumber(c);
    const income = INCOME_KW.test(fv);
    // compra no cartão ("comprei um tênis de 300 no cartão Nubank"): o título é o que foi comprado
    let gText = f0;
    let purchase = false;
    const isBill = /\b(fatura|conta\s+do\s+cartao|pagar\s+o\s+cartao|paguei\s+o\s+cartao|boleto)\b/.test(f0);
    if (!isBill && /\b(comprei|gastei|compra|compras)\b/.test(f0) && PAYMENT_RE.test(c.f)) {
      c.take(PAYMENT_RE);
      gText = fold(c.o);
      purchase = true;
    }
    const g = guessFinance(gText, income);
    if (purchase && g.category === 'Outros') g.category = 'Cartão';
    // "em 3 vezes", "parcelado em 10x": não é nome do gasto
    c.take(/\b(?:parcelad[oa]\s+)?em\s+\d+\s*(?:x|vezes|parcelas)\b/);
    // Pix e transferência: o nome é o que a pessoa falou ("Pix pra Bia pelo almoço"), a categoria é a do assunto
    let title = /\b(?:pix|transferencia|ted)\b/.test(f0) && !income && g.category !== 'Cartão' && /\b(?:pr[oa]|para|d[aeo])\s+[a-z]/.test(c.f) ? null : g.label;
    if (!title) {
      title = finishTitle(c, true);
      if (opts.short) title = abbreviate(title);
    }
    if (!title) title = income ? 'Entrada' : 'Despesa';
    const d = date || today;
    let status;
    if (PAST_FIN_VERB.test(fv)) status = 'paid';
    else if (d > today) status = 'pending';
    else if (FUTURE_INTENT.test(fv) || INTENT_START.test(fv) || monthly) status = 'pending';
    else status = 'paid';
    return {
      kind,
      raw: seg,
      title,
      amount,
      type: income ? 'in' : 'out',
      category: g.category,
      date: d,
      time: null,
      lead: null,
      status,
      repeat: monthly,
      explicitDate,
    };
  }

  // "quando eu chegar em casa ...", "chegando em casa ...": condição, não faz parte do título
  c.take(CONDITION_RE);
  c.take(GERUND_CONDITION_RE);
  c.take(PREP_CONTEXT_RE);
  // "às 10" dito hoje depois das 10h: quer dizer 22h (se não falou "da manhã")
  if (times.length && !fromPeriod && !rep && (!date || date === today) && !/\bmanha\b|\bcedo\b|\bmadrugada\b/.test(f0) && !rel) {
    const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const said = times;
    times = times.map((t) => {
      const h = Number(t.slice(0, 2));
      return h < 12 && t <= hm ? `${pad2(h + 12)}${t.slice(2)}` : t;
    });
    // sem dia dito: se o item herdar outro dia ("amanhã acordar às 6 … sair às 8"), vale a hora como foi falada
    if (!date && said.join() !== times.join()) saidTimes = said;
  } else if (times.length && !fromPeriod && !rep && !rel && date && date !== today) {
    times = times.map((t) => afternoonIfBare(t, f0));
  }
  const full = finishTitle(c, false);
  if (!full) {
    return { empty: true, raw: seg, lead, date, time: times[0] || null, times, rep };
  }
  const title = opts.short ? abbreviate(full) : full;

  // lembrete que se repete
  if (rep) {
    const r = { ...rep };
    if (r.freq === 'monthly' && !r.day) r.day = Number((date || today).slice(8, 10));
    if (r.interval) times = intervalTimes(times[0] || roundedNow(now), r.interval);
    if (!times.length) times = ['08:00'];
    times = [...new Set(times)].sort();
    return {
      kind,
      raw: seg,
      title,
      date: firstOccurrence(r, times, now),
      time: times[0],
      times,
      lead: null,
      amount: null,
      type: null,
      category: null,
      status: null,
      repeat: r,
    };
  }

  // "me lembrar em 3 dias" sem data = lembrete para daqui a 3 dias
  let finalLead = lead;
  if (lead !== null && !date) {
    date = addDays(today, lead);
    finalLead = null;
  }
  return {
    kind,
    raw: seg,
    title,
    date: date || null,
    time: times[0] || null,
    times: times.length ? times.slice(0, 1) : [],
    ...(saidTimes ? { saidTime: saidTimes[0] } : null),
    ...(fromPeriod ? { periodTime: true } : null),
    lead: finalLead,
    amount: null,
    type: null,
    category: null,
    status: null,
    repeat: null,
  };
}

// ---------- separar várias coisas ditas de uma vez ----------

const STARTERS = /^\s*(?:paguei|gastei|comprei|recebi|transferi|vou\s+receber|vou\s+pagar|tenho|preciso|me\s+lembr\w*|lembr\w*|avis\w*|comprar|lavar|limpar|arrumar|ligar|marcar|levar|buscar|trocar|estudar|entregar|pagar|fazer|ler|devolver|prova|teste|exame|trabalho|seminario|lista\s+de|entrega|apresentacao|simulado)\b/;

const DATE_TIME_RE = new RegExp(
  `\\bdia\\s+\\d{1,2}\\b|\\b\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\b\\d{1,2}\\s+de\\s+(?:${MONTH_RE})|\\b\\d{1,2}(?:h\\d{0,2}|:\\d{2})|\\bas\\s+\\d{1,2}\\b|\\b\\d+\\s+(?:dias?|semanas?|horas?)\\b|\\bde\\s+\\d+\\s+em\\s+\\d+\\s+horas?|\\ba\\s+cada\\s+\\d+\\s+horas?`,
  'g'
);

const hasMoney = (f) => /\d/.test(f.replace(DATE_TIME_RE, ' '));
const startsWithNumber = (f) => /^\s*(?:r\$\s*)?\d/.test(f);

// ---------- fala corrida, sem pontuação ----------
// O reconhecimento de voz costuma entregar o texto sem vírgula nem ponto:
// "lavar o carro às 10 da noite fazer o pix do joão de 60 estudar para a prova".
// 1.13.1: a separação segue a ideia dos assistentes de voz — um item tem UM assunto, UM dia,
// UMA hora e UM valor. A frase é lida palavra por palavra e um item novo começa quando:
//   - aparece um verbo de ação e o pedaço anterior já tem a sua ação (ou valor, ou assunto com hora);
//   - aparece um assunto novo logo depois do dia/hora do item anterior, e mais adiante vem outro dia/hora
//     ("reunião às 9 dentista às 14");
//   - aparece um segundo dia para um item que já tem dia ("segunda tenho médico terça tenho prova");
//   - aparece um segundo valor para um gasto que já tem valor e nome ("30 no almoço 15 no uber").
// Verbo é reconhecido pela forma da palavra (termina em -ar, -er, -ir), não por uma lista fechada.

const PAST_VERBS = new Set('paguei gastei comprei recebi transferi depositei vendi pedi perdi devolvi investi'.split(' '));
// palavras que terminam em -ar, -er, -ir e não são ação (substantivos, auxiliares, nomes)
const NOT_VERB = new Set(
  (
    'celular lugar jantar bar lar mar par ar azar radar colar jaguar pomar polegar militar escolar familiar particular ' +
    'popular regular similar singular titular auxiliar preliminar exemplar lunar solar nuclear hospitalar vestibular luar ' +
    'paladar patamar pilar dolar acucar impar bazar altar andar lazer mulher colher talher qualquer sequer prazer poder ' +
    'dever ser ter haver lider carater reporter sueter poster hamburguer cancer laser freezer designer container trailer ' +
    'folder banner mixer blazer scanner poker uber super hiper master elixir souvenir cesar oscar edgar omar itamar ' +
    'valdemar ademar gaspar jair almir valdir ademir vladimir walter peter jennifer ester kleber oliver xavier javier ' +
    'roger sei lei rei frei volei joquei ponei hoquei andrei'
  ).split(' ')
);
// verbos de movimento: o verbo que vem depois diz para quê ("ir ao mercado comprar pão" é um item só)
const MOTION = new Set('ir passar sair voltar vir chegar subir descer entrar parar'.split(' '));

export function isActionVerb(w) {
  if (NOT_VERB.has(w)) return false;
  return w === 'ir' || /^[a-z]{2,}(?:ar|er|ir)$/.test(w) || /^[a-z]{3,}ei$/.test(w) || PAST_VERBS.has(w);
}

const NO_BREAK_BEFORE = new Set(
  (
    'para pra pro pras pros de da do das dos a ao aos e ou que sem pode podem vou vai vamos preciso precisa tenho tem ' +
    'temos quero queria devo deve ir antes depois apos ate pelo pela em no na nao nem me te se lembrar lembra lembre ' +
    'esquecer esquece comecar comeca terminar acabar tentar ajudar mandar deixar ' +
    'o os as um uma meu minha meus minhas seu sua esse essa este esta aquele aquela com por sobre entre cada qualquer ' +
    'algum nenhum outro mesmo tambem ja so ainda posso consigo conseguir gostaria pretendo'
  ).split(' ')
);
// palavras de ligação: não são o assunto de um item
const FUNC = new Set(
  (
    'o a os as um uma uns umas de da do das dos em no na nos nas para pra pro pras pros com sem por pelo pela ao aos e ou ' +
    'que se ate desde entre sobre eu me meu minha la ai entao tambem ne r$ reais real'
  ).split(' ')
);
const LIGHT = new Set('tenho tem preciso vou devo quero vai ter eu nao'.split(' '));
const ARTICLE = new Set('o a os as um uma'.split(' '));
// antes de um dia: "prova DE sexta", "de segunda A sexta", "sábado E domingo", "adiar PARA quarta"
const ATTR = new Set('de da do a ate e ou para pra pro desde entre que'.split(' '));

export const HARD = '\u0004'; // marca de item separado pela leitura da frase (sem pontuação)
const AFTER = '\u0005'; // marca de item que vem "depois": herda o dia, não a hora

// pedaços de dia e de hora dentro da frase
const SPAN_MARK =
  '(?:la\\s+(?:para|pra|pelas)(?:\\s+(?:as|umas))?|(?:para|pra)\\s+(?:as|umas)|por\\s+volta\\s+d[ao]s?|perto\\s+d[ao]s?|pelas|umas|a\\s+partir\\s+d[ao]s?|desde\\s+as|ate\\s+as|pras|as|das)';
const SPAN_PER = '(?:\\s+da\\s+(?:manha|tarde|noite|madrugada))';
const DATE_SPANS = [
  'depois\\s+de\\s+amanha|anteontem|ontem|amanha|(?:ainda\\s+)?hoje',
  `(?:(?:n[ao]|nes[st][ae]|es[st][ae]|proxim[ao])\\s+)?(?:${WEEKDAY_WORD})(?:\\s+que\\s+vem|\\s+agora|\\s+d[ae]\\s+(?:semana\\s+que\\s+vem|proxima\\s+semana))?`,
  `(?:n[ao]\\s+)?dia\\s+\\d{1,2}(?:\\s+de\\s+(?:${MONTH_RE}))?(?:\\s+d[eo]\\s+${NEXT_MONTH})?`,
  `\\d{1,2}\\s+de\\s+(?:${MONTH_RE})(?:\\s+de\\s+\\d{4})?`,
  '\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?',
  `(?:n[ao]\\s+)?(?:semana\\s+que\\s+vem|proxima\\s+semana|${NEXT_MONTH}|(?:fim|final)\\s+de\\s+semana|(?:fim|final|comeco|inicio)\\s+d[eo]\\s+mes(?:\\s+que\\s+vem)?)`,
  '(?:daqui\\s+a|daqui|em|dentro\\s+de)\\s+\\d+\\s+(?:dias?|semanas?|mes(?:es)?)',
].map((p) => new RegExp(`\\b(?:${p})\\b`, 'g'));
const TIME_SPANS = [
  `(?:${SPAN_MARK}\\s+)?\\d{1,2}(?:h\\d{0,2}|:\\d{2})(?!\\w)${SPAN_PER}?`,
  `${SPAN_MARK}\\s+\\d{1,2}(?:\\s*horas?)?${SPAN_PER}?(?!\\s+[a-z]{3,}s\\b)(?![\\d.,:/])`,
  `\\d{1,2}(?:\\s*horas?)?${SPAN_PER}`,
  '(?:ao\\s+)?meio[\\s-]dia|(?:a\\s+)?meia[\\s-]noite',
  '(?:de|pela|na|a)\\s+(?:manha|tarde|noite|madrugada)',
].map((p) => new RegExp(`\\b(?:${p})`, 'g'));

// [{ a, b, type: 'date' | 'time' }] em ordem, sem sobreposição
export function temporalSpans(f) {
  const found = [];
  const collect = (list, type) =>
    list.forEach((re) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(f)) !== null) {
        if (!m[0].length) {
          re.lastIndex++;
          continue;
        }
        found.push({ a: m.index, b: m.index + m[0].length, type });
      }
    });
  collect(DATE_SPANS, 'date');
  collect(TIME_SPANS, 'time');
  found.sort((x, y) => x.a - y.a || y.b - x.b);
  const out = [];
  found.forEach((s) => {
    if (!out.length || s.a >= out[out.length - 1].b) out.push(s);
  });
  return out;
}

// trechos de contexto ("quando eu chegar em casa", "depois da aula"): não são assunto nem ação
function contextRanges(f) {
  const out = [];
  let m = GERUND_CONDITION_RE.exec(f) || PREP_CONTEXT_RE.exec(f);
  if (m) out.push([m.index, m.index + m[0].length]);
  const re = new RegExp(CONDITION_RE.source, 'g');
  while ((m = re.exec(f)) !== null) out.push([m.index, m.index + m[0].length]);
  return out;
}

const FIN_CUE = /r\$|\breais\b/;

function breakOnActions(sentence) {
  const f = fold(sentence);
  const spans = temporalSpans(f);
  const ctx = contextRanges(f);
  const fq = maskQuantities(f);
  FIN_KW.lastIndex = 0;
  const finCue = FIN_CUE.test(f) || count(FIN_KW, f) > 0;
  const words = [];
  const re = /\d+(?:[.,:]\d+)*|[a-z0-9$]+/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    const at = m.index;
    const t = { w: m[0], at, end: at + m[0].length };
    t.span = spans.find((s) => at >= s.a && at < s.b) || null;
    t.ctx = ctx.some(([a, b]) => at >= a && at < b);
    // número que pode ser dinheiro: fora de dia/hora e sem unidade ("3 vezes", "2 litros", "lista 3")
    t.money = /^\d/.test(t.w) && !t.span && !t.ctx && fq.slice(at, t.end).trim() !== '';
    // vírgula antes: quem decide é a separação por vírgula e "e", mais abaixo
    t.comma = words.length > 0 && f.slice(words[words.length - 1].end, at).includes(',');
    words.push(t);
  }
  const laterSpan = (i) => words.slice(i + 1).some((t) => t.span && !t.ctx && t.span !== words[i].span);
  const laterMoney = (i) => words.slice(i + 1).some((t) => t.money);

  const cuts = [];
  const fresh = () => ({ content: 0, date: false, time: false, action: false, motionOnly: false, money: false, label: false, contentBeforeMoney: false, afterMoney: false, endsWhen: false, whenAfterContent: false });
  let p = fresh();
  const cut = (at) => {
    if (at > 0 && cuts[cuts.length - 1] !== at) cuts.push(at);
    p = fresh();
  };

  words.forEach((t, i) => {
    if (t.ctx) return;
    const prev = words[i - 1];
    const prevW = prev ? prev.w : '';
    const next = words[i + 1];
    const nextIsSubject = !!next && !next.span && !/^\d/.test(next.w) && !FUNC.has(next.w);
    // depois de vírgula, "e" ou "ou": o valor e o dia do pedaço anterior não contam mais aqui
    if (t.comma || t.w === 'e' || t.w === 'ou') {
      p.money = false;
      p.label = false;
      p.afterMoney = false;
      p.endsWhen = false;
      p.whenAfterContent = false;
      p.date = false;
      p.time = false;
      p.content = 0;
      if (t.w === 'e' || t.w === 'ou') return;
    }
    // ----- dia ou hora -----
    if (t.span) {
      if (!prev || prev.span !== t.span) {
        // dia logo depois de dia é lista ("segunda quarta e sexta"); dia logo depois de hora, com o dia
        // do item já dito, é outro item ("segunda tenho médico às 8 TERÇA tenho prova")
        const sameCluster = !!(prev && prev.span && !prev.ctx) && !(t.span.type === 'date' && prev.span.type === 'time' && p.date);
        // "me lembrar em 4 dias" é aviso, não outro dia
        if (!sameCluster && i > 0 && !t.comma && !ATTR.has(prevW) && !/^(?:lembr|avis)/.test(prevW) && t.span.type === 'date' && p.date && p.content > 0) cut(t.span.a);
        if (t.span.type === 'date') p.date = true;
        else p.time = true;
        p.whenAfterContent = p.content > 0;
      }
      p.endsWhen = true;
      p.afterMoney = false;
      return;
    }
    // ----- valor -----
    if (t.w === 'r$') return;
    if (/^\d/.test(t.w)) {
      if (t.money) {
        const at = prev && prev.w === 'r$' ? prev.at : t.at;
        const before = prev && prev.w === 'r$' ? (words[i - 2] || {}).w || '' : prevW;
        // "30 no almoço 15 no uber": o segundo valor começa outro gasto
        if (finCue && p.money && p.label && !t.comma && !ATTR.has(before)) cut(at);
        p.contentBeforeMoney = p.content > 0;
        p.money = true;
        p.label = false;
        p.afterMoney = true;
      }
      return;
    }
    if (t.w === 'reais' || t.w === 'real') return;
    // ----- palavras -----
    const verb = isActionVerb(t.w) && i < words.length - 1;
    if (verb && i > 0 && !t.comma && !NO_BREAK_BEFORE.has(prevW)) {
      const subjectWithWhen = p.content > 0 && p.endsWhen && !p.action;
      if ((p.action && !p.motionOnly) || p.money || subjectWithWhen) cut(t.at);
    }
    if (FUNC.has(t.w) || LIGHT.has(t.w)) {
      // "paguei a luz 180 A água 95": depois do valor, o artigo já é o próximo gasto
      const article = ARTICLE.has(t.w) && nextIsSubject && !t.comma;
      if (article && p.afterMoney && p.contentBeforeMoney && finCue && laterMoney(i)) cut(t.at);
      else if (article && p.endsWhen && p.whenAfterContent && laterSpan(i)) cut(t.at);
      else if (!ARTICLE.has(t.w)) {
        p.endsWhen = false;
        p.afterMoney = false;
      }
      return;
    }
    if (!verb && !t.comma) {
      // assunto novo logo depois do valor ("mercado 50 reais FARMÁCIA 30 reais")
      if (p.afterMoney && p.contentBeforeMoney && finCue && laterMoney(i)) cut(t.at);
      // assunto novo logo depois do dia/hora ("reunião às 9 DENTISTA às 14")
      else if (p.endsWhen && p.whenAfterContent && laterSpan(i)) cut(t.at);
    }
    if (verb) {
      if (!p.action) {
        p.action = true;
        p.motionOnly = MOTION.has(t.w);
      } else if (p.motionOnly) p.motionOnly = false;
    }
    p.content++;
    if (p.money) p.label = true;
    p.endsWhen = false;
    p.afterMoney = false;
  });
  if (!cuts.length) return [sentence];
  const out = [];
  let last = 0;
  cuts.forEach((c) => {
    out.push(sentence.slice(last, c));
    last = c;
  });
  out.push(sentence.slice(last));
  return out.map((x) => x.trim()).filter(Boolean);
}

// o pedaço começa com uma ação? ("comprar…", "preciso ligar…", "paguei…")
const LEAD_IN = /^\s*(?:(?:eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|vou|quero|devo|nao\s+esquecer\s+de)\s+)*([a-z]+)\b/;
function startsWithAction(f) {
  const m = LEAD_IN.exec(f);
  return !!m && isActionVerb(m[1]);
}
// tem dia/hora e também um assunto próprio? ("quarta tenho que pagar o aluguel" sim; "às 20" não)
function hasWhenAndSubject(f) {
  const spans = temporalSpans(f);
  if (!spans.length) return false;
  let rest = f;
  spans.forEach((s) => {
    rest = rest.slice(0, s.a) + ' '.repeat(s.b - s.a) + rest.slice(s.b);
  });
  return (rest.match(/[a-z]{2,}/g) || []).some((w) => !FUNC.has(w) && !LIGHT.has(w));
}
// "15 no uber", "95 de água": valor seguido do nome do gasto
const amountFirst = (f) => /^\s*(?:r\$\s*)?\d[\d.,]*(?:\s+reais)?\s+(?:n[oa]s?|de|d[oa]s?|em|com|pr[oa]|para)\s+[a-z]/.test(f);

// "e", "também", "depois", "além disso" separam pedaços; "depois de/do/que" faz parte da frase
const SEP_WORD = '(?:(?:ne|alem\\s+disso|tambem|em\\s+seguida)\\s+|(?:ai\\s+)?depois\\s+(?!(?:de|d[oa]s?|que)\\b))';
const SEP_RE = new RegExp(`\\s*,\\s*(?:e\\s+)?${SEP_WORD}?|\\s+e\\s+${SEP_WORD}|\\s+${SEP_WORD}|\\s+e\\s+`, 'gi');

// Devolve uma lista de frases, cada uma com seus pedaços (um pedaço = um item)
export function splitGroups(text) {
  // protege decimais: "1.250" e "180,50"
  const protectedText = text
    .replace(/(\d)\.(\d)/g, '$1\u0001$2')
    .replace(/(\d),(\d)/g, '$1\u0002$2');
  const restore = (s) => s.replace(/\u0001/g, '.').replace(/\u0002/g, ',');
  const sentences = protectedText.split(/[.;!?\n]+/).map((s) => s.trim()).filter(Boolean);

  return sentences.map((whole) => {
    const out = [];
    breakOnActions(restore(whole)).forEach((sentence0, part) => {
      const sentence = sentence0.replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/(\d),(\d)/g, '$1\u0002$2');
      const start = out.length;
      // quebra em pedaços nas vírgulas e nos "e" / "além disso" / "também" / "depois"
      const pieces = [];
      const seps = [];
      // ", e paguei": a vírgula e o "e" juntos são um separador só
      // "né" no meio da fala também separa: "dobrar as roupas, né, arrumar o quarto"
      const f = fold(sentence);
      let last = 0;
      let m;
      SEP_RE.lastIndex = 0;
      while ((m = SEP_RE.exec(f)) !== null) {
        if (!m[0].length) {
          SEP_RE.lastIndex++;
          continue;
        }
        pieces.push(sentence.slice(last, m.index));
        seps.push(sentence.slice(m.index, m.index + m[0].length));
        last = m.index + m[0].length;
      }
      pieces.push(sentence.slice(last));

      let cur = pieces[0];
      for (let i = 1; i < pieces.length; i++) {
        const next = pieces[i];
        const cf = restore(fold(cur));
        const nf = restore(fold(next));
        const isNew =
          STARTERS.test(nf) ||
          startsWithAction(nf) ||
          // "uber 25 e 99 15": o 99 seguido de outro valor é o app, um gasto novo
          (hasMoney(cf) && /^\s*99\s+(?:pop\s+)?(?:r\$\s*)?\d/.test(nf)) ||
          (hasMoney(cf) && hasMoney(nf) && !startsWithNumber(nf) && !/^\s*\d+\s*centavos?/.test(nf)) ||
          // "30 no almoço e 15 no uber"
          (hasMoney(cf) && amountFirst(nf)) ||
          // "prova dia 25 e trabalho dia 27": cada lado tem o seu assunto e o seu dia
          (hasWhenAndSubject(cf) && hasWhenAndSubject(nf));
        if (isNew) {
          out.push(cur);
          cur = (/depois|seguida/.test(fold(seps[i - 1])) ? AFTER : '') + next;
        } else {
          cur = cur + seps[i - 1] + next;
        }
      }
      out.push(cur);
      if (part > 0) out[start] = HARD + out[start];
    });
    return out.map((s) => restore(s).trim()).filter((s) => s && s !== HARD && s !== AFTER);
  });
}

const MARKS_RE = new RegExp(`[${HARD}${AFTER}]`, 'g');

export function splitSegments(text) {
  return splitGroups(text)
    .flat()
    .map((s) => s.replace(MARKS_RE, ''));
}

// dia e hora ditos logo no começo da frase valem para tudo o que vem depois
// ("hoje às 22h lavar a louça arrumar o quarto"). Devolve o que foi dito no começo: { date, time }.
const LEAD_WORDS = /^\s*(?:(?:eu\s+)?(?:preciso|tenho\s+que|vou)\s+)?/;
function leadingWhen(raw) {
  const f = fold(raw || '');
  const spans = temporalSpans(f);
  let at = LEAD_WORDS.exec(f)[0].length;
  const got = { date: false, time: false };
  for (const s of spans) {
    if (f.slice(at, s.a).trim() !== '') break;
    got[s.type] = true;
    at = s.b;
  }
  return got.date || got.time ? got : null;
}

function mergeInto(target, extra, today) {
  if (extra.lead !== null && extra.lead !== undefined) {
    if (target.date) target.lead = extra.lead;
    else target.date = addDays(today, extra.lead);
  }
  if (extra.date && !target.date) target.date = extra.date;
  if (extra.time && !target.time && target.kind !== 'finance') {
    target.time = extra.time;
    target.times = extra.times && extra.times.length ? extra.times : [extra.time];
  }
  // "Tomar remédio. Todo dia às 8h": a repetição dita depois vale para o item anterior
  if (extra.rep && target.kind !== 'finance' && !target.repeat && extra.rep.freq) {
    const r = { ...extra.rep };
    let times = extra.times && extra.times.length ? extra.times : target.times && target.times.length ? target.times : ['08:00'];
    if (r.freq === 'monthly' && !r.day) r.day = Number((target.date || today).slice(8, 10));
    if (r.interval) times = intervalTimes(times[0], r.interval);
    target.repeat = r;
    target.times = [...new Set(times)].sort();
    target.time = target.times[0];
    target.lead = null;
    target.date = firstOccurrence(r, target.times, new Date());
  }
}

// "23 e 99" / "23 reais e 99" numa frase de gasto = R$ 23,99.
// Não junta quando: vem outro número depois ("uber 25 e 99 15"), é data ou hora ("dia 23 e 25",
// "às 10 e 30"), tem unidade depois ("2 e 30 horas") ou os dois lados têm o seu gasto ("luz 180 e 95 de água").
const CENTS_RE = /(\d+)(\s+rea(?:is|l))?\s+e\s+(\d{2})(?![\d.,]*\d)/gi;
const AFTER_NOT_CENTS = /^\s*(?:[.,]?\d|centavos?\b|h\b|hs?\b|horas?\b|min|minutos?\b|dias?\b|semanas?\b|meses\b|mes\b|anos?\b|%|\/|de\s+(?:${MONTH_RE})\b|pop\b|taxi\b|(?:r\$\s*)?\d)/;
export function joinCents(text) {
  return text.replace(CENTS_RE, (all, a, reais, b, off, whole) => {
    const before = fold(whole.slice(0, off));
    const after = fold(whole.slice(off + all.length));
    if (/[\d.,]$/.test(before)) return all; // "1.250 e 30": já tem casas
    if (/\b(?:dia|dias|as|ate|de|entre|das)\s*$/.test(before)) return all;
    if (AFTER_NOT_CENTS.test(after)) return all;
    const prev = before.split(/[,;.!?]|\s+e\s+/).pop();
    const next = after.split(/[,;.!?]|\s+e\s+/)[0];
    const kw = (t) => guessFinance(t, false).category !== 'Outros' && !/\b(?:gast\w*|passei|paguei|deixei|torrei)\b/.test(t) ? guessFinance(t, false).label || t.trim() : null;
    const k1 = kw(prev);
    const k2 = kw(next);
    if (k1 && k2 && k1 !== k2) return all;
    return `${a},${b}${reais ? ' reais' : ''}`;
  });
}

// O texto como o interpretador lê: sem vícios de fala, com números em dígitos e horas no formato "3:30"
export function normalizeSpeech(text) {
  return joinCents(canonSpeech(wordsToNumbers(cleanSpeech(text || ''))));
}

// verbo de dinheiro no começo do pedaço
const LEAD_FIN_VERB = /^\s*(?:eu\s+)?(?:ja\s+)?(gastei|paguei|comprei|recebi|transferi|depositei|ganhei|vendi|vou\s+pagar|vou\s+receber|tenho\s+que\s+pagar|preciso\s+pagar|pagar|receber)\b/;

export function parseInput(text, today, now = new Date(), opts = {}) {
  // 1.13.1: a fala é arrumada antes (vícios de fala, correções ditas na hora, horas e dias falados)
  const src = normalizeSpeech(text);
  const items = [];
  splitGroups(src).forEach((group) => {
    const start = items.length;
    let ctx = null; // verbo do primeiro gasto da frase ("gastei", "vou pagar"): vale para os seguintes
    let pending = null; // dia/hora ditos sozinhos antes do primeiro item ("amanhã, lavar o carro")
    group.forEach((seg0, gi) => {
      const hard = seg0.includes(HARD);
      const after = seg0.includes(AFTER);
      const seg = seg0.replace(MARKS_RE, '');
      const it = parseSegment(seg, today, undefined, now, ctx ? { ...opts, ctx } : opts);
      const v = LEAD_FIN_VERB.exec(fold(seg));
      if (v) ctx = v[1];
      if (it.empty) {
        // só o dia/hora, e ainda vem o assunto na mesma frase: vale para o que vem depois
        if (items.length === start && gi < group.length - 1) pending = pending || it;
        else if (items.length) mergeInto(items[items.length - 1], it, today);
        return;
      }
      if (hard) it.hard = true;
      if (after) it.after = true;
      if (pending && items.length === start) {
        const mine = { date: !!it.date, time: !!it.time };
        mergeInto(it, pending, today);
        it.leadSaid = { date: !mine.date && !!it.date, time: !mine.time && !!it.time };
        if (it.saidTime && pending.date && pending.date !== today) {
          it.time = afternoonIfBare(it.saidTime, fold(it.raw || ''));
          it.times = [it.time];
        }
      }
      items.push(it);
    });
    // "às 22h dobrar a roupa e arrumar o quarto": dia e hora valem para as tarefas seguintes
    let carry = null;
    let lead = null; // o que foi dito logo no começo da frase
    let lastDate = null;
    items.slice(start).forEach((i, n) => {
      if (n === 0) {
        const said = i.leadSaid || leadingWhen(i.raw);
        if (said && i.kind !== 'finance' && !i.repeat) lead = { date: said.date ? i.date : null, time: said.time ? i.time : null, times: said.time ? i.times : [] };
      }
      // item separado só pela leitura da frase: dia e hora do anterior não passam para ele,
      // a não ser os ditos no começo da frase
      if (n > 0 && i.hard) carry = lead;
      if (i.kind === 'finance' || i.repeat) return;
      if (i.date || i.time) {
        // "amanhã tem reunião às 9 dentista às 14": só a hora mudou, o dia continua
        if (i.time && !i.date && lastDate) {
          i.date = lastDate;
          if (i.saidTime && lastDate !== today) {
            i.time = afternoonIfBare(i.saidTime, fold(i.raw || ''));
            i.times = [i.time];
          }
        }
        carry = { date: i.date, time: i.time, times: i.times };
      } else if (carry) {
        i.date = carry.date;
        // "… e depois buscar o carro": é no mesmo dia, mas não na mesma hora
        if (!i.after && carry.time) {
          i.time = carry.time;
          i.times = carry.times;
        }
      }
      if (i.date) lastDate = i.date;
    });
    // "paguei luz 180 e água 95 ontem": a data dita no fim vale para a lista toda
    const fin = items.slice(start).filter((i) => i.kind === 'finance');
    const last = fin[fin.length - 1];
    if (last && last.explicitDate && !last.repeat) {
      fin.forEach((i) => {
        if (!i.explicitDate && !i.repeat) {
          i.date = last.date;
          i.status = last.status;
        }
      });
    }
  });
  // só o horário, sem o dia: é hoje. Se o horário de hoje já passou, a confirmação pergunta (hoje ou amanhã)
  const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  items.forEach((i) => {
    if (i.kind !== 'finance' && !i.repeat && i.time && !i.date) {
      i.date = today;
      i.autoToday = true;
      if (i.time <= hm) i.askDay = true;
    }
  });
  items.forEach((i) => {
    delete i.explicitDate;
    delete i.hard;
    delete i.after;
    delete i.saidTime;
    delete i.leadSaid;
    if (!opts.marks) {
      delete i.autoToday;
      delete i.periodTime;
    }
  });
  return items;
}

// ---------- avisos automáticos ----------

// Quantos dias antes avisar, conforme a área e o nível de importância dela.
// Se a pessoa disse ("me lembrar 4 dias antes"), usa isso mais o próprio dia.
const OFFSETS = {
  study: { alta: [14, 7, 3, 1, 0], media: [7, 3, 1, 0], baixa: [1, 0] },
  task: { alta: [1, 0], media: [0], baixa: [0] },
  finance: { alta: [3, 1, 0], media: [1, 0], baixa: [0] },
};

export function planOffsets(kind, lead, daysUntil, level = 'media') {
  let base;
  if (lead !== null && lead !== undefined) base = [lead, 0];
  else base = (OFFSETS[kind] || OFFSETS.task)[level] || [0];
  return [...new Set(base)].filter((d) => d >= 0 && d <= daysUntil).sort((a, b) => b - a);
}
