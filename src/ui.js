// Peças de tela do Peep. Tudo o que se repete nas telas mora aqui.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput as RNTextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS, makeStyles, useTheme } from './theme';
import { addDays, addMonths, cap, daysInMonth, fromISO, monthLabel, todayISO, toISO, WEEKDAYS_SHORT } from './core/dates';

let fontsOk = false;
export const setFontsOk = (v) => {
  fontsOk = !!v;
};

const VARIANTS = {
  hero: { fontSize: 30, lineHeight: 36, font: 'SpaceGrotesk_700Bold', weight: '700' },
  title: { fontSize: 22, lineHeight: 28, font: 'SpaceGrotesk_700Bold', weight: '700' },
  h: { fontSize: 17, lineHeight: 23, font: 'Inter_600SemiBold', weight: '600' },
  num: { fontSize: 24, lineHeight: 30, font: 'SpaceGrotesk_600SemiBold', weight: '600' },
  b: { fontSize: 15, lineHeight: 21, font: 'Inter_400Regular', weight: '400' },
  m: { fontSize: 15, lineHeight: 21, font: 'Inter_600SemiBold', weight: '600' },
  s: { fontSize: 13, lineHeight: 18, font: 'Inter_400Regular', weight: '400' },
  sm: { fontSize: 13, lineHeight: 18, font: 'Inter_600SemiBold', weight: '600' },
  l: { fontSize: 12, lineHeight: 16, font: 'Inter_600SemiBold', weight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
};
const fontStyle = (v) => {
  const { font, weight, ...rest } = VARIANTS[v] || VARIANTS.b;
  return fontsOk ? { ...rest, fontFamily: font } : { ...rest, fontWeight: weight };
};

// Texto. v = variante, c = cor (nome do tema ou cor direta)
export function T({ v = 'b', c = 'text', style, ...props }) {
  const colors = useTheme();
  return <RNText {...props} style={[fontStyle(v), { color: colors[c] || c }, style]} />;
}

export const Input = React.forwardRef(function Input({ style, v = 'b', ...props }, ref) {
  const c = useTheme();
  return (
    <RNTextInput
      ref={ref}
      placeholderTextColor={c.faint}
      selectionColor={c.task}
      {...props}
      style={[fontStyle(v), { color: c.text, backgroundColor: c.sunken, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 46 }, style]}
    />
  );
});

export function Icon({ name, size = 22, color = 'text', style }) {
  const c = useTheme();
  return <Image source={ICONS[name]} style={[{ width: size, height: size, tintColor: c[color] || color }, style]} />;
}

export function IconBtn({ name, onPress, label, color = 'soft', size = 22, bg, style }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} aria-label={label} hitSlop={6} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ? c[bg] || bg : 'transparent', opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// kind: 'primary' (amarelo), 'solid' (texto), 'soft' (cinza), 'ghost', 'danger'
export function Btn({ label, onPress, kind = 'primary', icon, disabled, style, small }) {
  const c = useTheme();
  const bg = { primary: c.brand, solid: c.text, soft: c.sunken, ghost: 'transparent', danger: c.dangerBg }[kind];
  const fg = { primary: c.onBrand, solid: c.bg, soft: c.text, ghost: c.soft, danger: c.danger }[kind];
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} aria-label={label} style={({ pressed }) => [{ minHeight: small ? 38 : 50, paddingHorizontal: small ? 14 : 18, borderRadius: small ? 19 : 14, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      {icon ? <Icon name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <T v={small ? 'sm' : 'm'} c={fg}>
        {label}
      </T>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, color, icon, style }) {
  const c = useTheme();
  const tint = color ? c[color] || color : c.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} accessibilityLabel={label} aria-label={label} style={({ pressed }) => [{ minHeight: 38, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1.5, borderColor: on ? tint : c.line, backgroundColor: on ? tint : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }, style]}>
      {icon ? <Icon name={icon} size={15} color={on ? c.bg : tint} /> : null}
      <T v="sm" c={on ? c.bg : c.text}>
        {label}
      </T>
    </Pressable>
  );
}

export const Row = ({ style, gap = 8, wrap, ...p }) => <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]} />;

export function Card({ style, children, onPress, tone }) {
  const c = useTheme();
  const s = [{ backgroundColor: tone ? c[tone] : c.card, borderRadius: 18, padding: 16 }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.8 : 1 }]}>
      {children}
    </Pressable>
  );
}

export const Label = ({ children, style }) => (
  <T v="l" c="faint" style={[{ marginBottom: 8, marginTop: 18 }, style]}>
    {children}
  </T>
);

// Bolinha de concluir
export function Check({ done, onPress, color = 'task', label }) {
  const c = useTheme();
  const tint = c[color] || color;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} accessibilityLabel={label} aria-label={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -9 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: tint, backgroundColor: done ? tint : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{done ? <Icon name="check" size={16} color={c.card} /> : null}</View>
    </Pressable>
  );
}

export function Bar({ value, color = 'money', height = 8 }) {
  const c = useTheme();
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.sunken, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: c[color] || color }} />
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={o.label} aria-label={o.label} style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.card : 'transparent' }}>
            <T v="sm" c={on ? 'text' : 'soft'}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// Folha que sobe de baixo. Fica dentro do app (não é Modal), então avisos aparecem por cima dela.
