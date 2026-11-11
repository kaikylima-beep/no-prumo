import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Estado que é carregado do armazenamento do celular ao abrir
// e salvo automaticamente a cada mudança.
// reload() lê de novo do armazenamento (usado quando um botão do aviso
// mudou os dados com o app em segundo plano).
export function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setValue(JSON.parse(raw));
          } catch (e) {
            // dado corrompido: mantém o valor inicial
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, [key, value, loaded]);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch (e) {
      // mantém o que está na tela
    }
  }, [key]);

  return [value, setValue, loaded, reload];
}
