import { test, eq } from './harness';
import { releaseRefusal, holdView, activeViews, releaseNotice } from '../src/lib/holdRules';

test('registrar staff may lift a registrar hold (control)', () => { eq(releaseRefusal(['Staff'], ['Registrar staff'], 'Registrar'), null); });
test('an administrator may lift any office hold', () => { eq(releaseRefusal(['Administrator'], [], 'Bursar'), null); });
test('plain staff, or staff from another office, may not', () => {
  eq(releaseRefusal(['Staff'], [], 'Registrar'), 'Only Registrar office staff can lift this hold.');
  eq(releaseRefusal(['Staff'], ['Registrar staff'], 'Bursar'), 'Only Bursar office staff can lift this hold.');
  eq(releaseRefusal(['Faculty'], ['Faculty/instructor'], 'Advising'), 'Only Advising office staff can lift this hold.');
});
test('a template the owner has not approved grants nothing', () => {
  eq(releaseRefusal(['Staff'], ['Registrar staff'], 'Registrar', new Set()), 'Only Registrar office staff can lift this hold.');
});
test('a hold with no known office needs an administrator', () => {
  eq(releaseRefusal(['Staff'], ['Registrar staff'], 'Parking'), 'This hold has no owning office on record, so only an administrator can lift it.');
});
test('the student view carries only student-facing fields and only active holds', () => {
  const h = { id: 'h1', label: 'Bursar hold', originatingOffice: 'Bursar', studentFacingMessage: 'Pay the deposit.', blocksRegistration: true, status: 'Active', reason: 'staff-only note' };
  eq(holdView(h), { id: 'h1', title: 'Bursar hold', office: 'Bursar', message: 'Pay the deposit.', blocksRegistration: true });
  eq(activeViews([h, { ...h, id: 'h2', status: 'Released' }]).map((v) => v.id), ['h1']);
});
test('the notice reports the outcome, never promises registration while another hold blocks it', () => {
  eq(releaseNotice('Bursar hold', 'Bursar', 1), 'Your Bursar hold was lifted by the Bursar office. 1 other hold still blocks registration.');
  eq(releaseNotice('Bursar hold', 'Bursar', 0), 'Your Bursar hold was lifted by the Bursar office. No hold blocks registration now. Registration still checks your requirements when you submit.');
});
