// Testes do Peep: node scripts/test.mjs
// Cada frase tem o resultado esperado. Nomes de pessoas são inventados.
import { parse } from '../src/core/nlu.js';
import { EMPTY_STATE, applyActions, complete, dayAgenda, gradeOf, absencesOf, groupItems, makeBlock, makeItem, monthMoney, nextDate, nowAndNext, occursOn } from '../src/core/model.js';
import { planReminders } from '../src/core/plan.js';
import { answer } from '../src/core/answers.js';
import { applyLearned, diffWords, learn } from '../src/core/learn.js';
import { fromOldStorage, makeBackup, readBackup, sanitize } from '../src/core/migrate.js';
import { applyImport, balances, cleanTitle, guessAccount, prepareImport } from '../src/core/money.js';
import { parseDocument } from '../src/legacy/documentParser.js';
import { holidaysOfMonth } from '../src/legacy/holidays.js';

const now = new Date(2026, 10, 10, 14, 0); // terça, 10/11/2026, 14h
const subjects = [
  { id: 's1', name: 'Cálculo 2', aliases: ['calc 2'] },
  { id: 's2', name: 'Física 1', aliases: [] },
  { id: 's3', name: 'Circuitos Elétricos', aliases: ['circuitos'] },
];
let pass = 0;
const fails = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`${name}\n   esperado: ${JSON.stringify(want)}\n   veio:     ${JSON.stringify(got)}`);
};
const P = (text) => parse(text, { now, subjects });
// resumo curto de um item, para comparar
const brief = (i) => [i.type === 'money' ? `$${i.flow}${i.amount}${i.paid ? 'pago' : 'pend'}` : i.type, i.title, i.date ? i.date.slice(5) : '-', i.time || '-', i.repeat ? i.repeat.freq + (i.repeat.days ? i.repeat.days.join('') : i.repeat.day || '') : ''].join('|').replace(/\|$/, '');
const phrase = (text, ...want) => eq(`"${text}"`, P(text).items.map(brief), want);

// ── campo Testes do Prumo (as 4 frases que o app antigo errou) ──
phrase('quando eu chegar em casa hoje eu preciso lavar o carro umas 10 horas da noite fazer o pix do Bruno de R$ 60 estudar para prova de química', 'task|Lavar o carro|11-10|22:00', '$out60pend|Pix do Bruno|-|-', 'study|Estudar para prova de química|-|-');
phrase('comer salada 3 horas da tarde', 'task|Comer salada|11-10|15:00');
phrase('fazer o pix do Rafa de R$ 60', '$out60pend|Pix do Rafa|-|-');
phrase('fiz o pix do Rafa de 60 reais', '$out60pago|Pix do Rafa|11-10|-');
phrase('Chegando em casa eu tenho que lavar o carro lá para as 10 horas', 'task|Lavar o carro|11-10|22:00');
phrase('saindo do trabalho eu preciso passar no mercado', 'task|Passar no mercado|-|-');
phrase('saindo da aula preciso pagar o boleto 80 reais', '$out80pend|Boleto|-|-');

