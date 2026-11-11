import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { colors, subjectColor } from '../theme';
import { useData } from '../store';
import { CATEGORIES } from '../parser';
import { essentialDefault } from '../budget';
import { maskDate, maskTime } from '../utils';
import { Field, Label, Toggle, Chip } from '../ui';
import { accountDisplayName, titleForType } from '../accounts';

// Campos de um item (tarefa, estudo ou finança) em formato editável.
// value = objeto de toEditable(); onChange(patch) recebe só o que mudou.
export default function ItemFields({ value: it, onChange, autoFocus, hideAccounts }) {
  const { palettes, accounts, settings, subjects } = useData();
  const pal = palettes[it.kind] || palettes.task;

  if (it.kind === 'finance') {
    const isIn = it.type === 'in';
    const isTransfer = it.type === 'transfer';
    // conta mostrada: a escolhida, ou a principal quando ainda não escolheu
    const shownAccount = it.account === undefined ? settings.defaultAccount || null : it.account;
    const accountChips = (value, onPick, noneLabel) => (
      <View style={st.chips}>
        {accounts.map((a) => (
          <Chip key={a.id} label={accountDisplayName(a, accounts)} color={pal.main} active={value === a.id} onPress={() => onPick(a.id)} />
        ))}
        <Chip label={noneLabel} color={pal.main} active={!value} onPress={() => onPick(null)} />
      </View>
    );
    return (
      <View>
        <Toggle
          color={pal.main}
          options={[
            { key: 'out', label: 'Saída' },
            { key: 'in', label: 'Entrada' },
            { key: 'transfer', label: 'Transferência' },
          ]}
          value={it.type}
          onChange={(v) =>
            onChange(
              v === 'transfer'
                ? { type: v, status: 'paid', from: it.from || shownAccount || null, to: it.to || null }
                : {
                    type: v,
                    category: CATEGORIES[v].includes(it.category) ? it.category : 'Outros',
                    // era transferência: o título muda junto e a conta vem da ponta certa
                    ...(isTransfer ? { title: titleForType(it.title, v), account: (v === 'in' ? it.to : it.from) || null } : null),
                  }
            )
          }
        />
        {isTransfer ? (
          <View>
            {hideAccounts ? (
              <Text style={st.note}>Transferência entre suas contas: não conta como renda nem gasto.</Text>
            ) : (
              <View>
                <Label>Sai de</Label>
                {accountChips(it.from, (id) => onChange({ from: id }), 'Outra conta minha')}
                <Label>Vai para</Label>
                {accountChips(it.to, (id) => onChange({ to: id }), 'Outra conta minha')}
              </View>
            )}
            <Field value={it.title} onChangeText={(v) => onChange({ title: v })} placeholder="Descrição (opcional)" />
            <Label>Valor (R$)</Label>
            <Field value={it.amountText} onChangeText={(v) => onChange({ amountText: v })} keyboardType="decimal-pad" placeholder="0,00" />
            <Label>Data</Label>
            <Field
              value={it.dateText}
              onChangeText={(v) => onChange({ dateText: maskDate(v) })}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="DD/MM/AAAA"
            />
          </View>
        ) : (
        <View>
        <Label>Descrição</Label>
        <Field value={it.title} onChangeText={(v) => onChange({ title: v })} autoFocus={autoFocus} />
        <Label>Valor (R$)</Label>
        <Field
          value={it.amountText}
          onChangeText={(v) => onChange({ amountText: v })}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        <View style={st.chips}>
          {CATEGORIES[it.type].map((c) => (
            <Chip
              key={c}
              label={c}
              color={pal.main}
              active={it.category === c}
              onPress={() => onChange({ category: c, essential: essentialDefault(c, it.title) })}
            />
          ))}
        </View>
        {!isIn ? (
          <Toggle
            color={pal.main}
            options={[
              { key: 'sim', label: 'Necessário' },
              { key: 'nao', label: 'Não necessário' },
            ]}
            value={it.essential ? 'sim' : 'nao'}
            onChange={(v) => onChange({ essential: v === 'sim' })}
          />
        ) : null}
        {accounts.length && !hideAccounts ? (
          <View>
            <Label>Conta</Label>
            {accountChips(shownAccount, (id) => onChange({ account: id }), 'Sem conta')}
          </View>
        ) : null}
        <Label>{isIn ? 'Data do recebimento' : 'Data ou vencimento'}</Label>
        <Field
          value={it.dateText}
          onChangeText={(v) => onChange({ dateText: maskDate(v) })}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="DD/MM/AAAA"
        />
        <Toggle
          color={pal.main}
          options={[
            { key: 'paid', label: isIn ? 'Recebido' : 'Pago' },
            { key: 'pending', label: isIn ? 'A receber' : 'A pagar' },
          ]}
          value={it.status}
          onChange={(v) => onChange({ status: v })}
        />
        {!it.recId ? (
          <View style={st.chips}>
            <Chip
              label={it.repeat ? '✓ Repetir todo mês' : 'Repetir todo mês'}
              color={pal.main}
              active={it.repeat}
              onPress={() => onChange({ repeat: !it.repeat })}
            />
          </View>
        ) : null}
        </View>
        )}
      </View>
    );
  }

  const mode = it.repeatMode || 'none';
  const toggleDay = (d) => {
    const set = new Set(it.repeatDays || []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ repeatDays: [...set].sort() });
  };

  return (
    <View>
      <Label>{it.kind === 'study' ? 'Prova, entrega ou estudo' : 'O quê'}</Label>
      <Field value={it.title} onChangeText={(v) => onChange({ title: v })} autoFocus={autoFocus} />

      {it.kind === 'study' && subjects.some((x) => !x.archived || x.id === it.subjectId) ? (
        <View>
          <Label>Matéria</Label>
          <View style={st.chips}>
            {subjects
              .filter((x) => !x.archived || x.id === it.subjectId)
              .map((x) => (
                <Chip key={x.id} label={x.name} color={subjectColor(x.color).main} active={it.subjectId === x.id} onPress={() => onChange({ subjectId: it.subjectId === x.id ? null : x.id })} />
              ))}
            <Chip label="Sem matéria" color={pal.main} active={!it.subjectId} onPress={() => onChange({ subjectId: null })} />
          </View>
        </View>
      ) : null}

      <Label>Repetir</Label>
      <Toggle
        color={pal.main}
        options={[
          { key: 'none', label: 'Uma vez' },
          { key: 'daily', label: 'Todo dia' },
          { key: 'weekly', label: 'Semana' },
          { key: 'monthly', label: 'Mês' },
        ]}
        value={mode}
        onChange={(v) =>
          onChange({
            repeatMode: v,
            // ao começar a repetir, aproveita o horário que já estava preenchido
            timesText: v !== 'none' && !it.timesText ? it.timeText || '08:00' : it.timesText,
          })
        }
      />

      {mode !== 'none' ? (
        <View>
          {mode === 'weekly' ? (
            <View style={st.chips}>
              {WEEK_CHIPS.map(([d, label]) => (
                <Chip
                  key={d}
                  label={label}
                  color={pal.main}
                  active={(it.repeatDays || []).includes(d)}
                  onPress={() => toggleDay(d)}
                />
              ))}
            </View>
          ) : null}
          {mode === 'monthly' ? (
            <View>
              <Label>Dia do mês</Label>
              <Field
                value={it.repeatDay}
                onChangeText={(v) => onChange({ repeatDay: v.replace(/\D/g, '').slice(0, 2) })}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1 a 31"
              />
            </View>
          ) : null}
          <Label>Horários</Label>
          <Field
            value={it.timesText}
            onChangeText={(v) => onChange({ timesText: v.replace(/[^\d:,;h e]/gi, '') })}
            keyboardType="numbers-and-punctuation"
            placeholder="08:00, 20:00"
          />
        </View>
      ) : (
      <View>
      <View style={st.two}>
        <View style={{ flex: 1.3, marginRight: 16 }}>
          <Label>{it.kind === 'study' ? 'Data' : 'Para quando'}</Label>
          <Field
            value={it.dateText}
            onChangeText={(v) => onChange({ dateText: maskDate(v) })}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="DD/MM/AAAA"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Label>Horário</Label>
          <Field
            value={it.timeText}
            onChangeText={(v) => onChange({ timeText: maskTime(v) })}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="HH:MM"
          />
        </View>
      </View>
      {it.dateText ? (
        <View>
          <Label>Avisar quantos dias antes</Label>
          <Field
            value={it.leadText}
            onChangeText={(v) => onChange({ leadText: v.replace(/\D/g, '') })}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="vazio = pela importância da área"
          />
        </View>
      ) : null}
      </View>
      )}
    </View>
  );
}

const WEEK_CHIPS = [
  [1, 'Seg'],
  [2, 'Ter'],
  [3, 'Qua'],
  [4, 'Qui'],
  [5, 'Sex'],
  [6, 'Sáb'],
  [0, 'Dom'],
];

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  two: { flexDirection: 'row' },
  note: { fontSize: 13, color: colors.mute, lineHeight: 19, marginVertical: 8 },
});

