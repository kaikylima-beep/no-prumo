// Testes do interpretador de frases. Rode com: npm test
// Copia src/utils.js e src/parser.js para uma pasta temporária com imports
// compatíveis com o Node e confere frases reais contra o resultado esperado.
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'parser-test-'));
writeFileSync(join(dir, 'utils.mjs'), readFileSync(join(root, 'src/utils.js'), 'utf8'));
writeFileSync(
  join(dir, 'recurrence.mjs'),
  readFileSync(join(root, 'src/recurrence.js'), 'utf8').replace("from './utils'", "from './utils.mjs'")
);
writeFileSync(
  join(dir, 'greeting.mjs'),
  readFileSync(join(root, 'src/greeting.js'), 'utf8')
    .replace("from './utils'", "from './utils.mjs'")
    .replace("from './recurrence'", "from './recurrence.mjs'")
);
writeFileSync(
  join(dir, 'budget.mjs'),
  readFileSync(join(root, 'src/budget.js'), 'utf8').replace("from './utils'", "from './utils.mjs'")
);
writeFileSync(
  join(dir, 'parser.mjs'),
  readFileSync(join(root, 'src/parser.js'), 'utf8')
    .replace("from './utils'", "from './utils.mjs'")
    .replace("from './recurrence'", "from './recurrence.mjs'")
);
writeFileSync(
  join(dir, 'documentParser.mjs'),
  readFileSync(join(root, 'src/documentParser.js'), 'utf8')
    .replace("from './parser'", "from './parser.mjs'")
    .replace("from 'pako'", `from '${pathToFileURL(join(root, 'node_modules/pako/dist/pako.esm.mjs')).href}'`)
);
const DP = await import(pathToFileURL(join(dir, 'documentParser.mjs')).href);
writeFileSync(join(dir, 'accounts.mjs'), readFileSync(join(root, 'src/accounts.js'), 'utf8'));
const AC = await import(pathToFileURL(join(dir, 'accounts.mjs')).href);
const { parseInput, planOffsets, wordsToNumbers, abbreviate } = await import(pathToFileURL(join(dir, 'parser.mjs')).href);
const R = await import(pathToFileURL(join(dir, 'recurrence.mjs')).href);
const G = await import(pathToFileURL(join(dir, 'greeting.mjs')).href);
const B = await import(pathToFileURL(join(dir, 'budget.mjs')).href);
writeFileSync(
  join(dir, 'insights.mjs'),
  readFileSync(join(root, 'src/insights.js'), 'utf8')
    .replace("from './utils'", "from './utils.mjs'")
    .replace("from './budget'", "from './budget.mjs'")
    .replace("from './accounts'", "from './accounts.mjs'")
);
const IN = await import(pathToFileURL(join(dir, 'insights.mjs')).href);
writeFileSync(
  join(dir, 'itemForm.mjs'),
  readFileSync(join(root, 'src/itemForm.js'), 'utf8')
    .replace("from './utils'", "from './utils.mjs'")
    .replace("from './parser'", "from './parser.mjs'")
    .replace("from './recurrence'", "from './recurrence.mjs'")
    .replace("from './budget'", "from './budget.mjs'")
);
const IF = await import(pathToFileURL(join(dir, 'itemForm.mjs')).href);
rmSync(dir, { recursive: true, force: true });

const TODAY = '2026-11-06'; // sexta-feira
const NOW = new Date(2026, 10, 6, 15, 4); // 15:04
let fails = 0;
let total = 0;

function check(phrase, expected, opts = {}) {
  total++;
  const got = parseInput(phrase, TODAY, NOW, opts);
  const problems = [];
  if (got.length !== expected.length) problems.push(`esperava ${expected.length} item(ns), veio ${got.length}`);
  expected.forEach((exp, i) => {
    const g = got[i] || {};
    for (const [k, v] of Object.entries(exp)) {
      // "repeat.freq" lê campos internos; listas e objetos são comparados por JSON
      const gv = k.split('.').reduce((o, part) => (o == null ? undefined : o[part]), g);
      const same = typeof v === 'object' && v !== null ? JSON.stringify(gv) === JSON.stringify(v) : gv === v;
      if (!same) problems.push(`item ${i + 1}.${k}: esperava ${JSON.stringify(v)}, veio ${JSON.stringify(gv)}`);
    }
  });
  if (problems.length) {
    fails++;
    console.log(`FALHOU  "${phrase}"\n        ${problems.join('\n        ')}`);
  } else {
    console.log(`ok      "${phrase}"`);
  }
}

// ---- estudos
check('Prova de circuitos pro dia 27. Me lembrar em 4 dias.', [{ kind: 'study', title: 'Prova de circuitos', date: '2026-11-27', lead: 4 }]);
check('prova de circuitos pro dia 27 me lembrar em 4 dias', [{ kind: 'study', title: 'Prova de circuitos', date: '2026-11-27', lead: 4 }]);
check('tenho prova de cálculo dia 2 de dezembro', [{ kind: 'study', title: 'Prova de cálculo', date: '2026-12-02' }]);
check('estudar capítulo 3 de circuitos amanhã', [{ kind: 'study', title: 'Estudar capítulo 3 de circuitos', date: '2026-11-07' }]);
check('lista de exercícios de física pra segunda', [{ kind: 'study', date: '2026-11-09' }]);
check('trabalho de eletrônica entrega dia 30 avisar uma semana antes', [{ kind: 'study', title: 'Trabalho de eletrônica entrega', date: '2026-11-30', lead: 7 }]);
check('Seminário de redes 15/12 às 14h', [{ kind: 'study', date: '2026-12-15', time: '14:00' }]);
check('estudar termodinâmica, me lembrar em 3 dias', [{ kind: 'study', date: '2026-11-09', lead: null }]);

// ---- tarefas
check('comprar arroz feijão e detergente', [{ kind: 'task', title: 'Comprar arroz feijão e detergente' }]);
check('Comprar pão e leite', [{ kind: 'task', title: 'Comprar pão e leite' }]);
check('lavar o carro sábado', [{ kind: 'task', title: 'Lavar o carro', date: '2026-11-07' }]);
check('me lembra de ligar pra minha mãe às 19h', [{ kind: 'task', title: 'Ligar pra minha mãe', time: '19:00' }]);
check('ligar pro dentista amanhã às 3 da tarde', [{ kind: 'task', title: 'Ligar pro dentista', date: '2026-11-07', time: '15:00' }]);
check('devolver o livro da biblioteca dia 20', [{ kind: 'task', date: '2026-11-20' }]);
check('comprar detergente e lavar o banheiro amanhã', [{ kind: 'task', title: 'Comprar detergente' }, { kind: 'task', title: 'Lavar o banheiro', date: '2026-11-07' }]);
check('comprar 2 pacotes de arroz', [{ kind: 'task', title: 'Comprar 2 pacotes de arroz' }]);
check('comer bolo daqui a 30 minutos', [{ kind: 'task', title: 'Comer bolo', date: TODAY, time: '15:34' }]);
check('daqui a meia hora tirar a roupa do varal', [{ kind: 'task', title: 'Tirar a roupa do varal', date: TODAY, time: '15:34' }]);
check('me lembra daqui a 2 horas de ligar pro João', [{ kind: 'task', title: 'Ligar pro João', time: '17:04' }]);
check('estudar circuitos em uma hora e meia', [{ kind: 'study', title: 'Estudar circuitos', time: '16:34' }]);
check('tomar remédio daqui a 9 horas', [{ kind: 'task', title: 'Tomar remédio', date: '2026-11-07', time: '00:04' }]);
check('comer 2 frutas', [{ kind: 'task', title: 'Comer 2 frutas' }]);
check('assistir 3 aulas', [{ kind: 'study' }]);
check('celular 80', [{ kind: 'finance', amount: 80 }]);
check('pagar o IPTU dia 10', [{ kind: 'task', title: 'Pagar o IPTU', date: '2026-11-10' }]);

// ---- finanças: listas
check('conta de luz 180, conta de água 95 e aluguel 1800', [
  { kind: 'finance', title: 'Conta de luz', amount: 180 },
  { kind: 'finance', title: 'Conta de água', amount: 95 },
  { kind: 'finance', title: 'Aluguel', amount: 1800 },
]);
check('salário 4500 e bônus 1200', [
  { kind: 'finance', title: 'Salário', amount: 4500, type: 'in' },
  { kind: 'finance', title: 'Bônus', amount: 1200, type: 'in' },
]);
check('cartão de crédito Itaú, valor tal, mil duzentos e cinquenta', [{ kind: 'finance', title: 'Cartão Itaú', amount: 1250 }]);
check('conta de luz 180,50, água 95,20', [
  { kind: 'finance', title: 'Conta de luz', amount: 180.5 },
  { kind: 'finance', title: 'Conta de água', amount: 95.2 },
]);
check('cartão Itaú R$ 1.800,00 e Nubank 900', [
  { kind: 'finance', title: 'Cartão Itaú', amount: 1800 },
  { kind: 'finance', amount: 900, category: 'Cartão' },
]);
check('Gastei 45 reais e 90 centavos no mercado hoje', [{ kind: 'finance', title: 'Mercado', amount: 45.9, status: 'paid', date: TODAY }]);
check('Paguei aluguel 1500 reais e tenho prova de física dia vinte', [
  { kind: 'finance', amount: 1500, status: 'paid' },
  { kind: 'study', title: 'Prova de física', date: '2026-11-20' },
]);

// ---- finanças: valores soltos, datas, situação
check('uber 25', [{ kind: 'finance', title: 'Uber', amount: 25, category: 'Transporte' }]);
check('parcela da moto 650', [{ kind: 'finance', title: 'Parcela da moto', amount: 650, category: 'Parcelas' }]);
check('mercado 230 reais ontem', [{ kind: 'finance', title: 'Mercado', amount: 230, date: '2026-11-05', status: 'paid' }]);
check('gastei 32,50 no Uber', [{ kind: 'finance', amount: 32.5, status: 'paid' }]);
check('tenho que pagar a fatura do Nubank dia 15 de 900 reais', [{ kind: 'finance', title: 'Cartão Nubank', amount: 900, date: '2026-11-15', status: 'pending' }]);
check('Vou receber salário de 4500 reais dia 5', [{ kind: 'finance', type: 'in', amount: 4500, date: '2026-12-05', status: 'pending' }]);
check('recebi salário dia 5, 4500 reais', [{ kind: 'finance', type: 'in', amount: 4500, date: '2026-11-05', status: 'paid' }]);
check('aluguel 1800 todo dia 5', [{ kind: 'finance', title: 'Aluguel', amount: 1800, repeat: true, date: '2026-12-05', status: 'pending' }]);
check('conta de luz 180,50, água 95 e aluguel 1800 todo dia 5', [
  { kind: 'finance', title: 'Conta de luz', amount: 180.5, date: TODAY, repeat: false },
  { kind: 'finance', title: 'Conta de água', amount: 95, date: TODAY, repeat: false },
  { kind: 'finance', title: 'Aluguel', amount: 1800, date: '2026-12-05', repeat: true },
]);
check('internet 120 reais todo mês', [{ kind: 'finance', title: 'Internet', amount: 120, repeat: true }]);
check('paguei luz 180 e água 95 ontem', [
  { kind: 'finance', title: 'Conta de luz', amount: 180, date: '2026-11-05', status: 'paid' },
  { kind: 'finance', title: 'Conta de água', amount: 95, date: '2026-11-05', status: 'paid' },
]);
check('sala 205 amanhã', [{ kind: 'task', date: '2026-11-07' }]);
check('pix do João 200 reais', [{ kind: 'finance', title: 'Pix do João', amount: 200 }]);
check('prova dia 27 e trabalho de física dia 30', [
  { kind: 'study', title: 'Prova', date: '2026-11-27' },
  { kind: 'study', title: 'Trabalho de física', date: '2026-11-30' },
]);
check('Recebi um bônus de 800 reais', [{ kind: 'finance', type: 'in', title: 'Bônus', amount: 800, status: 'paid' }]);

// ---- títulos curtos
const SHORT = { short: true };
check('tomar remédio da diabetes em 4 horas', [{ kind: 'task', title: 'Remédio diabetes', date: TODAY, time: '19:04' }], SHORT);
check('Prova de circuitos pro dia 27, me lembrar 4 dias antes', [{ kind: 'study', title: 'Prova circuitos', date: '2026-11-27', lead: 4 }], SHORT);
check('me lembra de ligar pra minha mãe às 19h', [{ kind: 'task', title: 'Ligar mãe', time: '19:00' }], SHORT);
check('ir ao médico amanhã às 10h', [{ kind: 'task', title: 'Médico', date: '2026-11-07', time: '10:00' }], SHORT);
check('fazer a lista de exercícios de física pra segunda', [{ kind: 'study', title: 'Lista exercícios física' }], SHORT);
check('comprar arroz, feijão e detergente', [{ kind: 'task', title: 'Comprar arroz feijão detergente' }], SHORT);
check('conta de luz 180 e pix do João 200 reais', [
  { kind: 'finance', title: 'Conta de luz', amount: 180 },
  { kind: 'finance', title: 'Pix João', amount: 200 },
], SHORT);
check('comprar arroz, feijão, detergente e leite', [{ kind: 'task', title: 'Comprar arroz feijão detergente leite' }], SHORT);
check('tomar remédio da diabetes em 4 horas', [{ kind: 'task', title: 'Tomar remédio da diabetes' }]);
total++;
if (abbreviate('Lavar o carro') !== 'Lavar carro' || abbreviate('Tomar') !== 'Tomar') { fails++; console.log('FALHOU  abbreviate básico'); } else console.log('ok      abbreviate básico');