// ── tarefas ──
phrase('amanhã às 9h ligar pro banco', 'task|Ligar pro banco|11-11|09:00');
phrase('comprar pão amanhã!', 'task|Comprar pão|11-11|-');
phrase('lavar o carro na sexta', 'task|Lavar o carro|11-13|-');
phrase('devolver o livro da biblioteca dia 20', 'task|Devolver o livro da biblioteca|11-20|-');
phrase('me lembra de ligar pra minha mãe às 19h', 'task|Ligar pra minha mãe|11-10|19:00');
phrase('tomar remédio às 8 da noite', 'task|Tomar remédio|11-10|20:00');
phrase('tomar remédio da diabetes em 4 horas', 'task|Tomar remédio da diabetes|11-10|18:00');
phrase('daqui a 20 minutos tirar a roupa da máquina', 'task|Tirar a roupa da máquina|11-10|14:20');
phrase('dentista dia 3 às 14h', 'task|Dentista|12-03|14:00');
phrase('marcar dentista', 'task|Marcar dentista|-|-');
phrase('aniversário da mãe 12 de março', 'task|Aniversário da mãe|03-12|-');
phrase('reunião com o orientador quinta às 15h30', 'task|Reunião com o orientador|11-12|15:30');
phrase('ler 30 páginas às 21h', 'task|Ler 30 páginas|11-10|21:00');
phrase('relatório do trabalho sexta', 'task|Relatório do trabalho|11-13|-');
phrase('comprar 2 pizzas, 3 refrigerantes', 'task|Comprar 2 pizzas 3 refrigerantes|-|-');
phrase('comprar arroz e feijão amanhã', 'task|Comprar arroz e feijão|11-11|-');
// ── repetição ──
phrase('Tomar remédio. Todo dia às 9h', 'task|Tomar remédio|11-10|09:00|daily');
phrase('alongar toda manhã', 'task|Alongar|11-10|09:00|daily');
phrase('regar as plantas toda semana', 'task|Regar as plantas|11-10|-|weekly2');
phrase('academia segunda quarta e sexta às 7 da manhã', 'task|Academia|11-11|07:00|weekly135');
phrase('beber água de 2 em 2 horas', 'task|Beber água|11-10|-|hours');
// ── fala corrida ──
phrase('hoje às 22h lavar a louça arrumar o quarto', 'task|Lavar a louça|11-10|22:00', 'task|Arrumar o quarto|11-10|-');
phrase('lavar roupa, arrumar o quarto e estudar física', 'task|Lavar roupa|-|-', 'task|Arrumar o quarto|-|-', 'study|Estudar física|-|-');
phrase('sexta tenho prova de física às 8 e preciso levar a calculadora', 'study|Prova de física|11-13|08:00', 'task|Levar a calculadora|11-13|-');
phrase('comprar presente da Ana e ligar pro dentista amanhã de manhã', 'task|Comprar presente da Ana|-|-', 'task|Ligar pro dentista|11-11|09:00');
// ── estudos ──
phrase('Prova de circuitos pro dia 27, me lembrar 4 dias antes', 'study|Prova de circuitos|11-27|-');
phrase('Seminário de redes 15/12 às 14h', 'study|Seminário de redes|12-15|14:00');
phrase('tenho prova de cálculo dia 2 de dezembro', 'study|Prova de cálculo|12-02|-');
phrase('prova de calculo dois amanhã', 'study|Prova de calculo dois|11-11|-');
phrase('prova dia 27 e trabalho de física dia 30', 'study|Prova|11-27|-', 'study|Trabalho de física|11-30|-');
phrase('estudar capítulo 3 de circuitos amanhã', 'study|Estudar capítulo 3 de circuitos|11-11|-');
phrase('fazer a lista de exercícios de física pra segunda', 'study|Fazer a lista de exercícios de física|11-16|-');
phrase('preciso entregar o trabalho de circuitos até sexta que vem', 'study|Entregar o trabalho de circuitos|11-20|-');
eq('lembrete em dias', P('Prova de circuitos pro dia 27, me lembrar 4 dias antes').items[0].remind, 5760);
eq('matéria reconhecida', P('prova de calculo dois amanhã').items[0].subjectId, 's1');
eq('tipo prova', P('Seminário de redes 15/12 às 14h').items[0].studyKind, 'prova');
eq('tipo entrega', P('fazer a lista de exercícios de física pra segunda').items[0].studyKind, 'entrega');
// ── dinheiro ──
phrase('gastei 32 reais no ifood', '$out32pago|Ifood|11-10|-');
phrase('almoço 25', '$out25pago|Almoço|11-10|-');
phrase('uber 18,90 ontem', '$out18.9pago|Uber|11-09|-');
phrase('paguei 45 na farmácia', '$out45pago|Farmácia|11-10|-');
phrase('comprei um tênis de 250 reais', '$out250pago|Tênis|11-10|-');
phrase('paguei livro de calc 2 80 reais', '$out80pago|Livro de calc 2|11-10|-');
phrase('recebi 800 da bolsa', '$in800pago|Bolsa|11-10|-');
phrase('Vou receber salário de 4500 reais dia 5', '$in4500pend|Salário|12-05|-');
phrase('conta de luz 120 amanhã', '$out120pend|Conta de luz|11-11|-');
phrase('pix do João 200 reais', '$out200pend|Pix do João|-|-');
phrase('transferir 100 reais para a Bia', '$out100pend|Pix para Bia|-|-');
phrase('mandar 50 reais pro Caio', '$out50pend|Pix para Caio|-|-');
phrase('pagar 50 pro Lucas amanhã', '$out50pend|Pagar Lucas|11-11|-');
phrase('o Lucas me deve 50 reais', '$in50pend|Lucas me deve|-|-');
phrase('internet 120 reais todo mês', '$out120pend|Internet|11-10|-|monthly10');
phrase('netflix 39,90 todo dia 15', '$out39.9pend|Netflix|11-15|-|monthly15');
phrase('conta de luz 180,50, água 95 e aluguel 1800 todo dia 5', '$out180.5pend|Conta de luz|12-05|-|monthly5', '$out95pend|Água|12-05|-|monthly5', '$out1800pend|Aluguel|12-05|-|monthly5');
phrase('pagar o aluguel de 900 reais dia 5 e a internet de 100 dia 12', '$out900pend|Aluguel|12-05|-', '$out100pend|Internet|11-12|-');
phrase('gastei 32 reais no ifood, uber 18,90 ontem e conta de luz 120 amanhã', '$out32pago|Ifood|11-10|-', '$out18.9pago|Uber|11-09|-', '$out120pend|Conta de luz|11-11|-');
phrase('gastei 32 no ifood, uber 18 ontem', '$out32pago|Ifood|11-10|-', '$out18pago|Uber|11-09|-');
eq('categoria', P('gastei 32 reais no ifood').items[0].category, 'Alimentação');
eq('categoria transporte', P('uber 18,90 ontem').items[0].category, 'Transporte');
// ── ações e perguntas ──
eq('nota', P('tirei 7,5 na P1 de cálculo 2').actions[0], { type: 'grade', score: 7.5, max: 10, name: 'P1', subjectId: 's1', subjectName: 'Cálculo 2' });
eq('nota trabalho', P('tirei 8 no trabalho de física').actions[0].name, 'Trabalho');
eq('falta', P('faltei na aula de física').actions[0], { type: 'absence', date: '2026-11-10', subjectId: 's2', subjectName: 'Física 1' });
eq('falta do dia', P('faltei hoje').actions[0].subjectId, null);
eq('horário de aula', P('aula de cálculo 2 segunda e quarta das 10 às 12').actions[0], { type: 'schedule', block: 'class', name: 'Cálculo 2', subjectId: 's1', days: [1, 3], start: '10:00', end: '12:00' });
eq('horário fixo', P('estágio de segunda a sexta das 13 às 18').actions[0], { type: 'schedule', block: 'fixed', name: 'Estágio', subjectId: null, days: [1, 2, 3, 4, 5], start: '13:00', end: '18:00' });
eq('pergunta agenda', P('o que eu tenho amanhã?').query.q, 'agenda');
eq('pergunta gasto', P('quanto gastei com ifood este mês').query, { q: 'spent', term: 'ifood', range: { month: '2026-11', label: 'este mês' } });
eq('pergunta quando', P('quando é a prova de cálculo 2').query.q, 'when');
eq('pergunta faltas', P('quantas faltas eu tenho em física').query, { q: 'absences', subjectId: 's2' });
eq('"quando eu chegar" não é pergunta', P('quando eu chegar em casa lavar a louça').query, null);


