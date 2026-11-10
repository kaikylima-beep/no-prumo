// 1.13 · Regras da faculdade (Ajustes → Ajustar perfil). Cada faculdade tem as suas:
// média para passar, nota máxima, duração de uma aula e limite de faltas.
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors } from '../theme';
import { Field, Label } from '../ui';
import { parseGrade } from '../academic';

const FIELDS = [
  { key: 'passGrade', label: 'Média para passar', placeholder: '6', min: 0, max: 100 },
  { key: 'maxGrade', label: 'Nota máxima', placeholder: '10', min: 1, max: 100 },
  { key: 'classMinutes', label: 'Duração de uma aula (min)', placeholder: '50', min: 10, max: 240, int: true },
  { key: 'absencePct', label: 'Limite de faltas (%)', placeholder: '25', min: 1, max: 100, int: true },
];

const show = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

export default function AcademicFields({ value, onChange }) {
  const [text, setText] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, show(value[f.key])])));
  const change = (f, v) => {
    setText((t) => ({ ...t, [f.key]: v }));
    const n = f.int ? (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null) : parseGrade(v);
    if (n !== null && n >= f.min && n <= f.max) onChange({ [f.key]: n });
  };
  return (
    <View>
      <Text style={st.title}>Faculdade</Text>
      <View style={st.grid}>
        {FIELDS.map((f) => (
          <View key={f.key} style={st.cell}>
            <Label>{f.label}</Label>
            <Field value={text[f.key]} onChangeText={(v) => change(f, v)} keyboardType="decimal-pad" placeholder={f.placeholder} maxLength={5} accessibilityLabel={f.label} />
          </View>
        ))}
      </View>
      <Text style={st.help}>
        Na UTFPR: média 6, nota máxima 10, aula de 50 minutos e até 25% de faltas. Um horário de 100 minutos conta como 2 aulas: faltar nele são 2 faltas.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { width: '50%', paddingHorizontal: 6 },
  help: { fontSize: 13, color: colors.mute, marginTop: 8, lineHeight: 18 },
});
