// Linha que dá para arrastar para o lado:
//   → direita: concluir (fundo da cor da área, "✓ Feito")
//   ← esquerda: excluir (fundo vermelho, "Excluir")
// Feito com PanResponder e Animated do próprio React Native (sem biblioteca nativa nova).
// Só pega o gesto quando ele é claramente horizontal, para não atrapalhar a rolagem.
import React, { useRef } from 'react';
import { View, Animated, PanResponder, Dimensions, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors } from '../theme';

const THRESHOLD = 88;
const DANGER = '#B42318';

export default function SwipeRow({ children, onComplete, onDelete, completeLabel = '✓ Feito', color = colors.ink, onSwipeStart }) {
  const x = useRef(new Animated.Value(0)).current;
  const width = Dimensions.get('window').width;
  const cb = useRef({});
  cb.current = { onComplete, onDelete, onSwipeStart };

  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 22 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
      onPanResponderGrant: () => cb.current.onSwipeStart && cb.current.onSwipeStart(),
      onPanResponderMove: (_, g) => {
        // sem ação para um lado, o arrasto fica curto e volta
        const allowRight = !!cb.current.onComplete;
        const allowLeft = !!cb.current.onDelete;
        let dx = g.dx;
        if ((dx > 0 && !allowRight) || (dx < 0 && !allowLeft)) dx = dx / 5;
        x.setValue(dx);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        const fast = Math.abs(g.vx) > 0.8;
        if ((g.dx > THRESHOLD || (fast && g.dx > 40)) && cb.current.onComplete) {
          Animated.timing(x, { toValue: width, duration: 160, useNativeDriver: true }).start(() => {
            x.setValue(0);
            cb.current.onComplete();
          });
        } else if ((g.dx < -THRESHOLD || (fast && g.dx < -40)) && cb.current.onDelete) {
          Animated.timing(x, { toValue: -width, duration: 160, useNativeDriver: true }).start(() => {
            x.setValue(0);
            cb.current.onDelete();
          });
        } else reset();
      },
      onPanResponderTerminate: reset,
    })
  ).current;

  const rightOpacity = x.interpolate({ inputRange: [0, 30, THRESHOLD], outputRange: [0, 0.6, 1], extrapolate: 'clamp' });
  const leftOpacity = x.interpolate({ inputRange: [-THRESHOLD, -30, 0], outputRange: [1, 0.6, 0], extrapolate: 'clamp' });

  return (
    <View style={st.wrap}>
      <Animated.View style={[st.under, { backgroundColor: color, opacity: rightOpacity }]} pointerEvents="none">
        <Text style={st.underText}>{completeLabel}</Text>
      </Animated.View>
      <Animated.View style={[st.under, st.underLeft, { backgroundColor: DANGER, opacity: leftOpacity }]} pointerEvents="none">
        <Text style={st.underText}>Excluir</Text>
      </Animated.View>
      <Animated.View style={[st.front, { transform: [{ translateX: x }] }]} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  under: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12 },
  underLeft: { alignItems: 'flex-end' },
  underText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  front: { backgroundColor: colors.bg },
});
