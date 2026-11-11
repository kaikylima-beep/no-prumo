// Cores do No Prumo. Dois visuais, cada um claro ou escuro:
//   Avançado (visual 1): cartões coloridos, cantos bem redondos, Space Grotesk nos números e títulos.
//   Simples (visual 3): calmo, um bloco de destaque por tela, listas com linhas finas, cantos de 4 px, só Inter.
// O visual é escolhido antes do app carregar (index.js chama applyTheme), então os estilos
// criados com StyleSheet já nascem com as cores certas. Trocar o visual reinicia o app.

export const AREA_LABEL = { task: 'Tarefas', finance: 'Finanças', study: 'Estudos', grade: 'Nota', absence: 'Falta' };
export const AREAS = ['task', 'finance', 'study'];

// ---------- cores por área (uma cor por área, no app inteiro) ----------
// main: texto, botões e barras · tint: fundo de destaque · second/third: gráficos (tons do ícone)
// hero*: o cartão grande do topo no visual avançado
const AREA_LIGHT = {
  task: { main: '#2457E6', second: '#5A80F0', third: '#8FADFF', tint: '#E4ECFD', heroBg: '#2457E6', heroInk: '#FFFFFF', heroSoft: '#FFFFFF', heroLine: '#2457E6', heroTile: 'rgba(255,255,255,0.16)' },
  finance: { main: '#0B7A52', second: '#2AB884', third: '#6BE0B4', tint: '#DFF3E9', heroBg: '#0B7A52', heroInk: '#FFFFFF', heroSoft: '#FFFFFF', heroLine: '#0B7A52', heroTile: 'rgba(255,255,255,0.16)' },
  study: { main: '#6B3FD4', second: '#9575F5', third: '#C2AEFF', tint: '#EDE7FA', heroBg: '#6B3FD4', heroInk: '#FFFFFF', heroSoft: '#FFFFFF', heroLine: '#6B3FD4', heroTile: 'rgba(255,255,255,0.16)' },
};
const AREA_DARK = {
  task: { main: '#6C93FF', second: '#5A80F0', third: '#8FADFF', tint: '#1A2548', heroBg: '#1A2548', heroInk: '#F2F1EC', heroSoft: '#C9D6FF', heroLine: '#2F4486', heroTile: '#0E1117' },
  finance: { main: '#3DD39A', second: '#2AB884', third: '#6BE0B4', tint: '#0F2E24', heroBg: '#0F2E24', heroInk: '#F2F1EC', heroSoft: '#BFEBD8', heroLine: '#1D5A44', heroTile: '#0E1117' },
  study: { main: '#A98BFF', second: '#9575F5', third: '#C2AEFF', tint: '#271F45', heroBg: '#271F45', heroInk: '#F2F1EC', heroSoft: '#DCD0FF', heroLine: '#45367F', heroTile: '#0E1117' },
};

// ---------- cores neutras ----------
const NEUTRAL = {
  'advanced-light': {
    bg: '#F7F6F2', ink: '#12151C', mute: '#3A3F4E', faint: '#4A4F5E', line: '#E3E0D6', line2: '#EFEDE6',
    card: '#FFFFFF', soft: '#ECEAE3', bar: '#FFFFFF', onAccent: '#FFFFFF', onInk: '#FFFFFF',
    warn: '#A85F00', alertBg: '#FBEBCF', alertInk: '#4A2900', alertSub: '#7A4300', alertLine: '#FBEBCF',
    overlay: 'rgba(18,21,28,0.38)', danger: '#B42318', status: 'dark',
  },
  'advanced-dark': {
    bg: '#0E1117', ink: '#F2F1EC', mute: '#AEB3C0', faint: '#AEB3C0', line: '#2A3040', line2: '#232836',
    card: '#171B24', soft: '#1F2430', bar: '#171B24', onAccent: '#0E1117', onInk: '#0E1117',
    warn: '#F2B04C', alertBg: '#2E2410', alertInk: '#F2F1EC', alertSub: '#E8D3A8', alertLine: '#5A4620',
    overlay: 'rgba(0,0,0,0.55)', danger: '#F97066', status: 'light',
  },
  'simple-light': {
    bg: '#FAFAF8', ink: '#1C1F26', mute: '#5E6370', faint: '#5E6370', line: '#E6E6E1', line2: '#E6E6E1',
    card: '#FAFAF8', soft: '#F0EFEA', bar: '#FAFAF8', onAccent: '#FFFFFF', onInk: '#FAFAF8',
    warn: '#A85F00', alertBg: '#FBEBCF', alertInk: '#1C1F26', alertSub: '#7A4300', alertLine: '#FBEBCF',
    overlay: 'rgba(28,31,38,0.35)', danger: '#B42318', status: 'dark',
  },
  'simple-dark': {
    bg: '#121417', ink: '#E8E8E4', mute: '#9A9FA8', faint: '#9A9FA8', line: '#262A31', line2: '#262A31',
    card: '#121417', soft: '#1B1E23', bar: '#121417', onAccent: '#121417', onInk: '#121417',
    warn: '#F2B04C', alertBg: '#2E2410', alertInk: '#E8E8E4', alertSub: '#F2B04C', alertLine: '#2E2410',
    overlay: 'rgba(0,0,0,0.55)', danger: '#F97066', status: 'light',
  },
};

