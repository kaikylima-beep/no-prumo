import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { todayISO, shortBR, relativeLabel, diffDays, weekdayName } from '../utils';
import { pendingSlot, nextSlot, slotsOn } from '../recurrence';
import { dueToday } from '../greeting';
import { Screen, Row, Check, Remove, Empty, Pill, Hero, heroText, s } from '../ui';
import { colors, look } from '../theme';
import RepeatRow from '../components/RepeatRow';
import SwipeRow from '../components/SwipeRow';

// Quando o item acontece: data e hora (lembretes repetidos: a ocorrência pendente ou a próxima)
function whenKey(item, now) {
  if (item.repeat) {
    const slot = pendingSlot(item, now) || nextSlot(item, now);
    return slot ? `${slot.date} ${slot.time}` : 'z';
  }
  if (item.date) return `${item.date} ${item.time || '23:59'}`;
  return 'z';
}

export function sortByWhen(a, b) {
  const now = new Date();
  const ka = whenKey(a, now);
  const kb = whenKey(b, now);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return b.createdAt - a.createdAt;
}

// Em que grupo a tarefa aparece: hoje (inclui atrasadas), semana (próximos 7 dias), depois ou sem data
export function bucketOf(item, today, now = new Date()) {
  if (item.repeat) {
    if (slotsOn(item, today).length) return 'today';
    const n = nextSlot(item, now);
    if (!n) return 'later';
    return diffDays(today, n.date) <= 7 ? 'week' : 'later';
  }
  if (!item.date) return 'nodate';
  const d = diffDays(today, item.date);
  if (d <= 0) return 'today';
  if (d <= 7) return 'week';
  return 'later';
}

// "quinta-feira" → "Quinta"
const dayName = (iso) => {
  const w = weekdayName(iso).replace('-feira', '');
  return w.charAt(0).toUpperCase() + w.slice(1);
};

const BUCKETS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'later', label: 'Mais para frente' },
  { key: 'nodate', label: 'Sem data' },
];

// "Concluídas" com o botão de limpar (com Desfazer)
export function DoneSection({ kind, label, items, renderRow }) {
  const { clearDone } = useData();
  const { showToast } = useUI();
  if (!items.length) return null;
  const clear = async () => {
    const undo = await clearDone(kind);
    showToast(items.length === 1 ? '1 item apagado' : `${items.length} itens apagados`, 'Desfazer', undo);
  };
  return (
    <View style={{ marginTop: 28 }}>
      <View style={st.doneHead}>
        <Text style={s.section}>{label}</Text>
        <Pill label="Limpar" onPress={clear} />
      </View>
      {items.map(renderRow)}
    </View>
  );
}

