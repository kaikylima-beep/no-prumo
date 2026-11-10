// Arruma a fala antes de interpretar (1.13.1).
// É o que os apps de voz chamam de "normalização": o texto falado vira o texto que se escreveria.
//   1. tira vícios de fala e pedidos ao app ("é então tipo…", "anota aí…", "…né")
//   2. entende a correção dita na hora ("amanhã não, sexta")
//   3. escreve horas e dias falados no formato que o interpretador lê
//      ("três e meia da tarde" → "3:30 da tarde", "quinze para as oito" → "às 7:45")
// Tudo são regras gerais de português; nada aqui mira uma frase ou uma palavra mal ouvida.
// Funciona no aparelho, sem internet.

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

// Procura no texto sem acento e troca no original. fn devolve o texto novo, ou null para manter.
function subF(text, re, fn) {
  const f = fold(text);
  let out = '';
  let last = 0;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(f)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const rep = typeof fn === 'function' ? fn(m, f) : fn;
    if (rep === null || rep === undefined) continue;
    out += text.slice(last, m.index) + rep;
    last = m.index + m[0].length;
  }
  return out + text.slice(last);
}

// ---------- 1. vícios de fala e pedidos ao app ----------

// palavras de apoio no começo da fala: "é", "ó", "então", "olha", "bom", "tipo", "deixa eu ver"…
// (com acento de propósito: "é" e "ó" não são "e" e "o")
const START_FILLER =
  /^[\s,]*(?:é+h?|eh+|ó|olha(?:\s+s[óo])?|bom(?!\s+dia)|ent[ãa]o|a[íi]|da[íi]|tipo(?:\s+assim)?|assim(?!\s+que)|enfim|pois\s+é|veja(?:\s+bem)?|deixa\s+eu\s+(?:ver|pensar)|deixa\s+ver|vamos\s+(?:ver|l[áa])|(?:é\s+)?o\s+seguinte|seguinte|ah+|hu+m+|hm+|ahn?|h[ãa]|ã+|oi|ol[áa]|opa|e\s+a[íi]|bom\s+dia|boa\s+tarde|boa\s+noite|t[áa]\s+bom|certo|ok|beleza|por\s+favor|por\s+gentileza)(?=[\s,]+\S)[\s,]*/;

// pedidos ao app no começo: "anota aí", "cria um lembrete pra", "eu queria que você me lembrasse de"
const OBJ = '(?:lembrete|tarefa|compromisso|anotacao|nota|aviso|alarme|evento|item)';
const TO_ME = '(?:\\s+(?:ai|pra\\s+mim|para\\s+mim|por\\s+favor))';
const WRAPPERS = [
  // "eu queria que você me lembrasse de…", "preciso que você anote…"
  /^\s*(?:eu\s+)?(?:queria|gostaria|quero|preciso|precisava)\s+que\s+(?:voce|vc|tu)\s+(?:me\s+)?(?:lembr\w+|avis\w+|anot\w+|marc\w+|agend\w+)\s+(?:(?:de|que|pra|para|d[ao])\s+)?/,
  // "gostaria de marcar…"
  /^\s*(?:eu\s+)?(?:gostaria|queria)\s+de\s+(?=\S)/,
  // "preciso lembrar de…", "tenho que lembrar de…"
  /^\s*(?:eu\s+)?(?:preciso|tenho\s+que|tenho\s+de|devo|vou|quero)\s+(?:me\s+)?lembrar\s+(?:de|d[ao]s?|que)\s+/,
  // "não posso esquecer de…"
  /^\s*(?:eu\s+)?nao\s+(?:posso|pode|podemos|vou|devo|quero)\s+(?:me\s+)?esquecer\s+(?:(?:de|d[ao]s?|que)\s+)?/,
  // "anota aí…", "adiciona uma tarefa…", "cria um lembrete pra…", "agenda…"
  new RegExp(
    `^\\s*(?:anot[ae]r?|adicion[ae]r?|agend[ae])${TO_ME}*(?:\\s+(?:um|uma|o|a|na|no)(?:\\s+(?:novo|nova))?)?(?:\\s+${OBJ})?(?:\\s+(?:de|pra|para|que))?\\s+(?=\\S)(?!d[aeo]s?\\b)`
  ),
  // verbos que também são tarefa ("marca", "coloca", "faz"): só com "aí", "pra mim" ou "um lembrete"
  new RegExp(
    `^\\s*(?:marc[ae]|marque|cri[ae]|registr[ae]|coloc[ae]|coloque|bot[ae]|poe|ponha|faz|faca|salv[ae]|lanc[ae]|grav[ae]|inclu[ia])(?:${TO_ME}+(?:\\s+(?:um|uma|o|a|na|no)(?:\\s+(?:novo|nova))?)?(?:\\s+${OBJ})?|${TO_ME}*\\s+(?:um|uma|o|a|na|no)(?:\\s+(?:novo|nova))?\\s+${OBJ})(?:\\s+(?:de|pra|para|que))?\\s+(?=\\S)`
  ),
  // "nova tarefa…", "lembrete…"
  new RegExp(`^\\s*(?:nov[oa]\\s+${OBJ}|lembrete)(?:\\s+(?:de|pra|para|que))?\\s+(?=\\S)`),
];

