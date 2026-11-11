// Falar ou escrever. O Peep mostra na hora o que entendeu; nada é guardado sem o "Guardar".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { typeBg, typeColor, TYPE_ICON, TYPE_LABEL, useTheme } from './theme';
import { Btn, Card, Chip, Icon, IconBtn, Input, Row, Sheet, T } from './ui';
import { useStore } from './store';
import { useNav } from './nav';
import { useSpeech } from './speech';
import { parse } from './core/nlu';
import { answer } from './core/answers';
import { applyLearned, learn } from './core/learn';
import { moneyText, repeatText, whenText } from './core/model';
import { WEEKDAYS_SHORT } from './core/dates';

const EXAMPLES = ['prova de cálculo sexta às 8h', 'gastei 32 reais no ifood', 'lavar roupa amanhã de manhã e pagar a internet de 100 reais dia 12', 'aula de física terça e quinta das 10 às 12', 'o que eu tenho amanhã?'];
const NEXT_TYPE = { task: 'study', study: 'money', money: 'task' };

function actionText(a) {
  if (a.type === 'grade') return { icon: 'book', title: `Nota: ${a.name} ${String(a.score).replace('.', ',')}${a.max !== 10 ? ` de ${a.max}` : ''}`, sub: a.subjectName || 'Matéria não reconhecida' };
  if (a.type === 'absence') return { icon: 'book', title: 'Falta', sub: a.subjectName || 'Todas as aulas do dia' };
  return { icon: 'clock', title: `${a.name}: ${a.start}–${a.end}`, sub: `${a.block === 'class' ? 'Aula' : 'Horário fixo'} · ${a.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')}` };
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
  const vocab = () => [...state.blocks.map((b) => b.name), ...(state.accounts || []).map((a) => a.name), ...Object.values(state.settings.learned || {}).map((v) => v.to), 'Pix', 'prova', 'boleto', 'aula', 'estágio'].slice(0, 100);

  const takeHeard = (list) => {
    // das versões que o celular ouviu, fica a que rende mais (dia, hora, valor); empate = a primeira
    const score = (txt) => {
      const r = parse(applyLearned(txt, strong(state.settings.learned)).text, { now, subjects: state.blocks });
      return r.items.reduce((n, i) => n + (i.date ? 2 : 0) + (i.time ? 2 : 0) + (i.amount ? 2 : 0) + (i.title.split(' ').length <= 6 ? 1 : 0), 0) + r.actions.length * 5 + (r.query ? 4 : 0);
    };
    const ranked = list.filter(Boolean).map((txt, k) => ({ txt, s: score(txt) - k * 0.01 }));
    const best = ranked.reduce((a, b) => (b.s > a.s + 1.5 ? b : a), ranked[0] || { txt: '' });
    const first = best.txt;
    list = [first, ...list.filter((x) => x !== first)];
    const fixed = applyLearned(first, strong(state.settings.learned));
    setHeard(first);
    setAlts(list.slice(1, 3).filter((a) => a && a !== first));
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

  const result = useMemo(() => parse(text, { now, subjects: state.blocks }), [text, state.blocks]);
  const items = result.items.map((it, i) => ({ ...it, ...(edits[i] || {}) })).map((it, i) => ({ it, i })).filter((x) => !dropped[x.i]);
  const actions = result.actions.map((a, i) => ({ a, i })).filter((x) => !dropped[`a${x.i}`]);
  const reply = result.query ? answer(result.query, state, now) : null;
  const total = items.length + actions.length;
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
      const entry = { id: `h${Date.now()}`, heard, alts, text, fixed: [...items.map((x) => x.it.title), ...actions.map((x) => actionText(x.a).title)], at: Date.now() };
      mutate((s) => ({ ...s, heardLog: [entry, ...(s.heardLog || [])].slice(0, 200) }));
    }
    const notes = actions.length ? applyActions(actions.map((x) => x.a)) : [];
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
            const meta = [whenText(it, now), it.duration ? `${it.duration} min` : '', repeatText(it.repeat)].filter(Boolean).join(' · ');
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
              </Card>
            );
          })}
          {actions.map(({ a, i }) => {
            const tx = actionText(a);
            return (
              <Card key={`a${i}`} style={{ padding: 12, borderLeftWidth: 4, borderLeftColor: c.study }}>
                <Row gap={10}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.studyBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={tx.icon} size={21} color="study" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="m">{tx.title}</T>
                    <T v="s" c="soft">
                      {tx.sub}
                    </T>
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
