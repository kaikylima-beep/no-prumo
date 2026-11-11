// 1.13 · Finanças mais limpo: regras puras (não leem nem gravam nada).
// - Pix devolvido: o Pix que voltou e a devolução se anulam (categoria "Devolvido").
// - Títulos da importação sem data grudada ("…0711") e sem código do banco ("Rscss").
// - Rendimento da aplicação é Investimentos; juros e IOF são "Tarifas e juros"; a fatura
//   do cartão fica sem a marca de necessário/não necessário.
// - Categoria aprendida: uma compra nova com o mesmo nome de outra que você já classificou
//   ganha a mesma categoria.

export const REFUND = 'Devolvido';
export const CHARGES = 'Tarifas e juros';

const fold = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const DEV_PIX = /^\s*dev(?:ol\w*)?\.?\s+(?:de\s+)?pix\b|\bdevolucao\s+(?:de\s+)?pix\b|\bpix\s+devolvido\b/;
// a devolução de um Pix que você recebeu ("DEV PIX Fulano")
export const isDevPix = (t) => !!t && t.type === 'out' && (DEV_PIX.test(fold(t.title)) || DEV_PIX.test(fold(t.note)) || DEV_PIX.test(fold(t.source)));

// data grudada no fim ("Colet0711", "M0610") e códigos do banco no começo ("Rscss")
const GLUED_DATE = /([A-Za-zÀ-ÿ])(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])$/;
const BANK_CODES = /^(?:rscss|pay)\s+/i;
export function cleanImportTitle(title) {
  let t = String(title || '').trim();
  let guard = 0;
  let prev;
  do {
    prev = t;
    t = t.replace(BANK_CODES, '').replace(GLUED_DATE, '$1').replace(/\s*\d{2}\/\d{2}$/, '').trim();
  } while (t !== prev && guard++ < 4);
  if (!t) return String(title || '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const RENDIMENTO = /\brend\w*\s+pago\b|\brendimento|\baplic\w*\s+aut/;
export const isRendimento = (t) => !!t && t.type === 'in' && (RENDIMENTO.test(fold(t.title)) || RENDIMENTO.test(fold(t.note)) || RENDIMENTO.test(fold(t.source)));

const CHARGE = /\b(juros|iof|tarifa|encargos?|multa|anuidade)\b/;
export const isCharge = (t) => !!t && t.type === 'out' && (CHARGE.test(fold(t.title)) || CHARGE.test(fold(t.note)) || CHARGE.test(fold(t.source)));

// fatura paga (não as compras do cartão): fica sem marca de necessário
export const isCardBill = (t) => !!t && t.type === 'out' && (/^fatura\b/i.test(t.title || '') || /^cart[aã]o\b/i.test(t.title || ''));

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY);

const TRANSPORT = /\b(transp\w*\s+colet\w*|onibus|metro|urbs)\b/;

// Pix devolvido: liga cada devolução ao Pix recebido de mesmo valor, até 5 dias antes (ou no mesmo dia).
// Devolve { id: mudanças } só para o que ainda não está marcado.
export function refundChanges(finance = []) {
  const changes = {};
  const used = new Set(finance.filter((t) => t.refundPair).map((t) => t.refundPair));
  for (const out of finance) {
    if (out.type !== 'out' || out.refundPair) continue;
    if (out.category !== REFUND && !isDevPix(out)) continue;
    const back = finance
      .filter(
        (t) =>
          t.type === 'in' &&
          !t.refundPair &&
          !used.has(t.id) &&
          Math.abs((t.amount || 0) - (out.amount || 0)) < 0.005 &&
          t.date &&
          out.date &&
          daysBetween(t.date, out.date) >= 0 &&
          daysBetween(t.date, out.date) <= 5 &&
          (!t.account || !out.account || t.account === out.account)
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const outChange = { category: REFUND, essential: null };
    // "Dev Pix Fulano" → "Pix devolvido para Fulano"
    const m = /^\s*dev\w*\.?\s+(?:de\s+)?pix\s+(.+)$/i.exec(out.title || '');
    if (m) outChange.title = `Pix devolvido para ${cleanImportTitle(m[1])}`;
    if (back) {
      used.add(back.id);
      outChange.refundPair = back.id;
      changes[back.id] = { category: REFUND, refundPair: out.id };
    }
    if (out.category !== REFUND || back) changes[out.id] = outChange;
  }
  return changes;
}

// Correção dos dados que já foram importados (uma vez, na 1.13)
export function migrate113(finance = []) {
  const changes = { ...refundChanges(finance) };
  for (const t of finance) {
    if (!t.importId || changes[t.id]) continue;
    const c = {};
    const title = cleanImportTitle(t.title);
    if (title !== t.title) c.title = title;
    if (t.category === 'Outros' && t.type === 'out' && TRANSPORT.test(fold(title))) {
      c.category = 'Transporte';
      c.essential = null;
    }
    if (isRendimento(t) && t.category !== 'Investimentos') {
      c.category = 'Investimentos';
      c.title = 'Rendimento';
    }
    if (isCharge(t) && t.category !== CHARGES && t.category !== 'Cartão') {
      c.category = CHARGES;
      c.essential = null;
    }
    if (isCardBill(t) && t.essential !== null && t.essential !== undefined) c.essential = null;
    if (Object.keys(c).length) changes[t.id] = c;
  }
  return changes;
}

// Categoria aprendida: o mesmo nome que você já classificou (fora de "Outros") ganha a mesma categoria
export function learnedCategory(title, type, existing = []) {
  const k = fold(cleanImportTitle(title));
  if (!k || /^(compra no debito|pix (enviado|recebido)|entrada|despesa)$/.test(k)) return null;
  const same = existing
    .filter((e) => e.type === type && e.category && e.category !== 'Outros' && e.category !== REFUND && fold(cleanImportTitle(e.title)) === k)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return same ? { category: same.category, essential: same.essential === undefined ? null : same.essential } : null;
}
