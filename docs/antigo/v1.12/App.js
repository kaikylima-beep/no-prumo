import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Platform, Alert, StyleSheet } from 'react-native';
import { Text } from './src/AppText';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look } from './src/theme';
import { DataProvider, useData } from './src/store';
import { UIContext } from './src/uiContext';
import { MicButton, Icon } from './src/ui';
import CaptureModal from './src/CaptureModal';
import EditSheet from './src/EditSheet';
import Drawer from './src/Drawer';
import TasksScreen from './src/screens/TasksScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import StudyScreen from './src/screens/StudyScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import Onboarding from './src/Onboarding';
import EntryGreeting from './src/components/EntryGreeting';
import MonthView from './src/components/MonthView';
import { handleResponse, dataOf } from './src/actions';
import { readDocumentAsset, batchFromImport } from './src/importDocument';
import { getInitialShare, addShareListener } from './modules/share-receiver';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

const SCREENS = {
  task: { label: 'Tarefas', Screen: TasksScreen },
  finance: { label: 'Finanças', Screen: FinanceScreen },
  study: { label: 'Estudos', Screen: StudyScreen },
  calendar: { label: 'Agenda', Screen: CalendarScreen },
};

const TAB_HEIGHT = look.mode === 'simple' ? 70 : 78;

