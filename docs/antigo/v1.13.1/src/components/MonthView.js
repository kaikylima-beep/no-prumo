// O mês inteiro (toque no saldo grande de Finanças): entradas, saídas e transferências por data.
// Toque numa linha para editar (inclusive trocar a conta); × exclui, com Desfazer.
// Fica por cima das telas, mas abaixo da edição e do aviso de Desfazer.
import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, BackHandler, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { colors, look } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { MONTHS, showMoney as formatMoney, shortBR, weekdayName, pad, todayISO } from '../utils';
import { accountLabel, accountDisplayName, accountBridge, likelyRepeated, looksLikeOwnTransfer, ownTransferChanges, isCountable } from '../accounts';
import { Chip, Remove, Icon } from '../ui';
import { MoneyRow } from '../screens/FinanceScreen';

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'in', label: 'Entradas' },
  { key: 'out', label: 'Saídas' },
  { key: 'transfer', label: 'Transferências' },
  { key: 'none', label: 'Sem conta' },
];

// De onde veio o saldo de uma conta neste mês
function SaldoBridge({ name, b, cur }) {
  const line = (label, value, strong) => (
    <View style={st.bLine}>
      <Text style={[st.bLabel, strong && st.bStrong]}>{label}</Text>
      <Text style={[st.bValue, strong && st.bStrong]}>{value}</Text>
    </View>
  );
  const signed = (v) => `${v < 0 ? '−' : '+'} ${formatMoney(Math.abs(v))}`;
  const isNow = cur === todayISO().slice(0, 7);
  const lastLabel = isNow ? 'Saldo hoje' : 'Saldo no fim do mês';
  return (
    <View style={look.mode === 'simple' ? st.bBoxSimple : st.bBox}>
      <Text style={st.bTitle}>De onde veio o saldo · {name}</Text>
      {line('Saldo no início do mês', formatMoney(b.start))}
      {b.incomes ? line('Entrou', `+ ${formatMoney(b.incomes)}`) : null}
      {b.moved ? line('Entre contas', `⇄ ${signed(b.moved)}`) : null}
      {b.outs ? line('Saiu', `− ${formatMoney(b.outs)}`) : null}
      <View style={st.bSep} />
      {line(b.endDate ? `Saldo em ${shortBR(b.endDate)}` : lastLabel, formatMoney(b.end), true)}
      {b.endDate ? <Text style={st.bNote}>{b.fromStatement ? 'Igual ao saldo do extrato.' : 'O saldo que você informou.'}</Text> : null}
      {b.later ? (
        <View style={{ marginTop: 6 }}>
          {line('Depois disso', signed(b.later))}
          {line(lastLabel, formatMoney(b.now), true)}
        </View>
      ) : null}
    </View>
  );
}

