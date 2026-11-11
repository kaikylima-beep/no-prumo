export const pad = (n) => String(n).padStart(2, '0');

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const WEEKDAYS = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

// ---------- Datas ----------
// Internamente as datas são guardadas como texto "AAAA-MM-DD".

export const toISO = (dt) =>
  `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

export const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const formatBR = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const weekdayName = (iso) => WEEKDAYS[fromISO(iso).getDay()];

// Aplica a máscara DD/MM/AAAA enquanto a pessoa digita.
export function maskDate(text) {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Converte "DD/MM/AAAA" em "AAAA-MM-DD". Retorna null se for inválida.
export function parseBR(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return toISO(dt);
}

// Quantidade de dias de A até B (positivo se B é depois de A).
export function diffDays(isoA, isoB) {
  const a = fromISO(isoA);
  const b = fromISO(isoB);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

// ---------- Dinheiro ----------

export function parseMoney(text) {
  let s = String(text).replace(/[^\d,.-]/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    // formato brasileiro: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.250" sem vírgula = mil duzentos e cinquenta
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

export function formatMoney(n) {
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(2).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${int},${f}`;
}

// 1.12.1: ocultar saldo. As telas de dinheiro usam showMoney(); edição, importação e confirmação continuam com formatMoney().
export const privacy = { hidden: false };
export const HIDDEN_MONEY = 'R$ ••••';
export function showMoney(n) {
  return privacy.hidden ? HIDDEN_MONEY : formatMoney(n);
}

// "hoje", "amanhã", "em 5 dias", "3 dias atrás"
export function relativeLabel(iso, today = todayISO()) {
  const d = diffDays(today, iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  if (d > 1) return `em ${d} dias`;
  return `${-d} dias atrás`;
}

export const WEEK_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// "27/11" (sem o ano)
export const shortBR = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

// ---------- horário "HH:MM" ----------

export function maskTime(text) {
  const d = text.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function parseTime(text) {
  const m = /^(\d{1,2}):?(\d{2})?$/.exec(String(text).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

export const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ---------- meses "AAAA-MM" ----------

export const ymOf = (iso) => iso.slice(0, 7);

export function addMonthsYm(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// dia N no mês (se o mês for mais curto, usa o último dia)
export function dateInMonth(ym, day) {
  return `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;
}
