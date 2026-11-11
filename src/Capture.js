// Falar ou escrever. O Peep mostra na hora o que entendeu; nada é guardado sem o "Guardar".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { typeBg, typeColor, TYPE_ICON, TYPE_LABEL, useTheme } from './theme';
import { Btn, Card, Chip, Icon, IconBtn, Input, Row, Sheet, T } from './ui';
import { useStore } from './store';
import { useNav } from './nav';
import { useSpeech } from './speech';
import { understand } from './core/understand';
import { buildVocab, pickBest } from './legacy/voice';
import { addDays, dayLabel, todayISO } from './core/dates';
import { answer } from './core/answers';
import { applyLearned, learn } from './core/learn';
import { moneyText, repeatText, whenText } from './core/model';
import { WEEKDAYS_SHORT } from './core/dates';

const EXAMPLES = ['prova de cálculo sexta às 8h', 'gastei 32 reais no ifood', 'lavar roupa amanhã de manhã e pagar a internet de 100 reais dia 12', 'aula de física terça e quinta das 10 às 12', 'o que eu tenho amanhã?'];
const NEXT_TYPE = { task: 'study', study: 'money', money: 'task' };

function actionText(a, blocks = []) {
  const subj = a.subjectId ? (blocks.find((b) => b.id === a.subjectId) || {}).name : null;
  if (a.type === 'grade') return { icon: 'book', title: `Nota: ${a.name} ${String(a.score).replace('.', ',')}${a.max ? ` de ${String(a.max).replace('.', ',')}` : ''}`, sub: subj || 'Escolha a matéria', pick: !subj };
  if (a.type === 'absence') return { icon: 'book', title: `Falta${a.count > 1 ? ` (${a.count} aulas)` : ''}`, sub: subj || 'Escolha a matéria', pick: !subj };
  const slots = a.slots || [{ days: a.days, start: a.start, end: a.end }];
  return { icon: 'clock', title: a.name, sub: `${a.block === 'class' ? 'Aula' : 'Horário fixo'} · ${slots.map((s) => `${s.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')} ${s.start}–${s.end}`).join(' · ')}` };
}

export default function Capture({ voice, onClose, initial }) {
  const c = useTheme();
  const { state, now, addItems, applyActions, setSettings, mutate, say } = useStore();
  const { open } = useNav();
  const [text, setText] = useState(initial || '');
  const [live, setLive] = useState('');
  const [heard, setHeard] = useState(null); // o que o celular entregou, antes de qualquer correção
  const [alts, setAlts] = useState([]);
  const [auto, setAuto] = useState([]); // trocas feitas pelo dicionário pessoal
  const [edits, setEdits] = useState({}); // ajustes feitos nos cartões: { índice: {...} }
  const [dropped, setDropped] = useState({});
  const inputRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  // vocabulário: palavras do app, matérias, contas, trocas aprendidas e títulos que a pessoa usa
  const vocabRef = useRef(null);
  if (!vocabRef.current) vocabRef.current = buildVocab({ subjects: state.blocks.map((b) => ({ name: b.name, aliases: b.aliases || [], archived: b.archived })), accounts: state.accounts || [], learned: state.settings.learned || {}, titles: state.items.slice(-300).map((i) => i.title) });
  const vocab = () => vocabRef.current;
  const [heardInfo, setHeardInfo] = useState(null); // confiança e tempo das palavras (modo de teste)

  const takeHeard = (list, audio, info = {}) => {
    // 1.13.1: a 1ª versão do Android só perde com prova (valor, dia, hora, palavra da pessoa);
    // depois, as versões são misturadas palavra por palavra
    const learned = strong(state.settings.learned);
    const versions = list.filter(Boolean).map((t) => applyLearned(t, learned).text);
    const best = pickBest(versions, todayISO(now), now, vocabRef.current || [], info.conf || []);
    const first = list[best.index] || list[0] || '';
    const fixed = applyLearned(best.text || first, learned);
    setHeardInfo({ conf: info.conf || [], timing: info.timing || [] });
    setHeard(first);
    setAlts(list.filter((a) => a && a !== first).slice(0, 2));
    setAuto(fixed.changed);
    setText(fixed.text);
    setLive('');
    setEdits({});
    setDropped({});
  };
  const speech = useSpeech({ onText: setLive, onDone: takeHeard, onVolume: (v) => pulse.setValue(Math.max(0, Math.min(1, (v + 2) / 10))), vocab, onDevice: state.settings.voiceOnDevice !== false });

  useEffect(() => {
    if (voice && speech.supported && state.settings.autoListen !== false) speech.start();
    else setTimeout(() => inputRef.current && inputRef.current.focus(), 250);
    return () => speech.abort();
  }, []);

  const result = useMemo(() => understand(text, { now, blocks: state.blocks, settings: state.settings }), [text, state.blocks]);
  const items = result.items.map((it, i) => ({ ...it, ...(edits[i] || {}) })).map((it, i) => ({ it, i })).filter((x) => !dropped[x.i]);
  const actions = result.actions.map((a, i) => ({ a: { ...a, ...(edits[`a${i}`] || {}) }, i })).filter((x) => !dropped[`a${x.i}`]);
  const classes = state.blocks.filter((b) => b.kind === 'class' && !b.archived);
  const placeName = { estagio: 'Estágio', trabalho: 'Trabalho', outros: state.settings.occupationName || 'Outro' }[state.settings.occupation];
  const reply = result.query ? answer(result.query, state, now) : null;
  const total = items.length + actions.filter((x) => x.a.type === 'schedule' || x.a.subjectId).length;
  // sugestão do dicionário: a pessoa corrigiu uma vez; na segunda, troca sozinho
  const hint = useMemo(() => {
    const weak = Object.entries(state.settings.learned || {}).filter(([, v]) => v.n === 1);
    const r = applyLearned(text, Object.fromEntries(weak));
    return r.changed.length ? r : null;
  }, [text, state.settings.learned]);

  const changeText = (t) => {
    setText(t);
    setEdits({});
    setDropped({});
  };

  const save = () => {
    if (!total) return;
    if (heard && heard !== text) setSettings({ learned: learn(state.settings.learned, applyLearned(heard, strong(state.settings.learned)).text, text) });
    // modo de teste: guarda toda fala que precisou de correção (texto, cartão ajustado ou tirado)
    const touched = heard && (heard !== text || Object.keys(edits).length || Object.keys(dropped).length);
    if (state.settings.testMode && touched) {
      const entry = { id: `h${Date.now()}`, heard, alts, text, ...(heardInfo || {}), fixed: [...items.map((x) => x.it.title), ...actions.map((x) => actionText(x.a, state.blocks).title)], at: Date.now() };
      mutate((s) => ({ ...s, heardLog: [entry, ...(s.heardLog || [])].slice(0, 200) }));
    }
    const notes = actions.length ? applyActions(actions.map((x) => x.a).filter((a) => a.type === 'schedule' || a.subjectId)) : [];
    if (items.length) addItems(items.map((x) => x.it), heard || undefined);
    onClose();
    const n = items.length;
    say(notes.length && !n ? notes[0] : n === 1 ? `Guardado: ${items[0].it.title}` : `${n} itens guardados${notes.length ? ` · ${notes[0]}` : ''}`);
  };

  const listening = speech.listening;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  const footer = (
    <Row gap={10}>
      <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        {listening ? <Animated.View style={{ position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: c.brand, opacity: 0.35, transform: [{ scale }] }} /> : null}
        <Pressable onPress={() => (listening ? speech.stop() : speech.start())} accessibilityRole="button" accessibilityLabel={listening ? 'Parar de ouvir' : 'Falar'} aria-label={listening ? 'Parar de ouvir' : 'Falar'} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: listening ? c.brand : c.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mic" size={24} color={listening ? c.onBrand : c.text} />
        </Pressable>
      </View>
      {reply ? <Btn label="Perguntar outra coisa" kind="soft" onPress={() => changeText('')} style={{ flex: 1 }} /> : <Btn label={total > 1 ? `Guardar ${total}` : 'Guardar'} icon="check" disabled={!total} onPress={save} style={{ flex: 1 }} />}
    </Row>
  );

  return (
    <Sheet title={listening ? 'Pode falar' : 'O que você precisa?'} onClose={onClose} footer={footer}>
      {listening ? (
        <View style={{ minHeight: 96, justifyContent: 'center' }}>
          <T v="title" c={live ? 'text' : 'faint'}>
            {live || 'Estou ouvindo…'}
          </T>
          <T v="s" c="soft" style={{ marginTop: 10 }}>
            Fale tudo de uma vez, do seu jeito. Toque no microfone quando terminar.
          </T>
        </View>
      ) : (
        <Input ref={inputRef} value={text} onChangeText={changeText} multiline placeholder="Fale ou escreva. Ex.: prova de física sexta às 8h" accessibilityLabel="O que você precisa" aria-label="O que você precisa" v="h" style={{ minHeight: 76, textAlignVertical: 'top', paddingTop: 12 }} />
      )}
      {speech.error && !listening ? (
        <T v="s" c="danger" style={{ marginTop: 8 }}>
          {speech.error}
        </T>
      ) : null}

      {!listening && heard !== null ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          <T v="s" c="soft">
            Ouvi errado? Corrija o texto acima: eu aprendo com você.
          </T>
          {auto.length ? (
            <T v="s" c="soft">
              Troquei sozinho: {auto.map(([a, b]) => `"${a}" por "${b}"`).join(', ')}.
            </T>
          ) : null}
          {alts.length ? (
            <Row wrap>
              <T v="s" c="soft">
                Ou foi:
              </T>
              {alts.map((a) => (
                <Chip key={a} label={a.length > 42 ? `${a.slice(0, 40)}…` : a} onPress={() => changeText(applyLearned(a, strong(state.settings.learned)).text)} />
              ))}
            </Row>
          ) : null}
        </View>
      ) : null}
      {!listening && hint ? <Chip style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="spark" label={`Trocar "${hint.changed[0][0]}" por "${hint.changed[0][1]}"`} onPress={() => changeText(hint.text)} /> : null}

      {reply && !listening ? (
        <Card style={{ marginTop: 16 }} tone="card">
          <T v="h">{reply.title}</T>
          {reply.lines.map((l, i) => (
            <View key={i} style={{ marginTop: 10 }}>
              {l.head ? (
                <T v="l" c="faint" style={{ marginBottom: 4 }}>
                  {l.head}
                </T>
              ) : null}
              {l.rows.map((r, k) => (
                <T key={k} c="soft" style={{ paddingVertical: 2 }}>
                  {r}
                </T>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      {!listening && !reply && total ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <T v="l" c="faint">
            Entendi assim
          </T>
          {items.map(({ it, i }) => {
            const color = typeColor(c, it.type);
            const meta = [it.times ? `${dayLabel(it.date, now)} · ${it.times.join(', ')}` : whenText(it, now), it.duration ? `${it.duration} min` : '', repeatText(it.repeat)].filter(Boolean).join(' · ');
            return (
              <Card key={`i${i}`} style={{ padding: 12, borderLeftWidth: 4, borderLeftColor: color }}>
                <Row gap={10}>
                  <Pressable onPress={() => setEdits({ ...edits, [i]: { ...(edits[i] || {}), ...retype(it, NEXT_TYPE[it.type]) } })} accessibilityRole="button" accessibilityLabel={`Tipo: ${TYPE_LABEL[it.type]}. Toque para trocar`} aria-label={`Tipo: ${TYPE_LABEL[it.type]}. Toque para trocar`} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: typeBg(c, it.type), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={TYPE_ICON[it.type]} size={21} color={color} />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => open('item', { draft: it, onSave: (d) => setEdits((e) => ({ ...e, [i]: d })) })} accessibilityRole="button" accessibilityLabel={`Ajustar ${it.title}`} aria-label={`Ajustar ${it.title}`}>
                    <T v="m" numberOfLines={2}>
                      {it.title}
                    </T>
                    <T v="s" c={meta ? 'soft' : 'faint'}>
                      {it.type === 'study' ? { prova: 'Prova', entrega: 'Entrega', estudo: 'Estudo' }[it.studyKind] || 'Estudo' : TYPE_LABEL[it.type]}
                      {it.type === 'money' ? ` · ${it.paid ? (it.flow === 'in' ? 'recebido' : 'pago') : it.flow === 'in' ? 'a receber' : 'a pagar'}` : ''}
                      {meta ? ` · ${meta}` : ' · sem data'}
                    </T>
                  </Pressable>
                  {it.type === 'money' ? (
                    <T v="m" c={it.amount ? color : 'danger'}>
                      {it.amount ? moneyText(it) : 'Valor?'}
                    </T>
                  ) : null}
                  <IconBtn name="close" size={18} label={`Tirar ${it.title}`} onPress={() => setDropped({ ...dropped, [i]: true })} />
                </Row>
                {it.askDay ? (
                  <Row wrap gap={6} style={{ marginTop: 8 }}>
                    <T v="s" c="warn">
                      {it.time} já passou. Quando?
                    </T>
                    <Chip label="Hoje" onPress={() => setEdits({ ...edits, [i]: { ...(edits[i] || {}), askDay: false } })} />
                    <Chip label="Amanhã" onPress={() => setEdits({ ...edits, [i]: { ...(edits[i] || {}), askDay: false, date: addDays(todayISO(now), 1) } })} />
                  </Row>
                ) : null}
                {it.askPlace && placeName ? (
                  <Row wrap gap={6} style={{ marginTop: 8 }}>
                    <T v="s" c="warn">
                      Faculdade ou {placeName.toLowerCase()}?
                    </T>
                    <Chip label="Faculdade" onPress={() => setEdits({ ...edits, [i]: { ...(edits[i] || {}), askPlace: false, type: 'study' } })} />
                    <Chip label={placeName} onPress={() => setEdits({ ...edits, [i]: { ...(edits[i] || {}), askPlace: false, type: 'task' } })} />
                  </Row>
                ) : null}
              </Card>
            );
          })}
          {actions.map(({ a, i }) => {
            const tx = actionText(a, state.blocks);
            return (
              <Card key={`a${i}`} style={{ padding: 12, borderLeftWidth: 4, borderLeftColor: c.study }}>
                <Row gap={10}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.studyBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={tx.icon} size={21} color="study" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="m">{tx.title}</T>
                    <T v="s" c={tx.pick ? 'warn' : 'soft'}>
                      {tx.sub}
                    </T>
                    {tx.pick && classes.length ? (
                      <Row wrap gap={6} style={{ marginTop: 6 }}>
                        {classes.map((b) => (
                          <Chip key={b.id} label={b.name} onPress={() => setEdits({ ...edits, [`a${i}`]: { subjectId: b.id } })} />
                        ))}
                      </Row>
                    ) : null}
                  </View>
                  <IconBtn name="close" size={18} label="Tirar" onPress={() => setDropped({ ...dropped, [`a${i}`]: true })} />
                </Row>
              </Card>
            );
          })}
          <T v="s" c="faint">
            Toque no ícone para trocar o tipo, ou no texto para ajustar dia, hora e valor.
          </T>
        </View>
      ) : null}

      {!listening && !text.trim() ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <T v="l" c="faint">
            Experimente
          </T>
          {EXAMPLES.map((e) => (
            <Pressable key={e} onPress={() => changeText(e)} accessibilityRole="button" accessibilityLabel={e} style={{ paddingVertical: 9 }}>
              <T c="soft">“{e}”</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!listening && text.trim() && !total && !reply ? (
        <T c="soft" style={{ marginTop: 16 }}>
          Ainda não entendi. Diga o que é e quando, por exemplo: “dentista dia 3 às 14h”.
        </T>
      ) : null}
    </Sheet>
  );
}

// só as trocas confirmadas (corrigidas 2 vezes ou mais) entram sozinhas
const strong = (learned) => Object.fromEntries(Object.entries(learned || {}).filter(([, v]) => v.n >= 2));

function retype(it, type) {
  if (type === 'money') return { type, amount: it.amount || 0, flow: it.flow || 'out', paid: false, category: it.category || 'Outros' };
  if (type === 'study') return { type, studyKind: it.studyKind || 'estudo' };
  return { type };
}
