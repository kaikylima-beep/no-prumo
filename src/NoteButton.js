// Botão flutuante de apontamentos (só no modo de teste). Arrasta para qualquer canto; o lugar fica lembrado.
import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon } from './ui';

const SIZE = 48;

export default function NoteButton({ pos, onMove, onPress, hidden }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const start = pos || { x: width - SIZE - 14, y: height - insets.bottom - 160 };
  const xy = useRef(new Animated.ValueXY(start)).current;
  const last = useRef(start);
  const clamp = (p) => ({ x: Math.max(6, Math.min(width - SIZE - 6, p.x)), y: Math.max(insets.top + 6, Math.min(height - insets.bottom - SIZE - 70, p.y)) });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (e, g) => xy.setValue({ x: last.current.x + g.dx, y: last.current.y + g.dy }),
        onPanResponderRelease: (e, g) => {
          // toque curto = abrir; arrasto = mudar de lugar
          if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
            xy.setValue(last.current);
            onPress();
            return;
          }
          const p = clamp({ x: last.current.x + g.dx, y: last.current.y + g.dy });
          last.current = p;
          Animated.spring(xy, { toValue: p, useNativeDriver: false }).start();
          onMove(p);
        },
      }),
    [width, height, onPress]
  );
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Anotar bug ou melhoria"
      aria-label="Anotar bug ou melhoria"
      style={{ position: 'absolute', left: 0, top: 0, transform: xy.getTranslateTransform(), width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: c.warn, alignItems: 'center', justifyContent: 'center', opacity: hidden ? 0 : 0.92, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
    >
      <View pointerEvents="none">
        <Icon name="edit" size={22} color={c.bg} />
      </View>
    </Animated.View>
  );
}
