// Ajustes: o que o Prumo já tinha, mais o que veio do Peep. Cada parte abre quando a pessoa toca.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { useTheme } from './theme';
import { Btn, Card, Chip, DayPicker, Icon, Input, Label, Row, Segmented, Sheet, T, TimeInput } from './ui';
import { useStore } from './store';
import { useNav } from './nav';
import { askExactAlarm, exactAlarmOk, testAlert } from './notify';
import { pickText, saveFolder, saveText, dropImages } from './files';
import { exportNotes, KIND_LABEL } from './core/notes';
import { makeBackup, readBackup } from './core/migrate';
import { speechMode } from './speech';
import { STATES } from './legacy/holidays';
import { academicOf } from './legacy/academic';
import { dayLabel, WEEKDAYS_SHORT } from './core/dates';

export const APP_VERSION = '1.14.1';
const JOBS = [
  { v: 'estagio', label: 'Estágio' },
  { v: 'trabalho', label: 'Trabalho' },
  { v: 'outros', label: 'Outra coisa' },
  { v: 'so_estudo', label: 'Só estudo' },
];

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  ImagePicker = null;
}

function Group({ title, summary, children, startOpen }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <Card style={{ marginTop: 10, paddingVertical: 4 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} aria-label={title} style={{ minHeight: 52, justifyContent: 'center' }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T v="m">{title}</T>
            {summary && !open ? (
              <T v="s" c="soft" numberOfLines={1}>
                {summary}
              </T>
            ) : null}
          </View>
          <Icon name={open ? 'down' : 'next'} size={16} color="faint" />
        </Row>
      </Pressable>
      {open ? <View style={{ paddingBottom: 12, gap: 12 }}>{children}</View> : null}
    </Card>
  );
}

const Toggle = ({ label, hint, value, onChange }) => (
  <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: !!value }} accessibilityLabel={label} aria-label={label}>
    <Row gap={12}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hint ? (
          <T v="s" c="soft">
            {hint}
          </T>
        ) : null}
      </View>
      <Switch on={!!value} />
    </Row>
  </Pressable>
);
function Switch({ on }) {
  const c = useTheme();
  return (
    <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? c.task : c.line, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
    </View>
  );
}

