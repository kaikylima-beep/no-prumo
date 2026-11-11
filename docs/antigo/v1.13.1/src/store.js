import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useStoredState } from './storage';
import { uid, todayISO, ymOf, addMonthsYm, dateInMonth, privacy } from './utils';
import { learn } from './voice';
import { scheduleForItem, cancelIds, cancelAll, setReminderStyle, setHideMoney } from './reminders';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AREAS, AREA_PAL, colors, look } from './theme';
import { restartApp, SETTINGS_KEY } from './Root';
import { onExternalChange } from './actions';
import { currentSlot, slotKey, slotLabel } from './recurrence';
import { migrate113, refundChanges } from './financeFixes';
import { DEFAULT_ACADEMIC, absenceSummary, absenceStatusText } from './academic';
import { scheduleAttendance } from './attendance';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

export const LEVELS = ['alta', 'media', 'baixa'];
export const LEVEL_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const LEVEL_RANK = { alta: 0, media: 1, baixa: 2 };

const DEFAULT_SETTINGS = {
  // 1.12: occupation 'trabalho' | 'estagio' | 'outros' | 'so_estudo' | null, occupationName (em "outros"), state (UF, para feriados)
  profile: { name: '', age: '', photo: null, occupation: null, occupationName: '', state: null },
  levels: { task: 'media', finance: 'media', study: 'media' },
  autoListen: true, // tocar no microfone já começa a ouvir (1.12: ligado para todos, uma vez)
  autoListenSet: false,
  semester: { start: null, end: null }, // 1.12
  shortTitles: true, // títulos abreviados ao falar
  layout: 'advanced', // 'simple' | 'advanced'
  theme: 'light', // 'light' | 'dark'
  used: {}, // áreas que já receberam o primeiro item (os exemplos somem)
  captures: 0, // quantas vezes já salvou pelo microfone
  editHintSeen: false,
  swipeHintSeen: false, // já arrastou uma tarefa para o lado
  alertStyle: 'som', // 'som' (som e vibração) | 'vibrar' (só vibração)
  backup: { lastAt: null, lastName: null, restoredAt: null }, // 1.11
  channelVersion: 1, // 2 = avisos já migrados para os canais com vibração; 3 = com botões
  onboarded: false, // já passou pela primeira abertura
  // salário base, quanto guardar por mês e se extras entram no limite.
  // 1.10: incomeType 'fixed' | 'variable' | null (renda de todo mês ou que varia), salaryDay (dia do pagamento),
  // salaryAsk (salário achado na importação, esperando o "é o seu salário?"), useOwn 'ask' | 'always' | 'never'
  // (dinheiro de outras contas suas no limite), ownMonths { 'AAAA-MM': true/false }, skipMonths ['AAAA-MM']
  // (meses fora do comum, fora das médias) e ownSource (de onde vêm os Pix com o seu nome).
  budget: { salary: null, target: null, countExtras: false, incomeType: null, salaryDay: null, salaryAsk: null, salaryAskSeen: false, useOwn: 'ask', ownMonths: {}, skipMonths: [], ownSource: null },
  defaultAccount: null, // conta usada nos lançamentos por voz
  hideBalance: false, // 1.12.1: valores de dinheiro trocados por "R$ ••••" (fica lembrado)
  voiceOnDevice: true, // 1.12.1: reconhecer no próprio celular quando o aparelho permitir
  voice: { learned: {} }, // 1.12.1: trocas que a pessoa corrigiu ("pique" -> "pix")
  academic: DEFAULT_ACADEMIC, // 1.13: média para passar, nota máxima, duração da aula, limite de faltas, perguntar depois da aula
  testMode: false, // 1.12.2: modo de teste (frases para o desenvolvedor). Liga tocando 5 vezes na versão, em Ajustes
};

// apaga o áudio de uma frase guardada (fica na pasta do app)
let FS = null;
try {
  FS = require('expo-file-system');
} catch (e) {
  FS = null;
}
function dropAudio(uri) {
  if (!uri || !FS || !FS.File) return;
  try {
    const f = new FS.File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    // nada a fazer
  }
}

// conta padrão de um lançamento novo sem conta
function defaultAccountFor(item, accounts, defaultId) {
  if (!accounts.length) return null;
  const cards = accounts.filter((a) => a.kind === 'cartao');
  // compra no cartão ("Tênis", categoria Cartão) vai para o cartão; "Cartão Itaú" é a fatura, fica na conta
  if (item.type === 'out' && item.category === 'Cartão' && !/^cart[aã]o/i.test(item.title || '') && cards.length === 1) return cards[0].id;
  if (defaultId && accounts.some((a) => a.id === defaultId)) return defaultId;
  const main = accounts.find((a) => a.kind === 'corrente');
  return main ? main.id : null;
}

