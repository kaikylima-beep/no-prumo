// Hoje: o dia inteiro numa tela só. Aulas, compromissos, tarefas, provas e contas, na ordem.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../theme';
import { Btn, Card, Empty, Icon, IconBtn, Row, T, useScreenStyles } from '../ui';
import { useStore } from '../store';
import { useNav } from '../nav';
import ItemRow, { Section } from '../ItemRow';
import { dayAgenda, freeSlots, monthMoney, nowAndNext, toggleAbsence } from '../core/model';
import { addDays, addMonths, cap, daysInMonth, formatMoney, fromISO, longDay, minutesOf, monthKey, monthLabel, toISO, todayISO, WEEKDAYS_SHORT } from '../core/dates';
import { holidaysOfMonth } from '../legacy/holidays';

const greeting = (h) => (h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
const dur = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`);

export default function Today() {
  const c = useTheme();
  const s = useScreenStyles();
  const { state, now, saveBlock, moveItem, say } = useStore();
  const { open, go } = useNav();
  const today = todayISO(now);
  const [picked, setPicked] = useState(null);
  const day = picked || today;
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));
  const isToday = day === today;
  const agenda = useMemo(() => dayAgenda(state, day, now), [state, day, now]);
  const nn = isToday ? nowAndNext(agenda, now) : { current: null, next: null };
  const free = useMemo(() => (agenda.timed.some((e) => e.kind === 'block') ? freeSlots(agenda, isToday && now.getHours() >= 7 ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '07:00').slice(0, 3) : []), [agenda, isToday]);
  const money = useMemo(() => monthMoney(state.items, monthKey(today), state.settings, now), [state, today]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const a = dayAgenda(state, d, now);
    return { d, busy: a.loose.length + a.timed.filter((e) => e.kind === 'item').length, exam: [...a.loose, ...a.timed.filter((e) => e.kind === 'item').map((e) => e.item)].some((i) => i.type === 'study' && i.studyKind === 'prova') };
  }), [state, today]);
  // calendário do mês: o que tem em cada dia e os feriados do estado
  const grid = useMemo(() => {
    if (!calendar) return null;
    const [y, m] = month.split('-').map(Number);
    const holidays = holidaysOfMonth(month, state.settings.state || undefined);
    const cells = [];
    for (let i = 0; i < new Date(y, m - 1, 1).getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth(y, m - 1); d++) {
      const iso = toISO(new Date(y, m - 1, d));
      const a = dayAgenda(state, iso, now);
      const items = [...a.loose, ...a.timed.filter((e) => e.kind === 'item').map((e) => e.item), ...a.done];
      cells.push({ iso, d, holiday: holidays[iso] || null, types: ['task', 'study', 'money'].filter((t) => items.some((i) => i.type === t && !i.ghost)) });
    }
    return { cells, holidays };
  }, [calendar, month, state]);
  const dayHoliday = useMemo(() => (holidaysOfMonth(day.slice(0, 7), state.settings.state || undefined)[day] || [])[0], [day, state.settings.state]);
  const empty = !agenda.timed.length && !agenda.loose.length && !agenda.late.length;
  const name = state.settings.name ? `, ${state.settings.name.split(' ')[0]}` : '';
  const title = (e) => (e.kind === 'block' ? e.block.name : e.item.title);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Row style={{ paddingTop: 14 }}>
        <View style={{ flex: 1 }}>
          <T v="s" c="soft">
            {isToday ? `${greeting(now.getHours())}${name}` : day < today ? 'Olhando para trás' : 'Olhando para frente'}
          </T>
          <T v="hero">{isToday ? 'Hoje' : cap(longDay(day).split(',')[0])}</T>
          <T c="soft">
            {longDay(day)}
            {dayHoliday ? ` · ${dayHoliday.name}` : ''}
          </T>
        </View>
        <IconBtn name="calendar" label={calendar ? 'Fechar o calendário' : 'Abrir o calendário'} onPress={() => { setMonth(day.slice(0, 7)); setCalendar(!calendar); }} bg={calendar ? 'text' : 'card'} color={calendar ? 'bg' : 'soft'} style={{ marginRight: 8 }} />
        <IconBtn name="gear" label="Ajustes" onPress={() => open('settings')} bg="card" />
      </Row>

      {grid ? (
        <Card style={{ marginTop: 16, padding: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconBtn name="back" label="Mês anterior" onPress={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))} />
            <T v="m">{monthLabel(month)}</T>
            <IconBtn name="next" label="Próximo mês" onPress={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))} />
          </Row>
          <Row gap={0}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <T key={i} v="s" c="faint" style={{ width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 4 }}>
                {d}
              </T>
            ))}
          </Row>
          <Row gap={0} wrap>
            {grid.cells.map((cell, i) => {
              const on = cell && cell.iso === day;
              return (
                <Pressable key={i} disabled={!cell} onPress={() => setPicked(cell.iso)} accessibilityLabel={cell ? longDay(cell.iso) : undefined} aria-label={cell ? `Dia ${cell.d}` : undefined} style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                  {cell ? (
                    <View style={{ width: 38, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.text : 'transparent', borderWidth: cell.iso === today && !on ? 1.5 : 0, borderColor: c.line }}>
                      <T v={on ? 'sm' : 's'} c={on ? 'bg' : cell.holiday ? 'danger' : 'text'}>
                        {cell.d}
                      </T>
                      <Row gap={2} style={{ height: 5 }}>
                        {cell.types.map((t) => (
                          <View key={t} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? c.bg : c[t] }} />
                        ))}
                      </Row>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Row>
          {Object.keys(grid.holidays).length ? (
            <T v="s" c="soft" style={{ marginTop: 6 }}>
              {Object.entries(grid.holidays).map(([iso, hs]) => `${Number(iso.slice(8))}: ${hs[0].name}`).join(' · ')}
            </T>
          ) : null}
          {day !== today ? <Btn small kind="soft" label="Voltar para hoje" onPress={() => { setPicked(null); setMonth(today.slice(0, 7)); }} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
        </Card>
      ) : null}

      <Row gap={6} style={{ marginTop: 16, display: calendar ? 'none' : 'flex' }}>
        {week.map((w) => {
          const on = w.d === day;
          return (
            <Pressable key={w.d} onPress={() => setPicked(w.d)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={longDay(w.d)} aria-label={longDay(w.d)} style={{ flex: 1, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.text : c.card, gap: 1 }}>
              <T v="s" c={on ? 'bg' : 'faint'} style={{ fontSize: 11 }}>
                {WEEKDAYS_SHORT[fromISO(w.d).getDay()]}
              </T>
              <T v="m" c={on ? 'bg' : 'text'}>
                {fromISO(w.d).getDate()}
              </T>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: w.exam ? c.study : w.busy ? (on ? c.bg : c.faint) : 'transparent' }} />
            </Pressable>
          );
        })}
      </Row>

      {isToday && (nn.current || nn.next) ? (
        <Card style={{ marginTop: 16, backgroundColor: c.brand }}>
          {nn.current ? (
            <>
              <T v="l" c="onBrand" style={{ opacity: 0.7 }}>
                Agora
              </T>
              <T v="title" c="onBrand" numberOfLines={2}>
                {title(nn.current)}
              </T>
              <T c="onBrand" style={{ opacity: 0.8 }}>
                {nn.current.end ? `até ${nn.current.end}` : `desde ${nn.current.time}`}
                {nn.current.kind === 'block' && nn.current.block.room ? ` · ${nn.current.block.room}` : ''}
              </T>
            </>
          ) : null}
          {nn.next ? (
            <View style={nn.current ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.dark ? 'rgba(18,21,28,0.15)' : 'rgba(247,246,242,0.2)' } : null}>
              <T v="l" c="onBrand" style={{ opacity: 0.7 }}>
                {nn.current ? 'Depois' : 'A seguir'}
              </T>
              <T v={nn.current ? 'h' : 'title'} c="onBrand" numberOfLines={2}>
                {title(nn.next)}
              </T>
              <T c="onBrand" style={{ opacity: 0.8 }}>
                {nn.next.time} · em {dur(nn.minutesToNext)}
              </T>
            </View>
          ) : null}
        </Card>
      ) : null}

      {agenda.late.length ? (
        <Section title="Ficou para trás" count={agenda.late.length} tone="danger" right={<Btn small kind="soft" label="Passar tudo para hoje" onPress={() => { agenda.late.forEach((i) => moveItem(i.id, today)); say('Passei para hoje'); }} />}>
          {agenda.late.slice(0, 6).map((it) => (
            <ItemRow key={it.id} item={it} />
          ))}
          {agenda.late.length > 6 ? (
            <T v="s" c="soft" style={{ paddingVertical: 6 }}>
              e mais {agenda.late.length - 6} na aba Tudo
            </T>
          ) : null}
        </Section>
      ) : null}

      {agenda.timed.length ? (
        <Section title="Com hora marcada">
          {agenda.timed.map((e) => {
            const past = isToday && minutesOf(e.end || e.time) < now.getHours() * 60 + now.getMinutes();
            if (e.kind === 'item') {
              return (
                <Row key={e.id} gap={10} style={{ opacity: past ? 0.6 : 1 }}>
                  <T v="sm" c="soft" style={{ width: 44 }}>
                    {e.time}
                  </T>
                  <View style={{ flex: 1 }}>
                    <ItemRow item={e.item} showDay={false} compact />
                  </View>
                </Row>
              );
            }
            const color = c.blocks[e.block.color % 8];
            return (
              <Row key={e.id} gap={10} style={{ marginVertical: 4, opacity: past ? 0.6 : 1 }}>
                <T v="sm" c="soft" style={{ width: 44 }}>
                  {e.start}
                </T>
                <Pressable onPress={() => open('block', { id: e.block.id })} accessibilityRole="button" accessibilityLabel={`Abrir ${e.block.name}`} aria-label={`Abrir ${e.block.name}`} style={{ flex: 1, backgroundColor: c.card, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: color, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <T v="m" style={e.absent ? { textDecorationLine: 'line-through' } : null}>
                    {e.block.name}
                  </T>
                  <T v="s" c="soft">
                    {e.start}–{e.end}
                    {e.block.room ? ` · ${e.block.room}` : ''}
                    {e.absent ? ' · faltei' : ''}
                  </T>
                </Pressable>
                {e.block.kind === 'class' && day <= today ? <Btn small kind={e.absent ? 'danger' : 'soft'} label={e.absent ? 'Faltei' : 'Faltar'} onPress={() => saveBlock(toggleAbsence(e.block, day, state.settings))} /> : null}
              </Row>
            );
          })}
        </Section>
      ) : null}

      {agenda.loose.length ? (
        <Section title={isToday ? 'Para hoje' : 'Para este dia'} count={agenda.loose.length}>
          {agenda.loose.map((it) => (
            <ItemRow key={it.id} item={it} showDay={false} />
          ))}
        </Section>
      ) : null}

      {free.length && (agenda.loose.length || agenda.late.length) ? (
        <Row gap={8} style={{ marginTop: 18 }}>
          <Icon name="clock" size={16} color="faint" />
          <T v="s" c="soft" style={{ flex: 1 }}>
            Horários livres: {free.map((f) => `${f.start}–${f.end}`).join(' · ')}
          </T>
        </Row>
      ) : null}

      {empty ? (
        <Empty icon="today" title={isToday ? 'Dia livre por enquanto' : 'Nada marcado'} text="Toque no microfone e fale do seu jeito: tarefas, provas, aulas e contas. Eu separo tudo.">
          <Btn small kind="soft" icon="keyboard" label="Prefiro escrever" onPress={() => open('capture', { voice: false })} style={{ marginTop: 8 }} />
        </Empty>
      ) : null}

      {isToday && money.limit ? (
        <Card style={{ marginTop: 22 }} onPress={() => go('money')}>
          <Row>
            <Icon name="wallet" size={18} color="money" />
            <T v="sm" c="soft" style={{ flex: 1 }}>
              {money.left >= 0 ? 'Dá para gastar hoje' : 'Limite do mês'}
            </T>
            <T v="m" c={money.left >= 0 ? 'money' : 'danger'}>
              {state.settings.hideMoney ? 'R$ •••' : money.left >= 0 ? formatMoney(money.perDay || 0) : `passou ${formatMoney(-money.left)}`}
            </T>
          </Row>
        </Card>
      ) : null}

      {agenda.done.length ? (
        <Section title="Feito" count={agenda.done.length}>
          {agenda.done.map((it) => (
            <ItemRow key={it.id} item={it} showDay={false} compact />
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
