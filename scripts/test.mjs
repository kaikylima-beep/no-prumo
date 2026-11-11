// Testes do Peep: node scripts/test.mjs
// Cada frase tem o resultado esperado. Nomes de pessoas são inventados.
import { parse } from '../src/core/nlu.js';
import { EMPTY_STATE, applyActions, complete, dayAgenda, gradeInfo, absenceInfo, groupItems, makeBlock, makeItem, monthMoney, nextDate, nowAndNext, occursOn } from '../src/core/model.js';
import { planReminders } from '../src/core/plan.js';
import { answer } from '../src/core/answers.js';
import { applyLearned, diffWords, learn } from '../src/core/learn.js';
import { makeBackup, readBackup, sanitize } from '../src/core/migrate.js';

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
eq('matéria criada pela voz', [calc.kind, calc.slots.length, calc.grades.length, calc.absences], ['class', 1, 1, ['2026-11-09']]);
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
eq('média simples', gradeInfo({ grades: [{ score: 6 }, { score: 8 }] }).average, 7);
const g = gradeInfo({ passGrade: 6, grades: [{ score: 5, weight: 40 }, { score: 8, weight: 20 }] });
eq('quanto falta com pesos', [g.partial, g.remaining, Math.round(g.need * 100) / 100], [3.6, 40, 6]);
eq('faltas', absenceInfo({ absences: ['a', 'b', 'c'], maxAbsences: 4 }), { count: 3, max: 4, left: 1, danger: true, over: false });
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
eq('resposta faltas', answer(parse('quantas faltas eu tenho em cálculo 2', { now, subjects: st.blocks }).query, st, now).title, 'Cálculo 2: 1 falta.');
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
eq('backup vai e volta', [back.from, back.state.items.length, back.state.blocks.length], ['peep', st.items.length, st.blocks.length]);
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
eq('backup do Prumo', [prumo.from, prumo.counts, prumo.state.settings.name, prumo.state.settings.monthLimit, prumo.state.settings.learned.pics.to], ['prumo', { items: 5, blocks: 1, skipped: 1 }, 'Teste', 1700, 'pix']);
const pi = prumo.state.items;
eq('Prumo: itens convertidos', pi.map((i) => [i.type, i.title, i.date, i.done, i.repeat ? i.repeat.freq : null]), [['task', 'Lavar o carro', '2026-11-12', false, null], ['task', 'Remédio', '2026-11-10', false, 'daily'], ['study', 'Prova de Cálculo', '2026-11-20', false, null], ['money', 'Mercado', '2026-11-08', true, null], ['money', 'Internet', '2026-11-12', false, 'monthly']]);
eq('Prumo: matéria ligada', pi[2].subjectId, prumo.state.blocks[0].id);

console.log(`${pass} passaram, ${fails.length} falharam`);
if (fails.length) {
  console.log('\n' + fails.join('\n\n'));
  process.exit(1);
}
