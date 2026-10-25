import { test, eq } from './harness';
import { validateScopes, diffLedger } from '../src/lib/reconRules';

test('minimum read scopes pass (control)', () => eq(validateScopes('SIS', ['people.read', 'enrollments.read', 'sections.read'], ''), null));
test('scopes outside the catalog are refused', () => eq(typeof validateScopes('LMS', ['courses.read', 'roster.read', 'grades.write'], 'need it'), 'string'));
test('missing required scopes are refused', () => eq(typeof validateScopes('SSO', ['groups.read'], ''), 'string'));
test('write scopes need a reason', () => {
  eq(typeof validateScopes('Calendar', ['events.read', 'events.write'], ''), 'string');
  eq(validateScopes('Calendar', ['events.read', 'events.write'], 'Publish office hours to campus calendar'), null);
});
test('duplicates are refused', () => eq(typeof validateScopes('SSO', ['identity.read', 'identity.read'], ''), 'string'));
test('ledger seat with no Enrolled record is repairable', () => {
  const f = diffLedger([{ student: 's1', section: 'A' }], [{ id: 'e1', student: 's1', section: 'A', status: 'Requested' }], new Set(['A']));
  eq(f.length, 1); eq(f[0].kind, 'missing_in_records'); eq((f[0] as { enrollmentId: string }).enrollmentId, 'e1');
});
test('matching seat and record produces nothing (control)', () => eq(diffLedger([{ student: 's1', section: 'A' }], [{ id: 'e1', student: 's1', section: 'A', status: 'Enrolled' }], new Set(['A'])).length, 0));
test('Enrolled record without a seat is reported, only for ledger sections', () => {
  const m = [{ id: 'e2', student: 's2', section: 'A', status: 'Enrolled' }, { id: 'e3', student: 's3', section: 'B', status: 'Enrolled' }];
  const f = diffLedger([], m, new Set(['A']));
  eq(f.length, 1); eq(f[0].kind, 'not_in_ledger');
});
