// Lembretes que se repetem (tarefas e estudos).
//
// item.repeat = { freq: 'daily' | 'weekly' | 'monthly', days?: [0-6], day?: 1-31, interval?: horas }
// item.times  = ['08:00', '20:00']   horários de cada dia em que o lembrete acontece
// item.doneSlots = ['2026-11-06 08:00', ...]   ocorrências já feitas
//
// Dias da semana seguem o JavaScript: 0 = domingo ... 6 = sábado.

import { toISO, fromISO, daysInMonth } from './utils';

const pad = (n) => String(n).padStart(2, '0');

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];

export const slotKey = (iso, time) => `${iso} ${time}`;

export function timesOf(item) {
  if (item.times && item.times.length) return [...item.times].sort();
  if (item.time) return [item.time];
  return ['08:00'];
}

// O lembrete acontece neste dia?
export function occursOn(rep, iso) {
  if (!rep) return false;
  const d = fromISO(iso);
  if (rep.freq === 'daily') return true;
  if (rep.freq === 'weekly') return (rep.days || []).includes(d.getDay());
  if (rep.freq === 'monthly') {
    const ym = iso.slice(0, 7);
    // dia 31 em mês de 30 dias: acontece no último dia
    return d.getDate() === Math.min(rep.day || 1, daysInMonth(ym));
  }
  return false;
}

// Não mostra ocorrências antes do dia em que o lembrete foi criado
function startsBy(item, iso) {
  return !item.date || iso >= item.date;
}

export function slotsOn(item, iso) {
  if (!item.repeat || !startsBy(item, iso) || !occursOn(item.repeat, iso)) return [];
  return timesOf(item);
}

const nowParts = (now) => ({ iso: toISO(now), hm: `${pad(now.getHours())}:${pad(now.getMinutes())}` });

// Próxima ocorrência a partir de agora: { date, time } (procura até 62 dias)
export function nextSlot(item, now = new Date()) {
  const { iso: today, hm } = nowParts(now);
  const done = new Set(item.doneSlots || []);
  const d = fromISO(today);
  for (let k = 0; k < 62; k++) {
    const iso = toISO(d);
    for (const t of slotsOn(item, iso)) {
      if (k === 0 && t <= hm) continue;
      if (done.has(slotKey(iso, t))) continue;
      return { date: iso, time: t };
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// Ocorrência de hoje que já passou do horário e ainda não foi feita (a mais antiga)
export function pendingSlot(item, now = new Date()) {
  const { iso: today, hm } = nowParts(now);
  const done = new Set(item.doneSlots || []);
  for (const t of slotsOn(item, today)) {
    if (t <= hm && !done.has(slotKey(today, t))) return { date: today, time: t };
  }
  return null;
}

// A ocorrência que o botão de concluir marca: a pendente de hoje ou a próxima
export function currentSlot(item, now = new Date()) {
  return pendingSlot(item, now) || nextSlot(item, now);
}

export function doneToday(item, now = new Date()) {
  const today = toISO(now);
  const done = new Set(item.doneSlots || []);
  return slotsOn(item, today).filter((t) => done.has(slotKey(today, t)));
}

// Primeira data em que o lembrete acontece, a partir de hoje
export function firstOccurrence(rep, times, now = new Date()) {
  const fake = { repeat: rep, times, doneSlots: [] };
  const next = nextSlot(fake, now);
  return next ? next.date : toISO(now);
}

function joinPt(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}

// "Todo dia · 08:00 e 20:00", "Seg, Qua e Sex · 07:00", "Todo dia 10 · 08:00"
export function describe(rep, times) {
  if (!rep) return '';
  const hours = joinPt(times || []);
  let when;
  if (rep.freq === 'daily') when = rep.interval ? `De ${rep.interval} em ${rep.interval} horas` : 'Todo dia';
  else if (rep.freq === 'weekly') {
    const days = [...(rep.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // segunda primeiro
    const key = days.join(',');
    if (key === '1,2,3,4,5') when = 'Seg a sex';
    else if (key === '6,0') when = 'Fins de semana';
    else if (days.length === 7) when = 'Todo dia';
    else if (days.length === 1) when = `Às ${WEEKDAY_PLURAL[days[0]]}`;
    else when = joinPt(days.map((d) => WEEKDAY_SHORT[d]));
  } else if (rep.freq === 'monthly') when = `Todo dia ${rep.day}`;
  else when = '';
  return hours ? `${when} · ${hours}` : when;
}

// "hoje 20:00", "amanhã 08:00", "seg 07:00", "15/11 08:00"
export function slotLabel(slot, now = new Date()) {
  if (!slot) return '';
  const today = toISO(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (slot.date === today) return `hoje ${slot.time}`;
  if (slot.date === toISO(tomorrow)) return `amanhã ${slot.time}`;
  const d = fromISO(slot.date);
  const diff = Math.round((d - fromISO(today)) / 86400000);
  if (diff < 7) return `${WEEKDAY_SHORT[d.getDay()].toLowerCase()} ${slot.time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${slot.time}`;
}

// Horários espaçados a partir de um início: de 8 em 8 horas a partir das 16:15
export function intervalTimes(start, hours) {
  const [h, m] = start.split(':').map(Number);
  const n = Math.max(1, Math.floor(24 / hours));
  const out = [];
  for (let i = 0; i < n; i++) {
    const total = (h * 60 + m + i * hours * 60) % (24 * 60);
    out.push(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }
  return [...new Set(out)].sort();
}

// Ordena itens repetidos pela próxima ocorrência (pendentes primeiro)
export function sortKey(item, now = new Date()) {
  const p = pendingSlot(item, now);
  if (p) return `0 ${p.date} ${p.time}`;
  const n = nextSlot(item, now);
  return n ? `1 ${n.date} ${n.time}` : '9';
}