// no fim da fala: "…né", "…tá", "…viu", "…por favor"
const END_FILLER = /[\s,]+(?:n[ée]|viu|t[áa]\s+bom|t[áa]|t[áa]\s+ligado|entendeu|beleza|ok|valeu|hein|por\s+favor|por\s+gentileza)\s*$/;

// no meio: sons de hesitação e "tipo assim"
const MID_FILLER = /(^|[\s,])(?:hu+m+|hm+|ah+|ahn|h[ãa]|ã+|é{2,}|tipo\s+assim|sei\s+l[áa]|por\s+favor|por\s+gentileza)(?=[\s,]|$)/g;

// "tipo" só é vício quando não é "um tipo de…"
const BEFORE_TIPO = new Set('o a um uma esse essa este esta aquele que qual do da no na algum outro mesmo cada todo todos varios de'.split(' '));

function cleanClause(clause) {
  let s = clause;
  // hesitações no meio
  s = s.replace(MID_FILLER, '$1');
  // "tipo" e palavra repetida ("eu eu preciso preciso")
  const words = s.split(/(\s+)/);
  const kept = [];
  let prev = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\s*$/.test(w)) {
      kept.push(w);
      continue;
    }
    const k = fold(w).replace(/[^a-z0-9]/g, '');
    const next = fold(words[i + 2] || '').replace(/[^a-z0-9]/g, '');
    const dropSpace = () => {
      if (kept.length && /^\s*$/.test(kept[kept.length - 1])) kept.pop();
    };
    if (k === 'tipo' && !BEFORE_TIPO.has(prev) && !/^d[aeo]s?$/.test(next) && next) {
      dropSpace();
      continue;
    }
    if (k && k === prev && /^[a-z]+$/.test(k) && !/[,.;!?]$/.test(words[i - 2] || '')) {
      dropSpace();
      continue;
    }
    kept.push(w);
    prev = k;
  }
  s = kept.join('');
  // começo: palavras de apoio e pedidos ao app, quantas vezes aparecerem
  for (let guard = 0; guard < 8; guard++) {
    let m = START_FILLER.exec(s.toLowerCase());
    if (m) {
      s = s.slice(m[0].length);
      continue;
    }
    const f = fold(s);
    m = null;
    for (const re of WRAPPERS) {
      m = re.exec(f);
      if (m) break;
    }
    if (!m) break;
    s = s.slice(m[0].length);
  }
  // fim
  for (let guard = 0; guard < 4; guard++) {
    const m = END_FILLER.exec(s.toLowerCase());
    if (!m || m.index === 0) break;
    s = s.slice(0, m.index);
  }
  return s;
}

