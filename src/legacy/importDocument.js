// Escolher um arquivo (PDF ou CSV) no celular e ler os lançamentos.
// O resultado vai para a revisão em lote (EditSheet), nunca direto para os dados.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseDocument, IMPORT_ERRORS } from './documentParser.js';
import { todayISO } from './utils.js';

const TYPES = [
  'application/pdf',
  'text/csv',
  'text/comma-separated-values',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel', // alguns bancos marcam o CSV assim
];

const MAX_BYTES = 8 * 1024 * 1024;

// → { canceled: true } | { error: 'texto para mostrar' } | { name, kind, items }
export async function pickAndReadDocument(existingFinance = []) {
  let res;
  try {
    res = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true, multiple: false });
  } catch (e) {
    return { error: IMPORT_ERRORS.read };
  }
  if (!res || res.canceled || !res.assets || !res.assets.length) return { canceled: true };
  return readDocumentAsset(res.assets[0], existingFinance);
}

// Lê um arquivo já no celular: do seletor de arquivos ou do menu "Compartilhar"
export async function readDocumentAsset(asset, existingFinance = []) {
  if (!asset || asset.error) return { error: IMPORT_ERRORS.read };
  if (asset.size && asset.size > MAX_BYTES) return { error: 'Arquivo grande demais (mais de 8 MB). Exporte só o mês que você quer.' };
  try {
    // no navegador (só para testes) o seletor já entrega o arquivo; no Android, lê a cópia do cache
    const file = asset.file ? null : new File(asset.uri);
    const bytes = asset.file ? new Uint8Array(await asset.file.arrayBuffer()) : await file.bytes();
    const out = parseDocument({ name: asset.name || '', mimeType: asset.mimeType || '', bytes }, todayISO(), existingFinance);
    try {
      if (file) file.delete(); // a cópia no cache não é mais necessária
    } catch (e) {
      // sem problema
    }
    if (out.error) return { error: IMPORT_ERRORS[out.error] || IMPORT_ERRORS.read };
    return { name: asset.name || 'arquivo', kind: out.kind, items: out.items, meta: out.meta };
  } catch (e) {
    return { error: IMPORT_ERRORS.read };
  }
}

export const KIND_LABEL = {
  extrato: 'Extrato',
  fatura: 'Fatura do cartão',
  holerite: 'Holerite',
  csv: 'Planilha',
};

// Dados para a revisão em lote a partir do que foi lido
export function batchFromImport(r) {
  return {
    kind: 'finance',
    items: r.items,
    meta: r.meta,
    docKind: r.kind,
    title: r.name,
    subtitle:
      r.kind === 'holerite'
        ? 'Holerite · confirma o salário do mês. Se o extrato já trouxe esse salário, ele não entra de novo.'
        : `${KIND_LABEL[r.kind] || 'Arquivo'} · ${r.items.length} ${r.items.length === 1 ? 'lançamento' : 'lançamentos'}`,
  };
}
