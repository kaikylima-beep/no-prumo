// Reconhecimento de voz do Android (português do Brasil).
// Precisa do app instalado (APK / development build). No Expo Go o módulo não existe,
// então o app avisa e a pessoa pode usar o microfone do teclado.
//
// 1.12.1: o app pede ao Android o melhor que o aparelho oferece e cai para o modo
// mais simples se o aparelho recusar (LEVELS):
//   0. reconhecimento no próprio celular, com pontuação, vocabulário e 5 versões
//   1. serviço padrão do Android, com pontuação, vocabulário e 5 versões
//   2. o modo da 1.12 (só o texto), com 5 versões
// A fala pode chegar em pedaços (o Android corta nas pausas): o app junta os pedaços
// e só interpreta quando o Android encerra a escuta.
import { useCallback, useRef, useState } from 'react';

let Mod = null;
let useSpeechEvent = null;
try {
  const m = require('expo-speech-recognition');
  Mod = m.ExpoSpeechRecognitionModule;
  useSpeechEvent = m.useSpeechRecognitionEvent;
} catch (e) {
  Mod = null;
  useSpeechEvent = null;
}

const noopHook = () => {};

export const LEVELS = [
  { name: 'no celular, com pontuação', onDevice: true, rich: true },
  { name: 'pelo Google, com pontuação', onDevice: false, rich: true },
  { name: 'modo simples', onDevice: false, rich: false },
];

// nível que funcionou neste aparelho (vale enquanto o app está aberto)
let workingLevel = null;
let modelAsked = false;
let lastMode = '';

export function speechMode() {
  return lastMode;
}

function canOnDevice() {
  try {
    return !!Mod && typeof Mod.supportsOnDeviceRecognition === 'function' && Mod.supportsOnDeviceRecognition();
  } catch (e) {
    return false;
  }
}

function errorText(code) {
  switch (code) {
    case 'no-speech':
      return 'Não ouvi nada. Toque no botão e tente de novo.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permita o uso do microfone nas configurações do app.';
    case 'network':
      return 'Sem conexão para reconhecer a voz. Tente de novo.';
    case 'language-not-supported':
      return 'Português não disponível no reconhecimento de voz deste aparelho.';
    default:
      return 'Não consegui ouvir. Tente de novo ou escreva.';
  }
}

