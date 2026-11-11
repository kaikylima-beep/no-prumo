// Uma matéria (horários, notas e faltas, como na 1.13.0) ou um horário fixo (estágio, academia...).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from './theme';
import { Btn, Chip, DayPicker, IconBtn, Input, Label, Row, Segmented, Sheet, T, TimeInput } from './ui';
import { useStore } from './store';
import { absencesOf, addAbsence, gradeOf, lessonsOnDay, makeBlock, newId } from './core/model';
import { absenceStatusText, academicOf, fmtGrade, gradeStatusText, parseGrade } from './legacy/academic';
import { dayLabel, todayISO } from './core/dates';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function BlockSheet({ id, kind, onClose }) {
  const c = useTheme();
  const { state, saveBlock, removeBlock, now } = useStore();
  const existing = id ? state.blocks.find((b) => b.id === id) : null;
  const [b, setB] = useState(() => existing || makeBlock({ kind: kind || 'class', name: '', slots: [{ days: [], start: '08:00', end: '10:00' }] }, state.blocks));
  const [grade, setGrade] = useState({ name: '', score: '', max: '', weight: '' });
  const [otherDay, setOtherDay] = useState(null); // marcar falta em outro dia
  const set = (patch) => setB((old) => ({ ...old, ...patch }));
  if (id && !existing) return null;
  const st = state.settings;
  const acad = academicOf(st);
  const isClass = b.kind === 'class';
  const g = gradeOf(b, st);
  const a = absencesOf(b, st);
  const today = todayISO(now);
  const todayLessons = (b.slots || []).some((s) => s.days.includes(now.getDay())) ? lessonsOnDay(b, today, st) : 0;
  const missedToday = (b.absences || []).some((x) => x.date === today);
  const setSlot = (i, patch) => set({ slots: b.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const addGrade = () => {
    if (!grade.name.trim() && !grade.score.trim()) return;
    const score = grade.score.trim() ? parseGrade(grade.score) : null;
    if (grade.score.trim() && score === null) return;
    set({ grades: [...(b.grades || []), { id: newId(), name: grade.name.trim() || `Avaliação ${(b.grades || []).length + 1}`, score, max: grade.max.trim() ? parseGrade(grade.max) : null, weight: grade.weight.trim() ? parseGrade(grade.weight) : null, date: today }] });
    setGrade({ name: '', score: '', max: '', weight: '' });
  };
  const setGradeField = (gid, patch) => set({ grades: b.grades.map((x) => (x.id === gid ? { ...x, ...patch } : x)) });
  const save = () => {
    if (!b.name.trim()) return;
    saveBlock({ ...b, name: b.name.trim(), slots: b.slots.filter((s) => s.days.length && s.start) });
    onClose();
  };

  const footer = (
    <Row gap={10}>
      {existing ? <Btn label={b.archived ? 'Reativar' : 'Arquivar'} kind="soft" onPress={() => { saveBlock({ ...b, archived: !b.archived }); onClose(); }} /> : null}
      <Btn label="Salvar" disabled={!b.name.trim()} onPress={save} style={{ flex: 1 }} />
    </Row>
  );

  return (
    <Sheet title={existing ? b.name : isClass ? 'Nova matéria' : 'Novo horário fixo'} onClose={onClose} footer={footer}>
      {!existing ? <Segmented value={b.kind} onChange={(k) => set({ kind: k })} options={[{ value: 'class', label: 'Matéria' }, { value: 'fixed', label: 'Horário fixo' }]} /> : null}
      <Label>Nome</Label>
      <Input value={b.name} onChangeText={(name) => set({ name })} placeholder={isClass ? 'Ex.: Cálculo 2' : 'Ex.: Estágio'} accessibilityLabel="Nome" aria-label="Nome" v="h" />
      <Row gap={10} style={{ marginTop: 10 }}>
        <Input value={b.room} onChangeText={(room) => set({ room })} placeholder={isClass ? 'Sala (opcional)' : 'Lugar (opcional)'} accessibilityLabel="Lugar" aria-label="Lugar" style={{ flex: 1 }} />
      </Row>
      {isClass ? <Input value={(b.aliases || []).join(', ')} onChangeText={(t) => set({ aliases: t.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Apelidos, separados por vírgula (ex.: calc 2)" accessibilityLabel="Apelidos" aria-label="Apelidos" style={{ marginTop: 10 }} /> : null}
      <Row gap={8} style={{ marginTop: 12 }}>
        {c.blocks.map((col, i) => (
          <Pressable key={col} onPress={() => set({ color: i })} accessibilityLabel={`Cor ${i + 1}`} aria-label={`Cor ${i + 1}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: b.color === i ? 3 : 0, borderColor: c.text }} />
        ))}
      </Row>

      {isClass ? (
        <>
          <Label>Faltas</Label>
          <View style={{ backgroundColor: c.card, borderRadius: 14, padding: 12, gap: 8 }}>
            <Row>
              <T v="num" c={a.status === 'over' ? 'danger' : a.status === 'near' ? 'warn' : 'text'} style={{ flex: 1 }}>
                {a.count}
                {a.limit !== null ? <T c="faint">{` de ${a.limit}`}</T> : null}
              </T>
              {todayLessons && !missedToday ? <Btn small kind="soft" label={`Faltei hoje (${todayLessons} ${todayLessons === 1 ? 'aula' : 'aulas'})`} onPress={() => set(addAbsence(b, today, todayLessons))} /> : null}
            </Row>
            <T v="s" c={a.status === 'over' ? 'danger' : a.status === 'near' ? 'warn' : 'soft'}>
              {a.limit !== null ? absenceStatusText(a) : 'Informe o semestre em Ajustes para ver o limite de faltas.'}
            </T>
            {(b.absences || []).length ? (
              <Row wrap gap={6}>
                {b.absences.slice(-8).map((x) => (
                  <Chip key={x.id || x.date} label={`${dayLabel(x.date, now)} · ${x.count || 1}  ✕`} onPress={() => set({ absences: b.absences.filter((y) => y !== x) })} />
                ))}
              </Row>
            ) : null}
            {otherDay === null ? (
              <Btn small kind="ghost" label="Marcar falta em outro dia" onPress={() => setOtherDay(today)} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <View style={{ gap: 8 }}>
                <DayPicker value={otherDay} allowNone={false} onChange={setOtherDay} />
                <Row>
                  <Btn small label={`Marcar falta (${lessonsOnDay(b, otherDay, st)} ${lessonsOnDay(b, otherDay, st) === 1 ? 'aula' : 'aulas'})`} onPress={() => { set(addAbsence(b, otherDay, lessonsOnDay(b, otherDay, st))); setOtherDay(null); }} />
                  <Btn small kind="ghost" label="Cancelar" onPress={() => setOtherDay(null)} />
                </Row>
              </View>
            )}
          </View>

          <Label>Notas</Label>
          {g.average !== null || gradeStatusText(g, acad) ? (
            <View style={{ backgroundColor: c.card, borderRadius: 14, padding: 12, marginBottom: 8 }}>
              {g.average !== null ? (
                <T v="num" c={g.status === 'failed' || g.status === 'impossible' ? 'danger' : g.status === 'needs' ? 'warn' : 'money'}>
                  Média {fmtGrade(g.average)}
                </T>
              ) : null}
              <T v="s" c="soft">
                {gradeStatusText(g, acad)}
              </T>
            </View>
          ) : null}
          {(b.grades || []).map((gr) => (
            <Row key={gr.id} gap={8} style={{ minHeight: 48 }}>
              <T v="m" style={{ flex: 1 }} numberOfLines={1}>
                {gr.name}
              </T>
              <Input value={gr.score === null || gr.score === undefined ? '' : fmtGrade(gr.score)} onChangeText={(t) => setGradeField(gr.id, { score: t.trim() ? parseGrade(t) : null })} keyboardType="decimal-pad" placeholder="Nota" accessibilityLabel={`Nota de ${gr.name}`} aria-label={`Nota de ${gr.name}`} style={{ width: 66, textAlign: 'center', minHeight: 40, paddingVertical: 6 }} />
              <T v="s" c="faint">
                de {fmtGrade(gr.max || acad.maxGrade)}
              </T>
              <Input value={gr.weight ? fmtGrade(gr.weight) : ''} onChangeText={(t) => setGradeField(gr.id, { weight: t.trim() ? parseGrade(t) : null })} keyboardType="decimal-pad" placeholder="Peso" accessibilityLabel={`Peso de ${gr.name}`} aria-label={`Peso de ${gr.name}`} style={{ width: 60, textAlign: 'center', minHeight: 40, paddingVertical: 6 }} />
              <IconBtn name="close" size={16} label={`Tirar ${gr.name}`} onPress={() => set({ grades: b.grades.filter((x) => x.id !== gr.id) })} />
            </Row>
          ))}
          <Row gap={8} style={{ marginTop: 4 }}>
            <Input value={grade.name} onChangeText={(name) => setGrade({ ...grade, name })} placeholder="P1, trabalho…" accessibilityLabel="Nome da avaliação" aria-label="Nome da avaliação" style={{ flex: 1 }} />
            <Input value={grade.score} onChangeText={(score) => setGrade({ ...grade, score: score.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" placeholder="Nota" accessibilityLabel="Nota" aria-label="Nota" style={{ width: 66, textAlign: 'center' }} />
            <Input value={grade.weight} onChangeText={(weight) => setGrade({ ...grade, weight: weight.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" placeholder="Peso" accessibilityLabel="Peso" aria-label="Peso" style={{ width: 60, textAlign: 'center' }} />
            <IconBtn name="plus" label="Adicionar avaliação" bg="text" color="bg" onPress={addGrade} />
          </Row>
          <T v="s" c="faint" style={{ marginTop: 6 }}>
            Dá para cadastrar a avaliação antes da nota sair (só o nome e o peso). Com o peso de todas, eu mostro a média e quanto falta para passar ({fmtGrade(acad.passGrade)}).
          </T>
          <Label>Como o professor calcula</Label>
          <Input value={b.formula || ''} onChangeText={(formula) => set({ formula })} multiline placeholder="Copie do caderno, ex.: (P1 + P2 + 2×Trabalho) / 4" accessibilityLabel="Como o professor calcula" aria-label="Como o professor calcula" style={{ minHeight: 56, textAlignVertical: 'top' }} />
        </>
      ) : null}

      <Label>Horários da semana</Label>
      {b.slots.map((s, i) => (
        <View key={i} style={{ backgroundColor: c.card, borderRadius: 14, padding: 10, marginBottom: 8, gap: 8 }}>
          <Row gap={5}>
            {DAYS.map((d, k) => {
              const on = s.days.includes(k);
              return <Chip key={k} label={d} on={on} style={{ paddingHorizontal: 0, width: 36, justifyContent: 'center' }} onPress={() => setSlot(i, { days: on ? s.days.filter((x) => x !== k) : [...s.days, k].sort() })} />;
            })}
          </Row>
          <Row gap={8}>
            <TimeInput value={s.start} onChange={(start) => setSlot(i, { start: start || s.start })} label="Começa" style={{ width: 92 }} />
            <T c="soft">até</T>
            <TimeInput value={s.end} onChange={(end) => setSlot(i, { end: end || s.end })} label="Termina" style={{ width: 92 }} />
            <View style={{ flex: 1 }} />
            <IconBtn name="trash" size={18} label="Tirar horário" onPress={() => set({ slots: b.slots.filter((_, k) => k !== i) })} />
          </Row>
        </View>
      ))}
      <Btn small kind="soft" icon="plus" label="Outro horário" onPress={() => set({ slots: [...b.slots, { days: [], start: '08:00', end: '10:00' }] })} style={{ alignSelf: 'flex-start' }} />

      {existing ? <Btn label="Apagar de vez" kind="ghost" icon="trash" onPress={() => { removeBlock(b.id); onClose(); }} style={{ marginTop: 22 }} /> : null}
    </Sheet>
  );
}
