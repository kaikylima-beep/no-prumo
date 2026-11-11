// Interpretador de frases em português do Brasil.
// Recebe o texto falado/digitado e devolve uma lista de itens prontos para salvar:
//   { kind: 'task' | 'finance' | 'study', title, date, time, lead,
//     amount, type, category, status, repeat, raw }
// Funciona 100% no aparelho, sem internet.

import { toISO, fromISO, parseMoney } from './utils.js';
import { intervalTimes, firstOccurrence } from './recurrence.js';

export const CATEGORIES = {
  out: ['Cartão', 'Contas', 'Alimentação', 'Transporte', 'Saúde', 'Estudos', 'Lazer', 'Parcelas', 'Outros'],
  in: ['Salário', 'Bônus', 'Extra', 'Investimentos', 'Outros'],
};

// ---------- utilidades de texto ----------

// Minúsculas e sem acento, mantendo o MESMO tamanho do texto original
// (assim as posições coincidem e dá para recortar os dois ao mesmo tempo).
export function fold(s) {
  return s
    .toLowerCase()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

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
    // dentro de cada grupo: centenas > dezenas > unidades
    const rankOf = (v) => (v === 'MIL' ? 4 : v >= 100 ? 3 : v >= 20 ? 2 : 1);
    let lastRank = rankOf(v0);
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

function extractDate(c, today, preferPast) {
  let m;

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

  if (c.take(/\bdepois\s+de\s+amanha\b/)) return addDays(today, 2);
  if (c.take(/\banteontem\b/)) return addDays(today, -2);
  if (c.take(/\bontem\b/)) return addDays(today, -1);
  if (c.take(/\bamanha\b/)) return addDays(today, 1);
  if (c.take(/\bhoje\b/)) return today;

  m = c.take(/\b(?:daqui\s+a|em)\s+(\d+)\s+(dias?|semanas?)\b/);
  if (m) return addDays(today, Number(m[1]) * (m[2].startsWith('semana') ? 7 : 1));

  m = c.take(/\bha\s+(\d+)\s+dias?\b/);
  if (m) return addDays(today, -Number(m[1]));

  if (c.take(/\b(?:semana\s+que\s+vem|proxima\s+semana)\b/)) return addDays(today, 7);

  m = c.take(/\b(?:(?:na|no|nesta|neste|proxima|proximo)\s+)?(segunda|terca|quarta|quinta|sexta)(?:-feira|\s+feira)?(?:\s+que\s+vem|\s+proxima)?\b|\b(?:(?:no|neste|proximo)\s+)?(sabado|domingo)\b/);
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
  if (period === 'manha' && h === 12) return 0;
  return h;
}

// palavras que indicam o horário: "às", "a partir das", "pras"...
// inclui horários aproximados: "lá para umas 10", "por volta das 8", "umas 9"
const TIME_MARK =
  '(?:la\\s+(?:para|pra|pelas)(?:\\s+(?:as|umas))?|(?:para|pra)\\s+umas|por\\s+volta\\s+d[ao]s?|perto\\s+d[ao]s?|pelas|umas|a\\s+partir\\s+d[ao]s?|desde\\s+as|ate\\s+as|para\\s+as|pras|as|a|das)';

function extractTime(c) {
  let m;
  if (c.take(/\b(?:ao\s+)?meio[\s-]dia\b/)) return '12:00';
  if (c.take(/\b(?:a\s+)?meia[\s-]noite\b/)) return '00:00';

  // 19h, 19h30, 19:30 (com ou sem "às")
  m = c.take(
    new RegExp(`(?:\\b${TIME_MARK}\\s+)?\\b(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))(?!\\w)(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite))?`)
  );
  if (!m) {
    // "às 19 horas", "lá para umas 10 horas": com a palavra de horário e "horas", é horário
    m = c.take(new RegExp(`\\b${TIME_MARK}\\s+(\\d{1,2})()()\\s*horas?\\b(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite))?`));
  }
  if (!m) {
    // "às 7 da noite", "às 19". Sem "às", "2 horas" é duração, não horário.
    m = c.take(
      new RegExp(
        `\\b${TIME_MARK}\\s+(\\d{1,2})()()(?:\\s*horas?)?(?:\\s+e\\s+(\\d{1,2})\\s*min\\w*)?(?:\\s+da\\s+(manha|tarde|noite))?(?=\\s*(?:$|[,.;!?]|e\\s+(?:as\\s+)?\\d|(?:hoje|amanha|no|na|nos|nas|em|pra|para|com|todo|toda|todos|todas|de\\s+(?:hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)|eu|tenho|preciso|vou|devo|que|[a-z]+(?:ar|er|ir))\\b))`
      )
    );
  }
  if (!m) {
    // "7 da noite", "3 horas da tarde", "8h da manhã" sem "às": com o período, é sempre horário
    m = c.take(/\b(\d{1,2})()()(?:\s*horas?)?(?:\s+e\s+(\d{1,2})\s*min\w*)?\s+da\s+(manha|tarde|noite)\b/);
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
  [/\b(?:bem\s+)?cedo(?:inho)?\b/, '07:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa|logo\s+de)\s+manha(?:zinha)?\b/, '08:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa)\s+tarde\b/, '14:00'],
  [/\b(?:de|pela|na|a|nesta|esta|essa)\s+noite(?:zinha)?\b/, '20:00'],
  [/\b(?:de|na|pela)\s+madrugada\b/, '05:00'],
];

function extractPeriod(c) {
  let found = null;
  for (const [re, t] of PERIODS) {
    if (c.take(re) && !found) found = t;
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
const LIST_RE = new RegExp(
  `\\b(?:(todas?|todos?)\\s+(?:as\\s+|os\\s+)?)?(?:${ART}\\s+)?(${WD})((?:\\s*(?:,|\\be\\b)\\s*(?:${ART}\\s+)?(?:${WD}))*)`
);
const RANGE_RE = new RegExp(`\\b(?:de\\s+)?(${WD})\\s+a\\s+(${WD})\\b`);

const wdIndex = (token) => WD_INDEX[token.slice(0, 3)];
const wdTokens = (text) => (text.match(new RegExp(WD, 'g')) || []).map(wdIndex);

function extractRepeat(c, today, now) {
  let m;
  // mensal: "todo dia 5", "todo mês", "mensalmente"
  m = c.take(/\b(?:todo\s+(?:santo\s+)?dia\s+(\d{1,2})(?:\s+de\s+(?:todo|cada)\s+mes)?|todo\s+mes|todos\s+os\s+meses|mensal(?:mente)?|por\s+mes|mensalidade\s+de)\b/);
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
  const everyWeek = c.take(/\b(?:toda\s+semana|todas\s+as\s+semanas|semanalmente|uma\s+vez\s+por\s+semana)\b/);

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

function lastLooseNumber(f) {
  const re = /\b(\d[\d.,]*)\b/g;
  let last = null;
  let m;
  while ((m = re.exec(f)) !== null) last = m;
  return last;
}

function extractLooseNumber(c) {
  const last = lastLooseNumber(c.f);
  if (!last) return null;
  c.cutRange(last.index, last.index + last[0].length);
  return toAmount(last[1]);
}

// ---------- classificação ----------

const FIN_KW = /\b(gastei|gasto|gastos|paguei|pagar|pago|pagamento|conta|contas|fatura|cartao|boleto|parcela|prestacao|financiamento|aluguel|condominio|luz|energia|agua|internet|mercado|supermercado|uber|99|taxi|celular|telefone|gas|botijao|restaurante|pizza|cinema|netflix|spotify|remedio|consulta|dentista|gasolina|combustivel|ifood|lanche|almoco|jantar|farmacia|academia|assinatura|compras|comprei|recebi|receber|recebo|salario|bonus|renda|freela|deposito|pix|transferencia|reais|real|valor|iptu|ipva|mensalidade)\b/g;
const FIN_STRONG = /\b(salario|bonus|aluguel|fatura|boleto|gastei|paguei|recebi|cartao|parcela|pix)\b/g;
const INCOME_KW = /\b(recebi|receber|recebo|salario|bonus|renda|freela|freelance|deposito|rendimentos?|reembolso|vendi|dividendos?|decimo\s+terceiro)\b/;
const STUDY_KW = /\b(prova|provas|teste|exame|seminario|apresentacao|estudar|estudo|estudos|materias?|aulas?|simulados?|revisar|revisao|tcc|monografia|relatorio|laboratorio|entrega|entregar|faculdade|trabalho\s+de|lista\s+de\s+exercicios|exercicios|artigo|defesa|capitulo)\b/;
const FUTURE_INTENT = /\b(preciso|tenho\s+que|tenho\s+de|nao\s+esquecer|vou|pagar|receber|vence|vencimento|a\s+pagar|fazer\s+(?:o|um|uma)\s+(?:pix|transferencia|deposito)|mandar|transferir|depositar)\b/;
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

const LEAD_RE = /^(?:[\s,.;:!?-]|\b(?:e|ai|entao|tambem|alem\s+disso|depois|eu|preciso(?:\s+de)?|tenho\s+que|tenho\s+de|tenho|vou|quero|devo|nao\s+esquecer\s+de|nao\s+esquece\s+de|lembrete(?:\s+de)?|anot\w+|adicion\w+|colocar|coloca|um|uma|para|pra|que|de|da|do)\b)+/;
const LEAD_FIN_RE = /^(?:[\s,.;:!?-]|\b(?:e|eu|fazer|faz|fiz|mandar|manda|mandei|enviar|enviei|preciso(?:\s+de)?|tenho\s+que|vou|devo|gastei|paguei|comprei|recebi|transferi|vou\s+receber|vou\s+pagar|tenho\s+que\s+pagar|preciso\s+pagar|pagar|receber|pago|recebo|valor|total|de|do|da|no|na|em|um|uma|o|a|com|ai|meu|minha)\b)+/;
const TAIL_RE = /(?:[\s,.;:!?-]|\b(?:pro|pra|para|no|na|em|ate|de|do|da|dia|e|que|vence|vencimento|o|a|os|as|ai|com|as)\b)+$/;

function finishTitle(c, fin) {
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 12) {
    changed = false;
    if (c.del(fin ? LEAD_FIN_RE : LEAD_RE)) changed = true;
    if (c.del(TAIL_RE)) changed = true;
  }
  let s = c.o.replace(/\s+/g, ' ').trim();
  // 1.12.3: o valor sai do meio e deixa duas preposições juntas ("transferência de pra mãe")
  s = s.replace(/\b(?:de|do|da)\s+(pra|pro|para)\b/gi, '$1');
  // "pro João" sozinho no título fica "Para João"
  if (fin) s = s.replace(/^(?:pro|pra)\b/i, 'para');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
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

const CONDITION_RE =
  /\b(?:quando|assim\s+que|depois\s+que|logo\s+que|antes\s+de)\s+(?:eu\s+)?(?:chegar|sair|voltar|acordar|terminar|levantar|estiver|for|dormir)\b(?:\s+(?!(?:eu\s+)?(?:tenho|preciso|vou|devo|quero)\b)(?![a-z]+(?:ar|er|ir)\b)[^\s,]+){0,4}/;

// 1.12.3: contexto no gerúndio no começo da frase não é o assunto: "chegando em casa eu tenho
// que lavar o carro", "saindo do trabalho preciso passar no mercado". Só sai quando depois dele
// vem o pedido (tenho que, preciso, vou… ou um verbo no infinitivo).
const GERUND_CONDITION_RE =
  /^\s*(?:(?:e|ai|entao)\s+)?(?!quando\b)(?:indo|[a-z]{2,}(?:ando|endo|indo))\b(?:\s+(?!(?:eu\s+)?(?:tenho|preciso|vou|devo|quero)\b)(?![a-z]+(?:ar|er|ir)\b)[^\s,]+){0,4}(?=\s*,?\s*(?:eu\s+)?(?:tenho|preciso|vou|devo|quero|[a-z]+(?:ar|er|ir))\b)/;

export function parseSegment(seg, today, forceKind, now = new Date(), opts = {}) {
  const f0 = fold(seg);
  const c = makeCutter(seg);
  const pastVerb = PAST_FIN_VERB.test(f0) || /\b(ontem|anteontem|ha\s+\d+\s+dias?)\b/.test(f0);

  const R = extractRepeat(c, today, now);
  const rep = R.rep;
  const monthly = !!rep && rep.freq === 'monthly';
  const lead = extractLead(c);
  const rel = extractRelative(c, now);
  let times = rel ? [rel.time] : extractTimes(c);
  const period = extractPeriod(c);
  if (!times.length && (period || R.periodTime)) times = [period || R.periodTime];
  let date = R.date || (rel && rel.date) || extractDate(c, today, pastVerb);
  const explicitDate = !!date;
  let amount = extractAmount(c);

  const finScore = count(FIN_KW, f0) + count(FIN_STRONG, f0);
  const looseNum = lastLooseNumber(c.f);
  // 1.12.3: o contexto do começo ("voltando da faculdade…") não decide a área nem o verbo
  const fAsk = f0.replace(GERUND_CONDITION_RE, ' ').trim();
  const startsWithTaskVerb = TASK_VERB.test(fAsk) || (finScore === 0 && INFINITIVE.test(fAsk));

  let kind = forceKind;
  if (!kind) {
    if (amount !== null) kind = 'finance';
    else if (STUDY_KW.test(fAsk)) kind = 'study';
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
    const income = INCOME_KW.test(f0);
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
    let title = g.label;
    if (!title) {
      title = finishTitle(c, true);
      if (opts.short) title = abbreviate(title);
    }
    if (!title) title = income ? 'Entrada' : 'Despesa';
    const d = date || today;
    let status;
    if (PAST_FIN_VERB.test(f0)) status = 'paid';
    else if (d > today) status = 'pending';
    else if (FUTURE_INTENT.test(f0) || INTENT_START.test(f0) || monthly) status = 'pending';
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
  // "às 10" dito hoje depois das 10h: quer dizer 22h (se não falou "da manhã")
  if (times.length && !rep && (!date || date === today) && !/\bmanha\b|\bcedo\b/.test(f0) && !rel) {
    const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    times = times.map((t) => {
      const h = Number(t.slice(0, 2));
      return h < 12 && t <= hm ? `${pad2(h + 12)}${t.slice(2)}` : t;
    });
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
// Regra geral: um verbo de ação começa um item novo quando o pedaço anterior já tem
// a sua própria ação (ou um valor) e o verbo não depende da palavra antes dele
// ("para estudar", "de pagar", "vou comprar" continuam juntos).
const ACTION_VERBS = new Set(
  (
    'lavar limpar arrumar ligar marcar levar buscar trocar consertar fazer ler separar organizar tirar cortar regar ' +
    'cozinhar varrer devolver enviar mandar responder agendar visitar tomar guardar estender dobrar montar instalar ' +
    'imprimir escrever correr treinar caminhar comprar pagar estudar revisar entregar terminar resolver cancelar ' +
    'renovar pegar depositar sacar transferir preencher assinar praticar ensaiar apresentar assistir jogar baixar ' +
    'atualizar alimentar passear lembrar avisar paguei gastei comprei recebi transferi depositei'
  ).split(' ')
);
const NO_BREAK_BEFORE = new Set(
  (
    'para pra pro pras pros de da do das dos a ao aos e ou que sem pode podem vou vai vamos preciso precisa tenho tem ' +
    'temos quero queria devo deve ir antes depois apos ate pelo pela em no na nao nem me te se lembrar lembra lembre ' +
    'esquecer esquece comecar comeca terminar acabar tentar ajudar mandar deixar'
  ).split(' ')
);
export const HARD = '\u0004'; // marca de item separado por verbo (sem pontuação)

function breakOnActions(sentence) {
  const f = fold(sentence);
  const words = [];
  const re = /[a-z0-9$]+/g;
  let m;
  while ((m = re.exec(f)) !== null) words.push({ w: m[0], at: m.index });
  const cuts = [];
  let hasAction = false;
  let from = 0;
  words.forEach((t, i) => {
    const isAction = ACTION_VERBS.has(t.w);
    // um valor em dinheiro também é "o assunto" do pedaço ("uber 25 lavar o carro"); dia e hora não
    const piece = f
      .slice(from, t.at)
      .replace(/\b(?:d?as|umas|pelas|ate|volta\s+das)\s+\d{1,2}\b|\b\d{1,2}\s*(?:horas?|h)\b|\b\d{1,2}\s+da\s+(?:manha|tarde|noite)\b/g, ' ');
    if (isAction && i > 0 && (hasAction || hasMoney(piece)) && !NO_BREAK_BEFORE.has(words[i - 1].w) && i < words.length - 1) {
      cuts.push(t.at);
      from = t.at;
    }
    if (isAction) hasAction = true;
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
    breakOnActions(whole).forEach((sentence, part) => {
    const start = out.length;
    // quebra em pedaços nas vírgulas e nos "e" / "além disso" / "também" / "depois"
    const pieces = [];
    const seps = [];
    // ", e paguei": a vírgula e o "e" juntos são um separador só
    // "né" no meio da fala também separa: "dobrar as roupas, né, arrumar o quarto"
    const re = /\s*,\s*(?:(?:e|ne|alem\s+disso|tambem|depois)\s+)?|\s+(?:e|ne|alem\s+disso|tambem|depois)\s+/gi;
    const f = fold(sentence);
    let last = 0;
    let m;
    while ((m = re.exec(f)) !== null) {
      pieces.push(sentence.slice(last, m.index));
      seps.push(sentence.slice(m.index, m.index + m[0].length));
      last = m.index + m[0].length;
    }
    pieces.push(sentence.slice(last));

    let cur = pieces[0];
    for (let i = 1; i < pieces.length; i++) {
      const next = pieces[i];
      const cf = fold(cur);
      const nf = fold(next);
      const isNew =
        STARTERS.test(nf) ||
        // "uber 25 e 99 15": o 99 seguido de outro valor é o app, um gasto novo
        (hasMoney(cf) && /^\s*99\s+(?:pop\s+)?(?:r\$\s*)?\d/.test(nf)) ||
        (hasMoney(cf) && hasMoney(nf) && !startsWithNumber(nf) && !/^\s*\d+\s*centavos?/.test(nf));
      if (isNew) {
        out.push(cur);
        cur = next;
      } else {
        cur = cur + seps[i - 1] + next;
      }
    }
    out.push(cur);
    if (part > 0) out[start] = HARD + out[start];
    });
    return out.map((s) => restore(s).trim()).filter((s) => s && s !== HARD);
  });
}

export function splitSegments(text) {
  return splitGroups(text)
    .flat()
    .map((s) => s.replace(HARD, ''));
}

// dia ou hora logo no começo da frase vale para tudo o que vem depois ("hoje às 22h lavar a louça arrumar o quarto")
const LEADING_WHEN = /^\s*(?:(?:eu\s+)?(?:preciso|tenho\s+que|vou)\s+)?(?:hoje|amanha|depois\s+de\s+amanha|as\s+\d|a\s+partir|dia\s+\d|\d{1,2}(?:h|:)|(?:na|no|nesta|neste|nessa|nesse|essa|este|proxima|proximo)?\s*(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)|de\s+manha|a\s+tarde|a\s+noite|hoje\s+a\s+noite)\b/;

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
const CENTS_RE = /(\d+)(\s+reais)?\s+e\s+(\d{2})(?![\d.,]*\d)/gi;
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

export function parseInput(text, today, now = new Date(), opts = {}) {
  const src = joinCents(wordsToNumbers(text || ''));
  const items = [];
  splitGroups(src).forEach((group) => {
    const start = items.length;
    group.forEach((seg0) => {
      const hard = seg0.startsWith(HARD);
      const seg = hard ? seg0.slice(1) : seg0;
      const it = parseSegment(seg, today, undefined, now, opts);
      if (hard && !it.empty) it.hard = true;
      if (it.empty) {
        if (items.length) mergeInto(items[items.length - 1], it, today);
        return;
      }
      items.push(it);
    });
    // "às 22h dobrar a roupa e arrumar o quarto": dia e hora valem para as tarefas seguintes
    let carry = null;
    let leading = false;
    items.slice(start).forEach((i, n) => {
      if (n === 0 || (i.hard && !leading)) {
        // item separado só pelo verbo: dia e hora dele não passam para os outros,
        // a não ser que tenham sido ditos no começo da frase
        leading = n === 0 ? LEADING_WHEN.test(fold(i.raw || '')) : leading;
        if (n > 0) carry = null;
      }
      if (i.kind === 'finance' || i.repeat) return;
      if (i.date || i.time) carry = { date: i.date, time: i.time, times: i.times };
      else if (carry) {
        i.date = carry.date;
        i.time = carry.time;
        i.times = carry.times;
      }
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
      if (i.time <= hm) i.askDay = true;
    }
  });
  items.forEach((i) => {
    delete i.explicitDate;
    delete i.hard;
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