// ── campo Testes nº 5 e 6 (11/11) e frases parecidas ──
eq('nº 5: aulas em dois dias com horários diferentes', parse('Aulas de circuitos análise de circuitos a as quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20 que isso te.', { now, subjects: [] }).actions[0], { type: 'schedule', block: 'class', name: 'Análise de circuitos', subjectId: null, days: [4], start: '21:20', end: '23:00', slots: [{ days: [4], start: '21:20', end: '23:00' }, { days: [5], start: '18:20', end: '20:20' }] });
eq('aula no plural do dia', P('tenho aula de inglês às terças das 19 às 20:30').actions[0], { type: 'schedule', block: 'class', name: 'Inglês', subjectId: null, days: [2], start: '19:00', end: '20:30' });
eq('aulas de X, um dia só', [P('aulas de química toda quarta das 8 às 10').actions[0].name, P('aulas de química toda quarta das 8 às 10').actions[0].days], ['Química', [3]]);
eq('uma aula avulsa continua sendo item', P('aula de cálculo 2 segunda das 10 às 12').items.map(brief), ['study|Aula de cálculo 2|11-16|10:00']);
const dur = (text) => P(text).items.map((i) => `${i.title}|${i.date ? i.date.slice(5) : '-'}|${i.time || '-'}|${i.duration || '-'}`);
eq('nº 6: duração e sequência', dur('Eu tenho 10 minutos para lavar louça e depois disso eu tenho que arrumar o quarto em 30 minutos.'), ['Lavar louça|11-10|-|10', 'Arrumar o quarto|11-10|-|30']);
eq('por N minutos', dur('estudar por 40 minutos e depois descansar em 10 minutos'), ['Estudar|11-10|-|40', 'Descansar|11-10|-|10']);
eq('"em 4 horas" sozinho continua sendo quando começa', dur('tomar remédio em 4 horas'), ['Tomar remédio|11-10|18:00|-']);
eq('tenho meia hora para', dur('tenho meia hora para arrumar a mochila'), ['Arrumar a mochila|11-10|-|30']);
const two = applyActions([], parse('Aulas de circuitos análise de circuitos a as quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20', { now, subjects: [] }).actions, now).blocks;
eq('matéria criada com os dois horários', [two[0].name, two[0].slots.length], ['Análise de circuitos', 2]);


