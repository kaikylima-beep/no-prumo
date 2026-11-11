// Uma matéria (com notas e faltas) ou um horário fixo (estágio, academia...).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from './theme';
import { Btn, Chip, IconBtn, Input, Label, Row, Segmented, Sheet, T, TimeInput } from './ui';
import { useStore } from './store';
import { absenceInfo, gradeInfo, makeBlock, newId } from './core/model';
import { dayLabel, todayISO } from './core/dates';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const toNum = (t) => {
  const n = parseFloat(String(t).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function BlockSheet({ id, kind, onClose }) {
  const c = useTheme();
  const { state, saveBlock, removeBlock, now } = useStore();
  const existing = id ? state.blocks.find((b) => b.id === id) : null;
  const [b, setB] = useState(() => existing || makeBlock({ kind: kind || 'class', name: '', slots: [{ days: [], start: '08:00', end: '10:00' }] }, state.blocks));
  const [grade, setGrade] = useState({ name: '', score: '', weight: '' });
  const set = (patch) => setB((old) => ({ ...old, ...patch }));
  if (id && !existing) return null;
  const isClass = b.kind === 'class';
  const g = gradeInfo(b);
  const a = absenceInfo(b);
  const setSlot = (i, patch) => set({ slots: b.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const addGrade = () => {
    const score = toNum(grade.score);
    if (score === null) return;
    set({ grades: [...(b.grades || []), { id: newId(), name: grade.name.trim() || `Nota ${(b.grades || []).length + 1}`, score, max: 10, weight: toNum(grade.weight), date: todayISO() }] });
    setGrade({ name: '', score: '', weight: '' });
  };
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
      <Row gap={8} style={{ marginTop: 12 }}>
        {c.blocks.map((col, i) => (
          <Pressable key={col} onPress={() => set({ color: i })} accessibilityLabel={`Cor ${i + 1}`} aria-label={`Cor ${i + 1}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: b.color === i ? 3 : 0, borderColor: c.text }} />
        ))}
      </Row>

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

      {isClass ? (
        <>
          <Label>Notas</Label>
          {g.average !== null ? (
            <View style={{ backgroundColor: c.card, borderRadius: 14, padding: 12, marginBottom: 8 }}>
              <T v="num" c={g.average >= g.pass ? 'money' : 'warn'}>
                {g.need !== undefined ? `${num(g.partial)} pontos` : `Média ${num(g.average)}`}
              </T>
              <T v="s" c="soft">
                {g.need !== undefined ? (g.need > 10 ? `Faltam ${g.remaining}% da nota. Não dá mais para chegar em ${num(g.pass)} só com isso.` : `Faltam ${g.remaining}% da nota: precisa tirar ${num(g.need)} para fechar com ${num(g.pass)}.`) : g.weighted ? 'Com os pesos que você deu.' : 'Média simples. Dê o peso (em %) de cada nota para eu calcular quanto falta.'}
              </T>
            </View>
          ) : null}
          {(b.grades || []).map((gr) => (
            <Row key={gr.id} style={{ minHeight: 44 }}>
              <T v="m" style={{ flex: 1 }}>
                {gr.name}
              </T>
              {gr.weight ? (
                <T v="s" c="faint">
                  peso {num(gr.weight)}
                </T>
              ) : null}
              <T v="m">{num(gr.score)}</T>
              <IconBtn name="close" size={16} label={`Tirar ${gr.name}`} onPress={() => set({ grades: b.grades.filter((x) => x.id !== gr.id) })} />
            </Row>
          ))}
          <Row gap={8} style={{ marginTop: 4 }}>
            <Input value={grade.name} onChangeText={(name) => setGrade({ ...grade, name })} placeholder="P1, trabalho…" accessibilityLabel="Nome da nota" aria-label="Nome da nota" style={{ flex: 1 }} />
            <Input value={grade.score} onChangeText={(score) => setGrade({ ...grade, score: score.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" placeholder="Nota" accessibilityLabel="Nota" aria-label="Nota" style={{ width: 70, textAlign: 'center' }} />
            <Input value={grade.weight} onChangeText={(weight) => setGrade({ ...grade, weight: weight.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" placeholder="Peso %" accessibilityLabel="Peso" aria-label="Peso" style={{ width: 78, textAlign: 'center' }} />
            <IconBtn name="plus" label="Adicionar nota" bg="brand" color="onBrand" onPress={addGrade} />
          </Row>
          <Row gap={8} style={{ marginTop: 10 }}>
            <T c="soft" style={{ flex: 1 }}>
              Média para passar
            </T>
            <Input value={String(b.passGrade ?? 6).replace('.', ',')} onChangeText={(t) => set({ passGrade: toNum(t) ?? 6 })} keyboardType="decimal-pad" accessibilityLabel="Média para passar" aria-label="Média para passar" style={{ width: 70, textAlign: 'center' }} />
          </Row>

          <Label>Faltas</Label>
          <Row gap={10}>
            <IconBtn name="close" size={18} label="Tirar uma falta" bg="card" onPress={() => set({ absences: (b.absences || []).slice(0, -1) })} />
            <View style={{ alignItems: 'center', minWidth: 60 }}>
              <T v="num" c={a.over ? 'danger' : a.danger ? 'warn' : 'text'}>
                {a.count}
              </T>
            </View>
            <IconBtn name="plus" label="Marcar falta hoje" bg="card" onPress={() => set({ absences: [...(b.absences || []), todayISO(now)] })} />
            <T c="soft" style={{ flex: 1, textAlign: 'right' }}>
              Limite
            </T>
            <Input value={b.maxAbsences ? String(b.maxAbsences) : ''} onChangeText={(t) => set({ maxAbsences: parseInt(t, 10) || null })} keyboardType="number-pad" placeholder="—" accessibilityLabel="Limite de faltas" aria-label="Limite de faltas" style={{ width: 70, textAlign: 'center' }} />
          </Row>
          {a.max !== null ? (
            <T v="s" c={a.over ? 'danger' : a.danger ? 'warn' : 'soft'} style={{ marginTop: 6 }}>
              {a.over ? 'Passou do limite de faltas.' : `Ainda pode faltar ${a.left} ${a.left === 1 ? 'vez' : 'vezes'}.`}
            </T>
          ) : null}
          {(b.absences || []).length ? (
            <T v="s" c="faint" style={{ marginTop: 4 }}>
              {b.absences.slice(-6).map((d) => dayLabel(d, now)).join(' · ')}
            </T>
          ) : null}
        </>
      ) : null}

      {existing ? <Btn label="Apagar de vez" kind="ghost" icon="trash" onPress={() => { removeBlock(b.id); onClose(); }} style={{ marginTop: 22 }} /> : null}
    </Sheet>
  );
}
