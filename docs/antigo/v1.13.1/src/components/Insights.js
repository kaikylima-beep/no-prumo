// Indicadores (visual avançado): botão no topo de Finanças, ao lado da foto.
// Quanto está gastando x meses anteriores, quanto deveria ter guardado, o que mais subiu
// (cartão e categorias), para onde o saldo vai se continuar assim e de onde veio o saldo de hoje.
import React from 'react';
import { View, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { colors, look } from '../theme';
import { useData } from '../store';
import { showMoney as formatMoney, todayISO, privacy } from '../utils';
import { financeInsights, monthName, monthShort } from '../insights';
import { Hero, heroText, Card, Icon, Chip } from '../ui';

const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
const signedMoney = (v) => `${v < 0 ? '− ' : '+ '}${formatMoney(Math.abs(v || 0))}`;

export default function InsightsModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>{visible ? <Body onClose={onClose} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function Line({ label, value, strong, sign, muted }) {
  return (
    <View style={st.line}>
      <Text style={[st.lineLabel, muted && { color: colors.mute }]}>{label}</Text>
      <Text style={[st.lineValue, strong && st.lineStrong, muted && { color: colors.mute }]}>
        {sign ? `${sign} ` : ''}
        {formatMoney(value)}
      </Text>
    </View>
  );
}

function Bars({ data, color, soft, highlight }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <View style={st.bars}>
      {data.map((d, i) => {
        const on = i === highlight;
        return (
          <View key={d.key} style={st.barCol}>
            <Text style={[st.barValue, on && { color: colors.ink, fontWeight: '700' }]} numberOfLines={1}>
              {d.value && !privacy.hidden ? (Math.abs(d.value) >= 1000 ? `${(d.value / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(d.value)) : ''}
            </Text>
            <View style={[st.bar, { height: Math.max(3, (Math.abs(d.value) / max) * 90), backgroundColor: d.value < 0 ? colors.warn : on ? color : soft }]} />
            <Text style={[st.barLabel, on && { color: colors.ink, fontWeight: '700' }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Body({ onClose }) {
  const insets = useSafeAreaInsets();
  const { finance, accounts, settings, palettes, tone, setBudget } = useData();
  const pal = palettes.finance;
  const today = todayISO();
  const ins = financeInsights(finance, accounts, settings.budget, today);
  const { pace, saving, rises, card, projection, bridge } = ins;
  const ht = heroText('finance');
  const up = pace.pct !== null && pace.diff > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.kicker}>{monthName(ins.ym)} · até o dia {pace.day}</Text>
          <Text style={st.title}>Indicadores</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={6} style={st.close} accessibilityRole="button" accessibilityLabel="Fechar indicadores">
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 32 }]}>
        {!ins.enough ? (
          <Card>
            <Text style={st.cardTitle}>Ainda não dá para comparar</Text>
            <Text style={st.help}>
              Os indicadores comparam este mês com os anteriores. Importe o extrato de um mês passado (Finanças → Importar extrato) ou continue lançando: no
              mês que vem eles aparecem.
            </Text>
          </Card>
        ) : null}

        {/* 1) quanto está gastando */}
        <Hero area="finance">
          <Text style={[st.heroLabel, { color: ht.label }]}>Gasto até hoje</Text>
          <Text style={[st.heroValue, { color: ht.ink }]}>{formatMoney(pace.spentSoFar)}</Text>
          {ins.enough ? (
            <Text style={[st.heroNote, { color: ht.soft }]}>
              {pace.avgSoFar > 0
                ? up
                  ? `${pct(pace.pct)} a mais que nos meses anteriores até o dia ${pace.day} (média ${formatMoney(pace.avgSoFar)}).`
                  : `${pct(pace.pct || 0)} a menos que nos meses anteriores até o dia ${pace.day} (média ${formatMoney(pace.avgSoFar)}).`
                : `Nos meses anteriores, até o dia ${pace.day}, não havia gastos.`}
            </Text>
          ) : null}
          {ins.enough ? (
            <View style={st.tiles}>
              <View style={[st.tile, { backgroundColor: ht.tile }]}>
                <Text style={[st.tileLabel, { color: ht.soft }]}>Média por mês</Text>
                <Text style={[st.tileValue, { color: ht.ink }]}>{formatMoney(pace.avgMonth)}</Text>
              </View>
              <View style={[st.tile, { backgroundColor: ht.tile }]}>
                <Text style={[st.tileLabel, { color: ht.soft }]}>Fim do mês, se seguir</Text>
                <Text style={[st.tileValue, { color: ht.ink }]}>{formatMoney(pace.projected)}</Text>
              </View>
            </View>
          ) : null}
        </Hero>

        {/* histórico */}
        {ins.history.length > 1 ? (
          <Card>
            <Text style={st.cardTitle}>Gastos por mês</Text>
            <Bars
              data={ins.history.map((h) => ({ key: h.ym, label: monthShort(h.ym), value: h.spend }))}
              color={pal.main}
              soft={pal.third}
              highlight={ins.history.length - 1}
            />
            <Text style={st.small}>O mês atual ainda não terminou: compare pela linha "até o dia {pace.day}" acima.</Text>
          </Card>
        ) : null}

        {/* 2) quanto deveria ter guardado */}
        {saving.months ? (
          <Card>
            <Text style={st.cardTitle}>Quanto deveria ter guardado</Text>
            <Text style={st.help}>
              Nos últimos {saving.months === 1 ? 'mês' : `${saving.months} meses`}, entrou mais do que saiu em{' '}
              <Text style={{ fontWeight: '700', color: saving.leftover < 0 ? tone.warn : colors.ink }}>{formatMoney(saving.leftover)}</Text>
              {saving.leftover < 0 ? ' (saiu mais do que entrou).' : ` — uns ${formatMoney(saving.perMonth)} por mês.`}
            </Text>
            {saving.goal !== null ? <Line label={`Sua meta (${formatMoney(settings.budget.target)} por mês)`} value={saving.goal} /> : null}
            {saving.savedReal !== null ? <Line label="Foi para poupança e investimentos" value={saving.savedReal} strong /> : null}
            {saving.goal !== null && saving.leftover < saving.goal ? (
              <Text style={[st.small, { color: tone.warn }]}>Faltaram {formatMoney(saving.goal - Math.max(0, saving.leftover))} para bater a meta nesses meses.</Text>
            ) : null}
            {saving.goalSoFar !== null ? (
              <Text style={st.small}>
                Neste mês, pela meta, até hoje já deveriam estar separados {formatMoney(saving.goalSoFar)}.
              </Text>
            ) : null}
            {saving.savedReal === null ? (
              <Text style={st.small}>Cadastre sua poupança como conta (tipo Poupança) para ver quanto foi guardado de verdade.</Text>
            ) : null}
          </Card>
        ) : null}

        {/* 3) o que mais subiu */}
        {ins.enough ? (
          <Card>
            <Text style={st.cardTitle}>O que mais subiu</Text>
            <Text style={st.small}>Comparando até o dia {pace.day} com os meses anteriores, até o mesmo dia.</Text>
            {card.now > 0 || card.avg > 0 ? (
              <View style={st.rise}>
                <Text style={st.riseName}>{card.hasCard ? 'No cartão' : 'Fatura do cartão'}</Text>
                <Text style={[st.riseValue, card.diff > 0 && { color: tone.warn }]}>
                  {card.diff > 0 ? '+' : card.diff < 0 ? '−' : ''} {formatMoney(Math.abs(card.diff))}
                </Text>
                <Text style={st.riseMeta}>
                  {formatMoney(card.now)} agora · média {formatMoney(card.avg)}
                </Text>
              </View>
            ) : null}
            {rises.length ? (
              rises.map((r) => (
                <View key={r.category} style={st.rise}>
                  <Text style={st.riseName}>{r.category}</Text>
                  <Text style={[st.riseValue, { color: tone.warn }]}>+ {formatMoney(r.diff)}</Text>
                  <Text style={st.riseMeta}>
                    {formatMoney(r.now)} agora · média {formatMoney(r.avg)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[st.help, { marginTop: 8 }]}>Nenhuma categoria subiu muito. Bom sinal.</Text>
            )}
          </Card>
        ) : null}

        {/* 4) se continuar assim (1.10: pelo tipo de renda; meses fora do comum não contam) */}
        {projection.history.length ? (
          <Card>
            <Text style={st.cardTitle}>Se continuar assim</Text>
            {projection.ready ? (
              <View>
                {projection.profile === 'fixed' ? (
                  <Text style={st.help}>
                    Salário de todo mês {formatMoney(projection.monthlyIncome)} − gasto médio {formatMoney(projection.avgSpend)} ={' '}
                    <Text style={{ fontWeight: '700', color: projection.monthlyNet < 0 ? tone.warn : colors.ink }}>
                      {projection.monthlyNet < 0 ? '−' : '+'} {formatMoney(Math.abs(projection.monthlyNet))} por mês
                    </Text>
                    {settings.budget.countExtras ? ' (com os extras)' : ''}.
                  </Text>
                ) : (
                  <Text style={st.help}>
                    Sua renda varia: na média dos meses normais {projection.monthlyNet < 0 ? 'faltam' : 'sobram'}{' '}
                    <Text style={{ fontWeight: '700', color: projection.monthlyNet < 0 ? tone.warn : colors.ink }}>
                      {formatMoney(Math.abs(projection.monthlyNet))} por mês
                    </Text>
                    , entre {signedMoney(projection.low)} no pior mês e {signedMoney(projection.high)} no melhor.
                  </Text>
                )}
                {projection.base === 'accounts' ? (
                  <View>
                    <Bars
                      data={[{ key: 'fim', label: monthShort(ins.ym), value: projection.endOfMonth }, ...projection.ahead.map((a) => ({ key: a.ym, label: monthShort(a.ym), value: a.value }))]}
                      color={pal.main}
                      soft={pal.third}
                      highlight={3}
                    />
                    <Text style={st.small}>
                      Dinheiro nas contas no fim de cada mês. Em {projection.ahead[2].label.toLowerCase()}:{' '}
                      {projection.profile === 'variable'
                        ? `entre ${formatMoney(projection.ahead[2].low)} e ${formatMoney(projection.ahead[2].high)}`
                        : formatMoney(projection.ahead[2].value)}
                      .{projection.debtTaken ? ` Já descontada a fatura em aberto (${formatMoney(projection.debtTaken)}).` : ''} É uma estimativa, não uma promessa.
                    </Text>
                  </View>
                ) : (
                  <Text style={st.small}>
                    Em 3 meses: {projection.monthlyNet < 0 ? '−' : '+'} {formatMoney(Math.abs(projection.monthlyNet * 3))}. Cadastre suas contas para ver o saldo previsto.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={st.help}>
                {projection.profile === 'variable'
                  ? `Ainda não dá para prever: com renda que varia, o app precisa de pelo menos ${projection.minMonths} meses normais.`
                  : 'Ainda não dá para prever: falta pelo menos 1 mês normal com lançamentos.'}
              </Text>
            )}
            <Text style={[st.small, { marginTop: 10 }]}>
              Meses na média (toque para tirar um mês fora do comum, como um com salário em dobro):
            </Text>
            <View style={st.chips}>
              {projection.history.map((m) => (
                <Chip
                  key={m.ym}
                  label={m.skip ? `${m.label} · não conta` : m.label}
                  color={pal.main}
                  active={!m.skip}
                  onPress={() => {
                    const cur = new Set(settings.budget.skipMonths || []);
                    if (cur.has(m.ym)) cur.delete(m.ym);
                    else cur.add(m.ym);
                    setBudget({ skipMonths: [...cur].sort() });
                  }}
                />
              ))}
            </View>
            {!settings.budget.incomeType ? (
              <Text style={st.small}>Diga em Ajustar orçamento se a sua renda é de todo mês ou varia: a previsão muda.</Text>
            ) : null}
          </Card>
        ) : null}

        {/* 5) de onde veio o saldo */}
        {bridge ? (
          <Card>
            <Text style={st.cardTitle}>De onde veio o saldo de hoje</Text>
            <Text style={st.small}>Só as contas (sem cartão). Transferência entre duas contas suas não muda o total.</Text>
            <View style={{ marginTop: 8 }}>
              <Line label={`Saldo no início de ${monthName(ins.ym).toLowerCase()}`} value={bridge.start} />
              <Line label="Entradas" value={bridge.incomes} sign="+" />
              <Line label="Saídas" value={bridge.outs} sign="−" />
              {bridge.cardPay ? <Line label="Faturas pagas" value={bridge.cardPay} sign="−" /> : null}
              {bridge.extIn ? <Line label="Vindo de contas fora do app" value={bridge.extIn} sign="+" /> : null}
              {bridge.extOut ? <Line label="Para contas fora do app" value={bridge.extOut} sign="−" /> : null}
              <View style={st.sep} />
              <Line label="Saldo hoje" value={bridge.end} strong />
              {bridge.internal ? <Line label="Movido entre suas contas" value={bridge.internal} sign="⇄" muted /> : null}
            </View>
          </Card>
        ) : null}

        {/* recebimentos */}
        <Card>
          <Text style={st.cardTitle}>Recebimentos do mês</Text>
          <Line label="Salário" value={ins.receipts.totals.salary} sign="+" />
          <Line label="Extras" value={ins.receipts.totals.extra} sign="+" />
          <Line label="De outras contas suas (não é renda)" value={ins.receipts.totals.own} sign="⇄" muted />
        </Card>
      </ScrollView>
    </View>
  );
}

const SIMPLE = look.mode === 'simple';
const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  kicker: { fontSize: 15, color: colors.mute },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink, letterSpacing: -0.6 },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 6 },
  heroLabel: { fontSize: 15 },
  heroValue: { fontSize: 44, fontWeight: '700', letterSpacing: -1, marginTop: 2 },
  heroNote: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  tiles: { flexDirection: 'row', marginTop: 14 },
  tile: { flex: 1, borderRadius: SIMPLE ? 4 : 14, paddingVertical: 10, paddingHorizontal: 12, marginRight: 10 },
  tileLabel: { fontSize: 13 },
  tileValue: { fontSize: 19, fontWeight: '600', marginTop: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  help: { fontSize: 14, color: colors.mute, lineHeight: 20 },
  small: { fontSize: 13, color: colors.mute, marginTop: 6, lineHeight: 18 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  lineLabel: { fontSize: 15, color: colors.ink, flex: 1, marginRight: 10 },
  lineValue: { fontSize: 15, color: colors.ink },
  lineStrong: { fontWeight: '700', fontSize: 17 },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  rise: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  riseName: { fontSize: 16, fontWeight: '600', color: colors.ink, flex: 1 },
  riseValue: { fontSize: 16, fontWeight: '600', color: colors.ink },
  riseMeta: { width: '100%', fontSize: 13, color: colors.mute, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 126, marginTop: 10 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, color: colors.mute, marginBottom: 4 },
  bar: { width: '56%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 11, color: colors.mute, marginTop: 6 },
});
