// Aba lateral esquerda: perfil (foto, nome, idade) e configurações
import React, { useEffect, useRef, useState } from 'react';
import { speechMode } from './speech';
import { View, Modal, ScrollView, Pressable, Animated, Easing, Share, Alert, Platform, StyleSheet, Dimensions, Linking } from 'react-native';
import { Text } from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look, AREA_LABEL, AREAS } from './theme';
import { useData, LEVELS, LEVEL_LABEL } from './store';
import { useUI } from './uiContext';
import { getExactAlarm, requestExactAlarm, previewAlert, vibrationOff, PREVIEW_SECONDS } from './reminders';
import AboutFields from './components/AboutFields';
import { OCCUPATIONS } from './subjects';
import AlertPreview from './components/AlertPreview';
import { exportBackup, pickBackup, restoreBackup, undoRestore, hasBeforeRestore, backupAge } from './backup';
import { restartApp } from './Root';
import { Avatar, Field, Label, Toggle, Pill } from './ui';

let ImagePicker = null;
let FS = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  ImagePicker = null;
}
try {
  FS = require('expo-file-system');
} catch (e) {
  FS = null;
}

const APP_VERSION = '1.12.3';

function SwitchRow({ label, value, onChange }) {
  return (
    <Pressable
      style={st.switchRow}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
    >
      <Text style={st.switchLabel}>{label}</Text>
      <View style={[st.switch, value && st.switchOn]}>
        <View style={[st.knob, value && st.knobOn]} />
      </View>
    </Pressable>
  );
}

// Copia a foto escolhida para a pasta do app (o arquivo original pode sumir do cache)
function keepPhoto(uri, oldUri) {
  if (!FS || Platform.OS === 'web') return uri;
  try {
    const dest = new FS.File(FS.Paths.document, `perfil-${Date.now()}.jpg`);
    new FS.File(uri).copy(dest);
    if (oldUri && oldUri.startsWith(FS.Paths.document.uri)) {
      try {
        new FS.File(oldUri).delete();
      } catch (e) {
        // a foto antiga já não existe
      }
    }
    return dest.uri;
  } catch (e) {
    return uri;
  }
}

export default function Drawer({ visible, onClose }) {
  const width = Math.min(Dimensions.get('window').width * 0.86, 380);
  const x = useRef(new Animated.Value(-width)).current;
  const [mounted, setMounted] = useState(visible);
  const [preview, setPreview] = useState(null); // contagem do aviso de teste (1.10.1)

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(x, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    } else if (mounted) {
      Animated.timing(x, { toValue: -width, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(
        () => setMounted(false)
      );
    }
  }, [visible]);

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.View style={[st.panel, { width, transform: [{ translateX: x }] }]}>
          <Content onClose={onClose} onPreview={setPreview} />
        </Animated.View>
        <Pressable style={st.overlay} onPress={onClose} accessibilityLabel="Fechar" />
        <AlertPreview preview={preview} onClose={() => setPreview(null)} />
      </View>
    </Modal>
  );
}

