// Quais avisos o celular deve ter agendados agora.
// A lista inteira é refeita a cada mudança: não existe "id de aviso" guardado em cada item,
// então não tem como um aviso ficar órfão ou um item ficar sem aviso.
import { addDays, at, diffDays, formatMoney, hhmm, minutesOf, todayISO } from './dates.js';
import { blocksOn, dayAgenda, nextDate } from './model.js';

const MAX = 56; // o Android aguenta bem mais; 56 cobre semanas e deixa folga

const pieces = (list, one, many) => (list === 1 ? `1 ${one}` : `${list} ${many}`);

export function daySummary(state, iso, now) {
  const ag = dayAgenda(state, iso, now);
  const classes = ag.timed.filter((e) => e.kind === 'block' && e.block.kind === 'class').length;
  const items = [...ag.timed.filter((e) => e.kind === 'item').map((e) => e.item), ...ag.loose];
  const exams = items.filter((i) => i.type === 'study' && i.studyKind === 'prova');
  const bills = items.filter((i) => i.type === 'money' && i.flow === 'out');
  const rest = items.length - exams.length - bills.length;
  const parts = [];
  if (exams.length) parts.push(exams.length === 1 ? exams[0].title : pieces(exams.length, 'prova', 'provas'));
  if (classes) parts.push(pieces(classes, 'aula', 'aulas'));
  if (rest) parts.push(pieces(rest, 'tarefa', 'tarefas'));
  if (bills.length) parts.push(pieces(bills.length, 'conta para pagar', 'contas para pagar'));
  if (ag.late.length) parts.push(pieces(ag.late.length, 'atrasado', 'atrasados'));
  return parts;
}

export function planReminders(state, now = new Date()) {
  const s = state.settings || {};
  const today = todayISO(now);
  const out = [];
  const push = (when, title, body, data, category) => {
    if (when.getTime() > now.getTime() + 20000) out.push({ when, title, body, data, category });
  };

  state.items.forEach((it) => {
    if (it.done || !it.date) return;
    // próximas datas do item (as que se repetem ganham algumas à frente)
    const dates = [];
    if (it.repeat && it.repeat.freq === 'hours') {
      const every = Math.max(1, it.repeat.every || 1);
      for (let k = 1; k <= 8; k++) {
        const w = new Date(now.getTime() + k * every * 3600000);
        w.setSeconds(0, 0);
        if (w.getHours() >= 7 && w.getHours() <= 22) push(w, it.title, 'Hora de novo.', { id: it.id }, 'feito');
      }
      return;
    }
    let d = it.date;
    if (it.repeat && d < today) d = nextDate(it.repeat, d, addDays(today, -1)) || d;
    dates.push(d);
    if (it.repeat) {
      for (let k = 0; k < 5; k++) {
        d = nextDate(it.repeat, d, d);
        if (!d) break;
        dates.push(d);
      }
    }
    dates.forEach((date, idx) => {
      const data = { id: it.id, date };
      if (it.type === 'money') {
        const value = s.hideMoney || !it.amount ? '' : ` · ${formatMoney(it.amount)}`;
        if (it.flow === 'in') return push(at(date, '09:00'), 'Dinheiro para receber', `${it.title}${value}`, data, 'pago');
        if (idx === 0) push(at(addDays(date, -1), '18:00'), 'Vence amanhã', `${it.title}${value}`, data, 'pago');
        return push(at(date, '09:00'), 'Vence hoje', `${it.title}${value}`, data, 'pago');
      }
      const base = at(date, it.time || (it.type === 'study' ? '07:30' : '09:00'));
      const big = it.type === 'study' && (it.studyKind === 'prova' || it.studyKind === 'entrega');
      if (it.remind) {
        const early = new Date(base.getTime() - it.remind * 60000);
        // lembrete em dias cai num horário humano, não de madrugada
        if (it.remind >= 1440 && !it.time) early.setHours(18, 0, 0, 0);
        push(early, it.title, `${it.remind >= 1440 ? `Faltam ${Math.round(it.remind / 1440)} dias` : `Em ${it.remind} min`}${it.time ? ` · ${it.time}` : ''}`, data, 'feito');
      } else if (big && idx === 0) {
        [7, 3, 1].forEach((n) => {
          if (diffDays(today, date) >= n) push(at(addDays(date, -n), '18:00'), n === 1 ? 'É amanhã' : `Faltam ${n} dias`, `${it.title}${it.time ? ` · ${it.time}` : ''}`, data, null);
        });
      }
      if (big && it.time && minutesOf(it.time) >= 60) push(new Date(base.getTime() - 3600000), 'Daqui a 1 hora', it.title, data, null);
      push(base, it.time ? it.title : `Hoje: ${it.title}`, it.time ? (it.endTime ? `${it.time}–${it.endTime}` : 'Agora') : it.type === 'study' ? 'Estudos' : 'Para hoje', data, 'feito');
    });
  });

  for (let k = 0; k < 7; k++) {
    const date = addDays(today, k);
    // antes da aula
    if (s.classAlert > 0) {
      blocksOn(state.blocks, date).forEach((e) => {
        const w = new Date(at(date, e.start).getTime() - s.classAlert * 60000);
        push(w, e.block.name, `Começa às ${e.start}${e.block.room ? ` · ${e.block.room}` : ''}`, { block: e.block.id }, null);
      });
    }
    // resumo da manhã (só nos dias que têm alguma coisa)
    if (s.morning && k < 4) {
      const parts = daySummary(state, date, now);
      if (parts.length) push(at(date, s.morning), 'Seu dia', parts.join(' · '), { summary: date }, null);
    }
  }
  out.sort((a, b) => a.when - b.when);
  return out.slice(0, MAX);
}
export { hhmm };
