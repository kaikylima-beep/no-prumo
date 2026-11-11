// Abre o app: lê o visual salvo (Simples/Avançado, claro/escuro), aplica as cores,
// carrega as fontes e só então carrega as telas, para os estilos já nascerem certos.
import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { applyTheme, colors } from './theme';
import { FONTS, setFontsReady } from './AppText';

export const SETTINGS_KEY = '@org2/settings';

export async function readVisual() {
  try {
    const s = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || '{}') || {};
    return { layout: s.layout || 'advanced', theme: s.theme || 'light' };
  } catch (e) {
    return { layout: 'advanced', theme: 'light' };
  }
}

// Reinicia o app para trocar o visual (as cores entram antes das telas)
export async function restartApp() {
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  try {
    const { reloadAppAsync } = require('expo');
    await reloadAppAsync('visual');
  } catch (e) {
    // sem reinício automático: o novo visual aparece na próxima vez que o app abrir
  }
}

export default function Root() {
  const [App, setApp] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await readVisual();
      applyTheme(v.layout, v.theme);
      try {
        await Font.loadAsync(FONTS);
        setFontsReady(true);
      } catch (e) {
        // sem as fontes, usa a do sistema
      }
      const Loaded = require('../App').default;
      if (alive) setApp(() => Loaded);
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (!App) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <App />;
}
