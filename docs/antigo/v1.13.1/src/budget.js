// Orçamento do mês: renda, gastos necessários x não necessários, meta de guardar,
// quanto ainda dá para gastar, projeção do fim do mês e avisos de gasto.
import { showMoney as formatMoney, daysInMonth } from './utils';
import { REFUND, isCardBill } from './financeFixes';

// Gastos necessários por padrão (dá para trocar em cada lançamento)
const ESSENTIAL_CATEGORIES = new Set(['Contas', 'Saúde', 'Estudos', 'Alimentação', 'Transporte']);
// Dentro de categorias necessárias, alguns títulos não são
const NOT_ESSENTIAL_TITLES = /\b(restaurante|ifood|lanche|pizza|hamburguer|uber|99|bar|delivery)\b/i;

export function essentialDefault(category, title = '') {
  if (!ESSENTIAL_CATEGORIES.has(category)) return false;
  return !NOT_ESSENTIAL_TITLES.test(title);
}

export const isEssential = (item) =>
  item.essential === undefined || item.essential === null ? essentialDefault(item.category, item.title) : !!item.essential;

// Proporção do limite a partir da qual o app avisa, conforme a importância de Finanças
export const ALERT_AT = { alta: 0.7, media: 0.9, baixa: 1 };

const sum = (list) => list.reduce((acc, t) => acc + (t.amount || 0), 0);

// Entradas que são renda do trabalho; o resto é extra
export const WORK_CATEGORIES = new Set(['Salário', 'Bônus']);
export const isWorkIncome = (t) => t.type === 'in' && WORK_CATEGORIES.has(t.category);
// 1.13: Pix devolvido (os dois lados) não é renda nem gasto; rendimento é investimento, não extra
export const isRefund = (t) => t.category === REFUND;
export const isExtraIncome = (t) => t.type === 'in' && !isWorkIncome(t) && !isRefund(t) && t.category !== 'Investimentos';

// ym = 'AAAA-MM'. budget = { salary, target } (valores em reais ou null)
// cash (opcional, 1.9.3): dinheiro de verdade que dá para usar no mês (contas + a receber − a pagar).
// "Ainda pode gastar" nunca passa dele: o limite pode dizer 553, mas se você só tem 526, são 526.
// 1.10: dinheiro que veio de outra conta sua entra no limite? Resposta do mês, senão a regra dos Ajustes.
// null = ainda não respondeu (fica fora do limite e o app pergunta).
export function ownDecision(budget = {}, ym) {
  const m = budget.ownMonths || {};
  if (Object.prototype.hasOwnProperty.call(m, ym)) return !!m[ym];
  if (budget.useOwn === 'always') return true;
  if (budget.useOwn === 'never') return false;
  return null;
}