function Content({ onClose, onPreview }) {
  const insets = useSafeAreaInsets();
  const {
    settings, updateProfile, setTheme, setLevel, setAutoListen, setShortTitles, setLayout, setAlertStyle,
    misheard, clearMisheard, palettes, simple, setBackupInfo, setVoiceOnDevice, forgetVoice, setTestMode,
  } = useData();
  const [aboutOpen, setAboutOpen] = useState(false);
  const taps = useRef({ n: 0, at: 0 });
  // 5 toques seguidos na versão ligam ou desligam o modo de teste
  const tapVersion = () => {
    const now = Date.now();
    taps.current = now - taps.current.at < 1500 ? { n: taps.current.n + 1, at: now } : { n: 1, at: now };
    if (taps.current.n >= 5) {
      taps.current = { n: 0, at: 0 };
      setTestMode(!settings.testMode);
    }
  };

  const learnedCount = Object.keys((settings.voice && settings.voice.learned) || {}).length;
  const { showToast } = useUI();
  const { profile } = settings;
  const occ = OCCUPATIONS.find((o) => o.key === profile.occupation);
  const aboutSummary = [occ ? (profile.occupation === 'outros' && profile.occupationName ? profile.occupationName : occ.label) : null, profile.state].filter(Boolean).join(' · ');
  const [exact, setExact] = useState(true);

  useEffect(() => {
    getExactAlarm().then(setExact);
  }, []);

  const pickPhoto = async () => {
    if (!ImagePicker) return;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (r.canceled || !r.assets || !r.assets[0]) return;
      updateProfile({ photo: keepPhoto(r.assets[0].uri, profile.photo) });
    } catch (e) {
      Alert.alert('Foto', 'Não foi possível abrir as fotos do aparelho.');
    }
  };

  const askExact = async () => {
    const ok = await requestExactAlarm();
    setExact(ok);
  };



  const shareMisheard = () => {
    const lines = misheard.map((m, i) => {
      const parts = [`${i + 1}. "${m.text}"`];
      if (m.heard && m.heard !== m.text) parts.push(`   o Android ouviu: "${m.heard}"`);
      const others = (m.alts || []).filter((a) => a !== m.text && a !== m.heard);
      if (others.length) parts.push(`   outras versões: ${others.map((a) => `"${a}"`).join(' | ')}`);
      if (m.parsed && m.parsed.length) parts.push(`   o app entendeu: ${m.parsed.join(' | ')}`);
      if (m.fixed && m.fixed.length) parts.push(`   você salvou: ${m.fixed.join(' | ')}`);
      if (m.audio) parts.push('   (áudio guardado no celular)');
      return parts.join('\n');
    });
    Share.share({ message: `Frases que o No Prumo não entendeu:\n\n${lines.join('\n')}` });
  };

  return (
    <ScrollView contentContainerStyle={[st.body, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      {/* Perfil */}
      <View style={st.profileRow}>
        <Pressable onPress={pickPhoto} accessibilityLabel="Trocar foto">
          <Avatar photo={profile.photo} name={profile.name} size={72} />
          <Text style={st.photoHint}>{profile.photo ? 'Trocar foto' : 'Pôr foto'}</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 18 }}>
          <Label>Nome</Label>
          <Field value={profile.name} onChangeText={(v) => updateProfile({ name: v })} placeholder="Seu nome" />
          <Label>Idade</Label>
          <Field
            value={String(profile.age || '')}
            onChangeText={(v) => updateProfile({ age: v.replace(/\D/g, '').slice(0, 3) })}
            placeholder="—"
            keyboardType="number-pad"
            maxLength={3}
          />
          <Pressable onPress={() => setAboutOpen((v) => !v)} style={st.aboutBtn} hitSlop={6} accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }}>
            <Text style={st.aboutBtnText}>{aboutOpen ? 'Fechar ajustes do perfil' : 'Ajustar perfil'}</Text>
            {!aboutOpen && aboutSummary ? <Text style={st.aboutSummary}>{aboutSummary}</Text> : null}
          </Pressable>
        </View>
      </View>

      {aboutOpen ? (
        <View style={st.aboutBox}>
          <AboutFields value={profile} onChange={updateProfile} />
        </View>
      ) : null}

      {/* Visual */}
      <Text style={st.h}>Visual</Text>
      <Toggle
        options={[
          { key: 'simple', label: 'Simples' },
          { key: 'advanced', label: 'Avançado' },
        ]}
        value={settings.layout}
        onChange={(v) => v !== settings.layout && setLayout(v)}
      />
      <Toggle
        options={[
          { key: 'light', label: 'Claro' },
          { key: 'dark', label: 'Escuro' },
        ]}
        value={settings.theme || 'light'}
        onChange={(v) => v !== (settings.theme || 'light') && setTheme(v)}
      />
      <Text style={st.help}>
        {simple
          ? 'Simples: uma coisa por vez, entradas e saídas, sem gráficos.'
          : 'Avançado: cartões coloridos, orçamento, recebimentos, indicadores e Agenda.'}{' '}
        Ao trocar, o app reinicia sozinho.
      </Text>

      {/* Importância */}
      <Text style={st.h}>Importância</Text>
      <Text style={st.help}>Alta: vem primeiro e avisa mais vezes. Em Finanças, avisa mais cedo quando os gastos se aproximam do limite.</Text>
      {AREAS.map((a) => (
        <View key={a} style={st.levelRow}>
          <Text style={st.areaName}>{AREA_LABEL[a]}</Text>
          <Toggle
            color={palettes[a].main}
            options={LEVELS.map((l) => ({ key: l, label: LEVEL_LABEL[l] }))}
            value={settings.levels[a]}
            onChange={(l) => setLevel(a, l)}
          />
        </View>
      ))}

      {/* Avisos */}
      <Text style={st.h}>Avisos</Text>
      <Toggle
        options={[
          { key: 'som', label: 'Som e vibração' },
          { key: 'vibrar', label: 'Só vibração' },
        ]}
        value={settings.alertStyle}
        onChange={async (v) => {
          await setAlertStyle(v);
          const ok = await previewAlert(v); // aviso de teste daqui a 5 s
          // no navegador não há avisos; a contagem aparece mesmo assim só para conferir a tela
          if (!ok && Platform.OS !== 'web') showToast('Permita as notificações do app');
          else onPreview({ style: v, seconds: PREVIEW_SECONDS, key: Date.now(), vibrationOff: await vibrationOff() });
        }}
      />
      <Text style={st.help}>Toque numa opção: em 5 segundos chega um aviso de teste, igual aos lembretes.</Text>
      {Platform.OS === 'android' && !exact ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={st.help}>O Android pode atrasar os avisos. Permita o horário exato.</Text>
          <Pill label="Permitir horário exato" color={colors.ink} onPress={askExact} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {Platform.OS !== 'web' ? (
          <Pill label="Som no Android" color={colors.mute} onPress={() => Linking.openSettings()} />
        ) : null}
      </View>

      {/* Voz */}
      <Text style={st.h}>Voz</Text>
      <SwitchRow label="Títulos curtos (“Remédio diabetes”)" value={settings.shortTitles} onChange={setShortTitles} />
      <SwitchRow label="Começar a ouvir ao tocar no microfone" value={settings.autoListen} onChange={setAutoListen} />
      <SwitchRow label="Reconhecer a voz no próprio celular (quando der)" value={settings.voiceOnDevice !== false} onChange={setVoiceOnDevice} />
      {speechMode() ? <Text style={st.help}>{`Última vez: ${speechMode()}.`}</Text> : null}
      {learnedCount > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Text style={st.help}>
            {`${learnedCount} ${learnedCount === 1 ? 'palavra aprendida' : 'palavras aprendidas'} com as suas correções.`}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Pill
              label="Esquecer"
              color={colors.mute}
              onPress={() =>
                Alert.alert('Esquecer as palavras aprendidas?', 'O app volta a usar só o que o celular ouvir.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Esquecer', style: 'destructive', onPress: forgetVoice },
                ])
              }
            />
          </View>
        </View>
      ) : null}
      <BackupSection settings={settings} setBackupInfo={setBackupInfo} showToast={showToast} />

      {settings.testMode ? (
        <View style={st.testBox}>
          <Text style={st.h}>Modo de teste</Text>
          <Text style={st.help}>
            Só para o período de teste. Quem usar o app não vê esta parte. As frases em que você corrigiu o app ficam aqui; mande
            para o Claude pelo WhatsApp, e-mail ou pelo chat para ele melhorar o app.
          </Text>
          <Text style={st.help}>
            {misheard.length
              ? `${misheard.length} ${misheard.length === 1 ? 'frase guardada' : 'frases guardadas'}.`
              : 'Nenhuma frase guardada ainda.'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {misheard.length ? <Pill label="Mandar as frases" color={colors.ink} filled onPress={shareMisheard} /> : null}
            {misheard.length ? <View style={{ width: 10 }} /> : null}
            {misheard.length ? (
              <Pill
                label="Limpar"
                color={colors.mute}
                onPress={() =>
                  Alert.alert('Limpar frases guardadas?', '', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Limpar', style: 'destructive', onPress: clearMisheard },
                  ])
                }
              />
            ) : null}
          </View>
          <Pressable onPress={() => setTestMode(false)} hitSlop={8} style={{ marginTop: 12 }}>
            <Text style={st.testOff}>Sair do modo de teste</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable onPress={tapVersion} hitSlop={8} accessibilityLabel={`Versão ${APP_VERSION}`}>
        <Text style={st.version}>No Prumo {APP_VERSION}{settings.testMode ? ' · modo de teste' : ''}</Text>
      </Pressable>
      <Pressable onPress={onClose} style={st.closeBtn} hitSlop={10}>
        <Text style={st.closeText}>Fechar</Text>
      </Pressable>
    </ScrollView>
  );
}