// junta os pedaços: a versão k de cada pedaço (ou a 1ª, se o pedaço tiver menos versões)
function joinSegments(segs, extra) {
  const all = extra ? [...segs, extra] : segs;
  if (!all.length) return [];
  const n = Math.max(...all.map((s) => s.length));
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(
      all
        .map((s) => (s[k] || s[0] || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
    );
  }
  return out;
}

// onText(texto ao vivo), onDone(versões ouvidas, áudio), onVolume(nível)
export function useSpeech({ onText, onDone, onVolume, vocab, onDevice = true }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const hook = useSpeechEvent || noopHook;
  const st = useRef({ segs: [], partial: null, gotResult: false, level: 0, startedAt: 0, audio: null, stopped: false, retrying: false, next: 0, retryTimer: null });

  const options = (level) => {
    const L = LEVELS[level];
    const base = {
      lang: 'pt-BR',
      interimResults: true,
      continuous: false,
      maxAlternatives: 5,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 90 },
    };
    if (!L.rich) return base;
    return {
      ...base,
      addsPunctuation: true,
      contextualStrings: (vocab && vocab()) || [],
      requiresOnDeviceRecognition: !!L.onDevice,
      // guarda o áudio (Android 13+): serve para "Guardar para correção" e faz o Android esperar 2 s de silêncio
      recordingOptions: { persist: true },
      androidIntentOptions: { EXTRA_MASK_OFFENSIVE_WORDS: false },
    };
  };

  const begin = (level) => {
    const s = st.current;
    s.level = level;
    s.segs = [];
    s.partial = null;
    s.gotResult = false;
    s.audio = null;
    s.stopped = false;
    s.startedAt = Date.now();
    lastMode = LEVELS[level].name;
    Mod.start(options(level));
  };

  const firstLevel = () => {
    const wanted = onDevice && canOnDevice() ? 0 : 1;
    return workingLevel !== null ? Math.max(workingLevel, wanted) : wanted;
  };

  // o nível falhou logo no começo, sem ouvir nada: tenta o próximo
  const fallback = (code) => {
    const s = st.current;
    if (s.gotResult || s.stopped || s.level >= LEVELS.length - 1) return false;
    if (['aborted', 'no-speech', 'not-allowed', 'service-not-allowed', 'speech-timeout'].includes(code)) return false;
    if (Date.now() - s.startedAt > 4000) return false;
    if (LEVELS[s.level].onDevice && code === 'language-not-supported' && !modelAsked) {
      // falta o modelo de português no aparelho: pede o download e segue pelo Google por enquanto
      modelAsked = true;
      try {
        Mod.androidTriggerOfflineModelDownload({ locale: 'pt-BR' }).catch(() => {});
      } catch (e) {
        // nada a fazer
      }
    }
    // espera o Android encerrar a escuta que falhou antes de abrir a próxima
    s.retrying = true;
    s.next = s.level + 1;
    s.retryTimer = setTimeout(retryNow, 700);
    return true;
  };

  const retryNow = () => {
    const s = st.current;
    clearTimeout(s.retryTimer);
    if (!s.retrying) return;
    s.retrying = false;
    try {
      begin(s.next);
    } catch (e) {
      setListening(false);
      setError(errorText('client'));
    }
  };

  hook('start', () => setListening(true));
  hook('end', () => {
    const s = st.current;
    if (s.retrying) {
      clearTimeout(s.retryTimer);
      s.retryTimer = setTimeout(retryNow, 150);
      return;
    }
    setListening(false);
    const alts = joinSegments(s.segs, s.segs.length ? null : s.partial);
    if (alts.length && alts[0]) {
      workingLevel = s.level;
      onDone(alts, s.audio);
    }
  });
  hook('result', (e) => {
    const list = ((e && e.results) || []).map((r) => (r && r.transcript) || '').filter(Boolean);
    if (!list.length) return;
    const s = st.current;
    s.gotResult = true;
    if (e.isFinal) {
      s.segs.push(list);
      s.partial = null;
    } else s.partial = list;
    const live = joinSegments(s.segs, e.isFinal ? null : list)[0] || '';
    onText(live);
  });
  hook('audioend', (e) => {
    if (e && e.uri) st.current.audio = e.uri;
  });
  // volume do microfone: de -2 (silêncio) a 10 (alto), algumas vezes por segundo
  hook('volumechange', (e) => {
    if (onVolume && e && typeof e.value === 'number') onVolume(e.value);
  });
  hook('error', (e) => {
    const code = e && e.error;
    if (code === 'aborted') {
      setListening(false);
      return;
    }
    if (fallback(code)) return;
    setListening(false);
    // já ouviu alguma coisa: o 'end' entrega o que tem; o erro só aparece se não veio nada
    if (!st.current.gotResult) setError(errorText(code));
  });

  const supported = (() => {
    try {
      return !!Mod && Mod.isRecognitionAvailable();
    } catch (e) {
      return false;
    }
  })();

  const start = useCallback(async () => {
    setError('');
    if (!Mod) {
      setError('Voz indisponível neste modo (Expo Go). Instale o APK ou use o microfone do teclado.');
      return;
    }
    try {
      const p = await Mod.requestPermissionsAsync();
      if (!p.granted) {
        setError('Permita o uso do microfone nas configurações do app.');
        return;
      }
      try {
        begin(firstLevel());
      } catch (e) {
        begin(LEVELS.length - 1);
      }
    } catch (e) {
      setError('Não foi possível iniciar o microfone.');
    }
  }, []);

  // para de ouvir e entrega o que já ouviu
  const stop = useCallback(() => {
    st.current.stopped = true;
    try {
      if (Mod) Mod.stop();
    } catch (e) {
      // nada a fazer
    }
  }, []);

  // para sem transformar o que já ouviu em resultado (a pessoa decidiu digitar ou fechou)
  const abort = useCallback(() => {
    st.current.stopped = true;
    st.current.segs = [];
    st.current.partial = null;
    try {
      if (Mod) Mod.abort();
    } catch (e) {
      // nada a fazer
    }
  }, []);

  return { listening, error, supported, start, stop, abort, clearError: () => setError('') };
}