export default function MonthView({ ym, onClose }) {
  const insets = useSafeAreaInsets();
  const { finance, accounts, palettes, tone, patchFinance } = useData();
  const { openEditor, removeWithUndo, showToast } = useUI();
  const pal = palettes.finance;
  const [cur, setCur] = useState(ym);
  const [filter, setFilter] = useState('all');

  useEffect(() => setCur(ym), [ym]);
  useEffect(() => {
    if (!ym) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [ym]);
  if (!ym || !cur) return null;

  const y = Number(cur.slice(0, 4));
  const m = Number(cur.slice(5, 7)) - 1;
  const shift = (d) => {
    const dt = new Date(y, m + d, 1);
    setCur(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`);
  };
  const all = finance.filter((t) => t.date && t.date.startsWith(cur));
  const repeated = likelyRepeated(finance);
  const shown = all.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'none') return t.type === 'transfer' ? !t.from && !t.to : !t.account;
    return t.type === filter;
  });
  const paid = all.filter((t) => t.status !== 'pending');
  const sum = (type) => paid.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const pend = all.filter((t) => t.status === 'pending').length;
  const bridges = accounts
    .filter(isCountable)
    .map((a) => ({ a, b: accountBridge(a, finance, cur) }))
    .filter((x) => x.b);
  // entrada ou saída com título de transferência: um toque desfaz a confusão
  const markOwn = (t) => {
    const before = { type: t.type, category: t.category, essential: t.essential, account: t.account, from: t.from || null, to: t.to || null };
    patchFinance({ [t.id]: ownTransferChanges(t) });
    showToast('Agora é transferência entre suas contas', 'Desfazer', () => patchFinance({ [t.id]: before }));
  };

  // por dia, do mais recente para o mais antigo
  const days = {};
  for (const t of shown) (days[t.date] = days[t.date] || []).push(t);
  const dates = Object.keys(days).sort((a, b) => b.localeCompare(a));

  const meta = (t) => {
    const where =
      t.type === 'transfer' ? `${accountLabel(t.from, accounts)} → ${accountLabel(t.to, accounts)}` : `${t.category} · ${t.account ? accountLabel(t.account, accounts) : 'sem conta'}`;
    const p = t.status === 'pending' ? (t.type === 'in' ? ' · a receber' : ' · a pagar') : '';
    return `${where}${p}`;
  };

  return (
    <View style={[st.wrap, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <Pressable onPress={onClose} hitSlop={6} style={st.close} accessibilityRole="button" accessibilityLabel="Fechar o mês">
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.kicker}>Tudo do mês</Text>
          <View style={st.monthRow}>
            <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Mês anterior">
              <Text style={st.arrow}>‹</Text>
            </Pressable>
            <Text style={st.title}>
              {MONTHS[m]} {y}
            </Text>
            <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Próximo mês">
              <Text style={st.arrow}>›</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 40 }]}>
        <View style={st.sums}>
          <View style={st.sum}>
            <Text style={st.sumLabel}>Entrou</Text>
            <Text style={[st.sumValue, { color: tone.income }]}>+ {formatMoney(sum('in'))}</Text>
          </View>
          <View style={st.sum}>
            <Text style={st.sumLabel}>Saiu</Text>
            <Text style={st.sumValue}>− {formatMoney(sum('out'))}</Text>
          </View>
          <View style={st.sum}>
            <Text style={st.sumLabel}>Entre contas</Text>
            <Text style={[st.sumValue, { color: colors.mute }]}>⇄ {formatMoney(sum('transfer'))}</Text>
          </View>
        </View>
        {bridges.map(({ a, b }) => (
          <SaldoBridge key={a.id} name={accountDisplayName(a, accounts)} b={b} cur={cur} />
        ))}
        <Text style={st.help}>
          {all.length} {all.length === 1 ? 'lançamento' : 'lançamentos'}
          {pend ? ` · ${pend} ainda a pagar ou receber` : ''}. Toque num lançamento para corrigir (valor, data, conta) ou no × para excluir.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 4 }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} color={pal.main} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        {dates.length === 0 ? <Text style={[st.help, { marginTop: 18 }]}>Nada aqui neste mês.</Text> : null}
        {dates.map((d) => {
          const list = days[d];
          const net = list.reduce((a, t) => a + (t.type === 'in' ? t.amount : t.type === 'out' ? -t.amount : 0), 0);
          return (
            <View key={d}>
              <View style={st.dayHead}>
                <Text style={st.day}>
                  {shortBR(d)} · {weekdayName(d).toLowerCase()}
                </Text>
                {net ? (
                  <Text style={st.dayNet}>
                    {net > 0 ? '+' : '−'} {formatMoney(Math.abs(net))}
                  </Text>
                ) : null}
              </View>
              <View style={look.mode === 'simple' ? st.listSimple : st.list}>
                {list.map((t, i) => (
                  <MoneyRow
                    key={t.id}
                    t={t}
                    accounts={accounts}
                    last={i === list.length - 1}
                    onPress={() => openEditor('finance', t)}
                    metaOverride={`${meta(t)}${repeated.has(t.id) ? ' · parece repetido' : ''}`}
                    right={
                      <View>
                      <View style={st.right}>
                        <Text
                          style={[st.amount, t.type === 'in' && { color: tone.income }, t.type === 'transfer' && { color: colors.mute }, repeated.has(t.id) && { color: tone.warn }]}
                        >
                          {t.type === 'transfer' ? '⇄' : t.type === 'in' ? '+' : '−'} {formatMoney(t.amount)}
                        </Text>
                        <Remove onPress={() => removeWithUndo('finance', t)} />
                      </View>
                      {looksLikeOwnTransfer(t) ? (
                        <Pressable onPress={() => markOwn(t)} hitSlop={8} style={st.mine} accessibilityRole="button" accessibilityLabel={`${t.title}: é transferência sua`}>
                          <Text style={[st.mineText, { color: pal.main }]}>É meu?</Text>
                        </Pressable>
                      ) : null}
                      </View>
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const SIMPLE = look.mode === 'simple';
const st = StyleSheet.create({
  // tela inteira, por cima da barra e do microfone. Não usar StyleSheet.absoluteFillObject:
  // ele não existe no React Native 0.88 e o painel virava um bloco comum depois da barra.
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg, zIndex: 20, elevation: 20 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  close: { width: 44, height: 44, borderRadius: SIMPLE ? 4 : 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 14, color: colors.mute },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  arrow: { fontSize: 26, color: colors.ink, paddingHorizontal: 6, marginTop: -3 },
  title: { fontSize: SIMPLE ? 20 : 24, fontWeight: SIMPLE ? '500' : '700', color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  sums: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10 },
  sum: { flex: 1 },
  sumLabel: { fontSize: 13, color: colors.mute },
  sumValue: { fontSize: 16, fontWeight: SIMPLE ? '500' : '600', color: colors.ink, marginTop: 2 },
  help: { fontSize: 13, color: colors.mute, marginTop: 8, lineHeight: 18 },
  bBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: look.rCard, padding: 16, marginTop: 12 },
  bBoxSimple: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingTop: 14, paddingBottom: 12 },
  bTitle: { fontSize: 14, fontWeight: SIMPLE ? '500' : '600', color: colors.ink, marginBottom: 8 },
  bLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 3 },
  bLabel: { fontSize: 14, color: colors.mute, flex: 1 },
  bValue: { fontSize: 14, color: colors.ink, marginLeft: 10 },
  bStrong: { fontSize: 15, fontWeight: SIMPLE ? '500' : '700', color: colors.ink },
  bSep: { height: 1, backgroundColor: colors.line, marginVertical: 5 },
  bNote: { fontSize: 13, color: colors.mute, marginTop: 1 },
  mine: { alignSelf: 'flex-end', marginRight: 8, marginTop: 2, paddingVertical: 2 },
  mineText: { fontSize: 13, fontWeight: '600' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, marginBottom: 6 },
  day: { fontSize: 13, fontWeight: SIMPLE ? '500' : '600', color: colors.faint, textTransform: SIMPLE ? 'none' : 'uppercase', letterSpacing: SIMPLE ? 0 : 0.6 },
  dayNet: { fontSize: 13, color: colors.mute },
  list: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: look.rCard, paddingHorizontal: 16 },
  listSimple: { borderTopWidth: 1, borderTopColor: colors.line },
  right: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  amount: { fontSize: SIMPLE ? 15 : 16, fontWeight: SIMPLE ? '400' : '600', color: colors.ink, marginRight: 4 },
});
