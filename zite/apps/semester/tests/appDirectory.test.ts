import { test, eq } from './harness';
import { visibleApps, appLink, APPS, type Facts } from '../src/lib/appDirectoryRules';

const none: Facts = { roles: [], hasMembership: false, delegate: false, familyShares: 0, employerPostings: 0, applications: 0, companyRoles: [], developerApps: 0 };

test('a newcomer sees Applicants and the public site only (control)', () => { eq(visibleApps(none), ['applicants', 'site']); });
test('a student sees Semester, not Faculty or Institution', () => { eq(visibleApps({ ...none, hasMembership: true, roles: ['Student'] }), ['semester', 'site']); });
test('faculty and TAs see Faculty', () => {
  eq(visibleApps({ ...none, hasMembership: true, roles: ['Faculty'] }).includes('faculty'), true);
  eq(visibleApps({ ...none, hasMembership: true, roles: ['Student'], delegate: true }).includes('faculty'), true);
});
test('staff see Institution; parents see Family; employers see Employers', () => {
  eq(visibleApps({ ...none, hasMembership: true, roles: ['Staff'] }).includes('institution'), true);
  eq(visibleApps({ ...none, familyShares: 1 }).includes('family'), true);
  eq(visibleApps({ ...none, employerPostings: 2 }).includes('employers'), true);
});
test('internal apps only for company roles', () => {
  eq(visibleApps({ ...none, hasMembership: true, roles: ['Administrator'] }).some((k) => APPS.find((a) => a.key === k)!.internal), false);
  eq(visibleApps({ ...none, companyRoles: ['security_reader'] }).includes('security'), true);
  eq(visibleApps({ ...none, companyRoles: ['security_reader'] }).includes('company'), false);
  eq(visibleApps({ ...none, companyRoles: ['marketer'] }).includes('company'), true);
});
test('links are https only and paths are joined safely', () => {
  eq(appLink('https://a.example/', '/learn'), 'https://a.example/learn');
  eq(appLink('https://a.example', 'learn'), 'https://a.example/learn');
  eq(appLink('javascript:alert(1)', '/'), null);
  eq(appLink('http://a.example', '/'), null);
  eq(appLink(null), null);
});