// ---- 1.4: lembretes que se repetem, partes do dia, duração, compra no cartão
// (NOW = sexta 06/11 às 15:04)
check('tomar remédio da diabetes todo dia às 8h e às 20h', [
  { kind: 'task', title: 'Remédio diabetes', 'repeat.freq': 'daily', times: ['08:00', '20:00'], date: TODAY },
], SHORT);
check('remédio da pressão de 8 em 8 horas', [
  { kind: 'task', title: 'Remédio pressão', 'repeat.interval': 8, times: ['07:05', '15:05', '23:05'] },
], SHORT);
check('beber água de 2 em 2 horas', [{ kind: 'task', title: 'Beber água', 'repeat.interval': 2 }], SHORT);
check('remédio de 8 em 8 horas a partir das 8h', [{ kind: 'task', times: ['00:00', '08:00', '16:00'] }], SHORT);
check('academia segunda, quarta e sexta às 7h', [
  { kind: 'task', title: 'Academia', 'repeat.freq': 'weekly', 'repeat.days': [1, 3, 5], times: ['07:00'], date: '2026-11-09' },
], SHORT);
check('tirar o lixo toda terça e quinta à noite', [
  { kind: 'task', title: 'Tirar lixo', 'repeat.days': [2, 4], times: ['20:00'], date: '2026-11-10' },
], SHORT);
check('tomar vitamina D toda segunda', [{ kind: 'task', title: 'Vitamina D', 'repeat.days': [1], times: ['08:00'] }], SHORT);
check('estudar inglês de segunda a sexta às 19h', [
  { kind: 'study', 'repeat.days': [1, 2, 3, 4, 5], times: ['19:00'] },
], SHORT);
check('regar as plantas toda semana', [{ kind: 'task', title: 'Regar plantas', 'repeat.days': [5] }], SHORT);
check('trocar o filtro todo dia 10', [{ kind: 'task', 'repeat.freq': 'monthly', 'repeat.day': 10, date: '2026-11-10' }], SHORT);
check('alongar toda manhã', [{ kind: 'task', 'repeat.freq': 'daily', times: ['08:00'] }], SHORT);
check('lavar o carro na sexta', [{ kind: 'task', date: '2026-11-13', repeat: null }], SHORT);
check('Tomar remédio. Todo dia às 9h', [{ kind: 'task', 'repeat.freq': 'daily', times: ['09:00'] }], SHORT);
check('amanhã de manhã ligar pro banco', [{ kind: 'task', title: 'Ligar banco', date: '2026-11-07', time: '08:00' }], SHORT);
check('hoje à noite estudar física', [{ kind: 'study', title: 'Estudar física', date: TODAY, time: '20:00' }], SHORT);
check('comprar pão amanhã cedo', [{ kind: 'task', title: 'Comprar pão', time: '07:00' }], SHORT);
check('estudar 2 horas de física hoje', [{ kind: 'study', time: null }]);
check('ler 30 páginas às 21h', [{ kind: 'task', time: '21:00' }]);
check('comprei um tênis de 300 no cartão nubank', [{ kind: 'finance', title: 'Tênis', amount: 300, category: 'Cartão' }]);
check('gastei 80 no mercado no cartão', [{ kind: 'finance', title: 'Mercado', amount: 80, category: 'Alimentação' }]);
check('paguei 1200 da fatura do nubank', [{ kind: 'finance', title: 'Cartão Nubank', amount: 1200 }]);
check('pagar a fatura todo dia 10', [{ kind: 'finance', repeat: true, date: '2026-11-10' }]);
check('netflix 55 todo mês dia 12', [{ kind: 'finance', title: 'Netflix', amount: 55, repeat: true, date: '2026-11-12' }]);

// ---- recorrência: próximas ocorrências e descrição
{
  const now = new Date(2026, 10, 6, 15, 4);
  const item = { repeat: { freq: 'daily' }, times: ['08:00', '20:00'], date: '2026-11-06', doneSlots: ['2026-11-06 08:00'] };
  const cases = [
    ['próxima', JSON.stringify(R.nextSlot(item, now)), JSON.stringify({ date: '2026-11-06', time: '20:00' })],
    ['pendente nenhuma', JSON.stringify(R.pendingSlot(item, now)), 'null'],
    ['pendente 08:00', JSON.stringify(R.pendingSlot({ ...item, doneSlots: [] }, now)), JSON.stringify({ date: '2026-11-06', time: '08:00' })],
    ['descrição diária', R.describe(item.repeat, item.times), 'Todo dia · 08:00 e 20:00'],
    ['descrição semanal', R.describe({ freq: 'weekly', days: [5, 1, 3] }, ['07:00']), 'Seg, Qua e Sex · 07:00'],
    ['descrição seg a sex', R.describe({ freq: 'weekly', days: [1, 2, 3, 4, 5] }, ['19:00']), 'Seg a sex · 19:00'],
    ['mês curto', String(R.occursOn({ freq: 'monthly', day: 31 }, '2026-11-30')), 'true'],
    ['intervalo', JSON.stringify(R.intervalTimes('16:15', 8)), JSON.stringify(['00:15', '08:15', '16:15'])],
    ['rótulo amanhã', R.slotLabel({ date: '2026-11-07', time: '08:00' }, now), 'amanhã 08:00'],
  ];
  for (const [name, got, exp] of cases) {
    total++;
    if (got !== exp) { fails++; console.log(`FALHOU  recorrência ${name}: esperava ${exp}, veio ${got}`); } else console.log(`ok      recorrência ${name}`);
  }
}

// ---- 1.7: condição, horário aproximado, 22h, data para a lista
check('quando eu chegar em casa hoje lá para umas 10 horas eu tenho que dobrar minhas roupas e arrumar o quarto', [
  { kind: 'task', title: 'Dobrar roupas', date: TODAY, time: '22:00' },
  { kind: 'task', title: 'Arrumar quarto', date: TODAY, time: '22:00' },
], SHORT);
check('por volta das 8 da manhã amanhã ligar pro banco', [{ kind: 'task', date: '2026-11-07', time: '08:00' }], SHORT);
check('ligar pra mãe às 9', [{ kind: 'task', time: '21:00' }], SHORT);
check('amanhã às 9h ligar pro banco', [{ kind: 'task', date: '2026-11-07', time: '09:00' }], SHORT);
check('amanhã às 9 ligar pro banco', [{ kind: 'task', date: '2026-11-07', time: '09:00' }], SHORT);
check('ligar pro banco amanhã às 9', [{ kind: 'task', date: '2026-11-07', time: '09:00' }], SHORT);
check('dobrar roupas e arrumar o quarto, e paguei luz 180', [
  { kind: 'task', title: 'Dobrar roupas' },
  { kind: 'task', title: 'Arrumar quarto' },
  { kind: 'finance', amount: 180 },
], SHORT);
check('tenho que dobrar as roupas Né arrumar a bagunça aqui do quarto e fazer comida', [
  { kind: 'task', title: 'Dobrar roupas' },
  { kind: 'task', title: 'Arrumar bagunça quarto' },
  { kind: 'task', title: 'Fazer comida' },
], SHORT);
check('assim que eu acordar tomar remédio', [{ kind: 'task', title: 'Remédio' }], SHORT);

// ---- mensagens de entrada
{
  const at = (h, m = 0) => new Date(2026, 10, 6, h, m);
  const data = {
    tasks: [
      { id: 'a', title: 'Lavar carro', done: false },
      { id: 'b', title: 'Pagar IPTU', done: false },
      { id: 'c', title: 'Trocar lâmpada', done: true },
      { id: 'r', title: 'Remédio', repeat: { freq: 'daily' }, times: ['08:00', '20:00'], date: '2026-11-01', doneSlots: ['2026-11-06 08:00'] },
    ],
    study: [
      { id: 's1', title: 'Prova', done: false },
      { id: 's2', title: 'Lista', done: false },
      { id: 's3', title: 'Seminário', done: false },
    ],
    finance: [
      { id: 'f1', title: 'Luz', status: 'paid', date: '2026-11-04' },
      { id: 'f2', title: 'Cartão', status: 'pending', date: '2026-11-05' },
      { id: 'f3', title: 'Aluguel', status: 'pending', date: '2026-11-20' },
    ],
  };
  const order = ['task', 'finance', 'study'];
  const m1 = G.entryMessages(data, 'Kaikyn Silva', order, at(15, 4));
  const m2 = G.entryMessages(data, 'Kaikyn', order, at(21, 0));
  const empty = G.entryMessages({ tasks: [], study: [], finance: [] }, '', order, at(7, 30));
  const cases = [
    ['bom dia', G.salutation(at(7)), 'Bom dia'],
    ['boa tarde', G.salutation(at(12)), 'Boa tarde'],
    ['boa noite', G.salutation(at(18)), 'Boa noite'],
    ['madrugada é boa noite', G.salutation(at(3)), 'Boa noite'],
    ['saudação com primeiro nome', m1.greeting, 'Boa tarde, Kaikyn.'],
    ['tarefas pendentes (20h ainda não chegou)', m1.messages[0], 'Kaikyn, você tem 2 tarefas pendentes.'],
    ['área com menos resoluções', m1.messages[1], 'Kaikyn, você precisa concluir seus lembretes de Estudos.'],
    ['às 21h o remédio das 20h conta', m2.messages[0], 'Kaikyn, você tem 3 tarefas pendentes.'],
    ['sem nome e sem pendências', `${empty.greeting} ${empty.messages.join(' ')}`, 'Bom dia. Tudo em dia por aqui.'],
    ['conta futura não conta como pendente', String(m1.stats.finance.pending), '1'],
  ];
  for (const [name, got, exp] of cases) {
    total++;
    if (got !== exp) { fails++; console.log(`FALHOU  entrada: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      entrada: ${name}`);
  }
}

// ---- orçamento do mês
{
  const now = new Date(2026, 10, 6, 15, 4); // dia 6 de 30
  const base = [
    { title: 'Aluguel', amount: 1200, type: 'out', category: 'Contas', date: '2026-11-05', status: 'paid' },
    { title: 'Conta de luz', amount: 150, type: 'out', category: 'Contas', date: '2026-11-10', status: 'pending' },
    { title: 'Cartão Itaú', amount: 600, type: 'out', category: 'Cartão', date: '2026-11-03', status: 'paid' },
    { title: 'Cinema', amount: 100, type: 'out', category: 'Lazer', date: '2026-11-05', status: 'paid' },
    { title: 'Mercado', amount: 80, type: 'out', category: 'Alimentação', date: '2026-10-28', status: 'paid' }, // outro mês
  ];
  const budget = { salary: 3000, target: 500 };
  const b = B.monthBudget(base, budget, '2026-11', now);
  const over = B.monthBudget([...base, { title: 'Tênis', amount: 500, type: 'out', category: 'Cartão', date: '2026-11-06', status: 'paid' }], budget, '2026-11', now);
  const risk = B.monthBudget([...base, { title: 'Bar', amount: 300, type: 'out', category: 'Lazer', date: '2026-11-02', status: 'paid' }], budget, '2026-11', now);
  const withSalary = B.monthBudget([...base,
    { title: 'Salário', amount: 3200, type: 'in', category: 'Salário', date: '2026-11-05', status: 'paid' },
    { title: 'Bônus', amount: 300, type: 'in', category: 'Bônus', date: '2026-11-20', status: 'pending' }], budget, '2026-11', now);
  // a partir do dia 10 a projeção segue o ritmo; antes disso, só o que já foi lançado
  const now12 = new Date(2026, 10, 12, 15, 4);
  const b12 = B.monthBudget(base, budget, '2026-11', now12);
  const risk12 = B.monthBudget([...base, { title: 'Bar', amount: 300, type: 'out', category: 'Lazer', date: '2026-11-02', status: 'paid' }], budget, '2026-11', now12);
  const partial = B.monthBudget([{ title: 'Pix', amount: 90, type: 'in', category: 'Outros', date: '2026-10-20', status: 'paid' }, { title: 'Mercado', amount: 291.55, type: 'out', category: 'Outros', date: '2026-10-21', status: 'paid' }], {}, '2026-10', now);
  const cases = [
    ['renda = salário base', String(b.income), '3000'],
    ['necessários', String(b.essential), '1350'],
    ['não necessários', String(b.nonEssential), '700'],
    ['limite para não necessários', String(b.allowance), '1150'],
    ['ainda pode gastar', String(b.remaining), '450'],
    ['fatura do cartão não entra no ritmo diário', b.status, 'ok'],
    ['dia 6: projeção só com o que já foi lançado', String(Math.round(b.projectedExtra)), '700'],
    ['dia 6: cedo para dizer que está em risco', risk.status, 'ok'],
    ['dia 12: fatura 600 + cinema no ritmo (100 em 12 dias)', String(Math.round(b12.projectedExtra)), '850'],
    ['dia 12: gasto variável alto projeta abaixo da meta', risk12.status, 'risk'],
    ['mês sem salário e sem salário base não calcula limite', partial.status, 'noincome'],
    ['mês sem salário não gera aviso', String(B.spendingAlert(partial, 'alta')), 'null'],
    ['% usado = gasto total / (renda − meta), igual à barra', String(Math.round(b.used * 100)), '82'],
    ['sem aviso abaixo de 90% (média)', String(B.spendingAlert(b, 'media')), 'null'],
    ['passou do limite', over.status, 'over'],
    ['aviso ao passar', B.spendingAlert(over, 'baixa'), 'Atenção: você passou R$ 50,00 do limite deste mês para guardar R$ 500,00.'],
    ['salário lançado substitui o base', String(withSalary.income), '3500'],
    ['restaurante não é necessário', String(B.essentialDefault('Alimentação', 'Restaurante')), 'false'],
    ['aluguel é necessário', String(B.essentialDefault('Contas', 'Aluguel')), 'true'],
    ['cartão não é necessário', String(B.essentialDefault('Cartão', 'Cartão Itaú')), 'false'],
    ['mensagem de entrada (projeção)', B.budgetEntryMessage(risk12, 'media'), 'no ritmo atual você vai guardar R$ 50,00, abaixo da meta de R$ 500,00.'],
    ['importância baixa só avisa se passar', String(B.budgetEntryMessage(risk12, 'baixa')), 'null'],
    ['compra no cartão é variável', String(Math.round(B.monthBudget([{ title: 'Tênis', amount: 300, type: 'out', category: 'Cartão', date: '2026-11-03', status: 'paid' }], budget, '2026-11', now12).projectedExtra)), '750'],
  ];
  for (const [name, got, exp] of cases) {
    total++;
    if (got !== exp) { fails++; console.log(`FALHOU  orçamento: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      orçamento: ${name}`);
  }
}

// ---- números por extenso e avisos
const w = wordsToNumbers('dia vinte e sete e dois mil e quinhentos reais, cento e vinte e cinco, mil, vinte e um');
total++;
if (w !== 'dia 27 e 2500 reais, 125, 1000, 21') { fails++; console.log('FALHOU  números por extenso:', w); } else console.log('ok      números por extenso');
const offs = [
  [planOffsets('study', null, 30, 'alta'), [14, 7, 3, 1, 0]],
  [planOffsets('study', null, 5, 'media'), [3, 1, 0]],
  [planOffsets('study', 4, 20, 'baixa'), [4, 0]],
  [planOffsets('finance', null, 10, 'media'), [1, 0]],
  [planOffsets('task', null, 10, 'alta'), [1, 0]],
];
offs.forEach(([got, exp], i) => {
  total++;
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.log(`FALHOU  avisos ${i}: ${JSON.stringify(got)}`); } else console.log(`ok      avisos ${i}`);
});

// ---- importar extrato, fatura e holerite (PDF e CSV)
function checkDoc(file, expected, existing = []) {
  total++;
  const bytes = new Uint8Array(readFileSync(join(root, 'scripts/fixtures', file)));
  const r = DP.parseDocument({ name: file, bytes }, TODAY, existing);
  const got = (r.items || []).map((i) => [i.date, i.type, i.amount, i.title, i.category, !!i.duplicate]);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) {
    fails++;
    console.log(`FALHOU  documento ${file} ${r.error || ''}\n        veio ${JSON.stringify(got)}`);
  } else console.log(`ok      documento ${file}`);
}
checkDoc(
  'extrato.pdf',
  [
    ['2026-10-05', 'in', 3000, 'Pix de Empresa Xyz Ltda', 'Outros', false],
    ['2026-10-06', 'out', 1800, 'Aluguel', 'Contas', true],
    ['2026-10-08', 'out', 312.45, 'Supermercado Bom Preco', 'Alimentação', false],
    ['2026-10-12', 'out', 50, 'Pix para João da Silva', 'Outros', false],
    ['2026-10-15', 'out', 180.3, 'Conta de Luz Enel', 'Contas', false],
    ['2026-10-20', 'out', 25.9, 'Uber Trip', 'Transporte', false],
  ],
  [{ date: '2026-10-06', amount: 1800, type: 'out' }]
);
checkDoc('holerite.pdf', [['2026-11-05', 'in', 2700, 'Salário', 'Salário', false]]);
checkDoc('nubank.csv', [
  ['2026-11-03', 'out', 45.9, 'Ifood Restaurante', 'Alimentação', false],
  ['2026-11-04', 'out', 55.9, 'Netflix.com', 'Lazer', false],
  ['2026-11-05', 'in', 3000, 'Salário', 'Salário', false],
]);
checkDoc('fatura.csv', [
  ['2026-11-01', 'out', 12.5, 'Padaria Pao Quente', 'Alimentação', false],
  ['2026-11-02', 'out', 150, 'Posto Shell', 'Transporte', false],
  ['2026-11-03', 'transfer', 900, 'Pagamento da fatura', 'Transferência', false],
]);
[
  ['1.234,56', 1234.56],
  ['-R$ 99,90', -99.9],
  ['150,00 D', -150],
  ['(80,00)', -80],
  ['1234.5', 1234.5],
  ['abc', null],
].forEach(([raw, exp]) => {
  total++;
  const v = DP.parseAmount(raw);
  if (v !== exp) { fails++; console.log(`FALHOU  valor "${raw}": ${v}`); } else console.log(`ok      valor "${raw}"`);
});
[
  ['05/11', '2026-11-05'],
  ['28/12', '2025-12-28'],
  ['05/11/26', '2026-11-05'],
  ['2026-11-05', '2026-11-05'],
  ['05 NOV', '2026-11-05'],
].forEach(([raw, exp]) => {
  total++;
  const v = DP.parseDateBR(raw, TODAY);
  if (v !== exp) { fails++; console.log(`FALHOU  data "${raw}": ${v}`); } else console.log(`ok      data "${raw}"`);
});

