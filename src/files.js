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

// Grava vários arquivos numa pasta que a pessoa escolhe: [{ name, text, mime }] ou [{ name, uri }] (copia os bytes)
export async function saveFolder(files) {
  try {
    if (Platform.OS === 'web') {
      files.filter((f) => f.text !== undefined).forEach((f) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([f.text], { type: f.mime || 'text/plain' }));
        a.download = f.name;
        a.click();
      });
      return { ok: true, count: files.length };
    }
    if (!FS || !FS.Directory || !FS.Directory.pickDirectoryAsync) return { error: 'Este celular não deixa escolher a pasta.' };
    let dir;
    try {
      dir = await FS.Directory.pickDirectoryAsync();
    } catch (e) {
      return { canceled: true };
    }
    if (!dir) return { canceled: true };
    let count = 0;
    for (const f of files) {
      try {
        if (f.text !== undefined) {
          const out = dir.createFile(f.name, f.mime || 'text/markdown');
          await out.write(f.text);
        } else {
          const src = new FS.File(f.uri);
          if (!src.exists) continue;
          const out = dir.createFile(f.name, f.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
          await out.write(await src.bytes());
        }
        count++;
      } catch (e) {
        // segue com os outros arquivos
      }
    }
    return { ok: true, count };
  } catch (e) {
    return { error: 'Não deu para salvar. Tente outra pasta, como Downloads.' };
  }
}

// Prints dos apontamentos: ficam na pasta do app (Paths.document/apontamentos)
function shotsDir() {
  const d = new FS.Directory(FS.Paths.document, 'apontamentos');
  if (!d.exists) d.create();
  return d;
}
export function keepImage(uri) {
  if (!FS || Platform.OS === 'web' || !uri) return uri || null;
  try {
    const name = `print-${Date.now()}-${Math.floor(Math.random() * 1000)}.${/\.png(\?|$)/i.test(uri) ? 'png' : 'jpg'}`;
    const dest = new FS.File(shotsDir(), name);
    new FS.File(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    return uri;
  }
}
export function dropImages(uris = []) {
  if (!FS || Platform.OS === 'web') return;
  uris.forEach((u) => {
    try {
      const f = new FS.File(u);
      if (f.exists) f.delete();
    } catch (e) {
      // já não existe
    }
  });
}

// Print da tela inteira, na hora (Android). null quando não dá (navegador, falha).
export async function takeScreenshot() {
  if (Platform.OS === 'web') return null;
  try {
    const { captureScreen } = require('react-native-view-shot');
    const tmp = await captureScreen({ format: 'jpg', quality: 0.6, result: 'tmpfile' });
    return keepImage(tmp);
  } catch (e) {
    return null;
  }
}
