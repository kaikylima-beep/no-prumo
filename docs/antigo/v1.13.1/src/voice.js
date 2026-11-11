// Voz: o que fica entre o reconhecimento do Android e o interpretador.
// - vocabulário que o app passa ao reconhecedor (palavras do app + da pessoa)
// - escolher, entre as versões que o Android ouviu, a que o app entende melhor
// - dicionário pessoal: trocas que a pessoa já corrigiu ("pique" -> "pix")
// Tudo no celular, sem regra escrita para uma frase específica.

import { fold, parseInput } from './parser';

// palavras do próprio app que o reconhecedor costuma errar
const BASE_VOCAB = [
  'Pix', 'prova', 'estudar', 'entregar', 'trabalho', 'seminário', 'relatório', 'lista de exercícios',
  'aula', 'faculdade', 'estágio', 'boleto', 'fatura', 'salário', 'reais', 'me lembrar', 'todo dia',
  'amanhã', 'depois de amanhã', 'da tarde', 'da noite', 'da manhã', 'mercado', 'aluguel', 'conta de luz',
  'Uber', 'iFood', 'paguei', 'gastei', 'recebi', 'transferi',
  'faltei', 'tirei', 'nota', 'P1', 'P2', // 1.13: notas e faltas
  'meio-dia', 'e meia', 'semana que vem', 'mês que vem', 'fim de semana', 'toda semana', 'todo mês', 'vence dia', // 1.13.1
];

const STOP = new Set(
  // palavras de ligação e de tempo: aparecem em qualquer frase, não dizem qual versão é a certa
  'o a os as um uma de da do das dos e em no na nos nas para pra pro com que me meu minha eu hoje amanha manha tarde noite dia todo toda semana mes vem fim meia depois reais vence lembrar'.split(' ')
);

// Vocabulário para o reconhecedor (Android 13+): até 100 itens, sem repetir
export function buildVocab({ subjects = [], accounts = [], learned = {}, titles = [] } = {}) {
  const out = [];
  const seen = new Set();
  const add = (w) => {
    const t = String(w || '').trim();
    if (!t || t.length < 2) return;
    const k = fold(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  BASE_VOCAB.forEach(add);
  subjects.filter((s) => !s.archived).forEach((s) => {
    add(s.name);
    (s.aliases || []).forEach(add);
  });
  accounts.forEach((a) => add(a.name));
  Object.values(learned).forEach((v) => v && v.to && add(v.to));
  // palavras que a pessoa mais usa nos títulos
  const freq = {};
  titles.forEach((t) =>
    String(t || '')
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\d]/gu, ''))
      .filter((w) => w.length > 3 && !STOP.has(fold(w)))
      .forEach((w) => {
        const k = fold(w);
        freq[k] = freq[k] || { w, n: 0 };
        freq[k].n++;
      })
  );
  Object.values(freq)
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 40)
    .forEach((x) => add(x.w));
  return out.slice(0, 100);
}

const tokens = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);
const clean = (w) => fold(w).replace(/[^a-z0-9$]/g, '');

// Trechos trocados entre o que foi ouvido e o texto corrigido (1 a 3 palavras de cada lado)
export function diffWords(heard, fixed) {
  const a = tokens(heard);
  const b = tokens(fixed);
  const A = a.map(clean);
  const B = b.map(clean);
  // maior sequência comum
  const L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [];
  let i = 0;
  let j = 0;
  let fa = [];
  let fb = [];
  const flush = () => {
    if (fa.length && fb.length && fa.length <= 3 && fb.length <= 3) {
      const from = fa.map(clean).join(' ');
      const to = fb.join(' ').replace(/[,.;!?]+$/, '');
      if (from && fold(to) !== from) pairs.push({ from, to });
    }
    fa = [];
    fb = [];
  };
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) {
      flush();
      i++;
      j++;
    } else if (j < B.length && (i >= A.length || L[i][j + 1] >= L[i + 1][j])) fb.push(b[j++]);
    else fa.push(a[i++]);
  }
  flush();
  return pairs;
}

// Junta as trocas novas no dicionário pessoal (conta quantas vezes a pessoa fez a mesma troca)
export function learn(learned = {}, pairs = []) {
  const next = { ...learned };
  pairs.forEach(({ from, to }) => {
    const cur = next[from];
    if (cur && fold(cur.to) === fold(to)) next[from] = { to, n: cur.n + 1 };
    else next[from] = { to, n: 1 };
  });
  // limite de tamanho: fica com as 300 mais usadas
  const keys = Object.keys(next);
  if (keys.length > 300) {
    keys
      .sort((x, y) => next[y].n - next[x].n)
      .slice(300)
      .forEach((k) => delete next[k]);
  }
  return next;
}

