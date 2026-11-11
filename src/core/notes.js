// Apontamentos de teste (1.14.1): bugs e melhorias anotados a qualquer momento, com print.
// Aqui só o texto que vai para a pasta (função pura, testada no npm test).
const pad = (n) => String(n).padStart(2, '0');
export const KIND_LABEL = { bug: 'Bug', melhoria: 'Melhoria' };
const when = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const ext = (uri) => ((/\.(png|jpe?g|webp)(?:\?|$)/i.exec(String(uri || '')) || [])[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');

// Devolve { name, text, images: [{ name, uri }] } para gravar numa pasta.
export function exportNotes(notes = [], heardLog = [], { version = '', now = new Date() } = {}) {
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const images = [];
  const lines = [`# No Prumo ${version} · testes de ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`, ''];
  const list = notes.slice().sort((a, b) => a.at - b.at);
  lines.push(`## Apontamentos (${list.length})`, '');
  if (!list.length) lines.push('Nenhum.', '');
  list.forEach((n, i) => {
    const num = pad(i + 1);
    lines.push(`### ${num}. ${KIND_LABEL[n.kind] || 'Bug'} · ${when(n.at)}${n.where ? ` · ${n.where}` : ''}${n.version && n.version !== version ? ` · versão ${n.version}` : ''}`, '');
    lines.push(String(n.text || '').trim() || '(sem texto)', '');
    (n.photos || []).forEach((uri, k) => {
      const name = `apontamento-${num}-${k + 1}.${ext(uri)}`;
      images.push({ name, uri });
      lines.push(`Print: ${name}`);
    });
    if ((n.photos || []).length) lines.push('');
  });
  const phrases = heardLog.slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  lines.push(`## Frases da voz corrigidas (${phrases.length})`, '');
  if (!phrases.length) lines.push('Nenhuma.', '');
  phrases.forEach((m, i) => {
    lines.push(`${i + 1}. Ouvi: "${m.heard || ''}"`);
    if (m.alts && m.alts.length) lines.push(`   Outras versões: ${m.alts.map((a) => `"${a}"`).join(' | ')}`);
    lines.push(`   Corrigido para: "${m.text || ''}"`);
    lines.push(`   Salvo: ${(m.fixed || []).join(' · ') || '—'}`);
    if (m.conf && m.conf.length) lines.push(`   Confiança: ${m.conf.map((c) => (c < 0 ? '?' : Math.round(c * 100) / 100)).join(', ')}`);
    lines.push('');
  });
  return { name: `prumo-testes-${day}.md`, text: lines.join('\n'), images };
}
