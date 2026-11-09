// Text e TextInput do app: escolhem a fonte certa pelo peso e tamanho do estilo.
//   Avançado: Space Grotesk em números e títulos (19 px ou mais, peso 600+); Inter no resto.
//   Simples: só Inter, no máximo peso 500 em textos grandes e 600 nos pequenos.
// No Android a fonte própria não fica "negrito" sozinha: cada peso é um arquivo,
// por isso o peso vira o nome da fonte (e o fontWeight volta a "normal").
// Um Text dentro de outro herda tamanho e peso do de fora.
import React, { createContext, forwardRef, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { look } from './theme';

export const FONTS = {
  Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
  SpaceGrotesk_500Medium: require('../assets/fonts/SpaceGrotesk_500Medium.ttf'),
  SpaceGrotesk_600SemiBold: require('../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('../assets/fonts/SpaceGrotesk_700Bold.ttf'),
};

let ready = false;
export const setFontsReady = (v) => {
  ready = !!v;
};

const NAMED = { normal: 400, bold: 700 };
const num = (w) => Number(NAMED[w] || w || 400);

export function fontFor(size, weight) {
  const w = num(weight);
  if (look.display && size >= 19 && w >= 600) return w >= 700 ? 'SpaceGrotesk_700Bold' : 'SpaceGrotesk_600SemiBold';
  const ww = look.display ? w : Math.min(w, size >= 18 ? 500 : 600);
  if (ww >= 700) return 'Inter_700Bold';
  if (ww >= 600) return 'Inter_600SemiBold';
  if (ww >= 500) return 'Inter_500Medium';
  return 'Inter_400Regular';
}

const Inherit = createContext(null);

export const Text = forwardRef(function AppText(props, ref) {
  const parent = useContext(Inherit);
  if (!ready) return <RNText ref={ref} {...props} />;
  const f = StyleSheet.flatten(props.style) || {};
  const size = f.fontSize || (parent && parent.size) || 14;
  const weight = f.fontWeight != null ? f.fontWeight : parent ? parent.weight : 400;
  // dentro de outro Text e sem mudar tamanho nem peso: herda a fonte do de fora
  const inherit = f.fontFamily || (parent && f.fontWeight == null && f.fontSize == null);
  const style = inherit ? props.style : [props.style, { fontFamily: fontFor(size, weight), fontWeight: 'normal' }];
  return (
    <Inherit.Provider value={{ size, weight }}>
      <RNText ref={ref} {...props} style={style} />
    </Inherit.Provider>
  );
});

export const TextInput = forwardRef(function AppTextInput(props, ref) {
  if (!ready) return <RNTextInput ref={ref} {...props} />;
  const f = StyleSheet.flatten(props.style) || {};
  const style = f.fontFamily ? props.style : [props.style, { fontFamily: fontFor(f.fontSize || 14, f.fontWeight || 400), fontWeight: 'normal' }];
  return <RNTextInput ref={ref} {...props} style={style} />;
});
