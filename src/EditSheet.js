import React, { useEffect, useMemo, useState } from 'react';
import { diffWords } from './voice';
import { View, Modal, ScrollView, Pressable, KeyboardAvoidingView, Alert, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, AREA_LABEL } from './theme';
import { useData } from './store';
import { useUI } from './uiContext';
import { toEditable, readEditable, summarize } from './itemForm';
import ItemFields from './components/ItemFields';
import { parseMoney, parseBR, shortBR, formatMoney, todayISO } from './utils';
import { Button, Check, Chip, Field } from './ui';
import { reconcile, dupChanges, linkChanges, accountDisplayName } from './accounts';

// Edição de um item existente: target = { kind, item }
// Revisão em lote (extrato importado): target = { batch: { kind, items, title, subtitle } }
// Nos dois casos nada é salvo sem a pessoa confirmar.
export default function EditSheet({ target, onClose, onDelete }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        {target && target.batch ? (
          <BatchContent batch={target.batch} onClose={onClose} />
        ) : target ? (
          <Content target={target} onClose={onClose} onDelete={onDelete} />
        ) : null}
      </SafeAreaProvider>
    </Modal>
  );
}

function Content({ target, onClose, onDelete }) {
  const insets = useSafeAreaInsets();
  const { updateItem, stopRecurrence, palettes, tone, learnVoice } = useData();
  const { kind, item } = target;
  const [form, setForm] = useState(() => toEditable(kind, item));
  useEffect(() => setForm(toEditable(kind, item)), [item.id]);
  const pal = palettes[kind];

  const save = async () => {
    const r = readEditable(form);
    if (r.error) {
      Alert.alert('Confira os campos', r.error);
      return;
    }
    await updateItem(kind, item.id, r.data);
    // item que veio da voz: corrigir o nome também ensina o app ("Pics Pablo" -> "Pix Pablo")
    if (item.note && item.title && r.data.title && r.data.title !== item.title) learnVoice(diffWords(item.title, r.data.title));
    onClose();
  };

  const stopRepeat = () => {
    Alert.alert('Parar de repetir?', 'Os próximos meses deixam de ser criados. Este lançamento continua.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Parar',
        style: 'destructive',
        onPress: async () => {
          await stopRecurrence(item.recId);
          onClose();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={[st.kind, { color: pal.main }]}>{AREA_LABEL[kind]}</Text>
          <Text style={st.title}>Editar</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={st.close}>Fechar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {item.note && item.note.trim().toLowerCase() !== item.title.trim().toLowerCase() ? (
          <View style={st.noteBox}>
            <Text style={st.noteLabel}>Você disse</Text>
            <Text style={st.noteText}>“{item.note}”</Text>
          </View>
        ) : null}
        <ItemFields value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
        {kind === 'finance' && item.recId ? (
          <Pressable onPress={stopRepeat} style={st.repeatRow}>
            <Text style={st.repeatText}>↻ Repete todo mês</Text>
            <Text style={[st.repeatAction, { color: tone.warn }]}>Parar de repetir</Text>
          </Pressable>
        ) : null}
        <View style={{ height: 12 }} />
        <Button title="Salvar" color={pal.main} onPress={save} />
        <View style={{ height: 6 }} />
        <Button title="Excluir" variant="text" color={tone.warn} onPress={() => onDelete(kind, item)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- revisão em lote ----------

function BatchContent({ batch, onClose }) {
  const insets = useSafeAreaInsets();
  const { addItem, removeItem, palettes, tone, finance, accounts, addAccount, setAccountBalance, patchFinance, settings, setBudget } = useData();
  const { showToast } = useUI();
  const kind = batch.kind || 'finance';
  const pal = palettes[kind];
  const meta = batch.meta || {};
  const isFinance = kind === 'finance';
  const isCardDoc = batch.docKind === 'fatura';

  // conta deste arquivo: uma existente (mesmo número, ou mesmo banco e tipo), uma nova (só quando o
  // arquivo diz o banco) ou "sem conta". Holerite e planilha sem banco nunca criam conta sozinhos.
  const guess = useMemo(() => {
    if (!isFinance) return null;
    const wantKind = isCardDoc ? 'cartao' : 'corrente';
    const digits = (n) => String(n || '').replace(/\D/g, '').replace(/^0+/, '');
    const byNumber = meta.number && accounts.find((a) => a.number && digits(a.number) === digits(meta.number));
    if (byNumber) return byNumber.id;
    const byBank = meta.bank && accounts.find((a) => a.kind === wantKind && (a.bank === meta.bank || a.name.toLowerCase().includes(meta.bank.toLowerCase())));
    if (byBank) return byBank.id;
    if (meta.payslip || !meta.bank) return 'none';
    return 'new';
  }, []);
  const [accChoice, setAccChoice] = useState(guess);
  const [newName, setNewName] = useState(() => (meta.bank ? `${meta.bank}${isCardDoc ? ' cartão' : ''}` : isCardDoc ? 'Cartão' : 'Conta'));
  const [useBalance, setUseBalance] = useState(meta.balance !== null && meta.balance !== undefined && !isCardDoc);
  const NEW = '__nova__';
  const accId = accChoice === 'new' ? NEW : accChoice === 'none' ? null : accChoice;
  // contas para conferir pares e duplicados (a nova ainda não existe)
  const accList = accChoice === 'new' ? [...accounts, { id: NEW, name: newName, kind: isCardDoc ? 'cartao' : 'corrente' }] : accounts;

  const [rows, setRows] = useState(() =>
    batch.items.map((it) => ({
      ...toEditable(kind, it),
      selected: it.selected !== false,
      baseHint: it.hint || '',
      hint: it.hint || '',
      dir: it.dir || (it.type === 'in' ? 1 : it.type === 'out' ? -1 : 0),
      sign: it.type === 'in' ? 1 : it.type === 'out' ? -1 : it.dir || 0,
      source: it.source || '',
      payslip: !!it.payslip || !!(batch.meta && batch.meta.payslip),
      holderPix: !!it.holderPix,
      action: 'add',
      targetId: null,
      convert: false,
      toAccount: null,
      fromAccount: null,
    }))
  );
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);
  // 1.10: de qual conta vêm os Pix com o seu nome. Lembra a resposta da última importação.
  const ownSrc = (settings.budget && settings.budget.ownSource) || null;
  const [ownFrom, setOwnFrom] = useState(() =>
    ownSrc && ownSrc.mode === 'account' && accounts.some((a) => a.id === ownSrc.id) ? ownSrc.id : ownSrc && ownSrc.mode === 'untracked' ? 'untracked' : null
  );
  const [ownName, setOwnName] = useState('Outra conta');

  // confere com o que já está no app sempre que a conta escolhida muda
  useEffect(() => {
    if (!isFinance) return;
    setRows((prev) => {
      const plain = prev.map((r) => ({
        title: r.title,
        category: r.category,
        amount: parseMoney(r.amountText) || 0,
        type: r.type,
        dir: r.type === 'transfer' ? r.dir || r.sign : undefined,
        date: parseBR(r.dateText) || '',
        hint: r.baseHint,
        payslip: r.payslip,
        selected: true,
      }));
      const rec = reconcile(plain, finance, accId, accList);
      return prev.map((r, k) => {
        const x = rec[k];
        const becameTransfer = x.type === 'transfer' && r.type !== 'transfer';
        return {
          ...r,
          action: x.action,
          targetId: x.targetId,
          convert: x.convert,
          salaryFix: !!x.salaryFix,
          hint: x.hint,
          selected: x.action === 'dup' ? false : r.action === 'dup' ? true : r.selected,
          type: becameTransfer ? 'transfer' : r.type,
          dir: becameTransfer ? x.dir : r.dir,
          toAccount: x.toAccount || null,
        };
      });
    });
  }, [accChoice]);

  const patch = (key, changes) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  const chosen = rows.filter((r) => r.selected);
  const holderRows = rows.filter((r) => r.selected && r.holderPix && r.type === 'transfer');
  const holderTotal = holderRows.reduce((a, r) => a + (parseMoney(r.amountText) || 0), 0);
  const allOn = chosen.length === rows.length;
  const totals = useMemo(() => {
    let inn = 0;
    let out = 0;
    let moved = 0;
    for (const r of chosen) {
      const v = parseMoney(r.amountText) || 0;
      if (r.type === 'transfer') moved += v;
      else if (r.type === 'in') inn += v;
      else out += v;
    }
    return { inn, out, moved };
  }, [rows]);

  const toggleAll = () => setRows((prev) => prev.map((r) => ({ ...r, selected: !allOn })));
  const dropSelected = () => {
    Alert.alert(`Tirar ${chosen.length} da lista?`, 'Eles não serão importados. O arquivo não muda.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar', style: 'destructive', onPress: () => setRows((prev) => prev.filter((r) => !r.selected)) },
    ]);
  };

  const save = async () => {
    // confere os campos antes de mexer em qualquer coisa
    const ready = [];
    for (const r of rows) {
      // marcar um "já está no app" de novo cria outro lançamento (duas compras iguais no mesmo dia)
      if (!r.selected || r.action === 'link') continue;
      // "já está no app como entrada/saída; vai virar transferência": converte o que existe, não cria outro
      if (r.action === 'dup' && r.convert) continue;
      const res = readEditable(isFinance && r.type === 'transfer' ? { ...r, from: r.from || 'x', to: r.to || 'y' } : r);
      if (res.error) {
        setOpen(r.key);
        Alert.alert('Confira este lançamento', `${r.title || 'Sem nome'}: ${res.error}`);
        return;
      }
      ready.push({ r, data: res.data });
    }
    setSaving(true);
    const importId = `imp${Date.now()}`;
    let id = accId;
    if (accChoice === 'none') id = null;
    if (isFinance && accChoice === 'new') {
      id = addAccount({ name: newName.trim() || 'Conta', kind: isCardDoc ? 'cartao' : 'corrente', number: meta.number || null, bank: meta.bank || null }).id;
    }
    // Pix com o seu nome: a outra ponta é a conta escolhida (ou uma nova); "Não acompanho" deixa sem conta
    let otherId = null;
    const hasHolderPix = isFinance && rows.some((r) => r.selected && r.holderPix && r.type === 'transfer');
    if (hasHolderPix && ownFrom === 'new') {
      otherId = addAccount({ name: ownName.trim() || 'Outra conta', kind: 'corrente', number: null, bank: null }).id;
    } else if (hasHolderPix && ownFrom && ownFrom !== 'untracked') otherId = ownFrom;
    if (hasHolderPix && ownFrom) setBudget({ ownSource: otherId ? { mode: 'account', id: otherId } : { mode: 'untracked' } });
    const added = [];
    let linked = 0;
    let adopted = 0;
    if (isFinance) {
      const changes = {};
      for (const r of rows) {
        const ex = r.targetId && finance.find((e) => e.id === r.targetId);
        if (!ex) continue;
        const row = { type: r.type, dir: r.dir || r.sign, convert: r.convert, salaryFix: r.salaryFix, payslip: r.payslip };
        if (r.action === 'dup' && (!r.selected || r.convert)) {
          const c = dupChanges(ex, row, id);
          if (c) {
            changes[ex.id] = c;
            adopted++;
          }
        } else if (r.action === 'link' && r.selected) {
          changes[ex.id] = linkChanges(ex, row, id);
          linked++;
        }
      }
      if (Object.keys(changes).length) patchFinance(changes);
    }
    for (const { r, data } of ready) {
      let d = { ...data, note: r.source || data.note, importId };
      if (isFinance) {
        if (d.type === 'transfer') {
          const dir = r.dir || r.sign;
          const other = r.holderPix && otherId && otherId !== id ? otherId : null;
          d = { ...d, from: dir < 0 ? id : r.fromAccount || other || null, to: dir > 0 ? id : r.toAccount || other || null };
        } else d.account = id;
      }
      added.push(await addItem(kind, d));
    }
    if (isFinance && id && useBalance && meta.balance !== null && meta.balance !== undefined) {
      setAccountBalance(id, meta.balance, meta.balanceDate || todayISO(), importId);
    }
    // 1.10: salário no arquivo. Sem tipo de renda definido, o app pergunta se é o salário de todo mês;
    // com renda fixa, o salário mais novo vira o salário base (o valor pode mudar de um mês para outro).
    if (isFinance) {
      const sal = rows
        .filter((r) => r.type === 'in' && r.category === 'Salário' && (r.selected || r.action === 'dup'))
        .map((r) => ({ amount: parseMoney(r.amountText) || 0, date: parseBR(r.dateText) || '' }))
        .filter((x) => x.amount > 0 && x.date && x.date <= todayISO())
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const bset = settings.budget || {};
      if (sal && !bset.incomeType) {
        const source = batch.docKind === 'holerite' ? 'holerite' : meta.bank ? `extrato do ${meta.bank}` : 'extrato';
        setBudget({ salaryAsk: { amount: sal.amount, date: sal.date, source } });
      } else if (sal && bset.incomeType === 'fixed') {
        const lastSalary = finance.filter((t) => t.type === 'in' && t.category === 'Salário').reduce((m, t) => (t.date > m ? t.date : m), '');
        if (sal.date >= lastSalary) setBudget({ salary: sal.amount, salaryDay: Number(sal.date.slice(8, 10)) });
      }
    }
    setSaving(false);
    onClose();
    const undo = async () => {
      for (const it of added) await removeItem(kind, it.id);
    };
    const parts = [added.length === 1 ? '1 lançamento novo' : `${added.length} lançamentos novos`];
    if (linked) parts.push(linked === 1 ? '1 transferência ligada' : `${linked} transferências ligadas`);
    if (adopted) parts.push(`${adopted} já existiam`);
    showToast(parts.join(' · '), added.length ? 'Desfazer' : undefined, added.length ? undo : undefined);
  };

  const cancel = () => {
    if (!rows.length) return onClose();
    Alert.alert('Sair sem importar?', 'Nada deste arquivo será salvo.', [
      { text: 'Continuar revisando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: onClose },
    ]);
  };

  const fmtD = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.kind, { color: pal.main }]}>{batch.subtitle || 'Importar'}</Text>
          <Text style={st.title}>Revisar</Text>
        </View>
        <Pressable onPress={cancel} hitSlop={12}>
          <Text style={st.close}>Cancelar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingTop: 4, paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={st.batchInfo} numberOfLines={1}>
          {batch.title}
        </Text>
        {isFinance ? (
          <View style={st.accBox}>
            <Text style={st.accLabel}>
              {isCardDoc ? 'De qual cartão é esta fatura?' : meta.payslip ? 'Em qual conta caiu este salário?' : 'De qual conta é este arquivo?'}
            </Text>
            <View style={st.chipsRow}>
              {accounts.map((a) => (
                <Chip key={a.id} label={accountDisplayName(a, accounts)} color={pal.main} active={accChoice === a.id} onPress={() => setAccChoice(a.id)} />
              ))}
              {!isCardDoc ? <Chip label="Sem conta" color={pal.main} active={accChoice === 'none'} onPress={() => setAccChoice('none')} /> : null}
              <Chip label={accChoice === 'new' ? `Nova: ${newName || '…'}` : '+ Nova conta'} color={pal.main} active={accChoice === 'new'} onPress={() => setAccChoice('new')} />
            </View>
            {accChoice === 'new' ? (
              <Field value={newName} onChangeText={setNewName} placeholder="Nome da conta" />
            ) : null}
            {meta.number ? (
              <Text style={st.accMeta}>
                {meta.payslip ? 'Conta no holerite' : 'Conta no extrato'}: {meta.bank ? `${meta.bank} · ` : ''}
                {meta.agency ? `ag. ${meta.agency} · ` : ''}
                {meta.number}
              </Text>
            ) : null}
            {accChoice === 'none' ? <Text style={st.accMeta}>Os lançamentos ficam sem conta: entram no mês, mas não mexem no saldo de nenhuma conta.</Text> : null}
            {meta.balance !== null && meta.balance !== undefined && !isCardDoc ? (
              <Pressable onPress={() => setUseBalance(!useBalance)} style={st.balRow} accessibilityRole="checkbox" accessibilityState={{ checked: useBalance }}>
                <Check done={useBalance} color={pal.main} onPress={() => setUseBalance(!useBalance)} />
                <Text style={st.balText}>
                  Usar o saldo do extrato: <Text style={{ fontWeight: '800' }}>{formatMoney(meta.balance)}</Text> em {fmtD(meta.balanceDate)}
                </Text>
              </Pressable>
            ) : null}
            {meta.gap && !isCardDoc ? (
              <Text style={st.accMeta}>
                O extrato do banco não fecha por {formatMoney(Math.abs(meta.gap.amount))}: o saldo de {fmtD(meta.gap.date)} tem{' '}
                {meta.gap.amount > 0 ? 'a mais' : 'a menos'} do que a soma dos lançamentos listados (costuma ser rendimento do dia que o banco
                ainda não mostrou). Com o saldo do extrato marcado, o app fica igual ao banco.
              </Text>
            ) : null}
          </View>
        ) : null}
        {isFinance && holderRows.length ? (
          <View style={st.accBox}>
            <Text style={st.accLabel}>
              {holderRows.length === 1 ? '1 Pix com o seu nome' : `${holderRows.length} Pix com o seu nome`} ({formatMoney(holderTotal)}). De qual conta sua?
            </Text>
            <View style={st.chipsRow}>
              {accounts
                .filter((a) => a.kind !== 'cartao' && a.id !== accId)
                .map((a) => (
                  <Chip key={a.id} label={accountDisplayName(a, accounts)} color={pal.main} active={ownFrom === a.id} onPress={() => setOwnFrom(a.id)} />
                ))}
              <Chip label={ownFrom === 'new' ? `Nova: ${ownName || '…'}` : '+ Cadastrar conta'} color={pal.main} active={ownFrom === 'new'} onPress={() => setOwnFrom('new')} />
              <Chip label="Não acompanho" color={pal.main} active={ownFrom === 'untracked'} onPress={() => setOwnFrom('untracked')} />
            </View>
            {ownFrom === 'new' ? <Field value={ownName} onChangeText={setOwnName} placeholder="Nome da conta (ex.: Nubank)" /> : null}
            <Text style={st.accMeta}>
              {ownFrom === 'untracked'
                ? 'Fica como "outra conta sua": entra no saldo, mas não é renda. O app lembra a resposta.'
                : ownFrom
                ? 'O app lembra a resposta nas próximas importações. Conta cadastrada sem saldo não entra no "Dinheiro nas contas" até você informar o saldo.'
                : 'Esse dinheiro entra no saldo, mas não é renda. Escolha uma vez e o app lembra.'}
            </Text>
          </View>
        ) : null}
        <Text style={st.batchHelp}>
          Nada foi salvo ainda. Desmarque o que não quer, toque num lançamento para corrigir e depois salve.
        </Text>
        <View style={st.batchActions}>
          <Pressable onPress={toggleAll} hitSlop={8} style={st.batchLink}>
            <Text style={[st.batchLinkText, { color: pal.main }]}>{allOn ? 'Desmarcar todos' : 'Marcar todos'}</Text>
          </Pressable>
          {chosen.length ? (
            <Pressable onPress={dropSelected} hitSlop={8} style={st.batchLink}>
              <Text style={[st.batchLinkText, { color: tone.warn }]}>Tirar marcados da lista</Text>
            </Pressable>
          ) : null}
        </View>
        {rows.length === 0 ? <Text style={st.batchHelp}>A lista ficou vazia.</Text> : null}
        {rows.map((r) => {
          const expanded = open === r.key;
          const amount = parseMoney(r.amountText);
          const date = parseBR(r.dateText);
          const transfer = r.type === 'transfer';
          return (
            <View key={r.key} style={[st.bRow, !r.selected && { opacity: 0.55 }, expanded && st.bRowOpen]}>
              <View style={st.bHead}>
                <Check done={r.selected} color={pal.main} onPress={() => patch(r.key, { selected: !r.selected })} />
                <Pressable style={{ flex: 1 }} onPress={() => setOpen(expanded ? null : r.key)}>
                  <View style={st.bLine}>
                    <Text style={st.bTitle} numberOfLines={1}>
                      {r.title || 'Sem nome'}
                    </Text>
                    <Text style={[st.bAmount, r.type === 'in' && { color: tone.income }, transfer && { color: colors.mute }]}>
                      {transfer ? '↔' : r.type === 'in' ? '+' : '−'} {amount ? formatMoney(amount) : '—'}
                    </Text>
                  </View>
                  <Text style={st.bMeta} numberOfLines={1}>
                    {date ? shortBR(date) : 'sem data'} ·{' '}
                    {transfer ? 'transferência entre suas contas' : r.category}
                    {r.type === 'out' ? (r.category === 'Devolvido' ? ' · devolvido' : /^fatura\b/i.test(r.title || '') ? ' · fatura' : r.essential ? ' · necessário' : ' · não necessário') : ''}
                  </Text>
                  {r.hint ? <Text style={[st.bDup, { color: r.action === 'add' && transfer ? pal.main : tone.warn }]}>{r.hint}</Text> : null}
                  {!expanded ? <Text style={st.bEdit}>Toque para corrigir</Text> : null}
                </Pressable>
              </View>
              {expanded ? (
                <View style={{ paddingBottom: 6 }}>
                  {r.source ? <Text style={st.bSource}>No arquivo: “{r.source}”</Text> : null}
                  <ItemFields value={r} onChange={(p) => patch(r.key, p)} hideAccounts />
                  <Button title="Pronto" variant="text" color={pal.main} onPress={() => setOpen(null)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={[st.batchFoot, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={st.batchTotals}>
          {chosen.length} de {rows.length} marcados
          {totals.out ? ` · saídas ${formatMoney(totals.out)}` : ''}
          {totals.inn ? ` · entradas ${formatMoney(totals.inn)}` : ''}
          {totals.moved ? ` · transferências ${formatMoney(totals.moved)}` : ''}
        </Text>
        <Button
          title={saving ? 'Salvando…' : chosen.length === 1 ? 'Salvar 1 lançamento' : `Salvar ${chosen.length} lançamentos`}
          color={pal.main}
          onPress={save}
          disabled={saving || (!chosen.length && !rows.some((r) => r.action === 'dup'))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  accBox: { backgroundColor: colors.soft, borderRadius: 14, padding: 12, marginTop: 10 },
  accLabel: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  accMeta: { fontSize: 12, color: colors.mute, marginTop: 4 },
  balRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  balText: { flex: 1, fontSize: 14, color: colors.ink, marginLeft: 4 },
  batchBar: { paddingHorizontal: 24, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  batchInfo: { fontSize: 14, fontWeight: '700', color: colors.ink },
  batchHelp: { fontSize: 13, color: colors.mute, lineHeight: 19, marginTop: 4 },
  batchActions: { flexDirection: 'row', marginTop: 8 },
  batchLink: { marginRight: 18, paddingVertical: 4 },
  batchLinkText: { fontSize: 14, fontWeight: '700' },
  bRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingVertical: 10 },
  bRowOpen: { backgroundColor: colors.soft, borderRadius: 14, borderBottomWidth: 0, paddingHorizontal: 10, marginVertical: 6 },
  bHead: { flexDirection: 'row', alignItems: 'flex-start' },
  bLine: { flexDirection: 'row', alignItems: 'center' },
  bTitle: { flex: 1, fontSize: 16, color: colors.ink, fontWeight: '600' },
  bAmount: { fontSize: 15, fontWeight: '700', color: colors.ink, marginLeft: 8 },
  bMeta: { fontSize: 13, color: colors.mute, marginTop: 2 },
  bDup: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  bEdit: { fontSize: 12, color: colors.mute, marginTop: 3 },
  bSource: { fontSize: 12, color: colors.mute, fontStyle: 'italic', marginVertical: 8 },
  batchFoot: { paddingHorizontal: 24, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
  batchTotals: { fontSize: 13, color: colors.mute, marginBottom: 8, textAlign: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, paddingBottom: 8 },
  kind: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  close: { fontSize: 16, color: colors.mute, fontWeight: '600', marginBottom: 8 },
  body: { paddingHorizontal: 24, paddingTop: 16 },
  repeatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginTop: 4,
  },
  repeatText: { fontSize: 15, color: colors.ink },
  noteBox: { marginBottom: 14 },
  noteLabel: { fontSize: 12, color: colors.mute, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  noteText: { fontSize: 15, color: colors.mute, fontStyle: 'italic', marginTop: 4, lineHeight: 21 },
  repeatAction: { fontSize: 15, fontWeight: '700' },
});
