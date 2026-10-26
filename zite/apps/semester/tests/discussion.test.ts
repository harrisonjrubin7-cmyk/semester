import { test, eq } from './harness';
import { validateBody, canModerate, threads } from '../src/lib/discussionRules';

const P = (id: string, parentId: string | null, at: string, authorId = 'A', hidden: { by: string; reason: string } | null = null) => ({ id, parentId, at, authorId, hidden });
test('body rules (control + refusals)', () => {
  eq(validateBody('Hello'), null); eq(typeof validateBody('   '), 'string'); eq(typeof validateBody('x'.repeat(4001)), 'string');
});
test('only course staff moderate', () => { eq([canModerate('instructor'), canModerate('delegate'), canModerate('student')], [true, true, false]); });
test('threads group replies under their top post, oldest first', () => {
  const t = threads([P('2', null, '2026-01-02'), P('1', null, '2026-01-01'), P('3', '1', '2026-01-03'), P('4', '3', '2026-01-04')], 'A', false);
  eq(t.map((x) => x.id), ['1', '2']); eq(t[0].replies.map((x) => x.id), ['3', '4']);
});
test('a reply whose parent is missing becomes a top post', () => { eq(threads([P('9', 'gone', '2026-01-01')], 'A', false).map((x) => x.id), ['9']); });
test('hidden posts show as removed except to their author and staff', () => {
  const h = { by: 'F', reason: 'Personal information' };
  eq(threads([P('1', null, 'a', 'S1', h)], 'S2', false)[0].shownBody, 'removed');
  eq(threads([P('1', null, 'a', 'S1', h)], 'S1', false)[0].shownBody, 'full');
  eq(threads([P('1', null, 'a', 'S1', h)], 'F', true)[0].shownBody, 'full');
});
