// Casca do app: 4 telas, o botão de falar no meio, as folhas e o aviso de "Desfazer".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, Row, T } from './ui';
import { useStore } from './store';
import { Nav } from './nav';
import { handleResponse } from './background';
import { onResponse } from './notify';
import Today from './screens/Today';
import All from './screens/All';
import Study from './screens/Study';
import Money from './screens/Money';
import Capture from './Capture';
import ItemSheet from './ItemSheet';
import BlockSheet from './BlockSheet';
import Settings from './Settings';
import Onboarding from './Onboarding';

const TABS = [
  { key: 'today', label: 'Hoje', icon: 'today', Screen: Today },
  { key: 'all', label: 'Tudo', icon: 'list', Screen: All },
  { key: 'study', label: 'Estudos', icon: 'book', Screen: Study },
  { key: 'money', label: 'Dinheiro', icon: 'wallet', Screen: Money },
];
const SHEETS = { capture: Capture, item: ItemSheet, block: BlockSheet, settings: Settings };

export default function App() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, toast, hideToast } = useStore();
  const [tab, setTab] = useState('today');
  const [seen, setSeen] = useState({ today: true });
  const [sheets, setSheets] = useState([]);

  const open = useCallback((kind, props = {}) => setSheets((s) => [...s, { kind, props, key: `${kind}${Date.now()}` }]), []);
  const close = useCallback(() => setSheets((s) => s.slice(0, -1)), []);
  const go = useCallback((k) => {
    setTab(k);
    setSeen((s) => (s[k] ? s : { ...s, [k]: true }));
  }, []);
  const nav = useMemo(() => ({ open, close, go, tab }), [open, close, go, tab]);

  useEffect(() => onResponse((r) => handleResponse(r).catch(() => {})), []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'today') {
        go('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, go]);

  if (!state.settings.onboarded) return <Onboarding />;

  const tabButton = (t) => {
    const on = tab === t.key;
    return (
      <Pressable key={t.key} onPress={() => go(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} aria-label={t.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 3 }}>
        <Icon name={t.icon} size={23} color={on ? 'text' : 'faint'} />
        <T v="s" c={on ? 'text' : 'faint'} style={{ fontSize: 11, lineHeight: 14 }}>
          {t.label}
        </T>
      </Pressable>
    );
  };

  return (
    <Nav.Provider value={nav}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        {TABS.map((t) => (seen[t.key] ? (
          <View key={t.key} style={{ flex: 1, display: tab === t.key ? 'flex' : 'none' }}>
            <t.Screen active={tab === t.key} />
          </View>
        ) : null))}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: insets.bottom, paddingHorizontal: 4 }}>
          {TABS.slice(0, 2).map(tabButton)}
          <View style={{ width: 84, alignItems: 'center' }}>
            <Pressable onPress={() => open('capture', { voice: true })} onLongPress={() => open('capture', { voice: false })} accessibilityRole="button" accessibilityLabel="Falar com o Peep" aria-label="Falar com o Peep" style={({ pressed }) => ({ width: 66, height: 66, borderRadius: 33, marginTop: -26, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: c.bg, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              <Icon name="mic" size={28} color={c.onBrand} />
            </Pressable>
          </View>
          {TABS.slice(2).map(tabButton)}
        </View>
        {sheets.map((s) => {
          const S = SHEETS[s.kind];
          return <S key={s.key} {...s.props} onClose={close} />;
        })}
        {toast ? (
          <View pointerEvents="box-none" style={[{ position: 'absolute', left: 16, right: 16 }, sheets.length ? { top: insets.top + 10 } : { bottom: insets.bottom + 96 }]}>
            <Row key={toast.key} style={{ backgroundColor: c.text, borderRadius: 14, paddingLeft: 16, paddingRight: 6, minHeight: 50 }}>
              <T v="m" c="bg" style={{ flex: 1, paddingVertical: 12 }}>
                {toast.text}
              </T>
              {toast.undo ? (
                <Pressable onPress={() => { toast.undo(); hideToast(); }} accessibilityRole="button" accessibilityLabel="Desfazer" aria-label="Desfazer" style={{ paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
                  <T v="m" c="brand">
                    Desfazer
                  </T>
                </Pressable>
              ) : null}
            </Row>
          </View>
        ) : null}
      </View>
    </Nav.Provider>
  );
}