// extrato de conta em texto (como o do Itaú): titular, data grudada, Pix, salário, transferência própria
{
  total++;
  const txt = [
    'FULANO DE TAL 123.456.789-00 agência: 0001 conta: 12345-6',
    'saldo em conta Limite da Conta utilizado',
    'extrato conta / lançamentos',
    'data lançamentos valor (R$) saldo (R$)',
    '06/11/2026 PAG BOLETO COPEL-DIS -114,90',
    '06/11/2026 PIX TRANSF Leandro06/11 -50,00',
    '06/11/2026 FATURA PAGA Itaú Click M -446,11',
    '06/11/2026 SALDO DO DIA 699,07',
    '06/11/2026 PIX TRANSF Fulano D06/11 511,85',
    '05/11/2026 REMUNERACAO/SALARIO 3.157,49',
    '19/10/2026 PAY 53417 19/10 -4,99',
  ].join('\n');
  const r = DP.parseStatementText(txt, TODAY);
  const got = r.items.map((i) => [i.type, i.amount, i.title, i.category, !!i.hint]);
  const exp = [
    ['out', 114.9, 'Copel-dis', 'Contas', false],
    ['out', 50, 'Pix para Leandro', 'Outros', false],
    ['out', 446.11, 'Fatura do cartão', 'Cartão', false],
    ['transfer', 511.85, 'Transferência de outra conta sua', 'Transferência', true],
    ['in', 3157.49, 'Salário', 'Salário', false],
    ['out', 4.99, 'Compra no débito', 'Outros', false],
  ];
  const m = r.meta || {};
  if (m.agency !== '0001' || m.number !== '12345-6' || m.balance !== 699.07 || m.balanceDate !== '2026-11-06') {
    fails++;
    console.log(`FALHOU  dados da conta no extrato: ${JSON.stringify(m)}`);
  }
  if (r.kind !== 'extrato' || JSON.stringify(got) !== JSON.stringify(exp)) {
    fails++;
    console.log(`FALHOU  extrato em texto (${r.kind})\n        veio ${JSON.stringify(got)}`);
  } else console.log('ok      extrato em texto (Itaú)');
}

// ---- contas e transferências
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  contas: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      contas: ${name}`);
  };
  const itau = { id: 'itau', name: 'Itaú', kind: 'corrente', anchor: { date: '2026-11-06', balance: 699.07, at: 1000, importId: 'imp1' } };
  const nu = { id: 'nu', name: 'Nubank', kind: 'corrente', anchor: null };
  const card = { id: 'card', name: 'Itaú cartão', kind: 'cartao', anchor: null };
  const poup = { id: 'poup', name: 'Poupança', kind: 'poupanca', anchor: { date: '2026-11-01', balance: 1000, at: 0 } };
  const fin = [
    // do mesmo extrato (já contados no saldo do extrato)
    { id: 'a', type: 'out', account: 'itau', amount: 114.9, date: '2026-11-06', status: 'paid', importId: 'imp1', createdAt: 900 },
    { id: 'b', type: 'in', account: 'itau', amount: 3157.49, date: '2026-11-05', status: 'paid', importId: 'imp1', createdAt: 900 },
    // lançado depois por voz, hoje
    { id: 'c', type: 'out', account: 'itau', amount: 20, date: '2026-11-06', status: 'paid', createdAt: 2000 },
    // amanhã, a pagar: não entra no saldo de hoje
    { id: 'd', type: 'out', account: 'itau', amount: 50, date: '2026-11-07', status: 'pending', createdAt: 2000 },
    // transferência do Itaú para a poupança
    { id: 'e', type: 'transfer', from: 'itau', to: 'poup', amount: 100, date: '2026-11-07', status: 'paid', createdAt: 3000 },
    // compra no cartão e pagamento da fatura
    { id: 'f', type: 'out', account: 'card', amount: 300, date: '2026-11-02', status: 'paid', createdAt: 1 },
    { id: 'g', type: 'transfer', from: 'itau', to: 'card', amount: 200, date: '2026-11-08', status: 'paid', createdAt: 3000 },
    // sem conta
    { id: 'h', type: 'out', account: null, amount: 10, date: '2026-11-06', status: 'paid', createdAt: 1 },
  ];
  ok('saldo do Itaú = extrato − voz − poupança − fatura', AC.accountBalance(itau, fin), 379.07);
  ok('poupança recebe a transferência', AC.accountBalance(poup, fin), 1100);
  ok('cartão: compra 300 − pagamento 200 = deve 100', AC.accountBalance(card, fin), -100);
  const sum = AC.accountsSummary([itau, poup, card], fin);
  ok('dinheiro nas contas não soma o cartão', sum.money, Math.round((699.07 - 320 + 1100) * 100) / 100);
  ok('fatura em aberto', sum.cardDebt, 100);
  ok('lançamentos sem conta', sum.unassigned, 1);
  ok('guardado no mês', AC.savedInMonth(fin, [itau, poup, card], '2026-11'), 100);

  // reimportar: o Pix de 511,85 lançado como entrada sem conta vira transferência
  const existing = [{ id: 'x', type: 'in', account: null, amount: 511.85, date: '2026-11-06', status: 'paid' }];
  const rec = AC.reconcile([{ type: 'transfer', dir: 1, amount: 511.85, date: '2026-11-06', title: 'Transferência de outra conta sua' }], existing, 'itau', [itau]);
  ok('duplicado que vira transferência', [rec[0].action, rec[0].convert, rec[0].selected], ['dup', true, false]);
  ok('mudança no existente', AC.dupChanges(existing[0], rec[0], 'itau'), { type: 'transfer', category: 'Transferência', essential: null, account: null, from: null, to: 'itau' });

  // dois extratos: saída no Nubank (já no app) e chegada no Itaú = uma transferência só
  const ex2 = [{ id: 'y', type: 'transfer', from: 'nu', to: null, amount: 511.85, date: '2026-11-05', status: 'paid' }];
  const rec2 = AC.reconcile([{ type: 'transfer', dir: 1, amount: 511.85, date: '2026-11-06', title: 'T' }], ex2, 'itau', [itau, nu]);
  ok('pares entre extratos', [rec2[0].action, rec2[0].targetId], ['link', 'y']);
  ok('liga a ponta que faltava', AC.linkChanges(ex2[0], rec2[0], 'itau'), { to: 'itau' });

  // saída comum no Nubank + transferência sua chegando no Itaú
  const ex3 = [{ id: 'z', type: 'out', account: 'nu', amount: 80, date: '2026-11-06', status: 'paid' }];
  const rec3 = AC.reconcile([{ type: 'transfer', dir: 1, amount: 80, date: '2026-11-06', title: 'T' }], ex3, 'itau', [itau, nu]);
  ok('saída em outra conta vira transferência', AC.linkChanges(ex3[0], rec3[0], 'itau'), { type: 'transfer', category: 'Transferência', essential: null, account: null, from: 'nu', to: 'itau' });

  // fatura paga na corrente, com as compras do cartão já no app: vira transferência para o cartão
  const rec4 = AC.reconcile([{ type: 'out', amount: 446.11, date: '2026-11-06', title: 'Fatura do cartão' }], fin, 'itau', [itau, card]);
  ok('fatura paga vira transferência para o cartão', [rec4[0].type, rec4[0].toAccount], ['transfer', 'card']);
  // sem compras do cartão no app, continua sendo gasto
  const rec5 = AC.reconcile([{ type: 'out', amount: 446.11, date: '2026-11-06', title: 'Fatura do cartão' }], [], 'itau', [itau, card]);
  ok('sem compras do cartão, a fatura é gasto', rec5[0].type, 'out');
  // o mesmo valor em outra conta não é duplicado
  const rec6 = AC.reconcile([{ type: 'out', amount: 20, date: '2026-11-06', title: 'X' }], [{ id: 'w', type: 'out', account: 'nu', amount: 20, date: '2026-11-06' }], 'itau', [itau, nu]);
  ok('mesmo valor em outra conta não é duplicado', rec6[0].action, 'add');
  // transferências não entram no orçamento
  const bt = B.monthBudget([{ type: 'transfer', from: 'itau', to: null, amount: 500, date: '2026-11-03', status: 'paid' }], { salary: 3000 }, '2026-11', new Date(2026, 10, 6));
  ok('transferência fora do orçamento', [bt.essential, bt.nonEssential], [0, 0]);
}

// ---- 1.9.1: "99" e "23 e 99"
{
  const chk = (phrase, exp) => {
    total++;
    const got = parseInput(phrase, TODAY, NOW).map((i) => [i.title, i.amount, i.category]);
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      fails++;
      console.log(`FALHOU  "${phrase}": esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`);
    } else console.log(`ok      "${phrase}"`);
  };
  chk('23,99 gasto na farmácia', [['Farmácia', 23.99, 'Saúde']]);
  chk('passei 23 e 99 na farmácia', [['Farmácia', 23.99, 'Saúde']]);
  chk('gastei 23 reais e 99 na farmácia', [['Farmácia', 23.99, 'Saúde']]);
  chk('uber 25 e 99 15', [['Uber', 25, 'Transporte'], ['99', 15, 'Transporte']]);
  chk('luz 180, água 95 e aluguel 1800', [['Conta de luz', 180, 'Contas'], ['Conta de água', 95, 'Contas'], ['Aluguel', 1800, 'Contas']]);
  chk('peguei um 99 por 18 reais', [['99', 18, 'Transporte']]);
  chk('corrida da 99 32 reais', [['99', 32, 'Transporte']]);
}

// ---- 1.9.1: holerite, salário repetido e contas sem nome
{
  const ok = (name, got, exp) => {
    total++;
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      fails++;
      console.log(`FALHOU  contas 1.9.1: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`);
    } else console.log(`ok      contas 1.9.1: ${name}`);
  };
  const S = (o) => ({ type: 'in', category: 'Salário', title: 'Salário', status: 'paid', ...o });
  ok('salário com 7 centavos de diferença é o mesmo', AC.sameSalary(S({ amount: 1662.97, date: '2026-08-05' }), S({ amount: 1662.9, date: '2026-08-05' })), true);
  ok('salário com 1 dia de diferença é o mesmo', AC.sameSalary(S({ amount: 1994.09, date: '2026-09-04' }), S({ amount: 1994.09, date: '2026-09-05' })), true);
  ok('salário de outro mês não é o mesmo', AC.sameSalary(S({ amount: 1994.09, date: '2026-09-04' }), S({ amount: 1994.09, date: '2026-10-05' })), false);
  const itau = { id: 'itau', name: 'Itaú', kind: 'corrente', bank: 'Itaú', number: '012345-6', anchor: { date: '2026-11-06', balance: 699.07, at: 1 } };
  const existing = [S({ id: 'p1', amount: 1662.9, date: '2026-08-05', account: 'itau' }), S({ id: 'p2', amount: 1994.09, date: '2026-09-05', account: 'itau' })];
  const rec = AC.reconcile([S({ amount: 1662.97, date: '2026-08-05' }), S({ amount: 1994.09, date: '2026-09-04' }), S({ amount: 2019.64, date: '2026-10-05' })], existing, null, [itau]);
  ok('holerite: salários que já estão no app chegam como repetidos', rec.map((r) => r.action), ['dup', 'dup', 'add']);
  ok('holerite repetido chega desmarcado', rec.map((r) => r.selected), [false, false, true]);
  const conta1 = { id: 'c1', name: 'Conta', kind: 'corrente', number: null, bank: null, anchor: null };
  const conta2 = { id: 'c2', name: 'Conta', kind: 'corrente', number: null, bank: null, anchor: null };
  const accs = [itau, conta1, conta2];
  ok('contas sem nome', AC.placeholderAccounts(accs).map((a) => a.id), ['c1', 'c2']);
  ok('nomes iguais ficam diferentes', [AC.accountDisplayName(conta1, accs), AC.accountDisplayName(conta2, accs), AC.accountDisplayName(itau, accs)], ['Conta 1', 'Conta 2', 'Itaú']);
  const fin = [
    ...existing,
    S({ id: 'h1', amount: 1662.97, date: '2026-08-05', account: 'c1' }),
    S({ id: 'h2', amount: 2019.64, date: '2026-10-05', account: 'c2' }),
    { id: 't1', type: 'transfer', from: 'c2', to: 'itau', amount: 50, date: '2026-10-06', status: 'paid' },
  ];
  const plan = AC.planMerge(fin, accs, ['c1', 'c2'], 'itau');
  ok('juntar: tudo vai para o Itaú', [plan.count, plan.moves.h1, plan.moves.t1], [3, { account: 'itau' }, { from: 'itau' }]);
  ok('juntar: aponta o salário repetido', plan.repeated.map((r) => [r.id, r.of]), [['h1', 'p1']]);
  ok('juntar: o saldo que as contas sem nome inflavam', plan.balance, 3632.61);
  ok('juntar sem conta', AC.planMerge(fin, accs, ['c1'], null).moves.h1, { account: null });
  ok('repetido no mês', [...AC.likelyRepeated(fin).keys()], ['h1']);
  const finB = [S({ id: 'x1', amount: 1994.09, date: '2026-09-04', account: 'c1' }), S({ id: 'x2', amount: 1994.09, date: '2026-09-05', account: 'c2' })];
  ok('juntar: repetido entre as próprias contas sem nome', AC.planMerge(finB, accs, ['c1', 'c2'], 'itau').repeated.map((r) => [r.id, r.of]), [['x2', 'x1']]);
}

// ---- recebimentos, extras e indicadores
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  indicadores: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      indicadores: ${name}`);
  };
  const itau = { id: 'itau', name: 'Itaú', kind: 'corrente', anchor: { date: '2026-11-01', balance: 1000, at: 0 } };
  const nu = { id: 'nu', name: 'Nubank', kind: 'corrente', anchor: { date: '2026-11-01', balance: 200, at: 0 } };
  const card = { id: 'card', name: 'Cartão', kind: 'cartao', anchor: null };
  const accs = [itau, nu, card];
  const P = (o) => ({ status: 'paid', createdAt: 5, ...o });
  const fin = [
    // meses anteriores: salário 3000, gasto 2000 (com 500 de mercado até o dia 7)
    ...['2026-08', '2026-09', '2026-10'].flatMap((m) => [
      P({ type: 'in', category: 'Salário', amount: 3000, date: `${m}-05`, account: 'itau' }),
      P({ type: 'out', category: 'Alimentação', amount: 500, date: `${m}-06`, account: 'itau' }),
      P({ type: 'out', category: 'Lazer', amount: 1500, date: `${m}-20`, account: 'card' }),
    ]),
    // novembro, até o dia 7
    P({ type: 'in', category: 'Salário', amount: 3000, date: '2026-11-05', account: 'itau' }),
    P({ type: 'in', category: 'Outros', title: 'Pix de Ana', amount: 150, date: '2026-11-06', account: 'nu' }),
    P({ type: 'transfer', from: null, to: 'nu', amount: 300, date: '2026-11-06' }),
    P({ type: 'transfer', from: 'itau', to: 'nu', amount: 100, date: '2026-11-06' }),
    P({ type: 'transfer', from: 'itau', to: 'card', amount: 400, date: '2026-11-07' }),
    P({ type: 'out', category: 'Alimentação', amount: 900, date: '2026-11-06', account: 'itau' }),
    { type: 'out', category: 'Contas', amount: 200, date: '2026-11-20', account: 'itau', status: 'pending' },
  ];
  const rc = IN.receipts(fin, accs, '2026-11');
  ok('recebimentos separados', [rc.totals.salary, rc.totals.extra, rc.totals.own, rc.newMoney], [3000, 150, 400, 3150]);
  ok('a receber fica à parte', IN.receipts([...fin, { type: 'in', category: 'Extra', amount: 90, date: '2026-11-25', status: 'pending', account: 'nu' }], accs, '2026-11').pending.extra, 90);
  ok('pagamento da fatura não é recebimento', rc.own.some((t) => t.to === 'card'), false);
  const bud = B.monthBudget(fin, { salary: 3000 }, '2026-11', new Date(2026, 10, 7));
  ok('extra fora do limite', [bud.income, bud.salaryIncome, bud.extraIncome], [3000, 3000, 150]);
  const bud2 = B.monthBudget(fin, { salary: 3000, countExtras: true }, '2026-11', new Date(2026, 10, 7));
  ok('extra dentro do limite quando pedido', bud2.income, 3150);
  const br = IN.balanceBridge(fin, accs, '2026-11', '2026-11-07');
  ok('ponte do saldo', [br.start, br.incomes, br.outs, br.cardPay, br.extIn, br.internal, br.end], [1200, 3150, 900, 400, 300, 100, 3350]);
  ok('saldo bate com as contas', br.end, AC.accountsSummary(accs, fin).money);
  const fc = IN.monthForecast(fin, accs, { salary: 3000 }, '2026-11', '2026-11-07');
  ok('previsto = contas + a receber − a pagar', [fc.base, fc.value], ['accounts', 3150]);
  const ins = IN.financeInsights(fin, accs, { salary: 3000, target: 500 }, '2026-11-07');
  ok('gasto até o mesmo dia x meses anteriores', [ins.pace.spentSoFar, ins.pace.avgSoFar, ins.pace.diff], [900, 500, 400]);
  ok('deveria ter guardado', [ins.saving.months, ins.saving.leftover, ins.saving.goal], [3, 3000, 1500]);
  ok('o que mais subiu', ins.rises.map((r) => [r.category, r.diff]), [['Alimentação', 400]]);
  ok('se continuar assim (descontando a fatura em aberto)', [ins.projection.monthlyNet, ins.projection.debtTaken, ins.projection.ahead[0].value, ins.projection.ahead[2].value], [1000, 4100, 50, 2050]);
  ok('mês sem histórico', IN.financeInsights([], [], {}, '2026-11-07').enough, false);
}

