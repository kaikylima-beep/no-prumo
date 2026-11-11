// Linha de um lembrete que se repete (tarefa ou estudo):
//   ○ Remédio diabetes
//     ↻ Todo dia · 08:00 e 20:00
//     ✓ 08:00 · próximo: hoje 20:00
import React from 'react';
import { View } from 'react-native';
import { Text } from '../AppText';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { describe, timesOf, pendingSlot, nextSlot, doneToday, slotLabel } from '../recurrence';
import { Row, Check, Remove, s } from '../ui';

export default function RepeatRow({ kind, item }) {
  const { palettes, tone, checkSlot } = useData();
  const { openEditor, removeWithUndo, showToast } = useUI();
  const pal = palettes[kind];
  const now = new Date();
  const pending = pendingSlot(item, now);
  const next = nextSlot(item, now);
  const doneNow = doneToday(item, now);

  const check = () => {
    const r = checkSlot(kind, item);
    if (r) showToast(`${item.title}: ${r.label} feito`, 'Desfazer', r.undo);
  };

  return (
    <Row onPress={() => openEditor(kind, item)}>
      <Check done={false} color={pal.main} onPress={check} />
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{item.title}</Text>
        <Text style={s.meta}>↻ {describe(item.repeat, timesOf(item))}</Text>
        <Text style={[s.meta, { marginTop: 1 }]}>
          {doneNow.length ? `✓ ${doneNow.join(', ')}` : ''}
          {doneNow.length && (pending || next) ? ' · ' : ''}
          {pending ? (
            <Text style={{ color: tone.warn, fontWeight: '700' }}>{pending.time} pendente</Text>
          ) : next ? (
            `próximo: ${slotLabel(next, now)}`
          ) : (
            ''
          )}
        </Text>
      </View>
      <Remove onPress={() => removeWithUndo(kind, item)} />
    </Row>
  );
}
