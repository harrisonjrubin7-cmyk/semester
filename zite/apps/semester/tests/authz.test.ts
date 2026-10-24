import { test, eq } from './harness';
import { authorize, AuthzInput } from '../src/lib/authz';

const base = (o: Partial<AuthzInput> = {}): AuthzInput => ({
  actorId: 'u1', membership: { status: 'Active', tenantId: 't1', roles: ['Student'] }, action: 'record.read.own',
  resource: { tenantId: 't1', ownerId: 'u1', classification: 'education_record' }, ...o,
});
const why = (i: AuthzInput) => { const d = authorize(i); return d.allow ? 'allow' : d.failed; };

test('student reads own record', () => eq(why(base()), 'allow'));
test('no membership denied', () => eq(why(base({ membership: null })), 'membership'));
test('suspended membership denied', () => eq(why(base({ membership: { status: 'Suspended', tenantId: 't1', roles: ['Student'] } })), 'membership'));
test('cross-tenant denied even for admin', () => eq(why(base({ membership: { status: 'Active', tenantId: 't2', roles: ['Administrator'] }, action: 'record.read.tenant' })), 'tenant'));
test('student cannot read another student', () => eq(why(base({ resource: { tenantId: 't1', ownerId: 'u2', classification: 'education_record' } })), 'resource'));
test('unknown role grants nothing', () => eq(why(base({ membership: { status: 'Active', tenantId: 't1', roles: ['Wizard'] } })), 'role'));
test('student cannot write grades', () => eq(why(base({ action: 'grade.write' })), 'role'));
test('advisor reads assigned student', () => eq(why(base({ actorId: 'a', membership: { status: 'Active', tenantId: 't1', roles: ['Advisor'] }, action: 'record.read.assigned', resource: { tenantId: 't1', ownerId: 'u1', assignedIds: ['a'], classification: 'education_record' } })), 'allow'));
test('advisor blocked from unassigned student', () => eq(why(base({ actorId: 'a', membership: { status: 'Active', tenantId: 't1', roles: ['Advisor'] }, action: 'record.read.assigned', resource: { tenantId: 't1', ownerId: 'u1', assignedIds: [], classification: 'education_record' } })), 'resource'));
test('capability switch off denies', () => eq(why(base({ capabilityEnabled: false })), 'capability'));
test('policy hold denies with its reason', () => { const d = authorize(base({ policyBlocks: ['Registration window closed'] })); eq(d.allow ? '' : d.reason, 'Registration window closed'); });
test('restricted record needs consent for non-owner', () => eq(why(base({ actorId: 'a', membership: { status: 'Active', tenantId: 't1', roles: ['Advisor'] }, action: 'record.read.assigned', resource: { tenantId: 't1', ownerId: 'u1', assignedIds: ['a'], classification: 'restricted' } })), 'consent'));
test('registrar commit needs authority transfer', () => eq(why(base({ membership: { status: 'Active', tenantId: 't1', roles: ['Staff'] }, action: 'enrollment.decide', resource: { tenantId: 't1', classification: 'education_record' } })), 'authority'));
test('registrar commit allowed once authority granted', () => eq(why(base({ membership: { status: 'Active', tenantId: 't1', roles: ['Staff'] }, action: 'enrollment.decide', resource: { tenantId: 't1', classification: 'education_record' }, authorityGranted: true })), 'allow'));
test('employer gets no student record access', () => eq(why(base({ membership: { status: 'Active', tenantId: 't1', roles: ['Employer'] }, action: 'record.read.tenant' })), 'role'));

// Parity: every role keeps exactly the endpoint gates it had before the switch to authorize().
import { ROLE_PERMISSIONS } from '../src/lib/authz';
const has = (role: keyof typeof ROLE_PERMISSIONS, a: string) => (ROLE_PERMISSIONS[role] as string[]).includes(a);
test('registrar desk: Staff + Admin only', () => eq((['Student','Faculty','Advisor','Tutor','Staff','Administrator','Alumni','Employer'] as const).filter((r) => has(r, 'registration.request.decide')), ['Staff', 'Administrator']));
test('security + developer apps: Admin only', () => eq((['Staff','Administrator','Advisor'] as const).filter((r) => has(r, 'security.manage') || has(r, 'devapps.manage')), ['Administrator']));
test('approvals: Advisor, Staff, Admin', () => eq((['Student','Faculty','Advisor','Tutor','Staff','Administrator'] as const).filter((r) => has(r, 'approval.decide')), ['Advisor', 'Staff', 'Administrator']));
test('teaching queue: Faculty + Tutor', () => eq((['Faculty','Advisor','Tutor','Staff','Administrator'] as const).filter((r) => has(r, 'teaching.queue')), ['Faculty', 'Tutor']));

