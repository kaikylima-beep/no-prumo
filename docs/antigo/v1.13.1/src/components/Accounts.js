// Cartão "Dinheiro nas contas" (Finanças) e a janela para criar ou editar uma conta.
import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView, KeyboardAvoidingView, Alert, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look } from '../theme';
import { useData } from '../store';
import { accountsSummary, accountLabel, accountDisplayName, placeholderAccounts, planMerge, afterAnchor as isAfterAnchor, ACCOUNT_KINDS, ACCOUNT_KIND_KEYS } from '../accounts';
import { formatMoney, showMoney, parseMoney, formatBR, todayISO, shortBR } from '../utils';
import { Label, Pill, Field, Chip, Button, Toggle, Card, Section, Check } from '../ui';
import { useUI } from '../uiContext';

export function AccountsCard() {
  const { accounts, finance, palettes, tone, settings } = useData();
  const pal = palettes.finance;
  const [editing, setEditing] = useState(null); // conta ou 'new'
  const [fixing, setFixing] = useState(false);
  const sum = accountsSummary(accounts, finance);
  const loose = placeholderAccounts(accounts);

  return (
    <Card>
      <View style={st.head}>
        <Text style={st.cardTitle}>Contas</Text>
        <Pill label="+ Conta" color={pal.main} onPress={() => setEditing('new')} />
      </View>
      {accounts.length === 0 ? (
        <Text style={st.help}>
          Cadastre suas contas (ou importe um extrato) para ver o saldo de verdade, igual ao do banco, e separar
          transferências entre elas.
        </Text>
      ) : (
        <View>
          <View style={{ marginTop: 10 }}>
            {sum.rows.map((a) => {
              const card = a.kind === 'cartao';
              return (
                <Pressable key={a.id} onPress={() => setEditing(a)} style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>
                      {accountDisplayName(a, accounts)}
                      {settings.defaultAccount === a.id ? <Text style={st.main}>  principal</Text> : null}
                    </Text>
                    <Text style={st.meta}>
                      {ACCOUNT_KINDS[a.kind] || 'Conta'}
                      {a.anchor ? ` · saldo de ${formatBR(a.anchor.date).slice(0, 5)}` : card ? ' · sem saldo inicial' : ' · saldo não informado'}
                    </Text>
                  </View>
                  {!a.known ? (
                    <Text style={[st.value, { color: pal.main, fontSize: 14 }]}>Informar saldo</Text>
                  ) : (
                    <Text style={[st.value, !card && a.balance < 0 && { color: tone.warn }]}>
                      {card ? `fatura ${showMoney(Math.max(0, -a.balance))}` : showMoney(a.balance)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {loose.length ? (
            <View style={st.fixBox}>
              <Text style={st.fixText}>
                {loose.length === 1 ? '1 conta sem nome foi criada' : `${loose.length} contas sem nome foram criadas`} ao importar holerite ou planilha.
                Elas ficam fora do "Dinheiro nas contas" até você juntar ou informar o saldo.
              </Text>
              <Pill label="Arrumar" color={pal.main} onPress={() => setFixing(true)} />
            </View>
          ) : null}
          {sum.unassigned ? (
            <Text style={st.help}>
              {sum.unassigned === 1 ? '1 lançamento está' : `${sum.unassigned} lançamentos estão`} sem conta e não entram
              nesses saldos. Toque num lançamento para escolher a conta.
            </Text>
          ) : null}
        </View>
      )}
      <AccountEditor target={editing} onClose={() => setEditing(null)} />
      <FixAccounts visible={fixing} onClose={() => setFixing(false)} />
    </Card>
  );
}

export function AccountEditor({ target, onClose }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>{target ? <EditorBody target={target} onClose={onClose} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function EditorBody({ target, onClose }) {
  const insets = useSafeAreaInsets();
  const { addAccount, updateAccount, setAccountBalance, removeAccount, setDefaultAccount, accounts, finance, palettes, tone, settings } = useData();
  const pal = palettes.finance;
  const isNew = target === 'new';
  const acc = isNew ? null : target;
  // sem saldo informado não há número para sugerir: a soma do histórico não é o saldo da conta
  const unknown = !!acc && acc.kind !== 'cartao' && !acc.anchor;
  const current = acc && !unknown ? accountsSummary([acc], finance).rows[0].balance : null;
  const [name, setName] = useState(acc ? acc.name : '');
  const [kind, setKind] = useState(acc ? acc.kind : 'corrente');
  const card = kind === 'cartao';
  const shown = current === null ? '' : String(Math.abs(card ? -current : current).toFixed(2)).replace('.', ',');
  const [balanceText, setBalanceText] = useState(shown);
  const [negative, setNegative] = useState(!card && current !== null && current < 0);
  const used = acc ? finance.filter((t) => t.account === acc.id || t.from === acc.id || t.to === acc.id).length : 0;

  const save = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Falta o nome', 'Dê um nome para a conta, por exemplo "Itaú" ou "Nubank".');
      return;
    }
    let value = balanceText.trim() ? parseMoney(balanceText) : null;
    if (balanceText.trim() && value === null) {
      Alert.alert('Valor inválido', 'Digite o saldo assim: 699,07');
      return;
    }
    if (value !== null) value = card ? -value : negative ? -value : value;
    let id = acc && acc.id;
    if (isNew) id = addAccount({ name: n, kind }).id;
    else updateAccount(id, { name: n, kind });
    // só grava o saldo se ele mudou (senão o "saldo de hoje" apagaria o do extrato)
    const changed = value !== null && (current === null || Math.abs(value - current) >= 0.005);
    if (changed) setAccountBalance(id, value, todayISO());
    onClose();
  };

  const remove = () => {
    Alert.alert(
      `Excluir ${acc.name}?`,
      used ? `${used} lançamentos continuam no app, só que sem conta.` : 'Nenhum lançamento usa esta conta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            removeAccount(acc.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <Text style={st.title}>{isNew ? 'Nova conta' : 'Conta'}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={st.close}>Fechar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Label>Nome</Label>
        <Field value={name} onChangeText={setName} placeholder="Itaú, Nubank, Carteira…" autoFocus={isNew} />
        <Label>Tipo</Label>
        <View style={st.chips}>
          {ACCOUNT_KIND_KEYS.map((k) => (
            <Chip key={k} label={ACCOUNT_KINDS[k]} color={pal.main} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Label>{card ? 'Fatura em aberto hoje (R$)' : 'Saldo hoje (R$)'}</Label>
        <Field value={balanceText} onChangeText={setBalanceText} keyboardType="decimal-pad" placeholder="0,00" />
        {!card ? (
          <Toggle
            color={pal.main}
            options={[
              { key: 'pos', label: 'Positivo' },
              { key: 'neg', label: 'Negativo (no limite)' },
            ]}
            value={negative ? 'neg' : 'pos'}
            onChange={(v) => setNegative(v === 'neg')}
          />
        ) : null}
        <Text style={st.help}>
          {card
            ? 'O valor da fatura no app do banco. As compras que você lançar depois somam nela; o pagamento da fatura desconta.'
            : unknown
            ? 'Esta conta ainda não tem saldo informado e fica fora do "Dinheiro nas contas". Digite o saldo que aparece no app do banco.'
            : 'O saldo que aparece no app do banco. Daqui para frente o app soma o que entrar e tira o que sair desta conta.'}
        </Text>
        {!isNew && kind === 'corrente' && settings.defaultAccount !== acc.id ? (
          <Pressable onPress={() => setDefaultAccount(acc.id)} style={st.link}>
            <Text style={[st.linkText, { color: pal.main }]}>Usar como conta principal (lançamentos por voz vão para ela)</Text>
          </Pressable>
        ) : null}
        <View style={{ height: 16 }} />
        <Button title="Salvar" color={pal.main} onPress={save} />
        {!isNew ? <Button title="Excluir conta" variant="text" color={tone.warn} onPress={remove} /> : null}
        {!isNew && used ? <Statement acc={acc} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Juntar as contas sem nome numa conta de verdade (ou deixar os lançamentos sem conta)
export function FixAccounts({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>{visible ? <FixBody onClose={onClose} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function FixBody({ onClose }) {
  const insets = useSafeAreaInsets();
  const { accounts, finance, settings, palettes, tone, mergeAccounts } = useData();
  const { showToast } = useUI();
  const pal = palettes.finance;
  const loose = placeholderAccounts(accounts);
  const real = accounts.filter((a) => !loose.some((l) => l.id === a.id) && a.kind !== 'cartao');
  const [picked, setPicked] = useState(() => loose.map((a) => a.id));
  const [target, setTarget] = useState(() => {
    if (real.some((a) => a.id === settings.defaultAccount)) return settings.defaultAccount;
    return real.length ? real[0].id : null;
  });
  const [dropDup, setDropDup] = useState(false);
  const plan = planMerge(finance, accounts, picked, target);
  const tAcc = accounts.find((a) => a.id === target);
  const tName = tAcc ? accountDisplayName(tAcc, accounts) : 'sem conta';
  // o que cai depois do saldo conhecido da conta de destino muda o saldo dela
  const afterAnchor = tAcc && tAcc.anchor ? finance.filter((t) => plan.moves[t.id] && t.status !== 'pending' && isAfterAnchor(t, tAcc.anchor)).length : 0;
  const count = (id) => finance.filter((t) => t.account === id || t.from === id || t.to === id).length;
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const go = () => {
    const drop = dropDup ? plan.repeated.map((r) => r.id) : [];
    const undo = mergeAccounts(picked, target, plan.moves, drop);
    onClose();
    showToast(
      `${picked.length === 1 ? '1 conta juntada' : `${picked.length} contas juntadas`}${target ? ` em ${tName}` : ''}${drop.length ? ` · ${drop.length === 1 ? '1 repetido apagado' : `${drop.length} repetidos apagados`}` : ''}`,
      'Desfazer',
      undo
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <Text style={st.title}>Arrumar contas</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={st.close}>Fechar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={st.help}>
          Estas contas foram criadas sozinhas ao importar holerite ou planilha. Elas não têm banco nem saldo, por isso ficam fora do "Dinheiro nas contas".
          Junte os lançamentos numa conta de verdade para ela sumir da lista.
        </Text>
        <Section>Contas para juntar</Section>
        {loose.map((a) => {
          const on = picked.includes(a.id);
          return (
            <Pressable key={a.id} onPress={() => toggle(a.id)} style={st.pickRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Check done={on} color={pal.main} onPress={() => toggle(a.id)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.name}>{accountDisplayName(a, accounts)}</Text>
                <Text style={st.meta}>
                  {count(a.id)} {count(a.id) === 1 ? 'lançamento' : 'lançamentos'}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Section>Os lançamentos vão para</Section>
        <View style={st.chips}>
          {real.map((a) => (
            <Chip key={a.id} label={accountDisplayName(a, accounts)} color={pal.main} active={target === a.id} onPress={() => setTarget(a.id)} />
          ))}
          <Chip label="Sem conta" color={pal.main} active={!target} onPress={() => setTarget(null)} />
        </View>
        <Text style={st.help}>
          {plan.count} {plan.count === 1 ? 'lançamento vai' : 'lançamentos vão'} para {tName} e {picked.length === 1 ? 'a conta sem nome é apagada' : `as ${picked.length} contas sem nome são apagadas`}.
          Nenhum lançamento é apagado.
          {target
            ? afterAnchor
              ? ` ${afterAnchor} ${afterAnchor === 1 ? 'deles é' : 'deles são'} depois do saldo de ${tName} (${shortBR(tAcc.anchor.date)}) e ${afterAnchor === 1 ? 'muda' : 'mudam'} o saldo dela.`
              : tAcc && tAcc.anchor
              ? ` Todos são de antes do saldo de ${tName} (${shortBR(tAcc.anchor.date)}), então o saldo dela não muda.`
              : ''
            : ' Sem conta, eles continuam nos meses, mas não mexem em saldo nenhum.'}
        </Text>
        {plan.repeated.length ? (
          <View>
            <Section>Salários que parecem repetidos</Section>
            <Text style={st.help}>O mesmo salário veio de dois lugares (holerite e extrato ou planilha): no mesmo mês, com até R$ 1 de diferença.</Text>
            {plan.repeated.map((r) => {
              const of = finance.find((t) => t.id === r.of);
              return (
                <View key={r.id} style={st.stRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.stTitle}>
                      {r.title} · {formatMoney(r.amount)}
                    </Text>
                    <Text style={st.meta}>
                      {shortBR(r.date)} · igual ao de {of ? `${shortBR(of.date)} (${formatMoney(of.amount)}${of.account ? `, ${accountLabel(of.account, accounts)}` : ''})` : 'outra conta'}
                    </Text>
                  </View>
                </View>
              );
            })}
            <Pressable onPress={() => setDropDup(!dropDup)} style={st.pickRow} accessibilityRole="checkbox" accessibilityState={{ checked: dropDup }}>
              <Check done={dropDup} color={tone.warn} onPress={() => setDropDup(!dropDup)} />
              <Text style={[st.stTitle, { flex: 1, marginLeft: 12 }]}>
                Apagar {plan.repeated.length === 1 ? 'este repetido' : `estes ${plan.repeated.length} repetidos`} (o outro fica)
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ height: 16 }} />
        <Button title={picked.length ? `Juntar ${picked.length === 1 ? '1 conta' : `${picked.length} contas`}` : 'Escolha uma conta'} color={pal.main} onPress={picked.length ? go : () => {}} />
        <Text style={[st.help, { textAlign: 'center' }]}>Depois dá para desfazer.</Text>
      </ScrollView>
    </View>
  );
}

// extrato da conta: os últimos lançamentos que mexem nela
function Statement({ acc }) {
  const { finance, accounts, tone } = useData();
  const list = finance
    .filter((t) => t.status !== 'pending' && (t.account === acc.id || t.from === acc.id || t.to === acc.id))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);
  return (
    <View>
      <Section>Extrato desta conta</Section>
      {list.map((t) => {
        const inn = t.type === 'in' || (t.type === 'transfer' && t.to === acc.id);
        const sign = t.type === 'transfer' ? '⇄' : inn ? '+' : '−';
        const meta =
          t.type === 'transfer'
            ? t.to === acc.id
              ? `de ${accountLabel(t.from, accounts)}`
              : `para ${accountLabel(t.to, accounts)}`
            : t.category;
        return (
          <View key={t.id} style={st.stRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.stTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={st.meta}>
                {shortBR(t.date)} · {meta}
              </Text>
            </View>
            <Text style={[st.stValue, inn && t.type === 'in' && { color: tone.income }]}>
              {sign} {showMoney(t.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  fixBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.alertBg, borderRadius: look.rSmall, padding: 12, marginTop: 10 },
  fixText: { flex: 1, fontSize: 14, color: colors.alertInk, marginRight: 10, lineHeight: 19 },
  pickRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  stRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  stTitle: { fontSize: 15, color: colors.ink },
  stValue: { fontSize: 15, color: colors.ink, marginLeft: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  total: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  debt: { fontSize: 13, color: colors.mute, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line2 },
  name: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  main: { fontSize: 11, color: colors.mute, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.mute, marginTop: 2 },
  value: { fontSize: 16, fontWeight: '600', color: colors.ink, marginLeft: 10 },
  help: { fontSize: 13, color: colors.mute, lineHeight: 19, marginTop: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  title: { fontSize: look.titleSize, fontWeight: look.titleWeight, color: colors.ink, letterSpacing: -0.5 },
  close: { fontSize: 16, color: colors.mute, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  link: { marginTop: 14 },
  linkText: { fontSize: 14, fontWeight: '700' },
});
