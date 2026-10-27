import { test, eq } from './harness';
import { rolesAfterProvision, rolesAfterOffboard, reconcile, onLeave } from '../src/lib/hrRules';

test('a student who becomes staff gains only the staff role', () => {
  eq(rolesAfterProvision(['Student'], 'Staff'), ['Student', 'Staff']);
  eq(rolesAfterProvision(['Student', 'Staff'], 'Staff'), ['Student', 'Staff']);
});
test('when employment ends the person remains a student', () => {
  eq(rolesAfterOffboard(['Student', 'Staff'], 'Staff', []), ['Student']);
  eq(rolesAfterOffboard(['Student', 'Tutor', 'Staff'], 'Tutor', []), ['Student', 'Staff']);
  // another live job still grants the role: keep it
  eq(rolesAfterOffboard(['Student', 'Staff'], 'Staff', ['Staff']), ['Student', 'Staff']);
  // never leaves someone with no role
  eq(rolesAfterOffboard(['Staff'], 'Staff', []), ['Student']);
});
test('reconciliation finds missing and lingering access', () => {
  eq(reconcile(['Student'], [{ grants: 'Staff', access: 'provisioned', state: 'active' }]).missing, ['Staff']);
  eq(reconcile(['Student', 'Tutor'], [{ grants: 'Tutor', access: 'removed', state: 'ended' }]).lingering, ['Tutor']);
  eq(reconcile(['Student', 'Staff'], [{ grants: 'Staff', access: 'removed', state: 'ended' }, { grants: 'Staff', access: 'provisioned', state: 'active' }]).lingering, []);
});
test('leave is projected from approved leave by date', () => {
  const l = [{ state: 'approved', from: '2026-11-01', to: '2026-11-05' }, { state: 'requested', from: '2026-12-01', to: '2026-12-02' }];
  eq(onLeave(l, '2026-11-03'), true);
  eq(onLeave(l, '2026-11-06'), false);
  eq(onLeave(l, '2026-12-01'), false);
});
