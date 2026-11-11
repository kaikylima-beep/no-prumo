// Cartão de entrada: aparece ao abrir o app (ou ao voltar depois de um tempo).
// 1.10.1: saudação e pendências aparecem JUNTAS, na hora, embaixo (no lugar dos
// avisos de Desfazer). Antes as pendências chegavam 2 s depois e o cartão ficava
// em cima do título da tela.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Animated, AppState, Platform, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors } from '../theme';
import { useData } from '../store';
import { entryMessages } from '../greeting';
import { budgetEntryMessage } from '../budget';
import { budgetFor } from '../insights';
import { todayISO } from '../utils';

const BASE_MS = 3200; // saudação + primeira mensagem
const MESSAGE_MS = 1800; // cada mensagem a mais
const MAX_MESSAGES = 2;
const AWAY_MS = 10 * 60 * 1000; // volta a cumprimentar depois de 10 min fora

export default function EntryGreeting({ bottom }) {
  const { loaded, needsOnboarding, tasks, study, finance, settings, areaOrder, palettes, accounts } = useData();
  const [entry, setEntry] = useState(null); // { greeting, messages }
  const opacity = useRef(new Animated.Value(0)).current;
  const timers = useRef([]);
  const dataRef = useRef({});
  dataRef.current = { tasks, study, finance, accounts: accounts || [], name: settings.profile.name, order: areaOrder, budget: settings.budget, level: settings.levels.finance };
  const native = Platform.OS !== 'web';

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const hide = () => {
    clear();
    Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: native }).start(() => setEntry(null));
  };

  const show = () => {
    const d = dataRef.current;
    const now = new Date();
    const ymNow = todayISO().slice(0, 7);
    const b = budgetFor(d.finance, d.accounts, d.budget, ymNow, todayISO(), now);
    const extra = budgetEntryMessage(b, d.level);
    const e = entryMessages({ tasks: d.tasks, study: d.study, finance: d.finance }, d.name, d.order, now, [extra]);
    const messages = e.messages.slice(0, MAX_MESSAGES);
    clear();
    setEntry({ ...e, messages });
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: native }).start();
    timers.current.push(setTimeout(hide, BASE_MS + MESSAGE_MS * Math.max(0, messages.length - 1)));
  };

  // ao abrir o app (depois de carregar os dados e da primeira abertura)
  const shown = useRef(false);
  useEffect(() => {
    if (loaded && !needsOnboarding && !shown.current) {
      shown.current = true;
      show();
    }
  }, [loaded, needsOnboarding]);

  // ao voltar depois de um tempo fora
  useEffect(() => {
    let leftAt = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt = Date.now();
      if (state === 'active' && leftAt && Date.now() - leftAt >= AWAY_MS && shown.current) show();
    });
    return () => {
      sub.remove();
      clear();
    };
  }, []);

  if (!entry) return null;
  const accent = palettes[areaOrder[0]] ? palettes[areaOrder[0]].main : colors.ink;

  return (
    <Animated.View style={[st.wrap, { bottom, opacity }]} pointerEvents="box-none">
      <Pressable onPress={hide} style={st.card} accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityHint="Toque para fechar">
        <Text style={[st.greeting, { color: accent }]}>{entry.greeting}</Text>
        {entry.messages.map((m) => (
          <Text key={m} style={st.message}>
            {m}
          </Text>
        ))}
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  greeting: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  message: { fontSize: 15, color: colors.ink, marginTop: 4, lineHeight: 21 },
});
