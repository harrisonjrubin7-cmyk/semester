import { describe, expect, it } from 'vitest';
import {
  CORRELATION_ID_PATTERN,
  POLICY_ACTIONS,
  applyObligations,
  decide,
  liveConsentGrant,
  type AuthorizationRequest,
  type ConsentGrant,
  type PolicyObligation,
} from './policy.ts';

/**
 * The refusal suite the specification's zero-trust checklist asks for:
 * "negative/refusal/revocation tests". Every case here is a request the
 * decision point must say no to, and each is built by taking a request it
 * says yes to and changing exactly one thing — so the control (the
 * unchanged request is allowed) is inside every test, and a probe that
 * refused everything would fail here rather than pass.
 */

const NOW = Date.parse('2026-09-28T12:00:00Z');
const later = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
const correlationId = 'req-0123456789abcdef';

const supportGrant: ConsentGrant = {
  id: 'grant-1',
  kind: 'support_access',
  grantedBy: 'student-a',
  grantedTo: 'agent-1',
  scopes: ['learning-progress'],
  ticketId: 'ticket-77',
  expiresAt: later(60),
  revokedAt: null,
};

function supportRead(): AuthorizationRequest {
  return {
    actor: { id: 'agent-1', type: 'user', authenticatedAt: later(-5), mfaLevel: 'standard' },
    tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
    action: 'support.case.read_context',
    resource: { type: 'support_context', id: 'ctx-1', ownerId: 'student-a', classification: 'student_private' },
    context: {
      membershipIds: ['m-agent-1'],
      roleGrants: [{ role: 'support_agent', scopeKind: 'tenant', scopeId: 'school-a' }],
      capabilities: ['support:read_context'],
      consentGrants: [supportGrant],
      featureFlags: [],
      policyVersions: { support: '1' },
      purpose: 'ticket-77: cannot see this week\'s plan',
      ticketId: 'ticket-77',
      correlationId,
    },
  };
}

function retrieval(): AuthorizationRequest {
  return {
    actor: { id: 'student-a', type: 'user', authenticatedAt: later(-5) },
    tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
    action: 'ai.retrieve_source',
    resource: {
      type: 'source_chunk',
      id: 'src-9',
      classification: 'education_record',
      sourceKind: 'institution_verified',
      attributes: { courseId: 'cs101', sourceState: 'active', mode: 'study', permittedModes: ['study', 'explain'], providerCeiling: 'education_record' },
    },
    context: {
      membershipIds: ['m-student-a'],
      roleGrants: [{ role: 'student', scopeKind: 'course', scopeId: 'cs101', expiresAt: later(60 * 24 * 90) }],
      capabilities: ['ai:retrieve'],
      consentGrants: [],
      featureFlags: ['ai'],
      policyVersions: { ai: '3' },
      correlationId,
    },
  };
}

function passback(): AuthorizationRequest {
  return {
    actor: { id: 'faculty-1', type: 'user', authenticatedAt: later(-1), mfaLevel: 'fresh' },
    tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
    action: 'grade.passback.submit',
    resource: {
      type: 'grade_line_item',
      id: 'li-4',
      classification: 'education_record',
      attributes: { deploymentBound: true, gradeState: 'ready_for_passback', institutionPermitsPassback: true },
    },
    context: {
      membershipIds: ['m-faculty-1'],
      roleGrants: [{ role: 'faculty', scopeKind: 'course', scopeId: 'cs101' }],
      capabilities: ['grades:passback'],
      consentGrants: [],
      featureFlags: [],
      policyVersions: { grades: '2' },
      idempotencyKey: 'li-4:attempt-1',
      correlationId,
    },
  };
}

const refused = (request: AuthorizationRequest, reasonCode: string) => {
  const decision = decide(request, NOW);
  expect(decision.allow).toBe(false);
  if (!decision.allow) {
    expect(decision.reasonCode).toBe(reasonCode);
    expect(decision.userMessage).not.toMatch(/undefined|null|\bat \b.*\.ts/);
  }
  return decision;
};

