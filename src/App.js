// Casca do app: 4 telas, o botão de falar no meio, as folhas e o aviso de "Desfazer".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS, useTheme } from './theme';
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
import AccountSheet from './AccountSheet';
import ImportSheet from './ImportSheet';
import GradeSheet from './GradeSheet';
import NoteSheet from './NoteSheet';
import NoteButton from './NoteButton';
import { takeScreenshot } from './files';
import { readDocumentAsset } from './legacy/importDocument';
import { addShareListener, getInitialShare } from '../modules/share-receiver';

const TABS = [
  { key: 'today', label: 'Hoje', icon: 'today', Screen: Today },
  { key: 'all', label: 'Tudo', icon: 'list', Screen: All },
  { key: 'study', label: 'Estudos', icon: 'book', Screen: Study },
  { key: 'money', label: 'Dinheiro', icon: 'wallet', Screen: Money },
];
const SHEETS = { capture: Capture, item: ItemSheet, block: BlockSheet, settings: Settings, account: AccountSheet, import: ImportSheet, grade: GradeSheet, note: NoteSheet };
const SHEET_NAME = { capture: 'Falar', item: 'Ajustar item', block: 'Matéria', settings: 'Ajustes', account: 'Conta', import: 'Importar extrato', grade: 'Lançar nota', note: 'Anotar' };

export default function App() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, toast, hideToast, say, setSettings } = useStore();
  const [shooting, setShooting] = useState(false);
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

  // apontamento (modo de teste): esconde o botão, tira o print da tela e abre a folha Anotar
  const sheetsRef = React.useRef(sheets);
  sheetsRef.current = sheets;
  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  const anotar = useCallback(async () => {
    if (sheetsRef.current.some((s) => s.kind === 'note')) return;
    const where = [TABS.find((t) => t.key === tabRef.current).label, ...sheetsRef.current.map((s) => SHEET_NAME[s.kind] || s.kind)].join(' › ');
    setShooting(true);
    await new Promise((r) => setTimeout(r, 120));
    const shot = await takeScreenshot();
    setShooting(false);
    open('note', { shot, where });
  }, [open]);
  const moveButton = useCallback((p) => setSettings({ notesButtonPos: p }), [setSettings]);
  // extrato mandado de outro app pelo menu "Compartilhar": abre Dinheiro e a revisão
  const onboarded = state.settings.onboarded;
  useEffect(() => {
    if (!onboarded || Platform.OS !== 'android') return undefined;
    const handle = async (asset) => {
      if (!asset) return;
      go('money');
      say('Lendo o arquivo…');
      const r = await readDocumentAsset(asset, []);
      if (r.error) return say(r.error);
      open('import', { read: r });
    };
    handle(getInitialShare());
    const sub = addShareListener(handle);
    return () => sub.remove();
  }, [onboarded]);
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
            <Pressable onPress={() => open('capture', { voice: true })} onLongPress={() => open('capture', { voice: false })} accessibilityRole="button" accessibilityLabel="Falar com o Prumo" aria-label="Falar com o Prumo" style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, marginTop: -28, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderTopColor: c.ring[0], borderRightColor: c.ring[1], borderBottomColor: c.ring[2], borderLeftColor: c.ring[0] }}>
                <Image source={ICONS.glyph} style={{ width: 20, height: 36 }} resizeMode="contain" />
              </View>
            </Pressable>
          </View>
          {TABS.slice(2).map(tabButton)}
        </View>
        {sheets.map((s) => {
          const S = SHEETS[s.kind];
          return <S key={s.key} {...s.props} onClose={close} />;
        })}
        {state.settings.testMode && state.settings.notesButton !== false && !sheets.some((x) => x.kind === 'note') ? <NoteButton pos={state.settings.notesButtonPos} onMove={moveButton} onPress={anotar} hidden={shooting} /> : null}
        {toast ? (
          <View pointerEvents="box-none" style={[{ position: 'absolute', left: 16, right: 16 }, sheets.length ? { top: insets.top + 10 } : { bottom: insets.bottom + 96 }]}>
            <Row key={toast.key} style={{ backgroundColor: c.text, borderRadius: 14, paddingLeft: 16, paddingRight: 6, minHeight: 50 }}>
              <T v="m" c="bg" style={{ flex: 1, paddingVertical: 12 }}>
                {toast.text}
              </T>
              {toast.undo ? (
                <Pressable onPress={() => { toast.undo(); hideToast(); }} accessibilityRole="button" accessibilityLabel="Desfazer" aria-label="Desfazer" style={{ paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
                  <T v="m" c="undo">
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
