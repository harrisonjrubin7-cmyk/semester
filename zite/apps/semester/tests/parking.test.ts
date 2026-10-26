import { test, eq } from './harness';
import { normPlate, plateOk, nextPermit, effectivePermit, appealBlocker, decisionBlocker } from '../src/lib/parkingRules';

test('plates compare normalised', () => { eq(normPlate('abc-12 3'), 'ABC123'); eq(plateOk('-'), false); eq(plateOk('7XYZ123'), true); });
const staff = { staff: true, holder: false }, holder = { staff: false, holder: true };
test('permit path (control)', () => { eq(nextPermit('applied', 'allocate', staff, false), 'issued'); eq(nextPermit('issued', 'revoke', staff, false), 'revoked'); });
test('a full zone waitlists instead of issuing', () => {
  eq(nextPermit('applied', 'allocate', staff, true), null);
  eq(nextPermit('applied', 'waitlist', staff, true), 'waitlisted');
  eq(nextPermit('waitlisted', 'allocate', staff, false), 'issued');
});
test('staff never decide their own permit; only the holder withdraws', () => {
  eq(nextPermit('applied', 'allocate', { staff: true, holder: true }, false), null);
  eq(nextPermit('issued', 'withdraw', staff, false), null);
  eq(nextPermit('issued', 'withdraw', holder, false), 'withdrawn');
});
test('an issued permit past its end is expired', () => {
  eq(effectivePermit('issued', new Date('2026-01-01'), new Date('2026-02-01')), 'expired');
  eq(effectivePermit('issued', new Date('2026-03-01'), new Date('2026-02-01')), 'issued');
});
const t0 = new Date('2026-10-01T00:00:00Z');
test('appeal: owner, once, within 21 days, with a reason', () => {
  eq(appealBlocker('issued', t0, new Date('2026-10-10'), true, 'The meter was broken, photo attached'), null);
  eq(appealBlocker('issued', t0, new Date('2026-10-10'), false, 'The meter was broken, photo attached') !== null, true);
  eq(appealBlocker('appealed', t0, new Date('2026-10-10'), true, 'The meter was broken, photo attached'), 'This citation is already under appeal.');
  eq(appealBlocker('issued', t0, new Date('2026-10-25'), true, 'The meter was broken, photo attached'), 'Appeals must be made within 21 days.');
});
const d = (o: any) => decisionBlocker({ state: 'appealed', adjudicator: true, issuedByMe: false, outcome: 'upheld', amount: 5000, newAmount: null, note: 'Signage was clear and visible', ...o });
test('appeals are independent of the issuer', () => {
  eq(d({}), null);
  eq(d({ issuedByMe: true }), 'You issued this citation, so someone else must decide the appeal.');
  eq(d({ adjudicator: false }) !== null, true);
});
test('a reduction must actually reduce', () => {
  eq(d({ outcome: 'reduced', newAmount: 2500 }), null);
  eq(d({ outcome: 'reduced', newAmount: 5000 }) !== null, true);
});
