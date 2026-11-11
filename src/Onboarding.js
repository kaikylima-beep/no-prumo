// Primeira abertura: uma tela só.
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Btn, Icon, Input, Row, T } from './ui';
import { useStore } from './store';
import { ensure } from './notify';

const POINTS = [
  ['mic', 'Fale do seu jeito', 'Tarefa, prova, aula e conta na mesma frase. Eu separo.'],
  ['today', 'Veja o seu dia', 'Aulas, compromissos e prazos numa tela só, na ordem.'],
  ['bell', 'Seja avisado na hora', 'Antes da prova, antes da aula e antes de a conta vencer.'],
];

export default function Onboarding() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { setSettings } = useStore();
  const [name, setName] = useState('');
  const start = async () => {
    await ensure(true);
    setSettings({ name: name.trim(), onboarded: true });
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: 24 }}>
      <Image source={require('../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 20 }} />
      <T v="hero" style={{ marginTop: 18 }}>
        Oi, eu sou o Peep.
      </T>
      <T c="soft" style={{ marginTop: 6 }}>
        Você fala, eu organizo. Tudo fica só no seu celular.
      </T>
      <View style={{ marginTop: 26, gap: 18 }}>
        {POINTS.map(([icon, title, text]) => (
          <Row key={title} gap={14} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h">{title}</T>
              <T c="soft">{text}</T>
            </View>
          </Row>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Input value={name} onChangeText={setName} placeholder="Como posso te chamar? (opcional)" accessibilityLabel="Seu nome" aria-label="Seu nome" returnKeyType="done" onSubmitEditing={start} />
      <Btn label="Começar" onPress={start} style={{ marginTop: 12 }} />
    </KeyboardAvoidingView>
  );
}
