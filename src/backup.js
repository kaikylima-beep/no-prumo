// Backup (1.11): guarda tudo do app num arquivo .json que você salva onde quiser
// (Downloads, Drive, pendrive) e restaura no mesmo celular ou num celular novo.
// Tudo continua sem internet: o arquivo é gerado e lido no próprio aparelho.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let FS = null;
let DocumentPicker = null;
try {
  FS = require('expo-file-system');
} catch (e) {
  FS = null;
}
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  DocumentPicker = null;
}

export const APP_ID = 'no-prumo';
export const BACKUP_FORMAT = 1;
// tudo o que o app guarda; a ordem não importa
export const BACKUP_KEYS = [
  '@org2/tasks',
  '@org2/study',
  '@org2/finance',
  '@org2/recurrences',
  '@org2/accounts',
  '@org2/misheard',
  '@org2/settings',
  '@org2/handled',
  '@org2/subjects', // 1.12
];
// cópia do que havia antes da última restauração (para "Voltar ao que eu tinha")
export const BEFORE_RESTORE_KEY = '@org2/_antes_da_restauracao';
const LIST_KEYS = ['@org2/tasks', '@org2/study', '@org2/finance', '@org2/recurrences', '@org2/accounts', '@org2/misheard', '@org2/subjects'];
const MAX_PHOTO_BASE64 = 1.5 * 1024 * 1024; // foto de perfil até ~1 MB vai junto

const pad = (n) => String(n).padStart(2, '0');

