// Abre o app: carrega as fontes e os dados e só então mostra as telas.
import React, { useEffect, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FONTS, PALETTES, ThemeProvider } from './theme';
import { setFontsOk } from './ui';
import { StoreProvider, useStore } from './store';
import App from './App';

function Themed() {
  const { state, ready } = useStore();
  const system = useColorScheme();
  const pick = state.settings.theme;
  const mode = pick === 'light' || pick === 'dark' ? pick : system === 'dark' ? 'dark' : 'light';
  return (
    <ThemeProvider mode={mode}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: PALETTES[mode].bg }}>{ready ? <App /> : null}</View>
    </ThemeProvider>
  );
}

export default function Root() {
  const [fonts, setFonts] = useState(false);
  useEffect(() => {
    Font.loadAsync(FONTS)
      .then(() => setFontsOk(true))
      .catch(() => {})
      .finally(() => setFonts(true));
  }, []);
  if (!fonts) return <View style={{ flex: 1, backgroundColor: '#FFC83D' }} />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
