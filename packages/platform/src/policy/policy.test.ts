import { describe, expect, it } from '../../../../app/node_modules/vitest/dist/index.js';
import { POLICY_ACTIONS } from '../seam/institution.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { PolicyEngine, requirePolicy, type ActionRule, type PolicyResource } from './engine.ts';
import { PlatformError } from '../gateway/errors.ts';

const RULES: ActionRule[] = [
  { action: 'task.create', capability: null, classificationCeiling: 'student_private', ownerMay: true },
  { action: 'grade.release', capability: 'grades.release', classificationCeiling: 'education_record', purposes: ['service_delivery'] },
  { action: 'agenda.read', capability: null, classificationCeiling: 'student_private', consent: { purpose: 'agenda_sharing', scope: 'agenda.read' } },
  { action: 'grade.amend', capability: 'grades.amend', classificationCeiling: 'education_record', requiresFreshMfa: true, requiresApproval: true },
  { action: 'export.public', capability: 'export.run', classificationCeiling: 'public' },
];

const h = harness(RULES, ({ registry, dirs }) => {
  for (const c of ['grades.release', 'grades.amend', 'export.run']) registry.register(c);
  registry.defineRole({ role: 'instructor', capabilities: ['grades.release', 'grades.amend', 'export.run'] });
  dirs.get(TENANT_A)!.add({ id: 'dept', tenantId: TENANT_A, kind: 'department', parentId: null, name: 'Econ' });
  dirs.get(TENANT_A)!.add({ id: 'sec', tenantId: TENANT_A, kind: 'section', parentId: 'dept', name: '101' });
  dirs.get(TENANT_A)!.add({ id: 'other-dept', tenantId: TENANT_A, kind: 'department', parentId: null, name: 'History' });
});

const instructor = (tenant = TENANT_A, mfa: 'standard' | 'fresh' = 'standard') =>
  h.context(tenant, 'prof', { mfa, grants: [{ role: 'instructor', scopeKind: 'node', scopeId: 'dept' }] });
const student = (tenant = TENANT_A) => h.context(tenant, 'stu');

const grade = (over: Partial<PolicyResource> = {}): PolicyResource => ({ type: 'grade', id: 'g1', tenantId: TENANT_A, ownerId: 'stu', nodeId: 'sec', classification: 'education_record', ...over });

