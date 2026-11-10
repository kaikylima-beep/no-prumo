// Salvar e abrir arquivos de backup.
import { Platform } from 'react-native';

let FS = null;
let Picker = null;
try {
  FS = require('expo-file-system');
} catch (e) {
  FS = null;
}
try {
  Picker = require('expo-document-picker');
} catch (e) {
  Picker = null;
}

export async function saveText(name, text) {
  try {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name;
      a.click();
      return { ok: true };
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
    await file.write(text);
    return { ok: true };
  } catch (e) {
    return { error: 'Não deu para salvar. Tente outra pasta, como Downloads.' };
  }
}

export async function pickText() {
  if (!Picker) return { error: 'Não deu para abrir os arquivos.' };
  try {
    const res = await Picker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
    if (!res || res.canceled || !res.assets || !res.assets[0]) return { canceled: true };
    const asset = res.assets[0];
    const text = asset.file ? await asset.file.text() : await new FS.File(asset.uri).text();
    return { ok: true, text };
  } catch (e) {
    return { error: 'Não deu para ler esse arquivo.' };
  }
}
