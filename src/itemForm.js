// Conversão entre um item e os campos de texto editáveis (usado na
// confirmação depois de falar e na edição de um item existente).
import { formatBR, parseBR, parseMoney, parseTime, todayISO, nowHHMM, formatMoney, shortBR } from './utils';
import { addDays } from './parser';
import { describe, firstOccurrence } from './recurrence';
import { essentialDefault } from './budget';

let counter = 0;

export function toEditable(kind, p) {
  const rep = kind !== 'finance' && p.repeat && typeof p.repeat === 'object' ? p.repeat : null;
  const times = rep ? (p.times && p.times.length ? p.times : [p.time || '08:00']) : [];
  const timesText = times.join(', ');
  return {
    key: `i${++counter}`,
    kind,
    raw: p.raw || p.note || '',
    title: p.title || '',
    dateText: p.date ? formatBR(p.date) : '',
    timeText: p.time || '',
    leadText: p.lead !== null && p.lead !== undefined ? String(p.lead) : '',
    amountText:
      p.amount !== null && p.amount !== undefined
        ? (Number.isInteger(p.amount) ? String(p.amount) : p.amount.toFixed(2)).replace('.', ',')
        : '',
    type: p.type || 'out',
    category: p.category || 'Outros',
    status: p.status || 'paid',
    repeat: kind === 'finance' ? !!p.repeat : false, // finanças: repetir todo mês
    recId: p.recId || null,
    // conta (entrada/saída) ou contas de origem e destino (transferência); undefined = conta padrão
    account: p.account === undefined ? undefined : p.account,
    from: p.from || null,
    to: p.to || null,
    // finanças: gasto necessário ou não
    essential:
      kind === 'finance'
        ? p.essential === undefined || p.essential === null
          ? essentialDefault(p.category || 'Outros', p.title || '')
          : !!p.essential
        : null,
    // tarefas e estudos: repetição
    repeatMode: rep ? rep.freq : 'none',
    repeatDays: rep && rep.days ? rep.days : [new Date().getDay()],
    repeatDay: String(rep && rep.day ? rep.day : p.date ? Number(p.date.slice(8, 10)) : new Date().getDate()),
    timesText,
    interval: rep && rep.interval ? rep.interval : null,
    origTimesText: timesText,
    // estudos: matéria (1.12) e a pergunta "Faculdade ou estágio?" na confirmação
    subjectId: kind === 'study' ? p.subjectId || null : null,
    askPlace: !!p.askPlace,
    // 1.12.1: horário de hoje que já passou: a confirmação pergunta hoje ou amanhã
    askDay: kind !== 'finance' && !!p.askDay,
    // título como o app entendeu (se a pessoa corrigir, o app aprende a troca)
    origTitle: p.title || '',
  };
}

// "08:00, 20:00" / "8h e 20h" -> ['08:00', '20:00'] (ou null se algum for inválido)
function parseTimesText(text) {
  const parts = String(text || '')
    .split(/\s*(?:,|;|\be\b|\s)\s*/)
    .map((s) => s.trim().replace(/h$/i, '').replace(/h(\d{2})$/i, ':$1'))
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    const t = parseTime(p);
    if (!t) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out.sort();
}

// Repetição a partir dos campos (ou { error })
function repeatFromEditable(e) {
  if (e.kind === 'finance' || !e.repeatMode || e.repeatMode === 'none') return { rep: null };
  const times = parseTimesText(e.timesText);
  if (times === null) return { error: `Horário inválido em "${e.title.trim()}". Use HH:MM, separados por vírgula.` };
  const rep = { freq: e.repeatMode };
  if (rep.freq === 'weekly') {
    if (!e.repeatDays || !e.repeatDays.length) return { error: 'Escolha pelo menos um dia da semana.' };
    rep.days = [...e.repeatDays].sort();
  }
  if (rep.freq === 'monthly') {
    const d = Number(e.repeatDay);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { error: 'Dia do mês precisa ser de 1 a 31.' };
    rep.day = d;
  }
  if (rep.freq === 'daily' && e.interval && e.timesText === e.origTimesText) rep.interval = e.interval;
  return { rep, times: times.length ? times : ['08:00'] };
}