export default function Settings({ onClose }) {
  const c = useTheme();
  const { state, now, setSettings, replaceAll, mutate, say } = useStore();
  const { open } = useNav();
  const st = state.settings;
  const [exact, setExact] = useState(true);
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState(null); // backup lido, esperando o "sim"
  const taps = useRef({ n: 0, at: 0 });
  useEffect(() => {
    exactAlarmOk().then(setExact);
  }, []);
  const learned = Object.entries(st.learned || {});
  const acad = academicOf(st);
  const fixed = state.blocks.filter((b) => b.kind === 'fixed' && !b.archived);
  const backupDays = st.backupAt ? Math.floor((now.getTime() - st.backupAt) / 864e5) : null;
  const log = state.heardLog || [];
  const notes = state.notes || [];
  const [confirmClear, setConfirmClear] = useState(false);
  const [exported, setExported] = useState('');

  const save = async () => {
    const d = new Date();
    const name = `no-prumo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const r = await saveText(name, JSON.stringify(makeBackup(state, d)));
    if (r.ok) setSettings({ backupAt: d.getTime() });
    setBusy(r.ok ? `Salvo: ${name}` : r.error || '');
  };
  const pick = async () => {
    const r = await pickText();
    if (!r.ok) return setBusy(r.error || '');
    const b = readBackup(r.text);
    if (b.error) return setBusy(b.error);
    setBusy('');
    setPending(b);
  };
  const pickPhoto = async () => {
    if (!ImagePicker) return;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
      if (!r.canceled && r.assets && r.assets[0]) setSettings({ photo: r.assets[0].uri });
    } catch (e) {
      say('Não foi possível abrir as fotos do aparelho.');
    }
  };
  const tapVersion = () => {
    const t = Date.now();
    taps.current = { n: t - taps.current.at < 600 ? taps.current.n + 1 : 1, at: t };
    if (taps.current.n >= 5) {
      taps.current.n = 0;
      setSettings({ testMode: !st.testMode });
      say(st.testMode ? 'Modo de teste desligado' : 'Modo de teste ligado');
    }
  };
  const shareLog = () => {
    const text = log.map((m, i) => `${i + 1}. Ouvi: "${m.heard}"${m.alts && m.alts.length ? `\n   Outras versões: ${m.alts.map((a) => `"${a}"`).join(' | ')}` : ''}\n   Corrigido para: "${m.text}"\n   Salvo: ${(m.fixed || []).join(' · ') || '—'}`).join('\n\n');
    Share.share({ message: `No Prumo ${APP_VERSION} · frases para o campo Testes\n\n${text}` }).catch(() => {});
  };
  const job = JOBS.find((j) => j.v === st.occupation);

  return (
    <Sheet title="Ajustes" onClose={onClose} full>
      <Row gap={14} style={{ marginTop: 4 }}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Trocar foto" aria-label="Trocar foto" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {st.photo ? <Image source={{ uri: st.photo }} style={{ width: 64, height: 64 }} /> : <T v="title" c="soft">{(st.name || '?').charAt(0).toUpperCase()}</T>}
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <Input value={st.name} onChangeText={(name) => setSettings({ name })} placeholder="Seu nome" accessibilityLabel="Seu nome" aria-label="Seu nome" />
        </View>
        <Input value={st.age} onChangeText={(age) => setSettings({ age: age.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" placeholder="Idade" accessibilityLabel="Idade" aria-label="Idade" style={{ width: 78, textAlign: 'center' }} />
      </Row>

      <Group title="Ajustar perfil" summary={[job ? job.label : null, st.state || null].filter(Boolean).join(' · ') || 'Ocupação e estado'}>
        <T v="s" c="soft">
          Além de estudar, você tem
        </T>
        <Row wrap>
          {JOBS.map((j) => (
            <Chip key={j.v} label={j.label} on={st.occupation === j.v} onPress={() => setSettings({ occupation: j.v })} />
          ))}
        </Row>
        <T v="s" c="soft">
          Seu estado (para os feriados do calendário)
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATES.map(([uf]) => (
            <Chip key={uf} label={uf} on={st.state === uf} onPress={() => setSettings({ state: st.state === uf ? '' : uf })} />
          ))}
        </ScrollView>
      </Group>

      <Group title="Aparência" summary={{ auto: 'Igual ao celular', light: 'Claro', dark: 'Escuro' }[st.theme]}>
        <Segmented value={st.theme} onChange={(theme) => setSettings({ theme })} options={[{ value: 'auto', label: 'Igual ao celular' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
      </Group>

      <Group title="Meus horários fixos" summary={fixed.length ? fixed.map((b) => b.name).join(' · ') : 'Estágio, trabalho, academia'}>
        <T v="s" c="soft">
          O que tem hora certa toda semana e não é matéria. Aparece no seu dia e entra na conta dos horários livres. As aulas ficam em Estudos.
        </T>
        {fixed.map((b) => (
          <Pressable key={b.id} onPress={() => open('block', { id: b.id })} accessibilityRole="button" accessibilityLabel={`Abrir ${b.name}`} aria-label={`Abrir ${b.name}`} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Row gap={10}>
              <View style={{ width: 5, height: 30, borderRadius: 3, backgroundColor: c.blocks[b.color % 8] }} />
              <View style={{ flex: 1 }}>
                <T v="m">{b.name}</T>
                <T v="s" c="soft">
                  {(b.slots || []).map((sl) => `${sl.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')} ${sl.start}–${sl.end}`).join(' · ') || 'Sem horário'}
                </T>
              </View>
            </Row>
          </Pressable>
        ))}
        <Btn small kind="soft" icon="plus" label="Novo horário fixo" onPress={() => open('block', { kind: 'fixed' })} style={{ alignSelf: 'flex-start' }} />
      </Group>

      <Group title="Faculdade" summary={`Média ${String(acad.passGrade).replace('.', ',')} · aula de ${acad.classMinutes} min · faltas até ${acad.absencePct}%`}>
        <T v="s" c="soft">
          Cada faculdade tem as suas regras. Na UTFPR: média 6, nota máxima 10, aula de 50 minutos, faltas até 25%.
        </T>
        {[
          ['passGrade', 'Média para passar'],
          ['maxGrade', 'Nota máxima'],
          ['classMinutes', 'Duração de uma aula (min)'],
          ['absencePct', 'Limite de faltas (%)'],
        ].map(([k, label]) => (
          <Row key={k}>
            <T style={{ flex: 1 }}>{label}</T>
            <Input value={String(acad[k]).replace('.', ',')} onChangeText={(t) => { const n = parseFloat(t.replace(',', '.')); if (Number.isFinite(n) && n > 0) setSettings({ academic: { ...acad, [k]: n } }); }} keyboardType="decimal-pad" accessibilityLabel={label} aria-label={label} style={{ width: 80, textAlign: 'center' }} />
          </Row>
        ))}
        <Toggle label="Perguntar “Foi na aula?” depois de cada aula" hint="Um aviso com Fui e Faltei. Faltei conta as faltas sozinho, com o app fechado." value={!!acad.askAttendance} onChange={(askAttendance) => setSettings({ academic: { ...acad, askAttendance } })} />
      </Group>

      <Group title="Semestre" summary={st.semester.start && st.semester.end ? `${dayLabel(st.semester.start, now)} a ${dayLabel(st.semester.end, now)}` : 'Início e fim das aulas'}>
        <T v="s" c="soft">
          Com as datas eu conto as aulas de cada matéria e sugiro o limite de faltas (25%).
        </T>
        <T v="sm">Começa</T>
        <DayPicker value={st.semester.start} onChange={(start) => setSettings({ semester: { ...st.semester, start } })} />
        <T v="sm">Termina</T>
        <DayPicker value={st.semester.end} onChange={(end) => setSettings({ semester: { ...st.semester, end } })} />
      </Group>

      <Group title="Avisos" summary={`${st.sound === false ? 'Só vibração' : 'Som e vibração'}${st.morning ? ` · resumo às ${st.morning}` : ''}`}>
        <Row>
          <View style={{ flex: 1 }}>
            <T>Resumo do dia</T>
            <T v="s" c="soft">
              Um aviso de manhã, só nos dias que têm alguma coisa.
            </T>
          </View>
          {st.morning ? <TimeInput value={st.morning} onChange={(t) => setSettings({ morning: t })} label="Hora do resumo" style={{ width: 84 }} /> : <Btn small kind="soft" label="Ligar" onPress={() => setSettings({ morning: '07:00' })} />}
        </Row>
        {st.morning ? <Btn small kind="ghost" label="Desligar o resumo" onPress={() => setSettings({ morning: null })} style={{ alignSelf: 'flex-start', marginTop: -8 }} /> : null}
        <View>
          <T>Antes da aula e dos horários fixos</T>
          <Row wrap style={{ marginTop: 8 }}>
            {[0, 10, 15, 30].map((n) => (
              <Chip key={n} label={n ? `${n} min` : 'Não avisar'} on={(st.classAlert || 0) === n} onPress={() => setSettings({ classAlert: n })} />
            ))}
          </Row>
        </View>
        <Segmented value={st.sound === false ? 'v' : 's'} onChange={(v) => setSettings({ sound: v === 's' })} options={[{ value: 's', label: 'Som e vibração' }, { value: 'v', label: 'Só vibração' }]} />
        <Row wrap>
          <Btn small kind="soft" icon="bell" label="Testar um aviso" onPress={async () => say((await testAlert(st.sound !== false)) ? 'O aviso chega em 5 segundos' : 'Libere as notificações do Prumo no celular')} />
          {!exact ? <Btn small kind="soft" label="Permitir horário exato" onPress={async () => setExact(await askExactAlarm())} /> : null}
        </Row>
      </Group>

      <Group title="Voz" summary={speechMode() ? `Última vez: ${speechMode()}` : 'Microfone e palavras aprendidas'}>
        <Toggle label="Começar a ouvir ao tocar no microfone" value={st.autoListen !== false} onChange={(autoListen) => setSettings({ autoListen })} />
        <Toggle label="Reconhecer a voz no próprio celular (quando der)" hint="Sem isso, o áudio vai para o Google." value={st.voiceOnDevice !== false} onChange={(voiceOnDevice) => setSettings({ voiceOnDevice })} />
        {speechMode() ? (
          <T v="s" c="soft">
            Última vez: {speechMode()}
          </T>
        ) : null}
        <T v="sm">Palavras que aprendi com você</T>
        {learned.length ? (
          <Row wrap>
            {learned.map(([from, v]) => (
              <Chip key={from} label={`${from} → ${v.to}  ✕`} onPress={() => { const next = { ...st.learned }; delete next[from]; setSettings({ learned: next }); }} />
            ))}
          </Row>
        ) : (
          <T v="s" c="soft">
            Quando o celular ouvir uma palavra errada, corrija o texto antes de guardar. Na segunda vez eu troco sozinho.
          </T>
        )}
      </Group>

      <Group title="Backup" summary={backupDays === null ? 'Nenhum backup salvo ainda' : backupDays > 14 ? `Último há ${backupDays} dias: faça outro` : backupDays === 0 ? 'Salvo hoje' : `Salvo há ${backupDays} dias`} startOpen={backupDays !== null && backupDays > 14}>
        <T v="s" c="soft">
          Tudo fica só neste celular. O backup é um arquivo que você guarda onde quiser (Downloads, Drive).
        </T>
        <Row wrap>
          <Btn small kind="soft" label="Salvar backup" onPress={save} />
          <Btn small kind="soft" label="Restaurar" onPress={pick} />
        </Row>
        {busy ? (
          <T v="s" c="soft">
            {busy}
          </T>
        ) : null}
        {pending ? (
          <View style={{ gap: 8 }}>
            <T v="m">
              {pending.from === 'prumo' ? 'Backup da 1.12 ou anterior' : 'Backup do Prumo'}: {pending.counts.items} itens, {pending.counts.blocks} matérias e horários, {pending.counts.accounts || 0} contas.
            </T>
            <T v="s" c="soft">
              Isso troca o que está no app agora. Dá para voltar ao que tinha logo depois, no “Desfazer”.
            </T>
            <Row>
              <Btn small label="Restaurar" onPress={() => { replaceAll(pending.state, 'Backup restaurado'); setPending(null); onClose(); }} />
              <Btn small kind="ghost" label="Cancelar" onPress={() => setPending(null)} />
            </Row>
          </View>
        ) : null}
      </Group>

      {st.testMode ? (
        <Group title="Modo de teste" summary={`${notes.length} ${notes.length === 1 ? 'apontamento' : 'apontamentos'} · ${log.length} ${log.length === 1 ? 'frase' : 'frases'}`} startOpen>
          <T v="s" c="soft">
            Toque no botão laranja flutuante a qualquer momento para anotar um bug ou uma melhoria: o app tira o print da tela junto. Toda fala que você corrigir antes de guardar também fica aqui.
          </T>
          <Toggle label="Mostrar o botão flutuante" value={st.notesButton !== false} onChange={(notesButton) => setSettings({ notesButton })} />
          {notes
            .slice()
            .sort((a, b) => b.at - a.at)
            .map((n) => (
              <Pressable key={n.id} onPress={() => open('note', { id: n.id })} accessibilityRole="button" accessibilityLabel={`Abrir apontamento ${n.text}`} aria-label={`Abrir apontamento ${n.text}`} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Row gap={10}>
                  <T v="sm" c={n.kind === 'bug' ? 'danger' : 'task'} style={{ width: 70 }}>
                    {KIND_LABEL[n.kind]}
                  </T>
                  <View style={{ flex: 1 }}>
                    <T numberOfLines={1}>{n.text || '(só print)'}</T>
                    <T v="s" c="soft" numberOfLines={1}>
                      {dayLabel(new Date(n.at).toISOString().slice(0, 10), now)}
                      {n.photos && n.photos.length ? ` · ${n.photos.length} ${n.photos.length === 1 ? 'print' : 'prints'}` : ''}
                      {n.where ? ` · ${n.where}` : ''}
                    </T>
                  </View>
                </Row>
              </Pressable>
            ))}
          <Row wrap>
            {notes.length || log.length ? <Btn small label="Salvar apontamentos e frases" onPress={async () => { const ex = exportNotes(notes, log, { version: APP_VERSION, now: new Date() }); const r = await saveFolder([{ name: ex.name, text: ex.text, mime: 'text/markdown' }, ...ex.images]); setExported(r.ok ? `Salvo: ${ex.name}${ex.images.length ? ` e ${ex.images.length} ${ex.images.length === 1 ? 'print' : 'prints'}` : ''}. Mande esses arquivos no chat.` : r.error || ''); }} /> : null}
            {log.length ? <Btn small kind="soft" label="Mandar só as frases" onPress={shareLog} /> : null}
          </Row>
          {exported ? (
            <T v="s" c="soft">
              {exported}
            </T>
          ) : null}
          {notes.length || log.length ? (
            confirmClear ? (
              <Row wrap>
                <T v="s" c="danger">
                  Apagar {notes.length} apontamentos (com os prints) e {log.length} frases?
                </T>
                <Btn small kind="danger" label="Apagar" onPress={() => { notes.forEach((n) => dropImages(n.photos || [])); mutate((s) => ({ ...s, notes: [], heardLog: [] }), 'Apontamentos e frases apagados'); setConfirmClear(false); }} />
                <Btn small kind="ghost" label="Cancelar" onPress={() => setConfirmClear(false)} />
              </Row>
            ) : (
              <Btn small kind="ghost" label="Limpar tudo (depois de mandar)" onPress={() => setConfirmClear(true)} style={{ alignSelf: 'flex-start' }} />
            )
          ) : null}
          <Btn small kind="ghost" label="Sair do modo de teste" onPress={() => setSettings({ testMode: false })} style={{ alignSelf: 'flex-start' }} />
        </Group>
      ) : null}

      <Pressable onPress={tapVersion} accessibilityLabel="Versão" style={{ paddingVertical: 22 }}>
        <T v="s" c="faint">
          No Prumo {APP_VERSION}
          {st.testMode ? ' · modo de teste' : ''}
        </T>
      </Pressable>
    </Sheet>
  );
}