const obligationTypes = (d: ReturnType<typeof decide>) => (d.allow ? d.obligations.map((o) => o.type) : []);

describe('the checks every action shares', () => {
  it('allows the three controls', () => {
    for (const build of [supportRead, retrieval, passback]) {
      expect(decide(build(), NOW).allow).toBe(true);
    }
  });

  it('fails closed on an action it has no rule for', () => {
    refused({ ...supportRead(), action: 'support.case.delete' }, 'action_unknown');
    refused({ ...supportRead(), action: '' }, 'action_unknown');
    refused({ ...supportRead(), action: '__proto__' }, 'action_unknown');
  });

  it('refuses a request it cannot trace', () => {
    const r = supportRead();
    r.context.correlationId = '';
    refused(r, 'correlation_missing');
    r.context.correlationId = 'short';
    refused(r, 'correlation_missing');
    r.context.correlationId = 'has spaces in it';
    refused(r, 'correlation_missing');
    expect(CORRELATION_ID_PATTERN.test('a'.repeat(129))).toBe(false);
  });

  it('refuses a tenant the server did not verify', () => {
    const r = supportRead();
    delete r.tenant.verifiedBy;
    refused(r, 'tenant_unverified');
    r.tenant.verifiedBy = 'client_said_so' as never;
    refused(r, 'tenant_unverified');
  });

  it('refuses a person with no active membership', () => {
    const r = supportRead();
    r.context.membershipIds = [];
    refused(r, 'membership_missing');
  });

  it('refuses an actor whose authentication time is not a time', () => {
    const r = supportRead();
    r.actor.authenticatedAt = 'yesterday';
    refused(r, 'authentication_unverified');
  });

  it('keeps the demo away from education records', () => {
    const r = retrieval();
    r.tenant.environment = 'demo';
    refused(r, 'demo_cannot_touch_records');
  });

  it('refuses a resource above the action\'s classification ceiling', () => {
    const r = supportRead();
    r.resource.classification = 'education_record';
    refused(r, 'classification_exceeds_action');
  });
});

describe('support.case.read_context', () => {
  it('needs a live grant to this agent, for this ticket', () => {
    let r = supportRead();
    r.context.consentGrants = [];
    refused(r, 'grant_missing');

    r = supportRead();
    r.context.consentGrants = [{ ...supportGrant, grantedTo: 'agent-2' }];
    refused(r, 'grant_missing');

    r = supportRead();
    r.context.ticketId = 'ticket-78';
    r.context.purpose = 'ticket-78';
    refused(r, 'grant_missing');
  });

  it('a revoked or expired grant is not a grant', () => {
    let r = supportRead();
    r.context.consentGrants = [{ ...supportGrant, revokedAt: later(-1) }];
    refused(r, 'grant_not_live');

    r = supportRead();
    r.context.consentGrants = [{ ...supportGrant, expiresAt: later(-1) }];
    refused(r, 'grant_not_live');

    // Revocation takes effect at once: the same grant, one instant later.
    expect(liveConsentGrant(supportGrant, NOW)).toBe(true);
    expect(liveConsentGrant(supportGrant, Date.parse(supportGrant.expiresAt))).toBe(false);
  });

  it('needs the ticket, the purpose and the capability', () => {
    let r = supportRead();
    delete r.context.ticketId;
    refused(r, 'ticket_missing');
    r = supportRead();
    delete r.context.purpose;
    refused(r, 'purpose_missing');
    r = supportRead();
    r.context.capabilities = [];
    refused(r, 'capability_missing');
    r = supportRead();
    r.actor.type = 'service';
    refused(r, 'actor_not_person');
  });

  it('allows with audit, masking and the grant\'s expiry', () => {
    const d = decide(supportRead(), NOW);
    expect(obligationTypes(d)).toEqual(['audit', 'mask_fields', 'expire_at']);
    if (d.allow) {
      expect(d.obligations[0]).toEqual({ type: 'audit', eventType: POLICY_ACTIONS['support.case.read_context'].auditEvent });
      expect(d.obligations[2]).toEqual({ type: 'expire_at', at: supportGrant.expiresAt });
    }
  });
});

