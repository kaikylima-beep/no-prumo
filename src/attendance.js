// 1.13 · Aviso "Foi na aula de Cálculo 2?" (opcional, Ajustes → Avisos), com os botões Fui / Faltei.
// Agenda só as próximas 2 semanas e refaz a cada abertura do app, para respeitar o semestre,
// os feriados e os horários atuais das matérias. "Faltei" é tratado em src/actions.js.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { academicOf, upcomingClassEnds } from './academic';
import { scheduleAt, cancelIds, CATEGORIES, setReminderStyle } from './reminders';

const KEY = '@org2/attendIds';
const MAX = 40;

export async function scheduleAttendance(subjects = [], settings = {}) {
  if (Platform.OS === 'web') return [];
  let old = [];
  try {
    old = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]') || [];
  } catch (e) {
    old = [];
  }
  await cancelIds(old);
  const academic = academicOf(settings);
  if (!academic.askAttendance) {
    await AsyncStorage.setItem(KEY, '[]');
    return [];
  }
  setReminderStyle(settings.alertStyle);
  const profile = settings.profile || {};
  const ends = upcomingClassEnds(subjects, settings.semester, academic, profile.state, new Date(), 14).slice(0, MAX);
  const ids = [];
  for (const e of ends) {
    const id = await scheduleAt(
      {
        title: 'Estudos',
        body: `Foi na aula de ${e.name}?`,
        categoryIdentifier: CATEGORIES.aula,
        data: { kind: 'study', attend: true, subjectId: e.subjectId, date: e.date, end: e.end, count: e.count },
      },
      e.at
    );
    if (id) ids.push(id);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  return ids;
}
