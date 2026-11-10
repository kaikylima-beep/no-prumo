// Datas no formato 'AAAA-MM-DD' e horas 'HH:MM', sempre no horário do celular.
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = (now = new Date()) => toISO(now);
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const addMonths = (iso, n) => {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  return toISO(d);
};
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
export const weekdayOf = (iso) => fromISO(iso).getDay();
export const monthKey = (iso) => iso.slice(0, 7);
export const hhmm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
export const minutesOf = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const nowHHMM = (now = new Date()) => hhmm(now.getHours(), now.getMinutes());
export const at = (iso, time) => {
  const d = fromISO(iso);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
};

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "Hoje", "Amanhã", "Sex, 14 nov"
export function dayLabel(iso, now = new Date()) {
  if (!iso) return 'Sem data';
  const diff = diffDays(todayISO(now), iso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  const d = fromISO(iso);
  const base = `${cap(WEEKDAYS_SHORT[d.getDay()])}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
export function longDay(iso) {
  const d = fromISO(iso);
  return `${cap(WEEKDAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${cap(MONTHS[m - 1])} de ${y}`;
}
// "em 3 dias", "amanhã", "há 2 dias"
export function relLabel(iso, now = new Date()) {
  const diff = diffDays(todayISO(now), iso);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
}
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function formatMoney(v) {
  const n = Math.abs(Number(v) || 0);
  const [int, dec] = n.toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
export function parseMoney(text) {
  const s = String(text || '').replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