// ── 1.14: entender = motor da 1.13.1 + perguntas, nota, falta, horários e duração ──
{
  const { understand } = await import('../src/core/understand.js');
  const { VOICE_BANK, BANK_NOW } = await import('./fixtures/banco-voz.mjs');
  const bnow = new Date(...BANK_NOW);
  const KIND = { task: 'task', study: 'study', money: 'finance' };
  // "aula de X toda terça às 19h" virou horário da matéria (ação), de propósito
  const SCHEDULE = new Set(['aula de inglês toda terça e quinta às 19h', 'aula de violão toda quarta às oito da noite']);
  let right = 0;
  let open = 0;
  const wrong = [];
  VOICE_BANK.forEach(([, phrase, expected, isOpen]) => {
    const r = understand(phrase, { now: bnow, blocks: [] });
    if (SCHEDULE.has(phrase)) {
      if (r.actions[0] && r.actions[0].type === 'schedule') right++;
      else wrong.push(phrase);
      return;
    }
    const got = r.items.map((i) => ({ kind: KIND[i.type], title: i.title, date: i.date, time: i.time, amount: i.type === 'money' ? i.amount : null, type: i.type === 'money' ? i.flow : null, status: i.type === 'money' ? (i.paid ? 'paid' : 'pending') : null }));
    const okAll = got.length === expected.length && expected.every((e, i) => Object.entries(e).every(([k, v]) => !(k in got[i]) || JSON.stringify(got[i][k] ?? null) === JSON.stringify(v)));
    if (okAll) right++;
    else if (isOpen) open++;
    else wrong.push(phrase);
  });
  eq(`banco de fala natural pela camada nova (${right}/${VOICE_BANK.length}, ${open} abertas)`, wrong, []);
  const U = (text, blocks = []) => understand(text, { now, blocks, settings: {} });
  const cls = [{ id: 'c1', kind: 'class', name: 'Cálculo 2', aliases: [], slots: [{ days: [1, 3], start: '10:00', end: '12:00' }], grades: [], absences: [] }, { id: 'c2', kind: 'class', name: 'Física 1', aliases: [], slots: [{ days: [2], start: '08:00', end: '10:00' }], grades: [], absences: [] }];
  eq('nº 5 pela camada nova', U('Aulas de circuitos análise de circuitos a as quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20 que isso te.').actions.map((a) => [a.name, a.slots.map((s) => `${s.days}:${s.start}-${s.end}`)]), [['Análise de circuitos', ['4:21:20-23:00', '5:18:20-20:20']]]);
  eq('nº 6 pela camada nova', U('Eu tenho 10 minutos para lavar louça e depois disso eu tenho que arrumar o quarto em 30 minutos.').items.map((i) => [i.title, i.duration, i.time]), [['Lavar louça', 10, null], ['Arrumar o quarto', 30, null]]);
  eq('nota e falta na mesma frase', U('tirei 7,5 na P1 de cálculo 2 e faltei na aula de física', cls).actions.map((a) => [a.type, a.subjectId, a.score || a.count]), [['grade', 'c1', 7.5], ['absence', 'c2', 2]]);
  eq('faltei hoje = todas as aulas do dia (terça)', U('faltei hoje', cls).actions.map((a) => a.subjectId), ['c2']);
  eq('pergunta não vira tarefa', [U('o que eu tenho amanhã?').query.q, U('o que eu tenho amanhã?').items.length], ['agenda', 0]);
  eq('remédio 3 vezes ao dia', U('tomar remédio 3 vezes ao dia').items.map((i) => [i.repeat.freq, i.times]), [['daily', ['06:00', '14:00', '22:00']]]);
  eq('faixa de horário guarda o fim', U('reunião das 15 às 16').items.map((i) => [i.time, i.endTime]), [['15:00', '16:00']]);
  eq('vários gastos', U('gastei 30 no almoço 15 no uber e 8 no café').items.map((i) => [i.title, i.amount, i.paid]), [['Restaurante', 30, true], ['Uber', 15, true], ['Café', 8, true]]);
}