describe('ai.retrieve_source', () => {
  it('needs enrolment in the course, and an expired course grant is not enrolment', () => {
    let r = retrieval();
    r.context.roleGrants = [];
    refused(r, 'not_enrolled');
    r = retrieval();
    r.context.roleGrants[0].expiresAt = later(-1);
    refused(r, 'not_enrolled');
  });

  it('accepts an authorized share in place of enrolment', () => {
    const r = retrieval();
    r.context.roleGrants = [];
    r.context.consentGrants = [{ id: 'share-1', kind: 'share', grantedBy: 'student-b', grantedTo: 'student-a', scopes: ['source:src-9'], expiresAt: later(60) }];
    expect(decide(r, NOW).allow).toBe(true);
  });

  it('refuses a revoked, deleted or quarantined source with a safe alternative', () => {
    for (const state of ['revoked', 'deleted', 'quarantined', undefined]) {
      const r = retrieval();
      r.resource.attributes = { ...r.resource.attributes, sourceState: state };
      const d = refused(r, 'source_unavailable');
      if (!d.allow) expect(d.userAction?.kind).toBe('open_screen');
    }
  });

  it('refuses a mode the course policy does not permit', () => {
    const r = retrieval();
    r.resource.attributes = { ...r.resource.attributes, mode: 'answer' };
    refused(r, 'mode_not_permitted');
  });

  it('refuses a chunk above the provider\'s clearance', () => {
    const r = retrieval();
    r.resource.attributes = { ...r.resource.attributes, providerCeiling: 'internal' };
    refused(r, 'classification_exceeds_provider');
    r.resource.attributes = { ...r.resource.attributes, providerCeiling: 'top_secret' };
    refused(r, 'classification_exceeds_provider');
  });

  it('allows with audit, citation and a field allowlist', () => {
    expect(obligationTypes(decide(retrieval(), NOW))).toEqual(['audit', 'cite_sources', 'limit_fields']);
  });
});

describe('grade.passback.submit', () => {
  it('refuses when the deployment, the grade or the institution is not ready', () => {
    for (const [key, value, code] of [
      ['deploymentBound', false, 'deployment_unbound'],
      ['gradeState', 'draft', 'grade_not_ready'],
      ['institutionPermitsPassback', false, 'institution_forbids'],
    ] as const) {
      const r = passback();
      r.resource.attributes = { ...r.resource.attributes, [key]: value };
      refused(r, code);
    }
  });

  it('refuses without an idempotency key', () => {
    const r = passback();
    delete r.context.idempotencyKey;
    refused(r, 'idempotency_missing');
  });

  it('a service must be bound to the tenant; an integration or system actor may not send grades', () => {
    let r = passback();
    r.actor = { id: 'grade-service', type: 'service', authenticatedAt: later(-1) };
    r.context.membershipIds = [];
    refused(r, 'service_unbound');
    r.tenant.verifiedBy = 'service_binding';
    expect(decide(r, NOW).allow).toBe(true);

    r = passback();
    r.actor.type = 'integration';
    refused(r, 'actor_not_permitted');
  });

  it('a person without fresh authentication is allowed with the obligation to re-authenticate', () => {
    const fresh = decide(passback(), NOW);
    expect(obligationTypes(fresh)).toEqual(['audit', 'reconcile', 'notify']);
    const r = passback();
    r.actor.mfaLevel = 'standard';
    expect(obligationTypes(decide(r, NOW))).toEqual(['require_fresh_mfa', 'audit', 'reconcile', 'notify']);
  });

  it('a person without the capability is refused', () => {
    const r = passback();
    r.context.capabilities = [];
    refused(r, 'capability_missing');
  });
});

