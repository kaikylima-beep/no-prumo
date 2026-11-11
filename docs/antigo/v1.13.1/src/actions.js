// Botões dos avisos: "Feito", "Adiar 10 min", "Paguei"/"Recebi", "Lembrar amanhã".
//
// Funciona sem o React: lê e grava direto no armazenamento do celular, porque
// pode rodar com o app fechado (pela tarefa em segundo plano) ou aberto
// (pelo listener em App.js). Um mesmo toque pode chegar pelos dois caminhos,
// então cada toque é tratado uma vez só.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { toISO } from './utils';
import { setReminderStyle, scheduleAt, cancelIds } from './reminders';
import { academicOf, absenceSummary, absenceStatusText } from './academic';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

const KEYS = { task: '@org2/tasks', study: '@org2/study', finance: '@org2/finance' };
const HANDLED_KEY = '@org2/handled';
const SNOOZE_MINUTES = 10;

// O app (quando aberto) se inscreve aqui para recarregar os dados
const listeners = new Set();
export function onExternalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      // ignora
    }
  });
}

async function readJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
const writeJSON = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

export function dataOf(response) {
  const content = (response && response.notification && response.notification.request && response.notification.request.content) || {};
  let data = content.data;
  if ((!data || !Object.keys(data).length) && content.dataString) {
    try {
      data = JSON.parse(content.dataString);
    } catch (e) {
      data = null;
    }
  }
  return data || {};
}

const seen = new Set();

// Trata um toque num botão do aviso. Devolve true se mudou algo.
export async function handleResponse(response) {
  if (!response || !response.notification || !response.notification.request) return false;
  const action = response.actionIdentifier;
  if (!action || action === 'expo.modules.notifications.actions.DEFAULT') return false;
  const req = response.notification.request;
  const key = `${req.identifier}|${action}|${response.notification.date}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const handled = await readJSON(HANDLED_KEY, []);
  if (handled.includes(key)) return false;
  await writeJSON(HANDLED_KEY, [key, ...handled].slice(0, 150));

  const settings = await readJSON('@org2/settings', {});
  setReminderStyle(settings.alertStyle);
  const data = dataOf(response);
  const firedAt = new Date(response.notification.date || Date.now());

  if (action === 'faltei') await markAbsent(data, settings);
  else if (action === 'fui') {
    // nada a guardar: a presença é o normal
  } else if (action === 'feito') await markDone(data, firedAt);
  else if (action === 'pago') await markPaid(data);
  else if (action === 'adiar') await snooze(req.content || {}, data, new Date(Date.now() + SNOOZE_MINUTES * 60000));
  else if (action === 'amanha') {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    await snooze(req.content || {}, data, t);
  }

  if (Notifications && Platform.OS !== 'web') {
    try {
      await Notifications.dismissNotificationAsync(req.identifier);
    } catch (e) {
      // já foi fechado
    }
  }
  emitChange();
  return true;
}

async function markDone(data, firedAt) {
  const key = KEYS[data.kind];
  if (!key || data.kind === 'finance') return;
  const list = await readJSON(key, []);
  const idx = list.findIndex((x) => x.id === data.id);
  if (idx < 0) return;
  const item = { ...list[idx] };
  if (item.repeat) {
    // lembrete que se repete: marca só esta ocorrência
    const slot = `${toISO(firedAt)} ${data.time || item.time || '08:00'}`;
    item.doneSlots = [...new Set([slot, ...(item.doneSlots || [])])].slice(0, 120);
  } else {
    item.done = true;
    await cancelIds(item.notifIds);
    item.notifIds = [];
  }
  list[idx] = item;
  await writeJSON(key, list);
}

// 1.13: "Faltei" no aviso "Foi na aula?": guarda as faltas daquela aula (100 min = 2) e avisa se chegou perto do limite
async function markAbsent(data, settings) {
  if (!data.subjectId) return;
  const list = await readJSON('@org2/subjects', []);
  const idx = list.findIndex((x) => x.id === data.subjectId);
  if (idx < 0) return;
  const s = { ...list[idx] };
  const absences = s.absences || [];
  // o mesmo aviso tocado duas vezes não vira duas faltas
  if (absences.some((a) => a.date === data.date && a.fromAlert && a.end === data.end)) return;
  s.absences = [...absences, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: data.date, count: Math.max(1, Number(data.count) || 1), fromAlert: true, end: data.end || null }];
  list[idx] = s;
  await writeJSON('@org2/subjects', list);
  const sum = absenceSummary(s, academicOf(settings), settings.semester, (settings.profile || {}).state);
  if (sum.status === 'near' || sum.status === 'over') {
    await scheduleAt({ title: 'Estudos', body: `${s.name}: ${absenceStatusText(sum).toLowerCase()}.`, data: { kind: 'study' } }, new Date(Date.now() + 2000));
  }
}

async function markPaid(data) {
  const list = await readJSON(KEYS.finance, []);
  const idx = list.findIndex((x) => x.id === data.id);
  if (idx < 0) return;
  const item = { ...list[idx], status: 'paid' };
  await cancelIds(item.notifIds);
  item.notifIds = [];
  list[idx] = item;
  await writeJSON(KEYS.finance, list);
}

async function snooze(content, data, when) {
  const id = await scheduleAt(
    {
      title: content.title || 'No Prumo',
      body: content.body || '',
      categoryIdentifier: content.categoryIdentifier || (data.kind === 'finance' ? 'conta' : 'lembrete'),
      data: { ...data, snoozed: true },
    },
    when
  );
  // guarda o id no item (avulso) para cancelar se ele for concluído antes
  const key = KEYS[data.kind];
  if (!id || !key) return;
  const list = await readJSON(key, []);
  const idx = list.findIndex((x) => x.id === data.id);
  if (idx < 0 || list[idx].repeat) return;
  list[idx] = { ...list[idx], notifIds: [...(list[idx].notifIds || []), id] };
  await writeJSON(key, list);
}