// ── regras ──
let st = { ...EMPTY_STATE, items: [], blocks: [] };
const add = (text) => {
  const r = parse(text, { now, subjects: st.blocks });
  st = { ...st, items: [...st.items, ...r.items.map((i) => makeItem(i, now))], blocks: applyActions(st.blocks, r.actions, now).blocks };
  return r;
};
add('aula de cálculo 2 segunda e quarta das 10 às 12');
add('estágio de segunda a sexta das 15 às 18');
add('prova de cálculo 2 dia 20 às 10h');
add('conta de luz 120 amanhã');
add('gastei 32 no ifood');
add('lavar o carro hoje às 18h');
add('tomar remédio todo dia às 21h');
add('tirei 7,5 na P1 de cálculo 2');
add('faltei na aula de cálculo 2 ontem');
const calc = st.blocks.find((b) => b.name === 'Cálculo 2');
eq('matéria criada pela voz (falta = 2 aulas de 50 min)', [calc.kind, calc.slots.length, calc.grades.length, calc.absences.map((a) => [a.date, a.count])], ['class', 1, 1, [['2026-11-09', 2]]]);
eq('prova ligada à matéria', st.items[0].subjectId, calc.id);
const ag = dayAgenda(st, '2026-11-10', now);
eq('agenda de hoje', ag.timed.map((e) => `${e.time} ${e.kind === 'block' ? e.block.name : e.item.title}`), ['15:00 Estágio', '18:00 Lavar o carro', '21:00 Tomar remédio']);
const nn = nowAndNext(ag, now);
eq('a seguir', [nn.current, nn.next.block.name, nn.minutesToNext], [null, 'Estágio', 60]);
const tomorrow = dayAgenda(st, '2026-11-11', now);
eq('amanhã tem aula e o remédio que se repete', tomorrow.timed.map((e) => (e.kind === 'block' ? e.block.name : e.item.title + (e.item.ghost ? '*' : ''))), ['Cálculo 2', 'Estágio', 'Tomar remédio*']);
eq('repete', [occursOn({ freq: 'weekly', days: [1, 3] }, '2026-11-09', '2026-11-11'), occursOn({ freq: 'monthly', day: 31 }, '2026-10-31', '2026-11-30'), nextDate({ freq: 'monthly', day: 31 }, '2027-01-31', '2027-01-31')], [true, true, '2027-02-28']);
const m = monthMoney(st.items, '2026-11', { monthLimit: 1000 }, now);
eq('mês', [m.out, m.toPay, m.left, m.daysLeft], [32, 120, 848, 21]);
const remedio = st.items.find((i) => i.title === 'Tomar remédio');
const after = complete(st.items, remedio.id, now).find((i) => i.id === remedio.id);
eq('feito em item que se repete anda para o próximo dia', [after.done, after.date], [false, '2026-11-11']);
const luz = st.items.find((i) => i.title === 'Conta de luz');
eq('pagar conta', complete(st.items, luz.id, now).find((i) => i.id === luz.id).done, true);
const bill = makeItem({ type: 'money', title: 'Internet', amount: 100, date: '2026-11-12', repeat: { freq: 'monthly', day: 12 } }, now);
const paidBill = complete([bill], bill.id, now);
eq('conta mensal paga: guarda o pagamento e cria a próxima', paidBill.map((i) => [i.done, i.date, !!i.repeat]), [[true, '2026-11-10', false], [false, '2026-12-12', true]]);
eq('grupos', Object.fromEntries(Object.entries(groupItems(st.items, now)).map(([k, v]) => [k, v.length])), { late: 0, today: 2, tomorrow: 1, week: 0, later: 1, someday: 0, done: 1 });
eq('notas sem peso: o app não inventa média', gradeOf({ grades: [{ score: 6 }, { score: 8 }] }, {}).average, null);
const g = gradeOf({ grades: [{ name: 'P1', score: 5, weight: 40 }, { name: 'P2', score: 8, weight: 20 }, { name: 'P3', score: null, weight: 40 }] }, {});
eq('quanto falta com pesos', [g.average, g.needed, g.status], [6, 6, 'needs']);
const fis = { slots: [{ days: [2], start: '08:00', end: '09:40' }], absences: [{ date: '2026-11-03', count: 2 }, { date: '2026-11-10', count: 2 }] };
const sum = absencesOf(fis, { semester: { start: '2026-08-03', end: '2026-12-11' }, state: 'PR' });
eq('faltas por aula de 50 min, semestre sem feriados', [sum.count, sum.total, sum.limit, sum.left], [4, 38, 9, 5]);
// ── avisos ──
const plan = planReminders(st, now).map((r) => `${String(r.when.getDate()).padStart(2, '0')} ${String(r.when.getHours()).padStart(2, '0')}:${String(r.when.getMinutes()).padStart(2, '0')} ${r.title} | ${r.body}`);
eq('avisos de hoje', plan.filter((p) => p.startsWith('10 ')), ['10 14:50 Estágio | Começa às 15:00', '10 18:00 Vence amanhã | Conta de luz · R$ 120,00', '10 18:00 Lavar o carro | Agora', '10 21:00 Tomar remédio | Agora']);
eq('avisos da prova', plan.filter((p) => /Prova de cálculo/.test(p)).map((p) => p.split(' | ')[0]), ['13 18:00 Faltam 7 dias', '17 18:00 Faltam 3 dias', '19 18:00 É amanhã', '20 09:00 Daqui a 1 hora', '20 10:00 Prova de cálculo 2']);
eq('resumo da manhã', plan.find((p) => p.startsWith('11 07:00')), '11 07:00 Seu dia | 1 aula · 1 tarefa · 1 conta para pagar');
eq('valor escondido no aviso', planReminders({ ...st, settings: { ...st.settings, hideMoney: true } }, now).some((r) => /R\$/.test(r.body)), false);
eq('nada no passado', planReminders(st, now).every((r) => r.when > now), true);
// ── respostas ──
eq('resposta agenda', answer(P('o que eu tenho amanhã?').query, st, now).title, 'Amanhã: 4 coisas');
eq('resposta gasto', answer(parse('quanto gastei com ifood este mês', { now, subjects: st.blocks }).query, st, now).title, 'Você gastou R$ 32,00 com ifood este mês.');
eq('resposta quando', answer(parse('quando é a prova de cálculo 2', { now, subjects: st.blocks }).query, st, now).title, 'Prova de cálculo 2: sexta, 20 de novembro às 10:00 (em 10 dias).');
eq('resposta faltas', answer(parse('quantas faltas eu tenho em cálculo 2', { now, subjects: st.blocks }).query, st, now).title, 'Cálculo 2: 2 faltas.');
// ── dicionário pessoal ──
eq('diferença', diffWords('fazer o pics do Rafa', 'fazer o pix do Rafa'), [['pics', 'pix']]);
eq('número trocado não é erro de ouvido', diffWords('pagar 60 reais', 'pagar 80 reais'), []);
let dict = learn({}, 'fazer o pics do Rafa', 'fazer o pix do Rafa');
dict = learn(dict, 'mandar um pics', 'mandar um pix');
eq('aprende na 2ª vez', dict.pics, { to: 'pix', n: 2 });
eq('aplica', applyLearned('Fazer um Pics de 20.', dict).text, 'Fazer um pix de 20.');
eq('palavra inteira', applyLearned('topics legais', dict).text, 'topics legais');
// ── backup ──
const back = readBackup(JSON.stringify(makeBackup(st, now)), now);
eq('backup vai e volta', [back.from, back.state.items.length, back.state.blocks.length], ['novo', st.items.length, st.blocks.length]);
eq('arquivo estranho', !!readBackup('{"a":1}').error && !!readBackup('nada').error, true);
eq('dado quebrado não derruba', sanitize({ items: [null, { id: 1 }], blocks: 'x' }).items.length, 0);
const prumo = readBackup(JSON.stringify({ app: 'no-prumo', format: 1, data: {
  '@org2/tasks': JSON.stringify([{ id: 't1', title: 'Lavar o carro', date: '2026-11-12', time: '18:00', done: false }, { id: 't2', title: 'Remédio', repeat: { freq: 'daily' }, times: ['21:00'] }]),
  '@org2/study': JSON.stringify([{ id: 'e1', title: 'Prova de Cálculo', date: '2026-11-20', subjectId: 'm1', lead: 3 }]),
  '@org2/subjects': JSON.stringify([{ id: 'm1', name: 'Cálculo 2', aliases: ['calc 2'], color: 2, schedules: [{ days: [1, 3], start: '10:00', end: '12:00' }] }]),
  '@org2/finance': JSON.stringify([{ id: 'f1', type: 'out', title: 'Mercado', amount: 80, category: 'Alimentação', date: '2026-11-08', status: 'paid' }, { id: 'f2', type: 'transfer', title: 'Entre contas', amount: 500, date: '2026-11-08', status: 'paid' }]),
  '@org2/recurrences': JSON.stringify([{ id: 'r1', title: 'Internet', amount: 100, type: 'out', category: 'Contas', day: 12, generated: [] }]),
  '@org2/settings': JSON.stringify({ profile: { name: 'Teste' }, budget: { salary: 2000, target: 300 }, voice: { learned: { pics: { to: 'pix', n: 2 } } } }),
} }), now);
eq('backup do Prumo', [prumo.from, prumo.counts, prumo.state.settings.name, prumo.state.settings.monthLimit, prumo.state.settings.learned.pics.to], ['prumo', { items: 6, blocks: 1, accounts: 0 }, 'Teste', 1700, 'pix']);
const pi = prumo.state.items;
eq('Prumo: itens convertidos', pi.map((i) => [i.type, i.title, i.date, i.done, i.repeat ? i.repeat.freq : null]), [['task', 'Lavar o carro', '2026-11-12', false, null], ['task', 'Remédio', '2026-11-10', false, 'daily'], ['study', 'Prova de Cálculo', '2026-11-20', false, null], ['money', 'Mercado', '2026-11-08', true, null], ['money', 'Entre contas', '2026-11-08', true, null], ['money', 'Internet', '2026-11-12', false, 'monthly']]);
eq('Prumo: matéria ligada', pi[2].subjectId, prumo.state.blocks[0].id);



