// Ver e ajustar um item (ou um rascunho que ainda não foi guardado).
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { typeColor, TYPE_LABEL, useTheme } from './theme';
import { Btn, Chip, DayPicker, Input, Label, Row, Segmented, Sheet, T, TimeInput } from './ui';
import { useStore } from './store';
import { CATEGORIES_IN, CATEGORIES_OUT } from './core/nlu';
import { formatMoney, fromISO, parseMoney, todayISO } from './core/dates';

const REMIND = [
  { label: 'Padrão', v: null },
  { label: '10 min antes', v: 10 },
  { label: '1 h antes', v: 60 },
  { label: '1 dia antes', v: 1440 },
  { label: '3 dias antes', v: 4320 },
];
const KINDS = [
  { label: 'Prova', v: 'prova' },
  { label: 'Entrega', v: 'entrega' },
  { label: 'Estudo', v: 'estudo' },
];

export default function ItemSheet({ id, draft, onSave, onClose }) {
  const c = useTheme();
  const { state, updateItem, removeItem } = useStore();
  const stored = id ? state.items.find((i) => i.id === id) : null;
  const [f, setF] = useState(() => {
    const src = stored || draft || {};
    return { type: 'task', title: '', date: null, time: null, endTime: null, repeat: null, remind: null, note: '', ...src, done: stored ? !!stored.done : !!src.paid, amountText: src.amount ? String(src.amount.toFixed(2)).replace('.', ',') : '' };
  });
  const set = (patch) => setF((old) => ({ ...old, ...patch }));
  if (id && !stored) return null;
  const color = typeColor(c, f.type);
  const classes = state.blocks.filter((b) => b.kind === 'class' && !b.archived);
  const accounts = state.accounts || [];

  const setRepeat = (freq) => {
    if (!freq) return set({ repeat: null });
    const base = f.date || todayISO();
    const d = fromISO(base);
    set({ date: base, repeat: freq === 'daily' ? { freq } : freq === 'weekly' ? { freq, days: [d.getDay()] } : { freq, day: d.getDate() } });
  };

  const save = () => {
    const title = f.title.trim();
    if (!title) return;
    const out = { type: f.type, title, date: f.date, time: f.type === 'money' ? null : f.time, endTime: f.type === 'money' || !f.time ? null : f.endTime, repeat: f.repeat, remind: f.remind, note: f.note, duration: f.duration || null };
    if (f.type === 'study') Object.assign(out, { studyKind: f.studyKind || 'estudo', subjectId: f.subjectId || null });
    if (f.type === 'money') {
      const transfer = f.flow === 'transfer';
      Object.assign(out, { amount: parseMoney(f.amountText), flow: f.flow || 'out', category: transfer ? 'Transferência' : f.category || (f.flow === 'in' ? 'Extra' : 'Outros'), account: transfer ? null : f.account || null, from: transfer ? f.from || null : null, to: transfer ? f.to || null : null });
      if (transfer) f.done = true;
      if (f.done && !out.date) out.date = todayISO();
    }
    if (stored) updateItem(stored.id, { ...out, done: f.type === 'money' ? f.done : stored.done, doneAt: f.type === 'money' ? (f.done ? stored.doneAt || Date.now() : null) : stored.doneAt });
    else onSave({ ...out, paid: f.type === 'money' ? f.done : false });
    onClose();
  };

  const footer = (
    <Row gap={10}>
      {stored ? <Btn label="Apagar" kind="danger" icon="trash" onPress={() => { removeItem(stored.id); onClose(); }} /> : null}
      <Btn label={stored ? 'Salvar' : 'Pronto'} disabled={!f.title.trim()} onPress={save} style={{ flex: 1 }} />
    </Row>
  );

  return (
    <Sheet title={stored ? 'Ajustar' : 'Ajustar antes de guardar'} onClose={onClose} footer={footer}>
      <Segmented value={f.type} onChange={(type) => set({ type, flow: f.flow || 'out', studyKind: f.studyKind || 'estudo' })} options={['task', 'study', 'money'].map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
      <Label>O quê</Label>
      <Input value={f.title} onChangeText={(title) => set({ title })} placeholder="Nome" accessibilityLabel="Nome" aria-label="Nome" v="h" />

      {f.type === 'money' ? (
        <>
          <Label>Valor</Label>
          <Row gap={10}>
            <Input value={f.amountText} onChangeText={(t) => set({ amountText: t.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" placeholder="0,00" accessibilityLabel="Valor" aria-label="Valor" v="h" style={{ width: 130 }} />
            <View style={{ flex: 1 }}>
              <Segmented value={f.flow || 'out'} onChange={(flow) => set({ flow, category: null })} options={[{ value: 'out', label: 'Saiu' }, { value: 'in', label: 'Entrou' }, ...(accounts.length > 1 || f.flow === 'transfer' ? [{ value: 'transfer', label: 'Entre contas' }] : [])]} />
            </View>
          </Row>
          {f.flow === 'transfer' ? (
            <>
              {[['from', 'Saiu de'], ['to', 'Foi para']].map(([k, label]) => (
                <View key={k}>
                  <Label>{label}</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                    <Chip label="Fora do app" on={!f[k]} onPress={() => set({ [k]: null })} />
                    {accounts.map((a) => (
                      <Chip key={a.id} label={a.name} on={f[k] === a.id} color={color} onPress={() => set({ [k]: a.id })} />
                    ))}
                  </ScrollView>
                </View>
              ))}
            </>
          ) : null}
          <View style={{ marginTop: 10, display: f.flow === 'transfer' ? 'none' : 'flex' }}>
            <Segmented value={f.done ? 'done' : 'pending'} onChange={(v) => set({ done: v === 'done' })} options={f.flow === 'in' ? [{ value: 'done', label: 'Já recebi' }, { value: 'pending', label: 'Vou receber' }] : [{ value: 'done', label: 'Já paguei' }, { value: 'pending', label: 'Vou pagar' }]} />
          </View>
          {f.flow !== 'transfer' ? (
            <>
              <Label>Categoria</Label>
              <Row wrap>
                {(f.flow === 'in' ? CATEGORIES_IN : CATEGORIES_OUT).map((cat) => (
                  <Chip key={cat} label={cat} on={f.category === cat} color={color} onPress={() => set({ category: cat })} />
                ))}
              </Row>
              {accounts.length ? (
                <>
                  <Label>Conta</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                    <Chip label="Nenhuma" on={!f.account} onPress={() => set({ account: null })} />
                    {accounts.map((a) => (
                      <Chip key={a.id} label={a.name} on={f.account === a.id} color={color} onPress={() => set({ account: a.id })} />
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {f.type === 'study' ? (
        <>
          <Label>Tipo</Label>
          <Row wrap>
            {KINDS.map((k) => (
              <Chip key={k.v} label={k.label} on={(f.studyKind || 'estudo') === k.v} color={color} onPress={() => set({ studyKind: k.v })} />
            ))}
          </Row>
          {classes.length ? (
            <>
              <Label>Matéria</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                <Chip label="Nenhuma" on={!f.subjectId} onPress={() => set({ subjectId: null })} />
                {classes.map((b) => (
                  <Chip key={b.id} label={b.name} on={f.subjectId === b.id} color={c.blocks[b.color % 8]} onPress={() => set({ subjectId: b.id })} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </>
      ) : null}

      <Label>{f.type === 'money' ? (f.done ? 'Quando foi' : 'Vencimento') : 'Quando'}</Label>
      <DayPicker value={f.date} onChange={(date) => set({ date, repeat: date ? f.repeat : null })} />
      {f.type !== 'money' ? (
        <Row gap={10} style={{ marginTop: 10 }}>
          <TimeInput value={f.time} onChange={(time) => set({ time })} label="Horário" />
          {f.time ? (
            <>
              <T c="soft">até</T>
              <TimeInput value={f.endTime} onChange={(endTime) => set({ endTime })} placeholder="—" label="Horário de fim" />
            </>
          ) : (
            <T v="s" c="faint" style={{ flex: 1 }}>
              Digite a hora (ex.: 1430) ou deixe sem hora.
            </T>
          )}
        </Row>
      ) : null}

      {!(f.type === 'money' && f.done) ? (
        <>
          <Label>Repetir</Label>
          <Row wrap>
            <Chip label="Não" on={!f.repeat} onPress={() => setRepeat(null)} />
            <Chip label="Todo dia" on={!!f.repeat && f.repeat.freq === 'daily'} onPress={() => setRepeat('daily')} />
            <Chip label="Toda semana" on={!!f.repeat && f.repeat.freq === 'weekly'} onPress={() => setRepeat('weekly')} />
            <Chip label="Todo mês" on={!!f.repeat && f.repeat.freq === 'monthly'} onPress={() => setRepeat('monthly')} />
          </Row>
          {f.repeat && f.repeat.freq === 'weekly' ? (
            <Row style={{ marginTop: 8 }} gap={6}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => {
                const on = (f.repeat.days || []).includes(i);
                return <Chip key={i} label={d} on={on} style={{ paddingHorizontal: 0, width: 38, justifyContent: 'center' }} onPress={() => { const days = on ? f.repeat.days.filter((x) => x !== i) : [...(f.repeat.days || []), i].sort(); if (days.length) set({ repeat: { ...f.repeat, days } }); }} />;
              })}
            </Row>
          ) : null}
        </>
      ) : null}

      {f.type !== 'money' && f.date ? (
        <>
          <Label>Me avisar</Label>
          <Row wrap>
            {REMIND.map((r) => (
              <Chip key={r.label} label={r.label} on={(f.remind ?? null) === r.v} onPress={() => set({ remind: r.v })} />
            ))}
          </Row>
          <T v="s" c="faint" style={{ marginTop: 6 }}>
            {f.type === 'study' && f.studyKind !== 'estudo' ? 'Padrão: 7, 3 e 1 dia antes, e no dia.' : 'Padrão: na hora marcada (ou às 9h, se não tiver hora).'}
          </T>
        </>
      ) : null}

      <Label>Anotação</Label>
      <Input value={f.note} onChangeText={(note) => set({ note })} multiline placeholder="Opcional" accessibilityLabel="Anotação" aria-label="Anotação" style={{ minHeight: 60, textAlignVertical: 'top' }} />
      {stored && stored.heard ? (
        <T v="s" c="faint" style={{ marginTop: 14 }}>
          Você disse: “{stored.heard}”
        </T>
      ) : null}
      {f.type === 'money' && parseMoney(f.amountText) ? (
        <T v="s" c="faint" style={{ marginTop: 6 }}>
          {formatMoney(parseMoney(f.amountText))}
        </T>
      ) : null}
    </Sheet>
  );
}