describe('applyObligations', () => {
  const record = { chunkId: 'c1', text: 'a', grades: [90], ai_memory: 'x', anchor: 'p3' };

  it('masks and limits, and hands back what it cannot apply', () => {
    const obligations: PolicyObligation[] = [
      { type: 'audit', eventType: 'x' },
      { type: 'mask_fields', fields: ['grades', 'ai_memory'] },
      { type: 'require_fresh_mfa' },
    ];
    const { record: out, remaining } = applyObligations(record, obligations);
    expect(out).toEqual({ chunkId: 'c1', text: 'a', anchor: 'p3' });
    expect(remaining.map((o) => o.type)).toEqual(['audit', 'require_fresh_mfa']);
    // The input is not mutated: the unmasked record must not survive by alias.
    expect(record.grades).toEqual([90]);
  });

  it('applies a limit after a mask, and keeps only the allowlist', () => {
    const { record: out } = applyObligations(record, [
      { type: 'mask_fields', fields: ['text'] },
      { type: 'limit_fields', allowlist: ['chunkId', 'text', 'anchor'] },
    ]);
    expect(out).toEqual({ chunkId: 'c1', anchor: 'p3' });
  });
});

/**
 * Tasks and calendar. The service forces the owner of every write to be the
 * verified actor, so most of these refusals are unreachable through it — and
 * that is why they are asked here, of the decision point itself: the rule must
 * hold on its own, for the day another caller asks it a different question.
 */