// ── 1.14: avisos "Foi na aula?" e vários horários no dia ──
{
  const bl = [{ id: 'b1', kind: 'class', name: 'Cálculo 2', slots: [{ days: [3], start: '10:00', end: '11:40' }], absences: [], grades: [] }];
  const base = { ...EMPTY_STATE, items: [makeItem({ type: 'task', title: 'Remédio', date: '2026-11-10', repeat: { freq: 'daily' }, times: ['06:00', '14:00', '22:00'] }, now)], blocks: bl };
  const off = planReminders({ ...base, settings: { ...EMPTY_STATE.settings, morning: null, classAlert: 0 } }, now).filter((r) => r.category === 'aula');
  eq('"Foi na aula?" desligado por padrão', off.length, 0);
  const on = planReminders({ ...base, settings: { ...EMPTY_STATE.settings, morning: null, classAlert: 0, academic: { ...EMPTY_STATE.settings.academic, askAttendance: true } } }, now).filter((r) => r.category === 'aula');
  eq('"Foi na aula?" 5 min depois do fim, com 2 aulas', on.slice(0, 1).map((r) => [r.when.getDate(), r.when.getHours(), r.when.getMinutes(), r.title, r.data.count]), [[11, 11, 45, 'Foi na aula de Cálculo 2?', 2]]);
  const rem = planReminders({ ...base, settings: { ...EMPTY_STATE.settings, morning: null, classAlert: 0 } }, now).filter((r) => r.title === 'Remédio').slice(0, 3).map((r) => `${r.when.getDate()} ${r.when.getHours()}h`);
  eq('remédio 3 vezes ao dia avisa nos 3 horários', rem, ['10 22h', '11 6h', '11 14h']);
}

