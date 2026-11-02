import { test, eq } from './harness';
import { liveShares, isLive, categoriesOf, shareBlocker, shareLabel, ConsentRow } from '../src/lib/shares';

const T = '2026-10-22';
const c = (o: Partial<ConsentRow> = {}): ConsentRow => ({ id: 'c1', member: ['stu'], recipient: ['adv'], label: 'Advisor: Degree progress, Holds', consentType: 'Data Sharing', granted: true, revoked: false, expiresOn: '2026-12-31', ...o });

test('a granted, unexpired share to me is live', () => eq(isLive(c(), 'adv', 'Advisor', T), true));
test('a revoked share is not live', () => eq(isLive(c({ revoked: true }), 'adv', 'Advisor', T), false));
test('an expired share is not live', () => eq(isLive(c({ expiresOn: '2026-10-21' }), 'adv', 'Advisor', T), false));
test('a share ending today is still live today', () => eq(isLive(c({ expiresOn: T }), 'adv', 'Advisor', T), true));
test('a share to another advisor is not visible to me', () => eq(isLive(c({ recipient: ['other'] }), 'adv', 'Advisor', T), false));
test('a family share never counts as an advisor share', () => eq(isLive(c({ label: 'Family: Grades' }), 'adv', 'Advisor', T), false));
test('a non-sharing consent never counts', () => eq(isLive(c({ consentType: 'Assistant Use' }), 'adv', 'Advisor', T), false));
test('categories are the union of a student’s live shares', () => {
  const r = liveShares([c(), c({ id: 'c2', label: 'Advisor: Advising agenda' }), c({ id: 'c3', label: 'Advisor: Registration plan', revoked: true })], 'adv', 'Advisor', T);
  eq(r.length, 1); eq(r[0].categories.sort(), ['Advising agenda', 'Degree progress', 'Holds']);
});
test('labels round-trip', () => eq(categoriesOf(shareLabel('Advisor', ['Holds', 'Holds', 'Degree progress']), 'Advisor'), ['Holds', 'Degree progress']));
test('share validation', () => {
  const ok = { studentId: 'stu', advisorId: 'adv', advisorIsActiveAdvisorHere: true, categories: ['Holds'], expiresOn: '2026-12-01', today: T };
  eq(shareBlocker(ok), null);
  eq(typeof shareBlocker({ ...ok, advisorId: 'stu' }), 'string');
  eq(typeof shareBlocker({ ...ok, advisorIsActiveAdvisorHere: false }), 'string');
  eq(typeof shareBlocker({ ...ok, categories: [] }), 'string');
  eq(typeof shareBlocker({ ...ok, categories: ['Grades'] }), 'string');
  eq(typeof shareBlocker({ ...ok, expiresOn: '2026-01-01' }), 'string');
});
