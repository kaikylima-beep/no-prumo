// Respostas para perguntas feitas ao Peep ("o que eu tenho amanhã?", "quanto gastei com ifood?").
// Tudo calculado no celular, a partir do que a pessoa guardou.
import { addDays, dayLabel, formatMoney, longDay, monthKey, relLabel, todayISO } from './dates.js';
import { absencesOf, dayAgenda, gradeOf, monthMoney } from './model.js';
import { absenceLine, absenceStatusText, fmtGrade, gradeStatusText } from '../legacy/academic.js';
import { norm } from './nlu.js';
import { balances } from './money.js';

const inRange = (iso, range) => !!iso && (range.month ? monthKey(iso) === range.month : iso >= range.from && iso <= range.to);

export function answer(q, state, now = new Date()) {
  const today = todayISO(now);
  const money = (v) => (state.settings.hideMoney ? 'R$ •••' : formatMoney(v));
  const subj = q.subjectId ? state.blocks.find((b) => b.id === q.subjectId) : null;

  if (q.q === 'agenda') {
    const r = q.range;
    const lines = [];
    const ids = [];
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
      const ag = dayAgenda(state, d, now);
      const rows = [];
      ag.timed.forEach((e) => {
        if (e.kind === 'block') {
          if (!q.only || q.only === 'aula') rows.push(`${e.start} ${e.block.name}`);
        } else if (matches(e.item, q.only)) {
          rows.push(`${e.time} ${e.item.title}`);
          ids.push(e.item.id);
        }
      });
      ag.loose.forEach((it) => {
        if (matches(it, q.only)) {
          rows.push(it.title);
          ids.push(it.id);
        }
      });
      if (rows.length) lines.push({ head: r.from === r.to ? null : dayLabel(d, now), rows });
    }
    const label = r.label || (r.from === today ? 'hoje' : dayLabel(r.from, now).toLowerCase());
    if (!lines.length) return { title: `Nada marcado para ${label}.`, lines: [], ids };
    const total = lines.reduce((s, l) => s + l.rows.length, 0);
    return { title: `${cap(label)}: ${total} ${total === 1 ? 'coisa' : 'coisas'}`, lines, ids };
  }

  if (q.q === 'spent' || q.q === 'received') {
    const flow = q.q === 'spent' ? 'out' : 'in';
    const term = q.term ? norm(q.term) : null;
    const hits = state.items.filter((it) => it.type === 'money' && it.done && it.flow === flow && inRange(it.date, q.range) && (!term || norm(it.title).includes(term) || norm(it.category).includes(term)));
    const total = hits.reduce((s, it) => s + it.amount, 0);
    const label = q.range.label || (q.range.from === today ? 'hoje' : dayLabel(q.range.from, now).toLowerCase());
    const verb = flow === 'out' ? 'Você gastou' : 'Entrou';
    return { title: `${verb} ${money(total)}${q.term ? ` com ${q.term}` : ''} ${label}.`, lines: hits.length ? [{ head: null, rows: hits.slice(0, 6).map((it) => `${dayLabel(it.date, now)} · ${it.title} · ${money(it.amount)}`) }] : [], ids: hits.map((h) => h.id) };
  }

  if (q.q === 'payable') {
    const hits = state.items.filter((it) => it.type === 'money' && !it.done && it.flow === 'out' && (!q.range || !it.date || inRange(it.date, q.range))).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
    const total = hits.reduce((s, it) => s + it.amount, 0);
    if (!hits.length) return { title: 'Nenhuma conta para pagar.', lines: [], ids: [] };
    return { title: `${hits.length} ${hits.length === 1 ? 'conta' : 'contas'} para pagar: ${money(total)}`, lines: [{ head: null, rows: hits.slice(0, 8).map((it) => `${it.date ? dayLabel(it.date, now) : 'Sem data'} · ${it.title} · ${money(it.amount)}`) }], ids: hits.map((h) => h.id) };
  }

  if (q.q === 'saldo') {
    const b = balances(state);
    if (!b.hasKnown) return { title: 'Ainda não sei o seu saldo.', lines: [{ head: null, rows: ['Em Dinheiro, importe um extrato ou informe quanto tem em uma conta.'] }], ids: [] };
    return { title: `Seu saldo é ${money(b.money)}.`, lines: [{ head: null, rows: b.rows.filter((r) => r.known).map((r) => `${r.name}: ${r.kind === 'cartao' ? `fatura ${money(Math.max(0, -r.balance))}` : money(r.balance)}`) }], ids: [] };
  }

  if (q.q === 'balance') {
    const m = monthMoney(state.items, monthKey(today), state.settings, now);
    if (!m.limit) return { title: `Este mês: entrou ${money(m.in)} e saiu ${money(m.out)}.`, lines: [{ head: null, rows: ['Defina um limite do mês em Dinheiro para saber quanto ainda pode gastar.'] }], ids: [] };
    return { title: m.left >= 0 ? `Ainda dá para gastar ${money(m.left)} este mês.` : `Você passou ${money(-m.left)} do limite do mês.`, lines: [{ head: null, rows: [`Gastou ${money(m.out)} de ${money(m.limit)}`, ...(m.toPay ? [`Ainda vai pagar ${money(m.toPay)} em contas`] : []), ...(m.perDay ? [`Dá ${money(m.perDay)} por dia até o fim do mês`] : [])] }], ids: [] };
  }

  if (q.q === 'when') {
    const term = q.term ? norm(q.term).replace(/^(?:a|o|minha|meu)\s+/, '') : '';
    const words = term.split(/\s+/).filter((w) => w.length > 2 && !['que', 'para', 'pra'].includes(w));
    const hits = state.items
      .filter((it) => !it.done && it.date && it.date >= today)
      .map((it) => {
        const title = norm(it.title);
        let score = words.filter((w) => title.includes(w)).length;
        if (subj && it.subjectId === subj.id) score += 2;
        if (/prova/.test(term) && it.studyKind === 'prova') score += 1;
        return { it, score };
      })
      .filter((x) => x.score >= Math.max(1, Math.min(2, words.length)))
      .sort((a, b) => b.score - a.score || a.it.date.localeCompare(b.it.date));
    if (!hits.length) {
      // pode ser uma aula
      const b = subj || state.blocks.find((x) => !x.archived && words.some((w) => norm(x.name).includes(w)));
      if (b) {
        for (let i = 0; i < 8; i++) {
          const d = addDays(today, i);
          const slot = (b.slots || []).find((s) => s.days.includes(new Date(d + 'T12:00').getDay()));
          if (slot) return { title: `${b.name}: ${dayLabel(d, now).toLowerCase()} às ${slot.start}.`, lines: [], ids: [] };
        }
      }
      return { title: 'Não achei nada com esse nome nos próximos dias.', lines: [], ids: [] };
    }
    const top = hits[0].it;
    return { title: `${top.title}: ${longDay(top.date).toLowerCase()}${top.time ? ` às ${top.time}` : ''} (${relLabel(top.date, now)}).`, lines: hits.length > 1 ? [{ head: 'Também achei', rows: hits.slice(1, 4).map((h) => `${dayLabel(h.it.date, now)} · ${h.it.title}`) }] : [], ids: hits.map((h) => h.it.id) };
  }

  if (q.q === 'absences') {
    const list = subj ? [subj] : state.blocks.filter((b) => b.kind === 'class' && !b.archived);
    if (!list.length) return { title: 'Você ainda não cadastrou matérias.', lines: [], ids: [] };
    const rows = list.map((b) => {
      const a = absencesOf(b, state.settings);
      return `${b.name}: ${a.count} ${a.count === 1 ? 'falta' : 'faltas'}${a.left !== null ? ` · ${absenceStatusText(a).toLowerCase()}` : ''}`;
    });
    return subj ? { title: rows[0] + '.', lines: [], ids: [] } : { title: 'Suas faltas', lines: [{ head: null, rows }], ids: [] };
  }

  if (q.q === 'grade') {
    const list = subj ? [subj] : state.blocks.filter((b) => b.kind === 'class' && !b.archived);
    if (!list.length) return { title: 'Você ainda não cadastrou matérias.', lines: [], ids: [] };
    const rows = list.map((b) => {
      const g = gradeOf(b, state.settings);
      const marks = (b.grades || []).filter((x) => x.score !== null && x.score !== undefined);
      if (!marks.length) return `${b.name}: sem notas ainda`;
      if (g.average === null) return `${b.name}: ${marks.map((x) => `${x.name} ${fmtGrade(x.score)}`).join(', ')}`;
      const st = gradeStatusText(g, { ...(state.settings.academic || {}) });
      return `${b.name}: média ${fmtGrade(g.average)}${st ? ` · ${st.toLowerCase()}` : ''}`;
    });
    return subj ? { title: rows[0] + '.', lines: [], ids: [] } : { title: 'Suas médias', lines: [{ head: null, rows }], ids: [] };
  }
  return { title: 'Ainda não sei responder isso.', lines: [], ids: [] };
}

const matches = (it, only) => !only || (only === 'prova' && it.type === 'study' && it.studyKind === 'prova') || (only === 'money' && it.type === 'money') || false;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