// Role templates (79-role register): proposed, so they grant nothing until approved; persona overlays never grant.
import { ROLE_TEMPLATES } from '../src/lib/roleTemplates';
import { templatePermissions } from '../src/lib/authz';
test('register has 79 unique templates', () => eq(new Set(ROLE_TEMPLATES.map((t) => t.name)).size, 79));
test('unapproved template grants nothing', () => eq(templatePermissions(['Housing staff']), []));
test('unlisted template grants nothing even if assigned', () => eq(templatePermissions(['Registrar staff'], new Set()), []));
test('approved template grants its listed permissions', () => {
  const t = ROLE_TEMPLATES.find((x) => x.name === 'Registrar staff')!;
  const got = templatePermissions(['Registrar staff'], new Set(['Registrar staff']));
  eq(t.permissions.every((p) => got.includes(p)), true);
  eq(got.includes('registration.request.decide') && got.includes('registrar.read'), true);
  eq(got.includes('catalog.manage') || got.includes('member.manage') || got.includes('security.manage'), false);
});
test('persona overlay never grants, even if approved', () => eq(templatePermissions(['Transfer student'], new Set(['Transfer student'])), []));
test('template permission flows through authorize when approved', () => {
  const perm = ROLE_TEMPLATES.find((x) => x.name === 'Registrar staff')!.permissions[0];
  const input = base({ membership: { status: 'Active', tenantId: 't1', roles: [], templates: ['Registrar staff'] }, action: perm, resource: { tenantId: 't1', classification: 'directory' } });
  eq([authorize({ ...input, approvedTemplates: new Set() }).allow, authorize({ ...input, approvedTemplates: new Set(['Registrar staff']) }).allow], [false, true]);
});

test('approved batch: tutor can open the grading queue but not decide registrations', () => {
  const m = { status: 'Active', tenantId: 't1', roles: [], templates: ['Tutor'] };
  const r = (action: string) => authorize(base({ membership: m, action, resource: { tenantId: 't1', classification: 'directory' } })).allow;
  eq([r('teaching.queue'), r('registration.request.decide'), r('grade.write')], [true, false, false]);
});
test('approved batch: student accounts staff reads accounts only', () => {
  const m = { status: 'Active', tenantId: 't1', roles: [], templates: ['Student accounts staff'] };
  const r = (action: string) => authorize(base({ membership: m, action, resource: { tenantId: 't1', classification: 'directory' } })).allow;
  eq([r('accounts.read'), r('registrar.read'), r('caseload.read')], [true, false, false]);
});

// Active role context: one person, several roles, no merged authority (build pack negative cases).
const multi = (activeRole?: string) => ({ status: 'Active', tenantId: 't1', roles: ['Student', 'Faculty'], activeRole });
test('multi-role, no active role: legacy union still applies', () => eq(why(base({ membership: multi(), action: 'grade.write', resource: { tenantId: 't1', classification: 'education_record' }, authorityGranted: true })), 'allow'));
test('acting as Student, the same person cannot write grades', () => eq(why(base({ membership: multi('Student'), action: 'grade.write', resource: { tenantId: 't1', classification: 'education_record' }, authorityGranted: true })), 'role'));
test('acting as Faculty, they cannot use student-only sharing', () => eq(why(base({ membership: multi('Faculty'), action: 'share.issue' })), 'role'));
test('acting as a role they do not hold is refused', () => eq(why(base({ membership: multi('Administrator'), action: 'record.read.own' })), 'context'));
test('TA (Tutor) acting in role cannot read an unassigned section', () => eq(why(base({ actorId: 'ta', membership: { status: 'Active', tenantId: 't1', roles: ['Tutor'], activeRole: 'Tutor' }, action: 'record.read.assigned', resource: { tenantId: 't1', ownerId: 'u9', assignedIds: ['other'], classification: 'education_record' } })), 'resource'));
test('admin gets no restricted (accommodation) record without consent', () => eq(why(base({ actorId: 'adm', membership: { status: 'Active', tenantId: 't1', roles: ['Administrator'], activeRole: 'Administrator' }, action: 'record.read.tenant', resource: { tenantId: 't1', ownerId: 'u1', classification: 'restricted' } })), 'consent'));
test('switching institution: active role in tenant A gives nothing in tenant B', () => eq(why(base({ membership: { status: 'Active', tenantId: 't1', roles: ['Administrator'], activeRole: 'Administrator' }, action: 'record.read.tenant', resource: { tenantId: 't2', classification: 'directory' } })), 'tenant'));
import { roleForApp } from '../src/lib/roleApps';
test('apps map back to the role they act as; unknown apps act as nothing', () => {
  eq(roleForApp('registrar'), 'Staff'); eq(roleForApp('faculty'), 'Faculty'); eq(roleForApp('student'), 'Student'); eq(roleForApp('nope'), null);
});
