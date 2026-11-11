import React from 'react';
import { View, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import { Text, TextInput } from './AppText';
import { colors, look, AREA_PAL } from './theme';
import { useData } from './store';
import { useUI } from './uiContext';

// ícones desenhados (PNG brancos, pintados com tintColor)
export const ICONS = {
  task: require('../assets/ui/tab_task.png'),
  finance: require('../assets/ui/tab_finance.png'),
  study: require('../assets/ui/tab_study.png'),
  calendar: require('../assets/ui/tab_calendar.png'),
  menu: require('../assets/ui/tab_menu.png'),
  insights: require('../assets/ui/ic_insights.png'),
  import: require('../assets/ui/ic_import.png'),
  close: require('../assets/ui/ic_close.png'),
  eye: require('../assets/ui/ic_eye.png'),
  eyeOff: require('../assets/ui/ic_eye_off.png'),
};
export const MIC_IMAGE = require('../assets/ui/mic.png');
export const GLYPH_IMAGE = require('../assets/ui/glyph.png');

export function Icon({ name, size = 22, color = colors.ink, style }) {
  return <Image source={ICONS[name]} style={[{ width: size, height: size, tintColor: color }, style]} accessibilityIgnoresInvertColors />;
}

// Botão redondo de ícone no cabeçalho (Indicadores, Importar)
export function IconButton({ name, onPress, label, color = colors.ink }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [look.mode === 'simple' ? s.iconBtnSimple : s.iconBtn, pressed && { opacity: 0.6 }]}
    >
      <Icon name={name} size={22} color={color} />
    </Pressable>
  );
}

