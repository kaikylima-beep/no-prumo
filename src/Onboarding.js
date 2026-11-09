// Primeira abertura (só para quem instala do zero).
// Cinco passos curtos: nome, sobre você (1.12), como o app funciona, qual visual usar e avisos.
// O texto foi escrito para quem nunca usou um app de organização.
import React, { useState } from 'react';
import { View, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, look, AREA_PAL, previewTheme } from './theme';
import { useData } from './store';
import { requestNotifications, requestExactAlarm } from './reminders';
import { Button, Field, MicButton, Toggle } from './ui';
import AboutFields from './components/AboutFields';

const STEPS = 5;
const PAL = AREA_PAL;

export default function Onboarding({ visible }) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <SafeAreaProvider>{visible ? <Steps /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function Steps() {
  const insets = useSafeAreaInsets();
  const { finishOnboarding } = useData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState(null);
  const [theme, setTheme] = useState('light');
  const [allowed, setAllowed] = useState(null);
  const [about, setAbout] = useState({ occupation: null, occupationName: '', state: null });

  const allow = async () => {
    const ok = await requestNotifications();
    if (ok) await requestExactAlarm();
    setAllowed(!!ok);
  };

  const finish = () => finishOnboarding({ name, layout: layout || 'simple', theme, about });
  const first = name.trim().split(/\s+/)[0];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[st.body, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.progress} accessibilityLabel={`Passo ${step + 1} de ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[st.bar, i <= step && st.barOn]} />
          ))}
        </View>
        <Text style={st.stepNo}>Passo {step + 1} de {STEPS}</Text>

        {step === 0 ? (
          <View>
            <Text style={st.h1}>Olá!</Text>
            <Text style={st.p}>
              Este app guarda as coisas que você não pode esquecer: tarefas de casa, contas e provas. Você fala, ele anota e te
              avisa na hora certa.
            </Text>
            <Text style={st.label}>Como posso te chamar?</Text>
            <Field value={name} onChangeText={setName} placeholder="Seu primeiro nome" autoFocus returnKeyType="next" onSubmitEditing={() => setStep(1)} />
            <View style={{ height: 20 }} />
            <Button title="Continuar" onPress={() => setStep(1)} />
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={st.h1}>Sobre você</Text>
            <Text style={st.p}>Duas perguntas rápidas. Dá para mudar depois em Ajustes.</Text>
            <AboutFields value={about} onChange={(p) => setAbout((a) => ({ ...a, ...p }))} />
            <View style={{ height: 12 }} />
            <Button title="Continuar" onPress={() => setStep(2)} />
            <Button title="Voltar" variant="text" onPress={() => setStep(0)} />
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={st.h1}>{first ? `${first}, é assim que funciona` : 'É assim que funciona'}</Text>
            <Text style={st.p}>Toque no botão redondo do meio e fale normalmente. O app separa cada coisa no lugar certo.</Text>
            <View style={st.micDemo}>
              <MicButton size={56} onPress={() => {}} />
            </View>
            <Example area="task" label="Tarefas" say="lavar a louça hoje às 20h" result="Lembrete às 20h, com aviso" />
            <Example area="finance" label="Finanças" say="paguei a conta de luz 180" result="Saída de R$ 180 em Contas" />
            <Example area="study" label="Estudos" say="prova de cálculo dia 27" result="Contagem regressiva e avisos antes" />
            <Text style={st.small}>Antes de salvar, você sempre confere o que o app entendeu.</Text>
            <View style={{ height: 20 }} />
            <Button title="Entendi" onPress={() => setStep(3)} />
            <Button title="Voltar" variant="text" onPress={() => setStep(1)} />
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text style={st.h1}>Escolha o visual</Text>
            <Text style={st.p}>
              São dois jeitos de ver o mesmo app. Tudo o que você salvar continua lá se trocar depois.
            </Text>
            <LayoutCard
              kind="simple"
              title="Simples"
              who="Para quem quer só anotar e ser lembrado."
              points={['Calmo: uma coisa por vez', 'Entradas e saídas, sem gráficos', 'Botão "Menu" na barra de baixo']}
              theme={theme}
              active={layout === 'simple'}
              onPress={() => setLayout('simple')}
            />
            <LayoutCard
              kind="advanced"
              title="Avançado"
              who="Para quem quer acompanhar tudo de perto."
              points={['Cartões coloridos: azul, verde e roxo', 'Agenda, orçamento e indicadores', 'Recebimentos separados']}
              theme={theme}
              active={layout === 'advanced'}
              onPress={() => setLayout('advanced')}
            />
            <Text style={st.label}>Claro ou escuro?</Text>
            <Toggle
              options={[
                { key: 'light', label: 'Claro' },
                { key: 'dark', label: 'Escuro' },
              ]}
              value={theme}
              onChange={setTheme}
            />
            <View style={st.tip}>
              <Text style={st.tipText}>
                <Text style={{ fontWeight: '700' }}>Na dúvida, comece pelo Simples.</Text> Dá para trocar a qualquer hora em
                Ajustes → Visual.
              </Text>
            </View>
            <Button title={layout ? 'Continuar' : 'Escolha uma opção acima'} onPress={() => setStep(4)} disabled={!layout} />
            <Button title="Voltar" variant="text" onPress={() => setStep(2)} />
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <Text style={st.h1}>Avisos</Text>
            <Text style={st.p}>
              Para te lembrar das provas, contas e remédios, o app precisa mandar avisos, como uma mensagem que aparece no topo da
              tela.
            </Text>
            <View style={st.fakeNotif}>
              <Text style={st.fakeApp}>No Prumo · agora</Text>
              <Text style={st.fakeTitle}>Tomar remédio</Text>
              <Text style={st.fakeBody}>Hoje às 20:00</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Text style={st.fakeAction}>FEITO</Text>
                <Text style={st.fakeAction}>ADIAR 10 MIN</Text>
              </View>
            </View>
            <Text style={st.small}>No próprio aviso você toca em "Feito", sem abrir o app.</Text>
            <View style={{ height: 16 }} />
            {allowed === true ? (
              <Text style={st.ok}>✓ Avisos permitidos</Text>
            ) : (
              <Button title="Permitir avisos" variant="outline" onPress={allow} />
            )}
            {allowed === false ? (
              <Text style={st.warn}>Sem permissão, os lembretes não aparecem. Dá para permitir depois nos ajustes do Android.</Text>
            ) : null}
            <View style={{ height: 16 }} />
            <Button title="Começar a usar" onPress={finish} />
            <Button title="Voltar" variant="text" onPress={() => setStep(3)} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Example({ area, label, say, result }) {
  const c = PAL[area].main;
  return (
    <View style={st.ex}>
      <View style={[st.tag, { backgroundColor: PAL[area].tint }]}>
        <Text style={[st.tagText, { color: c }]}>{label}</Text>
      </View>
      <Text style={st.exSay}>“{say}”</Text>
      <Text style={st.exResult}>→ {result}</Text>
    </View>
  );
}

// Cartão de escolha com uma miniatura fiel ao visual (nas cores claro/escuro escolhidas)
function LayoutCard({ kind, title, who, points, active, onPress, theme }) {
  const simple = kind === 'simple';
  const { c, a, shape } = previewTheme(kind, theme);
  return (
    <Pressable
      onPress={onPress}
      style={[st.card, active && st.cardOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}. ${who} ${points.join('. ')}`}
    >
      <View style={st.cardTop}>
        <View style={[st.radio, active && st.radioOn]}>{active ? <View style={st.radioDot} /> : null}</View>
        <Text style={st.cardTitle}>{title}</Text>
      </View>
      <Text style={st.who}>{who}</Text>
      <View style={st.cardBody}>
        <View style={[st.phone, { backgroundColor: c.bg, borderColor: c.line }]}>
          {simple ? (
            <View style={{ backgroundColor: a.finance.tint, borderRadius: 2, padding: 5, marginBottom: 5 }}>
              <View style={[st.miniLine, { width: 22, backgroundColor: a.finance.main, height: 3 }]} />
              <View style={[st.miniLine, { width: 40, backgroundColor: c.ink, marginTop: 4 }]} />
            </View>
          ) : (
            <View style={{ backgroundColor: a.task.heroBg, borderRadius: 7, padding: 6, marginBottom: 5 }}>
              <View style={[st.miniLine, { width: 14, height: 8, backgroundColor: a.task.heroInk }]} />
              <View style={[st.miniLine, { width: 36, backgroundColor: a.task.heroSoft, marginTop: 4, opacity: 0.8, height: 3 }]} />
            </View>
          )}
          {[a.task, a.finance, a.study].map((p, i) => (
            <View
              key={i}
              style={[
                st.miniRow,
                simple
                  ? { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 3 }
                  : { backgroundColor: c.card, borderRadius: 5, padding: 3, borderWidth: 1, borderColor: c.line },
              ]}
            >
              <View style={[st.miniCheck, { borderColor: p.main, borderRadius: simple ? 1 : 5 }]} />
              <View style={[st.miniLine, { width: [34, 26, 30][i], backgroundColor: c.mute, opacity: 0.6 }]} />
            </View>
          ))}
          <View style={[st.miniTabs, { borderTopColor: c.line }]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  st.miniTab,
                  { backgroundColor: c.mute },
                  i === 0 && { backgroundColor: a.task.main },
                  i === 2 && { width: shape.mic / 6, height: shape.mic / 6, borderRadius: 6, backgroundColor: '#12151C', borderWidth: 1.5, borderColor: a.finance.main },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {points.map((p) => (
            <Text key={p} style={st.point}>
              • {p}
            </Text>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 24 },
  progress: { flexDirection: 'row', marginBottom: 8 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line, marginRight: 6 },
  barOn: { backgroundColor: colors.ink },
  stepNo: { fontSize: 12, color: colors.mute, fontWeight: '600', marginBottom: 24 },
  h1: { fontSize: look.mode === 'simple' ? 26 : 30, fontWeight: look.mode === 'simple' ? '500' : '700', color: colors.ink, letterSpacing: -0.5, marginBottom: 10 },
  p: { fontSize: 16, color: colors.mute, lineHeight: 23, marginBottom: 20 },
  small: { fontSize: 13, color: colors.mute, lineHeight: 19, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },

  micDemo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  micBall: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  micText: { fontSize: 14, color: colors.mute },
  ex: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, marginBottom: 10 },
  tag: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  tagText: { fontSize: 12, fontWeight: '800' },
  exSay: { fontSize: 16, fontWeight: '600', color: colors.ink },
  exResult: { fontSize: 13, color: colors.mute, marginTop: 3 },

  card: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 18, padding: 14, marginBottom: 12 },
  cardOn: { borderColor: colors.ink, backgroundColor: colors.card },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.mute, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ink },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  who: { fontSize: 14, color: colors.mute, marginTop: 4, marginLeft: 32 },
  cardBody: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
  point: { fontSize: 13, color: colors.ink, lineHeight: 20 },
  phone: { width: 92, borderRadius: 12, padding: 7, borderWidth: 1 },
  miniRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  miniCheck: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, marginRight: 5 },
  miniLine: { height: 5, borderRadius: 3 },
  miniTabs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 5, borderTopWidth: 1 },
  miniTab: { width: 6, height: 6, borderRadius: 3 },

  tip: { backgroundColor: colors.soft, borderRadius: 14, padding: 12, marginBottom: 18, marginTop: 4 },
  tipText: { fontSize: 14, color: colors.ink, lineHeight: 20 },

  fakeNotif: { backgroundColor: colors.soft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line },
  fakeApp: { fontSize: 11, color: colors.mute, fontWeight: '600' },
  fakeTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 4 },
  fakeBody: { fontSize: 13, color: colors.mute, marginTop: 2 },
  fakeAction: { fontSize: 12, fontWeight: '800', color: PAL.task.main, marginRight: 18 },
  ok: { fontSize: 16, fontWeight: '700', color: colors.ink, marginVertical: 12 },
  warn: { fontSize: 13, color: colors.mute, lineHeight: 19, marginTop: 10 },
});
