import { test, eq } from './harness';
import { ROLE_APPS, appsForRoles, gapStats, roleAppByKey } from '../src/lib/roleApps';

test('69 role apps with unique keys and at least four capabilities each', () => {
  eq(ROLE_APPS.length, 69); eq(new Set(ROLE_APPS.map((a) => a.key)).size, 69);
  eq(ROLE_APPS.every((a) => a.capabilities.length >= 4), true);
});
test('a capability marked existing or incomplete always names a route; missing never does', () => {
  eq(ROLE_APPS.every((a) => a.capabilities.every((c) => (c.state === 'missing') === (c.route === null))), true);
});
test('unknown roles open no apps; multi-role users get separate apps, not a merged one', () => {
  eq(appsForRoles(['Root']).length, 0);
  eq(appsForRoles(['Student', 'Tutor']).map((a) => a.key).join(), 'student,undergraduate-student,graduate-student,tutor');
});
test('gap stats add up', () => { const s = gapStats(); eq(s.existing + s.incomplete + s.missing, s.capabilities); eq(s.missing > 0, true); });
test('company roles live in Company OS, not the institution app', () => { eq(roleAppByKey('finance-operator')!.host, 'company'); eq(roleAppByKey('registrar')!.host, 'semester'); });
import { ROLE_APP_SPECS } from '../src/lib/roleAppSpecs';
test('every app has a family, target and visibility boundary from the 79-file pack', () => {
  eq(ROLE_APPS.every((a) => { const s = ROLE_APP_SPECS[a.key]; return !!s && s.every((x) => x.length > 3); }), true);
  eq(Object.keys(ROLE_APP_SPECS).length, 69);
});
