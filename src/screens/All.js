// Tudo: a lista completa, do mais urgente para o mais distante.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Chip, Empty, Icon, Row, T, useScreenStyles } from '../ui';
import { useStore } from '../store';
import ItemRow, { Section } from '../ItemRow';
import { groupItems } from '../core/model';

const FILTERS = [
  { v: null, label: 'Tudo' },
  { v: 'task', label: 'Tarefas', color: 'task' },
  { v: 'study', label: 'Estudos', color: 'study' },
  { v: 'money', label: 'Dinheiro', color: 'money' },
];
const GROUPS = [
  ['late', 'Atrasado', 'danger'],
  ['today', 'Hoje'],
  ['tomorrow', 'Amanhã'],
  ['week', 'Próximos 7 dias'],
  ['later', 'Mais para frente'],
  ['someday', 'Sem data'],
];

export default function All() {
  const s = useScreenStyles();
  const { state, now } = useStore();
  const [filter, setFilter] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const g = useMemo(() => groupItems(state.items, now, filter), [state.items, now, filter]);
  const open = GROUPS.reduce((n, [k]) => n + g[k].length, 0);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <T v="hero" style={{ paddingTop: 14 }}>
        Tudo
      </T>
      <T c="soft">{open ? `${open} em aberto` : 'Nada em aberto'}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 14 }}>
        {FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} on={filter === f.v} color={f.color} onPress={() => setFilter(f.v)} />
        ))}
      </ScrollView>
      {GROUPS.map(([k, title, tone]) =>
        g[k].length ? (
          <Section key={k} title={title} count={g[k].length} tone={tone}>
            {g[k].map((it) => (
              <ItemRow key={it.id} item={it} showDay={k !== 'today' && k !== 'tomorrow'} />
            ))}
          </Section>
        ) : null
      )}
      {!open ? <Empty icon="check" title="Tudo em dia" text="O que você falar ou escrever aparece aqui, separado por quando precisa acontecer." /> : null}
      {g.done.length ? (
        <>
          <Pressable onPress={() => setShowDone(!showDone)} accessibilityRole="button" accessibilityLabel="Mostrar feitos" aria-label="Mostrar feitos" style={{ marginTop: 26, minHeight: 44, justifyContent: 'center' }}>
            <Row>
              <T v="l" c="faint" style={{ flex: 1 }}>
                Feitos  {g.done.length}
              </T>
              <Icon name={showDone ? 'down' : 'next'} size={16} color="faint" />
            </Row>
          </Pressable>
          {showDone ? g.done.map((it) => <ItemRow key={it.id} item={it} compact />) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