// Tela com cabeçalho. Avançado: linha de cima (saudação/mês), título grande e, à direita,
// os botões da tela (actions) e a foto do perfil. Simples: título menor, sem foto.
export function Screen({ title, subtitle, accent, header, children, right, actions }) {
  const { settings, simple } = useData();
  const { openDrawer } = useUI();
  return (
    <ScrollView contentContainerStyle={[s.content, simple && s.contentSimple]} keyboardShouldPersistTaps="handled">
      {simple ? (
        <View style={s.simpleHead}>
          <View style={s.titleRow}>
            <Text style={s.title} accessibilityRole="header">{title}</Text>
            <View style={{ flex: 1 }} />
            {actions}
            {right}
          </View>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : (
        <View style={s.advHead}>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <View style={s.titleRow}>
            <Text style={s.title} accessibilityRole="header">{title}</Text>
            <View style={{ flex: 1 }} />
            {right}
            {actions}
            <Pressable onPress={openDrawer} hitSlop={6} accessibilityLabel="Abrir perfil e configurações" style={{ marginLeft: 8 }}>
              <Avatar photo={settings.profile.photo} name={settings.profile.name} size={44} color={accent} />
            </Pressable>
          </View>
        </View>
      )}
      {header}
      {children}
    </ScrollView>
  );
}

// Bloco de destaque da tela. Avançado: cartão cheio na cor da área. Simples: fundo claro da área.
export function Hero({ area = 'task', children, style }) {
  const p = AREA_PAL[area];
  if (look.mode === 'simple') return <View style={[s.heroSimple, { backgroundColor: p.tint }, style]}>{children}</View>;
  return <View style={[s.hero, { backgroundColor: p.heroBg, borderColor: p.heroLine }, style]}>{children}</View>;
}
// cores do texto dentro do Hero
export function heroText(area) {
  const p = AREA_PAL[area];
  if (look.mode === 'simple') return { ink: colors.ink, soft: colors.mute, label: p.main, tile: colors.bg };
  return { ink: p.heroInk, soft: p.heroSoft, label: p.heroSoft, tile: p.heroTile };
}

// Cartão (Avançado) ou bloco solto com espaço em volta (Simples)
export function Card({ children, style }) {
  return <View style={[look.mode === 'simple' ? s.cardSimple : s.card, style]}>{children}</View>;
}

// Lista com linhas finas: num cartão branco (Avançado) ou entre linhas (Simples)
export function ListBox({ children, style }) {
  return <View style={[look.mode === 'simple' ? s.listSimple : s.list, style]}>{children}</View>;
}

// Título de seção
export function Section({ children, right, style }) {
  return (
    <View style={[s.sectionRow, style]}>
      <Text style={s.sectionText}>{children}</Text>
      {right}
    </View>
  );
}

// Abas dentro da tela (Resumo / Recebimentos): pílulas (Avançado) ou sublinhado (Simples)
export function Segmented({ options, value, onChange, color = colors.ink }) {
  const simple = look.mode === 'simple';
  return (
    <View style={simple ? s.segSimple : s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={simple ? [s.segItemSimple, on && { borderBottomColor: color }] : [s.segItem, on && s.segItemOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Aviso amarelo ("Internet vence amanhã")
export function Notice({ title, sub, action, onAction }) {
  return (
    <View style={s.alert}>
      <View style={{ flex: 1 }}>
        <Text style={s.alertTitle}>{title}</Text>
        {sub ? <Text style={s.alertSub}>{sub}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} style={({ pressed }) => [s.alertBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={s.alertBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Botão do microfone (anel nas três cores e o ícone no meio)
export function MicButton({ onPress, size = look.mic, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Falar com o No Prumo"
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }, style]}
    >
      <Image source={MIC_IMAGE} style={{ width: size, height: size }} />
    </Pressable>
  );
}

export function Avatar({ photo, name, size = 36, color = colors.ink }) {
  const initial = (name || '').trim().charAt(0).toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (photo) return <Image source={{ uri: photo }} style={[box, { backgroundColor: colors.soft }]} />;
  return (
    <View style={[box, s.avatarEmpty]}>
      {initial ? (
        <Text style={{ fontSize: size * 0.4, fontWeight: '600', color }}>{initial}</Text>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: colors.mute }} />
          <View
            style={{
              width: size * 0.52,
              height: size * 0.22,
              borderTopLeftRadius: size,
              borderTopRightRadius: size,
              backgroundColor: colors.mute,
              marginTop: size * 0.05,
            }}
          />
        </View>
      )}
    </View>
  );
}

export function Row({ onPress, children, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }, style]}>
      {children}
    </Pressable>
  );
}

export function Check({ done, onPress, color = colors.ink }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={[s.check, { borderColor: color }, done && { backgroundColor: color }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!done }}
    >
      {done ? <Text style={s.checkMark}>✓</Text> : null}
    </Pressable>
  );
}

export function Remove({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={s.remove} accessibilityLabel="Excluir">
      <Text style={s.removeText}>×</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, disabled, variant = 'solid', color = colors.ink }) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        solid ? { backgroundColor: color } : s.btnText,
        look.mode === 'simple' && { borderRadius: 4 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: color },
        { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[s.btnLabel, !solid && { color }]}>{title}</Text>
    </Pressable>
  );
}

// Botão pequeno em forma de pílula ("Pagar", "Hoje")
export function Pill({ label, onPress, color = colors.ink, filled }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        s.pill,
        { borderColor: color },
        filled && { backgroundColor: color },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.pillText, { color: filled ? colors.onAccent : color }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props) {
  return (
    <TextInput
      placeholderTextColor={colors.mute}
      {...props}
      style={[s.input, props.multiline && s.multiline, props.style]}
    />
  );
}

