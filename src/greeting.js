// Mensagens de entrada: saudação pela hora + pendências do usuário.
//   "Boa tarde, Ana."
//   "Ana, você tem 3 tarefas para hoje."
//   "Ana, você precisa concluir seus lembretes de Estudos."
import { toISO } from './utils';
import { slotsOn, slotKey } from './recurrence';

export const AREA_NAME = { task: 'Tarefas', study: 'Estudos', finance: 'Finanças' };

export function salutation(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// 1.12.3: o que ainda falta fazer hoje, incluindo o que está atrasado. É o mesmo número do
// destaque de Tarefas ("2 para fazer hoje"). Uma rotina conta enquanto tiver um horário de hoje
// sem "Feito". Item sem data ou com data futura não conta.
export function dueToday(list, now = new Date()) {
  const today = toISO(now);
  return list.filter((it) => {
    if (it.repeat) {
      const doneSet = new Set(it.doneSlots || []);
      return slotsOn(it, today).some((t) => !doneSet.has(slotKey(today, t)));
    }
    return !it.done && !!it.date && it.date <= today;
  });
}

// Feito e pendente de uma área (tarefas/estudos): itens avulsos + horários de hoje das rotinas.
// 1.12.3: pendente é só o que vence até hoje. Uma prova daqui a 6 dias, ou uma tarefa sem data,
// não fazem o app cobrar a área.
function countList(list, now) {
  const today = toISO(now);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let done = 0;
  let pending = 0;
  for (const it of list) {
    if (it.repeat) {
      const doneSet = new Set(it.doneSlots || []);
      for (const t of slotsOn(it, today)) {
        if (doneSet.has(slotKey(today, t))) done++;
        else if (t <= hm) pending++; // só conta o que já passou do horário
      }
    } else if (it.done) done++;
    else if (it.date && it.date <= today) pending++;
  }
  return { done, pending };
}

// Finanças: contas do mês (pagas x a pagar até hoje)
function countFinance(list, now) {
  const today = toISO(now);
  const month = today.slice(0, 7);
  let done = 0;
  let pending = 0;
  for (const it of list) {
    if (!it.date || !it.date.startsWith(month) || it.type === 'transfer') continue;
    if (it.status === 'pending') {
      if (it.date <= today) pending++;
    } else done++;
  }
  return { done, pending };
}

export function areaStats({ tasks = [], study = [], finance = [] }, now = new Date()) {
  return {
    task: countList(tasks, now),
    study: countList(study, now),
    finance: countFinance(finance, now),
  };
}

// Área com menos resoluções (menor proporção de feitos) que ainda tem pendências.
// Empate: mais pendências; depois a ordem de importância.
export function weakestArea(stats, order = ['task', 'finance', 'study'], exclude = []) {
  const candidates = order.filter((a) => !exclude.includes(a) && stats[a].pending > 0);
  if (!candidates.length) return null;
  const rate = (a) => stats[a].done / (stats[a].done + stats[a].pending);
  return candidates.sort((a, b) => rate(a) - rate(b) || stats[b].pending - stats[a].pending || order.indexOf(a) - order.indexOf(b))[0];
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Sequência de mensagens para a entrada no app
// extras: frases extras em minúsculas (ex.: aviso de orçamento), recebem o nome na frente
export function entryMessages(data, name, order, now = new Date(), extras = []) {
  const who = firstName(name);
  const lead = (text) => (who ? `${who}, ${text}` : text.charAt(0).toUpperCase() + text.slice(1));
  const greeting = who ? `${salutation(now)}, ${who}.` : `${salutation(now)}.`;
  const stats = areaStats(data, now);
  const messages = [];

  const t = dueToday(data.tasks || [], now).length;
  if (t > 0) messages.push(lead(`você tem ${plural(t, 'tarefa', 'tarefas')} para hoje.`));

  // se Tarefas já foi citada e é a pior, fala da próxima área
  const weak = weakestArea(stats, order, t > 0 ? ['task'] : []);
  if (weak) messages.push(lead(`você precisa concluir seus lembretes de ${AREA_NAME[weak]}.`));

  extras.filter(Boolean).forEach((x) => messages.push(lead(x)));
  if (!messages.length) messages.push(lead('tudo em dia por aqui.'));
  return { greeting, messages, stats };
}