export default function TasksScreen() {
  const { tasks, toggleDone, checkSlot, palettes, tone, settings, markSwipeHint } = useData();
  const { openEditor, removeWithUndo, showToast } = useUI();
  const pal = palettes.task;
  const today = todayISO();
  const now = new Date();

  const pending = tasks.filter((t) => !t.done || t.repeat).sort(sortByWhen);
  const done = tasks.filter((t) => t.done && !t.repeat);
  const groups = {};
  for (const t of pending) {
    const b = bucketOf(t, today, now);
    if (!groups[b]) groups[b] = [];
    groups[b].push(t);
  }

  // destaque do topo: quantas para hoje e a próxima com horário
  // 1.12.3: só o que ainda falta hoje (o mesmo número da saudação de entrada)
  const due = new Set(dueToday(tasks, now).map((t) => t.id));
  const todayList = (groups.today || []).filter((t) => due.has(t.id));
  const doneToday = done.filter((t) => t.date === today).length;
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextTimed = todayList.find((t) => !t.repeat && t.time && t.date === today && t.time >= nowHM);
  const nextAny = nextTimed || todayList[0];
  const ht = heroText('task');
  const hour = now.getHours();
  const hello = `${hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}${settings.profile.name ? `, ${settings.profile.name.trim().split(/\s+/)[0]}` : ''}`;
  const hero = !tasks.length ? null : look.mode === 'simple' ? (
    <Hero area="task" style={{ marginBottom: 6 }}>
      <Text style={[st.heroLabel, { color: ht.label }]}>Agora</Text>
      <Text style={[st.heroTitle, { color: ht.ink }]} numberOfLines={2}>
        {nextAny ? nextAny.title : 'Nada para hoje'}
      </Text>
      <Text style={[st.heroSub, { color: ht.soft }]}>
        {nextAny ? `${nextTimed ? `às ${nextTimed.time} · ` : ''}${todayList.length} para hoje` : 'Aproveite o dia'}
      </Text>
    </Hero>
  ) : (
    <Hero area="task" style={st.heroRow}>
      <View style={{ flex: 1 }}>
        <Text style={[st.heroCount, { color: ht.ink }]}>{todayList.length}</Text>
        <Text style={[st.heroSub, { color: ht.soft }]}>
          para fazer hoje{doneToday ? ` · ${doneToday} já ${doneToday === 1 ? 'feita' : 'feitas'}` : ''}
        </Text>
      </View>
      {nextTimed ? (
        <View style={[st.nextPill, { backgroundColor: look.dark ? colors.bg : '#FFFFFF' }]}>
          <Text style={[st.nextText, { color: palettes.task.main }]}>Próxima: {nextTimed.time.replace(':00', 'h')}</Text>
        </View>
      ) : null}
    </Hero>
  );

  const complete = (t) => {
    if (t.repeat) {
      const r = checkSlot('task', t);
      if (r) showToast(`${t.title}: ${r.label} feito`, 'Desfazer', r.undo);
    } else {
      toggleDone('task', t.id);
      showToast(`"${t.title}" concluída`, 'Desfazer', () => toggleDone('task', t.id));
    }
  };

  const oneOff = (t) => {
    const overdue = !t.done && t.date && t.date < today;
    const d = t.date ? diffDays(today, t.date) : null;
    // na Semana mostra o dia da semana ("Quinta · 14:00"), que é como a gente pensa
    const when = !t.date
      ? null
      : d === 0 || d === 1
      ? `${d === 0 ? 'Hoje' : 'Amanhã'}${t.time ? ` · ${t.time}` : ''}`
      : d > 1 && d <= 7
      ? `${dayName(t.date)} · ${shortBR(t.date)}${t.time ? ` · ${t.time}` : ''}`
      : `${shortBR(t.date)}${t.time ? ` · ${t.time}` : ''} · ${relativeLabel(t.date, today)}`;
    return (
      <Row key={t.id} onPress={() => openEditor('task', t)}>
        <Check done={t.done} color={pal.main} onPress={() => toggleDone('task', t.id)} />
        <View style={{ flex: 1 }}>
          <Text style={[s.itemTitle, t.done && s.itemTitleDone]}>{t.title}</Text>
          {when && !t.done ? (
            <Text style={[s.meta, overdue && { color: tone.warn, fontWeight: '700' }]}>{overdue ? `Atrasada · ${when}` : when}</Text>
          ) : null}
        </View>
        <Remove onPress={() => removeWithUndo('task', t)} />
      </Row>
    );
  };

  const renderRow = (t) => (
    <SwipeRow
      key={t.id}
      color={pal.main}
      onComplete={t.done ? undefined : () => complete(t)}
      onDelete={() => removeWithUndo('task', t)}
      onSwipeStart={markSwipeHint}
    >
      {t.repeat ? <RepeatRow kind="task" item={t} /> : oneOff(t)}
    </SwipeRow>
  );

  return (
    <Screen title="Tarefas" subtitle={hello} accent={pal.main} header={hero}>
      {tasks.length === 0 ? (
        <Empty
          text={
            settings.used.task
              ? 'Nenhuma tarefa.'
              : 'Nada por aqui ainda.\nToque no microfone e diga o que precisa fazer, como "lavar o carro sábado" ou "tomar remédio todo dia às 8h".'
          }
        />
      ) : (
        <View>
          {!settings.swipeHintSeen && pending.length ? (
            <View style={[st.hint, { backgroundColor: pal.tint }]}>
              <Text style={st.hintText}>
                Arraste uma tarefa para a <Text style={{ fontWeight: '800' }}>direita</Text> para concluir, ou para a{' '}
                <Text style={{ fontWeight: '800' }}>esquerda</Text> para excluir.
              </Text>
            </View>
          ) : null}
          {BUCKETS.map(({ key, label }) => {
            const list = groups[key];
            if (key === 'today' && !list) {
              return (
                <View key={key}>
                  <SectionHead label="Hoje" color={pal.main} />
                  <Text style={st.clear}>Nada para hoje. 🎉</Text>
                </View>
              );
            }
            if (!list) return null;
            return (
              <View key={key}>
                <SectionHead label={label} count={list.length} color={pal.main} />
                {list.map(renderRow)}
              </View>
            );
          })}
          {/* no visual simples o que já foi feito some da tela */}
          {look.mode !== 'simple' ? <DoneSection kind="task" label="Concluídas" items={done} renderRow={renderRow} /> : null}
        </View>
      )}
    </Screen>
  );
}

function SectionHead({ label, count, color }) {
  return (
    <View style={st.head}>
      <Text style={[s.section, { marginTop: 0, marginBottom: 0 }]}>{label}</Text>
      {count ? (
        <View style={[st.count, { borderColor: color }]}>
          <Text style={[st.countText, { color }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  heroCount: { fontSize: 40, fontWeight: '700', lineHeight: 44 },
  heroLabel: { fontSize: 13, fontWeight: '600' },
  heroTitle: { fontSize: 20, fontWeight: '500', marginTop: 4 },
  heroSub: { fontSize: 15, marginTop: 4 },
  nextPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  nextText: { fontSize: 14, fontWeight: '600' },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  head: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 4 },
  count: { marginLeft: 8, borderWidth: 1.5, borderRadius: 99, minWidth: 22, paddingHorizontal: 6, alignItems: 'center' },
  countText: { fontSize: 12, fontWeight: '800' },
  clear: { fontSize: 14, color: colors.mute, paddingVertical: 10 },
  hint: { borderRadius: 12, padding: 12, marginTop: 8 },
  hintText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
});