export function Label({ children, style }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Toggle({ options, value, onChange, color = colors.ink }) {
  return (
    <View style={s.toggle}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={s.toggleItem} hitSlop={6}>
            <Text style={[s.toggleText, active && { color }]}>{o.label}</Text>
            <View style={[s.toggleBar, active && { backgroundColor: color }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, color = colors.ink, a11y }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: color, borderColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={a11y || label}
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[s.chipText, active && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ text }) {
  return <Text style={s.empty}>{text}</Text>;
}

export function Dot({ color, size = 7, style }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

// O ícone do No Prumo (Blocão), para a tela de captura
export function MicIcon({ size = 28 }) {
  return <Image source={GLYPH_IMAGE} style={{ width: size * 0.58, height: size }} />;
}

const SIMPLE = look.mode === 'simple';
export const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  contentSimple: { paddingTop: 22 },
  advHead: { marginBottom: 14 },
  simpleHead: { marginBottom: 16 },
  subtitle: { fontSize: SIMPLE ? 14 : 15, color: colors.mute, marginBottom: SIMPLE ? 0 : 2, marginTop: SIMPLE ? 2 : 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  title: { fontSize: look.titleSize, fontWeight: look.titleWeight, color: colors.ink, letterSpacing: SIMPLE ? -0.2 : -0.6 },
  titleDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8, marginTop: 8 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  iconBtnSimple: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  hero: { borderRadius: look.rHero, padding: 20, borderWidth: look.dark ? 1 : 0 },
  heroSimple: { borderRadius: 4, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  card: { marginTop: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: look.rCard, padding: 16 },
  cardSimple: { marginTop: 26 },
  list: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: look.rCard, paddingHorizontal: 16, overflow: 'hidden' },
  listSimple: { borderTopWidth: 1, borderTopColor: colors.line },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SIMPLE ? 28 : 20, marginBottom: 8 },
  sectionText: SIMPLE
    ? { fontSize: 13, fontWeight: '500', color: colors.mute }
    : { fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: colors.faint },
  seg: { flexDirection: 'row', backgroundColor: colors.soft, borderRadius: 14, padding: 4, marginBottom: 14 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: colors.card },
  segSimple: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 22 },
  segItemSimple: { minHeight: 44, justifyContent: 'center', marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  segText: { fontSize: 15, fontWeight: '500', color: colors.mute },
  segTextOn: { color: colors.ink, fontWeight: SIMPLE ? '500' : '600' },
  alert: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.alertBg, borderRadius: SIMPLE ? 4 : 18,
    borderWidth: look.dark && !SIMPLE ? 1 : 0, borderColor: colors.alertLine, paddingVertical: 12, paddingLeft: 16, paddingRight: 10, marginTop: 12,
  },
  alertTitle: { fontSize: 16, fontWeight: SIMPLE ? '400' : '600', color: colors.alertInk },
  alertSub: { fontSize: 14, color: colors.alertSub, marginTop: 2, fontWeight: SIMPLE ? '500' : '400' },
  alertBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: look.rPill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  alertBtnText: { fontSize: 14, fontWeight: SIMPLE ? '500' : '600', color: colors.onInk },
  avatarEmpty: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: SIMPLE ? 4 : 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkMark: { color: colors.onAccent, fontSize: 12, fontWeight: '800', marginTop: -1 },
  remove: { paddingLeft: 14 },
  removeText: { fontSize: 24, color: colors.mute, lineHeight: 24 },
  btn: { minHeight: 52, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { backgroundColor: 'transparent' },
  btnLabel: { color: colors.onAccent, fontSize: 16, fontWeight: SIMPLE ? '500' : '600' },
  pill: { borderWidth: 1.5, borderRadius: look.rPill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.card },
  pillText: { fontSize: 13, fontWeight: SIMPLE ? '500' : '600' },
  input: {
    fontSize: 17,
    color: colors.ink,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 12,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  label: {
    fontSize: 12,
    color: colors.mute,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  toggle: { flexDirection: 'row', marginBottom: 12 },
  toggleItem: { marginRight: 22 },
  toggleText: { fontSize: 15, fontWeight: '600', color: colors.mute, paddingBottom: 4 },
  toggleBar: { height: 2, backgroundColor: 'transparent', borderRadius: 1 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: look.rPill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  empty: { color: colors.mute, fontSize: 15, lineHeight: 22, marginTop: 8 },
  section: SIMPLE
    ? { fontSize: 13, color: colors.mute, fontWeight: '500', marginBottom: 2 }
    : { fontSize: 13, color: colors.faint, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  itemTitle: { fontSize: SIMPLE ? 16 : 17, fontWeight: SIMPLE ? '400' : '500', color: colors.ink },
  itemTitleDone: { color: colors.mute, textDecorationLine: 'line-through' },
  meta: { fontSize: 13, color: colors.mute, marginTop: 3 },
});