export function Sheet({ title, onClose, children, footer, full, scroll = true }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(40)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([Animated.timing(y, { toValue: 0, duration: 180, useNativeDriver: true }), Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: true })]).start();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, []);
  const Body = scroll ? ScrollView : View;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: o }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" aria-label="Fechar" />
      </Animated.View>
      <Animated.View style={{ marginTop: 'auto', maxHeight: full ? '100%' : '92%', height: full ? '100%' : undefined, backgroundColor: c.bg, borderTopLeftRadius: full ? 0 : 24, borderTopRightRadius: full ? 0 : 24, paddingTop: full ? insets.top : 0, transform: [{ translateY: y }], opacity: o }}>
        <Row style={{ paddingLeft: 20, paddingRight: 8, paddingTop: 10, minHeight: 56 }}>
          <T v="title" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </T>
          <IconBtn name="close" label="Fechar" onPress={onClose} />
        </Row>
        <Body style={scroll ? { flexGrow: 0, flexShrink: 1 } : { flexShrink: 1 }} contentContainerStyle={scroll ? { paddingHorizontal: 20, paddingBottom: 20 } : undefined} keyboardShouldPersistTaps="handled">
          {children}
        </Body>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14) + 2, borderTopWidth: 1, borderTopColor: c.line }}>{footer}</View> : <View style={{ height: Math.max(insets.bottom, 12) }} />}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ───────── escolher dia e hora ─────────

export function DayPicker({ value, onChange, allowNone = true }) {
  const c = useTheme();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const quick = [];
  if (allowNone) quick.push({ label: 'Sem data', v: null });
  quick.push({ label: 'Hoje', v: today }, { label: 'Amanhã', v: addDays(today, 1) });
  for (let i = 2; i <= 6; i++) {
    const d = addDays(today, i);
    quick.push({ label: `${cap(WEEKDAYS_SHORT[fromISO(d).getDay()])} ${fromISO(d).getDate()}`, v: d });
  }
  const inQuick = quick.some((q) => q.v === value);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(y, m - 1); d++) cells.push(toISO(new Date(y, m - 1, d)));
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} keyboardShouldPersistTaps="handled">
        {quick.map((q) => (
          <Chip key={q.label} label={q.label} on={value === q.v && !open} onPress={() => { setOpen(false); onChange(q.v); }} />
        ))}
        <Chip label={!inQuick && value ? `${fromISO(value).getDate()}/${fromISO(value).getMonth() + 1}` : 'Outro dia'} icon="calendar" on={open || (!inQuick && !!value)} onPress={() => setOpen(!open)} />
      </ScrollView>
      {open ? (
        <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 12, marginTop: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconBtn name="back" label="Mês anterior" onPress={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))} />
            <T v="m">{monthLabel(month)}</T>
            <IconBtn name="next" label="Próximo mês" onPress={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))} />
          </Row>
          <Row gap={0}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <T key={i} v="s" c="faint" style={{ width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 4 }}>
                {d}
              </T>
            ))}
          </Row>
          <Row gap={0} wrap>
            {cells.map((iso, i) => {
              const on = iso && iso === value;
              return (
                <Pressable key={i} disabled={!iso} onPress={() => { onChange(iso); setOpen(false); }} accessibilityLabel={iso ? `Dia ${fromISO(iso).getDate()}` : undefined} style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                  {iso ? (
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.text : 'transparent', borderWidth: iso === today && !on ? 1.5 : 0, borderColor: c.line }}>
                      <T v={on ? 'sm' : 's'} c={on ? 'bg' : iso < today ? 'faint' : 'text'}>
                        {fromISO(iso).getDate()}
                      </T>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Row>
        </View>
      ) : null}
    </View>
  );
}

// "930" vira "09:30", "14" vira "14:00"
export function normalizeTime(text) {
  const d = String(text || '').replace(/\D/g, '');
  if (!d) return null;
  let h;
  let m;
  if (d.length <= 2) [h, m] = [Number(d), 0];
  else if (d.length === 3) [h, m] = [Number(d[0]), Number(d.slice(1))];
  else [h, m] = [Number(d.slice(0, 2)), Number(d.slice(2, 4))];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TimeInput({ value, onChange, placeholder = 'Sem hora', style, label = 'Horário' }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const commit = () => {
    const t = normalizeTime(text);
    setText(t || '');
    if (t !== (value || null)) onChange(t);
  };
  return <Input value={text} onChangeText={(t) => setText(t.replace(/[^\d:h]/g, '').slice(0, 5))} onBlur={commit} onSubmitEditing={commit} keyboardType="number-pad" placeholder={placeholder} accessibilityLabel={label} aria-label={label} style={[{ width: 104, textAlign: 'center' }, style]} />;
}

export const Empty = ({ icon = 'spark', title, text, children }) => (
  <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 8 }}>
    <Icon name={icon} size={30} color="faint" />
    <T v="h" style={{ textAlign: 'center' }}>
      {title}
    </T>
    {text ? (
      <T c="soft" style={{ textAlign: 'center' }}>
        {text}
      </T>
    ) : null}
    {children}
  </View>
);

export const useScreenStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  divider: { height: 1, backgroundColor: c.line },
}));