// ---- 1.9.2: saldo, ponte e transferências (valores do extrato de 06/11)
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.9.2: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.9.2: ${name}`);
  };
  const itau = { id: 'itau', name: 'Itaú', kind: 'corrente', anchor: { date: '2026-11-06', balance: 699.07, at: 2000, importId: 'imp1' } };
  const conta = { id: 'conta', name: 'Conta', kind: 'corrente', anchor: null };
  const card = { id: 'card', name: 'Cartão', kind: 'cartao', anchor: null };
  const P = (o) => ({ status: 'paid', importId: 'imp1', createdAt: 1000, ...o });
  const out = (amount, date) => P({ type: 'out', category: 'Contas', account: 'itau', amount, date });
  const own = (amount, date) => P({ type: 'transfer', title: 'Transferência de outra conta sua', category: 'Transferência', from: null, to: 'itau', account: null, amount, date });
  const nov = [
    ...[114.9, 250, 50, 29.9, 129.81, 446.11, 25, 12, 1538.11, 266.63, 50, 31.8].map((v) => out(v, '2026-11-06')),
    out(25, '2026-11-05'), out(1, '2026-11-04'), out(0.45, '2026-11-04'), out(1.57, '2026-11-03'),
    P({ type: 'in', category: 'Salário', title: 'Salário', account: 'itau', amount: 3157.49, date: '2026-11-05' }),
    own(511.85, '2026-11-06'), own(24.1, '2026-11-03'), own(3, '2026-11-03'), own(2.01, '2026-11-03'),
  ].map((t, i) => ({ id: `n${i}`, ...t }));
  // histórico sem saldo: soma −923,65, igual à conta "Conta" do print
  const hist = [{ id: 'h', type: 'out', category: 'Outros', title: 'Histórico', account: 'conta', amount: 923.65, date: '2026-10-05', status: 'paid', createdAt: 1 }];
  const fin = [...nov, ...hist];
  const today = '2026-11-08';

  // Bug 1
  const sum = AC.accountsSummary([itau, conta], fin);
  ok('o Itaú dá 699,07', AC.accountBalance(itau, fin), 699.07);
  ok('conta sem saldo não entra no total', [sum.money, sum.unknown, sum.hasKnown], [699.07, 1, true]);
  ok('previsto ignora conta sem saldo', [IN.monthForecast(fin, [itau, conta], {}, '2026-11', today).value], [699.07]);
  ok('saldo em outro dia ignora conta sem saldo', IN.moneyAt(fin, [itau, conta], '2026-10-31'), -27.1);
  const brAll = IN.balanceBridge(fin, [itau, conta], '2026-11', today);
  ok('ponte dos indicadores ignora conta sem saldo', [brAll.start, brAll.end], [-27.1, 699.07]);
  ok('projeção parte só do saldo conhecido', IN.financeInsights(fin, [itau, conta], {}, today).projection.endOfMonth, 699.07);
  const none = AC.accountsSummary([conta], fin);
  ok('só conta sem saldo: não há total conhecido', [none.money, none.hasKnown, none.unknown], [0, false, 1]);
  ok('só conta sem saldo: previsto não usa as contas', IN.monthForecast(fin, [conta], {}, '2026-11', today).base, 'result');
  ok('só conta sem saldo: sem ponte nos indicadores', IN.balanceBridge(fin, [conta], '2026-11', today), null);
  ok('digitar o saldo põe a conta no total', AC.accountsSummary([itau, { ...conta, anchor: { date: today, balance: 50, at: 9000 } }], fin).money, 749.07);
  const cardFin = [...fin, { id: 'c', type: 'out', account: 'card', amount: 80, date: '2026-11-07', status: 'paid', createdAt: 3000 }];
  const withCard = AC.accountsSummary([itau, card], cardFin);
  ok('cartão continua igual', [withCard.money, withCard.cardDebt, withCard.unknown], [699.07, 80, 0]);

  // Bug 2
  ok('ponte de novembro fecha com o extrato', (({ start, incomes, moved, outs, end, endDate, fromStatement, later, now }) => [start, incomes, moved, outs, end, endDate, fromStatement, later, now])(AC.accountBridge(itau, fin, '2026-11')), [-27.1, 3157.49, 540.96, 2972.28, 699.07, '2026-11-06', true, 0, 699.07]);
  ok('conta sem saldo não mostra ponte', AC.accountBridge(conta, fin, '2026-10'), null);
  ok('mês antes do saldo do extrato não mostra ponte', AC.accountBridge(itau, [...fin, out(10, '2026-10-20')], '2026-10'), null);
  const voice = { id: 'v', type: 'out', category: 'Alimentação', account: 'itau', amount: 30, date: '2026-11-07', status: 'paid', createdAt: 5000 };
  const brV = AC.accountBridge(itau, [...fin, voice], '2026-11');
  ok('lançamento depois do extrato aparece à parte', [brV.end, brV.later, brV.now], [699.07, -30, 669.07]);
  ok('saldo de hoje bate com a ponte', AC.accountBalance(itau, [...fin, voice]), 669.07);
  const dec = { id: 'd', type: 'in', category: 'Extra', account: 'itau', amount: 100, date: '2026-12-02', status: 'paid', createdAt: 6000 };
  const brD = AC.accountBridge(itau, [...fin, voice, dec], '2026-12');
  ok('mês seguinte parte do saldo do mês anterior', [brD.start, brD.incomes, brD.end, brD.endDate], [669.07, 100, 769.07, null]);
  const res = (list) => Math.round((list.filter((t) => t.type === 'in').reduce((a, t) => a + t.amount, 0) - list.filter((t) => t.type === 'out').reduce((a, t) => a + t.amount, 0)) * 100) / 100;
  ok('resultado com as transferências certas', res(nov), 185.21);

  // Bug 3
  const merged = (() => {
    const accs = [itau, conta];
    const mixed = [...fin, { id: 'tc', type: 'transfer', from: 'conta', to: null, amount: 5, date: '2026-10-07', status: 'paid', createdAt: 1 }];
    const plan = AC.planMerge(mixed, accs, ['conta'], 'itau');
    return mixed.map((t) => (plan.moves[t.id] ? { ...t, ...plan.moves[t.id] } : t));
  })();
  const pick = (t) => [t.type, t.from, t.to, t.amount];
  ok('Arrumar não mexe nas transferências do extrato', merged.filter((t) => t.id.startsWith('n') && t.type === 'transfer').map(pick), nov.filter((t) => t.type === 'transfer').map(pick));
  ok('Arrumar mantém tipo e troca só a ponta da conta juntada', pick(merged.find((t) => t.id === 'tc')), ['transfer', 'itau', null, 5]);
  ok('Arrumar não muda o saldo do Itaú com lançamentos anteriores ao extrato', AC.accountBalance(itau, merged), 699.07);
  ok('título acompanha o tipo', [AC.titleForType('Transferência de outra conta sua', 'in'), AC.titleForType('Transferência para outra conta sua', 'out'), AC.titleForType('Salário', 'in'), AC.titleForType('Transferência de outra conta sua', 'transfer')], ['Pix recebido', 'Pix enviado', 'Salário', 'Transferência de outra conta sua']);
  const wrong = { type: 'in', title: 'Transferência de outra conta sua', category: 'Outros', account: null, to: 'itau', amount: 511.85 };
  ok('entrada com título de transferência é apontada', [AC.looksLikeOwnTransfer(wrong), AC.looksLikeOwnTransfer({ type: 'in', title: 'Pix de Ana' }), AC.looksLikeOwnTransfer(nov[20])], [true, false, false]);
  ok('"É meu" recupera a conta da ponta antiga', AC.ownTransferChanges(wrong), { type: 'transfer', category: 'Transferência', essential: null, account: null, from: null, to: 'itau' });
  ok('"É meu" numa entrada com conta', AC.ownTransferChanges({ type: 'in', account: 'itau' }).to, 'itau');
  ok('"É meu" numa saída sai da conta', [AC.ownTransferChanges({ type: 'out', account: 'itau' }).from, AC.ownTransferChanges({ type: 'out', account: 'itau' }).to], ['itau', null]);
  const form = { kind: 'finance', title: 'Pix recebido', amountText: '10,00', dateText: '06/11/2026', type: 'in', category: 'Outros', status: 'paid', account: 'itau', from: null, to: 'itau', raw: '' };
  const asIn = IF.readEditable(form).data;
  ok('virar entrada limpa as pontas', [asIn.type, asIn.account, asIn.from, asIn.to], ['in', 'itau', null, null]);
  const asTr = IF.readEditable({ ...form, type: 'transfer', from: null, to: 'itau' }).data;
  ok('virar transferência limpa a conta', [asTr.type, asTr.account, asTr.to], ['transfer', null, 'itau']);

  // Bug 4: absoluteFillObject não existe no React Native 0.88 (no web existe, por isso passava)
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const code = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  ok('ninguém usa StyleSheet.absoluteFillObject', [...walk(join(root, 'src')), join(root, 'App.js')].filter((p) => /StyleSheet\.absoluteFillObject/.test(code(p))).length, 0);
  ok('Tudo do mês cobre a tela', /wrap: \{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0/.test(readFileSync(join(root, 'src/components/MonthView.js'), 'utf8')), true);
}

// ---- 1.9.3: números que não enganam (valores fictícios, no formato do extrato do Itaú)
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.9.3: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.9.3: ${name}`);
  };
  const r2 = (n) => Math.round(n * 100) / 100;
  const txt = [
    'FULANO DE TAL 000.000.000-00 agência: 0001 conta: 012345-6',
    'extrato conta / lançamentos',
    'data lançamentos valor (R$) saldo (R$)',
    '09/11/2026 PAY PADARIA 07/11 -20,00',
    '09/11/2026 RSCSS TRANSP COLET0711 -6,00',
    '07/11/2026 SALDO DO DIA 474,00',
    '06/11/2026 PIX TRANSF Fulano D06/11 100,00',
    '06/11/2026 PIX QRS MERCADO06/11 -100,00',
    '06/11/2026 SALDO DO DIA 500,00',
    '05/11/2026 REMUNERACAO/SALARIO 2.000,00',
    '05/11/2026 PAG BOLETO ALUGUEL -1.450,00',
    '05/11/2026 SALDO DO DIA 500,00',
    '31/10/2026 SALDO DO DIA -50,00',
  ].join('\n');
  const st = DP.parseStatementText(txt, '2026-11-08');
  const late = st.items.filter((i) => /padaria|colet/i.test(i.title));
  ok('compra com data do próximo dia útil volta para o dia da compra', late.map((i) => [i.date, i.status]), [['2026-11-07', 'paid'], ['2026-11-07', 'paid']]);
  ok('nenhum lançamento do extrato vira "a pagar"', st.items.filter((i) => i.status === 'pending').length, 0);
  ok('lançamento futuro sem data na descrição continua futuro', DP.parseStatementText(txt.replace('PAY PADARIA 07/11', 'PAY PADARIA'), '2026-11-08').items.find((i) => /padaria/i.test(i.title)).status, 'pending');
  const acc = { id: 'itau', name: 'Itaú', kind: 'corrente', anchor: { date: st.meta.balanceDate, balance: st.meta.balance, at: 1, importId: 'imp1' } };
  let n = 0;
  const fin = AC.reconcile(st.items, [], 'itau', [acc]).filter((x) => x.action === 'add').map((x) => ({ id: 'z' + n++, createdAt: 1, ...AC.toFinanceData(x, 'itau', 'imp1') }));
  ok('saldo continua o do extrato', AC.accountsSummary([acc], fin).money, 474);
  const br = IN.balanceBridge(fin, [acc], '2026-11', '2026-11-08');
  ok('ponte: começou + entrou + outras contas − saiu = hoje', [br.start, br.incomes, br.extIn, br.outs, br.end, r2(br.start + br.incomes + br.extIn - br.outs)], [-50, 2000, 100, 1576, 474, 474]);
  const cash = IN.cashAvailable(fin, [acc], { salary: 2000 }, '2026-11', '2026-11-08');
  ok('previsto não desconta de novo as compras do dia 07', cash.value, 474);
  ok('dinheiro disponível só no mês atual', IN.cashAvailable(fin, [acc], {}, '2026-10', '2026-11-08'), null);
  const cardAcc = { id: 'card', name: 'Cartão', kind: 'cartao', anchor: { date: '2026-11-07', balance: -300, at: 1 } };
  ok('fatura em aberto sai do dinheiro disponível', IN.cashAvailable(fin, [acc, cardAcc], {}, '2026-11', '2026-11-08').value, 174);

  // "Ainda pode gastar" com teto
  const now = new Date(2026, 10, 8, 10);
  const extra = [...fin, { id: 'x', type: 'in', category: 'Extra', title: 'Pix recebido', amount: 100, date: '2026-11-06', status: 'paid', account: 'itau', createdAt: 1 }];
  const free = B.monthBudget(extra, { salary: 2000, countExtras: true }, '2026-11', now);
  const capped = B.monthBudget(extra, { salary: 2000, countExtras: true }, '2026-11', now, 474);
  ok('sem teto, o limite passa do dinheiro', r2(free.remaining) > 474, true);
  ok('com teto, pode gastar = dinheiro de verdade', [capped.remaining, capped.capped, r2(capped.byLimit)], [474, true, r2(free.remaining)]);
  ok('limite abaixo do dinheiro não muda', B.monthBudget(fin, { salary: 2000 }, '2026-11', now, 474).capped, false);
  const over = [...fin, { id: 'o', type: 'out', category: 'Lazer', title: 'Viagem', amount: 1000, date: '2026-11-06', status: 'paid', account: 'itau', createdAt: 1 }];
  ok('passou do limite continua passou', [r2(B.monthBudget(over, { salary: 2000 }, '2026-11', now, 474).remaining), B.monthBudget(over, { salary: 2000 }, '2026-11', now, 474).status], [-576, 'over']);
  ok('teto negativo vira zero, não "passou"', B.monthBudget(extra, { salary: 2000, countExtras: true }, '2026-11', now, -30).remaining, 0);
  ok('aviso usa o valor com teto', B.spendingAlert({ ...capped, used: 0.95 }, 'media'), 'Você já usou 95% do limite do mês. Ainda pode gastar R$ 474,00.');

  // salário repetido no mesmo mês, em qualquer dia
  const S = (id, date, amount, o = {}) => ({ id, type: 'in', category: 'Salário', title: 'Salário', amount, date, status: 'paid', createdAt: id.charCodeAt(0), ...o });
  ok('mesmo mês, dias longe: repetido', AC.sameSalary(S('a', '2026-11-05', 2000), S('b', '2026-11-25', 2000.4)), true);
  ok('0,5% de diferença ainda é o mesmo salário', AC.sameSalary(S('a', '2026-11-05', 2000), S('b', '2026-11-01', 2009)), true);
  ok('valores bem diferentes não são o mesmo', AC.sameSalary(S('a', '2026-11-05', 2000), S('b', '2026-11-20', 800)), false);
  ok('meses diferentes longe da virada não são o mesmo', AC.sameSalary(S('a', '2026-10-05', 2000), S('b', '2026-11-05', 2000)), false);
  ok('virada do mês (30/10 e 01/11) ainda é o mesmo', AC.sameSalary(S('a', '2026-10-30', 2000), S('b', '2026-11-01', 2000)), true);
  ok('Tudo do mês aponta o repetido', [...AC.likelyRepeated([S('a', '2026-11-05', 2000), S('b', '2026-11-28', 2000)])], [['b', 'a']]);

  // holerite x extrato
  const hol = { title: 'Salário', amount: 2000, type: 'in', category: 'Salário', date: '2026-11-01', status: 'paid', payslip: true };
  const rh = AC.reconcile([hol], fin, null, [acc])[0];
  ok('holerite depois do extrato confirma, não duplica', [rh.action, rh.selected, rh.salaryFix], ['dup', false, false]);
  ok('holerite explica que confirmou', /^Confirmado pelo holerite/.test(rh.hint), true);
  const pixFirma = [{ id: 'p', type: 'in', category: 'Outros', title: 'Pix recebido', amount: 2000, date: '2026-11-05', status: 'paid', account: 'itau', createdAt: 1 }];
  const rp = AC.reconcile([hol], pixFirma, null, [acc])[0];
  ok('holerite acha o depósito que não veio como salário', [rp.action, rp.targetId, rp.salaryFix], ['dup', 'p', true]);
  ok('e ele passa a contar como salário, na mesma conta', AC.dupChanges(pixFirma[0], { type: 'in', salaryFix: true, payslip: true }, null), { category: 'Salário' });
  ok('holerite não muda a conta de quem já está no app', AC.dupChanges({ type: 'in', category: 'Salário', account: null }, { type: 'in', payslip: true }, null), null);
  ok('extrato depois do holerite: o salário não entra de novo', AC.reconcile([{ ...hol, payslip: false, date: '2026-11-05' }], [S('h', '2026-11-01', 2000)], 'itau', [acc])[0].action, 'dup');
  ok('holerite de outro mês entra normal', AC.reconcile([{ ...hol, date: '2026-12-01' }], fin, null, [acc])[0].action, 'add');
  ok('tipo do documento: holerite x extrato', [DP.detectKind('Recibo de pagamento de salário Proventos Líquido a receber'), DP.detectKind(txt)], ['holerite', 'extrato']);

  // tela: nomes novos
  const fs = readFileSync(join(root, 'src/screens/FinanceScreen.js'), 'utf8');
  ok('cartão do mês tem os dois nomes', /Sobra do mês/.test(fs) && /Mudança no saldo/.test(fs) && /Veio de outras contas suas/.test(fs), true);
  ok('frase antiga de Recebimentos saiu', /não aumenta o que você tem/.test(fs), false);
}

