// Botões dos avisos ("Feito", "Daqui a 1 hora", "Lembrar amanhã").
// Funcionam com o app fechado: leem e gravam direto no armazenamento, sem o React.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { addAbsence, complete } from './core/model';
import { sanitize } from './core/migrate';
import { addDays, hhmm, todayISO } from './core/dates';
import { syncReminders } from './notify';

export const STATE_KEY = '@prumo/state';
const TASK = 'meu-organizador-botoes-dos-avisos';
const seen = new Set();
const listeners = new Set();
export const onExternalChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export async function handleResponse(response) {
  const action = response && response.actionIdentifier;
  const req = response && response.notification && response.notification.request;
  if (!req || !['feito', 'depois', 'amanha', 'fui', 'faltei'].includes(action)) return false;
  const key = `${req.identifier}|${action}`;
  if (seen.has(key)) return false;
  seen.add(key);
  let data = req.content && req.content.data;
  if ((!data || !data.id) && req.content && req.content.dataString) {
    try {
      data = JSON.parse(req.content.dataString);
    } catch (e) {
      data = null;
    }
  }
  if (!data || (!data.id && !data.block)) return false;
  if (action === 'fui') return true;
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return false;
  const state = sanitize(JSON.parse(raw));
  // "Foi na aula?" → Faltei: conta as aulas daquele horário
  if (action === 'faltei') {
    const b = state.blocks.find((x) => x.id === data.block);
    if (!b || (b.absences || []).some((a) => a.date === data.date)) return false;
    state.blocks = state.blocks.map((x) => (x.id === b.id ? addAbsence(b, data.date, data.count || 1) : x));
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn());
    return true;
  }
  const item = state.items.find((i) => i.id === data.id);
  if (!item || item.done) return false;
  const now = new Date();
  if (action === 'feito') state.items = complete(state.items, item.id, now);
  else if (action === 'amanha') state.items = state.items.map((i) => (i.id === item.id ? { ...i, date: addDays(todayISO(now), 1) } : i));
  else {
    const later = new Date(now.getTime() + 3600000);
    state.items = state.items.map((i) => (i.id === item.id && !i.repeat ? { ...i, date: todayISO(later), time: i.type === 'money' ? null : hhmm(later.getHours(), later.getMinutes()) } : i));
  }
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  await syncReminders(state);
  listeners.forEach((fn) => fn());
  return true;
}

if (Platform.OS !== 'web') {
  try {
    const TaskManager = require('expo-task-manager');
    const Notifications = require('expo-notifications');
    TaskManager.defineTask(TASK, async ({ data, error }) => {
      if (error || !data || !data.actionIdentifier) return;
      try {
        await handleResponse(data);
      } catch (e) {
        // um erro aqui não pode derrubar o app
      }
    });
    Notifications.registerTaskAsync(TASK).catch(() => {});
  } catch (e) {
    // sem a tarefa, os botões funcionam com o app aberto
  }
}
