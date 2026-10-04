import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../kernel';
import { createAuthorizer, decidePersonal, PERSONAL_ACTIONS, type InstitutionalFacts } from './index';

const clock = fixedClock('2026-10-05');
const me = { id: 'u1' };

describe('policy: personal actions', () => {
  it('allows the actor’s own things, on or off an account', () => {
    for (const action of PERSONAL_ACTIONS) {
      expect(decidePersonal(me, action, {})).toEqual({ allow: true, obligations: [] });
      expect(decidePersonal({ id: null }, action, {})).toEqual({ allow: true, obligations: [] });
      expect(decidePersonal(me, action, { ownerId: 'u1' }).allow).toBe(true);
    }
  });

  it('refuses another account’s things — and a signed-out device holding them', () => {
    const other = decidePersonal(me, 'tasks.complete', { ownerId: 'u2' });
    expect(other).toMatchObject({ allow: false, reasonCode: 'not_owner' });
    expect(decidePersonal({ id: null }, 'tasks.complete', { ownerId: 'u2' })).toMatchObject({ allow: false, reasonCode: 'not_owner' });
  });

  it('refuses an action it has no name for: fail closed', () => {
    expect(decidePersonal(me, 'tasks.delete_everything')).toMatchObject({ allow: false, reasonCode: 'action_unknown' });
  });
});

describe('policy: the institutional route reaches the real decision point', () => {
  // A request `decide()` allows, and then one change at a time that it must
  // refuse. The first is the control: a wrapper that refused everything, or
  // that never reached the evaluator, would fail it.
  const facts = (over: Partial<InstitutionalFacts['context']> = {}, actor: Partial<InstitutionalFacts['actor']> = {}): InstitutionalFacts => ({
    actor: { id: 'u1', type: 'user', authenticatedAt: '2026-10-05T10:00:00Z', mfaLevel: 'fresh', ...actor },
    tenant: { id: 'school-1', environment: 'production', verifiedBy: 'membership' },
    context: {
      membershipIds: ['m1'],
      roleGrants: [{ role: 'student', scopeKind: 'course', scopeId: 'c1' }],
      capabilities: ['ai:retrieve'],
      consentGrants: [],
      featureFlags: [],
      policyVersions: {},
      ...over,
    },
  });
  const retrieve = {
    action: 'ai.retrieve_source',
    correlationId: 'req-0001-abcdef',
    resource: { type: 'source', id: 's1', classification: 'internal' as const, attributes: { courseId: 'c1', sourceState: 'active', mode: 'explain', permittedModes: ['explain'], providerCeiling: 'student_private' } },
  };
  const withFacts = (f: InstitutionalFacts | null) => createAuthorizer({ clock, institutional: { resolve: () => f } });

  it('allows what the evaluator allows, and hands back its obligations', () => {
    const decision = withFacts(facts()).authorize(me, retrieve);
    expect(decision.allow).toBe(true);
    if (decision.allow) expect(decision.obligations.map((o) => o.type)).toEqual(['audit', 'cite_sources', 'limit_fields']);
  });

  it('refuses when the evaluator refuses: no capability, and not enrolled', () => {
    expect(withFacts(facts({ capabilities: [] })).authorize(me, retrieve)).toMatchObject({ allow: false, reasonCode: 'capability_missing' });
    expect(withFacts(facts({ roleGrants: [] })).authorize(me, retrieve)).toMatchObject({ allow: false, reasonCode: 'not_enrolled' });
  });

  it('fails closed with no server facts: a browser alone cannot establish a tenant', () => {
    expect(withFacts(null).authorize(me, retrieve)).toMatchObject({ allow: false, reasonCode: 'tenant_unverified' });
    expect(createAuthorizer({ clock }).authorize(me, retrieve)).toMatchObject({ allow: false, reasonCode: 'tenant_unverified' });
  });

  it('passes the correlation id through, and the decision point refuses one it cannot trace', () => {
    expect(withFacts(facts()).authorize(me, { ...retrieve, correlationId: 'x' })).toMatchObject({ allow: false, reasonCode: 'correlation_missing' });
  });

  it('judges expiry by the injected clock, not the wall clock', () => {
    const expiring = facts({ roleGrants: [{ role: 'student', scopeKind: 'course', scopeId: 'c1', expiresAt: '2026-10-05T18:00:00Z' }] });
    const before = createAuthorizer({ clock: { now: () => Date.parse('2026-10-05T17:59:00Z'), today: () => '2026-10-05' }, institutional: { resolve: () => expiring } });
    const after = createAuthorizer({ clock: { now: () => Date.parse('2026-10-05T18:01:00Z'), today: () => '2026-10-05' }, institutional: { resolve: () => expiring } });
    expect(before.authorize(me, retrieve).allow).toBe(true);
    expect(after.authorize(me, retrieve)).toMatchObject({ allow: false, reasonCode: 'not_enrolled' });
  });
});

describe('policy: enforce', () => {
  const authorizer = createAuthorizer({ clock });

  it('returns the obligations of an allowance', () => {
    expect(authorizer.enforce(me, { action: 'tasks.complete', correlationId: 'req-0001-abcdef' })).toEqual({ ok: true, value: [] });
  });

  it('turns a refusal into the app’s one error shape, carrying what the person can do', () => {
    const r = authorizer.enforce(me, { action: 'tasks.complete', resource: { ownerId: 'u2' }, correlationId: 'req-0001-abcdef' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatchObject({ kind: 'forbidden', code: 'policy.not_owner', retryable: false, correlationId: 'req-0001-abcdef', userAction: { kind: 'open_screen' } });
    }
  });
});