describe('policy engine', () => {
  it('denies an action nobody declared — fail closed', async () => {
    const d = await h.policy.evaluate(instructor(), 'grade.delete_everything', grade());
    expect(d).toMatchObject({ allow: false, reasonCode: 'action_not_declared' });
  });

  it('refuses a resource from another tenant before reading any role', async () => {
    const d = await h.policy.evaluate(instructor(), 'grade.release', grade({ tenantId: TENANT_B }));
    expect(d).toMatchObject({ allow: false, reasonCode: 'tenant_mismatch' });
  });

  it('allows by capability at the resource\'s scope and not beside it', async () => {
    expect(await h.policy.evaluate(instructor(), 'grade.release', grade())).toMatchObject({ allow: true, reasonCode: 'capability' });
    expect(await h.policy.evaluate(instructor(), 'grade.release', grade({ nodeId: 'other-dept' }))).toMatchObject({ allow: false, reasonCode: 'no_grant' });
    expect(await h.policy.evaluate(instructor(), 'grade.release', grade({ nodeId: null }))).toMatchObject({ allow: false });
  });

  it('the same person in another tenant holds nothing', async () => {
    // Same grants, but the directory for tenant B has no such node.
    expect(await h.policy.evaluate(instructor(TENANT_B), 'grade.release', grade({ tenantId: TENANT_B }))).toMatchObject({ allow: false });
  });

  it('lets an owner act on their own data without a capability, and nobody else', async () => {
    const own: PolicyResource = { type: 'task', id: 't1', tenantId: TENANT_A, ownerId: 'stu', classification: 'student_private' };
    expect(await h.policy.evaluate(student(), 'task.create', own)).toMatchObject({ allow: true, reasonCode: 'owner' });
    expect(await h.policy.evaluate(h.context(TENANT_A, 'someone-else'), 'task.create', own)).toMatchObject({ allow: false });
  });

  it('consent opens exactly the named resource to exactly the grantee, until withdrawn', async () => {
    const guardian = h.context(TENANT_A, 'guardian');
    const agenda: PolicyResource = { type: 'agenda', id: 'ag1', tenantId: TENANT_A, ownerId: 'stu', classification: 'student_private' };
    // Without a consent the answer says a consent would open it; the surface can then offer the owner a prompt.
    expect(await h.policy.evaluate(guardian, 'agenda.read', agenda)).toMatchObject({ allow: false, reasonCode: 'consent_required' });
    await expect(requirePolicy(h.policy, guardian, 'agenda.read', agenda)).rejects.toMatchObject({ code: 'consent_required', status: 403 });

    const consent = {
      id: 'c1', tenantId: TENANT_A, subjectPersonId: 'stu', grantedByPersonId: 'stu', granteePersonId: 'guardian', purpose: 'agenda_sharing' as const,
      scopes: ['agenda.read'], resourceIds: ['ag1'], evidence: 'in_app_confirmation' as const, policyVersion: 'v1',
      grantedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z',
    };
    h.pip.consents.push(consent);
    expect(await h.policy.evaluate(guardian, 'agenda.read', agenda)).toMatchObject({ allow: true, reasonCode: 'consent' });
    expect(await h.policy.evaluate(guardian, 'agenda.read', { ...agenda, id: 'ag2' })).toMatchObject({ allow: false });
    expect(await h.policy.evaluate(h.context(TENANT_A, 'stranger'), 'agenda.read', agenda)).toMatchObject({ allow: false });

    h.pip.consents[0] = { ...consent, withdrawnAt: '2026-10-02T00:00:00Z' };
    expect(await h.policy.evaluate(guardian, 'agenda.read', agenda)).toMatchObject({ allow: false });
    h.pip.consents.length = 0;
  });

  it('refuses a record above the action\'s classification ceiling', async () => {
    const d = await h.policy.evaluate(instructor(), 'export.public', grade());
    expect(d).toMatchObject({ allow: false, reasonCode: 'classification_above_ceiling' });
    expect(await h.policy.evaluate(instructor(), 'export.public', grade({ classification: 'public' }))).toMatchObject({ allow: true });
  });

  it('demands fresh MFA for a sensitive action and says so with a way forward', async () => {
    const stale = await h.policy.evaluate(instructor(TENANT_A, 'standard'), 'grade.amend', grade());
    expect(stale).toMatchObject({ allow: false, reasonCode: 'fresh_mfa_required', userAction: { kind: 'open_screen' } });
    expect(await h.policy.evaluate(instructor(TENANT_A, 'fresh'), 'grade.amend', grade())).toMatchObject({ allow: true, requiresApproval: true });
  });

  it('refuses a purpose the action does not allow', async () => {
    const research = h.context(TENANT_A, 'prof', { grants: [{ role: 'instructor', scopeKind: 'node', scopeId: 'dept' }], headers: {} });
    // contexts default to service_delivery; build one with another purpose via the raw builder path
    const ctx = Object.freeze({ ...research, purpose: 'marketing' });
    expect(await h.policy.evaluate(ctx, 'grade.release', grade())).toMatchObject({ allow: false, reasonCode: 'purpose_not_allowed' });
  });

  it('an allowance always carries an audit obligation', async () => {
    const d = await h.policy.evaluate(instructor(), 'grade.release', grade());
    expect(d.allow && d.obligations).toContainEqual({ type: 'audit', eventType: 'grade.release' });
  });

  it('delegates the institution package\'s own actions to its decision point, unchanged', async () => {
    const action = Object.keys(POLICY_ACTIONS)[0];
    // A user with no support role and no ticket is denied by the institution rule, not by this engine.
    const d = await h.policy.evaluate(student(), action, { type: 'support_case', id: 'x', tenantId: TENANT_A, classification: 'student_private' });
    expect(d.allow).toBe(false);
    expect(d.allow === false && d.reasonCode).not.toBe('action_not_declared');
  });

  it('refuses to redeclare an action the institution owns, or to declare one twice', () => {
    const stolen = Object.keys(POLICY_ACTIONS)[0];
    expect(() => new PolicyEngine(h.pip, [{ action: stolen, capability: null, classificationCeiling: 'public' }], () => 0)).toThrow(/institution decision point/);
    expect(() => new PolicyEngine(h.pip, [RULES[0], RULES[0]], () => 0)).toThrow(/twice/);
  });

  it('requirePolicy throws forbidden with the person\'s sentence', async () => {
    await expect(requirePolicy(h.policy, student(), 'grade.release', grade())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(requirePolicy(h.policy, student(), 'grade.release', grade())).rejects.toBeInstanceOf(PlatformError);
    await expect(requirePolicy(h.policy, instructor(), 'grade.release', grade())).resolves.toMatchObject({ allow: true });
  });
});
