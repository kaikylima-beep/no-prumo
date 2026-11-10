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
];

const STOP = new Set(
  'o a os as um uma de da do das dos e em no na nos nas para pra pro com que me meu minha eu hoje amanha'.split(' ')
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

// Nota de "quanto o app entende" de uma versão: itens com dia, hora e valor,
// títulos curtos e palavras conhecidas pesam a favor
export function scoreText(text, today, now, vocabSet) {
  const items = parseInput(text, today, now);
  let score = 0;
  items.forEach((it) => {
    score += 1;
    if (it.date) score += 0.3;
    if (it.time) score += 0.4;
    if (it.amount !== null && it.amount !== undefined) score += 0.4;
    const n = tokens(it.title).length;
    if (n > 5) score -= (n - 5) * 0.35;
  });
  if (vocabSet) tokens(text).forEach((w) => vocabSet.has(clean(w)) && (score += 0.5));
  return score;
}

// Escolhe a melhor entre as versões ouvidas. A 1ª do Android só perde se outra for claramente melhor.
export function pickBest(alts, today, now, vocab = []) {
  const list = (alts || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (list.length <= 1) return { text: list[0] || '', index: 0 };
  const vocabSet = new Set(vocab.flatMap((v) => tokens(v).map(clean)).filter((w) => w.length > 2 && !STOP.has(w)));
  const scores = list.map((t, i) => scoreText(t, today, now, vocabSet) - i * 0.2);
  let best = 0;
  scores.forEach((s, i) => {
    if (s > scores[best] + 0.25) best = i;
  });
  return { text: list[best], index: best, scores };
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
