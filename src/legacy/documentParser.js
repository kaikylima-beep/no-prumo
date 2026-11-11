// Lê extratos, faturas e holerites (PDF com texto ou CSV) e devolve lançamentos
// para a pessoa revisar antes de salvar. Nada aqui grava no store.
//
//   parseDocument({ name, mimeType, bytes }, today, existing) →
//     { items: [...], kind: 'extrato'|'fatura'|'holerite'|'csv', warning? }  ou  { error }
//
// Tudo roda no celular, sem internet. PDF escaneado (foto) não tem texto: o app avisa.
import { inflate } from 'pako';
import { fold, guessFinance } from './parser.js';

// ---------- bytes → texto ----------

function latin1(bytes, start = 0, end = bytes.length) {
  let out = '';
  const CH = 8192;
  for (let i = start; i < end; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(end, i + CH)));
  return out;
}

// UTF-8 sem TextDecoder (o Hermes nem sempre tem). Se não for UTF-8 válido, lê como Latin-1 (Excel antigo).
export function decodeText(bytes) {
  let out = '';
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length) {
    const b = bytes[i];
    let cp;
    let n = 0;
    if (b < 0x80) cp = b;
    else if (b >= 0xc2 && b < 0xe0) (cp = b & 0x1f), (n = 1);
    else if (b >= 0xe0 && b < 0xf0) (cp = b & 0x0f), (n = 2);
    else if (b >= 0xf0 && b < 0xf5) (cp = b & 0x07), (n = 3);
    else return latin1(bytes);
    for (let k = 1; k <= n; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return latin1(bytes);
      cp = (cp << 6) | (c & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += n + 1;
  }
  return out;
}

const toBytes = (str) => {
  const a = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
  return a;
};

// ---------- PDF ----------
// Lê os "content streams" (comprimidos com FlateDecode), segue as fontes com mapa
// ToUnicode e junta o texto em linhas. Cobre os PDFs gerados por bancos e sistemas
// de folha de pagamento. Não faz OCR.

function inflateSafe(raw) {
  try {
    return inflate(raw);
  } catch (e) {
    try {
      // alguns geradores deixam lixo no fim do stream
      return inflate(raw.subarray(0, raw.length - 2));
    } catch (e2) {
      return null;
    }
  }
}

function ascii85(raw) {
  const src = latin1(raw).replace(/^<~/, '').replace(/~>[\s\S]*$/, '').replace(/\s+/g, '');
  const out = [];
  let tuple = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === 'z' && tuple.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    tuple.push(ch.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let v = 0;
      for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length) {
    const n = tuple.length;
    while (tuple.length < 5) tuple.push(84);
    let v = 0;
    for (const t of tuple) v = v * 85 + t;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Uint8Array.from(out);
}

function asciiHex(raw) {
  let h = latin1(raw).replace(/>[\s\S]*$/, '').replace(/[^0-9a-fA-F]/g, '');
  if (h.length % 2) h += '0';
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Objetos "N 0 obj ... endobj", incluindo os guardados dentro de /ObjStm
function readObjects(bin, bytes) {
  const objs = {};
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(bin))) {
    const start = re.lastIndex;
    const end = bin.indexOf('endobj', start);
    if (end < 0) break;
    const body = bin.slice(start, end);
    const obj = { dict: body, stream: null };
    const si = body.indexOf('stream');
    if (si >= 0) {
      obj.dict = body.slice(0, si);
      let s0 = start + si + 6;
      if (bin[s0] === '\r') s0++;
      if (bin[s0] === '\n') s0++;
      let s1 = bin.lastIndexOf('endstream', end);
      if (s1 < s0) s1 = end;
      while (s1 > s0 && (bin[s1 - 1] === '\n' || bin[s1 - 1] === '\r')) s1--;
      obj.raw = bytes.subarray(s0, s1);
    }
    objs[m[1]] = obj;
    re.lastIndex = end;
  }
  // descomprime (Flate, ASCII85 e ASCIIHex, em sequência)
  for (const id of Object.keys(objs)) {
    const o = objs[id];
    if (!o.raw) continue;
    const fm = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.dict);
    const filters = fm ? fm[1].match(/\/\w+/g) || [] : [];
    let data = o.raw;
    for (const f of filters) {
      if (!data) break;
      if (f === '/FlateDecode' || f === '/Fl') data = inflateSafe(data);
      else if (f === '/ASCII85Decode' || f === '/A85') data = ascii85(data);
      else if (f === '/ASCIIHexDecode' || f === '/AHx') data = asciiHex(data);
      else data = null; // imagens (DCT, JBIG2…): não interessam
    }
    o.stream = data ? latin1(data) : null;
  }
  // objetos comprimidos (PDF 1.5+)
  for (const id of Object.keys(objs)) {
    const o = objs[id];
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const first = Number((/\/First\s+(\d+)/.exec(o.dict) || [])[1] || 0);
    const head = o.stream.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < head.length; k += 2) {
      const num = head[k];
      const off = first + head[k + 1];
      const next = k + 3 < head.length ? first + head[k + 3] : o.stream.length;
      if (!objs[num]) objs[num] = { dict: o.stream.slice(off, next), stream: null };
    }
  }
  return objs;
}

const ref = (dict, key) => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  return m ? m[1] : null;
};

