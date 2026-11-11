// Estudos: provas e entregas que vêm aí, matérias (com notas e faltas) e a rotina fixa.
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../theme';
import { Btn, Card, Empty, Row, T, useScreenStyles } from '../ui';
import { useStore } from '../store';
import { useNav } from '../nav';
import ItemRow, { Section } from '../ItemRow';
import { absencesOf, asSubject, gradeOf, nextClass } from '../core/model';
import { fmtGrade, gradesToAsk } from '../legacy/academic';
import { dayLabel, diffDays, todayISO } from '../core/dates';

const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

export default function Study() {
  const c = useTheme();
  const s = useScreenStyles();
  const { state, now, updateItem } = useStore();
  const ask = useMemo(() => gradesToAsk(state.items.filter((i) => i.type === 'study'), state.blocks.filter((b) => b.kind === 'class').map(asSubject), todayISO(now)).slice(0, 2), [state.items, state.blocks]);
  const { open } = useNav();
  const today = todayISO(now);
  const upcoming = useMemo(() => state.items.filter((i) => i.type === 'study' && !i.done && i.date && i.date >= today && i.studyKind !== 'estudo').sort((a, b) => a.date.localeCompare(b.date)), [state.items, today]);
  const sessions = useMemo(() => state.items.filter((i) => i.type === 'study' && !i.done && (i.studyKind === 'estudo' || !i.date || i.date < today)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9')), [state.items, today]);
  const classes = state.blocks.filter((b) => b.kind === 'class' && !b.archived);
  const archived = state.blocks.filter((b) => b.archived && b.kind === 'class');
  const next = upcoming[0];
  const left = next ? diffDays(today, next.date) : null;


  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <T v="hero" style={{ paddingTop: 14 }}>
        Estudos
      </T>
      {next ? (
        <Card style={{ marginTop: 14, backgroundColor: c.studyBg }} onPress={() => open('item', { id: next.id })}>
          <T v="l" c="study">
            {next.studyKind === 'prova' ? 'Próxima prova' : 'Próxima entrega'}
          </T>
          <Row style={{ marginTop: 4 }} gap={14}>
            <View style={{ alignItems: 'center', minWidth: 54 }}>
              <T v="hero" c="study">
                {left === 0 ? 'hoje' : left}
              </T>
              {left ? (
                <T v="s" c="study">
                  {left === 1 ? 'dia' : 'dias'}
                </T>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <T v="h" numberOfLines={2}>
                {next.title}
              </T>
              <T v="s" c="soft">
                {dayLabel(next.date, now)}
                {next.time ? ` · ${next.time}` : ''}
              </T>
            </View>
          </Row>
        </Card>
      ) : null}

      {upcoming.length > 1 ? (
        <Section title="Depois dessa" count={upcoming.length - 1}>
          {upcoming.slice(1, 8).map((it) => (
            <ItemRow key={it.id} item={it} />
          ))}
        </Section>
      ) : null}

      {sessions.length ? (
        <Section title="Para estudar" count={sessions.length}>
          {sessions.slice(0, 8).map((it) => (
            <ItemRow key={it.id} item={it} />
          ))}
        </Section>
      ) : null}

      {ask.length ? (
        <Section title="Já saiu a nota?">
          {ask.map((t) => (
            <Card key={t.id} style={{ marginTop: 8, gap: 8 }}>
              <T v="m">{t.title}</T>
              <T v="s" c="soft">
                {dayLabel(t.date, now)}
                {state.blocks.find((x) => x.id === t.subjectId) ? ` · ${state.blocks.find((x) => x.id === t.subjectId).name}` : ''}
              </T>
              <Row wrap>
                <Btn small label="Lançar nota" onPress={() => open('grade', { studyId: t.id })} />
                <Btn small kind="ghost" label="Ainda não saiu · não perguntar de novo" onPress={() => updateItem(t.id, { gradeAsked: true })} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Matérias" right={<Btn small kind="soft" icon="plus" label="Matéria" onPress={() => open('block', { kind: 'class' })} />}>
        {classes.length ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            {classes.map((b) => {
              const g = gradeOf(b, state.settings);
              const a = absencesOf(b, state.settings);
              const nc = nextClass(b, now);
              return (
                <Pressable key={b.id} onPress={() => open('block', { id: b.id })} accessibilityRole="button" accessibilityLabel={`Abrir ${b.name}`} aria-label={`Abrir ${b.name}`} style={{ backgroundColor: c.card, borderRadius: 16, padding: 14, borderLeftWidth: 5, borderLeftColor: c.blocks[b.color % 8] }}>
                  <T v="h">{b.name}</T>
                  <T v="s" c="soft">
                    {nc ? `Próxima aula: ${dayLabel(nc.date, now).toLowerCase()} às ${nc.start}${b.room ? ` · ${b.room}` : ''}` : 'Sem horário cadastrado'}
                  </T>
                  <Row gap={18} style={{ marginTop: 10 }}>
                    <View>
                      <T v="num" c={a.status === 'over' ? 'danger' : a.status === 'near' ? 'warn' : 'text'}>
                        {a.count}
                        {a.limit !== null ? <T c="faint">{` de ${a.limit}`}</T> : null}
                      </T>
                      <T v="s" c="soft">
                        {a.limit !== null ? (a.left >= 0 ? `faltas · pode mais ${a.left}` : 'faltas · passou') : a.count === 1 ? 'falta' : 'faltas'}
                      </T>
                    </View>
                    <View>
                      <T v="num" c={g.average === null ? 'faint' : g.status === 'failed' || g.status === 'impossible' ? 'danger' : g.status === 'needs' ? 'warn' : 'money'}>
                        {g.average === null ? (g.graded ? `${g.graded}/${g.total}` : '—') : fmtGrade(g.average)}
                      </T>
                      <T v="s" c="soft">
                        {g.average !== null ? 'média' : g.graded ? 'notas lançadas' : 'sem notas'}
                      </T>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Empty icon="book" title="Nenhuma matéria ainda" text="Fale “aula de cálculo segunda e quarta das 10 às 12” e eu monto a matéria com o horário." />
        )}
      </Section>

      {archived.length ? (
        <Section title="Arquivadas" count={archived.length}>
          {archived.map((b) => (
            <Pressable key={b.id} onPress={() => open('block', { id: b.id })} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T c="soft">{b.name}</T>
            </Pressable>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
