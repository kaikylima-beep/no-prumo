// Ondas de áudio enquanto o microfone escuta.
// As barras seguem o volume real da voz (evento "volumechange" do reconhecimento).
// Se o aparelho não mandar volume, as barras se mexem suavemente sozinhas.
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

const BARS = 13;
// formato de onda: mais alto no meio
const SHAPE = Array.from({ length: BARS }, (_, i) => 0.45 + 0.55 * Math.sin(((i + 0.5) / BARS) * Math.PI));

export default function Waveform({ active, color, levelRef, height = 56 }) {
  const values = useMemo(() => SHAPE.map(() => new Animated.Value(0.12)), []);
  const lastEvent = useRef(0);

  useEffect(() => {
    if (!active) {
      Animated.parallel(values.map((v) => Animated.timing(v, { toValue: 0.12, duration: 220, useNativeDriver: true }))).start();
      return undefined;
    }
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const ref = levelRef && levelRef.current;
      const fresh = ref && Date.now() - ref.at < 500;
      // volume -2..10 → 0..1; sem volume, uma "respiração" leve
      const level = fresh ? Math.max(0, Math.min(1, (ref.value + 2) / 12)) : 0.25 + 0.15 * Math.sin(t / 3);
      if (fresh) lastEvent.current = ref.at;
      const anims = values.map((v, i) => {
        const jitter = 0.65 + 0.35 * Math.abs(Math.sin(t * 0.9 + i * 1.7));
        const to = Math.max(0.12, Math.min(1, SHAPE[i] * (0.2 + level * 0.95) * jitter));
        return Animated.timing(v, { toValue: to, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true });
      });
      Animated.parallel(anims).start();
    }, 110);
    return () => clearInterval(id);
  }, [active]);

  return (
    <View style={[st.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((v, i) => (
        <Animated.View key={i} style={[st.bar, { height, backgroundColor: color, transform: [{ scaleY: v }] }]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bar: { width: 5, borderRadius: 3, marginHorizontal: 3 },
});
