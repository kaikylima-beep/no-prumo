// Editor do orçamento: tipo de renda e salário (1.10), quanto guardar por mês, extras e dinheiro de outras contas
import React, { useEffect, useState } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors } from '../theme';
import { useData } from '../store';
import { parseMoney } from '../utils';
import { Button, Field, Label, Toggle } from '../ui';

const toText = (n) => (n ? (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',') : '');

export default function BudgetEditor({ visible, onClose }) {
  const { settings, setBudget, palettes } = useData();
  const [salary, setSalary] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [extras, setExtras] = useState(false);
  const [incomeType, setIncomeType] = useState(null);
  const [day, setDay] = useState('');
  const [useOwn, setUseOwn] = useState('ask');

  useEffect(() => {
    if (visible) {
      setSalary(toText(settings.budget.salary));
      setTarget(toText(settings.budget.target));
      setExtras(!!settings.budget.countExtras);
      setIncomeType(settings.budget.incomeType || null);
      setDay(settings.budget.salaryDay ? String(settings.budget.salaryDay) : '');
      setUseOwn(settings.budget.useOwn || 'ask');
      setError('');
    }
  }, [visible]);

  const save = () => {
    const s = salary.trim() ? parseMoney(salary) : null;
    const t = target.trim() ? parseMoney(target) : null;
    if (salary.trim() && (s === null || s <= 0)) return setError('Salário inválido. Exemplo: 3000');
    if (target.trim() && (t === null || t < 0)) return setError('Valor para guardar inválido. Exemplo: 500');
    const d = day.trim() ? Number(day.trim()) : null;
    if (day.trim() && (!Number.isInteger(d) || d < 1 || d > 31)) return setError('Dia do salário inválido. Exemplo: 5');
    // trocar a regra do dinheiro de outras contas vale a partir de agora: as respostas de cada mês ficam como estão
    setBudget({ salary: s, target: t, countExtras: extras, incomeType, salaryDay: d, useOwn });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={st.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ScrollView style={st.card} contentContainerStyle={{ padding: 22 }} keyboardShouldPersistTaps="handled">
          <Text style={st.title}>Orçamento do mês</Text>
          <Text style={st.help}>Com isso o app mostra quanto ainda dá para gastar e avisa quando você estiver gastando demais.</Text>
          <Label>Sua renda</Label>
          <Toggle
            color={palettes.finance.main}
            options={[
              { key: 'fixed', label: 'Todo mês' },
              { key: 'variable', label: 'Varia' },
            ]}
            value={incomeType}
            onChange={setIncomeType}
          />
          <Text style={st.help}>
            {incomeType === 'fixed'
              ? 'CLT, estágio ou contrato: o app prevê os próximos meses com o seu salário.'
              : incomeType === 'variable'
              ? 'Autônomo, bicos, comissão: o app prevê com a média dos meses normais, em faixa.'
              : 'Escolha para o app saber como prever os próximos meses.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Label>{incomeType === 'variable' ? 'Renda base (R$)' : 'Salário (R$)'}</Label>
              <Field value={salary} onChangeText={setSalary} keyboardType="decimal-pad" placeholder="3000" />
            </View>
            {incomeType !== 'variable' ? (
              <View style={{ flex: 1 }}>
                <Label>Cai no dia</Label>
                <Field value={day} onChangeText={setDay} keyboardType="number-pad" placeholder="5" />
              </View>
            ) : null}
          </View>
          <Label>Guardar por mês (R$)</Label>
          <Field value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="500" />
          <Label>Extras (Pix de alguém, reembolso, rendimento)</Label>
          <Toggle
            color={palettes.finance.main}
            options={[
              { key: 'no', label: 'Fora do limite' },
              { key: 'yes', label: 'Somam no limite' },
            ]}
            value={extras ? 'yes' : 'no'}
            onChange={(v) => setExtras(v === 'yes')}
          />
          <Text style={st.help}>
            Fora do limite: o que pode gastar no mês vem só do salário, e os extras aparecem à parte em Recebimentos.
          </Text>
          <Label>Dinheiro de outras contas suas</Label>
          <Toggle
            color={palettes.finance.main}
            options={[
              { key: 'ask', label: 'Perguntar' },
              { key: 'always', label: 'Usar no mês' },
              { key: 'never', label: 'Reserva' },
            ]}
            value={useOwn}
            onChange={setUseOwn}
          />
          <Text style={st.help}>Pix seu vindo de outra conta entra no saldo, mas não é renda. "Usar no mês" põe esse valor no que ainda pode gastar.</Text>
          {error ? <Text style={st.error}>{error}</Text> : null}
          <Button title="Salvar" color={palettes.finance.main} onPress={save} />
          <Button title="Cancelar" variant="text" onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.bg, borderRadius: 20, flexGrow: 0, maxHeight: '92%' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  help: { fontSize: 14, color: colors.mute, lineHeight: 20, marginBottom: 8 },
  error: { fontSize: 13, color: colors.warn, marginBottom: 10 },
});