// Aplica o dicionário: trocas confirmadas 2 vezes ou mais entram sozinhas; as de 1 vez viram sugestão
export function applyLearned(text, learned = {}) {
  let out = String(text || '');
  const applied = [];
  const suggestions = [];
  const keys = Object.keys(learned).sort((x, y) => y.split(' ').length - x.split(' ').length);
  keys.forEach((from) => {
    const { to, n } = learned[from] || {};
    if (!to) return;
    const parts = from.split(' ');
    // casa sem acento e sem diferença de maiúsculas, palavra inteira
    const re = new RegExp(`(^|[^\\p{L}\\d])(${parts.map(() => '([\\p{L}\\d$]+)').join('\\s+')})(?=$|[^\\p{L}\\d])`, 'giu');
    let hit = false;
    const replaced = out.replace(re, (all, pre, whole, ...rest) => {
      const words = rest.slice(0, parts.length);
      if (words.map(clean).join(' ') !== from) return all;
      hit = true;
      return n >= 2 ? pre + to : all;
    });
    if (!hit) return;
    if (n >= 2) {
      out = replaced;
      applied.push({ from, to });
    } else suggestions.push({ from, to });
  });
  return { text: out, applied, suggestions };
}

// Troca uma vez (sugestão aceita)
export function replaceOnce(text, from, to) {
  const parts = from.split(' ');
  const re = new RegExp(`(^|[^\\p{L}\\d])(${parts.map(() => '([\\p{L}\\d$]+)').join('\\s+')})(?=$|[^\\p{L}\\d])`, 'giu');
  return String(text).replace(re, (all, pre, whole, ...rest) =>
    rest.slice(0, parts.length).map(clean).join(' ') === from ? pre + to : all
  );
}

// Nota de "quanto o app entende" de uma versão. O reconhecedor do Android já escolheu a 1ª versão
// com muito mais informação do que o app tem; ela só perde com prova concreta:
//   - um valor, um dia ou uma hora dita com número que a outra versão não tem ("sem reais" x "100 reais");
//   - palavras do vocabulário da pessoa (matérias, contas, trocas aprendidas, títulos que ela usa).
// Ter mais itens não conta (uma palavra mal ouvida que vira verbo criaria um item a mais), e a parte
// do dia ("a manhã" no lugar de "amanhã") também não.
export function scoreText(text, today, now, vocabSet) {
  const items = parseInput(text, today, now, { marks: true });
  const dates = new Set();
  const times = new Set();
  const amounts = new Set();
  let score = 0;
  items.forEach((it) => {
    if (it.date && !it.autoToday) dates.add(it.date);
    if (it.time && !it.periodTime) times.add(it.time);
    if (it.amount !== null && it.amount !== undefined) amounts.add(it.amount);
    const n = tokens(it.title).length;
    if (n > 5) score -= (n - 5) * 0.2;
  });
  score += dates.size * 0.3 + times.size * 0.4 + amounts.size * 0.5;
  if (vocabSet) new Set(tokens(text).map(clean)).forEach((w) => vocabSet.has(w) && (score += 0.5));
  return score;
}

// Trechos em que duas versões discordam: [{ i, j, words }] = palavras i..j da primeira trocadas por `words`
function diffRegions(a, b) {
  const A = a.map(clean);
  const B = b.map(clean);
  const L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  let from = -1;
  let words = [];
  const flush = () => {
    const len = from < 0 ? 0 : i - from;
    if ((len || words.length) && len <= 3 && words.length <= 3) out.push({ i: from < 0 ? i : from, j: i, words });
    from = -1;
    words = [];
  };
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) {
      flush();
      i++;
      j++;
    } else if (j < B.length && (i >= A.length || L[i][j + 1] >= L[i + 1][j])) words.push(b[j++]);
    else {
      if (from < 0) from = i;
      i++;
    }
  }
  flush();
  return out;
}

// Mistura as versões palavra por palavra (a ideia do "voto" entre hipóteses dos reconhecedores de voz):
// onde outra versão discorda da escolhida, o trecho dela entra se o app passar a entender claramente melhor.
// Assim "pix" de uma versão e "estudar" de outra podem ficar na mesma frase. Só usa palavras que o
// Android realmente ouviu; nunca inventa.
export function mixAlts(base, others, scoreFn, margin = 0.25) {
  let best = base;
  let bestScore = scoreFn(base);
  const tried = new Set([tokens(base).map(clean).join(' ')]);
  (others || []).forEach((alt) => {
    const regions = diffRegions(tokens(best), tokens(alt));
    // da direita para a esquerda: uma troca aceita não muda a posição das que faltam
    for (let k = regions.length - 1; k >= 0; k--) {
      const r = regions[k];
      const toks = tokens(best);
      const cand = [...toks.slice(0, r.i), ...r.words, ...toks.slice(r.j)].join(' ');
      const key = tokens(cand).map(clean).join(' ');
      if (!key || tried.has(key)) continue;
      tried.add(key);
      const sc = scoreFn(cand);
      if (sc > bestScore + margin) {
        best = cand;
        bestScore = sc;
      }
    }
  });
  return { text: best, score: bestScore };
}