function Toast({ toast, bottom, onAction }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: toast ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [toast]);
  if (!toast) return null;
  return (
    <Animated.View style={[styles.toast, { bottom, opacity }]} pointerEvents="box-none">
      <Text style={styles.toastText}>{toast.message}</Text>
      {toast.action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.toastAction}>{toast.action}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function Shell() {
  const insets = useSafeAreaInsets();
  const { loaded, areaOrder, palettes, removeItem, simple, markEditHint, needsOnboarding, finance } = useData();
  const financeRef = useRef(finance);
  financeRef.current = finance;
  const [active, setActive] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [month, setMonth] = useState(null); // 'AAAA-MM' do mês aberto pelo saldo de Finanças
  const timer = useRef(null);

  // abre na área mais importante
  useEffect(() => {
    if (loaded && !active) setActive(areaOrder[0]);
  }, [loaded]);
  // no visual simples não há Agenda
  const current = !active || (simple && active === 'calendar') ? areaOrder[0] : active;

  // avisos: tocar no aviso abre a área dele; os botões ("Feito", "Adiar"...) são tratados aqui
  // quando o app está aberto, e pela tarefa em segundo plano quando está fechado
  useEffect(() => {
    if (!Notifications || Platform.OS === 'web') return undefined;
    const DEFAULT = Notifications.DEFAULT_ACTION_IDENTIFIER;
    const open = (resp) => {
      const d = dataOf(resp);
      if (d.kind && SCREENS[d.kind]) setActive(d.kind);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      if (resp.actionIdentifier === DEFAULT) open(resp);
      else handleResponse(resp).catch(() => {});
    });
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (resp && resp.actionIdentifier === DEFAULT) open(resp);
      })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  const showToast = useCallback((message, action, onAction) => {
    clearTimeout(timer.current);
    setToast({ message, action, onAction });
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 2500);
  }, []);

  // extrato, fatura ou holerite mandado de outro app pelo menu "Compartilhar":
  // abre Finanças e a revisão em lote, igual ao botão "Importar extrato"
  useEffect(() => {
    if (!loaded || needsOnboarding || Platform.OS !== 'android') return undefined;
    const handle = async (asset) => {
      if (!asset) return;
      setActive('finance');
      setCapturing(false);
      setEditing(null);
      showToast('Lendo o arquivo…');
      const r = await readDocumentAsset(asset, financeRef.current);
      setToast(null);
      if (r.error) {
        Alert.alert('Não deu para importar', r.error);
        return;
      }
      setEditing({ batch: batchFromImport(r) });
    };
    handle(getInitialShare());
    const sub = addShareListener((e) => handle(e));
    return () => sub.remove();
  }, [loaded, needsOnboarding]);

  const removeWithUndo = useCallback(async (kind, item) => {
    const undo = await removeItem(kind, item.id);
    showToast(item.title ? `"${item.title}" excluído` : 'Item excluído', 'Desfazer', undo);
  }, []);

  const ui = {
    openDrawer: () => setDrawer(true),
    openEditor: (kind, item) => {
      markEditHint();
      setEditing({ kind, item });
    },
    // revisão em lote (extrato, fatura ou holerite importado)
    openBatch: (batch) => setEditing({ batch }),
    showToast,
    removeWithUndo,
    openMonth: (ym) => setMonth(ym),
  };

  // abas: as três áreas na ordem de importância, microfone no meio e, no fim,
  // Agenda (visual avançado) ou Menu (visual simples, que não tem a foto no topo)
  const tabs = [areaOrder[0], areaOrder[1], 'mic', areaOrder[2], simple ? 'menu' : 'calendar'];
  const accent = palettes[current] ? palettes[current].main : colors.ink;
  const simpleBar = look.mode === 'simple';

  return (
    <UIContext.Provider value={ui}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style={colors.status} />

        <View style={{ flex: 1 }}>
          {Object.entries(SCREENS).map(([key, { Screen }]) => (
            <View key={key} style={[styles.screen, key !== current && { display: 'none' }]}>
              <Screen active={key === current} />
            </View>
          ))}
        </View>

        <View style={[styles.tabBar, { height: TAB_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]} accessibilityRole="tablist">
          {tabs.map((key) => {
            if (key === 'mic') {
              return (
                <View key="mic" style={styles.tab}>
                  <MicButton onPress={() => setCapturing(true)} style={!simpleBar && { marginTop: -30 }} />
                </View>
              );
            }
            if (key === 'menu') {
              return (
                <Pressable key="menu" style={styles.tab} onPress={() => setDrawer(true)} accessibilityLabel="Abrir menu, perfil e configurações">
                  <Icon name="menu" size={simpleBar ? 22 : 24} color={colors.faint} />
                  <Text style={styles.tabLabel}>Menu</Text>
                </Pressable>
              );
            }
            const isActive = key === current;
            const color = isActive ? (palettes[key] ? palettes[key].main : colors.ink) : colors.faint;
            return (
              <Pressable key={key} style={styles.tab} onPress={() => setActive(key)} accessibilityRole="tab" accessibilityState={{ selected: isActive }}>
                <Icon name={key} size={simpleBar ? 22 : 24} color={color} />
                <Text style={[styles.tabLabel, { color }, isActive && styles.tabLabelOn]}>{SCREENS[key].label}</Text>
              </Pressable>
            );
          })}
        </View>

        <MonthView ym={month} onClose={() => setMonth(null)} />

        <Toast
          toast={toast}
          bottom={TAB_HEIGHT + insets.bottom + 14}
          onAction={() => {
            if (toast && toast.onAction) toast.onAction();
            setToast(null);
          }}
        />

        <CaptureModal visible={capturing} onClose={() => setCapturing(false)} accent={accent} />
        <EditSheet
          target={editing}
          onClose={() => setEditing(null)}
          onDelete={(kind, item) => {
            setEditing(null);
            removeWithUndo(kind, item);
          }}
        />
        <Drawer visible={drawer} onClose={() => setDrawer(false)} />
        <EntryGreeting bottom={TAB_HEIGHT + insets.bottom + 14} />
        <Onboarding visible={!!needsOnboarding} />
      </View>
    </UIContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bar,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  tabLabel: { fontSize: look.mode === 'simple' ? 12 : 13, fontWeight: '500', color: colors.faint, marginTop: 3 },
  tabLabelOn: { fontWeight: '600' },
  toast: {
    position: 'absolute',
    zIndex: 30,
    elevation: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.ink,
    borderRadius: look.mode === 'simple' ? 4 : 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toastText: { color: colors.onInk, fontSize: 15, fontWeight: '600', flex: 1 },
  toastAction: { color: colors.onInk, fontSize: 15, fontWeight: '800', marginLeft: 16, textDecorationLine: 'underline' },
});