// Valida e devolve { error } ou { data }
export function readEditable(e) {
  const title = (e.title || '').trim() || (e.kind === 'finance' && e.type === 'transfer' ? 'Transferência' : '');
  if (!title) return { error: 'Falta o nome do item.' };
  const today = todayISO();

  let date = null;
  if (e.dateText) {
    date = parseBR(e.dateText);
    if (!date) return { error: `Data inválida em "${title}". Use DD/MM/AAAA.` };
  }

  if (e.kind === 'finance') {
    const amount = parseMoney(e.amountText);
    if (amount === null || amount <= 0) return { error: `Falta o valor de "${title}".` };
    if (e.type === 'transfer') {
      if (!e.from && !e.to) return { error: `Escolha de qual conta sai ou para qual conta vai "${title}".` };
      if (e.from && e.from === e.to) return { error: `A transferência "${title}" sai e entra na mesma conta.` };
      return {
        data: {
          title,
          amount,
          type: 'transfer',
          category: 'Transferência',
          date: date || today,
          status: 'paid',
          repeat: e.repeat,
          essential: null,
          account: null,
          from: e.from || null,
          to: e.to || null,
          note: e.raw || null,
        },
      };
    }
    const data = {
      title,
      amount,
      type: e.type,
      category: e.category === 'Transferência' ? 'Outros' : e.category,
      date: date || today,
      status: e.status,
      repeat: e.repeat,
      essential: e.type === 'out' ? !!e.essential : null,
      from: null,
      to: null,
      note: e.raw || null,
    };
    // só manda a conta quando ela foi escolhida (senão o app usa a conta principal)
    if (e.account !== undefined) data.account = e.account;
    return { data };
  }

  // lembrete que se repete
  const r = repeatFromEditable(e);
  if (r.error) return { error: r.error };
  if (r.rep) {
    return {
      data: {
        title,
        date: firstOccurrence(r.rep, r.times, new Date()),
        time: r.times[0],
        times: r.times,
        repeat: r.rep,
        lead: null,
        done: false,
        note: e.raw || null,
        ...(e.kind === 'study' ? { subjectId: e.subjectId || null } : null),
      },
    };
  }

  let time = null;
  if (e.timeText) {
    time = parseTime(e.timeText);
    if (!time) return { error: `Horário inválido em "${title}". Use HH:MM.` };
  }
  // horário sem data: hoje, ou amanhã se o horário já passou
  if (time && !date) date = time > nowHHMM() ? today : addDays(today, 1);

  let lead = null;
  if (e.leadText !== '' && date) {
    const n = Number(e.leadText);
    if (!Number.isInteger(n) || n < 0) return { error: `"Avisar antes" precisa ser um número em "${title}".` };
    lead = n;
  }
  return { data: { title, date, time, lead, repeat: null, times: null, note: e.raw || null, ...(e.kind === 'study' ? { subjectId: e.subjectId || null } : null) } };
}

// Uma linha de resumo para a confirmação compacta
export function summarize(e) {
  const date = e.dateText ? parseBR(e.dateText) : null;
  if (e.kind === 'finance') {
    const amount = parseMoney(e.amountText);
    if (e.type === 'transfer') {
      const parts = [amount ? formatMoney(amount) : 'sem valor', 'transferência entre suas contas'];
      if (date) parts.push(shortBR(date));
      return parts.join(' · ');
    }
    const parts = [amount ? formatMoney(amount) : 'sem valor', e.category];
    if (e.type === 'out') parts.push(e.essential ? 'necessário' : 'não necessário');
    const pending = e.status === 'pending';
    if (e.type === 'in') parts.push(pending ? 'a receber' : 'recebido');
    else parts.push(pending ? 'a pagar' : 'pago');
    if (date) parts.push(shortBR(date));
    if (e.repeat) parts.push('todo mês');
    return parts.join(' · ');
  }
  const r = repeatFromEditable(e);
  if (r.rep) return describe(r.rep, r.times);
  const parts = [];
  if (date) parts.push(shortBR(date));
  if (e.timeText) parts.push(e.timeText);
  if (e.leadText !== '' && date) parts.push(`aviso ${e.leadText} ${e.leadText === '1' ? 'dia' : 'dias'} antes`);
  if (!parts.length) parts.push('sem data');
  return parts.join(' · ');
}
