import { test, eq } from './harness';
import { noteHits, taskHits } from '../src/lib/searchHits';

const notes = [
  { id: 'n1', owner: ['stu'], title: 'Midterm worries', body: 'private reflection about chemistry', kind: 'Note', visibility: 'Only Me', source: 'Yours' },
  { id: 'n2', owner: ['ins'], title: 'Lecture plan', body: 'chemistry week 6', kind: 'Note', visibility: 'Only Me', source: 'Yours' },
];
test('the owner finds their own private note (control)', () => { eq(noteHits('stu', 'chemistry', notes).map((h) => h.id), ['n1']); });
test('P04: an instructor searching never sees a student’s private note — no hit, title, snippet or count', () => {
  const h = noteHits('ins', 'chemistry', notes);
  eq(h.map((x) => x.id), ['n2']);
  eq(JSON.stringify(h).includes('Midterm') || JSON.stringify(h).includes('reflection'), false);
  eq(noteHits('ins', 'worries', notes).length, 0);
});
test('P04: the re-check holds even if the fetch returned someone else’s records', () => {
  eq(noteHits('stranger', '', notes).length, 0);
  eq(taskHits('ins', 'essay', [{ id: 't1', owner: ['stu'], title: 'Essay draft', rubric: '', type: 'Assignment', dueAt: '', status: 'Open', source: 'Official' }]).length, 0);
});
