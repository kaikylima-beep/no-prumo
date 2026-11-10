import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, ScrollView, Pressable, KeyboardAvoidingView, Alert, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look, AREA_LABEL, subjectColor } from './theme';
import { useData } from './store';
import { useUI } from './uiContext';
import { useSpeech } from './speech';
import { parseInput, parseSegment, addDays, splitSegments } from './parser';
import { parseAcademic, isAcademicStart, parseGrade, fmtGrade } from './academic';
import { todayISO, formatBR, shortBR } from './utils';
import { enrichParsed, findSubject, occupationName, placeQuestion } from './subjects';
import { toEditable, readEditable, summarize } from './itemForm';
import ItemFields from './components/ItemFields';
import { cashAvailable, fromOtherAccounts } from './insights';
import { monthBudget, spendingAlert } from './budget';
import { Button, Field, Toggle, MicButton, Remove, Chip, Dot } from './ui';
import Waveform from './components/Waveform';
import { buildVocab, applyLearned, pickBest, otherVersions, diffWords, replaceOnce } from './voice';

let FS = null;
try {
  FS = require('expo-file-system');
} catch (e) {
  FS = null;
}

// exemplos de frase por área: aparecem sempre (1.12.1), um de cada área
const TIPS = [
  '“Lavar o carro hoje às 10 da noite”',
  '“Pix de 60 para o João”',
  '“Prova de cálculo sexta às 8h”',
];