// 1.11: guardar tudo num arquivo e trazer de volta (no mesmo celular ou num novo)
function BackupSection({ settings, setBackupInfo, showToast }) {
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    hasBeforeRestore().then(setCanUndo);
  }, []);
  const info = settings.backup || {};
  const age = backupAge(info.lastAt);
  const when = age === null ? 'Você ainda não fez nenhum backup.' : age === 0 ? 'Último backup: hoje.' : age === 1 ? 'Último backup: ontem.' : `Último backup: há ${age} dias.`;
  const late = age === null || age > 14;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const save = async () => {
    setBusy(true);
    const r = await exportBackup({ appVersion: APP_VERSION });
    setBusy(false);
    if (r.canceled) return;
    if (r.error) {
      showToast(r.error);
      return;
    }
    setBackupInfo({ lastAt: new Date().toISOString(), lastName: r.name });
    showToast('Backup salvo: ' + r.name);
  };

  const restore = async () => {
    const r = await pickBackup();
    if (r.canceled) return;
    if (!r.ok) {
      Alert.alert('Não deu para restaurar', r.error || 'Arquivo inválido.');
      return;
    }
    const c = r.backup.counts;
    const made = r.backup.createdAt ? new Date(r.backup.createdAt) : null;
    const date = made ? `${String(made.getDate()).padStart(2, '0')}/${String(made.getMonth() + 1).padStart(2, '0')}/${made.getFullYear()}` : 'data desconhecida';
    const go = async () => {
      setBusy(true);
      try {
        await restoreBackup(r.backup);
        await restartApp();
      } catch (e) {
        setBusy(false);
        Alert.alert('Não deu para restaurar', 'Nada foi mudado. Tente de novo.');
      }
    };
    Alert.alert(
      'Restaurar este backup?',
      `Backup de ${date}: ${plural(c.tasks, 'tarefa', 'tarefas')}, ${plural(c.study, 'item de estudo', 'itens de estudo')}, ${plural(c.finance, 'lançamento', 'lançamentos')} e ${plural(c.accounts, 'conta', 'contas')}${c.subjects ? ` e ${plural(c.subjects, 'matéria', 'matérias')}` : ''}.\n\nTudo o que está no app agora será trocado por ele. Antes, o app guarda uma cópia do que existe hoje, e você pode voltar em Ajustes → Backup.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', style: 'destructive', onPress: go },
      ]
    );
  };

  const undo = () =>
    Alert.alert('Voltar ao que você tinha?', 'O app volta a como estava antes da última restauração.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Voltar',
        onPress: async () => {
          if (await undoRestore()) await restartApp();
        },
      },
    ]);

  return (
    <>
      <Text style={st.h}>Backup</Text>
      <Text style={st.help}>
        Seus dados ficam só neste celular. Salve um arquivo de backup (em Downloads ou no Drive) para não perder nada se trocar ou perder o celular.
      </Text>
      <Text style={[st.help, late && { color: colors.ink, fontWeight: '700' }]}>{when}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Pill label={busy ? 'Aguarde…' : 'Salvar backup'} color={colors.ink} filled onPress={busy ? undefined : save} />
        <View style={{ width: 10 }} />
        <Pill label="Restaurar" color={colors.mute} onPress={busy ? undefined : restore} />
      </View>
      {canUndo ? (
        <Pressable onPress={undo} hitSlop={8} style={{ marginTop: 10 }}>
          <Text style={[st.help, { textDecorationLine: 'underline', marginBottom: 0 }]}>Voltar ao que eu tinha antes de restaurar</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: colors.bg, height: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  body: { paddingHorizontal: 22 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  photoHint: { fontSize: 12, color: colors.mute, textAlign: 'center', marginTop: 6, fontWeight: '600' },
  h: { fontSize: look.mode === 'simple' ? 18 : 20, fontWeight: look.mode === 'simple' ? '500' : '700', color: colors.ink, marginTop: 22, marginBottom: 4 },
  help: { fontSize: 13, color: colors.mute, lineHeight: 19, marginBottom: 10 },
  levelRow: { marginBottom: 2 },
  areaName: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  harmony: { fontWeight: '500', color: colors.mute },
  tempRow: { flexDirection: 'row' },
  tempOpt: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  swatches: { flexDirection: 'row', marginBottom: 6 },
  swatch: { width: 16, height: 16, borderRadius: 8, marginHorizontal: 2 },
  tempLabel: { fontSize: 12, fontWeight: '700', color: colors.mute },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  switchLabel: { fontSize: 15, color: colors.ink, flex: 1, marginRight: 12 },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.line, padding: 3 },
  switchOn: { backgroundColor: colors.ink },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.card },
  knobOn: { transform: [{ translateX: 18 }] },
  version: { fontSize: 12, color: colors.mute, marginTop: 28, paddingVertical: 6 },
  aboutBtn: { marginTop: 14, minHeight: 44, justifyContent: 'center' },
  aboutBtnText: { fontSize: 15, fontWeight: '600', color: colors.ink, textDecorationLine: 'underline' },
  aboutSummary: { fontSize: 13, color: colors.mute, marginTop: 2 },
  aboutBox: { marginTop: 4, marginBottom: 8 },
  testBox: { marginTop: 8 },
  testOff: { fontSize: 14, color: colors.mute, textDecorationLine: 'underline' },
  closeBtn: { marginTop: 10 },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