// formas e tipografia de cada visual
const SHAPE = {
  advanced: { rCard: 18, rHero: 22, rSmall: 14, rPill: 999, display: true, mic: 68, titleSize: 32, titleWeight: '700' },
  simple: { rCard: 4, rHero: 4, rSmall: 4, rPill: 4, display: false, mic: 56, titleSize: 22, titleWeight: '500' },
};

// Objetos vivos: o app inteiro importa estes e eles são preenchidos por applyTheme antes da primeira tela
export const colors = { ...NEUTRAL['advanced-light'], income: AREA_LIGHT.finance.main };
export const look = { mode: 'advanced', dark: false, ...SHAPE.advanced };
export const AREA_PAL = { ...AREA_LIGHT };

export function applyTheme(layout = 'advanced', theme = 'light') {
  const mode = layout === 'simple' ? 'simple' : 'advanced';
  const dark = theme === 'dark';
  const areas = dark ? AREA_DARK : AREA_LIGHT;
  Object.assign(colors, NEUTRAL[`${mode}-${dark ? 'dark' : 'light'}`], { income: areas.finance.main });
  Object.assign(look, { mode, dark }, SHAPE[mode]);
  Object.assign(AREA_PAL, areas);
}

// 1.12: cores das matérias, sempre uma destas 8. Em Estudos o roxo continua sendo a área;
// estas só diferenciam uma matéria da outra. Sem o azul e o verde das áreas.
const SUBJECT_LIGHT = [
  { name: 'Violeta', main: '#6B3FD4', tint: '#EDE7FA' },
  { name: 'Rosa', main: '#B3246B', tint: '#FBE6F0' },
  { name: 'Tijolo', main: '#A8321F', tint: '#FBE9E5' },
  { name: 'Laranja', main: '#A34E00', tint: '#FBEBDD' },
  { name: 'Mostarda', main: '#806000', tint: '#F7EFD2' },
  { name: 'Oliva', main: '#4F6B12', tint: '#EDF2DC' },
  { name: 'Turquesa', main: '#0B7285', tint: '#DDF1F5' },
  { name: 'Ardósia', main: '#4A5568', tint: '#E8EBF0' },
];
const SUBJECT_DARK = [
  { name: 'Violeta', main: '#A98BFF', tint: '#271F45' },
  { name: 'Rosa', main: '#F783B8', tint: '#3D1A2C' },
  { name: 'Tijolo', main: '#F08A78', tint: '#3D1F1A' },
  { name: 'Laranja', main: '#F5A05A', tint: '#3B2613' },
  { name: 'Mostarda', main: '#E0BE4A', tint: '#352C10' },
  { name: 'Oliva', main: '#A8C95A', tint: '#2A3312' },
  { name: 'Turquesa', main: '#5CC8DC', tint: '#103238' },
  { name: 'Ardósia', main: '#AEB8C8', tint: '#252B35' },
];
export const SUBJECT_COUNT = SUBJECT_LIGHT.length;
export const subjectColor = (i) => (look.dark ? SUBJECT_DARK : SUBJECT_LIGHT)[(Number(i) || 0) % SUBJECT_COUNT];
// para os testes de contraste
export const SUBJECT_PALETTES = { light: SUBJECT_LIGHT, dark: SUBJECT_DARK };

// para as amostras do onboarding e de Ajustes → Visual (sem mexer no tema atual)
export function previewTheme(layout, theme) {
  const mode = layout === 'simple' ? 'simple' : 'advanced';
  const dark = theme === 'dark';
  return { c: NEUTRAL[`${mode}-${dark ? 'dark' : 'light'}`], a: dark ? AREA_DARK : AREA_LIGHT, shape: SHAPE[mode] };
}

// cores das três faixas do ícone (fixas, iguais no claro e no escuro)
export const BRAND = { blue: '#2457E6', green: '#0B7A52', purple: '#6B3FD4', core: '#12151C' };
