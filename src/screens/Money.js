// Dinheiro: o que saiu, o que entrou e o que ainda vai vencer no mês. Sem extrato, sem planilha.
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../theme';
import { Bar, Btn, Card, Empty, IconBtn, Input, Row, T, useScreenStyles } from '../ui';
import { useStore } from '../store';
import { useNav } from '../nav';
import ItemRow, { Section } from '../ItemRow';
import { monthMoney } from '../core/model';
import { addMonths, formatMoney, monthKey, monthLabel, parseMoney, todayISO } from '../core/dates';

export default function Money() {
  const c = useTheme();
  const s = useScreenStyles();
  const store = useStore();
  const { state, now, setSettings } = store;
  const { open } = useNav();
  const current = monthKey(todayISO(now));
  const [key, setKey] = useState(current);
  const [editLimit, setEditLimit] = useState(null);
  const [all, setAll] = useState(false);
  const m = useMemo(() => monthMoney(state.items, key, state.settings, now), [state, key]);
  const hide = state.settings.hideMoney;
  const $ = (v) => (hide ? 'R$ •••' : formatMoney(v));
  const move = (n) => {
    setKey(addMonths(`${key}-01`, n).slice(0, 7));
    setAll(false);
  };
  const over = m.limit && m.left < 0;
  const paid = all ? m.paid : m.paid.slice(0, 12);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Row style={{ paddingTop: 14 }}>
        <T v="hero" style={{ flex: 1 }}>
          Dinheiro
        </T>
        <IconBtn name={hide ? 'eyeoff' : 'eye'} label={hide ? 'Mostrar valores' : 'Esconder valores'} bg="card" onPress={() => setSettings({ hideMoney: !hide })} />
      </Row>
      <Row style={{ marginTop: 6, marginLeft: -10 }} gap={0}>
        <IconBtn name="back" label="Mês anterior" onPress={() => move(-1)} />
        <T v="m" style={{ minWidth: 150, textAlign: 'center' }}>
          {monthLabel(key)}
        </T>
        <IconBtn name="next" label="Próximo mês" onPress={() => move(1)} />
      </Row>

      <Card style={{ marginTop: 8, backgroundColor: c.moneyBg }}>
        <T v="l" c="money">
          Saiu no mês
        </T>
        <T v="hero">{$(m.out)}</T>
        {m.limit ? (
          <View style={{ marginTop: 10, gap: 6 }}>
            <Bar value={m.used} color={over ? 'danger' : m.used > 0.8 ? 'warn' : 'money'} />
            <T v="s" c={over ? 'danger' : 'soft'}>
              {over ? `Passou ${$(-m.left)} do limite de ${$(m.limit)}` : `Sobra ${$(m.left)} do limite de ${$(m.limit)}${m.toPay ? ', já contando as contas a pagar' : ''}`}
            </T>
            {key === current && m.perDay ? (
              <T v="s" c="soft">
                Dá {$(m.perDay)} por dia até o fim do mês.
              </T>
            ) : null}
          </View>
        ) : null}
        <Row gap={20} style={{ marginTop: 14 }}>
          <View>
            <T v="s" c="soft">
              Entrou
            </T>
            <T v="h">{$(m.in)}</T>
          </View>
          <View>
            <T v="s" c="soft">
              A pagar
            </T>
            <T v="h">{$(m.toPay)}</T>
          </View>
          {m.toReceive ? (
            <View>
              <T v="s" c="soft">
                A receber
              </T>
              <T v="h">{$(m.toReceive)}</T>
            </View>
          ) : null}
        </Row>
      </Card>

      {editLimit !== null ? (
        <Row gap={8} style={{ marginTop: 10 }}>
          <Input value={editLimit} onChangeText={(t) => setEditLimit(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" autoFocus placeholder="Quanto quer gastar por mês, no máximo" accessibilityLabel="Limite do mês" aria-label="Limite do mês" style={{ flex: 1 }} />
          <Btn label="Ok" onPress={() => { setSettings({ monthLimit: parseMoney(editLimit) }); setEditLimit(null); }} />
        </Row>
      ) : (
        <Row gap={8} style={{ marginTop: 10 }}>
          <Btn small kind="soft" label={m.limit ? 'Mudar limite do mês' : 'Definir um limite do mês'} onPress={() => setEditLimit(m.limit ? String(m.limit).replace('.', ',') : '')} />
          <Btn small kind="soft" icon="plus" label="Anotar" onPress={() => open('item', { draft: { type: 'money', flow: 'out', paid: true, date: todayISO(now), title: '' }, onSave: (d) => addOne(d) })} />
        </Row>
      )}

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

      {!m.paid.length && !m.pending.length ? <Empty icon="wallet" title="Nada neste mês" text="Fale “gastei 32 reais no ifood” ou “conta de luz 120 dia 15”. Eu somo, separo por categoria e aviso antes de vencer." /> : null}
    </ScrollView>
  );

  function addOne(d) {
    if (d.title) store.addItems([d]);
  }
}
