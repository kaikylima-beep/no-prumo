// Uma conta: nome, tipo e quanto tem nela hoje.
import React, { useState } from 'react';
import { Btn, Chip, Input, Label, Row, Sheet, T } from './ui';
import { useStore } from './store';
import { ACCOUNT_KINDS, balances, makeAccount, withBalance } from './core/money';
import { formatMoney, parseMoney, todayISO } from './core/dates';

export default function AccountSheet({ id, onClose }) {
  const { state, saveAccount, removeAccount } = useStore();
  const existing = id ? (state.accounts || []).find((a) => a.id === id) : null;
  const row = existing ? balances(state).rows.find((r) => r.id === id) : null;
  const [name, setName] = useState(existing ? existing.name : '');
  const [kind, setKind] = useState(existing ? existing.kind : 'corrente');
  const [balance, setBalance] = useState('');
  if (id && !existing) return null;
  const card = kind === 'cartao';

  const save = () => {
    let acc = existing ? { ...existing, name: name.trim() || existing.name, kind } : makeAccount({ name, kind });
    if (balance.trim()) {
      const v = parseMoney(balance);
      acc = withBalance(acc, card ? -Math.abs(v) : balance.trim().startsWith('-') ? -v : v, todayISO());
    }
    saveAccount(acc);
    onClose();
  };

  return (
    <Sheet
      title={existing ? existing.name : 'Nova conta'}
      onClose={onClose}
      footer={
        <Row gap={10}>
          {existing ? <Btn label="Apagar" kind="danger" icon="trash" onPress={() => { removeAccount(existing.id); onClose(); }} /> : null}
          <Btn label="Salvar" disabled={!name.trim()} onPress={save} style={{ flex: 1 }} />
        </Row>
      }
    >
      <Label style={{ marginTop: 4 }}>Nome</Label>
      <Input value={name} onChangeText={setName} placeholder="Ex.: Nubank, Itaú, Carteira" accessibilityLabel="Nome da conta" aria-label="Nome da conta" v="h" />
      <Label>Tipo</Label>
      <Row wrap>
        {ACCOUNT_KINDS.map((k) => (
          <Chip key={k.v} label={k.label} on={kind === k.v} color="money" onPress={() => setKind(k.v)} />
        ))}
      </Row>
      <Label>{card ? 'Fatura em aberto hoje' : 'Quanto tem nela hoje'}</Label>
      <Input value={balance} onChangeText={(t) => setBalance(t.replace(/[^\d.,-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder={row && row.known ? formatMoney(Math.abs(row.balance)) : '0,00'} accessibilityLabel="Saldo de hoje" aria-label="Saldo de hoje" v="h" />
      <T v="s" c="soft" style={{ marginTop: 8 }}>
        {row && row.known ? 'Só preencha se o número do app estiver diferente do banco. A partir daqui eu sigo com o que você anotar e importar.' : 'Com esse número eu passo a mostrar o saldo e a somar o que entrar e sair. Apagar a conta não apaga os lançamentos.'}
      </T>
    </Sheet>
  );
}