function normalize(kind, data) {
  if (kind === 'finance') {
    return {
      title: data.title,
      amount: data.amount,
      type: data.type || 'out',
      category: data.category || 'Outros',
      date: data.date || todayISO(),
      status: data.status || 'paid',
      recId: data.recId || null,
      note: data.note || null,
      essential: data.type !== 'out' ? null : data.essential === undefined ? null : data.essential,
      // conta do lançamento; numa transferência, de onde sai (from) e para onde vai (to)
      account: data.type === 'transfer' ? null : data.account || null,
      from: data.type === 'transfer' ? data.from || null : null,
      to: data.type === 'transfer' ? data.to || null : null,
      importId: data.importId || null,
    };
  }
  return {
    kind,
    title: data.title,
    date: data.date || null,
    time: data.time || null,
    lead: data.repeat ? null : data.lead === undefined ? null : data.lead,
    ...(kind === 'study' ? { subjectId: data.subjectId || null } : null),
    done: !!data.done,
    note: data.note || null,
    // lembrete que se repete
    repeat: data.repeat || null,
    times: data.repeat ? data.times || (data.time ? [data.time] : ['08:00']) : null,
    doneSlots: data.repeat ? data.doneSlots || [] : undefined,
  };
}

export function DataProvider({ children }) {
  const [tasks, setTasks, l1, reloadTasks] = useStoredState('@org2/tasks', []);
  const [study, setStudy, l2, reloadStudy] = useStoredState('@org2/study', []);
  const [finance, setFinance, l3, reloadFinance] = useStoredState('@org2/finance', []);
  const [recurrences, setRecurrences, l4] = useStoredState('@org2/recurrences', []);
  const [misheard, setMisheard, l5] = useStoredState('@org2/misheard', []);
  const [settingsRaw, setSettings, l6] = useStoredState('@org2/settings', DEFAULT_SETTINGS);
  const [accounts, setAccounts, l7] = useStoredState('@org2/accounts', []);
  const [subjects, setSubjects, l8, reloadSubjects] = useStoredState('@org2/subjects', []); // 1.12
  const loaded = l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8;
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  const settings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...settingsRaw,
      profile: { ...DEFAULT_SETTINGS.profile, ...(settingsRaw.profile || {}) },
      // 1.7: cores fixas por área (azul, verde, roxo). Escolhas antigas de família são ignoradas.
      levels: { ...DEFAULT_SETTINGS.levels, ...(settingsRaw.levels || {}) },
      used: { ...(settingsRaw.used || {}) },
      budget: { ...DEFAULT_SETTINGS.budget, ...(settingsRaw.budget || {}) },
      semester: { ...DEFAULT_SETTINGS.semester, ...(settingsRaw.semester || {}) },
      voice: { learned: {}, ...(settingsRaw.voice || {}) },
      academic: { ...DEFAULT_ACADEMIC, ...(settingsRaw.academic || {}) },
    }),
    [settingsRaw]
  );
  // ocultar saldo: lido por showMoney() em todas as telas, antes de elas desenharem
  privacy.hidden = !!settings.hideBalance;

  const setters = useRef({ task: setTasks, study: setStudy, finance: setFinance }).current;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const listsRef = useRef({});
  listsRef.current = { task: tasks, study, finance };
  const levelsRef = useRef(settings.levels);
  levelsRef.current = settings.levels;
  const recsRef = useRef(recurrences);
  recsRef.current = recurrences;

  // ---------- avisos ----------

  const schedule = useCallback(async (kind, item) => {
    const ids = await scheduleForItem(kind, item, levelsRef.current[kind]);
    if (ids.length) {
      setters[kind]((prev) => prev.map((x) => (x.id === item.id ? { ...x, notifIds: ids } : x)));
    }
  }, []);

  const rescheduleAll = useCallback(async () => {
    await cancelAll();
    for (const kind of ['task', 'study', 'finance']) {
      const updates = {};
      for (const item of listsRef.current[kind]) {
        updates[item.id] = await scheduleForItem(kind, item, levelsRef.current[kind]);
      }
      setters[kind]((prev) => prev.map((x) => ({ ...x, notifIds: updates[x.id] || [] })));
    }
    // 1.13: o cancelAll também apagou os avisos "Foi na aula?"
    scheduleAttendance(subjectsRef.current, settingsRef.current).catch(() => {});
  }, []);

  // refaz os avisos de uma área só (ex.: Finanças, ao ligar "Ocultar valores")
  const rescheduleKind = useCallback(async (kind) => {
    const updates = {};
    for (const item of listsRef.current[kind]) {
      await cancelIds(item.notifIds);
      updates[item.id] = await scheduleForItem(kind, item, levelsRef.current[kind]);
    }
    setters[kind]((prev) => prev.map((x) => (x.id in updates ? { ...x, notifIds: updates[x.id] } : x)));
  }, []);

  // ---------- criar, alterar, excluir ----------

  const makeRecurrence = (item) => ({
    id: uid(),
    title: item.title,
    amount: item.amount,
    type: item.type,
    category: item.category,
    account: item.account || null,
    from: item.from || null,
    to: item.to || null,
    day: Number(item.date.slice(8, 10)),
    generated: [ymOf(item.date)],
    createdAt: Date.now(),
  });

  const addItem = useCallback(async (kind, data) => {
    const item = { id: uid(), createdAt: Date.now(), notifIds: [], ...normalize(kind, data) };
    // lançamento por voz ou à mão sem conta: vai para a conta principal (compra no cartão, para o cartão)
    if (kind === 'finance' && data.account === undefined && item.type !== 'transfer' && !item.account) {
      item.account = defaultAccountFor(item, accountsRef.current, settingsRef.current.defaultAccount);
    }
    if (kind === 'finance' && data.repeat) {
      const rec = makeRecurrence(item);
      item.recId = rec.id;
      setRecurrences((prev) => [...prev, rec]);
    }
    setters[kind]((prev) => [item, ...prev]);
    setSettings((prev) => (prev.used && prev.used[kind] ? prev : { ...prev, used: { ...(prev.used || {}), [kind]: true } }));
    await schedule(kind, item);
    return item;
  }, []);

  const updateItem = useCallback(async (kind, id, changes) => {
    const old = listsRef.current[kind].find((x) => x.id === id);
    if (!old) return;
    await cancelIds(old.notifIds);
    const next = { ...old, ...changes, notifIds: [] };
    if (kind === 'finance') {
      if (changes.repeat && !old.recId) {
        const rec = makeRecurrence(next);
        next.recId = rec.id;
        setRecurrences((prev) => [...prev, rec]);
      } else if (old.recId && (changes.amount !== undefined || changes.title !== undefined)) {
        // mudar valor ou nome de uma conta fixa vale para os próximos meses
        setRecurrences((prev) =>
          prev.map((r) =>
            r.id === old.recId
              ? { ...r, amount: next.amount, title: next.title, category: next.category, type: next.type }
              : r
          )
        );
      }
      delete next.repeat;
    }
    setters[kind]((prev) => prev.map((x) => (x.id === id ? next : x)));
    await schedule(kind, next);
  }, []);

  const toggleDone = useCallback(async (kind, id) => {
    const old = listsRef.current[kind].find((x) => x.id === id);
    if (old) await updateItem(kind, id, { done: !old.done });
  }, []);

  // ---------- lembretes que se repetem: marcar uma ocorrência ----------
  // (não mexe nos avisos: eles continuam tocando nas próximas vezes)

  const setSlot = useCallback((kind, id, key, done) => {
    setters[kind]((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const set = new Set(x.doneSlots || []);
        if (done) set.add(key);
        else set.delete(key);
        return { ...x, doneSlots: [...set].sort().reverse().slice(0, 120) };
      })
    );
  }, []);

  // Marca a ocorrência pendente (ou a próxima). Devolve { label, undo } para o aviso de "Desfazer".
  const checkSlot = useCallback((kind, item) => {
    const slot = currentSlot(item, new Date());
    if (!slot) return null;
    const key = slotKey(slot.date, slot.time);
    setSlot(kind, item.id, key, true);
    return { label: slotLabel(slot, new Date()), undo: () => setSlot(kind, item.id, key, false) };
  }, []);

  // Apaga as concluídas de uma área. Devolve a função que desfaz.
  const clearDone = useCallback(async (kind) => {
    const removed = listsRef.current[kind].filter((x) => x.done && !x.repeat);
    if (!removed.length) return () => {};
    const ids = new Set(removed.map((x) => x.id));
    setters[kind]((prev) => prev.filter((x) => !ids.has(x.id)));
    return () => setters[kind]((prev) => [...prev, ...removed]);
  }, []);

  const togglePaid = useCallback(async (id) => {
    const old = listsRef.current.finance.find((x) => x.id === id);
    if (old) await updateItem('finance', id, { status: old.status === 'paid' ? 'pending' : 'paid' });
  }, []);

  // Exclui e devolve uma função que desfaz a exclusão
  const removeItem = useCallback(async (kind, id) => {
    const list = listsRef.current[kind];
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return () => {};
    const old = list[idx];
    setters[kind]((prev) => prev.filter((x) => x.id !== id));
    await cancelIds(old.notifIds);
    return async () => {
      const restored = { ...old, notifIds: [] };
      setters[kind]((prev) => {
        const arr = [...prev];
        arr.splice(Math.min(idx, arr.length), 0, restored);
        return arr;
      });
      await schedule(kind, restored);
    };
  }, []);

  const stopRecurrence = useCallback(async (recId) => {
    const today = todayISO();
    const future = listsRef.current.finance.filter(
      (x) => x.recId === recId && x.status === 'pending' && x.date > today
    );
    for (const x of future) await cancelIds(x.notifIds);
    const futureIds = new Set(future.map((x) => x.id));
    setRecurrences((prev) => prev.filter((r) => r.id !== recId));
    setFinance((prev) =>
      prev.filter((x) => !futureIds.has(x.id)).map((x) => (x.recId === recId ? { ...x, recId: null } : x))
    );
  }, []);

  // ---------- contas fixas: cria os lançamentos do mês atual e do próximo ----------

  useEffect(() => {
    if (!loaded || recurrences.length === 0) return;
    const horizon = addMonthsYm(ymOf(todayISO()), 1);
    const created = [];
    let changed = false;
    const updated = recurrences.map((r) => {
      const gen = [...(r.generated || [])].sort();
      let ym = addMonthsYm(gen[gen.length - 1], 1);
      const add = [];
      while (ym <= horizon) {
        created.push({
          id: uid(),
          createdAt: Date.now(),
          notifIds: [],
          title: r.title,
          amount: r.amount,
          type: r.type,
          category: r.category,
          account: r.account || null,
          from: r.from || null,
          to: r.to || null,
          date: dateInMonth(ym, r.day),
          status: 'pending',
          recId: r.id,
        });
        add.push(ym);
        ym = addMonthsYm(ym, 1);
      }
      if (!add.length) return r;
      changed = true;
      return { ...r, generated: [...gen, ...add] };
    });
    if (!changed) return;
    setRecurrences(updated);
    setFinance((prev) => [...created, ...prev]);
    created.forEach((item) => schedule('finance', item));
  }, [loaded, recurrences]);

  // ---------- migração de dados da versão 1.1 ----------

  useEffect(() => {
    if (!l3) return;
    if (finance.some((x) => !x.status)) {
      const today = todayISO();
      setFinance((prev) =>
        prev.map((x) =>
          x.status ? x : { ...x, status: x.date > today ? 'pending' : 'paid', notifIds: x.notifIds || [] }
        )
      );
    }
  }, [l3]);

  // ---------- 1.13: Finanças mais limpo ----------
  // Uma vez: limpa títulos e categorias do que já foi importado. Sempre: liga cada Pix devolvido
  // ao Pix que voltou (os dois saem de renda e gasto).
  useEffect(() => {
    if (!loaded) return;
    const first = !settingsRaw.fin113;
    const changes = first ? migrate113(finance) : refundChanges(finance);
    if (Object.keys(changes).length) setFinance((prev) => prev.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)));
    if (first) setSettings((prev) => ({ ...prev, fin113: true }));
  }, [loaded, finance]);

  // ---------- frases não entendidas ----------

  // 1.12.1: guarda também as versões que o Android ouviu, o áudio (só no celular) e, ao salvar, o que a pessoa corrigiu
  const addMisheard = useCallback((text, parsed, extra = {}) => {
    const id = uid();
    setMisheard((prev) => {
      const next = [{ id, text, parsed, at: Date.now(), ...extra }, ...prev];
      next.slice(200).forEach((m) => dropAudio(m.audio));
      return next.slice(0, 200);
    });
    return id;
  }, []);
  const updateMisheard = useCallback((id, changes) => {
    setMisheard((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
  }, []);
  const clearMisheard = useCallback(() => {
    setMisheard((prev) => {
      prev.forEach((m) => dropAudio(m.audio));
      return [];
    });
  }, []);
  // 1.12.3: os avisos de Finanças são refeitos para mostrar (ou esconder) o valor
  const setHideBalance = useCallback(async (v) => {
    setHideMoney(!!v);
    setSettings((prev) => ({ ...prev, hideBalance: !!v }));
    await rescheduleKind('finance');
  }, []);
  const setTestMode = useCallback((v) => setSettings((prev) => ({ ...prev, testMode: !!v })), []);
  const setVoiceOnDevice = useCallback((v) => setSettings((prev) => ({ ...prev, voiceOnDevice: !!v })), []);
  // dicionário pessoal da voz
  const learnVoice = useCallback((pairs) => {
    if (!pairs || !pairs.length) return;
    setSettings((prev) => ({ ...prev, voice: { ...(prev.voice || {}), learned: learn((prev.voice && prev.voice.learned) || {}, pairs) } }));
  }, []);
  const forgetVoicePair = useCallback((from) => {
    setSettings((prev) => {
      const learned = { ...((prev.voice && prev.voice.learned) || {}) };
      delete learned[from];
      return { ...prev, voice: { ...(prev.voice || {}), learned } };
    });
  }, []);
  const forgetVoice = useCallback(() => setSettings((prev) => ({ ...prev, voice: { ...(prev.voice || {}), learned: {} } })), []);

  // ---------- configurações ----------

  const updateProfile = useCallback((changes) => {
    setSettings((prev) => ({ ...prev, profile: { ...DEFAULT_SETTINGS.profile, ...(prev.profile || {}), ...changes } }));
  }, []);

  // troca o visual (Simples/Avançado, claro/escuro): grava já e reinicia o app,
  // porque as cores entram antes das telas carregarem
  const switchVisual = useCallback(async (changes) => {
    setSettings((prev) => ({ ...prev, ...changes }));
    try {
      const raw = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || '{}') || {};
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...raw, ...changes }));
    } catch (e) {
      // o efeito do useStoredState grava de qualquer jeito
    }
    const layout = changes.layout || look.mode;
    const theme = changes.theme || (look.dark ? 'dark' : 'light');
    if (layout !== look.mode || (theme === 'dark') !== look.dark) await restartApp();
  }, []);

  const setLevel = useCallback(async (area, level) => {
    const levels = { ...levelsRef.current, [area]: level };
    levelsRef.current = levels;
    setSettings((prev) => ({ ...prev, levels }));
    await rescheduleAll();
  }, []);

  const setAutoListen = useCallback((v) => setSettings((prev) => ({ ...prev, autoListen: !!v })), []);
  const setShortTitles = useCallback((v) => setSettings((prev) => ({ ...prev, shortTitles: !!v })), []);

  // estilo do alerta: troca o canal e reagenda o que já estava marcado
  const setAlertStyle = useCallback(async (style) => {
    setReminderStyle(style);
    setSettings((prev) => ({ ...prev, alertStyle: style }));
    await rescheduleAll();
  }, []);

  // antes de qualquer aviso, usa o estilo salvo
  setReminderStyle(settings.alertStyle);
  setHideMoney(!!settings.hideBalance);

  // atualizações: 1.2 usava um canal sem vibração; até a 1.3 os avisos não tinham
  // botões ("Feito", "Adiar"). Reagenda tudo uma vez para pegar as novidades.
  useEffect(() => {
    if (!loaded || settings.channelVersion >= 3) return;
    rescheduleAll().then(() => setSettings((prev) => ({ ...prev, channelVersion: 3 })));
  }, [loaded]);

  // um botão do aviso mudou os dados (com o app aberto ou em segundo plano)
  const reloadLists = useCallback(() => {
    reloadTasks();
    reloadStudy();
    reloadFinance();
    reloadSubjects(); // 1.13: "Faltei" no aviso
  }, []);
  useEffect(() => {
    const off = onExternalChange(reloadLists);
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (state) => {
      if (last !== 'active' && state === 'active') reloadLists();
      last = state;
    });
    return () => {
      off();
      sub.remove();
    };
  }, []);

  // 1.12: o microfone já abre ouvindo, inclusive para quem instalou antes (dá para desligar em Ajustes → Voz)
  useEffect(() => {
    if (loaded && !settingsRaw.autoListenSet) setSettings((prev) => ({ ...prev, autoListen: true, autoListenSet: true }));
  }, [loaded]);

  // ---------- matérias (1.12) ----------

  const addSubject = useCallback((data) => {
    const subject = { id: uid(), createdAt: Date.now(), archived: false, ...data };
    setSubjects((prev) => [...prev, subject]);
    return subject;
  }, []);

  const updateSubject = useCallback((id, changes) => {
    setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } : x)));
  }, []);

  // Excluir não apaga provas nem entregas: elas ficam sem matéria. Devolve o Desfazer.
  const removeSubject = useCallback((id) => {
    const all = subjectsRef.current;
    const idx = all.findIndex((x) => x.id === id);
    if (idx < 0) return () => {};
    const old = all[idx];
    const linked = listsRef.current.study.filter((t) => t.subjectId === id).map((t) => t.id);
    setSubjects((prev) => prev.filter((x) => x.id !== id));
    setStudy((prev) => prev.map((t) => (t.subjectId === id ? { ...t, subjectId: null } : t)));
    return () => {
      setSubjects((prev) => {
        const arr = [...prev];
        arr.splice(Math.min(idx, arr.length), 0, old);
        return arr;
      });
      const back = new Set(linked);
      setStudy((prev) => prev.map((t) => (back.has(t.id) ? { ...t, subjectId: id } : t)));
    };
  }, []);

  // Arquivar: sai da lista ativa, mas nada é apagado. Devolve o Desfazer.
  const archiveSubjects = useCallback((ids) => {
    const set = new Set(ids);
    const before = subjectsRef.current.filter((x) => set.has(x.id));
    const at = Date.now();
    const semester = settingsRef.current.semester;
    setSubjects((prev) => prev.map((x) => (set.has(x.id) ? { ...x, archived: true, archivedAt: at, semester: semester.start ? semester : x.semester || null } : x)));
    return () => {
      const old = new Map(before.map((x) => [x.id, x]));
      setSubjects((prev) => prev.map((x) => old.get(x.id) || x));
    };
  }, []);

  const setSemester = useCallback((semester) => {
    setSettings((prev) => ({ ...prev, semester: { ...DEFAULT_SETTINGS.semester, ...semester } }));
  }, []);

  // Liga itens antigos a uma matéria. Devolve o Desfazer.
  // ---------- notas e faltas (1.13) ----------
  const setAcademic = useCallback((changes) => {
    setSettings((prev) => ({ ...prev, academic: { ...DEFAULT_ACADEMIC, ...(prev.academic || {}), ...changes } }));
  }, []);
  const patchSubject = (id, fn) => setSubjects((prev) => prev.map((x) => (x.id === id ? fn(x) : x)));
  // nota nova; se a matéria já tem a avaliação com esse nome e sem nota (ex.: "P2", com peso), preenche ela
  const addGrade = useCallback((subjectId, g) => {
    const subject = subjectsRef.current.find((x) => x.id === subjectId);
    if (!subject) return () => {};
    const before = subject.grades || [];
    const same = before.find((x) => (x.score === null || x.score === undefined) && String(x.name || '').trim().toLowerCase() === String(g.name || '').trim().toLowerCase());
    const grade = same ? { ...same, ...g, id: same.id, weight: g.weight || same.weight || null } : { id: uid(), createdAt: Date.now(), max: null, weight: null, date: todayISO(), ...g };
    patchSubject(subjectId, (x) => ({ ...x, grades: same ? (x.grades || []).map((y) => (y.id === same.id ? grade : y)) : [...(x.grades || []), grade] }));
    return () => patchSubject(subjectId, (x) => ({ ...x, grades: before }));
  }, []);
  const updateGrade = useCallback((subjectId, id, changes) => {
    patchSubject(subjectId, (x) => ({ ...x, grades: (x.grades || []).map((y) => (y.id === id ? { ...y, ...changes } : y)) }));
  }, []);
  const removeGrade = useCallback((subjectId, id) => {
    const subject = subjectsRef.current.find((x) => x.id === subjectId);
    const before = (subject && subject.grades) || [];
    patchSubject(subjectId, (x) => ({ ...x, grades: (x.grades || []).filter((y) => y.id !== id) }));
    return () => patchSubject(subjectId, (x) => ({ ...x, grades: before }));
  }, []);
  const setFormula = useCallback((subjectId, formula) => patchSubject(subjectId, (x) => ({ ...x, formula })), []);
  // falta: devolve { undo, note } (note = aviso de limite, se estiver perto ou passou)
  const addAbsence = useCallback((subjectId, { date, count }) => {
    const subject = subjectsRef.current.find((x) => x.id === subjectId);
    if (!subject) return { undo: () => {}, note: null };
    const absence = { id: uid(), date: date || todayISO(), count: Math.max(1, Number(count) || 1) };
    patchSubject(subjectId, (x) => ({ ...x, absences: [...(x.absences || []), absence] }));
    const st = settingsRef.current;
    const sum = absenceSummary({ ...subject, absences: [...(subject.absences || []), absence] }, st.academic, st.semester, st.profile.state);
    const note = sum.status === 'near' || sum.status === 'over' ? `${subject.name}: ${absenceStatusText(sum).toLowerCase()}` : null;
    return { undo: () => patchSubject(subjectId, (x) => ({ ...x, absences: (x.absences || []).filter((y) => y.id !== absence.id) })), note };
  }, []);
  const removeAbsence = useCallback((subjectId, id) => {
    const subject = subjectsRef.current.find((x) => x.id === subjectId);
    const before = (subject && subject.absences) || [];
    patchSubject(subjectId, (x) => ({ ...x, absences: (x.absences || []).filter((y) => y.id !== id) }));
    return () => patchSubject(subjectId, (x) => ({ ...x, absences: before }));
  }, []);
  // "Já saiu a nota?" respondido (ou "Agora não"): não pergunta de novo por aquela prova
  const markGradeAsked = useCallback((studyId) => setStudy((prev) => prev.map((t) => (t.id === studyId ? { ...t, gradeAsked: true } : t))), []);

  // aviso "Foi na aula?" (opcional): agenda as próximas 2 semanas a cada abertura e a cada mudança
  const attendKey = JSON.stringify([settings.academic, settings.semester, settings.profile.state, subjects.map((x) => [x.id, x.archived, x.name, x.schedules])]);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(() => {
      scheduleAttendance(subjectsRef.current, settingsRef.current).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded, attendKey]);

  const linkItems = useCallback((subjectId, itemIds) => {
    const set = new Set(itemIds);
    setStudy((prev) => prev.map((t) => (set.has(t.id) ? { ...t, subjectId } : t)));
    return () => setStudy((prev) => prev.map((t) => (set.has(t.id) ? { ...t, subjectId: null } : t)));
  }, []);

  // ---------- primeira abertura ----------
  const hasData = tasks.length > 0 || study.length > 0 || finance.length > 0;
  const needsOnboarding =
    loaded && !settings.onboarded && !hasData && !settings.profile.name && !Object.values(settings.used).some(Boolean);
  const finishOnboarding = useCallback(({ name, layout, theme, about }) => {
    const changes = {
      onboarded: true,
      layout: layout || 'advanced',
      theme: theme || 'light',
    };
    setSettings((prev) => ({
      ...prev,
      ...changes,
      profile: { ...DEFAULT_SETTINGS.profile, ...(prev.profile || {}), ...(about || {}), name: (name || '').trim() },
    }));
    // visual diferente do que está na tela: reinicia para aplicar (depois de gravar o nome)
    if (changes.layout !== look.mode || (changes.theme === 'dark') !== look.dark) {
      setTimeout(async () => {
        try {
          const raw = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || '{}') || {};
          await AsyncStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({ ...raw, ...changes, profile: { ...DEFAULT_SETTINGS.profile, ...(raw.profile || {}), ...(about || {}), name: (name || '').trim() } })
          );
        } catch (e) {
          // segue
        }
        restartApp();
      }, 300);
    }
  }, []);
  // quem já usava o app não vê a primeira abertura
  useEffect(() => {
    if (loaded && !settings.onboarded && !needsOnboarding) setSettings((prev) => ({ ...prev, onboarded: true }));
  }, [loaded]);
  const setLayout = useCallback((v) => switchVisual({ layout: v }), []);
  const setTheme = useCallback((v) => switchVisual({ theme: v }), []);
  // ---------- contas ----------

  const addAccount = useCallback((data) => {
    const acc = {
      id: uid(),
      name: (data.name || 'Conta').trim(),
      kind: data.kind || 'corrente',
      number: data.number || null,
      bank: data.bank || null,
      anchor: data.anchor || null,
      createdAt: Date.now(),
    };
    setAccounts((prev) => [...prev, acc]);
    // a primeira conta corrente vira a principal
    setSettings((prev) =>
      prev.defaultAccount || acc.kind !== 'corrente' ? prev : { ...prev, defaultAccount: acc.id }
    );
    return acc;
  }, []);

  const updateAccount = useCallback((id, changes) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }, []);

  // saldo de hoje digitado pela pessoa (ou o do extrato, com a data dele)
  const setAccountBalance = useCallback((id, balance, date = todayISO(), importId = null) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, anchor: { balance, date, at: Date.now(), importId } } : a)));
  }, []);

  // excluir a conta não apaga lançamentos: eles ficam "sem conta"
  const removeAccount = useCallback((id) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setFinance((prev) =>
      prev.map((t) =>
        t.account === id || t.from === id || t.to === id
          ? { ...t, account: t.account === id ? null : t.account, from: t.from === id ? null : t.from, to: t.to === id ? null : t.to }
          : t
      )
    );
    setSettings((prev) => (prev.defaultAccount === id ? { ...prev, defaultAccount: null } : prev));
  }, []);

  const setDefaultAccount = useCallback((id) => setSettings((prev) => ({ ...prev, defaultAccount: id })), []);

  // Junta contas: os lançamentos das de origem vão para a de destino (ou ficam sem conta) e as de
  // origem somem. `moves` vem de planMerge; `dropIds` são repetidos que a pessoa escolheu apagar.
  // Devolve a função de Desfazer, que põe tudo de volta como estava.
  const mergeAccounts = useCallback((sourceIds, targetId, moves, dropIds = []) => {
    const src = new Set(sourceIds);
    const drop = new Set(dropIds);
    const oldAccounts = accountsRef.current;
    const oldFinance = listsRef.current.finance;
    const oldDefault = settingsRef.current.defaultAccount;
    const before = {};
    for (const t of oldFinance) if (moves[t.id] || drop.has(t.id)) before[t.id] = t;
    setFinance((prev) => prev.filter((t) => !drop.has(t.id)).map((t) => (moves[t.id] ? { ...t, ...moves[t.id] } : t)));
    setAccounts((prev) => prev.filter((a) => !src.has(a.id)));
    if (src.has(oldDefault)) setSettings((prev) => ({ ...prev, defaultAccount: targetId || null }));
    return () => {
      setAccounts((prev) => {
        const now = new Map(prev.map((a) => [a.id, a]));
        const back = oldAccounts.filter((a) => now.has(a.id) || src.has(a.id)).map((a) => now.get(a.id) || a);
        return [...back, ...prev.filter((a) => !oldAccounts.some((o) => o.id === a.id))];
      });
      setFinance((prev) => {
        const kept = prev.map((t) => (before[t.id] ? before[t.id] : t));
        const missing = Object.values(before).filter((t) => !prev.some((x) => x.id === t.id));
        return [...kept, ...missing];
      });
      if (src.has(oldDefault)) setSettings((prev) => ({ ...prev, defaultAccount: oldDefault }));
    };
  }, []);

  // várias mudanças de uma vez (importação): sem reagendar avisos de quem não muda de status
  const patchFinance = useCallback((changesById) => {
    setFinance((prev) => prev.map((t) => (changesById[t.id] ? { ...t, ...changesById[t.id] } : t)));
  }, []);

  const setBudget = useCallback(
    (changes) => setSettings((prev) => ({ ...prev, budget: { ...DEFAULT_SETTINGS.budget, ...(prev.budget || {}), ...changes } })),
    []
  );
  const setBackupInfo = useCallback(
    (changes) => setSettings((prev) => ({ ...prev, backup: { ...(prev.backup || {}), ...changes } })),
    []
  );
  const markCapture = useCallback(() => setSettings((prev) => ({ ...prev, captures: (prev.captures || 0) + 1 })), []);
  const markEditHint = useCallback(
    () => setSettings((prev) => (prev.editHintSeen ? prev : { ...prev, editHintSeen: true })),
    []
  );
  const markSwipeHint = useCallback(
    () => setSettings((prev) => (prev.swipeHintSeen ? prev : { ...prev, swipeHintSeen: true })),
    []
  );

  // quem já usava o app antes desta versão: marca as áreas que já têm itens
  useEffect(() => {
    if (!loaded) return;
    const has = { task: tasks.length > 0, study: study.length > 0, finance: finance.length > 0 };
    if (AREAS.some((a) => has[a] && !settings.used[a])) {
      setSettings((prev) => {
        const used = { ...(prev.used || {}) };
        AREAS.forEach((a) => {
          if (has[a]) used[a] = true;
        });
        return { ...prev, used };
      });
    }
  }, [loaded]);

  // ---------- derivados ----------

  // o visual que está na tela (aplicado ao abrir o app); muda só depois de reiniciar
  const simple = look.mode === 'simple';
  const palettes = AREA_PAL;
  // cores de alerta e de entrada de dinheiro
  const tone = useMemo(() => ({ warn: colors.warn, income: colors.income }), []);

  const areaOrder = useMemo(
    () =>
      AREAS.map((a, i) => ({ a, i }))
        .sort((x, y) => LEVEL_RANK[settings.levels[x.a]] - LEVEL_RANK[settings.levels[y.a]] || x.i - y.i)
        .map((x) => x.a),
    [settings.levels]
  );

  const value = useMemo(
    () => ({
      loaded,
      tasks,
      study,
      finance,
      subjects,
      addSubject,
      updateSubject,
      removeSubject,
      archiveSubjects,
      setSemester,
      linkItems,
      setAcademic,
      addGrade,
      updateGrade,
      removeGrade,
      setFormula,
      addAbsence,
      removeAbsence,
      markGradeAsked,
      recurrences,
      misheard,
      settings,
      palettes,
      tone,
      simple,
      areaOrder,
      addItem,
      updateItem,
      toggleDone,
      togglePaid,
      removeItem,
      stopRecurrence,
      addMisheard,
      updateMisheard,
      clearMisheard,
      setHideBalance,
      setVoiceOnDevice,
      setTestMode,
      learnVoice,
      forgetVoicePair,
      forgetVoice,
      updateProfile,
      setTheme,
      switchVisual,
      setLevel,
      setAutoListen,
      setShortTitles,
      setAlertStyle,
      setLayout,
      markCapture,
      markEditHint,
      markSwipeHint,
      checkSlot,
      setSlot,
      clearDone,
      needsOnboarding,
      finishOnboarding,
      setBudget,
      setBackupInfo,
      accounts,
      addAccount,
      updateAccount,
      setAccountBalance,
      removeAccount,
      setDefaultAccount,
      mergeAccounts,
      patchFinance,
    }),
    [loaded, tasks, study, finance, subjects, recurrences, misheard, settings, palettes, tone, simple, areaOrder, needsOnboarding, accounts]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