// Mapa ToUnicode: código (hex) → texto
function parseCMap(src) {
  const map = {};
  let bytesPerCode = 1;
  const hexToStr = (h) => {
    let s = '';
    for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    if (h.length === 2) s = String.fromCharCode(parseInt(h, 16));
    return s;
  };
  const cs = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*endcodespacerange/.exec(src) || /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(src);
  if (cs) bytesPerCode = cs[1].length / 2;
  src.replace(/beginbfchar([\s\S]*?)endbfchar/g, (_, body) => {
    body.replace(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, (__, a, b) => {
      map[parseInt(a, 16)] = hexToStr(b);
      bytesPerCode = a.length / 2;
    });
  });
  src.replace(/beginbfrange([\s\S]*?)endbfrange/g, (_, body) => {
    body.replace(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F]+>)/g, (__, a, b, c) => {
      const lo = parseInt(a, 16);
      const hi = parseInt(b, 16);
      bytesPerCode = a.length / 2;
      if (c[0] === '[') {
        const list = c.match(/<([0-9a-fA-F]+)>/g) || [];
        list.forEach((h, k) => (map[lo + k] = hexToStr(h.slice(1, -1))));
      } else {
        const base = c.slice(1, -1);
        const start = parseInt(base.slice(-4) || base, 16);
        const prefix = base.length > 4 ? hexToStr(base.slice(0, -4)) : '';
        for (let k = 0; lo + k <= hi && k < 65536; k++) map[lo + k] = prefix + String.fromCharCode(start + k);
      }
    });
  });
  return { map, bytesPerCode };
}

// Windows-1252 nas posições 0x80–0x9F (aspas, travessão…); o resto é Latin-1
const W1252 = { 0x80: '€', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x96: '–', 0x97: '—', 0x95: '•' };
const decodeSimple = (str) => str.replace(/[\x80-\x9f]/g, (ch) => W1252[ch.charCodeAt(0)] || '');


// string literal "(...)" com escapes do PDF
function readLiteral(src, i) {
  let depth = 1;
  let out = '';
  i++;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '\\') {
      const n = src[i + 1];
      const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (esc[n] !== undefined) {
        out += esc[n];
        i += 2;
      } else if (/[0-7]/.test(n)) {
        const oct = /^[0-7]{1,3}/.exec(src.slice(i + 1, i + 4))[0];
        out += String.fromCharCode(parseInt(oct, 8));
        i += 1 + oct.length;
      } else if (n === '\r' || n === '\n') {
        i += n === '\r' && src[i + 2] === '\n' ? 3 : 2;
      } else {
        out += n || '';
        i += 2;
      }
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) break;
    }
    out += ch;
    i++;
  }
  return [out, i + 1];
}

const readHex = (src, i) => {
  const end = src.indexOf('>', i);
  let h = src.slice(i + 1, end).replace(/\s+/g, '');
  if (h.length % 2) h += '0';
  let out = '';
  for (let k = 0; k < h.length; k += 2) out += String.fromCharCode(parseInt(h.slice(k, k + 2), 16));
  return [out, end + 1];
};

// ---- matrizes 2D do PDF: [a b c d e f] ----
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const ID = [1, 0, 0, 1, 0, 0];

// Interpreta os operadores de texto e devolve pedaços com posição na página:
// { x0, x1, y, size, str }. As linhas são montadas depois, pela posição, porque
// muitos geradores escrevem cada palavra (ou letra) num comando separado.
function fragmentsOf(src, res, frags, ctm0 = ID, depth = 0) {
  let ctm = ctm0;
  const gstack = [];
  let tm = ID;
  let tlm = ID;
  let font = null;
  let fs = 10;
  let tc = 0;
  let tw = 0;
  let th = 1;
  let tl = 0;
  const stack = [];

  const show = (raw) => {
    const f = font || {};
    const bpc = (f.cmap && f.cmap.bytesPerCode) || f.bpc || 1;
    let str = '';
    const m0 = mul(tm, ctm);
    const size = Math.abs(fs) * (Math.hypot(m0[2], m0[3]) || 1);
    for (let i = 0; i < raw.length; i += bpc) {
      let code = 0;
      for (let k = 0; k < bpc; k++) code = (code << 8) | (raw.charCodeAt(i + k) & 0xff);
      const ch = f.cmap ? (f.cmap.map[code] !== undefined ? f.cmap.map[code] : '') : decodeSimple(raw[i]);
      str += ch;
      const w = (f.widths && f.widths[code] !== undefined ? f.widths[code] : f.dw || 520) / 1000;
      const adv = (w * fs + tc + (bpc === 1 && code === 32 ? tw : 0)) * th;
      tm = mul([1, 0, 0, 1, adv, 0], tm);
    }
    const m1 = mul(tm, ctm);
    if (str) frags.push({ x0: m0[4], x1: m1[4], y: m0[5], size, str });
  };
  const td = (tx, ty) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '%') {
      const e = src.indexOf('\n', i);
      i = e < 0 ? n : e + 1;
    } else if (ch === '(') {
      const [s, j] = readLiteral(src, i);
      stack.push({ str: s });
      i = j;
    } else if (ch === '<' && src[i + 1] === '<') {
      const e = src.indexOf('>>', i);
      i = e < 0 ? n : e + 2;
    } else if (ch === '<') {
      const [s, j] = readHex(src, i);
      stack.push({ str: s });
      i = j;
    } else if (ch === '[') {
      const parts = [];
      let k = i + 1;
      while (k < n && src[k] !== ']') {
        const c = src[k];
        if (c === '(') {
          const [s, j] = readLiteral(src, k);
          parts.push({ str: s });
          k = j;
        } else if (c === '<') {
          const [s, j] = readHex(src, k);
          parts.push({ str: s });
          k = j;
        } else if (/[-+\d.]/.test(c)) {
          const m = /^[-+]?\d*\.?\d+/.exec(src.slice(k, k + 24));
          if (m) {
            parts.push({ num: Number(m[0]) });
            k += m[0].length;
          } else k++;
        } else k++;
      }
      stack.push({ arr: parts });
      i = k + 1;
    } else if (ch === '/') {
      const m = /^\/[^\s/<>[\]()%]+/.exec(src.slice(i, i + 90));
      stack.push({ name: m ? m[0].slice(1) : '' });
      i += m ? m[0].length : 1;
    } else if (/[-+\d.]/.test(ch)) {
      const m = /^[-+]?\d*\.?\d+/.exec(src.slice(i, i + 30));
      if (m) {
        stack.push({ num: Number(m[0]) });
        i += m[0].length;
      } else i++;
    } else if (/[A-Za-z'"*]/.test(ch)) {
      const m = /^[A-Za-z'"*]+/.exec(src.slice(i, i + 6));
      const op = m[0];
      i += op.length;
      const nums = stack.filter((x) => x.num !== undefined).map((x) => x.num);
      const last = (k) => nums.slice(nums.length - k);
      switch (op) {
        case 'BI': {
          const e = src.indexOf('EI', i);
          i = e < 0 ? n : e + 2;
          break;
        }
        case 'q':
          gstack.push(ctm);
          break;
        case 'Q':
          if (gstack.length) ctm = gstack.pop();
          break;
        case 'cm':
          if (nums.length >= 6) ctm = mul(last(6), ctm);
          break;
        case 'BT':
          tm = ID;
          tlm = ID;
          break;
        case 'Tf': {
          const nm = stack.find((x) => x.name !== undefined);
          font = nm ? res.fonts[nm.name] || null : null;
          if (nums.length) fs = nums[nums.length - 1];
          break;
        }
        case 'Tc':
          if (nums.length) tc = nums[nums.length - 1];
          break;
        case 'Tw':
          if (nums.length) tw = nums[nums.length - 1];
          break;
        case 'Tz':
          if (nums.length) th = nums[nums.length - 1] / 100;
          break;
        case 'TL':
          if (nums.length) tl = nums[nums.length - 1];
          break;
        case 'Td':
          if (nums.length >= 2) td(...last(2));
          break;
        case 'TD':
          if (nums.length >= 2) {
            const [x, y] = last(2);
            tl = -y;
            td(x, y);
          }
          break;
        case 'Tm':
          if (nums.length >= 6) {
            tlm = last(6);
            tm = tlm;
          }
          break;
        case 'T*':
          td(0, -tl);
          break;
        case 'Tj':
        case "'":
        case '"': {
          if (op === '"' && nums.length >= 2) [tw, tc] = last(2);
          if (op !== 'Tj') td(0, -tl);
          const s = [...stack].reverse().find((x) => x.str !== undefined);
          if (s) show(s.str);
          break;
        }
        case 'TJ': {
          const a = stack.find((x) => x.arr);
          if (a)
            for (const p of a.arr) {
              if (p.str !== undefined) show(p.str);
              else tm = mul([1, 0, 0, 1, (-p.num / 1000) * fs * th, 0], tm);
            }
          break;
        }
        case 'Do': {
          // texto dentro de um "Form XObject"
          const nm = stack.find((x) => x.name !== undefined);
          const xo = nm && res.xobjects[nm.name];
          if (xo && depth < 4) fragmentsOf(xo, res, frags, ctm, depth + 1);
          break;
        }
        default:
          break;
      }
      stack.length = 0;
    } else i++;
  }
  return frags;
}

