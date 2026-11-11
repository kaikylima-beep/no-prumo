// Avisos do celular. A lista inteira é refeita a partir do plano (core/plan.js).
import { Platform } from 'react-native';
import { planReminders } from './core/plan';

let N = null;
try {
  N = require('expo-notifications');
} catch (e) {
  N = null;
}
const on = () => !!N && Platform.OS !== 'web';
// ids iguais aos da 1.12: trocar faria o Android perder os ajustes que a pessoa fez nos avisos
const CH = { som: 'lembretes-som', quieto: 'lembretes-vibrar' };
const VIBRATION = [0, 350, 180, 350];
let ready = false;

async function setup() {
  N.setNotificationHandler({
    // shouldPlaySound fica sempre true: na expo-notifications ele também libera a vibração
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    const common = { importance: N.AndroidImportance.MAX, enableVibrate: true, vibrationPattern: VIBRATION, lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC };
    await N.setNotificationChannelAsync(CH.som, { name: 'Lembretes com som e vibração', ...common });
    await N.setNotificationChannelAsync(CH.quieto, { name: 'Lembretes só com vibração', ...common, sound: null });
  }
  try {
    const bg = { opensAppToForeground: false };
    await N.setNotificationCategoryAsync('feito', [
      { identifier: 'feito', buttonTitle: 'Feito', options: bg },
      { identifier: 'depois', buttonTitle: 'Daqui a 1 hora', options: bg },
    ]);
    await N.setNotificationCategoryAsync('aula', [
      { identifier: 'fui', buttonTitle: 'Fui', options: bg },
      { identifier: 'faltei', buttonTitle: 'Faltei', options: bg },
    ]);
    await N.setNotificationCategoryAsync('pago', [
      { identifier: 'feito', buttonTitle: 'Já resolvi', options: bg },
      { identifier: 'amanha', buttonTitle: 'Lembrar amanhã', options: bg },
    ]);
  } catch (e) {
    // sem botões, os avisos continuam funcionando
  }
}

// ask = pode abrir o pedido de permissão do Android
export async function ensure(ask = true) {
  if (!on()) return false;
  try {
    if (!ready) {
      await setup();
      ready = true;
    }
    let p = await N.getPermissionsAsync();
    if (!p.granted && ask) p = await N.requestPermissionsAsync();
    return !!p.granted;
  } catch (e) {
    return false;
  }
}

let running = false;
let again = null;
// Refaz todos os avisos a partir dos dados. Chamadas seguidas viram uma só.
export async function syncReminders(state, ask = false) {
  if (!on()) return 0;
  if (running) {
    again = state;
    return 0;
  }
  running = true;
  let count = 0;
  try {
    const plan = planReminders(state, new Date());
    if (await ensure(ask && plan.length > 0)) {
      await N.cancelAllScheduledNotificationsAsync();
      const sound = state.settings.sound !== false;
      for (const r of plan) {
        try {
          await N.scheduleNotificationAsync({
            content: { title: r.title, body: r.body, data: r.data, sound, vibrate: VIBRATION, priority: 'max', ...(r.category ? { categoryIdentifier: r.category } : null) },
            trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.when, channelId: sound ? CH.som : CH.quieto },
          });
          count++;
        } catch (e) {
          // segue para o próximo
        }
      }
    }
  } catch (e) {
    // nada a fazer
  }
  running = false;
  if (again) {
    const s = again;
    again = null;
    return syncReminders(s);
  }
  return count;
}

export async function testAlert(sound = true) {
  if (!(await ensure(true))) return false;
  try {
    await N.scheduleNotificationAsync({
      content: { title: 'Prumo', body: 'É assim que eu vou te avisar.', sound, vibrate: VIBRATION, priority: 'max' },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: sound ? CH.som : CH.quieto },
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function exactAlarmOk() {
  if (!on() || Platform.OS !== 'android' || !N.getExactAlarmPermissionsAsync) return true;
  try {
    return !!(await N.getExactAlarmPermissionsAsync()).granted;
  } catch (e) {
    return true;
  }
}
export async function askExactAlarm() {
  try {
    return !!(await N.requestExactAlarmPermissionsAsync()).granted;
  } catch (e) {
    return false;
  }
}

export function onResponse(fn) {
  if (!on()) return () => {};
  const sub = N.addNotificationResponseReceivedListener(fn);
  return () => sub.remove();
}