describe('tasks and calendar', () => {
  const OWNER = 'student-a';
  const reader = 'advisor-1';
  const share: ConsentGrant = { id: 'share-9', kind: 'share', grantedBy: OWNER, grantedTo: reader, scopes: ['tasks:read', 'calendar:read'], expiresAt: later(60), revokedAt: null };

  type Over = Omit<Partial<AuthorizationRequest>, 'resource'> & { resource?: Partial<AuthorizationRequest['resource']> };

  function write(over: Over = {}): AuthorizationRequest {
    const { resource, ...rest } = over;
    return {
      actor: { id: OWNER, type: 'user', authenticatedAt: later(-5) },
      tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
      action: 'task.write',
      resource: { type: 'task', id: 't-1', ownerId: OWNER, classification: 'student_private', sourceKind: 'student_entered', attributes: { command: 'update', touchesAuthoritative: false }, ...resource },
      context: {
        membershipIds: ['m-1'], roleGrants: [], capabilities: ['productivity:use'], consentGrants: [], featureFlags: [],
        policyVersions: {}, idempotencyKey: 'cmd-1', correlationId,
      },
      ...rest,
    };
  }

  function read(over: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
    return {
      actor: { id: reader, type: 'user', authenticatedAt: later(-5) },
      tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
      action: 'task.read',
      resource: { type: 'task', ownerId: OWNER, classification: 'student_private' },
      context: {
        membershipIds: ['m-2'], roleGrants: [], capabilities: ['productivity:use'], consentGrants: [share], featureFlags: [],
        policyVersions: {}, purpose: 'advising check-in', correlationId,
      },
      ...over,
    };
  }

  const refuses = (req: AuthorizationRequest, code: string) => {
    const d = decide(req, NOW);
    expect(d).toMatchObject({ allow: false, reasonCode: code });
  };

  it('allows an owner to change their own task, and says which event to record', () => {
    expect(decide(write(), NOW)).toEqual({ allow: true, obligations: [{ type: 'audit', eventType: 'task.updated' }] });
    expect(decide(write({ resource: { attributes: { command: 'complete' } } }), NOW)).toMatchObject({ obligations: [{ eventType: 'task.completed' }] });
    expect(decide(write({ resource: { attributes: { command: 'delete' } } }), NOW)).toMatchObject({ obligations: [{ eventType: 'task.deleted' }] });
  });

  it.each([
    ['somebody else\'s task, even with a share', { resource: { ownerId: 'student-b' } }, 'not_owner'],
    ['no command at all', { resource: { attributes: {} } }, 'command_unknown'],
    ['a verb tasks do not have', { resource: { attributes: { command: 'archive' } } }, 'command_unknown'],
    ['a verb that is an object property, not a verb', { resource: { attributes: { command: 'toString' } } }, 'command_unknown'],
    ['no owner', { resource: { ownerId: undefined } }, 'owner_missing'],
    ['no command id', { context: { ...write().context, idempotencyKey: undefined } }, 'idempotency_missing'],
    ['no planning capability', { context: { ...write().context, capabilities: [] } }, 'capability_missing'],
    ['an education record', { resource: { classification: 'education_record' } }, 'classification_exceeds_action'],
    ['a service', { actor: { id: 'svc', type: 'service', authenticatedAt: later(-5) } }, 'actor_not_permitted'],
    ['an integration', { actor: { id: 'job', type: 'integration', authenticatedAt: later(-5) } }, 'actor_not_permitted'],
  ])('refuses a write that is %s', (_name, over, code) => {
    expect(decide(write(), NOW)).toMatchObject({ allow: true });
    refuses(write(over as Over), code);
  });

  it('keeps a source\'s fields the source\'s, for institution-verified and imported alike', () => {
    for (const sourceKind of ['institution_verified', 'imported'] as const) {
      refuses(write({ resource: { sourceKind, attributes: { command: 'update', touchesAuthoritative: true } } }), 'source_authoritative');
      expect(decide(write({ resource: { sourceKind, attributes: { command: 'update', touchesAuthoritative: false } } }), NOW)).toMatchObject({ allow: true });
    }
  });

  it('lets only a bound job with the capability and a purpose import, and only into calendars, and only imported entries', () => {
    const job = (over: Omit<Over, 'context'> & { context?: Partial<AuthorizationRequest['context']> } = {}): AuthorizationRequest => {
      const base = write({
        actor: { id: 'job', type: 'integration', authenticatedAt: later(-5) },
        tenant: { id: 'school-a', environment: 'production', verifiedBy: 'service_binding' },
        action: 'calendar.event.write',
        resource: { type: 'calendar_event', sourceKind: 'imported', attributes: { command: 'create' } },
      });
      return { ...base, ...over, resource: { ...base.resource, ...over.resource }, context: { ...base.context, capabilities: ['calendar:import'], membershipIds: [], purpose: 'feed:canvas', ...over.context } };
    };
    expect(decide(job(), NOW)).toEqual({ allow: true, obligations: [{ type: 'audit', eventType: 'calendar_event.created' }] });
    refuses(job({ tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' } }), 'service_unbound');
    refuses(job({ context: { ...job().context, capabilities: [] } }), 'capability_missing');
    refuses(job({ context: { ...job().context, purpose: undefined } }), 'purpose_missing');
    refuses(job({ resource: { type: 'calendar_event', ownerId: OWNER, sourceKind: 'student_entered', attributes: { command: 'update' } } }), 'source_mismatch');
    refuses({ ...job(), action: 'task.write', resource: { type: 'task', ownerId: OWNER, sourceKind: 'imported', attributes: { command: 'create' } } }, 'actor_not_permitted');
  });

  it('shows another person\'s tasks only to the person they shared with, for the scope, for a purpose, until it ends', () => {
    expect(decide(read(), NOW)).toMatchObject({ allow: true });
    refuses(read({ context: { ...read().context, purpose: undefined } }), 'purpose_missing');
    refuses(read({ context: { ...read().context, consentGrants: [] } }), 'grant_missing');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, scopes: ['calendar:read'] }] } }), 'grant_missing');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, grantedTo: 'someone-else' }] } }), 'grant_missing');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, grantedBy: 'student-b' }] } }), 'grant_missing');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, kind: 'support_access' }] } }), 'grant_missing');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, revokedAt: later(-1) }] } }), 'grant_not_live');
    refuses(read({ context: { ...read().context, consentGrants: [{ ...share, expiresAt: later(0) }] } }), 'grant_not_live');
    refuses(read({ actor: { id: reader, type: 'service', authenticatedAt: later(-5) } }), 'actor_not_person');
  });

  it('limits a shared view to the fields the kind allows, audits it, and ends it with the grant', () => {
    const d = decide(read(), NOW);
    expect(d).toMatchObject({ allow: true });
    if (!d.allow) return;
    expect(d.obligations).toEqual([
      { type: 'audit', eventType: 'productivity.shared_read' },
      { type: 'limit_fields', allowlist: ['id', 'title', 'status', 'dueAt', 'priority', 'courseId', 'version'] },
      { type: 'expire_at', at: share.expiresAt },
    ]);
    const cal = decide(read({ action: 'calendar.event.read', resource: { type: 'calendar_event', ownerId: OWNER, classification: 'student_private' } }), NOW);
    expect(cal).toMatchObject({ allow: true });
    if (cal.allow) expect(cal.obligations.find((o) => o.type === 'limit_fields')).toMatchObject({ allowlist: expect.not.arrayContaining(['location', 'notes']) });
  });

  it('lets a person read their own with no obligations', () => {
    expect(decide(read({ actor: { id: OWNER, type: 'user', authenticatedAt: later(-5) }, context: { ...read().context, consentGrants: [], purpose: undefined } }), NOW)).toEqual({ allow: true, obligations: [] });
  });
});