// ---- 1.10: de onde vem o dinheiro (valores fictícios)
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.10: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.10: ${name}`);
  };
  const r2 = (n) => Math.round(n * 100) / 100;
  const now = new Date(2026, 10, 8, 10);
  const itau = { id: 'itau', name: 'Itaú', kind: 'corrente', anchor: { date: '2026-11-07', balance: 474, at: 1, importId: 'i' } };
  const poup = { id: 'poup', name: 'Poupança', kind: 'poupanca', anchor: { date: '2026-11-07', balance: 1000, at: 1, importId: 'i' } };
  const nu = { id: 'nu', name: 'Nubank', kind: 'corrente', anchor: null };
  const card = { id: 'card', name: 'Cartão', kind: 'cartao', anchor: null };
  const T = (id, amount, from, to, o = {}) => ({ id, type: 'transfer', category: 'Transferência', title: 'Transferência', amount, from, to, date: '2026-11-03', status: 'paid', createdAt: 1, ...o });
  const base = [
    { id: 's', type: 'in', category: 'Salário', title: 'Salário', amount: 2000, date: '2026-11-05', status: 'paid', account: 'itau', createdAt: 1 },
    { id: 'o', type: 'out', category: 'Contas', title: 'Aluguel', amount: 1990, date: '2026-11-05', status: 'paid', account: 'itau', createdAt: 1 },
  ];
  const fin = [...base, T('a', 300, null, 'itau'), T('b', 100, 'nu', 'itau'), T('c', 500, 'itau', 'poup'), T('d', 50, 'itau', 'card'), T('e', 70, null, 'itau', { status: 'pending' }), T('f', 9, null, 'itau', { date: '2026-10-30' })];
  const accs = [itau, poup, nu, card];
  ok('de outras contas: de fora e de conta sem saldo contam; entre contas com saldo, fatura, a receber e outro mês não', IN.fromOtherAccounts(fin, accs, '2026-11'), 400);
  ok('sem conta com saldo: só o que não tem origem', IN.fromOtherAccounts(fin, [], '2026-11'), 300);

  ok('regra: sem resposta, não entra no limite', B.ownDecision({}, '2026-11'), null);
  ok('regra: sempre usar / reserva', [B.ownDecision({ useOwn: 'always' }, '2026-11'), B.ownDecision({ useOwn: 'never' }, '2026-11')], [true, false]);
  ok('a resposta do mês vale mais que a regra', [B.ownDecision({ useOwn: 'always', ownMonths: { '2026-11': false } }, '2026-11'), B.ownDecision({ useOwn: 'never', ownMonths: { '2026-11': true } }, '2026-11')], [false, true]);

  const plain = B.monthBudget(base, { salary: 2000 }, '2026-11', now, null, 400);
  const used = B.monthBudget(base, { salary: 2000, ownMonths: { '2026-11': true } }, '2026-11', now, null, 400);
  ok('sem usar: pode gastar só o que sobra do salário', [r2(plain.remaining), plain.ownIncome, plain.ownAmount], [10, 0, 400]);
  ok('usar no mês: o limite ganha o dinheiro da outra conta', [r2(used.remaining), used.ownIncome, used.salaryIncome], [410, 400, 2000]);
  ok('usar no mês respeita o teto do dinheiro real', B.monthBudget(base, { salary: 2000, ownMonths: { '2026-11': true } }, '2026-11', now, 300, 400).remaining, 300);
  const over = B.monthBudget(base, { salary: 2000, target: 100 }, '2026-11', now, null, 400);
  ok('passou do limite: o dinheiro da outra conta cobre a diferença', [r2(over.remaining), over.covered, over.status], [-90, 90, 'over']);
  ok('cobre só até o que veio', B.monthBudget(base, { salary: 2000, target: 600 }, '2026-11', now, null, 400).covered, 400);
  ok('usado no limite, não aparece como cobertura', B.monthBudget(base, { salary: 2000, target: 100, ownMonths: { '2026-11': true } }, '2026-11', now, null, 400).covered, 0);
  const bf = IN.budgetFor(fin, accs, { salary: 2000, useOwn: 'always' }, '2026-11', '2026-11-08', now);
  ok('budgetFor junta teto e outras contas', [bf.ownAmount, bf.ownIncome, bf.cashInfo !== null], [400, 400, true]);

  // perguntas
  const q = (b, o = {}) => B.pendingPrompt(b, { ym: '2026-11', isCurrentMonth: true, ownAmount: 400, advanced: true, later: false, ...o });
  ok('salário primeiro', q({ salaryAsk: { amount: 2000, date: '2026-11-05' } }), 'salary');
  ok('com tipo de renda já escolhido, não pergunta o salário', q({ salaryAsk: { amount: 2000 }, incomeType: 'fixed' }), 'own');
  ok('depois, o dinheiro de outra conta', q({}), 'own');
  ok('não pergunta de novo no mesmo mês', q({ ownMonths: { '2026-11': false } }), null);
  ok('não pergunta com regra fixa, no Simples, em outro mês, sem valor ou depois de "Perguntar depois"', [q({ useOwn: 'always' }), q({}, { advanced: false }), q({}, { isCurrentMonth: false }), q({}, { ownAmount: 0 }), q({}, { later: true }), q({}, { ownAmount: 0.01 })], [null, null, null, null, null, null]);

  // previsão pelo tipo de renda
  const M = (ym, sal, spend, extra = 0) => [
    { id: ym + 's', type: 'in', category: 'Salário', title: 'Salário', amount: sal, date: `${ym}-05`, status: 'paid', account: 'itau', createdAt: 1 },
    { id: ym + 'o', type: 'out', category: 'Contas', title: 'Contas', amount: spend, date: `${ym}-06`, status: 'paid', account: 'itau', createdAt: 1 },
    ...(extra ? [{ id: ym + 'x', type: 'in', category: 'Extra', title: 'Bico', amount: extra, date: `${ym}-07`, status: 'paid', account: 'itau', createdAt: 1 }] : []),
  ];
  const hist = [...M('2026-08', 4000, 3000), ...M('2026-09', 2000, 1900), ...M('2026-10', 2000, 2100, 300), ...base];
  const fx = IN.financeInsights(hist, [itau], { salary: 2500, incomeType: 'fixed' }, '2026-11-08').projection;
  ok('renda fixa: usa o salário confirmado', [fx.profile, fx.monthlyIncome, fx.ready, fx.low], ['fixed', 2500, true, null]);
  ok('renda fixa: salário − gasto médio', fx.monthlyNet, r2(2500 - (3000 + 1900 + 2100) / 3));
  const vr = IN.financeInsights(hist, [itau], { incomeType: 'variable' }, '2026-11-08').projection;
  ok('renda que varia: média com faixa do pior ao melhor mês', [vr.profile, vr.monthlyNet, vr.low, vr.high], ['variable', r2((1000 + 100 + 200) / 3), 100, 1000]);
  ok('faixa nos próximos meses', [vr.ahead[0].low <= vr.ahead[0].value, vr.ahead[0].value <= vr.ahead[0].high], [true, true]);
  const sk = IN.financeInsights(hist, [itau], { incomeType: 'variable', skipMonths: ['2026-08'] }, '2026-11-08').projection;
  ok('mês fora do comum sai da média', [sk.months, sk.monthlyNet, sk.high], [2, 150, 200]);
  ok('lista mostra o mês marcado', sk.history.map((m) => [m.ym, m.skip]), [['2026-10', false], ['2026-09', false], ['2026-08', true]]);
  const one = IN.financeInsights([...M('2026-10', 2000, 1500), ...base], [itau], { incomeType: 'variable' }, '2026-11-08').projection;
  ok('renda que varia precisa de 2 meses normais', [one.ready, one.minMonths], [false, 2]);
  ok('renda fixa já prevê com 1 mês', IN.financeInsights([...M('2026-10', 2000, 1500), ...base], [itau], { incomeType: 'fixed', salary: 2000 }, '2026-11-08').projection.ready, true);
  ok('sem tipo escolhido: com salário base é fixa, sem é variável', [IN.financeInsights(hist, [itau], { salary: 2000 }, '2026-11-08').projection.profile, IN.financeInsights(hist, [itau], {}, '2026-11-08').projection.profile], ['fixed', 'variable']);

  // importação
  const txt = ['FULANO DE TAL 000.000.000-00 agência: 0001 conta: 012345-6', 'extrato conta / lançamentos', '06/11/2026 PIX TRANSF Fulano D06/11 100,00', '06/11/2026 PIX TRANSF Ciclano06/11 50,00', '06/11/2026 SALDO DO DIA 500,00'].join('\n');
  const st = DP.parseStatementText(txt, '2026-11-08');
  ok('Pix com o nome do titular fica marcado; de outra pessoa, não', st.items.map((i) => [i.type, !!i.holderPix]), [['transfer', true], ['in', false]]);
  const es = readFileSync(join(root, 'src/EditSheet.js'), 'utf8');
  ok('revisão pergunta de qual conta vêm os Pix com o seu nome', /De qual conta sua\?/.test(es) && /Não acompanho/.test(es) && /Cadastrar conta/.test(es), true);
  ok('importação com salário pede o "é o seu salário?"', /salaryAsk: \{ amount: sal\.amount/.test(es), true);
  const fs = readFileSync(join(root, 'src/components/FinancePrompts.js'), 'utf8');
  ok('pop-ups só com a aba Finanças aberta', /<Screen active=\{key === current\} \/>/.test(readFileSync(join(root, 'App.js'), 'utf8')) && (readFileSync(join(root, 'src/screens/FinanceScreen.js'), 'utf8').match(/\{active \? <FinancePrompts/g) || []).length === 2, true);
  ok('pop-ups com os botões combinados', ['Sim, recebo todo mês', 'Não, minha renda varia', 'Sim, usar no mês', 'Não, é reserva', 'Perguntar depois'].every((t) => fs.includes(t)), true);
}

// ---- 1.10: complemento — salário já no app e previsto com renda que varia
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.10b: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.10b: ${name}`);
  };
  const sal = (date, amount, o = {}) => ({ id: date, type: 'in', category: 'Salário', title: 'Salário', amount, date, status: 'paid', ...o });
  const fin = [sal('2026-10-05', 2000), sal('2026-11-05', 2100), sal('2026-06-05', 1800)];
  ok('salário já no app: pergunta com o mais novo', B.salaryToAsk({}, fin, '2026-11-08'), { amount: 2100, date: '2026-11-05', source: 'já no app' });
  ok('não pergunta com o tipo de renda escolhido', B.salaryToAsk({ incomeType: 'fixed' }, fin, '2026-11-08'), null);
  ok('não pergunta de novo depois de "Agora não"', B.salaryToAsk({ salaryAskSeen: true }, fin, '2026-11-08'), null);
  ok('salário antigo (mais de 2 meses) não pergunta', B.salaryToAsk({}, [sal('2026-06-05', 1800)], '2026-11-08'), null);
  ok('salário a receber não conta', B.salaryToAsk({}, [sal('2026-11-20', 2100, { status: 'pending' })], '2026-11-08'), null);
  ok('virada do ano: dezembro vale em janeiro', B.salaryToAsk({}, [sal('2025-12-05', 2000)], '2026-01-03').date, '2025-12-05');
  const acc = { id: 'a', name: 'Itaú', kind: 'corrente', anchor: { date: '2026-11-01', balance: 100, at: 1 } };
  const fixed = IN.monthForecast([], [acc], { salary: 2000, incomeType: 'fixed' }, '2026-11', '2026-11-03');
  const variable = IN.monthForecast([], [acc], { salary: 2000, incomeType: 'variable' }, '2026-11', '2026-11-03');
  ok('previsto: renda fixa soma o salário que ainda vai cair', [fixed.salaryPending, fixed.value], [2000, 2100]);
  ok('previsto: renda que varia não soma salário incerto', [variable.salaryPending, variable.value], [0, 100]);
  const fs = readFileSync(join(root, 'src/screens/FinanceScreen.js'), 'utf8');
  ok('Finanças pergunta o salário que já está no app', /salaryToAsk\(settings\.budget, finance, today\)/.test(fs), true);
  const fp = readFileSync(join(root, 'src/components/FinancePrompts.js'), 'utf8');
  ok('toda resposta do salário marca que já perguntou', (fp.match(/salaryAskSeen: true/g) || []).length >= 4, true);
}

