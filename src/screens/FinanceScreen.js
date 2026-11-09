import React, { useEffect, useState } from 'react';
import { View, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, look } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { pad, MONTHS, todayISO, shortBR, showMoney as formatMoney, daysInMonth, diffDays, privacy } from '../utils';
import { pickAndReadDocument, batchFromImport } from '../importDocument';
import { Screen, Row, Empty, Pill, Hero, heroText, Card, ListBox, Section, Segmented, Notice, IconButton, Icon, s } from '../ui';
import { monthBudget, ALERT_AT, salaryToAsk } from '../budget';
import BudgetEditor from '../components/BudgetEditor';
import { AccountsCard, AccountEditor } from '../components/Accounts';
import InsightsModal from '../components/Insights';
import FinancePrompts from '../components/FinancePrompts';
import { accountLabel, accountsSummary, ownTransferChanges, titleForType, isCountable } from '../accounts';
import { receipts, monthForecast, balanceBridge, budgetFor } from '../insights';

const sum = (list) => list.reduce((acc, t) => acc + t.amount, 0);
const SIMPLE = look.mode === 'simple';

// Uma linha de lançamento: "+ R$" entrada, "− R$" saída, "⇄ R$" transferência (não depende de cor)
export function MoneyRow({ t, accounts, onPress, right, last, metaOverride }) {
  const { palettes, tone } = useData();
  const pal = palettes.finance;
  const meta =
    metaOverride ||
    `${
      t.type === 'transfer'
        ? `${accountLabel(t.from, accounts)} → ${accountLabel(t.to, accounts)}`
        : `${t.category}${accounts.length && t.account ? ` · ${accountLabel(t.account, accounts)}` : ''}`
    } · ${shortBR(t.date)}`;
  return (
    <Row onPress={onPress} style={[st.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle} numberOfLines={1}>
          {t.recId ? <Text style={{ color: pal.main }}>↻ </Text> : null}
          {t.title}
        </Text>
        <Text style={st.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {right || (
        <Text style={[st.amount, t.type === 'in' && { color: tone.income }, t.type === 'transfer' && { color: colors.mute }]}>
          {t.type === 'transfer' ? '⇄' : t.type === 'in' ? '+' : '−'} {formatMoney(t.amount)}
        </Text>
      )}
    </Row>
  );
}

function MonthSwitch({ ym, onShift }) {
  return (
    <View style={st.monthRow}>
      <Pressable onPress={() => onShift(-1)} hitSlop={10} style={st.arrowBtn} accessibilityLabel="Mês anterior">
        <Text style={st.arrow}>‹</Text>
      </Pressable>
      <Text style={st.month}>
        {MONTHS[ym.m]} {ym.y}
      </Text>
      <Pressable onPress={() => onShift(1)} hitSlop={10} style={st.arrowBtn} accessibilityLabel="Próximo mês">
        <Text style={st.arrow}>›</Text>
      </Pressable>
    </View>
  );
}

// active: a aba está na tela (todas ficam montadas; as perguntas só aparecem com Finanças aberto)
export default function FinanceScreen({ active = true }) {
  const { finance, togglePaid, palettes, tone, settings, simple, accounts, patchFinance, setBudget, setHideBalance } = useData();
  // 1.12.1: olho que esconde os valores (fica lembrado ao fechar o app)
  const eye = (
    <IconButton
      name={settings.hideBalance ? 'eyeOff' : 'eye'}
      label={settings.hideBalance ? 'Mostrar valores' : 'Ocultar valores'}
      color={simple ? colors.mute : palettes.finance.main}
      onPress={() => setHideBalance(!settings.hideBalance)}
    />
  );
  const { openEditor, openBatch, showToast, openMonth } = useUI();
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState('resumo');
  const [insights, setInsights] = useState(false);
  const [askBalance, setAskBalance] = useState(null); // conta para digitar o saldo de hoje
  const pal = palettes.finance;
  const today = todayISO();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [editingBudget, setEditingBudget] = useState(false);

  const key = `${ym.y}-${pad(ym.m + 1)}`;
  const isCurrentMonth = key === today.slice(0, 7);
  const items = finance.filter((t) => t.date.startsWith(key));
  const paid = items.filter((t) => t.status !== 'pending').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const pending = items.filter((t) => t.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));

  const inPaid = sum(paid.filter((t) => t.type === 'in'));
  const outPaid = sum(paid.filter((t) => t.type === 'out'));
  const inPend = sum(pending.filter((t) => t.type === 'in'));
  const outPend = sum(pending.filter((t) => t.type === 'out'));
  const result = inPaid - outPaid;
  const fc = monthForecast(finance, accounts, settings.budget, key, today);
  const acc = accountsSummary(accounts, finance);
  const moneyAccounts = acc.rows.filter((a) => a.kind !== 'cartao');
  const rc = receipts(finance, accounts, key);

  const byCat = {};
  items
    .filter((t) => t.type === 'out')
    .forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const outAll = outPaid + outPend;
  const barColors = [pal.main, pal.second, pal.third];
  // 1.9.3: "Ainda pode gastar" nunca passa do dinheiro que você tem (contas + a receber − a pagar)
  // 1.10: salário que já estava no app antes da 1.10 também ganha o "é o seu salário?"
  useEffect(() => {
    if (!active) return;
    const ask = salaryToAsk(settings.budget, finance, today);
    if (ask) setBudget({ salaryAsk: ask });
  }, [active, finance.length, settings.budget.incomeType, settings.budget.salaryAskSeen]);
  // 1.10: e o dinheiro de outras contas suas, se você disse "usar no mês"
  const bud = budgetFor(finance, accounts, settings.budget, key, today, now);
  const cash = bud.cashInfo;
  // ponte do mês: começou + entrou + veio de outras contas − saiu = hoje
  const bridge = balanceBridge(finance, accounts, key, today);
  const countIds = new Set(accounts.filter(isCountable).map((a) => a.id));
  const loose = paid.filter((t) => t.type !== 'transfer' && !countIds.has(t.account));
  const looseIn = sum(loose.filter((t) => t.type === 'in'));
  const looseOut = sum(loose.filter((t) => t.type === 'out'));
  const hasBudget = !!settings.budget.salary || bud.income > 0;

  // últimos 6 meses de saídas (pagas e a pagar), para o gráfico
  const months = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(ym.y, ym.m - k, 1);
    const mk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const total = finance.filter((t) => t.type === 'out' && t.date.startsWith(mk)).reduce((a, t) => a + t.amount, 0);
    months.push({ key: mk, label: MONTHS[d.getMonth()].slice(0, 3).toLowerCase(), total });
  }
  const maxMonth = Math.max(1, ...months.map((x) => x.total));
  const avgPrev = months.slice(0, 5).filter((x) => x.total > 0);
  const avg = avgPrev.length ? avgPrev.reduce((a, x) => a + x.total, 0) / avgPrev.length : 0;

  // orçamento: quanto do limite do mês (salário − meta) já foi usado
  const limit = Math.max(0, bud.income - bud.target);
  const spent = bud.essential + bud.nonEssential;
  const usedPct = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
  const pace = isCurrentMonth ? now.getDate() / daysInMonth(key) : 1;
  const barColor = usedPct >= (ALERT_AT[settings.levels.finance] || ALERT_AT.media) ? tone.warn : pal.main;

  // a conta mais próxima de vencer vira o aviso amarelo
  const soon = pending.find((t) => t.type === 'out' && diffDays(today, t.date) <= 3);
  const restPending = pending.filter((t) => t !== soon);
  const soonLabel = (t) => {
    const d = diffDays(today, t.date);
    if (d < 0) return `venceu ${shortBR(t.date)}`;
    if (d === 0) return 'vence hoje';
    if (d === 1) return 'vence amanhã';
    return `vence ${shortBR(t.date)}`;
  };

  const importFile = async () => {
    setImporting(true);
    const r = await pickAndReadDocument(finance);
    setImporting(false);
    if (r.canceled) return;
    if (r.error) {
      Alert.alert('Não deu para importar', r.error);
      return;
    }
    openBatch(batchFromImport(r));
  };

  const shift = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  // Recebimentos: trocar o tipo de um recebimento com um toque
  const markOwn = (t) =>
    Alert.alert('Veio de outra conta sua?', `${t.title} · ${formatMoney(t.amount)} passa a ser transferência entre suas contas e sai de Extras.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim, é meu',
        onPress: () => {
          patchFinance({ [t.id]: ownTransferChanges(t) });
          showToast('Agora é transferência entre suas contas');
        },
      },
    ]);
  // 1.10: dinheiro de outra conta sua entra (ou sai) do limite deste mês, com Desfazer
  const toggleOwn = () => {
    const before = { ...(settings.budget.ownMonths || {}) };
    const next = !bud.ownIncome;
    setBudget({ ownMonths: { ...before, [key]: next } });
    showToast(next ? `${formatMoney(bud.ownAmount)} agora contam no limite do mês` : `${formatMoney(bud.ownAmount)} saíram do limite (reserva)`, 'Desfazer', () => setBudget({ ownMonths: before }));
  };
  const markSalary = (t) => {
    patchFinance({ [t.id]: { category: 'Salário' } });
    showToast(`${t.title} agora conta como salário`, 'Desfazer', () => patchFinance({ [t.id]: { category: t.category } }));
  };
  const markExtra = (t) =>
    Alert.alert('Veio de outra pessoa?', `${t.title} · ${formatMoney(t.amount)} passa a ser um extra (dinheiro novo).`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim, é extra',
        onPress: () => {
          patchFinance({ [t.id]: { type: 'in', category: 'Extra', essential: null, account: t.to || null, from: null, to: null, title: titleForType(t.title, 'in') } });
          showToast('Agora conta como extra');
        },
      },
    ]);

  const pendingList = (list) =>
    list.length ? (
      <View>
        <Section>A pagar e a receber</Section>
        <ListBox>
          {list.map((t, i) => {
            const late = t.date < today;
            return (
              <MoneyRow
                key={t.id}
                t={t}
                accounts={accounts}
                last={i === list.length - 1}
                onPress={() => openEditor('finance', t)}
                metaOverride={`${t.type === 'in' ? 'recebe' : late ? 'venceu' : 'vence'} ${shortBR(t.date)} · ${formatMoney(t.amount)}`}
                right={<Pill label={t.type === 'in' ? 'Recebi' : 'Paguei'} color={pal.main} onPress={() => togglePaid(t.id)} />}
              />
            );
          })}
        </ListBox>
      </View>
    ) : null;

  const soonNotice = soon ? (
    <View>
      {SIMPLE ? <Section>Vence logo</Section> : null}
      <Notice
        title={SIMPLE ? soon.title : `${soon.title} ${soonLabel(soon)}`}
        sub={SIMPLE ? `${soonLabel(soon)} · ${formatMoney(soon.amount)}` : formatMoney(soon.amount)}
        action="Paguei"
        onAction={() => togglePaid(soon.id)}
      />
    </View>
  ) : null;

  // bloco de destaque: dinheiro nas contas (ou a sobra do mês, sem contas cadastradas)
  const ht = heroText('finance');
  const showAccounts = acc.hasKnown && isCurrentMonth;
  // há contas, mas nenhuma com saldo: pede o saldo em vez de mostrar um número inventado
  const needBalance = !acc.hasKnown && moneyAccounts.length > 0 && isCurrentMonth;
  const hero = (
    <View>
    <Pressable
      onPress={() => openMonth(key)}
      accessibilityRole="button"
      accessibilityHint="Abre tudo o que aconteceu no mês"
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
    <Hero area="finance" style={{ marginTop: SIMPLE ? 0 : 2 }}>
      <Text style={[st.heroLabel, { color: ht.label }]}>{showAccounts || needBalance ? 'Dinheiro nas contas' : `Sobra de ${MONTHS[ym.m].toLowerCase()}`}</Text>
      {needBalance ? (
        <View>
          <Text style={[st.heroAsk, { color: ht.ink }]}>Informe o saldo de hoje</Text>
          <Text style={[st.forecast, { color: ht.soft, marginTop: 4 }]}>Sem o saldo, o app não sabe quanto você tem nas contas.</Text>
          <Pressable onPress={() => setAskBalance(moneyAccounts[0])} hitSlop={8} style={[st.askBtn, { borderColor: ht.ink }]} accessibilityRole="button">
            <Text style={[st.askText, { color: ht.ink }]}>Informar saldo</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[st.heroValue, { color: ht.ink }]} accessibilityLabel={formatMoney(showAccounts ? acc.money : result)}>
          {formatMoney(showAccounts ? acc.money : result)}
        </Text>
      )}
      {showAccounts && acc.unknown ? (
        <Text style={[st.heroNote, { color: ht.soft }]}>
          {acc.unknown === 1 ? '1 conta sem saldo informado não entra neste total.' : `${acc.unknown} contas sem saldo informado não entram neste total.`}
        </Text>
      ) : null}
      {SIMPLE ? (
        <Text style={st.heroLine}>
          {inPend || outPend ? `+ ${formatMoney(inPend)} a receber · − ${formatMoney(outPend)} a pagar` : `Entrou ${formatMoney(inPaid)} · saiu ${formatMoney(outPaid)}`}
        </Text>
      ) : (
        <View style={st.tiles}>
          <View style={[st.tile, { backgroundColor: ht.tile }]}>
            <Text style={[st.tileLabel, { color: ht.soft }]}>A receber</Text>
            <Text style={[st.tileValue, { color: ht.ink }]}>+ {formatMoney(inPend + (fc.salaryPending || 0))}</Text>
          </View>
          <View style={[st.tile, { backgroundColor: ht.tile }]}>
            <Text style={[st.tileLabel, { color: ht.soft }]}>A pagar</Text>
            <Text style={[st.tileValue, { color: ht.ink }]}>− {formatMoney(outPend)}</Text>
          </View>
        </View>
      )}
      {isCurrentMonth && (pending.length || fc.salaryPending) ? (
        <Text style={[st.forecast, { color: ht.soft }]}>
          Previsto no fim do mês{fc.salaryPending ? ' (com o salário)' : ''}: <Text style={{ fontWeight: '700', color: ht.ink }}>{formatMoney(fc.value)}</Text>
        </Text>
      ) : null}
      {showAccounts && acc.cardDebt > 0 ? (
        <Text style={[st.forecast, { color: ht.soft }]}>Fatura em aberto nos cartões: {formatMoney(acc.cardDebt)}</Text>
      ) : null}
      <Text style={[st.seeAll, { color: ht.label }]}>Ver tudo do mês ›</Text>
    </Hero>
    </Pressable>
    <AccountEditor target={askBalance} onClose={() => setAskBalance(null)} />
    </View>
  );

  const lancamentos = (onlyInOut) => {
    const list = onlyInOut ? paid.filter((t) => t.type !== 'transfer') : paid;
    return (
      <View>
        <Section>{onlyInOut ? 'Entradas e saídas' : 'Lançamentos'}</Section>
        {list.length === 0 ? (
          <Empty
            text={
              items.length
                ? 'Nada pago ou recebido ainda neste mês.'
                : settings.used.finance
                ? 'Nada neste mês.'
                : 'Nada neste mês.\nDiga, por exemplo: "gastei 86 no mercado, recebi 1.200 do estágio".'
            }
          />
        ) : (
          <ListBox>
            {list.map((t, i) => (
              <MoneyRow key={t.id} t={t} accounts={accounts} last={i === list.length - 1} onPress={() => openEditor('finance', t)} />
            ))}
          </ListBox>
        )}
        {items.length > 0 && !settings.editHintSeen ? <Text style={st.hint}>Toque em um lançamento para editar ou excluir.</Text> : null}
      </View>
    );
  };

  // ---------- visual simples: só entradas e saídas ----------
  if (simple) {
    return (
      <Screen
        title="Finanças"
        actions={
          <>
            {eye}
            {importing ? <ActivityIndicator color={colors.mute} style={{ width: 44 }} /> : <IconButton name="import" label="Importar extrato, fatura ou holerite" color={colors.mute} onPress={importFile} />}
          </>
        }
      >
        <MonthSwitch ym={ym} onShift={shift} />
        {hero}
        <View style={st.simpleSums}>
          <View style={st.simpleSumRow}>
            <Text style={st.simpleSumLabel}>Entrou</Text>
            <Text style={st.simpleSumValue}>+ {formatMoney(inPaid)}</Text>
          </View>
          <View style={[st.simpleSumRow, { borderBottomWidth: 0 }]}>
            <Text style={st.simpleSumLabel}>Saiu</Text>
            <Text style={st.simpleSumValue}>− {formatMoney(outPaid)}</Text>
          </View>
        </View>
        {soonNotice}
        {pendingList(restPending)}
        {lancamentos(true)}
        <AccountsCard />
        {active ? <FinancePrompts ym={key} isCurrentMonth={isCurrentMonth} ownAmount={bud.ownAmount} advanced={false} /> : null}
      </Screen>
    );
  }

  // ---------- visual avançado ----------
  const budgetCard = (
    <Card>
      <View style={st.budgetHead}>
        <Text style={st.cardTitle}>{hasBudget && !bud.noSalary ? (bud.remaining >= 0 ? 'Ainda pode gastar' : 'Passou do limite') : 'Orçamento'}</Text>
        {hasBudget && !bud.noSalary ? (
          <Text style={[st.cardValue, bud.remaining < 0 && { color: tone.warn }]}>{formatMoney(Math.abs(bud.remaining))}</Text>
        ) : (
          <Pill label="Definir" color={pal.main} onPress={() => setEditingBudget(true)} />
        )}
      </View>
      {!hasBudget ? (
        <Text style={st.help}>Defina seu salário e quanto quer guardar por mês para ver se está gastando demais.</Text>
      ) : bud.noSalary ? (
        <Text style={st.help}>
          Este mês não tem salário lançado, então não dá para calcular o limite. Gastos do mês: {formatMoney(spent)}. Informe o salário base para o app usar nos meses
          sem salário.
        </Text>
      ) : (
        <View>
          <View style={st.trackWrap}>
            <View style={[st.track, { backgroundColor: pal.tint }]} accessibilityLabel={`Usou ${Math.round(usedPct * 100)}% do limite do mês`}>
              {bud.essential > 0 ? <View style={{ width: `${Math.min(100, (bud.essential / Math.max(limit, spent, 1)) * 100)}%`, backgroundColor: barColor }} /> : null}
              {bud.nonEssential > 0 ? (
                <View style={{ width: `${Math.min(100, (bud.nonEssential / Math.max(limit, spent, 1)) * 100)}%`, backgroundColor: barColor, opacity: 0.5 }} />
              ) : null}
            </View>
            {isCurrentMonth && limit > 0 && spent <= limit ? <View style={[st.paceTick, { left: `${Math.min(99, pace * 100)}%` }]} /> : null}
          </View>
          {bud.capped ? (
            <Text style={[st.small, { color: tone.warn, marginTop: 0, marginBottom: 6 }]}>
              Pelo limite seriam {formatMoney(bud.byLimit)}, mas você tem {formatMoney(bud.cash)}
              {cash && (cash.outPend || cash.debt) ? ' depois do que há a pagar' : ' nas contas'}. Por isso o valor é {formatMoney(bud.remaining)}.
            </Text>
          ) : null}
          <Text style={st.used}>
            Você usou {limit > 0 ? `${Math.min(999, Math.round(usedPct * 100))}%` : '—'} do limite do mês ({formatMoney(spent)} de {formatMoney(limit)})
          </Text>
          {isCurrentMonth && limit > 0 ? <Text style={st.small}>│ onde o gasto deveria estar hoje ({Math.round(pace * 100)}% do mês)</Text> : null}
          <Text style={st.legend}>
            <Text style={{ color: barColor, fontWeight: '800' }}>■ </Text>Necessários {formatMoney(bud.essential)}
          </Text>
          <Text style={st.legend}>
            <Text style={{ color: barColor, opacity: 0.5, fontWeight: '800' }}>■ </Text>Não necessários {formatMoney(bud.nonEssential)}
          </Text>
          <Text style={st.legend}>
            Salário {formatMoney(bud.salaryIncome)}
            {bud.target ? ` · guardar ${formatMoney(bud.target)}` : ''}
            {bud.extraIncome ? ` · extras ${formatMoney(bud.extraIncome)}${bud.countExtras ? ' (no limite)' : ' (fora do limite)'}` : ''}
            {bud.ownAmount >= 1 ? ` · de outras contas ${formatMoney(bud.ownAmount)}${bud.ownIncome ? ' (no limite)' : ' (fora do limite)'}` : ''}
          </Text>
          {bud.ownAmount >= 1 && isCurrentMonth ? (
            <Pressable onPress={toggleOwn} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 4 }} accessibilityRole="button">
              <Text style={[st.link, { color: pal.main }]}>
                {bud.ownIncome ? 'Tirar o dinheiro da outra conta do limite' : 'Usar o dinheiro da outra conta neste mês'}
              </Text>
            </Pressable>
          ) : null}
          {bud.covered ? (
            <Text style={[st.small, { color: colors.ink }]}>
              Você passou {formatMoney(-bud.remaining)} do limite, mas os {formatMoney(bud.ownAmount)} que vieram da sua outra conta cobrem{' '}
              {bud.covered >= -bud.remaining - 0.005 ? 'essa diferença' : `${formatMoney(bud.covered)} dela`}.
            </Text>
          ) : null}
          {isCurrentMonth ? (
            bud.early ? (
              <Text style={st.small}>A projeção do fim do mês aparece a partir do dia 10.</Text>
            ) : (
              <Text style={[st.small, bud.status === 'risk' && { color: tone.warn }]}>
                {bud.projectedSaving >= 0 ? `No ritmo atual, sobram ${formatMoney(bud.projectedSaving)} no fim do mês` : `No ritmo atual, faltam ${formatMoney(-bud.projectedSaving)} no fim do mês`}
                {bud.target ? (bud.projectedSaving >= bud.target ? ' (meta ok)' : ' (abaixo da meta)') : ''}
              </Text>
            )
          ) : null}
          <Pressable onPress={() => setEditingBudget(true)} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <Text style={[st.link, { color: pal.main }]}>Ajustar orçamento</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );

  const signed = (v) => `${v < 0 ? '− ' : '+ '}${formatMoney(Math.abs(v))}`;
  const bRow = (label, value, note, strong) => (
    <View style={st.bRow} key={label}>
      <View style={{ flex: 1 }}>
        <Text style={[st.bLabel, strong && { color: colors.ink, fontWeight: '700' }]}>{label}</Text>
        {note ? <Text style={st.bNote}>{note}</Text> : null}
      </View>
      <Text style={[st.bValue, strong && st.bStrong, value < 0 && strong && { color: tone.warn }]}>{strong ? formatMoney(value) : signed(value)}</Text>
    </View>
  );
  const change = bridge ? Math.round((bridge.end - bridge.start) * 100) / 100 : 0;
  const moved = bridge ? Math.round((bridge.extIn - bridge.extOut) * 100) / 100 : 0;
  const resultCard = bridge ? (
    <Card>
      <Text style={st.cardTitle}>Seu mês</Text>
      <View style={{ marginTop: 8 }}>
        {bRow('Começou o mês', bridge.start, null, true)}
        {bRow('Entrou', bridge.incomes, `salário ${formatMoney(rc.totals.salary)} · extras ${formatMoney(rc.totals.extra)}`)}
        {bridge.extIn ? bRow('Veio de outras contas suas', bridge.extIn, 'entra no saldo, mas não é renda') : null}
        {bridge.extOut ? bRow('Foi para outras contas suas', -bridge.extOut, 'sai do saldo, mas não é gasto') : null}
        {bRow('Saiu', -bridge.outs, outPend ? `+ ${formatMoney(outPend)} ainda a pagar` : null)}
        {bridge.cardPay ? bRow('Faturas pagas', -bridge.cardPay, 'as compras já contaram no cartão') : null}
        <View style={st.bLine} />
        {bRow(isCurrentMonth ? 'Hoje nas contas' : 'Fim do mês', bridge.end, null, true)}
      </View>
      <View style={st.tiles2}>
        <View style={[st.tile2, { backgroundColor: pal.tint }]}>
          <Text style={st.sumLabel}>Sobra do mês</Text>
          <Text style={[st.tile2Value, result < 0 && { color: tone.warn }]}>{signed(result)}</Text>
          <Text style={st.bNote}>o que ganhou − o que gastou</Text>
        </View>
        <View style={[st.tile2, { backgroundColor: pal.tint }]}>
          <Text style={st.sumLabel}>Mudança no saldo</Text>
          <Text style={[st.tile2Value, change < 0 && { color: tone.warn }]}>{signed(change)}</Text>
          <Text style={st.bNote}>{isCurrentMonth ? 'hoje' : 'fim do mês'} − começo do mês</Text>
        </View>
      </View>
      {moved ? (
        <Text style={st.small}>
          A diferença entre os dois é o dinheiro que {moved > 0 ? 'veio de' : 'foi para'} outras contas suas ({formatMoney(Math.abs(moved))}).
        </Text>
      ) : null}
      {looseIn || looseOut ? (
        <Text style={st.small}>
          Sem conta (contam na sobra, não no saldo): {looseIn ? `+ ${formatMoney(looseIn)}` : ''}
          {looseIn && looseOut ? ' · ' : ''}
          {looseOut ? `− ${formatMoney(looseOut)}` : ''}
        </Text>
      ) : null}
    </Card>
  ) : (
    <Card>
      <Text style={st.cardTitle}>Sobra do mês</Text>
      <Text style={[st.resultValue, result < 0 && { color: tone.warn }]}>{signed(result)}</Text>
      <View style={st.sums}>
        <View style={{ flex: 1 }}>
          <Text style={st.sumLabel}>Entradas</Text>
          <Text style={[st.sum, { color: tone.income }]}>+ {formatMoney(inPaid)}</Text>
          <Text style={st.small}>
            salário {formatMoney(rc.totals.salary)} · extras {formatMoney(rc.totals.extra)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.sumLabel}>Saídas</Text>
          <Text style={st.sum}>− {formatMoney(outPaid)}</Text>
          {outPend ? <Text style={st.small}>+ {formatMoney(outPend)} a pagar</Text> : null}
        </View>
      </View>
      <Text style={st.small}>O que você ganhou menos o que gastou. Informe o saldo de uma conta para ver também quanto o saldo mudou.</Text>
      {rc.totals.own ? <Text style={st.small}>Transferências entre suas contas não entram aqui ({formatMoney(rc.totals.own)} neste mês).</Text> : null}
    </Card>
  );

  const chart = months.some((x) => x.total > 0) ? (
    <Card>
      <Text style={st.cardTitle}>Gastos nos últimos 6 meses</Text>
      <View style={st.chart}>
        {months.map((x, k) => {
          const cur = k === months.length - 1;
          const h = Math.max(3, (x.total / maxMonth) * 96);
          return (
            <View key={x.key} style={st.col}>
              <Text style={[st.colValue, cur && { color: colors.ink, fontWeight: '700' }]} numberOfLines={1}>
                {x.total && !privacy.hidden ? (x.total >= 1000 ? `${(x.total / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(x.total)) : ''}
              </Text>
              <View style={[st.colBar, { height: h, backgroundColor: cur ? pal.main : pal.third }]} />
              <Text style={[st.colLabel, cur && { color: colors.ink, fontWeight: '700' }]}>{x.label}</Text>
            </View>
          );
        })}
      </View>
      {avgPrev.length >= 2 ? (
        <Text style={st.small}>
          Média dos {avgPrev.length} meses anteriores com gastos: {formatMoney(avg)}.{' '}
          {months[5].total > avg ? `Este mês está ${formatMoney(months[5].total - avg)} acima.` : 'Este mês está abaixo da média.'}
        </Text>
      ) : null}
    </Card>
  ) : null;

  const where =
    cats.length > 0 ? (
      <Card>
        <Text style={[st.cardTitle, { marginBottom: 10 }]}>Para onde vai</Text>
        {cats.map(([name, total], i) => (
          <View key={name} style={{ marginBottom: 10 }}>
            <View style={st.catRow}>
              <Text style={st.catName}>{name}</Text>
              <Text style={st.catValue}>{formatMoney(total)}</Text>
            </View>
            <View style={[st.barBg, { backgroundColor: pal.tint }]}>
              <View style={[st.barFill, { width: `${Math.max(3, (total / outAll) * 100)}%`, backgroundColor: barColors[i % 3] }]} />
            </View>
          </View>
        ))}
      </Card>
    ) : null;

  const importCard = (
    <Pressable
      onPress={importFile}
      disabled={importing}
      style={({ pressed }) => [st.importBtn, { borderColor: pal.main }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Importar extrato, fatura ou holerite em PDF ou CSV"
    >
      {importing ? <ActivityIndicator color={pal.main} /> : <Icon name="import" size={24} color={pal.main} />}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[st.importTitle, { color: pal.main }]}>{importing ? 'Lendo o arquivo…' : 'Importar extrato'}</Text>
        <Text style={st.small}>PDF ou CSV do banco, fatura do cartão ou holerite. Você revisa antes de salvar.</Text>
      </View>
    </Pressable>
  );

  const ownTotal = rc.totals.own;
  const recMeta = (t) => (t.status === 'pending' ? `a receber ${shortBR(t.date)}${t.account ? ` · ${accountLabel(t.account, accounts)}` : ''}` : undefined);
  const pendNote = rc.pending.salary + rc.pending.extra;
  const recebimentos = (
    <View>
      <Hero area="finance">
        <Text style={[st.heroLabel, { color: ht.label }]}>Dinheiro novo em {MONTHS[ym.m].toLowerCase()}</Text>
        <Text style={[st.heroValue, { color: ht.ink }]}>{formatMoney(rc.newMoney)}</Text>
        <View style={st.tiles}>
          <View style={[st.tile, { backgroundColor: ht.tile }]}>
            <Text style={[st.tileLabel, { color: ht.soft }]}>Salário</Text>
            <Text style={[st.tileValue, { color: ht.ink }]}>+ {formatMoney(rc.totals.salary)}</Text>
          </View>
          <View style={[st.tile, { backgroundColor: ht.tile }]}>
            <Text style={[st.tileLabel, { color: ht.soft }]}>Extras</Text>
            <Text style={[st.tileValue, { color: ht.ink }]}>+ {formatMoney(rc.totals.extra)}</Text>
          </View>
        </View>
        <Text style={[st.forecast, { color: ht.soft }]}>
          De outras contas suas: ⇄ {formatMoney(ownTotal)} (entra no saldo, não é renda{isCurrentMonth && bud.ownAmount ? (bud.ownIncome ? '; está no limite do mês' : '; fora do limite') : ''})
        </Text>
        {pendNote ? <Text style={[st.forecast, { color: ht.soft, marginTop: 4 }]}>Ainda a receber: + {formatMoney(pendNote)}</Text> : null}
      </Hero>
      <Text style={[st.help, { marginTop: 12 }]}>
        Pix de outra conta sua entra no saldo, mas não é renda: fica separado para não inflar o salário nem o limite do mês. Use “É salário”, “É meu” ou “É extra” para corrigir.
      </Text>

      <Section>Salário</Section>
      {rc.salary.length ? (
        <ListBox>
          {rc.salary.map((t, i) => (
            <MoneyRow key={t.id} t={t} accounts={accounts} metaOverride={recMeta(t)} last={i === rc.salary.length - 1} onPress={() => openEditor('finance', t)} />
          ))}
        </ListBox>
      ) : (
        <Empty text={settings.budget.salary ? `Salário ainda não lançado neste mês (base ${formatMoney(Number(settings.budget.salary))}).` : 'Nenhum salário neste mês.'} />
      )}

      <Section>Extras · Pix de outras pessoas, reembolsos</Section>
      {rc.extra.length ? (
        <ListBox>
          {rc.extra.map((t, i) => (
            <MoneyRow
              key={t.id}
              t={t}
              accounts={accounts}
              last={i === rc.extra.length - 1}
              metaOverride={recMeta(t)}
              onPress={() => openEditor('finance', t)}
              right={
                <View style={st.rowRight}>
                  <Text style={[st.amount, { color: tone.income }]}>+ {formatMoney(t.amount)}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <Pressable onPress={() => markSalary(t)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t.title}: é salário`}>
                      <Text style={[st.swap, { color: pal.main, marginRight: 14 }]}>É salário</Text>
                    </Pressable>
                    <Pressable onPress={() => markOwn(t)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t.title}: veio de outra conta sua`}>
                      <Text style={[st.swap, { color: pal.main }]}>É meu</Text>
                    </Pressable>
                  </View>
                </View>
              }
            />
          ))}
        </ListBox>
      ) : (
        <Empty text="Nenhum extra neste mês." />
      )}

      <Section>De outras contas suas · entra no saldo, não é renda</Section>
      {rc.own.length ? (
        <ListBox>
          {rc.own.map((t, i) => (
            <MoneyRow
              key={t.id}
              t={t}
              accounts={accounts}
              last={i === rc.own.length - 1}
              onPress={() => openEditor('finance', t)}
              right={
                <View style={st.rowRight}>
                  <Text style={[st.amount, { color: colors.mute }]}>⇄ {formatMoney(t.amount)}</Text>
                  {!t.from ? (
                    <Pressable onPress={() => markExtra(t)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t.title}: veio de outra pessoa`}>
                      <Text style={[st.swap, { color: pal.main }]}>É extra</Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          ))}
        </ListBox>
      ) : (
        <Empty text="Nenhuma transferência entre suas contas neste mês." />
      )}
    </View>
  );

  return (
    <Screen
      title="Finanças"
      accent={pal.main}
      actions={
        <>
          {eye}
          <IconButton name="insights" label="Abrir indicadores" color={pal.main} onPress={() => setInsights(true)} />
        </>
      }
    >
      <Segmented
        options={[
          { key: 'resumo', label: 'Resumo' },
          { key: 'recebimentos', label: 'Recebimentos' },
        ]}
        value={tab}
        onChange={setTab}
        color={pal.main}
      />
      <MonthSwitch ym={ym} onShift={shift} />
      {tab === 'recebimentos' ? (
        recebimentos
      ) : (
        <View>
          {hero}
          {budgetCard}
          {soonNotice}
          {pendingList(restPending)}
          {resultCard}
          <AccountsCard />
          {where}
          {chart}
          {importCard}
          {lancamentos(false)}
        </View>
      )}
      <BudgetEditor visible={editingBudget} onClose={() => setEditingBudget(false)} />
      <InsightsModal visible={insights} onClose={() => setInsights(false)} />
      {active ? <FinancePrompts ym={key} isCurrentMonth={isCurrentMonth} ownAmount={bud.ownAmount} advanced /> : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: SIMPLE ? -6 : 0 },
  arrowBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 26, color: colors.ink, marginTop: -3 },
  month: { fontSize: 15, fontWeight: SIMPLE ? '500' : '600', color: colors.ink, marginHorizontal: 6 },
  heroLabel: { fontSize: SIMPLE ? 13 : 15, fontWeight: SIMPLE ? '600' : '400' },
  heroValue: { fontSize: SIMPLE ? 36 : 44, fontWeight: SIMPLE ? '500' : '700', letterSpacing: -1, marginTop: 2 },
  heroNote: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  heroAsk: { fontSize: SIMPLE ? 22 : 26, fontWeight: SIMPLE ? '500' : '700', marginTop: 4 },
  askBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: SIMPLE ? 4 : 999, paddingHorizontal: 16, marginTop: 10 },
  askText: { fontSize: 15, fontWeight: '600' },
  heroLine: { fontSize: 14, color: colors.mute, marginTop: 4 },
  tiles: { flexDirection: 'row', marginTop: 14 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginRight: 10 },
  tileLabel: { fontSize: 13 },
  tileValue: { fontSize: 19, fontWeight: '600', marginTop: 1 },
  forecast: { fontSize: 14, marginTop: 10 },
  seeAll: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  simpleSums: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  simpleSumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line },
  simpleSumLabel: { fontSize: 15, color: colors.ink },
  simpleSumValue: { fontSize: 15, fontWeight: '500', color: colors.ink },
  budgetHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardValue: { fontSize: 22, fontWeight: '700', color: colors.ink },
  help: { fontSize: 14, color: colors.mute, lineHeight: 20 },
  trackWrap: { position: 'relative', paddingVertical: 4, marginTop: 4 },
  track: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden' },
  paceTick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.ink },
  used: { fontSize: 14, color: colors.mute, marginTop: 6 },
  small: { fontSize: 13, color: colors.mute, marginTop: 4, lineHeight: 18 },
  legend: { fontSize: 13, color: colors.ink, marginTop: 6 },
  link: { fontSize: 14, fontWeight: '600' },
  bRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  bLabel: { fontSize: 14, color: colors.mute },
  bNote: { fontSize: 12, color: colors.mute, marginTop: 1, lineHeight: 16 },
  bValue: { fontSize: 15, fontWeight: '600', color: colors.ink, marginLeft: 12 },
  bStrong: { fontSize: 17, fontWeight: '700' },
  bLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 4 },
  tiles2: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 2 },
  tile2: { flex: 1, borderRadius: 12, padding: 10 },
  tile2Value: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 2 },
  resultValue: { fontSize: 28, fontWeight: '700', color: colors.ink, marginTop: 4, letterSpacing: -0.5 },
  sums: { flexDirection: 'row', marginTop: 10, marginBottom: 6 },
  sumLabel: { fontSize: 13, color: colors.mute },
  sum: { fontSize: 19, fontWeight: '600', color: colors.ink, marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 132, marginTop: 10, marginBottom: 6 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  colValue: { fontSize: 10, color: colors.mute, marginBottom: 4 },
  colBar: { width: '58%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  colLabel: { fontSize: 11, color: colors.mute, marginTop: 6 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { fontSize: 15, color: colors.ink },
  catValue: { fontSize: 15, color: colors.mute },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  importBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: look.rCard, padding: 14, marginTop: 12 },
  importTitle: { fontSize: 16, fontWeight: '600' },
  row: { paddingVertical: 12, minHeight: 56, borderBottomColor: SIMPLE ? colors.line : colors.line2, borderBottomWidth: 1 },
  rowTitle: { fontSize: SIMPLE ? 15 : 16, fontWeight: SIMPLE ? '400' : '600', color: colors.ink },
  rowMeta: { fontSize: 13, color: colors.mute, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: 12 },
  amount: { fontSize: SIMPLE ? 15 : 16, fontWeight: SIMPLE ? '400' : '600', color: colors.ink, marginLeft: 12 },
  swap: { fontSize: 13, fontWeight: '600', marginTop: 4, paddingVertical: 2 },
  hint: { fontSize: 12, color: colors.mute, marginTop: 14 },
});
