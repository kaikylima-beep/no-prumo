import { parse } from '../src/core/nlu.js';
const now = new Date(2026, 10, 10, 14, 0);
const subjects = [{ id: 's1', name: 'Cálculo 2', aliases: ['calc 2'] }, { id: 's2', name: 'Física 1', aliases: [] }, { id: 's3', name: 'Circuitos Elétricos', aliases: ['circuitos'] }];
const fmt = (i) => i.type === 'money' ? `💰 ${i.title} | ${i.flow} ${i.amount} ${i.paid ? 'pago' : 'pend'} ${i.category} | ${i.date || '-'} ${i.repeat ? JSON.stringify(i.repeat) : ''}` : `${i.type === 'study' ? '📚' : '✅'} ${i.title} | ${i.date || '-'} ${i.time || ''}${i.endTime ? '-' + i.endTime : ''} ${i.repeat ? JSON.stringify(i.repeat) : ''} ${i.remind ? 'rem' + i.remind : ''} ${i.studyKind || ''} ${i.subjectId || ''}`;
for (const p of process.argv.slice(2).length ? process.argv.slice(2) : (await import('node:fs')).readFileSync(new URL('./phrases.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)) {
  const r = parse(p, { now, subjects });
  console.log('» ' + p);
  r.items.forEach((i) => console.log('   ' + fmt(i)));
  r.actions.forEach((a) => console.log('   ⚙ ' + JSON.stringify(a)));
  if (r.query) console.log('   ? ' + JSON.stringify(r.query));
  if (!r.items.length && !r.actions.length && !r.query) console.log('   (nada)');
}