// Tira os vícios de fala. Cada frase (até o ponto) é limpa separada.
export function cleanSpeech(text) {
  // "1.800,00" não é fim de frase
  return String(text || '')
    .replace(/(\d)\.(\d)/g, '$1\u0001$2')
    .split(/([.;!?\n]+)/)
    .map((part, i) => (i % 2 ? part : (i && /\S/.test(part) ? ' ' : '') + cleanClause(part)))
    .join('')
    .replace(/\u0001/g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------- 2. correção dita na hora ----------
// "amanhã não, sexta" → "sexta"; "às 3, quer dizer, às 4" → "às 4"; "50, ou melhor, 60" → "60".
// Só vale quando os dois lados são do mesmo tipo (dia com dia, hora com hora, número com número).

const WEEK = '(?:segunda|terca|quarta|quinta|sexta)(?:-feira|\\s+feira)?|sabado|domingo';
const DAY_W = `(?:hoje|amanha|depois\\s+de\\s+amanha|${WEEK}|dia\\s+\\d{1,2})`;
const DAY_PREP = '(?:(?:n[ao]|para|pra|pro|ate)\\s+)?';
const HOUR_W = '(?:as|a|para\\s+as|pras)\\s+\\d{1,2}(?::\\d{2}|h\\d{0,2})?(?:\\s+horas?)?(?:\\s+d[ae]\\s+(?:manha|tarde|noite|madrugada))?';
const REPAIR = '(?:nao|quer\\s+dizer|ou\\s+melhor|alias|digo|minto|na\\s+verdade|perdao|desculpa|corrigindo|melhor)';
const SEP = '\\s*,?\\s+';

const REPAIR_DAY = new RegExp(`\\b${DAY_PREP}${DAY_W}${SEP}${REPAIR}${SEP}(?=${DAY_PREP}${DAY_W}\\b)`, 'g');
const REPAIR_HOUR = new RegExp(`\\b${HOUR_W}${SEP}${REPAIR}${SEP}(?=(?:(?:as|a|para\\s+as|pras)\\s+)?\\d{1,2}\\b)`, 'g');
const REPAIR_NUM = new RegExp(`(?:r\\$\\s*)?\\b\\d[\\d.,]*(?:\\s+reais)?${SEP}${REPAIR}${SEP}(?=(?:r\\$\\s*)?\\d)`, 'g');

export function fixRepairs(text) {
  let s = subF(text, REPAIR_HOUR, (m, f) => (/^(?:as|a|para|pras)\b/.test(f.slice(m.index + m[0].length)) ? '' : 'às '));
  s = subF(s, REPAIR_DAY, '');
  s = subF(s, REPAIR_NUM, '');
  return s;
}

// ---------- 3. horas e dias falados ----------

const MONTHS = 'janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const PERIOD = '(?:\\s+d[ae]\\s+(?:manha|tarde|noite|madrugada))';
// palavras que anunciam um horário
const MARKS =
  '(?:la\\s+(?:para|pra|pelas)(?:\\s+(?:as|umas))?|(?:para|pra)\\s+(?:as|umas)|por\\s+volta\\s+d[ae]s?|perto\\s+d[ae]s?|pelas|umas|a\\s+partir\\s+d[ae]s?|desde\\s+as|ate\\s+as|antes\\s+d[ae]s?|depois\\s+d[ae]s?|pras|as|das)';
const NOT_MONEY = '(?!\\s*(?:reais|real|contos?|pilas?|centavos?))';
const pad2 = (n) => String(n).padStart(2, '0');

// "um"/"uma" contando horas, dinheiro e prazos: "uma hora da tarde", "um real", "em uma semana", "à uma"
const ONE_UNIT = /\b(um|uma)\s+(horas?|minutos?|real|reais|semanas?|mes|meses|anos?|dias?|vez)\b/g;
const ONE_HOUR = /\b(as|a|pelas|la\s+pela|pela)\s+uma\b(?=\s+(?:e\s+(?:meia|\d)|d[ae]\s+(?:tarde|manha|madrugada)|hora)|\s*$|\s*[,.;!?])/g;
const ONE_HALF = /\buma\s+(?=e\s+meia\b)/g;
const HOUR_MARK = { a: 'às', as: 'às', pelas: 'pelas', pela: 'pelas', 'la pela': 'lá pelas' };

function oneUnit(m, f) {
  const unit = m[2];
  const before = f.slice(0, m.index);
  const after = f.slice(m.index + m[0].length);
  const relative = /(?:\bdaqui\s+a|\bdaqui|\bem|\bdentro\s+de|\bha|\bfaz)\s*$/.test(before);
  let yes = false;
  if (/^rea/.test(unit)) yes = true;
  else if (/^hora/.test(unit)) yes = relative || /^\s+d[ae]\s+(?:tarde|manha|madrugada)\b/.test(after);
  else if (unit === 'vez') yes = /^\s+(?:por|ao|a\s+cada)\b/.test(after);
  else yes = relative || /^\s+antes\b/.test(after);
  return yes ? `1 ${unit}` : null;
}

function canonTimes(text) {
  let s = text;
  s = subF(s, ONE_HOUR, (m) => `${HOUR_MARK[m[1].replace(/\s+/g, ' ')] || 'às'} 1`);
  s = subF(s, ONE_HALF, '1 ');
  s = subF(s, ONE_UNIT, oneUnit);

  // "meio-dia e meia", "meia-noite e quinze"
  s = subF(s, new RegExp(`\\b(?:(?:ao|o|a|as)\\s+)?(meio[\\s-]?dia|meia[\\s-]?noite)\\s+e\\s+(meia|\\d{1,2})\\b(?:\\s+minutos?)?${NOT_MONEY}`, 'g'), (m) => {
    const min = m[2] === 'meia' ? 30 : Number(m[2]);
    if (min > 59) return null;
    return `às ${m[1].startsWith('meio') ? '12' : '00'}:${pad2(min)}`;
  });
  // "10 para o meio-dia"
  s = subF(s, /\b(\d{1,2})\s+(?:minutos?\s+)?(?:para|pra|pro)\s+(?:o\s+|a\s+)?(meio[\s-]?dia|meia[\s-]?noite)\b/g, (m) => {
    const min = Number(m[1]);
    if (min < 1 || min > 59) return null;
    return `às ${m[2].startsWith('meio') ? '11' : '23'}:${pad2(60 - min)}`;
  });
  // "quinze para as oito", "faltando 10 para as 4 da tarde"
  s = subF(
    s,
    new RegExp(
      `\\b(?:as\\s+)?(?:(faltando|faltam|falta)\\s+)?(\\d{1,2})\\s+(minutos?\\s+)?(?:para\\s+as|pra\\s+as|pras)\\s+(\\d{1,2})\\b(?:\\s+horas?)?(${PERIOD})?${NOT_MONEY}(?!\\s*\\d)(?!\\s+(?!horas?\\b)[a-z]{3,}s\\b)`,
      'g'
    ),
    (m) => {
      const min = Number(m[2]);
      const h = Number(m[4]);
      if (min < 1 || min > 59 || h < 1 || h > 23) return null;
      // sem "faltando" nem "minutos", só os redondos ("quinze para as oito")
      if (!m[1] && !m[3] && min % 5 !== 0) return null;
      const before = h === 1 ? 12 : h - 1;
      return `às ${before}:${pad2(60 - min)}${m[5] || ''}`;
    }
  );
  // "às 2 horas e meia", "às 9 horas e 15"
  s = subF(s, new RegExp(`\\b(${MARKS})\\s+(\\d{1,2})\\s+horas?\\s+e\\s+(meia|\\d{1,2})\\b(?:\\s+minutos?)?`, 'g'), (m) => {
    const min = m[3] === 'meia' ? 30 : Number(m[3]);
    if (Number(m[2]) > 23 || min > 59) return null;
    return `${m[1]} ${Number(m[2])}:${pad2(min)}`;
  });
  // "3 e meia" (não "duas horas e meia", que é duração, nem "dia 3 e meia dúzia")
  s = subF(s, /\b(\d{1,2})\s+e\s+meia\b(?!\s+(?:duzia|hora|xicara|colher|garrafa|lata|taca|folha|pagina|porcao|dose))/g, (m, f) => {
    const h = Number(m[1]);
    if (h < 1 || h > 23) return null;
    const before = f.slice(0, m.index);
    if (/(?:\bdia|[\d.,/:])\s*$/.test(before)) return null;
    return `${h}:30`;
  });
  // "às 6 e 30", "pelas 9 e 15": com a palavra de horário antes
  s = subF(s, new RegExp(`\\b(${MARKS})\\s+(\\d{1,2})\\s+e\\s+(\\d{1,2})\\b(?:\\s+minutos?)?(?!\\s*(?:h\\b|horas?\\b|:\\d|reais|real|centavos|contos?))`, 'g'), (m) => {
    const h = Number(m[2]);
    const min = Number(m[3]);
    if (h > 23 || min < 1 || min > 59) return null;
    return `${m[1]} ${h}:${pad2(min)}`;
  });
  // "7 e 20 da manhã": com a parte do dia depois
  s = subF(s, new RegExp(`\\b(\\d{1,2})\\s+e\\s+(\\d{1,2})(?:\\s+minutos?)?(?=${PERIOD})`, 'g'), (m, f) => {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 1 || h > 12 || min < 1 || min > 59) return null;
    if (/(?:\bdia|[\d.,/:])\s*$/.test(f.slice(0, m.index))) return null;
    return `${h}:${pad2(min)}`;
  });
  // "15 horas", "amanhã 8 horas": hora do dia sem o "às" (duração fica: "estudar 2 horas", "viagem de 15 horas")
  s = subF(s, new RegExp(`\\b(\\d{1,2})\\s+horas?\\b(?!\\s+(?:e\\s+(?:meia|\\d)|de\\b|por\\b|d[ae]\\s+(?:manha|tarde|noite|madrugada)|antes\\b|depois\\b))`, 'g'), (m, f) => {
    const h = Number(m[1]);
    if (h > 23) return null;
    const before = f.slice(0, m.index);
    if (new RegExp(`(?:${MARKS}|\\b(?:a|de|por|durante|ha|faz|em|cada|uns|quase|daqui|dentro\\s+de|mais\\s+de|menos\\s+de|\\d+\\s+em))\\s*$`).test(before)) return null;
    const afterDay = new RegExp(`(?:\\b(?:hoje|amanha|${WEEK}|dia\\s+\\d{1,2}|que\\s+vem)|\\d\\s+de\\s+(?:${MONTHS}))\\s*$`).test(before);
    if (h < 13 && !afterDay) return null;
    return `às ${m[0]}`;
  });
  return s;
}

function canonDates(text) {
  let s = text;
  s = subF(s, /\bdia\s+primeiro\b/g, 'dia 1');
  s = subF(s, new RegExp(`\\bprimeiro\\s+(?=de\\s+(?:${MONTHS})\\b)`, 'g'), '1 ');
  s = subF(s, new RegExp(`\\b(\\d{1,2})\\s*[ºo°]\\s+(?=de\\s+(?:${MONTHS})\\b)`, 'g'), (m) => `${m[1]} `);
  return s;
}

// Depois dos números por extenso já em dígitos: correção dita na hora, horas e dias no formato de leitura.
export function canonSpeech(text) {
  return canonDates(canonTimes(fixRepairs(text)));
}