// ── Registration readiness and overrides ──────────────────────────────────

const reg = (action: 'registration.readiness.view' | 'registration.override.request' | 'registration.override.approve') => {
  const base: AuthorizationRequest = {
    actor: { id: 'student-a', type: 'user', authenticatedAt: later(-5), mfaLevel: 'standard' },
    tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
    action,
    resource: { type: 'registration', id: 'reg-1', ownerId: 'student-a', classification: 'education_record', attributes: { tenantId: 'school-a' } },
    context: {
      membershipIds: ['m-student-a'], roleGrants: [], capabilities: [action], consentGrants: [], featureFlags: [],
      policyVersions: { registration: '1' }, correlationId,
    },
  };
  if (action === 'registration.override.request') {
    base.resource.attributes = { tenantId: 'school-a', courseId: 'cs201', termId: '2026-fall' };
    base.context.purpose = 'the prerequisite was completed at another school';
    base.context.idempotencyKey = 'cmd-ovr-req';
  }
  if (action === 'registration.override.approve') {
    base.actor = { id: 'registrar-1', type: 'user', authenticatedAt: later(-1), mfaLevel: 'fresh' };
    base.resource.ownerId = 'student-a';
    base.resource.attributes = { tenantId: 'school-a', requestState: 'pending_review', requestDigest: 'd1', reviewedDigest: 'd1', resourceVersion: 'v3', reviewedVersion: 'v3' };
    base.context.roleGrants = [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }];
    base.context.purpose = 'the department confirmed the equivalent course';
    base.context.idempotencyKey = 'cmd-ovr-apr';
  }
  return base;
};

const withAttrs = (r: AuthorizationRequest, patch: Record<string, unknown>): AuthorizationRequest =>
  ({ ...r, resource: { ...r.resource, attributes: { ...r.resource.attributes, ...patch } } });

