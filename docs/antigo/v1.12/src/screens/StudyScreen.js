import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, subjectColor } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { todayISO, shortBR, weekdayName, diffDays, fromISO } from '../utils';
import { Screen, Row, Check, Remove, Empty, Segmented, s } from '../ui';
import { sortByWhen, DoneSection } from './TasksScreen';
import RepeatRow from '../components/RepeatRow';
import SwipeRow from '../components/SwipeRow';
import SubjectsTab, { SubjectTag } from '../components/Subjects';

const dayName = (iso) => {
  const w = weekdayName(iso).replace('-feira', '');
  return w.charAt(0).toUpperCase() + w.slice(1);
};

// Quanto do caminho até a prova já passou (do dia em que foi anotada até o dia da prova)
function progressTo(item, now) {
  const end = fromISO(item.date).getTime();
  const start = Math.min(item.createdAt || now.getTime(), end - 86400000);
  return Math.max(0.04, Math.min(1, (now.getTime() - start) / (end - start)));
}

export default function StudyScreen() {
  const { study, subjects, toggleDone, palettes, tone, settings, simple } = useData();
  const { openEditor, removeWithUndo, showToast } = useUI();
  const pal = palettes.study;
  const [tab, setTab] = useState('itens');
  const subjectOf = (t) => (t.subjectId ? subjects.find((x) => x.id === t.subjectId) : null);
  const today = todayISO();
  const now = new Date();

  const open = study.filter((t) => !t.done || t.repeat).sort(sortByWhen);
  const done = study.filter((t) => t.done && !t.repeat);
  const upcoming = open.filter((t) => !t.repeat && t.date && t.date >= today);
  const overdue = open.filter((t) => !t.repeat && t.date && t.date < today);
  const routines = open.filter((t) => t.repeat);
  const noDate = open.filter((t) => !t.repeat && !t.date);

  const complete = (t) => {
    toggleDone('study', t.id);
    showToast(`"${t.title}" concluído`, 'Desfazer', () => toggleDone('study', t.id));
  };

  const swipe = (t, child) => (
    <SwipeRow key={t.id} color={pal.main} onComplete={t.done ? undefined : () => complete(t)} onDelete={() => removeWithUndo('study', t)}>
      {child}
    </SwipeRow>
  );

  // Cartão de contagem regressiva
  const countdown = (t) => {
    const days = diffDays(today, t.date);
    const urgent = days <= 3;
    const big = days === 0 ? 'HOJE' : days === 1 ? '1' : String(days);
    const unit = days === 0 ? '' : days === 1 ? 'dia' : 'dias';
    const subject = subjectOf(t);
    // no Avançado o contador leva a cor da matéria; no Simples ela aparece só na etiqueta
    const sc = subject && !simple ? subjectColor(subject.color) : null;
    const main = sc ? sc.main : pal.main;
    const tint = sc ? sc.tint : pal.tint;
    const accent = sc ? sc.main : urgent ? pal.main : days <= 7 ? pal.second : pal.third;
    const p = progressTo(t, now);
    return swipe(
      t,
      <Pressable
        onPress={() => openEditor('study', t)}
        style={({ pressed }) => [st.card, urgent && { borderColor: main }, pressed && { opacity: 0.7 }]}
        accessibilityLabel={`${t.title}, ${days === 0 ? 'hoje' : `faltam ${days} ${unit}`}`}
      >
        <View style={[st.counter, { backgroundColor: urgent ? main : tint }]}>
          <Text style={[st.counterNum, { color: urgent ? colors.onAccent : accent }, days === 0 && { fontSize: 18 }]}>{big}</Text>
          {unit ? <Text style={[st.counterUnit, { color: urgent ? colors.onAccent : accent }]}>{unit}</Text> : null}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={st.cardTitle} numberOfLines={2}>
            {t.title}
          </Text>
          <Text style={s.meta}>
            {dayName(t.date)}, {shortBR(t.date)}
            {t.time ? ` · ${t.time}` : ''}
          </Text>
          <SubjectTag subject={subject} />
          <View style={st.track}>
            <View style={[st.fill, { width: `${Math.round(p * 100)}%`, backgroundColor: simple ? colors.ink : accent }]} />
          </View>
        </View>
        <Check done={false} color={pal.main} onPress={() => complete(t)} />
      </Pressable>
    );
  };

  const plainRow = (t) => {
    const late = !t.done && t.date && t.date < today;
    return swipe(
      t,
      <Row onPress={() => openEditor('study', t)}>
        <Check done={t.done} color={pal.main} onPress={() => toggleDone('study', t.id)} />
        <View style={{ flex: 1 }}>
          <Text style={[s.itemTitle, t.done && s.itemTitleDone]}>{t.title}</Text>
          {t.date ? (
            <Text style={[s.meta, late && { color: tone.warn, fontWeight: '700' }]}>
              {late ? `Passou · ${shortBR(t.date)}` : `${dayName(t.date)}, ${shortBR(t.date)}`}
              {t.time ? ` · ${t.time}` : ''}
            </Text>
          ) : null}
          <SubjectTag subject={subjectOf(t)} />
        </View>
        <Remove onPress={() => removeWithUndo('study', t)} />
      </Row>
    );
  };

  const next = upcoming[0];

  return (
    <Screen title="Estudos" accent={pal.main}>
      <Segmented
        options={[
          { key: 'itens', label: 'Itens' },
          { key: 'materias', label: 'Matérias' },
        ]}
        value={tab}
        onChange={setTab}
        color={pal.main}
      />
      {tab === 'materias' ? (
        <SubjectsTab />
      ) : study.length === 0 ? (
        <Empty
          text={
            settings.used.study
              ? 'Nenhuma prova ou entrega.'
              : 'Nenhuma prova ou entrega ainda.\nDiga, por exemplo: "prova de circuitos dia 27". O app avisa sozinho conforme a importância de Estudos, ou você pede "me lembrar 4 dias antes".'
          }
        />
      ) : (
        <View>
          {next ? (
            <Text style={st.lead}>
              {diffDays(today, next.date) === 0
                ? `Hoje: ${next.title}.`
                : `Próxima: ${next.title}, em ${diffDays(today, next.date)} ${diffDays(today, next.date) === 1 ? 'dia' : 'dias'}.`}
            </Text>
          ) : null}
          {overdue.length ? (
            <View>
              <Text style={[s.section, st.sec]}>Já passou</Text>
              {overdue.map(plainRow)}
            </View>
          ) : null}
          {upcoming.length ? (
            <View>
              <Text style={[s.section, st.sec]}>Contagem regressiva</Text>
              {upcoming.map(countdown)}
            </View>
          ) : null}
          {routines.length ? (
            <View>
              <Text style={[s.section, st.sec]}>Rotina de estudos</Text>
              {routines.map((t) => <RepeatRow key={t.id} kind="study" item={t} />)}
            </View>
          ) : null}
          {noDate.length ? (
            <View>
              <Text style={[s.section, st.sec]}>Sem data</Text>
              {noDate.map(plainRow)}
            </View>
          ) : null}
          <DoneSection kind="study" label="Concluídos" items={done} renderRow={plainRow} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, color: colors.ink, marginTop: 4, marginBottom: 4, lineHeight: 21 },
  sec: { marginTop: 22, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.bg,
  },
  counter: { width: 62, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  counterNum: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  counterUnit: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 8, marginRight: 10, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
