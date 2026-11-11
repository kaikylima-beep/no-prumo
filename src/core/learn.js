// Dicionário pessoal: o Peep aprende as palavras que o celular costuma ouvir errado.
// Não existe regra escrita para palavra nenhuma: tudo vem do que a pessoa corrigiu.
import { norm } from './nlu.js';

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const clean = (w) => norm(w).replace(/[.,;!?]/g, '');

// Compara o que foi ouvido com o que a pessoa corrigiu e devolve as trocas [de, para].
export function diffWords(heard, fixed) {
  const a = words(heard);
  const b = words(fixed);
  let s = 0;
  while (s < a.length && s < b.length && clean(a[s]) === clean(b[s])) s++;
  let ea = a.length;
  let eb = b.length;
  while (ea > s && eb > s && clean(a[ea - 1]) === clean(b[eb - 1])) {
    ea--;
    eb--;
  }
  const from = a.slice(s, ea).map(clean).join(' ');
  const to = b.slice(s, eb).join(' ').replace(/[.,;!?]+$/, '');
  if (!from || !to || ea - s > 3 || eb - s > 3 || from === clean(to)) return [];
  if (/\d/.test(from) || /\d/.test(to)) return []; // número trocado é outra informação, não erro de ouvido
  return [[from, to]];
}

export function learn(learned, heard, fixed) {
  const out = { ...(learned || {}) };
  diffWords(heard, fixed).forEach(([from, to]) => {
    const cur = out[from];
    out[from] = cur && clean(cur.to) === clean(to) ? { to, n: cur.n + 1 } : { to, n: 1 };
  });
  const keys = Object.keys(out);
  if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete out[k]);
  return out;
}

// Aplica as trocas já aprendidas. Devolve { text, changed: [[de, para]] }.
export function applyLearned(text, learned) {
  let out = ` ${String(text || '')} `;
  const changed = [];
  Object.entries(learned || {})
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([from, v]) => {
      if (!v || !v.to) return;
      const pattern = from.split(' ').map((w) => w.split('').map(accentOpen).join('')).join('\\s+');
      const re = new RegExp(`(?<=[\\s.,;!?])${pattern}(?=[\\s.,;!?])`, 'giu');
      if (re.test(out)) {
        out = out.replace(re, v.to);
        changed.push([from, v.to]);
      }
    });
  return { text: out.trim(), changed };
}
const ACCENTS = { a: '[aáàâã]', e: '[eéê]', i: '[ií]', o: '[oóôõ]', u: '[uúü]', c: '[cç]' };
const accentOpen = (ch) => ACCENTS[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
