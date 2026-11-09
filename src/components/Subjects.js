// Aba Matérias de Estudos (1.12). Avançado: cartões com a cor da matéria. Simples: lista calma, linhas finas.
import React, { useState } from 'react';
import { View, Modal, ScrollView, Pressable, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look, subjectColor, SUBJECT_COUNT } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { todayISO, maskDate, maskTime, formatBR } from '../utils';
import { Button, Check, Chip, Dot, Empty, Field, Label, Notice, Pill, Section } from '../ui';
import {
  WEEK_CHIPS, emptySchedule, emptySubjectForm, itemsToLink, nextClassLabel, readSemester, readSubjectForm,
  scheduleLabel, semesterEnded, semesterLabel, toSubjectForm,
} from '../subjects';

// Linha pequena com a cor e o nome da matéria (usada nas provas e entregas)
export function SubjectTag({ subject, style }) {
  if (!subject) return null;
  const c = subjectColor(subject.color);
  return (
    <View style={[st.tag, style]}>
      <Dot color={c.main} size={8} style={{ marginRight: 6 }} />
      <Text style={[st.tagText, { color: c.main }]} numberOfLines={1}>{subject.name}</Text>
    </View>
  );
}

export default function SubjectsTab() {
  const { subjects, study, settings, palettes, simple, archiveSubjects, updateSubject, setSemester } = useData();
  const { showToast } = useUI();
  const pal = palettes.study;
  const today = todayISO();
  const [editing, setEditing] = useState(null); // { subject } ou {} para uma nova
  const [showArchived, setShowArchived] = useState(false);
  const [semesterForm, setSemesterForm] = useState(null);
  const [semesterError, setSemesterError] = useState('');

  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  const active = subjects.filter((x) => !x.archived).sort(byName);
  const archived = subjects.filter((x) => x.archived).sort(byName);
  const label = semesterLabel(settings.semester);
  const openItems = (id) => study.filter((t) => t.subjectId === id && !t.done && !t.repeat).length;

  const archiveAll = () => {
    const previous = settings.semester;
    const undo = archiveSubjects(active.map((x) => x.id));
    setSemester({ start: null, end: null });
    showToast(active.length === 1 ? 'Matéria arquivada' : `${active.length} matérias arquivadas`, 'Desfazer', () => {
      undo();
      setSemester(previous);
    });
  };

  const openSemester = () => {
    setSemesterError('');
    setSemesterForm({
      startText: settings.semester.start ? formatBR(settings.semester.start) : '',
      endText: settings.semester.end ? formatBR(settings.semester.end) : '',
    });
  };

  const saveSemester = () => {
    const r = readSemester(semesterForm.startText, semesterForm.endText);
    if (r.error) {
      setSemesterError(r.error);
      return;
    }
    setSemester(r.data);
    setSemesterForm(null);
  };

  const card = (x) => {
    const c = subjectColor(x.color);
    const next = nextClassLabel(x);
    const n = openItems(x.id);
    const line = [next || 'Sem horário', x.room].filter(Boolean).join(' · ');
    const count = n ? `${n} ${n === 1 ? 'prova ou entrega' : 'provas ou entregas'}` : null;
    if (simple) {
      return (
        <Pressable key={x.id} onPress={() => setEditing({ subject: x })} style={({ pressed }) => [st.rowSimple, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <Dot color={c.main} size={9} style={{ marginRight: 12, marginTop: 7 }} />
          <View style={{ flex: 1 }}>
            <Text style={st.nameSimple}>{x.name}</Text>
            <Text style={st.meta}>{line}{count ? ` · ${count}` : ''}</Text>
          </View>
        </Pressable>
      );
    }
    return (
      <Pressable key={x.id} onPress={() => setEditing({ subject: x })} style={({ pressed }) => [st.card, { backgroundColor: c.tint }, pressed && { opacity: 0.75 }]} accessibilityRole="button">
        <View style={[st.band, { backgroundColor: c.main }]} />
        <View style={{ flex: 1 }}>
          <Text style={[st.name, { color: c.main }]}>{x.name}</Text>
          <Text style={st.cardMeta}>{line}</Text>
          {count ? <Text style={st.cardMeta}>{count}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View>
      {semesterEnded(settings.semester, today) && active.length ? (
        <View style={{ marginTop: 12 }}>
          <Notice title="O semestre terminou" sub="Arquive as matérias. Nada é apagado." action="Arquivar" onAction={archiveAll} />
        </View>
      ) : null}

      <Section style={st.sec} right={<Pill label="+ Matéria" color={pal.main} onPress={() => setEditing({})} />}>Matérias</Section>
      {active.length === 0 ? (
        <View>
          <Empty text={'Nenhuma matéria ainda.\nCadastre o nome, os apelidos e os horários. Depois, é só falar "prova de calc 2 sexta" que cai na matéria certa.'} />
          <View style={{ height: 12 }} />
          <Button title="Adicionar matéria" color={pal.main} onPress={() => setEditing({})} />
        </View>
      ) : (
        <View style={simple ? st.listSimple : null}>{active.map(card)}</View>
      )}

      <Section style={st.sec} right={semesterForm ? null : <Pill label={label ? 'Editar' : 'Informar'} color={colors.mute} onPress={openSemester} />}>Semestre</Section>
      {semesterForm ? (
        <View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Label>Início</Label>
              <Field value={semesterForm.startText} onChangeText={(v) => setSemesterForm((f) => ({ ...f, startText: maskDate(v) }))} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Fim</Label>
              <Field value={semesterForm.endText} onChangeText={(v) => setSemesterForm((f) => ({ ...f, endText: maskDate(v) }))} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />
            </View>
          </View>
          {semesterError ? <Text style={st.error}>{semesterError}</Text> : null}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Pill label="Salvar" color={pal.main} filled onPress={saveSemester} />
            <View style={{ width: 10 }} />
            <Pill label="Cancelar" color={colors.mute} onPress={() => setSemesterForm(null)} />
          </View>
        </View>
      ) : (
        <View>
          <Text style={st.meta}>{label || 'Com as datas, o app avisa quando for hora de arquivar as matérias.'}</Text>
          {label && active.length && !semesterEnded(settings.semester, today) ? (
            <Pressable onPress={archiveAll} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }} accessibilityRole="button">
              <Text style={st.link}>Arquivar as matérias deste semestre</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {archived.length ? (
        <View>
          <Pressable onPress={() => setShowArchived((v) => !v)} style={{ marginTop: 22 }} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: showArchived }}>
            <Text style={st.link}>{showArchived ? 'Esconder arquivadas' : `Ver arquivadas (${archived.length})`}</Text>
          </Pressable>
          {showArchived
            ? archived.map((x) => (
                <View key={x.id} style={st.archivedRow}>
                  <Dot color={subjectColor(x.color).main} size={8} style={{ marginRight: 10 }} />
                  <Text style={st.archivedName} numberOfLines={1}>{x.name}</Text>
                  <Pill label="Reativar" color={colors.mute} onPress={() => updateSubject(x.id, { archived: false, archivedAt: null })} />
                </View>
              ))
            : null}
        </View>
      ) : null}

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)} statusBarTranslucent>
        <SafeAreaProvider>{editing ? <Editor subject={editing.subject} onClose={() => setEditing(null)} /> : null}</SafeAreaProvider>
      </Modal>
    </View>
  );
}

function Editor({ subject, onClose }) {
  const insets = useSafeAreaInsets();
  const { subjects, study, palettes, addSubject, updateSubject, removeSubject, archiveSubjects, linkItems } = useData();
  const { showToast } = useUI();
  const pal = palettes.study;
  const [form, setForm] = useState(() => {
    if (subject) return toSubjectForm(subject);
    const used = new Set(subjects.filter((x) => !x.archived).map((x) => x.color));
    const free = Array.from({ length: SUBJECT_COUNT }, (_, i) => i).find((i) => !used.has(i));
    return emptySubjectForm(free === undefined ? 0 : free);
  });
  const [error, setError] = useState('');
  const [link, setLink] = useState(null); // { subject, items, on: [ids] }
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const setSchedule = (i, p) => set({ schedules: form.schedules.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  const toggleDay = (i, d) => {
    const days = new Set(form.schedules[i].days);
    if (days.has(d)) days.delete(d);
    else days.add(d);
    setSchedule(i, { days: [...days] });
  };

  const save = () => {
    const r = readSubjectForm(form, subjects, subject && subject.id);
    if (r.error) {
      setError(r.error);
      return;
    }
    const saved = subject ? { ...subject, ...r.data } : addSubject(r.data);
    if (subject) updateSubject(subject.id, r.data);
    const items = itemsToLink(study, saved);
    if (items.length) {
      setLink({ subject: saved, items, on: items.map((t) => t.id) });
      return;
    }
    onClose();
    showToast(subject ? 'Matéria salva' : `${saved.name} adicionada`);
  };

  const finishLink = () => {
    const undo = linkItems(link.subject.id, link.on);
    const n = link.on.length;
    onClose();
    showToast(`${n} ${n === 1 ? 'item ligado' : 'itens ligados'} a ${link.subject.name}`, 'Desfazer', undo);
  };

  const archive = () => {
    const undo = archiveSubjects([subject.id]);
    onClose();
    showToast(`${subject.name} arquivada`, 'Desfazer', undo);
  };

  const remove = () => {
    const undo = removeSubject(subject.id);
    onClose();
    showToast(`${subject.name} excluída. As provas e entregas continuam.`, 'Desfazer', undo);
  };

  const header = (
    <View style={[st.top, { paddingTop: insets.top + 12 }]}>
      <View>
        <Text style={[st.kind, { color: pal.main }]}>Estudos</Text>
        <Text style={st.title}>{link ? 'Ligar itens' : subject ? 'Editar matéria' : 'Nova matéria'}</Text>
      </View>
      <Pressable onPress={onClose} hitSlop={12}>
        <Text style={st.close}>Fechar</Text>
      </Pressable>
    </View>
  );

  if (link) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={st.lead}>Estes itens citam {link.subject.name}. Quer ligar a eles?</Text>
          {link.items.map((t) => {
            const on = link.on.includes(t.id);
            return (
              <Pressable key={t.id} style={st.linkRow} onPress={() => setLink((l) => ({ ...l, on: on ? l.on.filter((x) => x !== t.id) : [...l.on, t.id] }))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Check done={on} color={pal.main} onPress={() => setLink((l) => ({ ...l, on: on ? l.on.filter((x) => x !== t.id) : [...l.on, t.id] }))} />
                <Text style={st.linkTitle}>{t.title}</Text>
              </Pressable>
            );
          })}
          <View style={{ height: 12 }} />
          <Button title={link.on.length === 1 ? 'Ligar 1 item' : `Ligar ${link.on.length} itens`} color={pal.main} onPress={finishLink} disabled={!link.on.length} />
          <Button title="Agora não" variant="text" color={colors.mute} onPress={onClose} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      {header}
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Label>Nome</Label>
        <Field value={form.name} onChangeText={(v) => set({ name: v })} placeholder="Cálculo 2" autoFocus={!subject} />
        <Label>Apelidos</Label>
        <Field value={form.aliasesText} onChangeText={(v) => set({ aliasesText: v })} placeholder="calc 2, calculo dois" />
        <Text style={st.help}>Do jeito que você fala, separados por vírgula.</Text>

        <Label>Cor</Label>
        <View style={st.colors}>
          {Array.from({ length: SUBJECT_COUNT }, (_, i) => {
            const c = subjectColor(i);
            const on = form.color === i;
            return (
              <Pressable key={i} onPress={() => set({ color: i })} hitSlop={4} style={[st.swatch, { backgroundColor: c.main }, on && { borderColor: colors.ink }]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.name}>
                {on ? <Text style={st.swatchOn}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Label>Sala (opcional)</Label>
        <Field value={form.room} onChangeText={(v) => set({ room: v })} placeholder="B-204" />

        <Label>Horários</Label>
        {form.schedules.map((h, i) => (
          <View key={i} style={st.schedule}>
            <View style={st.chips}>
              {WEEK_CHIPS.map(([d, label]) => (
                <Chip key={d} label={label} color={pal.main} active={h.days.includes(d)} onPress={() => toggleDay(i, d)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Label>Início</Label>
                <Field value={h.startText} onChangeText={(v) => setSchedule(i, { startText: maskTime(v) })} keyboardType="number-pad" maxLength={5} placeholder="10:00" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Label>Fim</Label>
                <Field value={h.endText} onChangeText={(v) => setSchedule(i, { endText: maskTime(v) })} keyboardType="number-pad" maxLength={5} placeholder="12:00" />
              </View>
              <Pill label="Tirar" color={colors.mute} onPress={() => set({ schedules: form.schedules.filter((_, j) => j !== i) })} />
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 6 }}>
          <Pill label="+ Horário" color={pal.main} onPress={() => set({ schedules: [...form.schedules, emptySchedule()] })} />
        </View>
        {subject && (subject.schedules || []).length ? <Text style={st.help}>{subject.schedules.map(scheduleLabel).join('\n')}</Text> : null}

        {error ? <Text style={st.error}>{error}</Text> : null}
        <View style={{ height: 12 }} />
        <Button title="Salvar" color={pal.main} onPress={save} />
        {subject ? (
          <View>
            <View style={{ height: 6 }} />
            {!subject.archived ? <Button title="Arquivar" variant="text" color={colors.mute} onPress={archive} /> : null}
            <Button title="Excluir" variant="text" color={colors.warn} onPress={remove} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  sec: { marginTop: 22, marginBottom: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  tagText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  card: { flexDirection: 'row', borderRadius: look.rSmall, padding: 14, marginBottom: 10, overflow: 'hidden' },
  band: { width: 4, borderRadius: 2, marginRight: 12 },
  name: { fontSize: 17, fontWeight: '700' },
  cardMeta: { fontSize: 13, color: colors.ink, marginTop: 3 },
  listSimple: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowSimple: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, minHeight: 44 },
  nameSimple: { fontSize: 16, color: colors.ink },
  meta: { fontSize: 13, color: colors.mute, marginTop: 3, lineHeight: 19 },
  link: { fontSize: 14, color: colors.mute, textDecorationLine: 'underline' },
  archivedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  archivedName: { flex: 1, fontSize: 15, color: colors.mute, marginRight: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  kind: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: look.titleSize, fontWeight: look.titleWeight, color: colors.ink, letterSpacing: -0.5 },
  close: { fontSize: 16, color: colors.mute, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 12 },
  help: { fontSize: 13, color: colors.mute, lineHeight: 19, marginBottom: 6, marginTop: 4 },
  error: { fontSize: 14, color: colors.warn, marginTop: 10, lineHeight: 20, fontWeight: '600' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  swatch: { width: 44, height: 44, borderRadius: look.mode === 'simple' ? 4 : 22, marginRight: 10, marginBottom: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { fontSize: 18, fontWeight: '800', color: colors.onAccent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  schedule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingVertical: 10 },
  lead: { fontSize: 16, color: colors.ink, lineHeight: 23, marginBottom: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  linkTitle: { flex: 1, fontSize: 16, color: colors.ink },
});
