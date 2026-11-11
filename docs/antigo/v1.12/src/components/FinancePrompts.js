// 1.10: as duas perguntas de Finanças, uma de cada vez.
// 1) "Esse é o seu salário de todo mês?" — depois de importar um extrato ou holerite com salário,
//    enquanto você ainda não disse se a sua renda é fixa ou varia.
// 2) "Esse dinheiro é para gastar este mês?" — quando entrou dinheiro de outra conta sua e você
//    ainda não respondeu para este mês. "Sim" põe o valor no "Ainda pode gastar", sem virar renda.
import React, { useState } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, look } from '../theme';
import { useData } from '../store';
import { useUI } from '../uiContext';
import { formatMoney, MONTHS } from '../utils';
import { Button } from '../ui';
import { pendingPrompt } from '../budget';

const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export default function FinancePrompts({ ym, isCurrentMonth, ownAmount, advanced }) {
  const { settings, setBudget, palettes } = useData();
  const { showToast } = useUI();
  const [later, setLater] = useState(false); // "Perguntar depois": só até fechar o app
  const b = settings.budget || {};
  const which = pendingPrompt(b, { ym, isCurrentMonth, ownAmount, advanced, later });
  if (!which) return null;
  const main = palettes.finance.main;
  const month = MONTHS[Number(ym.slice(5, 7)) - 1].toLowerCase();

  const setOwn = (value) => {
    const before = { ...(b.ownMonths || {}) };
    setBudget({ ownMonths: { ...before, [ym]: value } });
    showToast(
      value ? `${formatMoney(ownAmount)} agora contam no limite de ${month}` : `${formatMoney(ownAmount)} ficam fora do limite (reserva)`,
      'Desfazer',
      () => setBudget({ ownMonths: before })
    );
  };

  let body;
  if (which === 'salary') {
    const ask = b.salaryAsk;
    const day = Number(String(ask.date || '').slice(8, 10)) || null;
    body = (
      <View>
        <Text style={st.kicker}>Achei um salário</Text>
        <Text style={st.title}>Esse é o seu salário de todo mês?</Text>
        <Text style={st.text}>
          {formatMoney(ask.amount)} no dia {dm(ask.date)}
          {ask.source && ask.source !== 'já no app' ? ` (${ask.source})` : ''}.
        </Text>
        <Text style={st.help}>Com isso o app sabe quanto você recebe e prevê os próximos meses. O valor pode mudar de um mês para outro.</Text>
        <Button
          title="Sim, recebo todo mês"
          color={main}
          onPress={() => {
            setBudget({ incomeType: 'fixed', salary: ask.amount, salaryDay: day, salaryAsk: null, salaryAskSeen: true });
            showToast(`Salário de ${formatMoney(ask.amount)}${day ? ` todo dia ${day}` : ''}. Dá para mudar em Ajustar orçamento.`);
          }}
        />
        <Text style={st.sub}>CLT, estágio ou contrato</Text>
        <Button
          title="Não, minha renda varia"
          variant="outline"
          color={main}
          onPress={() => {
            setBudget({ incomeType: 'variable', salaryAsk: null, salaryAskSeen: true });
            showToast('O app vai usar a média dos seus meses normais.');
          }}
        />
        <Text style={st.sub}>Autônomo, bicos, comissão</Text>
        <Button title="Agora não" variant="text" color={colors.mute} onPress={() => setBudget({ salaryAsk: null, salaryAskSeen: true })} />
      </View>
    );
  } else {
    body = (
      <View>
        <Text style={st.kicker}>Dinheiro de outra conta sua</Text>
        <Text style={st.title}>Esse dinheiro é para gastar este mês?</Text>
        <Text style={st.text}>
          Entraram {formatMoney(ownAmount)} de outra conta sua em {month}.
        </Text>
        <Text style={st.help}>
          Se for, ele passa a contar no “Ainda pode gastar”. Ele não vira salário: a Sobra do mês continua mostrando só o que você ganhou.
        </Text>
        <Button title="Sim, usar no mês" color={main} onPress={() => setOwn(true)} />
        <View style={{ height: 8 }} />
        <Button title="Não, é reserva" variant="outline" color={main} onPress={() => setOwn(false)} />
        <Button title="Perguntar depois" variant="text" color={colors.mute} onPress={() => setLater(true)} />
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => (which === 'own' ? setLater(true) : setBudget({ salaryAsk: null, salaryAskSeen: true }))}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />
        <View style={[st.card, look.mode === 'simple' && { borderRadius: 6 }]} accessibilityViewIsModal>
          {body}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.bg, borderRadius: 20, padding: 22 },
  kicker: { fontSize: 13, fontWeight: '600', color: colors.mute, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 8, lineHeight: 28 },
  text: { fontSize: 17, color: colors.ink, lineHeight: 24, marginBottom: 6 },
  help: { fontSize: 14, color: colors.mute, lineHeight: 20, marginBottom: 14 },
  sub: { fontSize: 13, color: colors.mute, textAlign: 'center', marginTop: 4, marginBottom: 10 },
});
