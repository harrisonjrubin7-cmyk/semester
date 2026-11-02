import { test, eq } from './harness';
import { reviewNote, countReviews, reviewBlocker, closeBlocker, studentSummary } from '../src/lib/caseRules';

const note = reviewNote('2026-10-23', 'Fall 2026', 'needs_support', ['Meet tutor weekly', 'Drop to 12 credits']);
test('a review note is counted', () => eq(countReviews(`opened\n${note}`), 1));
test('ordinary notes are not reviews (control)', () => eq(countReviews('2026-10-01 · Referred to Sam: schedule help'), 0));
test('review needs a term and a step', () => { eq(typeof reviewBlocker('', ['x y z']), 'string'); eq(typeof reviewBlocker('Fall 2026', ['  ']), 'string'); eq(reviewBlocker('Fall 2026', ['Meet tutor']), null); });
test('closing needs a summary', () => eq(typeof closeBlocker('no_response', 'short', note), 'string'));
test('goals met needs a term review on record', () => {
  eq(typeof closeBlocker('goals_met', 'Student completed the success plan and is on track.', 'opened'), 'string');
  eq(closeBlocker('goals_met', 'Student completed the success plan and is on track.', note), null);
});
test('other outcomes do not need a review (control)', () => eq(closeBlocker('student_withdrew', 'Student withdrew from the institution in October.', ''), null));
test('the student summary carries standing and steps only', () => {
  const s = studentSummary('Fall 2026', 'at_risk', ['Meet tutor weekly']);
  eq(s.includes('at risk') && s.includes('Meet tutor weekly'), true);
});
