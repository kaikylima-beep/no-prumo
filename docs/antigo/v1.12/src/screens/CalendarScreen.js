import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, AREA_LABEL } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { pad, MONTHS, WEEK_SHORT, todayISO, showMoney as formatMoney, weekdayName, daysInMonth } from '../utils';
import { Screen, Row, Check, Empty, Dot, Pill, s } from '../ui';
import { sortByWhen } from './TasksScreen';
import { slotsOn, slotKey } from '../recurrence';
import { holidaysOfMonth, HOLIDAY_LABEL } from '../holidays';

export default function CalendarScreen() {
  const { tasks, study, finance, palettes, areaOrder, toggleDone, togglePaid, setSlot, settings } = useData();
  const { openEditor } = useUI();
  const today = todayISO();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  // filtro por área (chips no topo). Vazio = todas.
  const [only, setOnly] = useState([]);
  const shown = (a) => !only.length || only.includes(a);
  const toggleArea = (a) =>
    setOnly((prev) => {
      const next = prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a];
      return next.length === 3 ? [] : next;
    });

  // itens com data, agrupados por dia
  const byDay = useMemo(() => {
    const map = {};
    const add = (kind, it) => {
      if (!it.date || it.repeat) return; // lembretes repetidos entram por dia, abaixo
      (map[it.date] = map[it.date] || []).push({ kind, it });
    };
    tasks.forEach((t) => add('task', t));
    study.forEach((t) => add('study', t));
    // de finanças, a agenda mostra só o que ainda vai cair (a pagar e a receber);
    // o que já foi pago ou veio do extrato fica em Finanças
    finance.forEach((t) => t.status === 'pending' && add('finance', t));
    return map;
  }, [tasks, study, finance]);

  const uf = settings.profile.state;
  const holidays = useMemo(() => holidaysOfMonth(ym, uf), [ym, uf]);
  const selectedHolidays = holidaysOfMonth(selected.slice(0, 7), uf)[selected] || [];

  const [y, m] = ym.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const total = daysInMonth(ym);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(`${ym}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);

  const shift = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const goToday = () => {
    setYm(today.slice(0, 7));
    setSelected(today);
  };

  // lembretes que se repetem: uma linha por horário em cada dia
  const repeating = useMemo(
    () => [...tasks.filter((t) => t.repeat).map((it) => ({ kind: 'task', it })), ...study.filter((t) => t.repeat).map((it) => ({ kind: 'study', it }))],
    [tasks, study]
  );
  const repeatOn = (iso) =>
    repeating.flatMap(({ kind, it }) => slotsOn(it, iso).map((time) => ({ kind, it, time, key: slotKey(iso, time) })));

  const dayItems = byDay[selected] || [];
  const daySlots = repeatOn(selected);
  const grouped = areaOrder
    .map((area) => ({
      area,
      list: dayItems
        .filter((x) => x.kind === area)
        .map((x) => x.it)
        .sort(sortByWhen),
      slots: daySlots.filter((x) => x.kind === area).sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .filter((g) => shown(g.area) && (g.list.length || g.slots.length));

  const [sy, sm, sd] = selected.split('-');
  const header = (
    <View>
      <View style={st.chips}>
        <FilterChip label="Tudo" active={!only.length} onPress={() => setOnly([])} />
        {areaOrder.map((a) => (
          <FilterChip key={a} label={AREA_LABEL[a]} pal={palettes[a]} active={only.includes(a)} onPress={() => toggleArea(a)} />
        ))}
      </View>
      <View style={st.monthRow}>
        <Pressable onPress={() => shift(-1)} hitSlop={14} accessibilityLabel="Mês anterior">
          <Text style={st.arrow}>‹</Text>
        </Pressable>
        <Text style={st.month}>
          {MONTHS[m - 1]} {y}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={14} accessibilityLabel="Próximo mês">
          <Text style={st.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={st.weekRow}>
        {WEEK_SHORT.map((w, i) => (
          <Text key={i} style={st.weekDay}>
            {w}
          </Text>
        ))}
      </View>
      <View style={st.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={i} style={st.cell} />;
          const list = byDay[iso] || [];
          // pontos só para eventos únicos (provas, contas, tarefas com data). Rotinas
          // que se repetem aparecem na lista do dia, sem encher o calendário de pontos.
          const kinds = areaOrder.filter((a) => shown(a) && list.some((x) => x.kind === a && !(x.it.done || x.it.status === 'paid')));
          const isSel = iso === selected;
          const isToday = iso === today;
          return (
            <Pressable key={i} style={st.cell} onPress={() => setSelected(iso)} accessibilityLabel={`Dia ${Number(iso.slice(8))}${holidays[iso] ? `, ${holidays[iso].map((h) => h.name).join(' e ')}` : ''}`}>
              <View style={[st.dayCircle, isToday && st.todayCircle, isSel && st.selCircle]}>
                <Text style={[st.dayNum, isSel && { color: colors.onAccent }]}>{Number(iso.slice(8))}</Text>
              </View>
              <View style={[st.holidayMark, holidays[iso] && { backgroundColor: colors.mute }]} />
              <View style={st.dots}>
                {kinds.map((k) => (
                  <Dot key={k} color={palettes[k].main} size={5} style={{ marginHorizontal: 1.5 }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={st.legend}>
        Traço embaixo do dia: feriado ou data do estado.{uf ? '' : ' Escolha seu estado em Ajustes para ver também os estaduais.'}
      </Text>

      <View style={st.dayHead}>
        <Text style={st.dayTitle}>
          {selected === today ? 'Hoje' : `${sd}/${sm}`} <Text style={st.dayWeek}>· {weekdayName(selected)}</Text>
        </Text>
        {selected !== today ? <Pill label="Hoje" onPress={goToday} /> : null}
      </View>
      {selectedHolidays.map((h) => (
        <Text key={h.name} style={st.holiday}>
          <Text style={st.holidayName}>{h.name}</Text> · {HOLIDAY_LABEL[h.type]}
        </Text>
      ))}
    </View>
  );

  return (
    <Screen title="Agenda" header={header}>
      {grouped.length === 0 ? (
        <Empty text={only.length ? `Nada de ${only.map((a) => AREA_LABEL[a]).join(' ou ')} neste dia.` : 'Nada marcado para este dia.'} />
      ) : (
        grouped.map(({ area, list, slots }) => {
          const pal = palettes[area];
          return (
            <View key={area} style={{ marginBottom: 14 }}>
              <View style={st.groupHead}>
                <Dot color={pal.main} size={8} style={{ marginRight: 8 }} />
                <Text style={s.section}>{AREA_LABEL[area]}</Text>
              </View>
              {list.map((it) =>
                area === 'finance' ? (
                  <Row key={it.id} onPress={() => openEditor('finance', it)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitle}>{it.title}</Text>
                      <Text style={s.meta}>
                        {it.type === 'transfer'
                          ? `↔ ${formatMoney(it.amount)} · transferência`
                          : `${it.type === 'in' ? '+' : '−'} ${formatMoney(it.amount)} · ${it.status === 'pending' ? (it.type === 'in' ? 'a receber' : 'a pagar') : it.type === 'in' ? 'recebido' : 'pago'}`}
                      </Text>
                    </View>
                    {it.status === 'pending' ? (
                      <Pill label={it.type === 'in' ? 'Recebi' : 'Paguei'} color={pal.main} onPress={() => togglePaid(it.id)} />
                    ) : null}
                  </Row>
                ) : (
                  <Row key={it.id} onPress={() => openEditor(area, it)}>
                    <Check done={it.done} color={pal.main} onPress={() => toggleDone(area, it.id)} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemTitle, it.done && s.itemTitleDone]}>{it.title}</Text>
                      {it.time ? <Text style={s.meta}>{it.time}</Text> : null}
                    </View>
                  </Row>
                )
              )}
              {slots.map(({ it, time, key }) => {
                const done = (it.doneSlots || []).includes(key);
                return (
                  <Row key={`${it.id}-${key}`} onPress={() => openEditor(area, it)}>
                    <Check done={done} color={pal.main} onPress={() => setSlot(area, it.id, key, !done)} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemTitle, done && s.itemTitleDone]}>{it.title}</Text>
                      <Text style={s.meta}>↻ {time}</Text>
                    </View>
                  </Row>
                );
              })}
            </View>
          );
        })
      )}
    </Screen>
  );
}

// Chip de filtro: com a cor da área quando ligado
function FilterChip({ label, pal, active, onPress }) {
  const main = pal ? pal.main : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={[st.chip, active && { borderColor: main, backgroundColor: pal ? pal.tint : colors.soft }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {pal ? <Dot color={main} size={8} style={{ marginRight: 6 }} /> : null}
      <Text style={[st.chipText, active && { color: main, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  arrow: { fontSize: 30, color: colors.ink, paddingHorizontal: 4, marginTop: -4 },
  month: { fontSize: 16, fontWeight: '700', color: colors.ink, marginHorizontal: 12 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.mute },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, height: 54 },
  holidayMark: { width: 16, height: 2, borderRadius: 1, marginTop: 2 },
  legend: { fontSize: 12, color: colors.mute, marginTop: 6, lineHeight: 17 },
  holiday: { fontSize: 14, color: colors.mute, marginBottom: 6, lineHeight: 20 },
  holidayName: { fontWeight: '700', color: colors.ink },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { borderWidth: 1.5, borderColor: colors.ink },
  selCircle: { backgroundColor: colors.ink, borderWidth: 0 },
  dayNum: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  dots: { flexDirection: 'row', height: 7, marginTop: 2 },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  dayTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  dayWeek: { fontSize: 15, fontWeight: '500', color: colors.mute },
  groupHead: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
});