// copia o áudio da frase para a pasta do app (o original fica no cache e some)
function keepAudio(uri) {
  if (!uri || !FS || !FS.File || !FS.Paths) return null;
  try {
    const dest = new FS.File(FS.Paths.document, `frase-${Date.now()}.wav`);
    new FS.File(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    return null;
  }
}

// 1.13: nota ou falta dita pela voz, pronta para conferir
let acadCounter = 0;
const ACAD = new Set(['grade', 'absence']);
function acadEditable(p) {
  acadCounter += 1;
  return {
    key: `acad${Date.now()}${acadCounter}`,
    kind: p.kind,
    raw: p.raw,
    subjectId: p.subjectId || null,
    title: p.title,
    origTitle: p.title,
    scoreText: p.kind === 'grade' ? fmtGrade(p.score) : '',
    maxText: p.max ? fmtGrade(p.max) : '',
    date: p.date,
    countText: p.kind === 'absence' ? String(p.count || 1) : '',
  };
}
function acadSummary(it, subjects) {
  // a matéria aparece logo embaixo, com a cor dela; aqui só quando falta escolher
  const s = subjects.find((x) => x.id === it.subjectId);
  const where = s ? '' : ' · escolha a matéria';
  if (it.kind === 'grade') return `Nota ${it.scoreText || '—'}${it.maxText ? ` de ${it.maxText}` : ''}${where}`;
  const n = Number(it.countText) || 1;
  return `${n} ${n === 1 ? 'aula' : 'aulas'} · ${shortBR(it.date)}${where}`;
}

const KINDS = [
  { key: 'task', label: 'Tarefa' },
  { key: 'finance', label: 'Finança' },
  { key: 'study', label: 'Estudo' },
];

export default function CaptureModal({ visible, onClose, accent }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>{visible ? <Content onClose={onClose} accent={accent} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function Content({ onClose, accent = colors.ink }) {
  const insets = useSafeAreaInsets();
  const {
    addItem, addMisheard, updateMisheard, palettes, settings, markCapture, finance, accounts, subjects, tasks, study,
    learnVoice, forgetVoicePair, addGrade, addAbsence,
  } = useData();
  const { showToast } = useUI();
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null); // item expandido para edição
  const [notUnderstood, setNotUnderstood] = useState(false);
  // o que o Android ouviu: 1ª versão, todas as versões (já com o dicionário pessoal), trocas feitas e sugeridas, áudio
  const [heard, setHeard] = useState(null);
  const [fixing, setFixing] = useState(null); // texto sendo corrigido em "Ouvi isso"
  const [savedPhrase, setSavedPhrase] = useState(null); // id da frase guardada para correção
  const [corrected, setCorrected] = useState(false); // a pessoa corrigiu algo nesta captura (modo de teste guarda sozinho)
  const learned = (settings.voice && settings.voice.learned) || {};

  // vocabulário passado ao reconhecedor: palavras do app, matérias, contas, trocas aprendidas e títulos da pessoa
  const vocabRef = useRef(null);
  if (!vocabRef.current) {
    const titles = [...(tasks || []), ...(study || []), ...(finance || [])].slice(-300).map((i) => i.title);
    vocabRef.current = buildVocab({ subjects, accounts, learned, titles });
  }

  const analyze = (t) => {
    // 1.13: "tirei 7,5 na P1 de cálculo" e "faltei na aula de física" saem antes do interpretador geral
    let rest = t;
    const acad = [];
    const segs = splitSegments(t);
    if (segs.some(isAcademicStart)) {
      const others = [];
      for (const sg of segs) {
        const r = isAcademicStart(sg) ? parseAcademic(sg, subjects, todayISO(), settings.academic) : [];
        if (r.length) acad.push(...r);
        else others.push(sg);
      }
      rest = others.join(', ');
    }
    const parsed = rest.trim() ? parseInput(rest, todayISO(), new Date(), { short: settings.shortTitles }) : [];
    if (parsed.length === 0 && acad.length === 0) {
      setNotUnderstood(true);
      setItems(null);
      return;
    }
    setNotUnderstood(false);
    setItems([...acad.map(acadEditable), ...enrichParsed(parsed, subjects, settings.profile).map((p) => toEditable(p.kind, p))]);
    setOpen(null);
  };
  const describe = (i) => (ACAD.has(i.kind) ? acadSummary(i, subjects) : summarize(i));

  // terminou de ouvir: aplica o dicionário pessoal em cada versão e fica com a que o app entende melhor
  const onHeard = (alts, audio) => {
    const fixed = alts.map((a) => applyLearned(a, learned));
    const best = pickBest(fixed.map((f) => f.text), todayISO(), new Date(), vocabRef.current);
    const chosen = fixed[best.index] || fixed[0];
    setHeard({
      original: alts[0],
      raw: alts[best.index] || alts[0],
      alts: fixed.map((f) => f.text),
      applied: chosen.applied,
      suggestions: chosen.suggestions,
      audio,
    });
    setFixing(null);
    setSavedPhrase(null);
    setCorrected(false);
    setText(chosen.text);
    analyze(chosen.text);
  };

  const levelRef = useRef(null);
  const speech = useSpeech({
    onText: setText,
    onDone: onHeard,
    onVolume: (value) => {
      levelRef.current = { value, at: Date.now() };
    },
    vocab: () => vocabRef.current,
    onDevice: settings.voiceOnDevice !== false,
  });

  // a pessoa corrigiu o texto: o app aprende as trocas (só quando o texto veio da voz)
  const reunderstand = (next) => {
    const t = (next || '').trim();
    if (!t) return;
    if (heard) learnVoice(diffWords(text, t));
    if (t !== text) setCorrected(true);
    setHeard((h) => (h ? { ...h, applied: [], suggestions: [] } : h));
    setFixing(null);
    setText(t);
    analyze(t);
  };

  const acceptSuggestion = (sg) => {
    const t = replaceOnce(text, sg.from, sg.to);
    learnVoice([{ from: sg.from, to: sg.to }]);
    setCorrected(true);
    setHeard((h) => ({ ...h, suggestions: h.suggestions.filter((x) => x !== sg) }));
    setText(t);
    analyze(t);
  };

  // "Desfazer" de uma troca automática: volta ao que o Android ouviu e esquece a troca
  const undoApplied = () => {
    (heard.applied || []).forEach((a) => forgetVoicePair(a.from));
    setHeard((h) => ({ ...h, applied: [], suggestions: [] }));
    setText(heard.raw);
    analyze(heard.raw);
  };

  const pickVersion = (alt) => {
    learnVoice(diffWords(text, alt));
    setCorrected(true);
    setText(alt);
    analyze(alt);
  };

  const setDay = (it, iso) => patch(it.key, { dateText: formatBR(iso), askDay: false });

  useEffect(() => {
    if (settings.autoListen) speech.start();
  }, []);

  const close = () => {
    speech.stop();
    onClose();
  };

  const patch = (key, changes) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));

  const subjectOf = (it) => ((it.kind === 'study' || ACAD.has(it.kind)) && it.subjectId ? subjects.find((x) => x.id === it.subjectId) : null);

  const removeItem = (key) => {
    setCorrected(true);
    const next = items.filter((it) => it.key !== key);
    setItems(next.length ? next : null);
  };

  const changeKind = (it, kind) => {
    if (kind === it.kind) return;
    setCorrected(true);
    const p = parseSegment(it.raw || it.title, todayISO(), kind, new Date(), { short: settings.shortTitles });
    const hit = kind === 'study' ? findSubject(it.raw || it.title, subjects) : null;
    const fresh = p.empty ? { ...it, kind, askPlace: false } : toEditable(kind, { ...p, kind, subjectId: hit ? hit.subject.id : null });
    setItems((prev) => prev.map((x) => (x.key === it.key ? { ...fresh, key: it.key, raw: it.raw } : x)));
  };

  // aviso na própria tela: o Toast fica atrás deste Modal
  const saveMisheard = () => {
    if (savedPhrase) return;
    const id = addMisheard(text, items ? items.map((i) => `${AREA_LABEL[i.kind]}: ${i.title} (${describe(i)})`) : [], {
      heard: heard ? heard.original : null,
      alts: heard ? heard.alts : [],
      audio: heard ? keepAudio(heard.audio) : null,
    });
    setSavedPhrase(id);
  };

  const workName = occupationName(settings.profile);

  const save = async () => {
    const ready = [];
    for (const it of items) {
      if (ACAD.has(it.kind)) {
        // 1.13: nota ou falta
        if (!it.subjectId) {
          setOpen(it.key);
          Alert.alert('Confira os campos', `Escolha a matéria ${it.kind === 'grade' ? 'da nota' : 'da falta'}.`);
          return;
        }
        if (it.kind === 'grade') {
          const score = parseGrade(it.scoreText);
          const max = it.maxText ? parseGrade(it.maxText) : null;
          if (score === null || (it.maxText && !max)) {
            setOpen(it.key);
            Alert.alert('Confira os campos', 'Nota inválida. Ex.: 7,5');
            return;
          }
          ready.push({ kind: 'grade', subjectId: it.subjectId, data: { name: (it.title || 'Avaliação').trim(), score, max, date: it.date } });
        } else {
          const count = Number(it.countText);
          if (!Number.isInteger(count) || count < 1) {
            setOpen(it.key);
            Alert.alert('Confira os campos', 'Número de aulas inválido.');
            return;
          }
          ready.push({ kind: 'absence', subjectId: it.subjectId, data: { date: it.date, count } });
        }
        continue;
      }
      const r = readEditable(it);
      if (r.error) {
        setOpen(it.key);
        Alert.alert('Confira os campos', r.error);
        return;
      }
      ready.push({ kind: it.kind, data: r.data });
    }
    const notes = [];
    for (const r of ready) {
      if (r.kind === 'grade') addGrade(r.subjectId, r.data);
      else if (r.kind === 'absence') {
        const res = addAbsence(r.subjectId, r.data);
        if (res.note) notes.push(res.note);
      } else await addItem(r.kind, r.data);
    }
    markCapture();
    // títulos corrigidos à mão também ensinam o app ("Pique do João" -> "Pix do João")
    const titlePairs = items.flatMap((it) => (!ACAD.has(it.kind) && it.origTitle && it.title && it.origTitle !== it.title ? diffWords(it.origTitle, it.title) : []));
    if (titlePairs.length) learnVoice(titlePairs);
    const fixedList = items.map((i) => `${AREA_LABEL[i.kind]}: ${i.title} (${describe(i)})`);
    if (savedPhrase) updateMisheard(savedPhrase, { fixed: fixedList });
    else if (settings.testMode && (corrected || titlePairs.length)) {
      // modo de teste: frase que a pessoa precisou corrigir fica guardada sozinha
      addMisheard(text, [], { heard: heard ? heard.original : null, alts: heard ? heard.alts : [], audio: heard ? keepAudio(heard.audio) : null, fixed: fixedList });
    }
    close();
    // aviso de gasto: confere o orçamento do mês com os gastos que acabaram de entrar
    const newOuts = ready.filter((r) => r.kind === 'finance' && r.data.type === 'out').map((r) => r.data);
    const ym = todayISO().slice(0, 7);
    // o dinheiro de verdade, já tirando os gastos que acabaram de entrar (ainda não estão em `finance`)
    const capAfter = (outs, m) => {
      const c = cashAvailable(finance, accounts || [], settings.budget, m, todayISO());
      return c ? c.value - outs.filter((o) => o.date.startsWith(m) && o.status !== 'pending').reduce((a, o) => a + o.amount, 0) : null;
    };
    const alert = newOuts.some((d) => d.date.startsWith(ym))
      ? spendingAlert(monthBudget([...finance, ...newOuts], settings.budget, ym, new Date(), capAfter(newOuts, ym), fromOtherAccounts(finance, accounts || [], ym)), settings.levels.finance)
      : null;
    const saved = ready.length === 1 ? '1 item salvo' : `${ready.length} itens salvos`;
    if (notes.length) showToast(`${saved}. ${notes.join('. ')}.`, 'OK', () => {});
    else if (alert) showToast(`${saved}. ${alert}`, 'OK', () => {});
    else showToast(saved);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={[st.top, { paddingTop: insets.top + 12 }]}>
        <Text style={st.topTitle}>{items ? 'Confirme' : 'Novo'}</Text>
        <Pressable onPress={close} hitSlop={12}>
          <Text style={st.close}>Fechar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {!items ? (
          <View>
            <Text style={st.prompt}>Fale ou escreva.</Text>
            <Text style={st.examples}>
              {(settings.captures || 0) < 3
                ? '“Conta de luz 180, água 95 e aluguel 1800 todo dia 5”\n“Prova de circuitos dia 27, me lembrar 4 dias antes”\n“Tomar remédio todo dia às 8h e às 20h”'
                : `Tente assim: ${TIPS[(settings.captures || 0) % TIPS.length]}`}
            </Text>

            <View style={st.micWrap}>
              <View style={st.waveBox}>
                {speech.listening ? (
                  <Waveform active color={accent} levelRef={levelRef} />
                ) : text ? null : (
                  <Text style={st.waveIdle}>Fale como se fosse uma mensagem de áudio</Text>
                )}
              </View>
              {speech.listening ? (
                <Pressable
                  onPress={speech.stop}
                  style={[st.mic, { borderColor: accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="Parar de ouvir"
                >
                  <View style={[st.stopSquare, { backgroundColor: accent }]} />
                </Pressable>
              ) : (
                <MicButton size={88} onPress={speech.start} />
              )}
              <Text style={st.micLabel}>{speech.listening ? 'Ouvindo… toque para parar' : 'Toque para falar'}</Text>
              {speech.listening && text ? (
                <Text style={st.live} numberOfLines={3}>
                  {text}
                </Text>
              ) : null}
              {speech.error ? <Text style={st.error}>{speech.error}</Text> : null}
            </View>

            <Field
              placeholder="ou escreva aqui"
              value={text}
              onChangeText={setText}
              onFocus={() => speech.listening && speech.abort()}
              multiline
              style={{ marginTop: 8 }}
            />
            {notUnderstood ? (
              <Text style={st.error}>
                Não entendi. Tente dizer o que fazer e quando, por exemplo: {TIPS[0]} ou {TIPS[2]}.
              </Text>
            ) : null}
            <Button title="Entender" color={accent} onPress={() => { setHeard(null); analyze(text); }} disabled={!text.trim()} />
          </View>
        ) : (
          <View>
            <View style={st.heardBox}>
              <View style={st.heardHead}>
                <Text style={st.heardLabel}>{heard ? 'Ouvi isso:' : 'Você escreveu:'}</Text>
                {fixing === null ? (
                  <Pressable onPress={() => setFixing(text)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Corrigir o que o app ouviu">
                    <Text style={[st.fixLink, { color: accent }]}>Corrigir</Text>
                  </Pressable>
                ) : null}
              </View>
              {fixing === null ? (
                <Pressable onPress={() => setFixing(text)} accessibilityRole="button" accessibilityLabel="Corrigir o que o app ouviu">
                  <Text style={st.heard}>“{text}”</Text>
                  {heard ? <Text style={st.fixHint}>Alguma palavra errada? Toque no texto para corrigir. O app aprende com você.</Text> : null}
                </Pressable>
              ) : (
                <View>
                  <Field value={fixing} onChangeText={setFixing} multiline autoFocus style={{ marginTop: 4 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Button title="Entender de novo" color={accent} onPress={() => reunderstand(fixing)} disabled={!fixing.trim()} />
                    </View>
                    <Pressable onPress={() => setFixing(null)} hitSlop={10} style={{ marginLeft: 16 }}>
                      <Text style={st.fixCancel}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {fixing === null && heard && heard.applied && heard.applied.length ? (
                <View style={st.noteRow}>
                  <Text style={st.note}>
                    Troquei {heard.applied.map((a) => `“${a.from}” por “${a.to}”`).join(', ')}, como você já corrigiu antes.{' '}
                  </Text>
                  <Pressable onPress={undoApplied} hitSlop={8} accessibilityRole="button">
                    <Text style={[st.noteLink, { color: accent }]}>Desfazer</Text>
                  </Pressable>
                </View>
              ) : null}
              {fixing === null && heard && heard.suggestions && heard.suggestions.length ? (
                <View style={st.chips}>
                  {heard.suggestions.map((sg) => (
                    <Chip key={sg.from} label={`Trocar “${sg.from}” por “${sg.to}”`} color={accent} onPress={() => acceptSuggestion(sg)} />
                  ))}
                </View>
              ) : null}
              {fixing === null && heard && otherVersions(heard.alts, text).length ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={st.heardLabel}>Ou foi:</Text>
                  {otherVersions(heard.alts, text).map((alt) => (
                    <Pressable key={alt} onPress={() => pickVersion(alt)} style={st.altRow} accessibilityRole="button" accessibilityLabel={`Usar: ${alt}`}>
                      <Text style={st.altText}>“{alt}”</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={st.count}>
              {items.length === 1 ? 'Entendi 1 coisa. Está certo?' : `Entendi ${items.length} coisas. Está certo?`}
            </Text>
            {items.map((it) => {
              const pal = palettes[it.kind] || palettes.study;
              const expanded = open === it.key;
              const acad = ACAD.has(it.kind);
              return (
                <View key={it.key} style={[st.card, { borderLeftColor: pal.main }, expanded && st.cardOpen]}>
                  <Pressable style={st.summary} onPress={() => setOpen(expanded ? null : it.key)}>
                    <View style={{ flex: 1 }}>
                      <View style={[st.tag, { backgroundColor: pal.tint }]}>
                        <View style={[st.tagDot, { backgroundColor: pal.main }]} />
                        <Text style={[st.tagText, { color: pal.main }]}>{AREA_LABEL[it.kind]}</Text>
                      </View>
                      <Text style={st.sumTitle}>{it.title || 'Sem nome'}</Text>
                      <Text style={st.sumMeta}>{describe(it)}</Text>
                      {subjectOf(it) ? (
                        <View style={st.subjectRow}>
                          <Dot color={subjectColor(subjectOf(it).color).main} size={8} style={{ marginRight: 6 }} />
                          <Text style={[st.subjectName, { color: subjectColor(subjectOf(it).color).main }]}>{subjectOf(it).name}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={st.editHint}>{expanded ? 'Fechar' : 'Editar'}</Text>
                    <Remove onPress={() => removeItem(it.key)} />
                  </Pressable>
                  {it.askDay ? (
                    <View style={st.place}>
                      <Text style={st.placeText}>Esse horário já passou hoje. Para quando?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <Chip label="Hoje" color={pal.main} onPress={() => setDay(it, todayISO())} />
                        <Chip label="Amanhã" color={pal.main} onPress={() => setDay(it, addDays(todayISO(), 1))} />
                      </View>
                    </View>
                  ) : null}
                  {it.askPlace && it.kind === 'study' && workName ? (
                    <View style={st.place}>
                      <Text style={st.placeText}>{placeQuestion(workName)}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <Chip label="Faculdade" color={pal.main} onPress={() => patch(it.key, { askPlace: false })} />
                        <Chip label={workName.charAt(0).toUpperCase() + workName.slice(1)} color={pal.main} onPress={() => changeKind(it, 'task')} />
                      </View>
                    </View>
                  ) : null}
                  {expanded && acad ? (
                    <View style={st.fields}>
                      <Text style={st.placeText}>Matéria</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {subjects.filter((x) => !x.archived).map((x) => (
                          <Chip key={x.id} label={x.name} color={subjectColor(x.color).main} active={it.subjectId === x.id} onPress={() => { setCorrected(true); patch(it.key, { subjectId: x.id }); }} />
                        ))}
                      </View>
                      {!subjects.some((x) => !x.archived) ? <Text style={st.sumMeta}>Cadastre as matérias em Estudos → Matérias.</Text> : null}
                      {it.kind === 'grade' ? (
                        <View style={{ flexDirection: 'row' }}>
                          <View style={{ flex: 2, marginRight: 10 }}>
                            <Text style={st.placeText}>Avaliação</Text>
                            <Field value={it.title} onChangeText={(v) => patch(it.key, { title: v })} placeholder="P1" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.placeText}>Nota</Text>
                            <Field value={it.scoreText} onChangeText={(v) => patch(it.key, { scoreText: v })} keyboardType="decimal-pad" maxLength={6} />
                          </View>
                        </View>
                      ) : (
                        <View>
                          <Text style={st.placeText}>Dia</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            <Chip label="Hoje" color={pal.main} active={it.date === todayISO()} onPress={() => patch(it.key, { date: todayISO() })} />
                            <Chip label="Ontem" color={pal.main} active={it.date === addDays(todayISO(), -1)} onPress={() => patch(it.key, { date: addDays(todayISO(), -1) })} />
                          </View>
                          <Text style={st.placeText}>Aulas perdidas</Text>
                          <Field value={it.countText} onChangeText={(v) => patch(it.key, { countText: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} />
                        </View>
                      )}
                    </View>
                  ) : expanded ? (
                    <View style={st.fields}>
                      <Toggle options={KINDS} value={it.kind} color={pal.main} onChange={(k) => changeKind(it, k)} />
                      <ItemFields value={it} onChange={(p) => patch(it.key, p)} />
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={{ height: 8 }} />
            <Button title={items.length === 1 ? 'Salvar' : 'Salvar tudo'} color={colors.ink} onPress={save} />
            <View style={{ height: 4 }} />
            <Button title="Voltar e falar de novo" variant="text" color={colors.mute} onPress={() => setItems(null)} />
            {!settings.testMode ? null : savedPhrase ? (
              <View style={st.misheard}>
                <Text style={[st.misheardDone, { color: accent }]}>Frase guardada para correção ✓</Text>
                <Text style={st.misheardText2}>Fica no modo de teste, em Ajustes. Se você corrigir antes de salvar, a correção vai junto.</Text>
              </View>
            ) : (
              <Pressable onPress={saveMisheard} style={st.misheard} hitSlop={8} accessibilityRole="button">
                <Text style={st.misheardText}>Não entendeu direito? Guardar esta frase para correção</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  topTitle: { fontSize: look.titleSize, fontWeight: look.titleWeight, color: colors.ink, letterSpacing: -0.5 },
  close: { fontSize: 16, color: colors.mute, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 12 },
  prompt: { fontSize: look.mode === 'simple' ? 20 : 22, fontWeight: look.mode === 'simple' ? '500' : '700', color: colors.ink, marginBottom: 10 },
  examples: { fontSize: 14, color: colors.mute, lineHeight: 22 },
  micWrap: { alignItems: 'center', marginVertical: 24 },
  waveBox: { height: 64, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'center', marginBottom: 14 },
  waveIdle: { fontSize: 13, color: colors.mute },
  stopSquare: { width: 26, height: 26, borderRadius: 6 },
  live: { marginTop: 14, fontSize: 17, color: colors.ink, textAlign: 'center', lineHeight: 24 },
  mic: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 3, backgroundColor: colors.card },
  micLabel: { marginTop: 14, fontSize: 14, color: colors.mute, fontWeight: '600' },
  error: { marginTop: 10, fontSize: 13, color: colors.warn, textAlign: 'center', lineHeight: 19 },
  heardBox: { backgroundColor: colors.soft, borderRadius: look.rSmall, padding: 14, marginBottom: 16 },
  heardLabel: { fontSize: 13, fontWeight: '500', color: colors.mute, marginBottom: 6 },
  heard: { fontSize: 16, color: colors.ink, lineHeight: 23 },
  count: { fontSize: 20, fontWeight: look.mode === 'simple' ? '500' : '700', color: colors.ink, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderRadius: look.rSmall, paddingHorizontal: 12, marginBottom: 10, backgroundColor: colors.card },
  cardOpen: { backgroundColor: colors.soft },
  summary: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  tagDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  tagText: { fontSize: 12, fontWeight: '800' },
  sumTitle: { fontSize: 17, color: colors.ink, marginTop: 6, fontWeight: '600' },
  sumMeta: { fontSize: 13, color: colors.mute, marginTop: 3 },
  editHint: { fontSize: 13, color: colors.mute, fontWeight: '600', marginTop: 18 },
  fields: { paddingBottom: 8 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  subjectName: { fontSize: 13, fontWeight: '700' },
  place: { paddingBottom: 12 },
  placeText: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  misheard: { marginTop: 18, alignItems: 'center' },
  misheardText: { fontSize: 13, color: colors.mute, textDecorationLine: 'underline', textAlign: 'center' },
  misheardDone: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  misheardText2: { fontSize: 13, color: colors.mute, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  heardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fixLink: { fontSize: 14, fontWeight: '600', marginBottom: 6, minHeight: 24 },
  fixHint: { fontSize: 13, color: colors.mute, marginTop: 8, lineHeight: 19 },
  fixCancel: { fontSize: 14, color: colors.mute, fontWeight: '600' },
  noteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
  note: { fontSize: 13, color: colors.mute, lineHeight: 19 },
  noteLink: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  altRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, minHeight: 44, justifyContent: 'center' },
  altText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
});