// ── contas, saldo e extrato (1.13) ──
const oldData = {
  '@org2/accounts': JSON.stringify([{ id: 'c1', name: 'Banco A', kind: 'corrente', anchor: { balance: 1000, date: '2026-11-01', at: 1 } }, { id: 'c2', name: 'Poupança', kind: 'poupanca', anchor: { balance: 500, date: '2026-11-01', at: 1 } }, { id: 'c3', name: 'Sem saldo', kind: 'corrente', anchor: null }]),
  '@org2/finance': JSON.stringify([
    { id: 'f1', type: 'out', title: 'Mercado', amount: 80, category: 'Alimentação', date: '2026-11-03', status: 'paid', account: 'c1', createdAt: 5 },
    { id: 'f2', type: 'in', title: 'Salário', amount: 2000, category: 'Salário', date: '2026-11-05', status: 'paid', account: 'c1', createdAt: 5 },
    { id: 'f3', type: 'transfer', title: 'Guardar', amount: 300, date: '2026-11-06', status: 'paid', from: 'c1', to: 'c2', createdAt: 5 },
    { id: 'f4', type: 'out', title: 'Luz', amount: 120, category: 'Contas', date: '2026-11-15', status: 'pending', account: 'c1', createdAt: 5 },
    { id: 'f5', type: 'out', title: 'Antigo', amount: 999, category: 'Outros', date: '2026-10-20', status: 'paid', account: 'c1', createdAt: 0 },
  ]),
  '@org2/settings': JSON.stringify({ profile: { name: 'Teste', state: 'PR', occupation: 'estagio' }, theme: 'dark', alertStyle: 'vibrar', onboarded: true }),
};
const moved = fromOldStorage(Object.entries(oldData), now);
const bal = balances(moved);
eq('1.12 → 1.13: saldo por conta igual', bal.rows.map((r) => [r.name, r.balance, r.known]), [['Banco A', 2620, true], ['Poupança', 800, true], ['Sem saldo', 0, false]]);
eq('saldo atual', [bal.money, bal.unknown], [3420, 1]);
eq('ajustes vieram', [moved.settings.state, moved.settings.theme, moved.settings.sound, moved.settings.occupation, moved.settings.onboarded], ['PR', 'dark', false, 'estagio', true]);
const mm = monthMoney(moved.items, '2026-11', moved.settings, now);
eq('transferência não é gasto nem renda', [mm.in, mm.out, mm.toPay, mm.moved.length], [2000, 80, 120, 1]);
eq('sem dados antigos', fromOldStorage([['@org2/tasks', null]]), null);
eq('título limpo', ['RSCSS Padaria Central0711', 'Pix enviado 57251234', 'PAY Lanchonete Boa', 'Mercado Bom Preco', 'Loja 24 Horas'].map(cleanTitle), ['Padaria Central', 'Pix enviado', 'Lanchonete Boa', 'Mercado Bom Preco', 'Loja 24 Horas']);
const fs = await import('node:fs');
const readFix = (f) => parseDocument({ name: f, bytes: new Uint8Array(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url))) }, '2026-11-10', []);
const ext = readFix('extrato.pdf');
let ms = { ...EMPTY_STATE, items: [], accounts: [] };
eq('conta sugerida', guessAccount(ext.meta, ext.kind, ms.accounts), 'new');
const rows1 = prepareImport(ext, ms, 'new');
const imp1 = applyImport(ms, ext, rows1, { accChoice: 'new', newName: 'Banco A' }, now);
eq('extrato importado', [imp1.added, imp1.state.accounts.length, imp1.state.items.every((i) => i.type === 'money' && i.done && i.account === imp1.state.accounts[0].id || i.flow === 'transfer')], [6, 1, true]);
const rows2 = prepareImport(ext, imp1.state, imp1.state.accounts[0].id);
eq('reimportar: tudo já existe', [rows2.every((r) => r.action === 'dup' && !r.selected), applyImport(imp1.state, ext, rows2, { accChoice: imp1.state.accounts[0].id }, now).added], [true, 0]);
const devTxt = 'EXTRATO\n01/11/2026 SALDO ANTERIOR 100,00\n03/11/2026 PIX RECEBIDO BRUNO 60,00\n04/11/2026 DEV PIX BRUNO -60,00\n04/11/2026 RSCSS PADARIA0311 -12,00\n05/11/2026 JUROS LIMITE -3,10\n05/11/2026 REND PAGO APLIC AUT 0,42\n05/11/2026 SALDO DO DIA 85,32\n';
const devRead = parseDocument({ name: 'x.csv', bytes: new TextEncoder().encode(devTxt) }, '2026-11-10', []);
const devRows = prepareImport(devRead, ms, 'new');
eq('extrato: devolvido, padaria (data grudada), juros e rendimento', devRows.map((r) => [r.title, r.category]), [['Pix de Bruno', 'Devolvido'], ['Pix devolvido para Bruno', 'Devolvido'], ['Padaria', 'Alimentação'], ['Juros Limite', 'Tarifas e juros'], ['Rendimento', 'Investimentos']]);
const impR = applyImport(ms, devRead, devRows, { accChoice: 'new' }, now);
const mR = monthMoney(impR.state.items, '2026-11', {}, now);
eq('devolução não infla o mês; saldo igual ao do banco', [mR.in, Math.round(mR.out * 100) / 100, balances(impR.state).money], [0.42, 15.1, 85.32]);
const later = parseDocument({ name: 'y.csv', bytes: new TextEncoder().encode('EXTRATO\n03/11/2026 PADARIA -12,00\n03/11/2026 SALDO DO DIA 88,00\n') }, '2026-11-10', []);
eq('mesma compra com a outra data (sameAs) já está no app', prepareImport(later, impR.state, impR.state.accounts[0].id).map((r) => r.action), ['dup']);
const fixedCat = { ...impR.state, items: impR.state.items.map((i) => (i.title === 'Padaria' ? { ...i, category: 'Lazer' } : i)) };
eq('categoria aprendida pela loja', prepareImport({ kind: 'extrato', meta: {}, items: [{ title: 'Padaria', amount: 9, type: 'out', category: 'Outros', date: '2026-11-09' }] }, fixedCat, 'none').map((r) => r.category), ['Lazer']);
eq('feriados continuam', Object.keys(holidaysOfMonth('2026-11', 'PR')).map((d) => d.slice(8)), ['02', '15', '20']);

console.log(`${pass} passaram, ${fails.length} falharam`);
if (fails.length) {
  console.log('\n' + fails.join('\n\n'));
  process.exit(1);
}