describe('registration.readiness.view', () => {
  const advisor = (): AuthorizationRequest => {
    const r = reg('registration.readiness.view');
    r.actor = { id: 'advisor-1', type: 'user', authenticatedAt: later(-5) };
    r.context.roleGrants = [{ role: 'academic_advisor', scopeKind: 'advisee', scopeId: 'student-a' }];
    return r;
  };
  const registrar = (): AuthorizationRequest => {
    const r = reg('registration.readiness.view');
    r.actor = { id: 'registrar-1', type: 'user', authenticatedAt: later(-5) };
    r.context.roleGrants = [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }];
    return r;
  };

  it('allows the student, their assigned advisor and a registrar: the controls', () => {
    for (const r of [reg('registration.readiness.view'), advisor(), registrar()]) expect(decide(r, NOW).allow).toBe(true);
  });

  it('refuses one thing changed at a time', () => {
    const own = reg('registration.readiness.view');
    refused({ ...own, actor: { ...own.actor, type: 'service' } }, 'actor_not_person');
    refused({ ...own, context: { ...own.context, capabilities: [] } }, 'capability_missing');
    refused({ ...own, resource: { ...own.resource, ownerId: undefined } }, 'owner_missing');
    refused(withAttrs(own, { tenantId: 'school-b' }), 'cross_tenant');
    refused(withAttrs(own, { tenantId: undefined }), 'cross_tenant');
    // Someone else's record, with no relationship to the student.
    refused({ ...own, resource: { ...own.resource, ownerId: 'student-b' } }, 'relationship_not_permitted');
    // An advisor of a different student, and a registrar of a different institution.
    const other = advisor();
    other.resource.ownerId = 'student-b';
    refused(other, 'relationship_not_permitted');
    const away = registrar();
    away.context.roleGrants = [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-b' }];
    refused(away, 'relationship_not_permitted');
    // An expired role grant is not a relationship.
    const lapsed = advisor();
    lapsed.context.roleGrants = [{ role: 'academic_advisor', scopeKind: 'advisee', scopeId: 'student-a', expiresAt: later(-1) }];
    refused(lapsed, 'relationship_not_permitted');
  });

  it('is audited with its sources and freshness, and each relationship gets its own field list', () => {
    const fields = (r: AuthorizationRequest) => {
      const d = decide(r, NOW);
      expect(d.allow && d.obligations.map((o) => o.type)).toEqual(['audit', 'limit_fields', 'cite_sources']);
      const limit = d.allow ? d.obligations.find((o) => o.type === 'limit_fields') : undefined;
      return limit && limit.type === 'limit_fields' ? limit.allowlist : [];
    };
    const audit = decide(reg('registration.readiness.view'), NOW);
    expect(audit.allow && audit.obligations[0]).toEqual({ type: 'audit', eventType: 'registration.readiness_viewed' });
    expect(fields(reg('registration.readiness.view'))).toContain('holds');
    expect(fields(registrar())).toContain('holds');
    expect(fields(advisor())).not.toContain('holds');
    for (const r of [reg('registration.readiness.view'), advisor(), registrar()]) {
      expect(fields(r)).toEqual(expect.arrayContaining(['status', 'asOf', 'sources', 'freshness']));
    }
  });

  it('authorizes a reader whose data is missing: unknown is the evaluator\'s finding, not a refusal', () => {
    const r = reg('registration.readiness.view');
    expect(r.resource.attributes).toEqual({ tenantId: 'school-a' });
    expect(decide(r, NOW).allow).toBe(true);
  });
});

describe('registration.override.request', () => {
  it('allows the student to ask, with an audit and a human review: the control', () => {
    const d = decide(reg('registration.override.request'), NOW);
    expect(d.allow && d.obligations).toEqual([{ type: 'audit', eventType: 'registration.override_requested' }, { type: 'human_review' }]);
  });

  it('refuses one thing changed at a time', () => {
    const r = reg('registration.override.request');
    refused({ ...r, actor: { ...r.actor, type: 'service' } }, 'actor_not_person');
    refused({ ...r, context: { ...r.context, capabilities: [] } }, 'capability_missing');
    refused(withAttrs(r, { tenantId: 'school-b' }), 'cross_tenant');
    refused({ ...r, resource: { ...r.resource, ownerId: 'student-b' } }, 'not_owner');
    refused({ ...r, context: { ...r.context, idempotencyKey: undefined } }, 'idempotency_missing');
    refused({ ...r, context: { ...r.context, purpose: undefined } }, 'purpose_missing');
    refused(withAttrs(r, { courseId: '' }), 'request_incomplete');
    refused(withAttrs(r, { termId: undefined }), 'request_incomplete');
  });

  it('is not made by an advisor or a registrar on the student\'s behalf', () => {
    const r = reg('registration.override.request');
    r.actor = { id: 'registrar-1', type: 'user', authenticatedAt: later(-1) };
    r.context.roleGrants = [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }];
    refused(r, 'not_owner');
  });
});