// Escolhe a melhor entre as versões ouvidas. A 1ª do Android só perde se outra for claramente melhor;
// quando o Android informa a confiança, ela entra na conta. Depois mistura palavra por palavra.
export function pickBest(alts, today, now, vocab = [], conf = []) {
  const list = (alts || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (list.length <= 1) return { text: list[0] || '', index: 0 };
  const vocabSet = new Set(vocab.flatMap((v) => tokens(v).map(clean)).filter((w) => w.length > 2 && !STOP.has(w)));
  const sure = (i) => (typeof conf[i] === 'number' && conf[i] > 0 ? conf[i] : null);
  const scores = list.map((t, i) => {
    const gap = sure(i) !== null && sure(0) !== null ? sure(i) - sure(0) : 0;
    return scoreText(t, today, now, vocabSet) - i * 0.2 + gap;
  });
  let best = 0;
  scores.forEach((s, i) => {
    if (s > scores[best] + 0.25) best = i;
  });
  const mixed = mixAlts(list[best], list.filter((_, i) => i !== best), (t) => scoreText(t, today, now, vocabSet));
  return { text: mixed.text, index: best, scores, mixed: mixed.text !== list[best] };
}

// ---------- pausas da fala ----------
// Quem fala separa os pedidos com pausa. O texto do Android não traz a pausa, mas dá para recuperar:
// (1) o Android entrega a fala em pedaços, cortados onde a pessoa parou; (2) no Android 14+, com o
// reconhecimento no aparelho, cada palavra vem com o instante em que começou. Pausa vira vírgula, e
// vírgula o interpretador já sabe ler (ela separa itens só quando os dois lados fazem sentido sozinhos).

// Pausa depois de "às", "de", "dia", "o"… é a pessoa pensando, não o fim de um pedido: não vira vírgula
const NO_PAUSE_AFTER = new Set(
  'o a os as um uma de da do das dos em no na nos nas para pra pro com sem por que e ou ate dia as umas pelas meu minha r$ todo toda cada'.split(' ')
);
const endsOpen = (text) => NO_PAUSE_AFTER.has(clean(tokens(text).pop() || ''));

// Junta os pedaços: a versão k de cada pedaço (ou a 1ª, se o pedaço tiver menos versões)
export function joinPieces(pieces) {
  const all = (pieces || []).filter((p) => p && p.length);
  if (!all.length) return [];
  const n = Math.max(...all.map((p) => p.length));
  const out = [];
  for (let k = 0; k < n; k++) {
    let text = '';
    all.forEach((p) => {
      const t = String(p[k] || p[0] || '').trim();
      if (!t) return;
      if (text) text += /[,.;:!?]$/.test(text) || endsOpen(text) ? ' ' : ', ';
      text += t;
    });
    out.push(text.replace(/\s+/g, ' '));
  }
  return out;
}

// words = [{ segment, startTimeMillis }] na ordem da frase. Se entre o começo de uma palavra e o
// da seguinte passou bem mais do que o tempo de falar a palavra, houve pausa.
export function pauseCommas(transcript, words, minPause = 700) {
  const toks = tokens(transcript);
  if (!Array.isArray(words) || toks.length < 3 || words.length !== toks.length) return transcript;
  for (let i = 0; i < toks.length; i++) {
    const w = words[i] || {};
    if (clean(String(w.segment || '')) !== clean(toks[i]) || typeof w.startTimeMillis !== 'number') return transcript;
    if (i && w.startTimeMillis < words[i - 1].startTimeMillis) return transcript;
  }
  let changed = false;
  for (let i = 0; i < toks.length - 1; i++) {
    const between = words[i + 1].startTimeMillis - words[i].startTimeMillis;
    const speaking = Math.min(900, 120 + 75 * clean(toks[i]).length);
    if (between - speaking >= minPause && !/[,.;:!?]$/.test(toks[i]) && !NO_PAUSE_AFTER.has(clean(toks[i]))) {
      toks[i] += ',';
      changed = true;
    }
  }
  return changed ? toks.join(' ') : transcript;
}

// Outras versões para mostrar como opção (diferentes da escolhida, no máximo 2)
export function otherVersions(alts, chosen) {
  const key = (t) => fold(String(t || '')).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const seen = new Set([key(chosen)]);
  const out = [];
  (alts || []).forEach((t) => {
    const k = key(t);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(String(t).trim());
  });
  return out.slice(0, 2);
}

// ---------- qual serviço de voz do Android usar (1.12.3) ----------
// Em celulares Samsung, o serviço padrão (inclusive o "no próprio celular") pode ser o da
// Samsung, que abre o Bixby. Quando o Google está instalado, o app pede o Google pelo nome.
export const GOOGLE_ON_DEVICE = 'com.google.android.as'; // reconhecimento do Google só no aparelho
export const GOOGLE_SERVICES = ['com.google.android.tts', 'com.google.android.googlequicksearchbox'];

// list = serviços que o aparelho tem; onDevice = a pessoa quer reconhecer no celular.
// → { pkg, offline } ou null (sem Google: fica o serviço do sistema)
export function pickService(list = [], onDevice = false) {
  if (onDevice && list.includes(GOOGLE_ON_DEVICE)) return { pkg: GOOGLE_ON_DEVICE, offline: true };
  const g = GOOGLE_SERVICES.find((p) => list.includes(p));
  return g ? { pkg: g, offline: !!onDevice } : null;
}
