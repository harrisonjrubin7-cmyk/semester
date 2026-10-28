import { test, eq } from './harness';
import { canOpenSubmission, gradingFor } from '../src/lib/submissionAccess';

const sub = (o: Partial<{ owner: string; state: string; groupMembers: string[] | null }> = {}) => ({ owner: 'stuA', state: 'Submitted', groupMembers: null, ...o });
test('the owner opens their own work, even as a draft (control)', () => {
  eq(canOpenSubmission('stuA', sub(), null), true);
  eq(canOpenSubmission('stuA', sub({ state: 'Private Draft' }), null), true);
});
test('P01: student B cannot open student A’s submission or its attachments', () => {
  eq(canOpenSubmission('stuB', sub(), null), false);
  eq(canOpenSubmission('stuB', sub({ state: 'Released' }), null), false);
});
test('P02: an instructor from another section is refused; the section’s own staff are allowed once submitted', () => {
  eq(canOpenSubmission('insOther', sub(), null), false);
  eq(canOpenSubmission('ins', sub(), 'instructor'), true);
  eq(canOpenSubmission('ta', sub(), 'delegate'), true);
  eq(canOpenSubmission('ins', sub({ state: 'Private Draft' }), 'instructor'), false);
});
test('group work: frozen members open it once submitted; a later joiner and a draft are refused', () => {
  eq(canOpenSubmission('stuB', sub({ groupMembers: ['stuA', 'stuB'] }), null), true);
  eq(canOpenSubmission('stuC', sub({ groupMembers: ['stuA', 'stuB'] }), null), false);
  eq(canOpenSubmission('stuB', sub({ state: 'Private Draft', groupMembers: ['stuA', 'stuB'] }), null), false);
});
test('P03: a student sees no score or feedback until release; staff always do', () => {
  const g = { id: 's1', state: 'Graded', score: 18, feedback: 'Strong method.' };
  eq(gradingFor(g, false), { id: 's1', state: 'Graded', score: null, feedback: '' });
  eq(gradingFor({ ...g, state: 'Submitted' }, false).feedback, '');
  eq(gradingFor({ ...g, state: 'Released' }, false), { ...g, state: 'Released' });
  eq(gradingFor(g, true), g);
});
