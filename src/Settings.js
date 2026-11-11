// Ajustes: poucos, e cada um com um motivo.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Chip, Input, Label, Row, Segmented, Sheet, T, TimeInput } from './ui';
import { useStore } from './store';
import { askExactAlarm, exactAlarmOk, testAlert } from './notify';
import { pickText, saveText } from './files';
import { makeBackup, readBackup } from './core/migrate';
import { speechMode } from './speech';

export const APP_VERSION = '1.13.0';

export default function Settings({ onClose }) {
  const { state, setSettings, replaceAll, say } = useStore();
  const st = state.settings;
  const [exact, setExact] = useState(true);
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState(null); // backup lido, esperando o "sim"
  useEffect(() => {
    exactAlarmOk().then(setExact);
  }, []);
  const learned = Object.entries(st.learned || {});

  const save = async () => {
    const d = new Date();
    const name = `peep-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const r = await saveText(name, JSON.stringify(makeBackup(state, d)));
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

  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <Label style={{ marginTop: 4 }}>Como te chamo</Label>
      <Input value={st.name} onChangeText={(name) => setSettings({ name })} placeholder="Seu nome" accessibilityLabel="Seu nome" aria-label="Seu nome" />

      <Label>Aparência</Label>
      <Segmented value={st.theme} onChange={(theme) => setSettings({ theme })} options={[{ value: 'auto', label: 'Igual ao celular' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />

      <Label>Avisos</Label>
      <Card style={{ gap: 14 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T v="m">Resumo do dia</T>
            <T v="s" c="soft">
              Um aviso de manhã, só nos dias que têm alguma coisa.
            </T>
          </View>
          {st.morning ? <TimeInput value={st.morning} onChange={(t) => setSettings({ morning: t })} label="Hora do resumo" style={{ width: 84 }} /> : <Btn small kind="soft" label="Ligar" onPress={() => setSettings({ morning: '07:00' })} />}
        </Row>
        {st.morning ? <Btn small kind="ghost" label="Desligar o resumo" onPress={() => setSettings({ morning: null })} style={{ alignSelf: 'flex-start', marginTop: -8 }} /> : null}
        <View>
          <T v="m">Antes da aula</T>
          <Row wrap style={{ marginTop: 8 }}>
            {[0, 10, 15, 30].map((n) => (
              <Chip key={n} label={n ? `${n} min` : 'Não avisar'} on={(st.classAlert || 0) === n} onPress={() => setSettings({ classAlert: n })} />
            ))}
          </Row>
        </View>
        <Segmented value={st.sound === false ? 'v' : 's'} onChange={(v) => setSettings({ sound: v === 's' })} options={[{ value: 's', label: 'Som e vibração' }, { value: 'v', label: 'Só vibração' }]} />
        <Row wrap>
          <Btn small kind="soft" icon="bell" label="Testar um aviso" onPress={async () => say((await testAlert(st.sound !== false)) ? 'O aviso chega em 5 segundos' : 'Libere as notificações do Peep no celular')} />
          {!exact ? <Btn small kind="soft" label="Liberar avisos na hora exata" onPress={async () => setExact(await askExactAlarm())} /> : null}
        </Row>
      </Card>

      <Label>Seus dados</Label>
      <Card style={{ gap: 10 }}>
        <T v="s" c="soft">
          Tudo fica só neste celular. O backup é um arquivo que você guarda onde quiser.
        </T>
        <Row wrap>
          <Btn small kind="soft" label="Salvar backup" onPress={save} />
          <Btn small kind="soft" label="Abrir backup (Peep ou Prumo)" onPress={pick} />
        </Row>
        {busy ? (
          <T v="s" c="soft">
            {busy}
          </T>
        ) : null}
        {pending ? (
          <View style={{ gap: 8 }}>
            <T v="m">
              {pending.from === 'prumo' ? 'Backup do Prumo' : 'Backup do Peep'}: {pending.counts.items} itens e {pending.counts.blocks} matérias.
            </T>
            <T v="s" c="soft">
              {pending.from === 'prumo' ? 'Vêm tarefas, estudos, matérias, lançamentos e contas fixas. Contas de banco e transferências ficam de fora. ' : ''}Isso troca o que está no Peep agora. Dá para desfazer logo depois.
            </T>
            <Row>
              <Btn small label="Trazer" onPress={() => { replaceAll(pending.state, 'Backup aberto'); setPending(null); onClose(); }} />
              <Btn small kind="ghost" label="Cancelar" onPress={() => setPending(null)} />
            </Row>
          </View>
        ) : null}
      </Card>

      <Label>Palavras que aprendi com você</Label>
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

      <T v="s" c="faint" style={{ marginTop: 26 }}>
        Peep {APP_VERSION} · versão de teste{speechMode() ? ` · voz: ${speechMode()}` : ''}
      </T>
    </Sheet>
  );
}
