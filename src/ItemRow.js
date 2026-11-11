// Uma linha de item: igual em todas as telas.
import React from 'react';
import { Pressable, View } from 'react-native';
import { typeColor, useTheme } from './theme';
import { Check, Icon, Row, T } from './ui';
import { useStore } from './store';
import { useNav } from './nav';
import { isLate, moneyText, repeatText } from './core/model';
import { dayLabel } from './core/dates';

export default function ItemRow({ item, showDay = true, compact, plain }) {
  const c = useTheme();
  const { state, toggle, now } = useStore();
  const { open } = useNav();
  const color = typeColor(c, item.type);
  const late = isLate(item, now);
  const subject = item.subjectId ? state.blocks.find((b) => b.id === item.subjectId) : null;
  const meta = [];
  if (showDay && item.date) meta.push(item.time ? `${dayLabel(item.date, now)} · ${item.time}` : dayLabel(item.date, now));
  else if (item.time) meta.push(item.endTime ? `${item.time}–${item.endTime}` : item.time);
  if (item.repeat) meta.push(repeatText(item.repeat));
  if (subject && !item.title.toLowerCase().includes(subject.name.toLowerCase())) meta.push(subject.name);
  if (item.type === 'study' && item.studyKind === 'prova') meta.unshift('Prova');
  if (item.type === 'money' && !item.done) meta.unshift(item.flow === 'in' ? 'A receber' : 'A pagar');
  const doneLabel = item.type === 'money' ? (item.flow === 'in' ? 'Marcar como recebido' : 'Marcar como pago') : 'Concluir';
  return (
    <Row gap={4} style={{ minHeight: compact ? 50 : 58, paddingVertical: 4 }}>
      {item.ghost ? (
        <View style={{ width: 35, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Icon name="repeat" size={20} color={color} />
        </View>
      ) : (
        <Check done={item.done} color={color} onPress={() => toggle(item.id)} label={`${item.done ? 'Reabrir' : doneLabel}: ${item.title}`} />
      )}
      <Pressable onPress={() => open('item', { id: item.id })} accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`} aria-label={`Abrir ${item.title}`} style={{ flex: 1, paddingVertical: 4 }}>
        <T v="m" c={item.done && !plain ? 'faint' : 'text'} numberOfLines={2} style={item.done && !plain ? { textDecorationLine: 'line-through' } : null}>
          {item.title}
        </T>
        {meta.length ? (
          <Row gap={5} style={{ marginTop: 1 }}>
            {item.repeat && !item.ghost ? <Icon name="repeat" size={12} color="faint" /> : null}
            <T v="s" c={late ? 'danger' : 'soft'} numberOfLines={1} style={{ flexShrink: 1 }}>
              {late && item.date ? `Atrasado · ${meta.join(' · ')}` : meta.join(' · ')}
            </T>
          </Row>
        ) : null}
      </Pressable>
      {item.type === 'money' ? (
        <T v="m" c={item.done ? 'soft' : color}>
          {moneyText(item, state.settings.hideMoney)}
        </T>
      ) : (
        <View style={{ width: 4, height: 26, borderRadius: 2, backgroundColor: color, opacity: item.done ? 0.3 : 1 }} />
      )}
    </Row>
  );
}

export const Section = ({ title, count, right, children, tone }) => (
  <View style={{ marginTop: 22 }}>
    <Row style={{ marginBottom: 4 }}>
      <T v="l" c={tone || 'faint'} style={{ flex: 1 }}>
        {title}
        {count ? `  ${count}` : ''}
      </T>
      {right}
    </Row>
    {children}
  </View>
);
