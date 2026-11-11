// "Além dos estudos, você…" e "Seu estado" (1.12). Usado em Ajustes e na primeira abertura.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors } from '../theme';
import { Field, Label, Chip } from '../ui';
import { OCCUPATIONS } from '../subjects';
import { STATES } from '../holidays';

export default function AboutFields({ value, onChange }) {
  return (
    <View>
      <Label>Além dos estudos, você…</Label>
      <View style={st.chips}>
        {OCCUPATIONS.map((o) => (
          <Chip key={o.key} label={o.label} active={value.occupation === o.key} onPress={() => onChange({ occupation: o.key })} />
        ))}
      </View>
      {value.occupation === 'outros' ? (
        <Field
          value={value.occupationName}
          onChangeText={(v) => onChange({ occupationName: v })}
          placeholder="Qual? Ex.: Monitoria, Freela"
          maxLength={24}
        />
      ) : null}
      <Text style={st.help}>
        {value.occupation === 'so_estudo'
          ? 'O app não vai perguntar se uma entrega é da faculdade ou de outra coisa.'
          : 'Serve para o app perguntar se um relatório ou uma entrega é da faculdade ou não.'}
      </Text>

      <Label>Seu estado</Label>
      <View style={st.chips}>
        {STATES.map(([uf, name]) => (
          <Chip key={uf} label={uf} a11y={name} active={value.state === uf} onPress={() => onChange({ state: value.state === uf ? null : uf })} />
        ))}
      </View>
      <Text style={st.help}>Para mostrar os feriados do seu estado no calendário.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  help: { fontSize: 13, color: colors.mute, lineHeight: 19, marginBottom: 10 },
});
