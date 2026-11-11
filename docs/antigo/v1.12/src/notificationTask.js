// Tarefa em segundo plano: trata os botões dos avisos com o app fechado.
// Precisa ser definida no início do app (importada em index.js).
import { Platform } from 'react-native';
import { handleResponse } from './actions';

export const ACTION_TASK = 'meu-organizador-botoes-dos-avisos';

if (Platform.OS !== 'web') {
  try {
    const TaskManager = require('expo-task-manager');
    const Notifications = require('expo-notifications');
    TaskManager.defineTask(ACTION_TASK, async ({ data, error }) => {
      if (error || !data || !data.actionIdentifier) return;
      try {
        await handleResponse(data);
      } catch (e) {
        // um erro aqui não pode derrubar o app
      }
    });
    Notifications.registerTaskAsync(ACTION_TASK).catch(() => {});
  } catch (e) {
    // sem a tarefa, os botões funcionam com o app aberto
  }
}
