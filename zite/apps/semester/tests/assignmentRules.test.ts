import { test, eq } from './harness';
import { publishProblems, changes, emptyDraft, type AssignmentDraft } from '../src/lib/assignmentRules';

const now = new Date('2026-10-28T12:00:00Z');
const d = (o: Partial<AssignmentDraft> = {}): AssignmentDraft => ({ ...emptyDraft(), title: 'Argumentative essay', dueAt: '2026-11-04T23:00:00Z', ...o });
test('a complete draft can be published (control)', () => { eq(publishProblems(d(), now), []); });
test('publishing needs a title, a future due date, sane points and attempts, and a known AI rule', () => {
  eq(publishProblems(d({ title: 'x', dueAt: '', points: -1, attemptsAllowed: 0, aiPolicy: 'Whatever' }), now),
    ['Give the assignment a title of 2 to 160 characters.', 'Choose a due date.', 'Points must be between 0 and 1000.', 'Allow 1 to 10 attempts.', 'Choose an AI-use rule.']);
  eq(publishProblems(d({ dueAt: '2026-10-01T00:00:00Z' }), now), ['The due date must be in the future.']);
});
test('changes between versions are listed in words; an identical republish lists nothing', () => {
  eq(changes(null, d()), ['First published']);
  eq(changes(d(), d({ dueAt: '2026-11-06T23:00:00Z', points: 90, instructions: 'Use two sources.' })), ['Instructions changed', 'Due date: 2026-11-04T23:00 → 2026-11-06T23:00', 'Points: 100 → 90']);
  eq(changes(d(), d({ dueAt: '2026-11-04T23:00:00.000Z' })), []);
});

// Group work (28 Oct)
test('group work: a group set is optional; a bad id stops publication', () => {
  const ok = { ...emptyDraft(), title: 'Team project', dueAt: '2030-01-01T00:00:00Z' };
  eq(publishProblems(ok, new Date('2029-01-01')), []);
  eq(publishProblems({ ...ok, groupSetId: 7 }, new Date('2029-01-01')), []);
  eq(publishProblems({ ...ok, groupSetId: 0 }, new Date('2029-01-01')), ['Choose a group set for group work.']);
});
test('group work: switching is reported in words; an old draft without the field counts as individual', () => {
  const a = { ...emptyDraft(), title: 'T', dueAt: '2030-01-01T00:00:00Z' };
  const legacy = { ...a } as Partial<typeof a>; delete legacy.groupSetId;
  eq(changes(legacy as typeof a, a), []);
  eq(changes(a, { ...a, groupSetId: 4 }), ['Group work: individual → group set 4']);
  eq(changes({ ...a, groupSetId: 4 }, { ...a, groupSetId: null }), ['Group work: group set 4 → individual']);
});