// 1.10: quem já tem salário no app (importado antes da 1.10) também recebe o "é o seu salário?":
// o salário pago mais novo dos últimos 2 meses, enquanto o tipo de renda não foi escolhido e você
// não respondeu "Agora não".
export function salaryToAsk(budget = {}, finance = [], today) {
  if (budget.incomeType || budget.salaryAsk || budget.salaryAskSeen) return null;
  const from = `${Number(today.slice(0, 4)) - (today.slice(5, 7) <= '02' ? 1 : 0)}-${String(((Number(today.slice(5, 7)) + 9) % 12) + 1).padStart(2, '0')}-01`;
  const last = finance
    .filter((t) => t.type === 'in' && t.category === 'Salário' && t.status !== 'pending' && t.date && t.date >= from && t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return last ? { amount: last.amount, date: last.date, source: 'já no app' } : null;
}

// qual pergunta mostrar agora (ou null); 1.10: o salário primeiro, depois o dinheiro de outras contas
export function pendingPrompt(budget = {}, { ym, isCurrentMonth, ownAmount, advanced, later }) {
  if (budget.salaryAsk && !budget.incomeType) return 'salary';
  const decided = budget.ownMonths && Object.prototype.hasOwnProperty.call(budget.ownMonths, ym);
  // centavos de rendimento automático não valem a pergunta
  if (advanced && isCurrentMonth && ownAmount >= 10 && (budget.useOwn || 'ask') === 'ask' && !decided && !later) return 'own';
  return null;
}

// own (1.10): quanto veio de outras contas suas no mês (fromOtherAccounts). Só entra no limite se você disse
// "usar no mês"; nunca vira renda nem salário.
export function monthBudget(finance, budget = {}, ym, now = new Date(), cash = null, own = 0) {
  const items = finance.filter((t) => t.date && t.date.startsWith(ym) && !isRefund(t));
  const incomes = items.filter((t) => t.type === 'in');
  // transferências entre suas contas não são renda nem gasto
  const outs = items.filter((t) => t.type === 'out');
  const salary = Number(budget.salary) || 0;
  const target = Number(budget.target) || 0;

  // renda do mês = salário (e bônus). Se o salário já foi lançado, usa o lançamento; senão, o salário base.
  // Extras (Pix de alguém, reembolso, rendimento) aparecem à parte e só entram no limite se você quiser:
  // assim um Pix que um amigo te devolveu não "aumenta" quanto você pode gastar.
  const work = incomes.filter(isWorkIncome);
  const extras = incomes.filter(isExtraIncome);
  const hasSalaryEntry = work.some((t) => t.category === 'Salário');
  const salaryIncome = hasSalaryEntry ? sum(work) : salary + sum(work);
  const extraIncome = sum(extras);
  const ownAmount = Math.round((Number(own) || 0) * 100) / 100;
  const ownChoice = ownAmount > 0 ? ownDecision(budget, ym) : null;
  const ownIncome = ownChoice ? ownAmount : 0;
  const income = salaryIncome + (budget.countExtras ? extraIncome : 0) + ownIncome;

  const essentialList = outs.filter(isEssential);
  const extraList = outs.filter((t) => !isEssential(t));
  const essential = sum(essentialList);
  const nonEssential = sum(extraList);
  // 1.13: a fatura paga junta gasto necessário e não necessário; aparece à parte (a conta não muda)
  const cardBill = sum(extraList.filter(isCardBill));

  const allowance = income - essential - target; // o que sobra para os não necessários
  const byLimit = allowance - nonEssential;
  const cashValue = cash === null || cash === undefined || !Number.isFinite(Number(cash)) ? null : Math.round(Number(cash) * 100) / 100;
  // só corta quando o limite está positivo e maior que o dinheiro; passar do limite continua sendo "passou do limite"
  const capped = cashValue !== null && byLimit > 0 && byLimit > Math.max(0, cashValue);
  const remaining = capped ? Math.max(0, cashValue) : byLimit;
  // quanto do limite do mês (renda − meta de guardar) já foi gasto: é o mesmo número da barra
  const limit = income - target;
  const spent = essential + nonEssential;
  const used = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;

  // projeção do fim do mês. Gastos fixos do mês (fatura do cartão, parcelas, contas que
  // se repetem) entram uma vez só; os variáveis (lazer, compras, restaurante) seguem o
  // ritmo do que já foi gasto até hoje.
  const [y, m] = ym.split('-').map(Number);
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
  const total = daysInMonth(ym);
  const day = isCurrent ? now.getDate() : total;
  const todayIso = `${ym}-${String(day).padStart(2, '0')}`;
  const isFixed = (t) => !!t.recId || t.category === 'Parcelas' || /^cart[aã]o\b/i.test(t.title || '');
  const fixedExtra = sum(extraList.filter(isFixed));
  const variableList = extraList.filter((t) => !isFixed(t));
  const variableAll = sum(variableList);
  const variableSoFar = sum(variableList.filter((t) => t.status !== 'pending' && t.date <= todayIso));
  // nos primeiros 10 dias o ritmo engana (aluguel, contas e extrato importado caem todos no
  // começo do mês): só projeta pelo ritmo a partir do dia 10
  const early = isCurrent && day < 10;
  const projectedExtra = fixedExtra + (early ? variableAll : Math.max(variableAll, (variableSoFar / day) * total));
  const projectedSaving = income - essential - projectedExtra;

  // sem salário no mês e sem salário base, não dá para dizer se está gastando demais
  // (um mês importado pela metade mostrava "324% do limite" com renda de R$ 90)
  const noSalary = !hasSalaryEntry && !salary && !ownIncome;

  let status = 'ok';
  if (income <= 0 || noSalary) status = 'noincome';
  else if (remaining < 0) status = 'over';
  else if (!early && projectedSaving < target) status = 'risk';

  // passou do limite, mas o dinheiro da outra conta (fora do limite) cobre a diferença
  const covered = remaining < 0 && ownAmount > 0 && !ownIncome ? Math.round(Math.min(-remaining, ownAmount) * 100) / 100 : 0;
  return { income, salaryIncome, extraIncome, ownAmount, ownIncome, ownChoice, covered, countExtras: !!budget.countExtras, essential, nonEssential, cardBill, target, allowance, remaining, byLimit, capped, cash: cashValue, used, projectedExtra, projectedSaving, status, early, noSalary, configured: salary > 0 || income > 0 };
}

// Aviso depois de lançar gastos (ou null). level = importância de Finanças
export function spendingAlert(b, level = 'media') {
  if (!b || b.status === 'noincome') return null;
  if (b.status === 'over') {
    return `Atenção: você passou ${formatMoney(-b.remaining)} do limite deste mês${b.target ? ` para guardar ${formatMoney(b.target)}` : ''}.`;
  }
  const at = ALERT_AT[level] || ALERT_AT.media;
  if (b.used >= at && b.used < Infinity) {
    return `Você já usou ${Math.round(b.used * 100)}% do limite do mês. Ainda pode gastar ${formatMoney(b.remaining)}.`;
  }
  return null;
}

// Mensagem para a entrada no app (ou null). Na importância baixa, só quando passou do limite.
export function budgetEntryMessage(b, level = 'media') {
  if (!b || b.status === 'noincome') return null;
  if (b.status === 'over') return `seus gastos passaram ${formatMoney(-b.remaining)} do limite do mês.`;
  if (level === 'baixa') return null;
  if (b.status === 'risk' && b.target > 0) {
    const saving = Math.max(0, b.projectedSaving);
    return `no ritmo atual você vai guardar ${formatMoney(saving)}, abaixo da meta de ${formatMoney(b.target)}.`;
  }
  const at = ALERT_AT[level] || ALERT_AT.media;
  if (b.used >= at && b.used < Infinity) return `você já usou ${Math.round(b.used * 100)}% do limite do mês.`;
  return null;
}
