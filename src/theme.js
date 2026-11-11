// Um visual só. Claro ou escuro acompanha o celular (ou a escolha em Ajustes), sem reiniciar.
import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';

// Marca do Prumo: tinta escura, papel claro e as três cores das áreas (sem amarelo).
const base = { ink: '#12151C', ring: ['#2457E6', '#0B7A52', '#6B3FD4'] };
export const PALETTES = {
  light: {
    ...base,
    dark: false,
    brand: '#12151C',
    onBrand: '#F7F6F2',
    undo: '#8FADFF',
    bg: '#F7F6F2',
    card: '#FFFFFF',
    sunken: '#ECEAE3',
    line: '#E2DFD6',
    text: '#16181D',
    soft: '#5B5F68',
    faint: '#8D9099',
    task: '#2457E6',
    study: '#6B3FD4',
    money: '#0B7A52',
    danger: '#C2362B',
    warn: '#9A5B00',
    taskBg: '#E7EDFD',
    studyBg: '#EEE8FB',
    moneyBg: '#E2F3EC',
    dangerBg: '#FBE9E7',
    warnBg: '#FFF1D6',
    overlay: 'rgba(15,16,20,0.45)',
    blocks: ['#2457E6', '#6B3FD4', '#0B7A52', '#B4460F', '#A32672', '#0E7490', '#7A6200', '#4B5563'],
  },
  dark: {
    ...base,
    dark: true,
    brand: '#F2F1EC',
    onBrand: '#12151C',
    undo: '#2457E6',
    bg: '#0E1117',
    card: '#191C22',
    sunken: '#14161B',
    line: '#2A2E37',
    text: '#F2F1EC',
    soft: '#A9ADB8',
    faint: '#747986',
    task: '#7FA2FF',
    study: '#B79CFF',
    money: '#4FD9A5',
    danger: '#FF8A7E',
    warn: '#FFC266',
    taskBg: '#1B2440',
    studyBg: '#271F42',
    moneyBg: '#12302A',
    dangerBg: '#3A1D1B',
    warnBg: '#3A2C12',
    overlay: 'rgba(0,0,0,0.6)',
    blocks: ['#7FA2FF', '#B79CFF', '#4FD9A5', '#FF9F6B', '#F28CC4', '#5CCFE6', '#E6C94D', '#A9ADB8'],
  },
};

const ThemeContext = createContext(PALETTES.light);
export const ThemeProvider = ({ mode, children }) => <ThemeContext.Provider value={PALETTES[mode] || PALETTES.light}>{children}</ThemeContext.Provider>;
export const useTheme = () => useContext(ThemeContext);

// estilos que dependem das cores: criados uma vez por tema
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const c = useTheme();
    return useMemo(() => {
      if (!cache.has(c)) cache.set(c, StyleSheet.create(factory(c)));
      return cache.get(c);
    }, [c]);
  };
}

export const typeColor = (c, type) => (type === 'study' ? c.study : type === 'money' ? c.money : c.task);
export const typeBg = (c, type) => (type === 'study' ? c.studyBg : type === 'money' ? c.moneyBg : c.taskBg);
export const TYPE_LABEL = { task: 'Tarefa', study: 'Estudo', money: 'Dinheiro' };

export const ICONS = {
  today: require('../assets/ic/today.png'),
  list: require('../assets/ic/list.png'),
  book: require('../assets/ic/book.png'),
  wallet: require('../assets/ic/wallet.png'),
  mic: require('../assets/ic/mic.png'),
  glyph: require('../assets/ui/glyph.png'),
  plus: require('../assets/ic/plus.png'),
  check: require('../assets/ic/check.png'),
  close: require('../assets/ic/close.png'),
  gear: require('../assets/ic/gear.png'),
  back: require('../assets/ic/back.png'),
  next: require('../assets/ic/next.png'),
  down: require('../assets/ic/down.png'),
  trash: require('../assets/ic/trash.png'),
  repeat: require('../assets/ic/repeat.png'),
  bell: require('../assets/ic/bell.png'),
  clock: require('../assets/ic/clock.png'),
  calendar: require('../assets/ic/calendar.png'),
  send: require('../assets/ic/send.png'),
  eye: require('../assets/ic/eye.png'),
  eyeoff: require('../assets/ic/eyeoff.png'),
  edit: require('../assets/ic/edit.png'),
  keyboard: require('../assets/ic/keyboard.png'),
  spark: require('../assets/ic/spark.png'),
  undo: require('../assets/ic/undo.png'),
  pin: require('../assets/ic/pin.png'),
  task: require('../assets/ic/task.png'),
};
export const TYPE_ICON = { task: 'task', study: 'book', money: 'wallet' };

export const FONTS = {
  Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
  SpaceGrotesk_600SemiBold: require('../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('../assets/fonts/SpaceGrotesk_700Bold.ttf'),
};
