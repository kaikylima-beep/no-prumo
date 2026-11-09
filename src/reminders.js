// Avisos (notificações locais) agendados no próprio celular.
import { Platform } from 'react-native';
import { addDays, planOffsets } from './parser';
import { diffDays, fromISO, todayISO, formatMoney } from './utils';
import { timesOf } from './recurrence';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

let ready = false;
const DEFAULT_HOUR = 8;

// Canais do Android. As configurações de um canal não mudam depois de criado,
// por isso cada estilo de alerta tem o seu canal.
//   'som'    = toca o som de notificação do aparelho e vibra
//   'vibrar' = só vibra
export const CHANNELS = { som: 'lembretes-som', vibrar: 'lembretes-vibrar' };
const OLD_CHANNEL = 'lembretes'; // da versão 1.2 (sem vibração)
const VIBRATION = [0, 450, 200, 450, 200, 450];

let alertStyle = 'som';
export function setReminderStyle(style) {
  alertStyle = style === 'vibrar' ? 'vibrar' : 'som';
}
export const channelId = () => CHANNELS[alertStyle];
export const VIBRATION_PATTERN = VIBRATION;
export const isSoundOn = () => alertStyle === 'som';

// Botões que aparecem no próprio aviso. Funcionam com o app fechado
// (tratados em src/actions.js e src/notificationTask.js).
export const CATEGORIES = { lembrete: 'lembrete', conta: 'conta', receita: 'receita' };

async function setupCategories() {
  const bg = { opensAppToForeground: false };
  await Notifications.setNotificationCategoryAsync(CATEGORIES.lembrete, [
    { identifier: 'feito', buttonTitle: 'Feito', options: bg },
    { identifier: 'adiar', buttonTitle: 'Adiar 10 min', options: bg },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORIES.conta, [
    { identifier: 'pago', buttonTitle: 'Paguei', options: bg },
    { identifier: 'amanha', buttonTitle: 'Lembrar amanhã', options: bg },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORIES.receita, [
    { identifier: 'pago', buttonTitle: 'Recebi', options: bg },
    { identifier: 'amanha', buttonTitle: 'Lembrar amanhã', options: bg },
  ]);
}

function categoryFor(kind, item) {
  if (kind === 'finance') return item.type === 'in' ? CATEGORIES.receita : CATEGORIES.conta;
  return CATEGORIES.lembrete;
}

async function ensureReady() {
  if (!Notifications || Platform.OS === 'web') return false;
  if (ready) return true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // Não trocar por alertStyle === 'som': na expo-notifications este campo também libera a
        // vibração. Com ele falso e o app aberto, o aviso sai mudo mesmo no canal que vibra (1.12).
        // O silêncio do "Só vibração" vem do canal (sound: null) e do content.sound: false.
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      const common = {
        importance: Notifications.AndroidImportance.MAX,
        enableVibrate: true,
        vibrationPattern: VIBRATION,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      };
      // sem a chave "sound", o Android usa o som padrão de notificação
      await Notifications.setNotificationChannelAsync(CHANNELS.som, {
        name: 'Lembretes com som e vibração',
        ...common,
      });
      await Notifications.setNotificationChannelAsync(CHANNELS.vibrar, {
        name: 'Lembretes só com vibração',
        ...common,
        sound: null,
      });
      try {
        await Notifications.deleteNotificationChannelAsync(OLD_CHANNEL);
      } catch (e) {
        // não existia
      }
    }
    try {
      await setupCategories();
    } catch (e) {
      // sem botões, os avisos continuam funcionando
    }
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    ready = !!granted;
    return ready;
  } catch (e) {
    return false;
  }
}

// Pede a permissão de notificações (usado na primeira abertura)
export async function requestNotifications() {
  return ensureReady();
}

function needsReminder(kind, item) {
  if (kind !== 'finance' && item.repeat) return true;
  if (!item.date) return false;
  if (kind === 'finance') return item.status === 'pending';
  return !item.done;
}

function contentFor(kind, item, body, extraData) {
  return {
    title: TITLES[kind],
    body,
    sound: alertStyle === 'som',
    vibrate: VIBRATION,
    priority: 'max',
    categoryIdentifier: categoryFor(kind, item),
    data: { kind, id: item.id, ...(extraData || {}) },
  };
}

// Lembrete que se repete: um aviso nativo do Android para cada horário
// (diário, semanal ou mensal). Ele continua tocando mesmo sem abrir o app.
async function scheduleRepeating(kind, item) {
  const T = Notifications.SchedulableTriggerInputTypes;
  const rep = item.repeat;
  const ids = [];
  for (const time of timesOf(item)) {
    const [hour, minute] = time.split(':').map(Number);
    const triggers = [];
    if (rep.freq === 'daily') triggers.push({ type: T.DAILY, hour, minute });
    else if (rep.freq === 'weekly') (rep.days || []).forEach((d) => triggers.push({ type: T.WEEKLY, weekday: d + 1, hour, minute }));
    // o Android "pula" para o mês seguinte quando o dia não existe (31 em novembro);
    // por isso dias 29 a 31 avisam no dia 28, antes do prazo e nunca depois
    else if (rep.freq === 'monthly') triggers.push({ type: T.MONTHLY, day: Math.min(rep.day || 1, 28), hour, minute });
    for (const trigger of triggers) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: contentFor(kind, item, `Hora de: ${item.title}`, { time, repeat: true }),
          trigger: { ...trigger, channelId: channelId() },
        });
        ids.push(id);
      } catch (e) {
        // segue para o próximo horário
      }
    }
  }
  return ids;
}