// Junta os pedaços em linhas: mesma altura = mesma linha; espaço quando há um vão
function linesOf(frags) {
  const sorted = frags.filter((f) => f.str.trim() || f.str === ' ').sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const rows = [];
  for (const f of sorted) {
    const row = rows.find((r) => Math.abs(r.y - f.y) < Math.max(1.5, 0.45 * Math.min(r.size, f.size)));
    if (row) row.items.push(f);
    else rows.push({ y: f.y, size: f.size, items: [f] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) => {
      r.items.sort((a, b) => a.x0 - b.x0);
      let out = '';
      let end = null;
      for (const f of r.items) {
        if (end !== null && f.x0 - end > 0.2 * f.size && !/\s$/.test(out) && !/^\s/.test(f.str)) out += ' ';
        out += f.str;
        end = Math.max(end === null ? f.x1 : end, f.x1);
      }
      return out.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}

// larguras dos caracteres de uma fonte (para saber onde há espaço entre palavras)
function fontWidths(objs, o) {
  const num = (txt) => (txt.match(/[-\d.]+/g) || []).map(Number);
  const arrOf = (dict, key) => {
    const r = ref(dict, key);
    if (r && objs[r]) return objs[r].dict;
    const m = new RegExp(`/${key}\\s*\\[([\\s\\S]*?)\\]`).exec(dict);
    return m ? m[1] : null;
  };
  const widths = {};
  let dw;
  if (/\/Subtype\s*\/Type0/.test(o.dict)) {
    const descArr = /\/DescendantFonts\s*\[\s*(\d+)\s+\d+\s+R/.exec(o.dict);
    let dId = descArr ? descArr[1] : ref(o.dict, 'DescendantFonts');
    let d = dId && objs[dId] ? objs[dId].dict : '';
    // DescendantFonts pode ser uma referência para um array
    const inner = /^\s*\[\s*(\d+)\s+\d+\s+R/.exec(d);
    if (inner && objs[inner[1]]) d = objs[inner[1]].dict;
    const dwm = /\/DW\s+(\d+)/.exec(d);
    dw = dwm ? Number(dwm[1]) : 1000;
    const wRef = ref(d, 'W');
    const wTxt = wRef && objs[wRef] ? objs[wRef].dict : (/\/W\s*\[([\s\S]*)\]/.exec(d) || [])[1];
    if (wTxt) {
      // formatos: c [w1 w2 ...]   ou   c1 c2 w
      const re = /(\d+)\s*\[([^\]]*)\]|(\d+)\s+(\d+)\s+([-\d.]+)/g;
      let m;
      while ((m = re.exec(wTxt))) {
        if (m[1] !== undefined) num(m[2]).forEach((w, k) => (widths[Number(m[1]) + k] = w));
        else for (let c = Number(m[3]); c <= Number(m[4]) && c - Number(m[3]) < 65536; c++) widths[c] = Number(m[5]);
      }
    }
    return { widths, dw, bpc: 2 };
  }
  const first = Number((/\/FirstChar\s+(\d+)/.exec(o.dict) || [])[1] || 0);
  const w = arrOf(o.dict, 'Widths');
  if (w) num(w).forEach((x, k) => (widths[first + k] = x));
  return { widths, dw: Object.keys(widths).length ? 0 : 520, bpc: 1 };
}

export function extractPdfText(bytes) {
  const bin = latin1(bytes);
  if (!bin.startsWith('%PDF')) return { error: 'not-pdf' };
  if (/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(bin)) return { error: 'encrypted' };
  const objs = readObjects(bin, bytes);

  // fontes e formulários (XObject) pelo nome usado no conteúdo (/F1, /Fm0)
  // fontes e formulários (XObject) pelo nome usado no conteúdo (/F1, /Fm0).
  // Cada página tem os seus: o mesmo nome (/F1) pode apontar para fontes diferentes
  // em páginas diferentes (o extrato do Itaú faz isso), então o mapa é por página.
  const fontCache = {};
  const fontInfo = (id) => {
    if (fontCache[id]) return fontCache[id];
    const o = objs[id];
    const tu = ref(o.dict, 'ToUnicode');
    const cm = tu && objs[tu] && objs[tu].stream ? parseCMap(objs[tu].stream) : null;
    fontCache[id] = { cmap: cm && Object.keys(cm.map).length ? cm : null, ...fontWidths(objs, o) };
    return fontCache[id];
  };
  const scanDict = (txt, kind, into) => {
    txt.replace(/\/([^\s/<>[\]()]+)\s+(\d+)\s+0\s+R/g, (_, name, id) => {
      const o = objs[id];
      if (!o) return '';
      if (kind === 'font' && /\/Type\s*\/Font|\/BaseFont/.test(o.dict) && !into.fonts[name]) into.fonts[name] = fontInfo(id);
      if (kind === 'xo' && /\/Subtype\s*\/Form/.test(o.dict) && o.stream && !into.xobjects[name]) into.xobjects[name] = o.stream;
      return '';
    });
  };
  // valor de uma chave: dicionário "<< … >>" (com aninhamento) ou referência "N 0 R"
  const valueOf = (dict, key) => {
    const m = new RegExp(`/${key}\\s*`).exec(dict);
    if (!m) return null;
    let i = m.index + m[0].length;
    if (dict.startsWith('<<', i)) {
      let depth = 0;
      for (let k = i; k < dict.length - 1; k++) {
        if (dict[k] === '<' && dict[k + 1] === '<') {
          depth++;
          k++;
        } else if (dict[k] === '>' && dict[k + 1] === '>') {
          depth--;
          k++;
          if (depth === 0) return dict.slice(i + 2, k - 1);
        }
      }
      return dict.slice(i + 2);
    }
    const r = /^(\d+)\s+\d+\s+R/.exec(dict.slice(i, i + 24));
    return r && objs[r[1]] ? objs[r[1]].dict : null;
  };
  const resourcesOf = (pid) => {
    let id = pid;
    for (let guard = 0; id && objs[id] && guard < 12; guard++) {
      const r = valueOf(objs[id].dict, 'Resources');
      if (r) return r;
      id = ref(objs[id].dict, 'Parent');
    }
    return '';
  };
  // reserva: tudo o que existe no arquivo, para fontes que a página não declara
  const all = { fonts: {}, xobjects: {} };
  for (const id of Object.keys(objs)) {
    const d = objs[id].dict;
    for (const [key, kind] of [
      ['Font', 'font'],
      ['XObject', 'xo'],
    ]) {
      const v = valueOf(d, key);
      if (v) scanDict(v, kind, all);
    }
  }
  const pageRes = (pid) => {
    const r = resourcesOf(pid);
    const out = { fonts: {}, xobjects: {} };
    const f = r && valueOf(r, 'Font');
    if (f) scanDict(f, 'font', out);
    const x = r && valueOf(r, 'XObject');
    if (x) scanDict(x, 'xo', out);
    return { fonts: { ...all.fonts, ...out.fonts }, xobjects: { ...all.xobjects, ...out.xobjects } };
  };

  // páginas na ordem do documento (Catalog → Pages → Kids)
  const pages = [];
  const walk = (id, guard = 0) => {
    const o = objs[id];
    if (!o || guard > 50) return;
    if (/\/Type\s*\/Pages\b/.test(o.dict)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(o.dict);
      if (kids) kids[1].replace(/(\d+)\s+\d+\s+R/g, (_, k) => walk(k, guard + 1));
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(id);
  };
  const cat = Object.keys(objs).find((id) => /\/Type\s*\/Catalog/.test(objs[id].dict));
  if (cat) walk(ref(objs[cat].dict, 'Pages'));
  if (!pages.length) Object.keys(objs).forEach((id) => /\/Type\s*\/Page\b/.test(objs[id].dict) && pages.push(id));

  const lines = [];
  for (const pid of pages) {
    const d = objs[pid].dict;
    const ids = [];
    const arr = /\/Contents\s*\[([^\]]*)\]/.exec(d);
    if (arr) arr[1].replace(/(\d+)\s+\d+\s+R/g, (_, x) => ids.push(x));
    else {
      const one = ref(d, 'Contents');
      if (one && objs[one] && !objs[one].stream && /^\s*\[/.test(objs[one].dict)) objs[one].dict.replace(/(\d+)\s+\d+\s+R/g, (_, x) => ids.push(x));
      else if (one) ids.push(one);
    }
    const src = ids.map((x) => (objs[x] && objs[x].stream) || '').join('\n');
    lines.push(...linesOf(fragmentsOf(src, pageRes(pid), [])));
  }
  const text = lines.join('\n');
  if (text.replace(/[^A-Za-z0-9]/g, '').length < 20) return { error: 'scanned' };
  return { text, lines };
}

// ---------- CSV ----------

export function parseCSV(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let q = false;
  for (const ch of first) {
    if (ch === '"') q = !q;
    else if (!q && counts[ch] !== undefined) counts[ch]++;
  }
  const sep = counts[';'] >= counts[','] && counts[';'] >= counts['\t'] ? (counts[';'] ? ';' : counts['\t'] ? '\t' : ',') : counts['\t'] > counts[','] ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

// ---------- números e datas brasileiros ----------

// "1.234,56" "-1234.56" "R$ 99,90" "150,00 D" "(80,00)" → número (negativo = saída)
export function parseAmount(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = /^-|^\(|-$|\)$|[\d)]D$/i.test(s.replace(/\s+/g, ''));
  const credit = /[\d)]C$/i.test(s.replace(/\s+/g, ''));
  s = s.replace(/R\$|\s|[()]|[DC]$/gi, '').replace(/^-|-$/g, '').replace(/^\+/, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(/[.,]/g, '');
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  if (credit) neg = false;
  return neg ? -v : v;
}

const pad = (n) => String(n).padStart(2, '0');

// "05/11/2026", "05/11/26", "05/11", "2026-11-05", "05 NOV" → ISO (ou null)
const MONTH_ABBR = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
export function parseDateBR(raw, today) {
  const s = fold(String(raw || '')).trim();
  const ty = Number(today.slice(0, 4));
  let d;
  let m;
  let y;
  let r = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (r) [, y, m, d] = r.map(Number);
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(s))) {
    d = Number(r[1]);
    m = Number(r[2]);
    y = r[3] ? Number(r[3].length === 2 ? `20${r[3]}` : r[3]) : null;
  } else if ((r = /^(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:de\s+)?(\d{4}))?/.exec(s))) {
    d = Number(r[1]);
    m = MONTH_ABBR[r[2]];
    y = r[3] ? Number(r[3]) : null;
  } else return null;
  if (!m || m > 12 || !d || d > 31) return null;
  if (!y) {
    // sem ano: o mais recente que não passe muito de hoje
    y = ty;
    if (`${y}-${pad(m)}-${pad(d)}` > addMonthIso(today, 1)) y -= 1;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

function addMonthIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ---------- título e categoria ----------

// prefixos de extrato que não ajudam a reconhecer o gasto
const NOISE =
  /\b(?:compra\s+(?:no\s+)?(?:cartao\s+)?(?:de\s+)?(?:debito|credito)?|compra\s+cartao|pagamento\s+(?:de\s+)?(?:boleto\s+)?|pagto\s+|pag\s+|boleto\s+|pay\s+|pix\s+qrs?\s+|pix\s+(?:enviado|recebido|transf\w*)(?:\s+para)?|transf\w*\s+(?:enviada|recebida|pix)?|ted\s+|doc\s+|deb\.?\s+aut\.?|debito\s+automatico|parc\w*\s+\d+\/\d+|\d{2}\/\d{2}\s*$)|\*+/g;
const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function niceTitle(desc) {
  // "PIX TRANSF Fulano N06/11": a data vem grudada no fim do nome
  const orig = String(desc || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\d{2}\/\d{2}$/, '');
  const f = fold(orig);
  // fold troca letra por letra, então dá para cortar os mesmos trechos do original e manter os acentos
  let t = '';
  if (f.length === orig.length) {
    let last = 0;
    f.replace(NOISE, (m, off) => {
      t += `${orig.slice(last, off)} `;
      last = off + m.length;
      return m;
    });
    t += orig.slice(last);
  } else t = f.replace(NOISE, ' ');
  t = t.replace(/[^A-Za-zÀ-ÿ0-9&/.\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3) t = orig;
  // só números ("PAY 31 09"): compra no débito sem nome de loja
  if (!/[a-z\u00e0-\u00ff]{2,}/i.test(t)) return 'Compra no débito';
  t = t
    .toLowerCase()
    .split(' ')
    .map((w, k) => (k > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
  return t.length > 42 ? `${t.slice(0, 40).trim()}…` : t;
}

// nomes que aparecem nos extratos e já dizem a categoria
const MERCHANTS = [
  [/\b(copel|cemig|enel|light|celesc|energisa|coelba|sabesp|sanepar|copasa|claro|vivo|tim|oi|net|edificio|condominio|aluguel)\b/, 'Contas'],
  [/\b(fatura\s+paga|pagamento\s+fatura)\b/, 'Cartão'],
  [/\b(carre\w*|merca\w*|atacad\w*|assai|supermerc\w*|padaria|ifood|restaurante)\b/, 'Alimentação'],
  [/\b(uber|99app|99\s+pop|posto|combustivel)\b/, 'Transporte'],
  [/\b(farmacia|drogaria|droga\w*|raia)\b/, 'Saúde'],
  [/\b(iof|juros|tarifa|anuidade)\b/, 'Contas'],
];

const IN_HINT = /\b(pix\s+recebido|recebid[oa]|salario|deposito|credito\s+em\s+conta|transf\w*\s+recebida|estorno|rendimento|reembolso|ted\s+recebida|proventos)\b/;
const OUT_HINT = /\b(compra|pagamento|pix\s+enviado|enviad[oa]|debito|saque|tarifa|boleto|fatura|iof|juros|anuidade)\b/;
const SKIP_RE = /\b(saldo|total|limite|subtotal|resumo|lancamentos\s+futuros|pagamento\s+minimo|vencimento\s+da\s+fatura|valor\s+da\s+fatura)\b/;
// cobranças do banco ("JUROS LIMITE DA CONTA", "IOF SALDO DEVEDOR") têm essas palavras mas são gasto de verdade
const CHARGE_RE = /\b(juros|iof|tarifa|encargos?|multa|anuidade)\b/;
const SKIP = { test: (f) => SKIP_RE.test(f) && !CHARGE_RE.test(f) };

function makeItem({ date, desc, amount, typeHint }, today, ctx) {
  const f = fold(desc);
  let type;
  if (typeHint) type = typeHint;
  else if (ctx === 'fatura') type = amount < 0 || /\b(pagamento|estorno|credito)\b/.test(f) ? 'in' : 'out';
  else if (amount < 0) type = 'out';
  else if (IN_HINT.test(f)) type = 'in';
  else if (OUT_HINT.test(f)) type = 'out';
  else type = 'in';
  // na fatura, o "pagamento recebido" não é renda: é o dinheiro que veio da conta corrente
  // pagar a fatura anterior. Vira transferência (entrando no cartão), que não conta no orçamento.
  if (ctx === 'fatura' && type === 'in') {
    if (/\bpagamento\b/.test(f)) {
      return {
        title: 'Pagamento da fatura',
        amount: Math.abs(amount),
        type: 'transfer',
        dir: 1,
        category: 'Transferência',
        date: date || today,
        status: 'paid',
        source: desc,
        hint: 'Pagamento da fatura: transferência da conta corrente para o cartão',
      };
    }
    return null;
  }
  let title = niceTitle(desc);
  const known = MERCHANTS.find(([re]) => re.test(fold(title))) || MERCHANTS.find(([re]) => re.test(f));
  // títulos mais claros para o que o banco escreve de um jeito torto
  if (/\bfatura\s+paga\b|\bpagamento\s+(?:de\s+)?fatura\b/.test(f)) title = 'Fatura do cartão';
  else if (/^pix\b/.test(f) && !known) {
    if (title === 'Compra no débito') title = type === 'in' ? 'Pix recebido' : 'Pix enviado';
    else title = type === 'in' ? `Pix de ${title}` : `Pix para ${title}`;
  }
  // categoria pelo nome já limpo ("Supermercado Bom Preço"), não pelo prefixo ("compra cartão débito")
  let g = guessFinance(fold(title), type === 'in');
  if (g.category === 'Outros') g = guessFinance(f, type === 'in');
  if (type === 'in' && g.label && g.category !== 'Outros') title = g.label; // "REMUNERACAO/SALARIO" → "Salário"
  return {
    title: title || (type === 'in' ? 'Entrada' : 'Despesa'),
    amount: Math.abs(amount),
    type,
    category:
      known && type === 'out'
        ? known[1]
        : ctx === 'fatura' && g.category === 'Outros'
        ? 'Cartão'
        : // boleto e débito automático costumam ser contas (escola, aluguel, luz)
        type === 'out' && g.category === 'Outros' && /\bboleto\b|\bdeb\.?\s+aut|\bdebito\s+automatico\b/.test(f)
        ? 'Contas'
        : g.category,
    date: date || today,
    status: (date || today) > today ? 'pending' : 'paid',
    source: desc,
  };
}

// ---------- texto (PDF ou .txt) → lançamentos ----------

const MONEY = /(?:R\$\s*)?-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s*[DC]\b)?|(?:R\$\s*)?-?\d+,\d{2}(?:\s*[DC]\b)?/g;
const DATE_START = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?)\s+/i;

export function detectKind(text) {
  const f = fold(text);
  if (/\b(holerite|contracheque|recibo\s+de\s+pagamento|demonstrativo\s+de\s+pagamento|folha\s+de\s+pagamento)\b/.test(f) || (/\bliquido\b/.test(f) && /\b(proventos|vencimentos)\b/.test(f)))
    return 'holerite';
  // extrato de conta pode citar "fatura paga" e "limite da conta": confere o extrato primeiro
  if (/\bextrato\b/.test(f) || /\bsaldo\s+do\s+dia\b/.test(f)) return 'extrato';
  if (/\b(fatura|cartao\s+de\s+credito)\b/.test(f) && /\b(vencimento|limite)\b/.test(f)) return 'fatura';
  return 'extrato';
}

function parsePayslip(lines, today) {
  // procura "Líquido a receber" / "Valor líquido" e a data de pagamento/competência
  let net = null;
  let gross = null;
  let date = null;
  for (const l of lines) {
    const f = fold(l);
    const vals = (l.match(MONEY) || []).map(parseAmount).filter((v) => v !== null);
    if (/\bliquido\b/.test(f) && vals.length) net = Math.abs(vals[vals.length - 1]);
    else if (/\b(total\s+de\s+)?(proventos|vencimentos)\b/.test(f) && vals.length && gross === null) gross = Math.abs(vals[vals.length - 1]);
    const d = /(\d{2}\/\d{2}\/\d{4})/.exec(l);
    if (d && /\b(pagamento|credito|data)\b/.test(f)) date = parseDateBR(d[1], today);
    if (!date) {
      const comp = /\b(\d{2})\/(\d{4})\b/.exec(l);
      if (comp && /compet|referen|mes/.test(f)) date = `${comp[2]}-${comp[1]}-05`;
    }
  }
  const value = net || gross;
  if (!value) return [];
  return [
    {
      title: 'Salário',
      amount: value,
      type: 'in',
      category: 'Salário',
      date: date || today,
      status: (date || today) > today ? 'pending' : 'paid',
      payslip: true,
      source: net ? `Líquido do holerite${gross ? ` (bruto ${gross.toFixed(2).replace('.', ',')})` : ''}` : 'Total de proventos',
    },
  ];
}

// Pix/TED para o próprio titular, ou "transferência entre contas" / "mesma titularidade"
function isOwnTransfer(desc, holder) {
  const f = fold(desc);
  if (/\b(mesma\s+titularidade|entre\s+contas|conta\s+propria|aplicacao|resgate)\b/.test(f)) return true;
  return !!holder && /\b(pix|transf|ted|doc)/.test(f) && new RegExp(`\\b${holder}`).test(f);
}

const BANKS_RE = [
  [/\bita[uú]\b/i, 'Itaú'],
  [/\bnubank|\bnu\s+pagamentos/i, 'Nubank'],
  [/\bbradesco\b/i, 'Bradesco'],
  [/\bsantander\b/i, 'Santander'],
  [/\bcaixa\s+econ|\bcef\b/i, 'Caixa'],
  [/\bbanco\s+do\s+brasil\b/i, 'Banco do Brasil'],
  [/\bbanco\s+inter\b|\binter\b/i, 'Inter'],
  [/\bc6\s*bank\b/i, 'C6'],
  [/\bpicpay\b/i, 'PicPay'],
  [/\bmercado\s*pago\b/i, 'Mercado Pago'],
];
export function detectBank(text = '', name = '') {
  const t = fold(text.slice(0, 4000) + ' ' + text.slice(-3000));
  for (const [re, bank] of BANKS_RE) if (re.test(name) || re.test(t)) return bank;
  return null;
}

// Dados da conta no cabeçalho e o saldo mais recente do extrato
function statementMeta(lines, text, today, holder) {
  const head = lines.slice(0, 12).join(' ');
  const agency = (/ag[eê]ncia:?\s*(\d{3,5})/i.exec(head) || [])[1] || null;
  const number = (/\bconta:?\s*([\d][\d.-]{3,})/i.exec(head) || [])[1] || null;
  // saldo: a linha "SALDO DO DIA" (ou "saldo final/atual") com a data mais recente
  let balance = null;
  let balanceDate = null;
  let lastDate = null;
  for (const l of lines) {
    const ds = DATE_START.exec(l);
    if (ds) lastDate = parseDateBR(ds[1], today) || lastDate;
    const f = fold(l);
    if (!/\bsaldo\s+(do\s+dia|final|atual|disponivel)\b/.test(f)) continue;
    const m = l.match(MONEY);
    if (!m) continue;
    const v = parseAmount(m[m.length - 1]);
    const d = ds ? lastDate : lastDate || today;
    if (v !== null && d && (!balanceDate || d > balanceDate)) {
      balance = v;
      balanceDate = d;
    }
  }
  return { bank: detectBank(text), agency, number, holder, balance, balanceDate };
}

export function parseStatementText(text, today) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const kind = detectKind(text);
  if (kind === 'holerite') {
    // o holerite diz em que banco e conta o salário cai ("Banco: 341 - Itaú … Conta: 12345-6"):
    // serve só para sugerir a conta na revisão, nunca para criar uma conta nova
    const bankLine = lines.find((l) => /\bbanco\s*:/i.test(l)) || '';
    const number = (/\bconta\s*:?\s*(\d[\d.-]{3,})/i.exec(bankLine) || [])[1] || null;
    return { kind, items: parsePayslip(lines, today), meta: { bank: bankLine ? detectBank(fold(bankLine)) : null, number, payslip: true } };
  }
  const items = [];
  let lastDate = null;
  // titular (linha com nome e CPF): transferência para si mesmo não é renda nem gasto
  let holder = null;
  for (const l of lines.slice(0, 8)) {
    const h = /^([A-Za-zÀ-ú][A-Za-zÀ-ú ]{3,}?)\s+\d{3}\.\d{3}\.\d{3}-\d{2}/.exec(l);
    if (h) {
      holder = fold(h[1]).split(' ')[0];
      break;
    }
  }
  for (const l of lines) {
    const ds = DATE_START.exec(l);
    let rest = l;
    let date = null;
    if (ds) {
      date = parseDateBR(ds[1], today);
      rest = l.slice(ds[0].length);
      if (date) lastDate = date;
    }
    const money = rest.match(MONEY);
    if (!money) continue;
    if (!date && !lastDate) continue;
    if (SKIP.test(fold(rest))) continue;
    // o valor do lançamento é o primeiro número com centavos depois da descrição;
    // um segundo número no fim costuma ser o saldo
    const first = money[0];
    const idx = rest.indexOf(first);
    const desc = rest.slice(0, idx).replace(/[-–|:]+\s*$/, '').trim();
    if (desc.length < 2 || !/[a-z]/i.test(desc)) continue;
    const amount = parseAmount(first);
    if (!amount) continue;
    const it = makeItem({ date: date || lastDate, desc, amount }, today, kind);
    if (it && it.type !== 'transfer' && isOwnTransfer(desc, holder)) {
      it.dir = it.type === 'in' ? 1 : -1;
      it.type = 'transfer';
      it.category = 'Transferência';
      it.title = it.dir > 0 ? 'Transferência de outra conta sua' : 'Transferência para outra conta sua';
      it.hint = 'Transferência entre contas suas: não conta como renda nem gasto';
      // Pix/TED com o nome do titular: vem (ou vai) de outra conta dele, que a revisão pergunta qual é (1.10)
      if (holder && new RegExp(`\\b${holder}`).test(fold(desc))) it.holderPix = true;
    }
    if (it) items.push({ ...it, _desc: desc });
  }
  const meta = statementMeta(lines, text, today, holder);
  postedEarlier(items, meta.balanceDate, kind);
  for (const it of items) delete it._desc;
  return { kind, items, meta };
}

// 1.9.3: o Itaú lista com a data do próximo dia útil compras já feitas ("PAY JANEL 07/11" com data 09/11).
// O saldo do dia 07/11 já desconta essas compras; deixar a data 09/11 fazia o app tratá-las como
// "a pagar" e descontar de novo no previsto. Se a descrição termina com a data da compra e ela é até
// o dia do saldo, a compra fica nesse dia, paga.
function postedEarlier(items, balanceDate, kind) {
  if (kind !== 'extrato' || !balanceDate) return;
  const limit = new Date(`${balanceDate}T12:00:00Z`).getTime();
  for (const it of items) {
    if (!it.date || it.date <= balanceDate) continue;
    const m = /(\d{2})\/?(\d{2})\s*$/.exec(it._desc || '');
    if (!m) continue;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    let y = Number(it.date.slice(0, 4));
    if (mo > Number(it.date.slice(5, 7)) + 1) y -= 1; // compra de dezembro lançada em janeiro
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = new Date(`${iso}T12:00:00Z`).getTime();
    if (!Number.isFinite(t) || t > limit || limit - t > 10 * 86400000) continue;
    it.date = iso;
    it.status = 'paid';
    it.hint = `Compra de ${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}, já descontada no saldo do extrato`;
  }
}

// ---------- CSV → lançamentos ----------

const COL = {
  date: /^(data|date|dt|dia)(\s|$|_|\b)/,
  desc: /(descri|historico|lancamento|estabelecimento|title|titulo|memo|detalhe|nome)/,
  amount: /^(valor|value|amount|quantia|montante)\b/,
  credit: /(credito|entrada)/,
  debit: /(debito|saida)/,
};

export function parseCSVRows(rows, today) {
  if (!rows.length) return { kind: 'csv', items: [] };
  const head = rows[0].map((c) => fold(c));
  const find = (re) => head.findIndex((h) => re.test(h));
  let iDate = find(COL.date);
  let iDesc = find(COL.desc);
  let iAmt = find(COL.amount);
  const iCred = find(COL.credit);
  const iDeb = find(COL.debit);
  const hasHeader = iDate >= 0 || iDesc >= 0 || iAmt >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader || iDate < 0 || (iAmt < 0 && iCred < 0)) {
    // sem cabeçalho reconhecível: adivinha pelas primeiras linhas
    const sample = body.slice(0, 5);
    const score = (fn) => (k) => sample.filter((r) => fn(r[k])).length;
    const cols = (body[0] || []).map((_, k) => k);
    if (iDate < 0) iDate = cols.find((k) => score((v) => parseDateBR(v, today))(k) >= Math.ceil(sample.length / 2));
    if (iAmt < 0 && iCred < 0)
      iAmt = cols.filter((k) => k !== iDate).find((k) => score((v) => parseAmount(v) !== null && /\d[.,]\d{2}\b|^-?\d+$/.test(v))(k) >= Math.ceil(sample.length / 2));
    if (iDesc < 0) {
      const lens = cols.filter((k) => k !== iDate && k !== iAmt).map((k) => [k, sample.reduce((a, r) => a + String(r[k] || '').replace(/[^a-z]/gi, '').length, 0)]);
      lens.sort((a, b) => b[1] - a[1]);
      iDesc = lens.length ? lens[0][0] : -1;
    }
  }
  if (iDate === undefined || iDate < 0 || ((iAmt === undefined || iAmt < 0) && iCred < 0)) return { kind: 'csv', items: [], error: 'columns' };
  // o CSV da fatura do Nubank vem como "date,title,amount", com compras positivas
  const fatura = head.some((h) => /fatura|cartao/.test(h)) || head.join(',') === 'date,title,amount';
  const items = [];
  for (const r of body) {
    const date = parseDateBR(r[iDate], today);
    if (!date) continue;
    const desc = iDesc >= 0 ? r[iDesc] : '';
    if (SKIP.test(fold(desc))) continue;
    let amount;
    let typeHint = null;
    if (iAmt >= 0 && iAmt !== undefined) amount = parseAmount(r[iAmt]);
    else {
      const c = parseAmount(r[iCred]);
      const d = parseAmount(r[iDeb]);
      if (c) (amount = Math.abs(c)), (typeHint = 'in');
      else if (d) (amount = -Math.abs(d)), (typeHint = 'out');
    }
    if (!amount) continue;
    // CSV com só valores positivos e coluna de tipo ("C"/"D", "crédito"/"débito")
    if (!typeHint) {
      const tcell = r.find((c, k) => k !== iDate && k !== iDesc && k !== iAmt && /^(c|d|credito|debito|entrada|saida)$/i.test(fold(c)));
      if (tcell) typeHint = /^(c|credito|entrada)$/i.test(fold(tcell)) ? 'in' : 'out';
    }
    const it = makeItem({ date, desc, amount, typeHint }, today, fatura ? 'fatura' : 'extrato');
    if (it) items.push(it);
  }
  return { kind: fatura ? 'fatura' : 'csv', items };
}

// ---------- entrada única ----------

const sameDay = (a, b) => a.date === b.date && Math.abs(a.amount - b.amount) < 0.005 && a.type === b.type;

export function parseDocument({ name = '', mimeType = '', bytes }, today, existing = []) {
  const lower = name.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf') || latin1(bytes, 0, 5) === '%PDF-';
  let res;
  if (isPdf) {
    const pdf = extractPdfText(bytes);
    if (pdf.error) return { error: pdf.error };
    res = parseStatementText(pdf.text, today);
  } else {
    const text = decodeText(bytes);
    const rows = parseCSV(text);
    const looksTable = rows.length > 1 && rows.filter((r) => r.length >= 3).length >= rows.length * 0.6;
    res = looksTable ? parseCSVRows(rows, today) : parseStatementText(text, today);
  }
  if (res.error && !res.items.length) return { error: res.error };
  if (!res.items.length) return { error: 'empty', kind: res.kind };
  const meta = { bank: null, agency: null, number: null, balance: null, balanceDate: null, ...(res.meta || {}) };
  if (!meta.bank) meta.bank = detectBank('', name);
  // marca o que já parece estar no app (mesmo dia, mesmo valor, mesmo tipo)
  const items = res.items.map((it, k) => {
    const dup = existing.some((e) => sameDay(e, it));
    return { ...it, key: `imp${k}`, duplicate: dup, selected: !dup };
  });
  return { kind: res.kind, items, meta };
}

export const IMPORT_ERRORS = {
  scanned: 'Este PDF é uma foto (escaneado), então não tem texto para ler. No app do banco, exporte o extrato em PDF normal ou em CSV.',
  encrypted: 'Este PDF tem senha. Abra no app do banco e exporte uma cópia sem senha, ou use o CSV.',
  'not-pdf': 'Não consegui abrir este arquivo como PDF.',
  columns: 'Não achei as colunas de data e valor nesta planilha. O CSV precisa ter pelo menos data e valor.',
  empty: 'Li o arquivo, mas não achei lançamentos com data e valor.',
  read: 'Não consegui ler o arquivo. Tente de novo.',
};
