// Dinheiro: saldo atual em destaque, o mês resumido, contas, extrato e o que vai vencer.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../theme';
import { Bar, Btn, Card, Empty, Icon, IconBtn, Input, Row, T, useScreenStyles } from '../ui';
import { useStore } from '../store';
import { useNav } from '../nav';
import ItemRow, { Section } from '../ItemRow';
import { monthMoney } from '../core/model';
import { balances } from '../core/money';
import { pickAndReadDocument } from '../legacy/importDocument';
import { addMonths, formatMoney, monthKey, monthLabel, parseMoney, todayISO } from '../core/dates';

export default function Money() {
  const c = useTheme();
  const s = useScreenStyles();
  const store = useStore();
  const { state, now, setSettings, say } = store;
  const { open } = useNav();
  const current = monthKey(todayISO(now));
  const [key, setKey] = useState(current);
  const [editLimit, setEditLimit] = useState(null);
  const [all, setAll] = useState(false);
  const [reading, setReading] = useState(false);
  const m = useMemo(() => monthMoney(state.items, key, state.settings, now), [state, key]);
  const bal = useMemo(() => balances(state), [state.items, state.accounts]);
  const hide = state.settings.hideMoney;
  const $ = (v) => (hide ? 'R$ •••' : `${v < 0 ? '− ' : ''}${formatMoney(v)}`);
  const move = (n) => {
    setKey(addMonths(`${key}-01`, n).slice(0, 7));
    setAll(false);
  };
  const over = m.limit && m.left < 0;
  const paid = all ? m.paid : m.paid.slice(0, 12);

  const importFile = async () => {
    if (reading) return;
    setReading(true);
    const r = await pickAndReadDocument([]);
    setReading(false);
    if (r.canceled) return;
    if (r.error) return say(r.error);
    open('import', { read: r });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Row style={{ paddingTop: 14 }}>
        <T v="hero" style={{ flex: 1 }}>
          Dinheiro
        </T>
        <IconBtn name={hide ? 'eyeoff' : 'eye'} label={hide ? 'Mostrar valores' : 'Esconder valores'} bg="card" onPress={() => setSettings({ hideMoney: !hide })} />
      </Row>

      <Card style={{ marginTop: 12, backgroundColor: c.moneyBg }}>
        <T v="l" c="money">
          Saldo atual
        </T>
        {bal.hasKnown ? (
          <T v="hero" style={{ fontSize: 38, lineHeight: 46 }}>
            {$(bal.money)}
          </T>
        ) : (
          <>
            <T v="title" c="soft">
              Ainda não sei
            </T>
            <T v="s" c="soft" style={{ marginTop: 2 }}>
              Importe um extrato ou informe o saldo de uma conta para eu acompanhar.
            </T>
          </>
        )}
        {bal.cardDebt > 0 ? (
          <T v="s" c="soft" style={{ marginTop: 2 }}>
            Fatura do cartão em aberto: {$(bal.cardDebt)}
          </T>
        ) : null}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 14, opacity: 0.7 }} />
        <Row style={{ marginLeft: -10, marginTop: -8 }} gap={0}>
          <IconBtn name="back" label="Mês anterior" onPress={() => move(-1)} />
          <T v="sm" style={{ minWidth: 132, textAlign: 'center' }}>
            {monthLabel(key)}
          </T>
          <IconBtn name="next" label="Próximo mês" onPress={() => move(1)} />
        </Row>
        <Row gap={18} style={{ marginTop: 4 }}>
          <View>
            <T v="s" c="soft">
              Entrou
            </T>
            <T v="h">{$(m.in)}</T>
          </View>
          <View>
            <T v="s" c="soft">
              Saiu
            </T>
            <T v="h">{$(m.out)}</T>
          </View>
          <View>
            <T v="s" c="soft">
              A pagar
            </T>
            <T v="h">{$(m.toPay)}</T>
          </View>
        </Row>
        {m.toReceive ? (
          <T v="s" c="soft" style={{ marginTop: 6 }}>
            A receber: {$(m.toReceive)}
          </T>
        ) : null}
        {m.limit ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Bar value={m.used} color={over ? 'danger' : m.used > 0.8 ? 'warn' : 'money'} />
            <T v="s" c={over ? 'danger' : 'soft'}>
              {over ? `Passou ${$(-m.left)} do limite de ${$(m.limit)}` : `Sobra ${$(m.left)} do limite de ${$(m.limit)}${m.toPay ? ', já contando o que falta pagar' : ''}`}
              {key === current && m.perDay ? ` · dá ${$(m.perDay)} por dia` : ''}
            </T>
          </View>
        ) : null}
      </Card>

      {editLimit !== null ? (
        <Row gap={8} style={{ marginTop: 10 }}>
          <Input value={editLimit} onChangeText={(t) => setEditLimit(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" autoFocus placeholder="Quanto quer gastar por mês, no máximo" accessibilityLabel="Limite do mês" aria-label="Limite do mês" style={{ flex: 1 }} />
          <Btn label="Ok" onPress={() => { setSettings({ monthLimit: parseMoney(editLimit) }); setEditLimit(null); }} />
        </Row>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
          <Btn small kind="soft" icon="plus" label="Anotar" onPress={() => open('item', { draft: { type: 'money', flow: 'out', paid: true, date: todayISO(now), title: '' }, onSave: (d) => d.title && store.addItems([d]) })} />
          <Btn small kind="soft" icon="send" label={reading ? 'Lendo…' : 'Importar extrato'} onPress={importFile} />
          <Btn small kind="soft" label={m.limit ? 'Limite do mês' : 'Definir limite do mês'} onPress={() => setEditLimit(m.limit ? String(m.limit).replace('.', ',') : '')} />
        </ScrollView>
      )}

      <Section title="Contas" right={<Btn small kind="soft" icon="plus" label="Conta" onPress={() => open('account', {})} />}>
        {bal.rows.length ? (
          bal.rows.map((a) => (
            <Pressable key={a.id} onPress={() => open('account', { id: a.id })} accessibilityRole="button" accessibilityLabel={`Abrir conta ${a.name}`} aria-label={`Abrir conta ${a.name}`} style={{ minHeight: 52, justifyContent: 'center' }}>
              <Row>
                <Icon name="wallet" size={18} color="money" />
                <View style={{ flex: 1 }}>
                  <T v="m">{a.name}</T>
                  {a.kind === 'cartao' ? (
                    <T v="s" c="soft">
                      Cartão de crédito
                    </T>
                  ) : null}
                </View>
                <T v="m" c={a.known ? 'text' : 'faint'}>
                  {a.known ? (a.kind === 'cartao' ? (a.balance < 0 ? `fatura ${$(-a.balance)}` : 'sem fatura') : $(a.balance)) : 'Informar saldo'}
                </T>
              </Row>
            </Pressable>
          ))
        ) : (
          <T c="soft" style={{ paddingVertical: 8 }}>
            Importe o extrato do banco (PDF ou CSV) ou crie uma conta e diga quanto tem nela.
          </T>
        )}
      </Section>

      {m.pending.length ? (
        <Section title="Ainda vai vencer" count={m.pending.length}>
          {m.pending.map((it) => (
            <ItemRow key={it.id} item={it} />
          ))}
        </Section>
      ) : null}

      {m.categories.length ? (
        <Section title="Para onde foi">
          <View style={{ gap: 12, marginTop: 8 }}>
            {m.categories.map((cat) => (
              <View key={cat.name} style={{ gap: 5 }}>
                <Row>
                  <T v="m" style={{ flex: 1 }}>
                    {cat.name}
                  </T>
                  <T c="soft">
                    {$(cat.total)} · {Math.round(cat.share * 100)}%
                  </T>
                </Row>
                <Bar value={cat.share} height={6} />
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {m.paid.length ? (
        <Section title="O que já foi" count={m.paid.length}>
          {paid.map((it) => (
            <ItemRow key={it.id} item={it} compact plain />
          ))}
          {m.paid.length > paid.length ? <Btn small kind="ghost" label={`Ver os ${m.paid.length}`} onPress={() => setAll(true)} /> : null}
        </Section>
      ) : null}

      {m.moved.length ? (
        <Section title="Entre suas contas" count={m.moved.length}>
          {m.moved.slice(0, all ? 999 : 5).map((it) => (
            <ItemRow key={it.id} item={it} compact plain />
          ))}
        </Section>
      ) : null}

      {!m.paid.length && !m.pending.length && !m.moved.length ? <Empty icon="wallet" title="Nada neste mês" text="Fale “gastei 32 reais no ifood” ou “conta de luz 120 dia 15”. Ou importe o extrato do banco." /> : null}
    </ScrollView>
  );
}
