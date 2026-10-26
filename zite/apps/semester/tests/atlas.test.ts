import { test, eq } from './harness';
import { satisfied, coverage, gapNext, approverRole, publishable, citedClaims } from '../../semester-company-os/src/lib/atlasRules';

test('each dimension needs its own evidence (control)', () => {
  const s = satisfied([{ stage: 'Implemented', environment: 'Preview' }, { stage: 'Tested', environment: 'Synthetic' }]);
  eq(s.Implemented, true); eq(s.Tested, true); eq(s.Designed, false); eq(s.Deployed, false);
});
test('synthetic evidence never proves deployment, production or acceptance', () => {
  const s = satisfied([{ stage: 'Deployed', environment: 'Synthetic' }, { stage: 'Production-enabled', environment: 'Synthetic' }, { stage: 'Operationally accepted', environment: 'Synthetic' }]);
  eq(s.Deployed || s['Production-enabled'] || s['Operationally accepted'], false);
  eq(satisfied([{ stage: 'Deployed', environment: 'Staging' }]).Deployed, true);
});
test('coverage keeps its denominator and says unknown without scope', () => {
  eq(coverage(3, 10).label, '3 of 10');
  eq(coverage(0, null).label, 'unknown (scope not defined)');
  eq(coverage(0, null).ratio, null);
});
test('gap risk acceptance', () => {
  eq(gapNext('open', 'accept_risk', { severity: 'critical', isOwner: false, isPrivacyOfficer: true }), null);
  eq(gapNext('open', 'accept_risk', { severity: 'high', isOwner: false, isPrivacyOfficer: false }), null);
  eq(gapNext('open', 'accept_risk', { severity: 'high', isOwner: false, isPrivacyOfficer: true }), 'risk_accepted');
  eq(gapNext('open', 'accept_risk', { severity: 'low', isOwner: true, isPrivacyOfficer: true }), null);
  eq(gapNext('open', 'resolve', { severity: 'low', isOwner: true, isPrivacyOfficer: false }), 'resolved');
  eq(gapNext('resolved', 'reopen', { severity: 'low', isOwner: false, isPrivacyOfficer: false }), 'reopened');
});
test('claims', () => {
  eq(approverRole('security'), 'privacy_officer');
  eq(approverRole('customer_outcome'), 'marketing_approver');
  eq(publishable({ state: 'approved', reviewBy: '2027-01-01' }, '2026-10-26'), null);
  eq(publishable({ state: 'approved', reviewBy: '2026-01-01' }, '2026-10-26') !== null, true);
  eq(publishable({ state: 'proposed', reviewBy: '2027-01-01' }, '2026-10-26') !== null, true);
  eq(citedClaims('See CLM-3 and CLM-12; also CLM-3.').join(), '3,12');
});
