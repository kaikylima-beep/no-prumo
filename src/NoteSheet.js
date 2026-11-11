// Anotar um bug ou uma melhoria (modo de teste), com o print da tela que o app tirou e outros da galeria.
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from './theme';
import { Btn, Icon, IconBtn, Input, Label, Row, Segmented, Sheet, T } from './ui';
import { useStore } from './store';
import { dropImages, keepImage } from './files';
import { newId } from './core/model';
import { APP_VERSION } from './Settings';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  ImagePicker = null;
}
const MAX = 3;

export default function NoteSheet({ id, shot, where, onClose }) {
  const c = useTheme();
  const { state, mutate, say } = useStore();
  const existing = id ? (state.notes || []).find((n) => n.id === id) : null;
  const [kind, setKind] = useState(existing ? existing.kind : 'bug');
  const [text, setText] = useState(existing ? existing.text : '');
  const [photos, setPhotos] = useState(existing ? existing.photos || [] : shot ? [shot] : []);
  const [removed, setRemoved] = useState([]);
  const place = existing ? existing.where : where;

  const fromGallery = async () => {
    if (!ImagePicker || photos.length >= MAX) return;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: MAX - photos.length });
      if (!r.canceled && r.assets) setPhotos([...photos, ...r.assets.map((a) => keepImage(a.uri)).filter(Boolean)].slice(0, MAX));
    } catch (e) {
      say('Não foi possível abrir as fotos do aparelho.');
    }
  };
  const close = () => {
    // fechou sem guardar: o print tirado agora não fica ocupando espaço
    if (!existing) dropImages(photos);
    onClose();
  };
  const save = () => {
    if (!text.trim() && !photos.length) return;
    dropImages(removed);
    const note = { id: existing ? existing.id : newId(), at: existing ? existing.at : Date.now(), kind, text: text.trim(), where: place || '', version: existing ? existing.version : APP_VERSION, photos };
    mutate((s) => ({ ...s, notes: existing ? s.notes.map((n) => (n.id === note.id ? note : n)) : [...(s.notes || []), note] }));
    onClose();
    say(existing ? 'Apontamento salvo' : 'Apontamento guardado');
  };
  const remove = () => {
    dropImages(photos);
    mutate((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== existing.id) }));
    onClose();
    say('Apontamento apagado');
  };

  return (
    <Sheet
      title={existing ? 'Apontamento' : 'Anotar'}
      onClose={close}
      footer={
        <Row gap={10}>
          {existing ? <Btn label="Apagar" kind="danger" icon="trash" onPress={remove} /> : null}
          <Btn label="Guardar" disabled={!text.trim() && !photos.length} onPress={save} style={{ flex: 1 }} />
        </Row>
      }
    >
      <Segmented value={kind} onChange={setKind} options={[{ value: 'bug', label: 'Bug' }, { value: 'melhoria', label: 'Melhoria' }]} />
      <Label>{kind === 'bug' ? 'O que aconteceu? O que você esperava?' : 'O que poderia ser melhor?'}</Label>
      <Input value={text} onChangeText={setText} autoFocus={!existing} multiline placeholder={kind === 'bug' ? 'Ex.: toquei em Guardar e a tarefa não apareceu em Hoje' : 'Ex.: queria ver as faltas direto no cartão'} accessibilityLabel="Texto do apontamento" aria-label="Texto do apontamento" style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }} />
      <Label>Prints</Label>
      <Row wrap gap={10}>
        {photos.map((uri) => (
          <View key={uri} style={{ width: 92, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: c.sunken }}>
            <Image source={{ uri }} style={{ width: 92, height: 160 }} resizeMode="cover" />
            <IconBtn name="close" size={16} label="Tirar print" bg="card" onPress={() => { setPhotos(photos.filter((p) => p !== uri)); setRemoved([...removed, uri]); }} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32 }} />
          </View>
        ))}
        {photos.length < MAX ? (
          <Pressable onPress={fromGallery} accessibilityRole="button" accessibilityLabel="Print da galeria" aria-label="Print da galeria" style={{ width: 92, height: 160, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="plus" size={20} color="soft" />
            <T v="s" c="soft" style={{ textAlign: 'center' }}>
              Print da galeria
            </T>
          </Pressable>
        ) : null}
      </Row>
      <T v="s" c="faint" style={{ marginTop: 12 }}>
        {[place ? `Onde: ${place}` : null, `No Prumo ${existing ? existing.version : APP_VERSION}`].filter(Boolean).join(' · ')}
      </T>
    </Sheet>
  );
}