export function backupFileName(now = new Date()) {
  return `no-prumo-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

const len = (v) => (Array.isArray(v) ? v.length : 0);

// quantos itens tem cada área (para mostrar antes de restaurar)
export function backupCounts(data = {}) {
  return {
    tasks: len(data['@org2/tasks']),
    study: len(data['@org2/study']),
    finance: len(data['@org2/finance']),
    accounts: len(data['@org2/accounts']),
    subjects: len(data['@org2/subjects']),
  };
}

// monta o arquivo a partir dos valores já lidos (objeto chave → texto guardado)
export function buildBackup(rawByKey, { appVersion = '', now = new Date(), photo = null } = {}) {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const raw = rawByKey[key];
    if (raw === null || raw === undefined) continue;
    try {
      data[key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      // valor corrompido: fica de fora em vez de estragar o arquivo
    }
  }
  const out = { app: APP_ID, format: BACKUP_FORMAT, appVersion, createdAt: now.toISOString(), counts: backupCounts(data), data };
  if (photo && photo.base64 && photo.base64.length <= MAX_PHOTO_BASE64) out.photo = photo;
  return out;
}

// confere se o texto é um backup do No Prumo; nunca lança erro
export function parseBackup(text) {
  let b;
  try {
    b = JSON.parse(String(text || '').replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, error: 'Esse arquivo não é um backup do No Prumo.' };
  }
  if (!b || b.app !== APP_ID || typeof b.data !== 'object' || b.data === null) {
    return { ok: false, error: 'Esse arquivo não é um backup do No Prumo.' };
  }
  if (Number(b.format) > BACKUP_FORMAT) {
    return { ok: false, error: 'Esse backup foi feito por uma versão mais nova do app. Atualize o No Prumo e tente de novo.' };
  }
  const data = {};
  for (const key of BACKUP_KEYS) {
    if (!(key in b.data)) continue;
    const v = b.data[key];
    if (LIST_KEYS.includes(key) && !Array.isArray(v)) return { ok: false, error: 'O backup está danificado (lista inválida).' };
    if (key === '@org2/settings' && (typeof v !== 'object' || v === null || Array.isArray(v))) {
      return { ok: false, error: 'O backup está danificado (ajustes inválidos).' };
    }
    data[key] = v;
  }
  if (!Object.keys(data).length) return { ok: false, error: 'O backup está vazio.' };
  return { ok: true, backup: { ...b, data, counts: backupCounts(data) } };
}

// pares [chave, texto] para gravar; as chaves que o backup não tem são apagadas,
// para o app ficar exatamente como estava quando o backup foi feito
export function restorePlan(backup) {
  const set = [];
  const remove = [];
  for (const key of BACKUP_KEYS) {
    if (key in backup.data) set.push([key, JSON.stringify(backup.data[key])]);
    else if (key !== '@org2/settings') remove.push(key);
  }
  return { set, remove };
}

async function readAll() {
  const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
  const raw = {};
  pairs.forEach(([k, v]) => {
    raw[k] = v;
  });
  return raw;
}

function readPhoto(raw) {
  if (!FS || Platform.OS === 'web') return null;
  try {
    const settings = JSON.parse(raw['@org2/settings'] || '{}') || {};
    const uri = settings.profile && settings.profile.photo;
    if (!uri) return null;
    const f = new FS.File(uri);
    if (!f.exists) return null;
    return { name: 'perfil.jpg', base64: f.base64Sync() };
  } catch (e) {
    return null;
  }
}

// → { ok: true, name } | { canceled: true } | { error }
export async function exportBackup({ appVersion = '' } = {}) {
  try {
    const raw = await readAll();
    const now = new Date();
    const backup = buildBackup(raw, { appVersion, now, photo: readPhoto(raw) });
    const json = JSON.stringify(backup);
    const name = backupFileName(now);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      return { ok: true, name, counts: backup.counts };
    }
    if (!FS || !FS.Directory || !FS.Directory.pickDirectoryAsync) return { error: 'Este celular não deixa escolher a pasta.' };
    let dir;
    try {
      dir = await FS.Directory.pickDirectoryAsync();
    } catch (e) {
      return { canceled: true };
    }
    if (!dir) return { canceled: true };
    const file = dir.createFile(name, 'application/json');
    await file.write(json);
    return { ok: true, name, counts: backup.counts };
  } catch (e) {
    return { error: 'Não deu para salvar o backup. Tente escolher outra pasta, como Downloads.' };
  }
}

// → { canceled } | { error } | { ok, backup }
export async function pickBackup() {
  if (!DocumentPicker) return { error: 'Não deu para abrir os arquivos.' };
  let res;
  try {
    res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  } catch (e) {
    return { error: 'Não deu para abrir os arquivos.' };
  }
  if (!res || res.canceled || !res.assets || !res.assets[0]) return { canceled: true };
  const asset = res.assets[0];
  try {
    const text = asset.file ? await asset.file.text() : await new FS.File(asset.uri).text();
    return parseBackup(text);
  } catch (e) {
    return { error: 'Não deu para ler esse arquivo.' };
  }
}

function writePhoto(backup) {
  if (!backup.photo || !backup.photo.base64 || !FS || Platform.OS === 'web') return null;
  try {
    const dest = new FS.File(FS.Paths.document, `perfil-${Date.now()}.jpg`);
    dest.create({ overwrite: true });
    const bin = globalThis.atob ? globalThis.atob(backup.photo.base64) : null;
    if (!bin) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    dest.writeSync(bytes);
    return dest.uri;
  } catch (e) {
    return null;
  }
}

// grava o backup no lugar do que existe hoje. Antes, guarda uma cópia do estado atual.
export async function restoreBackup(backup) {
  const current = await readAll();
  await AsyncStorage.setItem(BEFORE_RESTORE_KEY, JSON.stringify({ at: new Date().toISOString(), raw: current }));
  const plan = restorePlan(backup);
  const photoUri = writePhoto(backup);
  const set = plan.set.map(([k, v]) => {
    if (k !== '@org2/settings') return [k, v];
    const s = JSON.parse(v) || {};
    const profile = { ...(s.profile || {}) };
    // a foto do backup aponta para o celular antigo: troca pela cópia nova, ou tira
    profile.photo = photoUri || (profile.photo && FS && Platform.OS !== 'web' && new FS.File(profile.photo).exists ? profile.photo : null);
    return [k, JSON.stringify({ ...s, profile, backup: { ...(s.backup || {}), restoredAt: new Date().toISOString() } })];
  });
  await AsyncStorage.multiSet(set);
  if (plan.remove.length) await AsyncStorage.multiRemove(plan.remove);
}

export async function hasBeforeRestore() {
  try {
    return !!(await AsyncStorage.getItem(BEFORE_RESTORE_KEY));
  } catch (e) {
    return false;
  }
}

// volta ao que havia antes da última restauração
export async function undoRestore() {
  const raw = await AsyncStorage.getItem(BEFORE_RESTORE_KEY);
  if (!raw) return false;
  const snap = JSON.parse(raw);
  const set = [];
  const remove = [];
  for (const key of BACKUP_KEYS) {
    const v = snap.raw ? snap.raw[key] : null;
    if (v === null || v === undefined) remove.push(key);
    else set.push([key, v]);
  }
  if (set.length) await AsyncStorage.multiSet(set);
  if (remove.length) await AsyncStorage.multiRemove(remove);
  await AsyncStorage.removeItem(BEFORE_RESTORE_KEY);
  return true;
}

// "há 3 dias", para o lembrete em Ajustes
export function backupAge(lastAt, now = new Date()) {
  if (!lastAt) return null;
  const days = Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86400000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}