// ---- 1.10.1: aviso de teste e saudação
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.10.1: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.10.1: ${name}`);
  };
  const rem = readFileSync(join(root, 'src/reminders.js'), 'utf8');
  ok('aviso de teste vem daqui a 5 s, como um lembrete de verdade', /PREVIEW_SECONDS = 5/.test(rem) && /TIME_INTERVAL, seconds, channelId: channelId\(\)/.test(rem), true);
  const dr = readFileSync(join(root, 'src/Drawer.js'), 'utf8');
  ok('Ajustes mostra a contagem no meio da tela', /<AlertPreview preview=\{preview\}/.test(dr) && /onPreview\(\{ style: v, seconds: PREVIEW_SECONDS/.test(dr), true);
  const ap = readFileSync(join(root, 'src/components/AlertPreview.js'), 'utf8');
  ok('contagem explica o "mostrar como pop-up" e abre os ajustes', /Mostrar como pop-up/.test(ap) && /Linking\.openSettings\(\)/.test(ap), true);
  const eg = readFileSync(join(root, 'src/components/EntryGreeting.js'), 'utf8');
  ok('saudação e pendências aparecem juntas, sem atraso', !/setStep/.test(eg) && /entry\.messages\.map/.test(eg), true);
  ok('saudação fica embaixo, não em cima do título', /EntryGreeting bottom=\{TAB_HEIGHT \+ insets\.bottom \+ 14\}/.test(readFileSync(join(root, 'App.js'), 'utf8')) && !/\{ top, opacity \}/.test(eg), true);
  ok('no máximo 2 mensagens na saudação', /MAX_MESSAGES = 2/.test(eg), true);
}

// ---- 1.11: backup
{
  const ok = (name, got, exp) => {
    total++;
    const same = JSON.stringify(got) === JSON.stringify(exp);
    if (!same) { fails++; console.log(`FALHOU  1.11: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`); } else console.log(`ok      1.11: ${name}`);
  };
  // armazenamento de mentira, em memória (pasta própria: a do começo já foi apagada)
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  writeFileSync(join(dir, 'asyncStub.mjs'), `const m = new Map();
export default {
  _m: m,
  async getItem(k) { return m.has(k) ? m.get(k) : null; },
  async setItem(k, v) { m.set(k, String(v)); },
  async removeItem(k) { m.delete(k); },
  async multiGet(ks) { return ks.map((k) => [k, m.has(k) ? m.get(k) : null]); },
  async multiSet(ps) { ps.forEach(([k, v]) => m.set(k, String(v))); },
  async multiRemove(ks) { ks.forEach((k) => m.delete(k)); },
};`);
  writeFileSync(join(dir, 'rnStub.mjs'), `export const Platform = { OS: 'test' };`);
  writeFileSync(
    join(dir, 'backup.mjs'),
    readFileSync(join(root, 'src/backup.js'), 'utf8')
      .replace("from '@react-native-async-storage/async-storage'", "from './asyncStub.mjs'")
      .replace("from 'react-native'", "from './rnStub.mjs'")
  );
  const BK = await import(pathToFileURL(join(dir, 'backup.mjs')).href);
  const AS = (await import(pathToFileURL(join(dir, 'asyncStub.mjs')).href)).default;
  const tasks = [{ id: 't1', title: 'Lavar roupa', done: false }];
  const fin = [{ id: 'f1', type: 'out', title: 'Mercado', amount: 50, date: '2026-11-07', status: 'paid' }, { id: 'f2', type: 'in', title: 'Salário', amount: 2000, date: '2026-11-05', status: 'paid' }];
  const settings = { profile: { name: 'Fulano', photo: null }, layout: 'advanced', budget: { salary: 2000 } };
  const raw = { '@org2/tasks': JSON.stringify(tasks), '@org2/finance': JSON.stringify(fin), '@org2/settings': JSON.stringify(settings), '@org2/accounts': '[]', '@org2/study': 'isso não é json' };
  const b = BK.buildBackup(raw, { appVersion: '1.11', now: new Date('2026-11-08T22:00:00Z') });
  ok('backup leva tudo que é válido e marca o app', [b.app, b.format, Object.keys(b.data).sort()], ['no-prumo', 1, ['@org2/accounts', '@org2/finance', '@org2/settings', '@org2/tasks']]);
  ok('valor corrompido fica de fora sem estragar o arquivo', '@org2/study' in b.data, false);
  ok('contagem para mostrar antes de restaurar', b.counts, { tasks: 1, study: 0, finance: 2, accounts: 0, subjects: 0 });
  ok('nome do arquivo com data e hora', /^no-prumo-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(BK.backupFileName(new Date(2026, 10, 8, 19, 5))), true);
  const text = JSON.stringify(b);
  const p = BK.parseBackup(text);
  ok('lê o próprio backup', [p.ok, p.backup.counts.finance], [true, 2]);
  ok('arquivo qualquer não é aceito', BK.parseBackup('{"a":1}').ok, false);
  ok('texto que não é json não é aceito', BK.parseBackup('extrato;valor').ok, false);
  ok('backup de versão mais nova avisa para atualizar', /mais nova/.test(BK.parseBackup(JSON.stringify({ ...b, format: 9 })).error), true);
  ok('lista danificada é recusada', BK.parseBackup(JSON.stringify({ ...b, data: { ...b.data, '@org2/finance': { x: 1 } } })).ok, false);
  ok('aceita arquivo com BOM no começo', BK.parseBackup('﻿' + text).ok, true);
  const plan = BK.restorePlan(p.backup);
  ok('restaurar apaga o que o backup não tem (menos os ajustes)', [plan.set.map((x) => x[0]).sort(), plan.remove.sort()], [['@org2/accounts', '@org2/finance', '@org2/settings', '@org2/tasks'], ['@org2/handled', '@org2/misheard', '@org2/recurrences', '@org2/study', '@org2/subjects']]);
  // estado atual diferente; restaura; desfaz
  AS._m.clear();
  await AS.setItem('@org2/tasks', JSON.stringify([{ id: 'x', title: 'Outra coisa' }]));
  await AS.setItem('@org2/study', JSON.stringify([{ id: 's', title: 'Prova' }]));
  await AS.setItem('@org2/settings', JSON.stringify({ profile: { name: 'Atual' }, layout: 'simple' }));
  await BK.restoreBackup(p.backup);
  ok('depois de restaurar, as tarefas são as do backup', JSON.parse(await AS.getItem('@org2/tasks')), tasks);
  ok('o que o backup não tinha some', await AS.getItem('@org2/study'), null);
  const sAfter = JSON.parse(await AS.getItem('@org2/settings'));
  ok('ajustes do backup voltam, com a data da restauração', [sAfter.profile.name, sAfter.layout, !!sAfter.backup.restoredAt], ['Fulano', 'advanced', true]);
  ok('guarda uma cópia do que havia antes', await BK.hasBeforeRestore(), true);
  ok('voltar ao que eu tinha', await BK.undoRestore(), true);
  ok('depois de voltar, tudo é como antes', [JSON.parse(await AS.getItem('@org2/tasks'))[0].title, JSON.parse(await AS.getItem('@org2/study'))[0].title, JSON.parse(await AS.getItem('@org2/settings')).layout], ['Outra coisa', 'Prova', 'simple']);
  ok('a cópia é usada uma vez só', await BK.hasBeforeRestore(), false);
  ok('idade do backup em dias', [BK.backupAge(null), BK.backupAge('2026-11-01T12:00:00Z', new Date('2026-11-08T12:00:00Z'))], [null, 7]);
  const dr = readFileSync(join(root, 'src/Drawer.js'), 'utf8');
  ok('Ajustes tem a seção Backup com salvar, restaurar e voltar', /<BackupSection/.test(dr) && /Salvar backup/.test(dr) && /Voltar ao que eu tinha/.test(dr), true);
  ok('restaurar pede confirmação mostrando o que tem no backup', /Restaurar este backup\?/.test(dr), true);
  rmSync(dir, { recursive: true, force: true });
}

// ---- 1.12: matérias, voz, ocupação, feriados e correções
{
  const dir12 = mkdtempSync(join(tmpdir(), 'prumo-112-'));
  writeFileSync(join(dir12, 'utils.mjs'), readFileSync(join(root, 'src/utils.js'), 'utf8'));
  writeFileSync(join(dir12, 'recurrence.mjs'), readFileSync(join(root, 'src/recurrence.js'), 'utf8').replace("from './utils'", "from './utils.mjs'"));
  writeFileSync(join(dir12, 'parser.mjs'), readFileSync(join(root, 'src/parser.js'), 'utf8').replace("from './utils'", "from './utils.mjs'").replace("from './recurrence'", "from './recurrence.mjs'"));
  writeFileSync(join(dir12, 'subjects.mjs'), readFileSync(join(root, 'src/subjects.js'), 'utf8').replace("from './parser'", "from './parser.mjs'").replace("from './utils'", "from './utils.mjs'"));
  writeFileSync(join(dir12, 'holidays.mjs'), readFileSync(join(root, 'src/holidays.js'), 'utf8').replace("from './utils'", "from './utils.mjs'"));
  writeFileSync(join(dir12, 'theme.mjs'), readFileSync(join(root, 'src/theme.js'), 'utf8'));
  const url = (f) => pathToFileURL(join(dir12, f)).href;
  const SB = await import(url('subjects.mjs'));
  const HD = await import(url('holidays.mjs'));
  const TH = await import(url('theme.mjs'));
  const P12 = await import(url('parser.mjs'));
  const ok = (name, got, exp) => {
    total++;
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      fails++;
      console.log(`FALHOU  1.12: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`);
    } else console.log(`ok      1.12: ${name}`);
  };
  const calc2 = { id: 'c2', name: 'Cálculo 2', aliases: ['calc 2', 'calculo dois'], color: 1, schedules: [{ days: [1, 3], start: '10:00', end: '12:00' }], room: 'B-204' };
  const calc1 = { id: 'c1', name: 'Cálculo I', aliases: ['calc 1'], color: 2 };
  const circ = { id: 'ci', name: 'Circuitos Elétricos', aliases: ['circuitos'], color: 3 };
  const fis = { id: 'f3', name: 'Física 3', aliases: ['fis3'], color: 4 };
  const velha = { id: 'old', name: 'Química', aliases: [], color: 5, archived: true };
  const all = [calc2, calc1, circ, fis, velha];
  const found = (t, l = all) => {
    const h = SB.findSubject(t, l);
    return h ? h.subject.id : null;
  };
  ok('apelido: "prova de calc 2 sexta"', found('prova de calc 2 sexta'), 'c2');
  ok('nome com acento', found('prova de Cálculo 2 dia 20'), 'c2');
  ok('número falado por extenso', found('prova de calculo dois amanhã'), 'c2');
  ok('colado: "calc2"', found('lista de calc2'), 'c2');
  ok('apelido colado: "fis3" e "fis 3"', [found('prova de fis3'), found('prova de fis 3')], ['f3', 'f3']);
  ok('algarismo romano no nome: "cálculo 1" acha "Cálculo I"', found('prova de calculo 1'), 'c1');
  ok('"cálculo um" acha "Cálculo I"', found('prova de calculo um'), 'c1');
  ok('romano na frase: "cálculo II"', found('prova de cálculo II'), 'c2');
  ok('"cálculo" sozinho com duas matérias não escolhe', found('prova de cálculo'), null);
  ok('palavra do nome vale quando só uma matéria tem', found('estudar física amanhã'), 'f3');
  ok('"física 2" não é Física 3', found('prova de física 2'), null);
  ok('matéria arquivada não conta', found('prova de química'), null);
  ok('apelido não casa dentro de outra palavra', found('circuitosss amanhã'), null);
  ok('sem matéria cadastrada', found('prova de calc 2', []), null);

  const today12 = '2026-11-08';
  const now12 = new Date(2026, 10, 8, 15, 4);
  const voice = (t, profile, list = all) => SB.enrichParsed(P12.parseInput(t, today12, now12, { short: true }), list, profile);
  const est = { occupation: 'estagio' };
  const pick = (r) => r.map((i) => [i.kind, i.subjectId || null, !!i.askPlace]);
  ok('"prova de calc 2 sexta" cai na matéria', pick(voice('prova de calc 2 sexta', est)), [['study', 'c2', false]]);
  ok('cita a matéria sem palavra de estudo: vai para Estudos', pick(voice('calc 2 sexta às 10', est)), [['study', 'c2', false]]);
  ok('"comprar livro de calc 2" continua tarefa', pick(voice('comprar livro de calc 2', est)), [['task', null, false]]);
  ok('gasto citando a matéria continua em Finanças', pick(voice('paguei livro de calc 2 80 reais', est)).map((x) => x[0]), ['finance']);
  ok('"relatório" sem matéria pergunta', pick(voice('entregar relatório sexta', est)), [['study', null, true]]);
  ok('"laboratório" sem matéria pergunta', pick(voice('relatório do laboratório dia 20', est)), [['study', null, true]]);
  ok('com matéria não pergunta', pick(voice('relatório de circuitos sexta', est)), [['study', 'ci', false]]);
  ok('"da faculdade" não pergunta', pick(voice('relatório da faculdade sexta', est)), [['study', null, false]]);
  ok('"relatório do estágio" já vai para Tarefas', pick(voice('relatório do estágio sexta', est)), [['task', null, false]]);
  ok('só estudo não pergunta', pick(voice('entregar relatório sexta', { occupation: 'so_estudo' })), [['study', null, false]]);
  ok('prova comum não pergunta', pick(voice('prova de redes dia 20', est)), [['study', null, false]]);
  ok('"do trabalho" vai para Tarefas de quem trabalha', pick(voice('relatório do trabalho sexta', { occupation: 'trabalho' })), [['task', null, false]]);
  ok('nome próprio em "Outros"', pick(voice('relatório da monitoria sexta', { occupation: 'outros', occupationName: 'Monitoria' })), [['task', null, false]]);
  ok('nome da pergunta', [SB.occupationName(est), SB.occupationName({ occupation: 'trabalho' }), SB.occupationName({ occupation: 'outros', occupationName: 'Monitoria' }), SB.occupationName({ occupation: 'so_estudo' }), SB.occupationName({})], ['estágio', 'trabalho', 'monitoria', null, 'trabalho']);
  ok('texto da pergunta', SB.placeQuestion('estágio'), 'Faculdade ou estágio?');

  const itens = [
    { id: '1', title: 'Prova de calc 2' },
    { id: '2', title: 'Estudar cálculo 2', note: 'estudar cálculo 2 amanhã' },
    { id: '3', title: 'Prova de redes' },
    { id: '4', title: 'Calc 2 lista', subjectId: 'x' },
    { id: '5', title: 'Calc 2 velha', done: true },
  ];
  ok('itens antigos que citam a matéria', SB.itemsToLink(itens, calc2).map((t) => t.id), ['1', '2']);

  const form = (p) => ({ name: 'Redes', aliasesText: '', color: 2, room: '', schedules: [], ...p });
  ok('falta nome', !!SB.readSubjectForm(form({ name: '  ' }), all).error, true);
  ok('apelidos viram lista, sem repetir', SB.readSubjectForm(form({ aliasesText: 'redes 1, rc ; rc' }), all).data.aliases, ['redes 1', 'rc']);
  ok('apelido de outra matéria é recusado', /já é usado/.test(SB.readSubjectForm(form({ aliasesText: 'calc 2' }), all).error), true);
  ok('a própria matéria pode manter o apelido', !!SB.readSubjectForm(form({ name: 'Cálculo 2', aliasesText: 'calc 2' }), all, 'c2').data, true);
  ok('apelido de matéria arquivada pode ser reusado', !!SB.readSubjectForm(form({ name: 'Química' }), all).data, true);
  ok('horário válido', SB.readSubjectForm(form({ schedules: [{ days: [5], startText: '14:00', endText: '16:00' }] }), all).data.schedules, [{ days: [5], start: '14:00', end: '16:00' }]);
  ok('horário sem dia', !!SB.readSubjectForm(form({ schedules: [{ days: [], startText: '14:00', endText: '16:00' }] }), all).error, true);
  ok('fim antes do início', !!SB.readSubjectForm(form({ schedules: [{ days: [1], startText: '14:00', endText: '13:00' }] }), all).error, true);
  ok('linha de horário vazia é ignorada', SB.readSubjectForm(form({ schedules: [{ days: [], startText: '', endText: '' }] }), all).data.schedules, []);
  ok('ida e volta do formulário', SB.readSubjectForm(SB.toSubjectForm(calc2), [calc2], 'c2').data, { name: 'Cálculo 2', aliases: ['calc 2', 'calculo dois'], color: 1, room: 'B-204', schedules: [{ days: [1, 3], start: '10:00', end: '12:00' }] });

  // 09/11/2026 é segunda
  ok('próxima aula hoje', SB.nextClassLabel(calc2, new Date(2026, 10, 9, 8, 0)), 'Hoje, 10:00');
  ok('aula em andamento ainda é hoje', SB.nextClassLabel(calc2, new Date(2026, 10, 9, 11, 0)), 'Hoje, 10:00');
  ok('depois da aula vai para a próxima', SB.nextClassLabel(calc2, new Date(2026, 10, 9, 13, 0)), 'Qua, 10:00');
  ok('amanhã', SB.nextClassLabel(calc2, new Date(2026, 10, 8, 20, 0)), 'Amanhã, 10:00');
  ok('sem horário', SB.nextClassLabel(circ), null);
  ok('rótulo do horário começa na segunda', SB.scheduleLabel({ days: [0, 3, 1], start: '10:00', end: '12:00' }), 'Seg, Qua, Dom · 10:00–12:00');

  ok('semestre válido', SB.readSemester('03/08/2026', '12/12/2026').data, { start: '2026-08-03', end: '2026-12-12' });
  ok('semestre invertido', !!SB.readSemester('12/12/2026', '03/08/2026').error, true);
  ok('semestre terminou', [SB.semesterEnded({ end: '2026-12-12' }, '2026-12-12'), SB.semesterEnded({ end: '2026-12-12' }, '2026-12-13'), SB.semesterEnded({ end: null }, '2026-12-13')], [false, true, false]);

  // Páscoa conferida com o calendário oficial
  ok('Páscoa', [2024, 2025, 2026, 2027, 2028].map(HD.easter), ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16']);
  const y26 = (uf) => HD.holidaysOfYear(2026, uf);
  const on = (uf, d) => y26(uf).filter((h) => h.date === d).map((h) => [h.name, h.type]);
  ok('Sexta-feira Santa 2026', on(null, '2026-04-03'), [['Sexta-feira Santa', 'nacional']]);
  ok('Carnaval é ponto facultativo', [on(null, '2026-02-16'), on(null, '2026-02-17')], [[['Carnaval', 'facultativo']], [['Carnaval', 'facultativo']]]);
  ok('Corpus Christi 2026', on(null, '2026-06-04'), [['Corpus Christi', 'facultativo']]);
  ok('nacionais de 2026 (10 feriados)', y26(null).filter((h) => h.type === 'nacional').length, 10);
  ok('20/11 só é nacional desde 2024', [HD.holidaysOfYear(2023).some((h) => h.date === '2023-11-20'), HD.holidaysOfYear(2024).some((h) => h.date === '2024-11-20')], [false, true]);
  ok('Paraná: 19/12 não é feriado', on('PR', '2026-12-19'), [['Emancipação do Paraná', 'comemorativa']]);
  ok('sem estado, nada de estadual', on(null, '2026-07-09'), []);
  ok('São Paulo: 9 de julho', on('SP', '2026-07-09'), [['Revolução Constitucionalista', 'estadual']]);
  ok('Espírito Santo: 8 dias depois da Páscoa', on('ES', '2026-04-13'), [['Nossa Senhora da Penha', 'estadual']]);
  ok('Santa Catarina: domingo depois de 11/08', on('SC', '2026-08-16'), [['Dia de Santa Catarina', 'estadual']]);
  ok('Santa Catarina: 11/08 num domingo fica no dia', HD.holidaysOfYear(2024, 'SC').some((h) => h.date === '2024-08-11'), true);
  ok('Goiás e Mato Grosso sem estadual', [y26('GO').some((h) => h.type === 'estadual'), y26('MT').some((h) => h.type === 'estadual')], [false, false]);
  ok('os 27 estados têm tabela', HD.STATES.length, 27);
  const rio = HD.holidaysOfMonth('2026-02', 'RJ')['2026-02-17'];
  ok('RJ: terça de Carnaval é feriado estadual, sem repetir', rio.map((h) => h.type), ['estadual']);
  ok('segunda de Carnaval no RJ continua facultativo', HD.holidaysOfMonth('2026-02', 'RJ')['2026-02-16'].map((h) => h.type), ['facultativo']);
  ok('Minas: 21/4 mostra os dois nomes', HD.holidaysOfMonth('2026-04', 'MG')['2026-04-21'].map((h) => h.name), ['Tiradentes', 'Data Magna de Minas Gerais']);

  // contraste das 8 cores (mínimo 4,5:1)
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const bad = [];
  TH.applyTheme('advanced', 'light');
  const lightOnAccent = TH.colors.onAccent;
  const lightBgs = ['#F7F6F2', '#FFFFFF', '#FAFAF8'];
  TH.SUBJECT_PALETTES.light.forEach((c) => {
    [...lightBgs, c.tint, lightOnAccent].forEach((bg) => {
      if (ratio(c.main, bg) < 4.5) bad.push(`claro ${c.name} em ${bg}: ${ratio(c.main, bg).toFixed(2)}`);
    });
  });
  TH.applyTheme('advanced', 'dark');
  const darkOnAccent = TH.colors.onAccent;
  TH.SUBJECT_PALETTES.dark.forEach((c) => {
    ['#0E1117', '#171B24', '#121417', c.tint, darkOnAccent].forEach((bg) => {
      if (ratio(c.main, bg) < 4.5) bad.push(`escuro ${c.name} em ${bg}: ${ratio(c.main, bg).toFixed(2)}`);
    });
  });
  ok('as 8 cores têm contraste nos dois temas', bad, []);
  ok('são 8 cores', TH.SUBJECT_COUNT, 8);

  const rem12 = readFileSync(join(root, 'src/reminders.js'), 'utf8');
  ok('vibração: o aviso com o app aberto não sai mudo', /shouldPlaySound: true/.test(rem12) && !/shouldPlaySound: alertStyle/.test(rem12), true);
  ok('"Só vibração" continua sem som no canal', /CHANNELS\.vibrar[\s\S]{0,120}sound: null/.test(rem12), true);
  const st12 = readFileSync(join(root, 'src/store.js'), 'utf8');
  ok('microfone já ouvindo por padrão e para quem já tinha o app', /autoListen: true/.test(st12) && /autoListenSet: true/.test(st12), true);
  const bk12 = readFileSync(join(root, 'src/backup.js'), 'utf8');
  ok('backup leva as matérias', /'@org2\/subjects'/.test(bk12), true);
  const sc12 = readFileSync(join(root, 'src/screens/StudyScreen.js'), 'utf8');
  ok('Estudos tem as abas Itens e Matérias', /key: 'itens'/.test(sc12) && /key: 'materias'/.test(sc12), true);
  ok('Agenda mostra feriados', /holidaysOfMonth/.test(readFileSync(join(root, 'src/screens/CalendarScreen.js'), 'utf8')), true);
  rmSync(dir12, { recursive: true, force: true });
}


// ---------- 1.12.1: voz que entende ----------
{
  const d = mkdtempSync(join(tmpdir(), 'prumo-1121-'));
  writeFileSync(join(d, 'utils.mjs'), readFileSync(join(root, 'src/utils.js'), 'utf8'));
  writeFileSync(join(d, 'recurrence.mjs'), readFileSync(join(root, 'src/recurrence.js'), 'utf8').replace("from './utils'", "from './utils.mjs'"));
  writeFileSync(join(d, 'parser.mjs'), readFileSync(join(root, 'src/parser.js'), 'utf8').replace("from './utils'", "from './utils.mjs'").replace("from './recurrence'", "from './recurrence.mjs'"));
  writeFileSync(join(d, 'voice.mjs'), readFileSync(join(root, 'src/voice.js'), 'utf8').replace("from './parser'", "from './parser.mjs'"));
  const P = await import(pathToFileURL(join(d, 'parser.mjs')).href);
  const V = await import(pathToFileURL(join(d, 'voice.mjs')).href);
  rmSync(d, { recursive: true, force: true });
  const ok = (name, got, exp) => {
    total++;
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      fails++;
      console.log(`FALHOU  1.12.1: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`);
    } else console.log(`ok      1.12.1: ${name}`);
  };
  const DAY = '2026-11-09'; // segunda
  const NOON = new Date(2026, 10, 9, 12, 22);
  const short = (t, now = NOON) =>
    P.parseInput(t, DAY, now).map((i) => [i.kind, i.title, i.date, i.time, i.amount ?? null, !!i.askDay]);

  // Banco de frases reais do Kaiky (nomes trocados), como o Android entrega: sem pontuação.
  // Placar: quantas saem certas sem editar nada.
  const BANK = [
    ['quando eu chegar em casa hoje eu preciso lavar o carro umas 10 horas da noite fazer o pix do Bruno de r$ 60 estudar para prova de química',
      [['task', 'Lavar o carro', DAY, '22:00', null, false], ['finance', 'Pix do Bruno', DAY, null, 60, false], ['study', 'Estudar para prova de química', null, null, null, false]]],
    ['comer salada 3 horas da tarde', [['task', 'Comer salada', DAY, '15:00', null, false]]],
    ['comer salada às 3 da tarde', [['task', 'Comer salada', DAY, '15:00', null, false]]],
    ['hoje às 22h lavar a louça arrumar o quarto', [['task', 'Lavar a louça', DAY, '22:00', null, false], ['task', 'Arrumar o quarto', DAY, '22:00', null, false]]],
    ['uber 25 lavar o carro amanhã', [['finance', 'Uber', DAY, null, 25, false], ['task', 'Lavar o carro', '2026-11-10', null, null, false]]],
    ['ligar para o dentista marcar consulta sexta', [['task', 'Ligar para o dentista', null, null, null, false], ['task', 'Marcar consulta', '2026-11-13', null, null, false]]],
    ['ir ao mercado comprar pão', [['task', 'Ir ao mercado comprar pão', null, null, null, false]]],
    ['tomar remédio às 8 da noite', [['task', 'Tomar remédio', DAY, '20:00', null, false]]],
  ];
  let right = 0;
  BANK.forEach(([t, exp]) => {
    const got = short(t);
    if (JSON.stringify(got) === JSON.stringify(exp)) right++;
    ok(`frase: ${t}`, got, exp);
  });
  console.log(`        placar das frases reais: ${right}/${BANK.length} certas sem editar`);

  ok('"fazer o pix" é a pagar', P.parseInput('fazer o pix do Bruno de 60', DAY, NOON)[0].status, 'pending');
  ok('horário já passado: pergunta hoje ou amanhã', short('comer salada às 11 da manhã'), [['task', 'Comer salada', DAY, '11:00', null, true]]);
  ok('horário que ainda vai chegar: hoje, sem perguntar', short('comer salada 3 horas da tarde')[0][5], false);
  ok('a hora dita no meio não vale para a próxima ação', short('lavar o carro às 10 da noite estudar para a prova')[1].slice(2, 4), [null, null]);
  ok('sem pontuação, "para estudar" fica junto', short('comprar material para estudar').length, 1);
  ok('"de pagar" fica junto', short('não esquecer de pagar a luz 180').length, 1);
  ok('splitSegments não deixa marca interna', P.splitSegments('lavar o carro às 10 fazer o pix de 60').every((x) => !x.includes(P.HARD)), true);

  // dicionário pessoal
  const pairs = V.diffWords('fazer o pique do Bruno de 60 isso dá para prova', 'fazer o pix do Bruno de 60 estudar para prova');
  ok('acha as trocas', pairs, [{ from: 'pique', to: 'pix' }, { from: 'isso da', to: 'estudar' }]);
  let L = V.learn({}, pairs);
  ok('1ª troca vira sugestão', V.applyLearned('pique da Ana de 20', L).suggestions, [{ from: 'pique', to: 'pix' }]);
  ok('1ª troca não muda o texto sozinha', V.applyLearned('pique da Ana de 20', L).text, 'pique da Ana de 20');
  L = V.learn(L, [{ from: 'pique', to: 'pix' }]);
  ok('2ª troca entra sozinha', V.applyLearned('fazer o Pique da Ana de 20', L).text, 'fazer o pix da Ana de 20');
  ok('troca é por palavra inteira', V.applyLearned('piquenique amanhã', L).text, 'piquenique amanhã');
  ok('troca de duas palavras', V.applyLearned('isso dá para a prova', V.learn(L, [{ from: 'isso da', to: 'estudar' }])).text, 'estudar para a prova');
  ok('trocar uma vez (sugestão aceita)', V.replaceOnce('pique do Bruno', 'pique', 'pix'), 'pix do Bruno');
  ok('troca de número não vira regra solta', V.diffWords('pagar 60', 'pagar 60').length, 0);

  // escolher a melhor versão ouvida
  const alts = [
    'fazer o pique do Bruno de 60 isso dá para prova de química',
    'fazer o pix do Bruno de 60 estudar para prova de química',
  ];
  ok('escolhe a versão que o app entende melhor', V.pickBest(alts, DAY, NOON, V.buildVocab()).index, 1);
  ok('mantém a 1ª quando as duas são parecidas', V.pickBest(['comprar pão amanhã', 'comprar pão amanhã!'], DAY, NOON, []).index, 0);
  ok('outras versões: sem repetir a escolhida', V.otherVersions(['a b', 'A b.', 'c d'], 'a b'), ['c d']);
  const vocab = V.buildVocab({ subjects: [{ name: 'Circuitos Elétricos', aliases: ['circuitos'] }, { name: 'Velha', archived: true }], accounts: [{ name: 'Itaú' }], learned: { pique: { to: 'pix', n: 2 } }, titles: ['Lavar o carro', 'Lavar a louça'] });
  ok('vocabulário tem matérias, contas e palavras da pessoa', ['Circuitos Elétricos', 'circuitos', 'Itaú', 'Lavar'].every((w) => vocab.includes(w)) && !vocab.includes('Velha'), true);
  ok('vocabulário até 100', vocab.length <= 100, true);

  // código
  const sp = readFileSync(join(root, 'src/speech.js'), 'utf8');
  ok('pede pontuação, vocabulário e 5 versões', /addsPunctuation/.test(sp) && /contextualStrings/.test(sp) && /maxAlternatives:\s*5/.test(sp), true);
  ok('volta ao modo simples se o aparelho recusar', /LEVELS/.test(sp), true);
  const cm = readFileSync(join(root, 'src/CaptureModal.js'), 'utf8');
  ok('"Guardar para correção" avisa na própria tela (o Toast fica atrás do Modal)', !/showToast\('Frase guardada/.test(cm) && /Frase guardada/.test(cm), true);
  ok('o que foi ouvido pode ser corrigido', /Entender de novo/.test(cm), true);
  const ut = readFileSync(join(root, 'src/utils.js'), 'utf8');
  ok('ocultar saldo troca o valor', /R\$ ••••/.test(ut), true);
  const stx = readFileSync(join(root, 'src/store.js'), 'utf8');
  ok('ocultar saldo fica lembrado', /hideBalance/.test(stx), true);
}


// ---------- 1.12.2: ajustes mais limpos ----------
{
  const ok = (name, got, exp) => {
    total++;
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      fails++;
      console.log(`FALHOU  1.12.2: ${name}: esperava ${JSON.stringify(exp)}, veio ${JSON.stringify(got)}`);
    } else console.log(`ok      1.12.2: ${name}`);
  };
  const dr = readFileSync(join(root, 'src/Drawer.js'), 'utf8');
  ok('ocupação e estado ficam em "Ajustar perfil"', /Ajustar perfil/.test(dr) && /aboutOpen \? \(/.test(dr), true);
  ok('enviar frases só no modo de teste', /settings\.testMode \? \(/.test(dr) && !/Enviar para correção/.test(dr), true);
  ok('5 toques na versão ligam o modo de teste', /taps\.current\.n >= 5/.test(dr), true);
  const cm = readFileSync(join(root, 'src/CaptureModal.js'), 'utf8');
  ok('tocar no texto ouvido corrige', /Toque no texto para corrigir/.test(cm), true);
  ok('"Guardar para correção" só no modo de teste', /!settings\.testMode \? null/.test(cm), true);
  ok('modo de teste guarda sozinho o que foi corrigido', /settings\.testMode && \(corrected/.test(cm), true);
  const es = readFileSync(join(root, 'src/EditSheet.js'), 'utf8');
  ok('corrigir o nome de um item falado ensina o app', /learnVoice\(diffWords\(item\.title/.test(es), true);
}

console.log(`\n${total - fails}/${total} passaram`);
process.exitCode = fails ? 1 : 0;
