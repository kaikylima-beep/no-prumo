// 1.13 · Notas e faltas de uma matéria. Abre ao tocar na matéria (Estudos → Matérias).
// O Toast fica atrás de Modal: o Desfazer desta tela é uma faixa própria, embaixo.
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look, subjectColor } from '../theme';
import { useData } from '../store';
import { todayISO, maskDate, parseBR, formatBR, shortBR } from '../utils';
import { Button, Field, Label, Pill, Remove } from '../ui';
import {
  absenceSummary, absenceStatusText, gradeSummary, gradeStatusText, fmtGrade, parseGrade, lessonsOn,
} from '../academic';

function UndoBar({ undo, onDone }) {
  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [undo]);
  if (!undo) return null;
  return (
    <View style={st.undo}>
      <Text style={st.undoText}>{undo.text}</Text>
      {undo.fn ? (
        <Pressable
          onPress={() => {
            undo.fn();
            onDone();
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={st.undoAction}>Desfazer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function SubjectDetail({ subjectId, onClose, onEdit, focus }) {
  const insets = useSafeAreaInsets();
  const { subjects, settings, addAbsence, removeAbsence, addGrade, updateGrade, removeGrade, setFormula } = useData();
  const subject = subjects.find((x) => x.id === subjectId);
  const [undo, setUndo] = useState(null);
  const [absForm, setAbsForm] = useState(null); // { dateText, countText }
  const [gradeForm, setGradeForm] = useState(focus && focus.grade ? focus.grade : null); // { id?, name, scoreText, maxText, weightText }
  const [error, setError] = useState('');
  const [formula, setFormulaText] = useState(subject ? subject.formula || '' : '');
  const scroll = useRef(null);
  if (!subject) return null;
  const c = subjectColor(subject.color);
  const academic = settings.academic;
  const today = todayISO();
  const cm = academic.classMinutes;
  const abs = absenceSummary(subject, academic, settings.semester, settings.profile.state);
  const gs = gradeSummary(subject, academic);
  const todayLessons = lessonsOn(subject, today, cm);

  const say = (text, fn) => setUndo({ text, fn, key: Date.now() });

  const faltar = (date, count) => {
    const r = addAbsence(subject.id, { date, count });
    say(`${count} ${count === 1 ? 'falta' : 'faltas'} em ${shortBR(date)}${r.note ? `. ${r.note.replace(`${subject.name}: `, '')}` : ''}`, r.undo);
  };

  const saveAbsence = () => {
    const date = absForm.dateText ? parseBR(absForm.dateText) : today;
    const count = Number(absForm.countText);
    if (!date) return setError('Data inválida. Use DD/MM/AAAA.');
    if (!Number.isInteger(count) || count < 1 || count > 12) return setError('Número de aulas inválido.');
    setError('');
    setAbsForm(null);
    faltar(date, count);
  };

  const saveGrade = () => {
    const name = String(gradeForm.name || '').trim();
    if (!name) return setError('Dê um nome à avaliação (P1, Trabalho…).');
    const score = gradeForm.scoreText.trim() ? parseGrade(gradeForm.scoreText) : null;
    if (gradeForm.scoreText.trim() && score === null) return setError('Nota inválida. Ex.: 7,5');
    const max = gradeForm.maxText.trim() ? parseGrade(gradeForm.maxText) : null;
    if (gradeForm.maxText.trim() && !max) return setError('Nota máxima inválida.');
    const weight = gradeForm.weightText.trim() ? parseGrade(gradeForm.weightText) : null;
    if (gradeForm.weightText.trim() && !weight) return setError('Peso inválido. Ex.: 40 ou 2');
    if (score !== null && score > (max || academic.maxGrade)) return setError(`A nota passa da nota máxima (${fmtGrade(max || academic.maxGrade)}).`);
    setError('');
    const data = { name, score, max, weight, ...(gradeForm.studyId ? { studyId: gradeForm.studyId } : null) };
    if (gradeForm.id) updateGrade(subject.id, gradeForm.id, data);
    else addGrade(subject.id, data);
    setGradeForm(null);
  };

  const editGrade = (g) =>
    setGradeForm({ id: g.id, name: g.name, scoreText: g.score === null || g.score === undefined ? '' : fmtGrade(g.score), maxText: g.max ? fmtGrade(g.max) : '', weightText: g.weight ? fmtGrade(g.weight) : '' });

  const simple = look.mode === 'simple';
  const boxStyle = simple ? [st.boxSimple] : [st.box, { backgroundColor: c.tint }];
  const warnColor = abs.status === 'over' || abs.status === 'near' ? colors.warn : colors.mute;
  const absences = [...(subject.absences || [])].sort((a, b) => b.date.localeCompare(a.date));
  const grades = subject.grades || [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.kind, { color: c.main }]}>Notas e faltas</Text>
          <Text style={st.title} numberOfLines={2}>{subject.name}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={st.close}>Fechar</Text>
        </Pressable>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 90 }]} keyboardShouldPersistTaps="handled">
        {/* ---------- Faltas ---------- */}
        <View style={boxStyle}>
          <Text style={[st.boxLabel, { color: c.main }]}>Faltas</Text>
          <Text style={st.big}>{abs.total === null ? abs.count : `${abs.count} de ${abs.limit}`}</Text>
          <Text style={[st.status, { color: warnColor }]}>{absenceStatusText(abs)}</Text>
          {abs.total !== null ? (
            <Text style={st.meta}>
              {abs.total} aulas no semestre · limite de {academic.absencePct}% · aula de {cm} min
            </Text>
          ) : null}
          <View style={st.row}>
            {todayLessons ? (
              <Pill label={`Faltei hoje (${todayLessons} ${todayLessons === 1 ? 'aula' : 'aulas'})`} color={c.main} filled onPress={() => faltar(today, todayLessons)} />
            ) : null}
            <View style={{ width: 8 }} />
            <Pill label="Marcar falta" color={c.main} onPress={() => setAbsForm({ dateText: formatBR(today), countText: String(todayLessons || 1) })} />
          </View>
        </View>
        {absForm ? (
          <View style={st.form}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Label>Dia</Label>
                <Field
                  value={absForm.dateText}
                  onChangeText={(v) => {
                    const dateText = maskDate(v);
                    const iso = parseBR(dateText);
                    const n = iso ? lessonsOn(subject, iso, cm) : 0;
                    setAbsForm((f) => ({ ...f, dateText, ...(n ? { countText: String(n) } : null) }));
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                />
              </View>
              <View style={{ width: 110 }}>
                <Label>Aulas</Label>
                <Field value={absForm.countText} onChangeText={(v) => setAbsForm((f) => ({ ...f, countText: v.replace(/\D/g, '') }))} keyboardType="number-pad" maxLength={2} />
              </View>
            </View>
            <Text style={st.help}>Pelo horário da matéria, o app já põe quantas aulas tem no dia (100 min = 2).</Text>
            <View style={st.row}>
              <Pill label="Salvar falta" color={c.main} filled onPress={saveAbsence} />
              <View style={{ width: 8 }} />
              <Pill label="Cancelar" color={colors.mute} onPress={() => setAbsForm(null)} />
            </View>
          </View>
        ) : null}
        {absences.length ? (
          <View style={st.list}>
            {absences.map((a) => (
              <View key={a.id} style={st.line}>
                <Text style={[st.lineText, { flex: 1 }]}>
                  {formatBR(a.date)} · {a.count} {a.count === 1 ? 'aula' : 'aulas'}
                </Text>
                <Remove
                  onPress={() => {
                    const back = removeAbsence(subject.id, a.id);
                    say('Falta apagada', back);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* ---------- Notas ---------- */}
        <View style={[boxStyle, { marginTop: 22 }]}>
          <Text style={[st.boxLabel, { color: c.main }]}>Notas</Text>
          <Text style={st.big}>{gs.average !== null ? fmtGrade(gs.average) : grades.length ? `${gs.graded} de ${gs.total}` : '—'}</Text>
          {gradeStatusText(gs, academic) ? <Text style={[st.status, { color: gs.status === 'impossible' || gs.status === 'failed' ? colors.warn : colors.mute }]}>{gradeStatusText(gs, academic)}</Text> : null}
          <Text style={st.meta}>Média para passar: {fmtGrade(academic.passGrade)} de {fmtGrade(academic.maxGrade)}</Text>
          <View style={st.row}>
            <Pill label="+ Avaliação" color={c.main} filled onPress={() => setGradeForm({ name: '', scoreText: '', maxText: '', weightText: '' })} />
          </View>
        </View>
        {gradeForm ? (
          <View style={st.form}>
            <Label>Avaliação</Label>
            <Field value={gradeForm.name} onChangeText={(v) => setGradeForm((f) => ({ ...f, name: v }))} placeholder="P1, Trabalho, Lista 2" autoFocus={!gradeForm.name} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Label>Nota</Label>
                <Field value={gradeForm.scoreText} onChangeText={(v) => setGradeForm((f) => ({ ...f, scoreText: v }))} keyboardType="decimal-pad" placeholder="ainda não saiu" maxLength={6} />
              </View>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Label>Vale</Label>
                <Field value={gradeForm.maxText} onChangeText={(v) => setGradeForm((f) => ({ ...f, maxText: v }))} keyboardType="decimal-pad" placeholder={fmtGrade(academic.maxGrade)} maxLength={6} />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Peso</Label>
                <Field value={gradeForm.weightText} onChangeText={(v) => setGradeForm((f) => ({ ...f, weightText: v }))} keyboardType="decimal-pad" placeholder="opcional" maxLength={6} />
              </View>
            </View>
            <Text style={st.help}>Peso em % (40) ou em vezes (2). Com o peso de todas as avaliações, o app calcula a média e quanto falta.</Text>
            <View style={st.row}>
              <Pill label="Salvar nota" color={c.main} filled onPress={saveGrade} />
              <View style={{ width: 8 }} />
              <Pill label="Cancelar" color={colors.mute} onPress={() => setGradeForm(null)} />
            </View>
          </View>
        ) : null}
        {error ? <Text style={st.error}>{error}</Text> : null}
        {grades.length ? (
          <View style={st.list}>
            {grades.map((g) => (
              <Pressable key={g.id} style={st.line} onPress={() => editGrade(g)} accessibilityRole="button" accessibilityHint="Editar a nota">
                <View style={{ flex: 1 }}>
                  <Text style={st.lineText}>{g.name}</Text>
                  {g.weight ? <Text style={st.lineMeta}>peso {fmtGrade(g.weight)}</Text> : null}
                </View>
                <Text style={[st.score, g.score === null || g.score === undefined ? { color: colors.mute } : null]}>
                  {g.score === null || g.score === undefined ? 'sem nota' : `${fmtGrade(g.score)}${g.max ? ` de ${fmtGrade(g.max)}` : ''}`}
                </Text>
                <Remove
                  onPress={() => {
                    const back = removeGrade(subject.id, g.id);
                    say(`${g.name} apagada`, back);
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={st.help}>Ainda sem avaliações. Toque em "+ Avaliação" ou fale "tirei 7,5 na P1 de {subject.name.toLowerCase()}".</Text>
        )}

        <Label>Como o professor calcula</Label>
        <Field
          value={formula}
          onChangeText={setFormulaText}
          onEndEditing={() => setFormula(subject.id, formula.trim())}
          onBlur={() => setFormula(subject.id, formula.trim())}
          placeholder="Ex.: (P1 + P2) / 2 × 0,8 + trabalho × 0,2"
          multiline
          style={{ minHeight: 64, textAlignVertical: 'top' }}
        />
        <Text style={st.help}>Do jeito que está no caderno. Fica guardado aqui para você consultar.</Text>

        <View style={{ height: 18 }} />
        <Button title="Editar matéria" variant="text" color={colors.mute} onPress={onEdit} />
      </ScrollView>
      <View style={[st.undoWrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <UndoBar key={undo ? undo.key : 'none'} undo={undo} onDone={() => setUndo(null)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  kind: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: look.titleSize, fontWeight: look.titleWeight, color: colors.ink, letterSpacing: -0.5 },
  close: { fontSize: 16, color: colors.mute, fontWeight: '600', marginLeft: 12 },
  body: { paddingHorizontal: 24, paddingTop: 12 },
  box: { borderRadius: look.rHero, padding: 18 },
  boxSimple: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  boxLabel: { fontSize: 13, fontWeight: '700', textTransform: look.mode === 'simple' ? 'none' : 'uppercase', letterSpacing: look.mode === 'simple' ? 0 : 0.6 },
  big: { fontSize: look.mode === 'simple' ? 32 : 44, fontWeight: look.mode === 'simple' ? '500' : '700', color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  status: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 13, color: colors.mute, marginTop: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  form: { marginTop: 10, paddingTop: 4 },
  list: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  lineText: { fontSize: 16, color: colors.ink },
  lineMeta: { fontSize: 13, color: colors.mute, marginTop: 2 },
  score: { fontSize: 16, color: colors.ink, fontWeight: '600', marginRight: 8, fontVariant: ['tabular-nums'] },
  help: { fontSize: 13, color: colors.mute, lineHeight: 19, marginTop: 6, marginBottom: 4 },
  error: { fontSize: 14, color: colors.warn, marginTop: 10, lineHeight: 20, fontWeight: '600' },
  undoWrap: { position: 'absolute', left: 20, right: 20 },
  undo: { backgroundColor: colors.ink, borderRadius: look.rSmall, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  undoText: { color: colors.onInk, fontSize: 15, fontWeight: '600', flex: 1 },
  undoAction: { color: colors.onInk, fontSize: 15, fontWeight: '800', marginLeft: 16, textDecorationLine: 'underline' },
});
