// Os dados do Peep: um estado só, guardado no celular, com desfazer.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_STATE, applyActions, complete, makeItem, reopen } from './core/model';
import { OLD_KEYS, fromOldStorage, sanitize } from './core/migrate';
import { syncReminders } from './notify';
import { STATE_KEY, onExternalChange } from './background';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState(null);
  const ref = useRef(state);
  ref.current = state;
  const toastTimer = useRef(null);
  const askRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STATE_KEY);
      if (raw) setState(sanitize(JSON.parse(raw)));
      else {
        // veio da 1.12: converte os dados antigos. As chaves antigas ficam como estão.
        const old = fromOldStorage(await AsyncStorage.multiGet(OLD_KEYS));
        if (old) setState(sanitize(old));
      }
    } catch (e) {
      // dado ilegível: começa vazio, sem apagar nada do armazenamento
    }
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    const off = onExternalChange(load);
    const tick = setInterval(() => setNow(new Date()), 30000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(new Date());
        load();
      }
    });
    return () => {
      off();
      clearInterval(tick);
      sub.remove();
    };
  }, [load]);

  // grava e refaz os avisos um instante depois da última mudança
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => {
      AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
      syncReminders(state, askRef.current);
    }, 350);
    return () => clearTimeout(t);
  }, [state, ready]);

  const say = useCallback((text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo: undo || null, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 3200);
  }, []);
  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const api = useMemo(() => {
    // toda mudança que dá para se arrepender guarda o estado anterior
    const change = (fn, message) => {
      const before = ref.current;
      const after = fn(before);
      if (after === before) return;
      askRef.current = true;
      setState(after);
      if (message) say(message, () => setState(before));
    };
    return {
      addItems: (parsed, heard) => {
        const list = parsed.map((p) => makeItem({ ...p, heard }, new Date()));
        change((s) => ({ ...s, items: [...s.items, ...list] }));
        return list;
      },
      applyActions: (actions) => {
        const r = applyActions(ref.current.blocks, actions, new Date());
        change((s) => ({ ...s, blocks: r.blocks }));
        return r.notes;
      },
      updateItem: (id, patch) => change((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeItem: (id) => change((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }), 'Apagado'),
      toggle: (id) => {
        const it = ref.current.items.find((i) => i.id === id);
        if (!it) return;
        if (it.done) return change((s) => ({ ...s, items: reopen(s.items, id) }));
        const label = it.type === 'money' ? (it.flow === 'in' ? 'Recebido' : 'Pago') : it.repeat ? 'Feito por hoje' : 'Feito';
        change((s) => ({ ...s, items: complete(s.items, id, new Date()) }), label);
      },
      moveItem: (id, date, message) => change((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, date } : i)) }), message),
      saveBlock: (block) => change((s) => ({ ...s, blocks: s.blocks.some((b) => b.id === block.id) ? s.blocks.map((b) => (b.id === block.id ? block : b)) : [...s.blocks, block] })),
      removeBlock: (id) => change((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id), items: s.items.map((i) => (i.subjectId === id ? { ...i, subjectId: null } : i)) }), 'Apagado'),
      // mudança livre no estado (contas, importação), com Desfazer quando tem mensagem
      mutate: (fn, message) => change(fn, message),
      saveAccount: (acc) => change((s) => ({ ...s, accounts: (s.accounts || []).some((a) => a.id === acc.id) ? s.accounts.map((a) => (a.id === acc.id ? acc : a)) : [...(s.accounts || []), acc] })),
      removeAccount: (id) => change((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id), items: s.items.map((i) => (i.account === id || i.from === id || i.to === id ? { ...i, account: i.account === id ? null : i.account, from: i.from === id ? null : i.from, to: i.to === id ? null : i.to } : i)) }), 'Conta apagada'),
      setSettings: (patch) => change((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      replaceAll: (next, message) => change(() => sanitize(next), message),
      say,
    };
  }, [say]);

  const value = useMemo(() => ({ state, ready, now, toast, hideToast, ...api }), [state, ready, now, toast, hideToast, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