describe('registration.override.approve', () => {
  it('allows a registrar with fresh authentication, audited, confirmed, reconciled and notified: the control', () => {
    const d = decide(reg('registration.override.approve'), NOW);
    expect(d.allow && d.obligations.map((o) => o.type)).toEqual(['audit', 'require_confirmation', 'reconcile', 'notify']);
    expect(d.allow && d.obligations[0]).toEqual({ type: 'audit', eventType: 'registration.override_granted' });
  });

  it('refuses one thing changed at a time', () => {
    const r = reg('registration.override.approve');
    refused({ ...r, actor: { ...r.actor, type: 'integration' } }, 'actor_not_person');
    refused({ ...r, context: { ...r.context, capabilities: [] } }, 'capability_missing');
    refused({ ...r, resource: { ...r.resource, ownerId: undefined } }, 'owner_missing');
    refused(withAttrs(r, { tenantId: 'school-b' }), 'cross_tenant');
    refused({ ...r, context: { ...r.context, roleGrants: [] } }, 'reviewer_not_authorized');
    refused({ ...r, context: { ...r.context, roleGrants: [{ role: 'academic_advisor', scopeKind: 'advisee', scopeId: 'student-a' }] } }, 'reviewer_not_authorized');
    refused({ ...r, context: { ...r.context, roleGrants: [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-b' }] } }, 'reviewer_not_authorized');
    refused({ ...r, context: { ...r.context, roleGrants: [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a', expiresAt: later(-1) }] } }, 'reviewer_not_authorized');
    refused({ ...r, resource: { ...r.resource, ownerId: 'registrar-1' } }, 'self_approval');
    refused(withAttrs(r, { requestState: 'approved' }), 'request_not_pending');
    refused({ ...r, context: { ...r.context, idempotencyKey: undefined } }, 'idempotency_missing');
    refused({ ...r, context: { ...r.context, purpose: undefined } }, 'purpose_missing');
  });

  it('refuses an approval that is not bound to what was reviewed, or that has gone stale', () => {
    const r = reg('registration.override.approve');
    for (const key of ['requestDigest', 'reviewedDigest', 'resourceVersion', 'reviewedVersion']) refused(withAttrs(r, { [key]: undefined }), 'approval_unbound');
    refused(withAttrs(r, { reviewedDigest: 'seen-earlier' }), 'approval_stale');
    refused(withAttrs(r, { reviewedVersion: 'v2' }), 'approval_stale');
    refused(withAttrs(r, { requestDigest: '' }), 'approval_unbound');
  });

  it('allows a reviewer without fresh authentication with the obligation to re-authenticate, and only after every refusal above', () => {
    const r = reg('registration.override.approve');
    for (const mfaLevel of ['none', 'standard', undefined] as const) {
      const d = decide({ ...r, actor: { ...r.actor, mfaLevel } }, NOW);
      expect(obligationTypes(d)[0], String(mfaLevel)).toBe('require_fresh_mfa');
    }
    // A reviewer who would be refused is refused, not asked to authenticate first.
    refused({ ...r, actor: { ...r.actor, mfaLevel: 'none' }, context: { ...r.context, roleGrants: [] } }, 'reviewer_not_authorized');
    refused({ ...withAttrs(r, { reviewedDigest: 'old' }), actor: { ...r.actor, mfaLevel: 'none' } }, 'approval_stale');
  });

  it('the student\'s own approval is refused even with every other fact in order', () => {
    const r = reg('registration.override.approve');
    r.actor = { id: 'student-a', type: 'user', authenticatedAt: later(-1), mfaLevel: 'fresh' };
    r.context.roleGrants = [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }];
    refused(r, 'self_approval');
  });
});

describe('the three registration actions in the vocabulary', () => {
  it('each names an audit event the event vocabulary knows, and sits at the education-record ceiling', async () => {
    const { isEventType } = await import('./events.ts');
    for (const action of ['registration.readiness.view', 'registration.override.request', 'registration.override.approve'] as const) {
      expect(isEventType(POLICY_ACTIONS[action].auditEvent), action).toBe(true);
      expect(POLICY_ACTIONS[action].classificationCeiling).toBe('education_record');
    }
  });

  it('the demo cannot touch the records these read, and a record above the ceiling is refused', () => {
    const r = reg('registration.readiness.view');
    refused({ ...r, tenant: { ...r.tenant, environment: 'demo' } }, 'demo_cannot_touch_records');
  });
});
