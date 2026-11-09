// Feriados no calendário (1.12). Tudo calculado no aparelho, sem internet.
// Nacionais fixos, móveis pela Páscoa e estaduais pelo estado escolhido no perfil.
// Municipais ficam de fora por enquanto (são milhares).
//
// A TABELA PRECISA SER CONFERIDA A CADA ANO: leis mudam. Última conferência: novembro de 2026.
// Critério: só entra o que aparece em pelo menos duas fontes ou numa lei/ato oficial citado.
// Casos que enganam:
//  - Paraná: 19/12 NÃO é feriado desde a Lei Estadual 18.384/2014 (fica como data comemorativa).
//  - 20/11 só é nacional a partir de 2024 (Lei 14.759/2023).
//  - Espírito Santo: N. Sra. da Penha é móvel, segunda-feira 8 dias depois da Páscoa.
//  - Santa Catarina: 11/08 é transferido por lei para o domingo seguinte.
//  - Goiás e Mato Grosso: sem feriado estadual para todos (o 28/10 de Goiás é dos servidores).
//  - Santa Catarina tem projeto para 25/11 (PL 23/2026): só entra se virar lei.
import { pad } from './utils';

export const STATES = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'],
  ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];

export const HOLIDAY_LABEL = {
  nacional: 'Feriado nacional',
  estadual: 'Feriado estadual',
  facultativo: 'Ponto facultativo',
  comemorativa: 'Data comemorativa, não é feriado',
};

// [mês, dia, nome, desde que ano (opcional)]
const NATIONAL = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Consciência Negra', 2024],
  [12, 25, 'Natal'],
];

// [mês, dia, nome] ou { easter: dias depois da Páscoa, name } ou { sundayAfter: [mês, dia], name };
// type: 'comemorativa' quando a data existe mas não é feriado
const STATE_TABLE = {
  AC: [[1, 20, 'Dia do Católico'], [1, 23, 'Dia do Evangélico'], [3, 8, 'Dia Internacional da Mulher'], [6, 15, 'Aniversário do Acre'], [9, 5, 'Dia da Amazônia'], [11, 17, 'Tratado de Petrópolis']],
  AL: [[6, 24, 'São João'], [6, 29, 'São Pedro'], [9, 16, 'Emancipação de Alagoas'], [11, 30, 'Dia do Evangélico']],
  AP: [[3, 19, 'São José'], [5, 15, 'Dia de Cabralzinho'], [9, 13, 'Aniversário do Amapá']],
  AM: [[9, 5, 'Elevação do Amazonas a província']],
  BA: [[7, 2, 'Independência da Bahia']],
  CE: [[3, 19, 'São José'], [3, 25, 'Data Magna do Ceará']],
  DF: [[4, 21, 'Fundação de Brasília'], [11, 30, 'Dia do Evangélico']],
  ES: [{ easter: 8, name: 'Nossa Senhora da Penha' }],
  GO: [],
  MA: [[7, 28, 'Adesão do Maranhão à Independência']],
  MT: [],
  MS: [[10, 11, 'Criação de Mato Grosso do Sul']],
  MG: [[4, 21, 'Data Magna de Minas Gerais']],
  PA: [[8, 15, 'Adesão do Pará à Independência']],
  PB: [[8, 5, 'Fundação da Paraíba']],
  PR: [[12, 19, 'Emancipação do Paraná', 'comemorativa']],
  PE: [[3, 6, 'Data Magna de Pernambuco']],
  PI: [[3, 13, 'Batalha do Jenipapo'], [10, 19, 'Dia do Piauí']],
  RJ: [{ easter: -47, name: 'Carnaval' }, [4, 23, 'São Jorge']],
  RN: [[10, 3, 'Mártires de Cunhaú e Uruaçu']],
  RS: [[9, 20, 'Revolução Farroupilha']],
  RO: [[1, 4, 'Criação de Rondônia'], [6, 18, 'Dia do Evangélico']],
  RR: [[10, 5, 'Criação de Roraima']],
  SC: [{ sundayAfter: [8, 11], name: 'Dia de Santa Catarina' }],
  SP: [[7, 9, 'Revolução Constitucionalista']],
  SE: [[7, 8, 'Independência de Sergipe']],
  TO: [[9, 8, 'Nossa Senhora da Natividade'], [10, 5, 'Criação do Tocantins']],
};

const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

function shift(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function sundayOnOrAfter(y, m, d) {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shift(iso(y, m, d), dow === 0 ? 0 : 7 - dow);
}

// Todos os feriados do ano para um estado (ou só os nacionais, sem estado)
export function holidaysOfYear(year, state) {
  const out = [];
  NATIONAL.forEach(([m, d, name, since]) => {
    if (!since || year >= since) out.push({ date: iso(year, m, d), name, type: 'nacional' });
  });
  const e = easter(year);
  out.push({ date: shift(e, -2), name: 'Sexta-feira Santa', type: 'nacional' });
  out.push({ date: shift(e, -48), name: 'Carnaval', type: 'facultativo' });
  out.push({ date: shift(e, -47), name: 'Carnaval', type: 'facultativo' });
  out.push({ date: shift(e, 60), name: 'Corpus Christi', type: 'facultativo' });
  (STATE_TABLE[state] || []).forEach((h) => {
    if (Array.isArray(h)) out.push({ date: iso(year, h[0], h[1]), name: h[2], type: h[3] || 'estadual' });
    else if (h.easter !== undefined) out.push({ date: shift(e, h.easter), name: h.name, type: 'estadual' });
    else if (h.sundayAfter) out.push({ date: sundayOnOrAfter(year, h.sundayAfter[0], h.sundayAfter[1]), name: h.name, type: 'estadual' });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// { 'AAAA-MM-DD': [feriados] } de um mês ('AAAA-MM')
export function holidaysOfMonth(ym, state) {
  const map = {};
  holidaysOfYear(Number(ym.slice(0, 4)), state)
    .filter((h) => h.date.startsWith(ym))
    .forEach((h) => {
      // terça de Carnaval no RJ: o feriado estadual vale mais que o ponto facultativo
      const list = (map[h.date] = map[h.date] || []);
      const same = list.findIndex((x) => x.name === h.name);
      if (same < 0) list.push(h);
      else if (list[same].type === 'facultativo') list[same] = h;
    });
  return map;
}
