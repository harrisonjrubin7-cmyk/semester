import { test, eq } from './harness';
import { ROLE_APPS, JOURNEYS } from '../src/lib/roleRegistry';

test('exactly 69 unique roles, numbered 1..69', () => {
  eq(ROLE_APPS.length, 69);
  eq(new Set(ROLE_APPS.map((r) => r.role)).size, 69);
  eq(ROLE_APPS[68].n, 69);
});
test('status follows evidence: no surface means not started; nothing claims verified', () => {
  eq(ROLE_APPS.every((r) => (r.existing ? r.status === 'partial' : r.status === 'missing')), true);
});
test('every journey role exists in the registry', () => {
  const names = new Set(ROLE_APPS.map((r) => r.role));
  eq(JOURNEYS.every((j) => j.roles.every((r) => names.has(r))), true);
});
