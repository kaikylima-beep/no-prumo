// Contagem do aviso de teste (1.10.1). Aparece no meio da tela quando você escolhe
// "Som e vibração" ou "Só vibração" em Ajustes: conta 5, 4, 3, 2, 1 enquanto o aviso
// de teste não chega, e depois explica o que fazer se ele só tocou e não apareceu.
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Easing, Linking, Platform, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, look } from '../theme';

const AFTER_MS = 6000; // depois que o aviso chega, o cartão fica mais 6 s

export default function AlertPreview({ preview, onClose }) {
  // preview = { style: 'som' | 'vibrar', seconds, key } ou null
  const [left, setLeft] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!preview) return undefined;
    setLeft(preview.seconds);
    const tick = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    const done = setTimeout(onClose, preview.seconds * 1000 + AFTER_MS);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: native }),
      ])
    );
    loop.start();
    return () => {
      clearInterval(tick);
      clearTimeout(done);
      loop.stop();
    };
  }, [preview && preview.key]);

  if (!preview) return null;
  const arrived = left <= 0;
  const how = preview.style === 'vibrar' ? 'só com vibração' : 'com som e vibração';
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, arrived ? 1 : 1.08] });

  return (
    <Pressable style={st.dim} onPress={onClose} accessibilityLabel="Fechar">
      <Pressable style={st.card} onPress={() => {}} accessibilityLiveRegion="polite">
        <Animated.View style={[st.ring, { transform: [{ scale }] }, arrived && { backgroundColor: colors.ink }]}>
          <Text style={[st.count, arrived && { color: colors.onInk, fontSize: 18 }]}>{arrived ? 'Já!' : left}</Text>
        </Animated.View>
        {arrived ? (
          <>
            <Text style={st.title}>Chegou?</Text>
            <Text style={st.body}>O aviso aparece no topo da tela, {how}, igual aos seus lembretes.</Text>
            {preview.vibrationOff ? (
              <Text style={[st.help, { color: colors.ink, fontWeight: '700' }]}>
                A vibração está desligada nas notificações do Prumo. Abra os ajustes para ligar.
              </Text>
            ) : (
              <Text style={st.help}>Se não vibrou, confira se o celular não está no modo silencioso ou no Não perturbe.</Text>
            )}
            <Text style={st.help}>
              Se só tocou e não apareceu, abra os ajustes e ligue “Mostrar como pop-up” (ou “Estilo pop-up”) nas notificações do Prumo.
            </Text>
            <View style={st.row}>
              {Platform.OS !== 'web' ? (
                <Pressable style={[st.btn, st.btnGhost]} onPress={() => Linking.openSettings()} accessibilityRole="button">
                  <Text style={st.btnGhostText}>Abrir ajustes</Text>
                </Pressable>
              ) : null}
              <Pressable style={st.btn} onPress={onClose} accessibilityRole="button">
                <Text style={st.btnText}>Entendi</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={st.title}>Seu aviso de teste chega em {left} s</Text>
            <Text style={st.body}>Fique de olho no topo da tela. Ele vem {how}.</Text>
          </>
        )}
      </Pressable>
    </Pressable>
  );
}

const st = StyleSheet.create({
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 40,
    elevation: 40,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: look.rCard || 20,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  count: { fontSize: 32, fontWeight: '700', color: colors.ink },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 15, color: colors.mute, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  help: { fontSize: 13, color: colors.mute, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  row: { flexDirection: 'row', marginTop: 18, gap: 10 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.onInk, fontWeight: '700', fontSize: 15 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  btnGhostText: { color: colors.ink, fontWeight: '600', fontSize: 15 },
});
