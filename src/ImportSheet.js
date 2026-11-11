// Revisão do extrato antes de guardar: escolhe a conta, confere as linhas e importa.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from './theme';
import { Btn, Chip, Icon, Input, Label, Row, Sheet, T } from './ui';
import { useStore } from './store';
import { applyImport, guessAccount, prepareImport } from './core/money';
import { formatMoney } from './core/dates';

const KIND = { extrato: 'Extrato', fatura: 'Fatura do cartão', holerite: 'Holerite', csv: 'Planilha' };
const day = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export default function ImportSheet({ read, onClose }) {
  const c = useTheme();
  const { state, mutate } = useStore();
  const meta = read.meta || {};
  const [choice, setChoice] = useState(() => guessAccount(meta, read.kind, state.accounts || []));
  const [newName, setNewName] = useState(meta.bank ? `${meta.bank}${read.kind === 'fatura' ? ' cartão' : ''}` : read.kind === 'fatura' ? 'Cartão' : 'Conta');
  const [off, setOff] = useState({}); // linhas que a pessoa mudou à mão: { key: true|false }
  const base = useMemo(() => prepareImport(read, state, choice), [choice]);
  const rows = base.map((r) => ({ ...r, selected: off[r.key] !== undefined ? off[r.key] : r.selected }));
  const chosen = rows.filter((r) => r.selected);
  const totals = chosen.reduce((t, r) => ({ in: t.in + (r.type === 'in' ? r.amount : 0), out: t.out + (r.type === 'out' ? r.amount : 0) }), { in: 0, out: 0 });
  const hasBalance = meta.balance !== null && meta.balance !== undefined && read.kind !== 'fatura';

  const save = () => {
    let result = null;
    mutate((s) => {
      result = applyImport(s, read, rows, { accChoice: choice, newName }, new Date());
      return result.state;
    }, 'Extrato importado');
    onClose();
  };

  return (
    <Sheet title={KIND[read.kind] || 'Importar'} onClose={onClose} full footer={<Btn label={chosen.length ? `Importar ${chosen.length}` : 'Nada marcado'} disabled={!chosen.length && !rows.some((r) => r.action !== 'add')} onPress={save} />}>
      <T v="s" c="soft" numberOfLines={1}>
        {read.name}
      </T>
      <Label>Em qual conta</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {(state.accounts || []).map((a) => (
          <Chip key={a.id} label={a.name} on={choice === a.id} color="money" onPress={() => setChoice(a.id)} />
        ))}
        <Chip label="Conta nova" icon="plus" on={choice === 'new'} color="money" onPress={() => setChoice('new')} />
        <Chip label="Sem conta" on={choice === 'none'} onPress={() => setChoice('none')} />
      </ScrollView>
      {choice === 'new' ? <Input value={newName} onChangeText={setNewName} placeholder="Nome da conta" accessibilityLabel="Nome da conta nova" aria-label="Nome da conta nova" style={{ marginTop: 10 }} /> : null}
      {hasBalance && choice !== 'none' ? (
        <T v="s" c="soft" style={{ marginTop: 8 }}>
          O arquivo diz que o saldo em {day(meta.balanceDate)} era {formatMoney(meta.balance)}. Vou usar esse número como saldo da conta.
        </T>
      ) : null}

      <Row style={{ marginTop: 18 }}>
        <T v="l" c="faint" style={{ flex: 1 }}>
          {chosen.length} de {rows.length} marcados
        </T>
        <T v="s" c="soft">
          + {formatMoney(totals.in)} · − {formatMoney(totals.out)}
        </T>
      </Row>
      {rows.map((r) => (
        <Pressable key={r.key} onPress={() => setOff({ ...off, [r.key]: !r.selected })} accessibilityRole="checkbox" accessibilityState={{ checked: r.selected }} accessibilityLabel={`${r.title} ${day(r.date)}`} aria-label={`${r.title} ${day(r.date)}`} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: r.selected ? c.money : c.line, backgroundColor: r.selected ? c.money : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{r.selected ? <Icon name="check" size={15} color={c.card} /> : null}</View>
            <View style={{ flex: 1 }}>
              <T v="m" c={r.selected ? 'text' : 'faint'} numberOfLines={2}>
                {r.title}
              </T>
              <T v="s" c="soft">
                {day(r.date)} · {r.type === 'transfer' ? 'Entre contas' : r.category}
              </T>
              {r.hint ? (
                <T v="s" c="warn">
                  {r.hint}
                </T>
              ) : null}
            </View>
            <T v="m" c={r.selected ? 'text' : 'faint'}>
              {r.type === 'in' ? '+' : r.type === 'transfer' ? '⇄' : '−'} {formatMoney(r.amount)}
            </T>
          </Row>
        </Pressable>
      ))}
      <T v="s" c="faint" style={{ marginTop: 12 }}>
        Toque numa linha para marcar ou desmarcar. O que já está no app vem desmarcado. Depois de importar, dá para ajustar cada lançamento e desfazer tudo.
      </T>
    </Sheet>
  );
}
