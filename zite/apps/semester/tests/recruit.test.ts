import { test, eq } from './harness';
import { seesConfidential, seesApplication, countingEvaluations, acceptBlocker } from '../src/lib/recruitRules';

test('confidential references: committee and authorities, never recused members or applicants', () => {
  eq(seesConfidential({ authority: false, member: true, recused: false, applicant: false }), true);
  eq(seesConfidential({ authority: false, member: true, recused: true, applicant: false }), false);
  eq(seesConfidential({ authority: true, member: false, recused: true, applicant: false }), false);
  eq(seesConfidential({ authority: false, member: false, recused: false, applicant: true }), false);
  eq(seesConfidential({ authority: false, member: false, recused: false, applicant: false }), false);
  eq(seesApplication({ authority: false, member: false, recused: false, applicant: false }), false);
});
test('selection counts only independent evaluations', () => {
  eq(countingEvaluations([{ member: 'c1' }, { member: 'c2' }], ['c1', 'c2'], ['c2']), 1);
  eq(countingEvaluations([{ member: 'c1' }, { member: 'gone' }], ['c1', 'c3'], []), 1);
  eq(countingEvaluations([{ member: 'c1' }, { member: 'c3' }], ['c1', 'c3'], []), 2);
});
test('acceptance is tied to the exact approved version', () => {
  eq(acceptBlocker({ state: 'approved', readHash: 'a', currentHash: 'a' }), null);
  eq(acceptBlocker({ state: 'draft', readHash: 'a', currentHash: 'a' }) !== null, true);
  eq(acceptBlocker({ state: 'approved', readHash: 'a', currentHash: 'b' }), 'The offer changed. Reload and read the current terms.');
});