// Um aviso avulso numa data (usado por "Adiar")
export async function scheduleAt(content, date) {
  if (!Notifications || Platform.OS === 'web') return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: alertStyle === 'som', vibrate: VIBRATION, priority: 'max' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: channelId() },
    });
  } catch (e) {
    return null;
  }
}

function bodyFor(kind, item, d) {
  const when = d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `Em ${d} dias`;
  if (kind === 'finance') {
    const value = formatMoney(item.amount || 0);
    if (item.type === 'in') return `${when}: receber ${item.title} · ${value}`;
    return `${d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`}: ${item.title} · ${value}`;
  }
  const at = d === 0 && item.time ? ` às ${item.time}` : '';
  return `${when}${at}: ${item.title}`;
}

const TITLES = { task: 'Tarefas', study: 'Estudos', finance: 'Finanças' };

// Agenda os avisos de um item. Retorna os ids criados.
// level = importância da área ('alta' | 'media' | 'baixa').
export async function scheduleForItem(kind, item, level) {
  if (!needsReminder(kind, item)) return [];
  if (kind !== 'finance' && item.repeat) {
    if (!(await ensureReady())) return [];
    return scheduleRepeating(kind, item);
  }
  const daysUntil = diffDays(todayISO(), item.date);
  if (daysUntil < 0) return [];
  const offsets = planOffsets(kind, kind === 'finance' ? null : item.lead, daysUntil, level);
  if (offsets.length === 0) return [];
  if (!(await ensureReady())) return [];

  const ids = [];
  for (const d of offsets) {
    const when = fromISO(addDays(item.date, -d));
    if (d === 0 && item.time) {
      const [hh, mm] = item.time.split(':').map(Number);
      when.setHours(hh, mm, 0, 0);
    } else {
      when.setHours(DEFAULT_HOUR, 0, 0, 0);
    }
    if (when.getTime() <= Date.now() + 30000) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: contentFor(kind, item, bodyFor(kind, item, d)),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: channelId(),
        },
      });
      ids.push(id);
    } catch (e) {
      // segue para o próximo aviso
    }
  }
  return ids;
}

export async function cancelIds(ids) {
  if (!Notifications || !ids || Platform.OS === 'web') return;
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      // já não existe
    }
  }
}

export async function cancelAll() {
  if (!Notifications || Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    // nada a fazer
  }
}

// Aviso de teste daqui a 1 minuto
// Aviso de teste (1.10.1): ao escolher "Som e vibração" ou "Só vibração", o app agenda um
// aviso igual aos lembretes para daqui a PREVIEW_SECONDS segundos, já no estilo escolhido.
// Antes o aviso saía na hora, com o app aberto: em vários Android só tocava e vibrava, sem
// aparecer a faixa no topo. Com alguns segundos, dá tempo de ver a contagem na tela (e, se
// quiser, até sair do app) e o aviso chega como um lembrete de verdade.
export const PREVIEW_SECONDS = 5;

// A pessoa pode desligar a vibração nos ajustes do Android, e o app não consegue religar.
// true = o canal do estilo atual está com a vibração desligada.
export async function vibrationOff() {
  if (!Notifications || Platform.OS !== 'android') return false;
  try {
    if (!(await ensureReady())) return false;
    const ch = await Notifications.getNotificationChannelAsync(channelId());
    return !!ch && ch.enableVibrate === false;
  } catch (e) {
    return false;
  }
}

export async function previewAlert(style, seconds = PREVIEW_SECONDS) {
  if (style) setReminderStyle(style);
  if (!(await ensureReady())) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'No Prumo · aviso de teste',
        body:
          alertStyle === 'som'
            ? 'Assim chegam seus lembretes: com som e vibração.'
            : 'Assim chegam seus lembretes: só com vibração.',
        sound: alertStyle === 'som',
        vibrate: VIBRATION,
        priority: 'max',
      },
      trigger:
        seconds > 0
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: channelId() }
          : { channelId: channelId() },
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Permissão de alarme exato (Android 12+). Sem ela, o Android pode atrasar avisos.
export async function getExactAlarm() {
  if (!Notifications || Platform.OS !== 'android' || !Notifications.getExactAlarmPermissionsAsync) return true;
  try {
    const r = await Notifications.getExactAlarmPermissionsAsync();
    return !!r.granted;
  } catch (e) {
    return true;
  }
}

export async function requestExactAlarm() {
  if (!Notifications || Platform.OS !== 'android' || !Notifications.requestExactAlarmPermissionsAsync) return true;
  try {
    const r = await Notifications.requestExactAlarmPermissionsAsync();
    return !!r.granted;
  } catch (e) {
    return false;
  }
}
