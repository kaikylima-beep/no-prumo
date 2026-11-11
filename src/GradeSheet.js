// "Já saiu a nota?": lança a nota de uma prova ou trabalho na matéria dela.
import React, { useState } from 'react';
import { Btn, Input, Label, Row, Sheet, T } from './ui';
import { useStore } from './store';
import { addGrade } from './core/model';
import { academicOf, fmtGrade, parseGrade } from './legacy/academic';

export default function GradeSheet({ studyId, onClose }) {
  const { state, saveBlock, updateItem, say } = useStore();
  const item = state.items.find((i) => i.id === studyId);
  const block = item && state.blocks.find((b) => b.id === item.subjectId);
  const acad = academicOf(state.settings);
  const [name, setName] = useState(item ? item.title.replace(new RegExp(`\\s+(?:de|da|do)\\s+${block ? block.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '$^'}.*$`, 'i'), '') : '');
  const [score, setScore] = useState('');
  const [max, setMax] = useState('');
  const [weight, setWeight] = useState('');
  if (!item || !block) return null;
  const save = () => {
    const s = parseGrade(score);
    if (s === null) return;
    saveBlock(addGrade(block, { name: name.trim() || item.title, score: s, max: max.trim() ? parseGrade(max) : null, weight: weight.trim() ? parseGrade(weight) : null, date: item.date, studyId: item.id }));
    updateItem(item.id, { gradeAsked: true });
    onClose();
    say(`${block.name}: ${name.trim() || item.title} ${fmtGrade(s)}`);
  };
  return (
    <Sheet title="Lançar nota" onClose={onClose} footer={<Btn label="Salvar nota" disabled={parseGrade(score) === null} onPress={save} />}>
      <T c="soft">{block.name}</T>
      <Label>Avaliação</Label>
      <Input value={name} onChangeText={setName} accessibilityLabel="Nome da avaliação" aria-label="Nome da avaliação" />
      <Row gap={10} style={{ marginTop: 10 }}>
        <Input value={score} onChangeText={(t) => setScore(t.replace(/[^\d.,]/g, ''))} autoFocus keyboardType="decimal-pad" placeholder="Nota" accessibilityLabel="Nota" aria-label="Nota" v="h" style={{ flex: 1 }} />
        <Input value={max} onChangeText={(t) => setMax(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder={`Vale ${fmtGrade(acad.maxGrade)}`} accessibilityLabel="Quanto vale" aria-label="Quanto vale" style={{ width: 100 }} />
        <Input value={weight} onChangeText={(t) => setWeight(t.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="Peso" accessibilityLabel="Peso" aria-label="Peso" style={{ width: 80 }} />
      </Row>
    </Sheet>
  );
}
