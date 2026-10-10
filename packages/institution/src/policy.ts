/**
 * The policy decision point: one place that answers "may this actor do this
 * to that", and the vocabulary every caller has to ask it in.
 *
 * Authorization in this repository is enforced in three places today, each
 * right for its layer: Postgres row-level security at the data (ADR 0002), the
 * gateway's adapters at the institution boundary (`server/institution/
 * gateway.ts`), and the edge functions' gates at the API. What none of them
 * had was a shared shape for the *question* — so each new sensitive action
 * grew its own ad hoc check, with its own idea of what a tenant is, whether an
 * expired grant counts, and what "allowed, but audited" looks like. This
 * module is that shape (`AuthorizationRequest` → `AuthorizationDecision`) and
 * the evaluator that fails closed on anything it has not been told about.
 *
 * ## What it is not
 *
 * Not a replacement for row-level security, which stays the boundary at the
 * data layer whatever this says. Not a rules engine: the rules are functions
 * in this file, one per action, because a rule written in TypeScript is
 * type-checked against the request it reads and a rule written in JSON is not.
 * And not yet wired into every route — see ADR 0007 for which callers ask it
 * and which still decide for themselves.
 *
 * ## Fails closed, and says why
 *
 * An action this file has no rule for is denied, not allowed. A tenant the
 * server has not verified is denied. A role grant past its expiry is not a
 * grant. Every denial carries a `reasonCode` for the audit row and a
 * `userMessage` for the person, and never a stack, a query or another
 * account's data. Every allowance carries its obligations — audit, masking,
 * fresh MFA, expiry — and the enforcement point that ignores them has not
 * enforced the decision.
 *
 * See `docs/architecture/0007-policy-decision-point.md`.
 */

export const POLICY_ENVIRONMENTS = ['production', 'staging', 'demo'] as const;
export type PolicyEnvironment = (typeof POLICY_ENVIRONMENTS)[number];

export const RESOURCE_CLASSIFICATIONS = ['public', 'internal', 'student_private', 'education_record'] as const;
export type ResourceClassification = (typeof RESOURCE_CLASSIFICATIONS)[number];

export const SOURCE_KINDS = ['institution_verified', 'imported', 'student_entered', 'estimated'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const ACTOR_TYPES = ['user', 'service', 'integration', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const MFA_LEVELS = ['none', 'standard', 'fresh'] as const;
export type MfaLevel = (typeof MFA_LEVELS)[number];

/**
 * How the server established which tenant this request belongs to.
 *
 * Never the client's say-so. A request that arrives with a tenant id and no
 * verification is one whose tenant is unknown, and is refused as such.
 */
export const TENANT_VERIFICATIONS = ['membership', 'sso_issuer', 'lti_deployment', 'service_binding'] as const;
export type TenantVerification = (typeof TENANT_VERIFICATIONS)[number];

/** A correlation id: what the gateway accepts in `X-Correlation-Id`, and what an audit row may hold. */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * The action vocabulary. Adding a line here is a decision: it needs a rule in
 * `RULES` below, a test in `policy.test.ts` that shows the rule refusing, and
 * an audit event type in `events.ts`.
 */
export const POLICY_ACTIONS = {
  'support.case.read_context': {
    description: 'A support agent reads a student\'s support-scoped context for one ticket.',
    auditEvent: 'support.context_read',
    classificationCeiling: 'student_private',
  },
  'ai.retrieve_source': {
    description: 'An AI request retrieves a chunk of course material for grounding.',
    auditEvent: 'ai.retrieval_completed',
    classificationCeiling: 'education_record',
  },
  'grade.passback.submit': {
    description: 'A grade line item is sent to the institution\'s gradebook.',
    auditEvent: 'grade.passback_requested',
    classificationCeiling: 'education_record',
  },
  'task.read': {
    description: 'A person reads a task list: their own, or another person\'s under a live share grant.',
    auditEvent: 'productivity.shared_read',
    classificationCeiling: 'student_private',
  },
  'task.write': {
    description: 'A task is created, changed, completed, reopened or deleted by its owner.',
    auditEvent: 'task.updated',
    classificationCeiling: 'student_private',
  },
  'calendar.event.read': {
    description: 'A person reads calendar events: their own, or another person\'s under a live share grant.',
    auditEvent: 'productivity.shared_read',
    classificationCeiling: 'student_private',
  },
  'calendar.event.write': {
    description: 'A calendar event is created, changed or deleted by its owner, or imported by a bound feed job.',
    auditEvent: 'calendar_event.updated',
    classificationCeiling: 'student_private',
  },
  'registration.readiness.view': {
    description: 'A student, their assigned advisor or an authorized registrar reads a source-aware registration-readiness checklist.',
    auditEvent: 'registration.readiness_viewed',
    classificationCeiling: 'education_record',
  },
  'registration.readiness.request': {
    description: 'A student requests a tenant-bound evaluation of their own registration readiness.',
    auditEvent: 'registration.readiness_requested',
    classificationCeiling: 'education_record',
  },
  'registration.override.request': {
    description: 'A student asks the registrar\'s office to review an exception to a registration condition.',
    auditEvent: 'registration.override_requested',
    classificationCeiling: 'education_record',
  },
  'registration.override.approve': {
    description: 'An authorized registrar approves a pending override request, bound to the request and record version they reviewed.',
    auditEvent: 'registration.override_granted',
    classificationCeiling: 'education_record',
  },
} as const satisfies Record<string, { description: string; auditEvent: string; classificationCeiling: ResourceClassification }>;

export type PolicyAction = keyof typeof POLICY_ACTIONS;

export const isPolicyAction = (value: unknown): value is PolicyAction =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(POLICY_ACTIONS, value);

export interface RoleGrant {
  role: string;
  scopeKind: string;
  scopeId: string;
  expiresAt?: string;
}

/**
 * A consent or share grant the policy information point resolved for this
 * request — the row, not just its id, because a rule has to read its scopes,
 * its ticket and whether it has been revoked.
 */
export interface ConsentGrant {
  id: string;
  kind: 'support_access' | 'share';
  grantedBy: string;
  grantedTo: string;
  scopes: string[];
  ticketId?: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface AuthorizationRequest {
  actor: {
    id: string;
    type: ActorType;
    authenticatedAt: string;
    mfaLevel?: MfaLevel;
    sessionId?: string;
  };
  tenant: {
    id: string;
    environment: PolicyEnvironment;
    verifiedBy?: TenantVerification;
  };
  action: string;
  resource: {
    type: string;
    id?: string;
    ownerId?: string;
    classification?: ResourceClassification;
    sourceKind?: SourceKind;
    /** Object state the rule for this action reads; see each rule for its keys. */
    attributes?: Record<string, unknown>;
  };
  context: {
    membershipIds: string[];
    roleGrants: RoleGrant[];
    capabilities: string[];
    consentGrants: ConsentGrant[];
    featureFlags: string[];
    policyVersions: Record<string, string>;
    purpose?: string;
    ticketId?: string;
    idempotencyKey?: string;
    correlationId: string;
  };
}

/** Something the person can do about a refusal, in the shape the error envelope carries. */
export interface UserAction {
  label: string;
  kind: 'external_link' | 'open_screen' | 'retry_later' | 'contact_support';
  href?: string;
}

export type PolicyObligation =
  | { type: 'audit'; eventType: string }
  | { type: 'require_confirmation' }
  | { type: 'require_fresh_mfa' }
  | { type: 'mask_fields'; fields: string[] }
  | { type: 'limit_fields'; allowlist: string[] }
  | { type: 'expire_at'; at: string }
  | { type: 'watermark' }
  | { type: 'rate_limit'; bucket: string }
  | { type: 'human_review' }
  | { type: 'cite_sources' }
  | { type: 'reconcile' }
  | { type: 'notify'; audience: 'actor' | 'subject' };

export type AuthorizationDecision =
  | { allow: true; obligations: PolicyObligation[] }
  | { allow: false; reasonCode: string; userMessage: string; userAction?: UserAction };

/** What every rule is given after the checks common to all of them have passed. */
interface Evaluated {
  request: AuthorizationRequest;
  now: number;
  /** Role grants that are current; expired ones are gone before any rule sees them. */
  grants: RoleGrant[];
  has: (capability: string) => boolean;
}

type Rule = (e: Evaluated) => AuthorizationDecision;

const deny = (reasonCode: string, userMessage: string, userAction?: UserAction): AuthorizationDecision =>
  userAction ? { allow: false, reasonCode, userMessage, userAction } : { allow: false, reasonCode, userMessage };

const allow = (...obligations: PolicyObligation[]): AuthorizationDecision => ({ allow: true, obligations });

const parseTime = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
};

/** A grant that is live at `now`: not revoked, not expired, and its expiry parseable. */
export function liveConsentGrant(grant: ConsentGrant, now: number): boolean {
  if (grant.revokedAt) return false;
  const expires = parseTime(grant.expiresAt);
  return expires !== null && expires > now;
}

/**
 * The three high-risk rules from the architecture specification, verbatim in
 * their requirements. Each reads only the request; the caller resolves the
 * facts (grants, source state, gradebook state) before asking, so the decision
 * is a pure function of what it was shown and a test can show it refusing.
 */
const RULES: Record<PolicyAction, Rule> = {
  'task.read': (e) => productivityRead('task')(e),
  'task.write': (e) => productivityWrite('task')(e),
  'calendar.event.read': (e) => productivityRead('calendar')(e),
  'calendar.event.write': (e) => productivityWrite('calendar')(e),

  /*
   * Readiness is read by the student, their assigned advisor or a registrar,
   * for a record that belongs to *this* institution, and every read is audited
   * with the sources and freshness it rests on. The field list is the
   * relationship's: an advisor does not see another office's holds.
   */
  'registration.readiness.view': ({ request, grants, has }) => {
    const { actor, tenant, resource } = request;
    const a = resource.attributes ?? {};
    if (actor.type !== 'user') return deny('actor_not_person', 'Registration readiness is read by a signed-in person, not by a service.');
    if (!has('registration.readiness.view')) return deny('capability_missing', 'Your role does not include registration readiness.');
    if (!resource.ownerId) return deny('owner_missing', 'Whose readiness this is has to be known before it is read.');
    if (a.tenantId !== tenant.id) return deny('cross_tenant', 'This record belongs to a different institution.');
    const relationship = registrationRelationship(request, grants);
    if (!relationship) return deny('relationship_not_permitted', 'You are not this student\'s advisor or a registrar at this institution.');
    return allow(
      { type: 'audit', eventType: POLICY_ACTIONS['registration.readiness.view'].auditEvent },
      { type: 'limit_fields', allowlist: READINESS_FIELDS[relationship] },
      { type: 'cite_sources' },
    );
  },

  /*
   * A readiness request starts an evaluation; it does not register, override,
   * or change an institutional record. The authenticated student may request
   * only their own record, in their verified tenant, for a named term. The
   * idempotency key is mandatory because the durable command boundary uses it
   * as the evaluation id, making a retried HTTP request converge on one row.
   */
  'registration.readiness.request': ({ request, has }) => {
    const { actor, tenant, resource, context } = request;
    const a = resource.attributes ?? {};
    if (actor.type !== 'user') return deny('actor_not_person', 'A readiness evaluation is requested by the student, not by a service.');
    if (!has('registration.readiness.request')) return deny('capability_missing', 'Your role cannot request a registration-readiness evaluation.');
    if (a.tenantId !== tenant.id) return deny('cross_tenant', 'This record belongs to a different institution.');
    if (!resource.ownerId || resource.ownerId !== actor.id) return deny('not_owner', 'Only the student can request their own registration-readiness evaluation.');
    if (!context.idempotencyKey) return deny('idempotency_missing', 'A request needs a command id so a retry cannot create another evaluation.');
    if (!nonEmptyString(a.termId)) return deny('request_incomplete', 'Name the term to evaluate.');
    return allow({ type: 'audit', eventType: POLICY_ACTIONS['registration.readiness.request'].auditEvent });
  },

  /*
   * Only the student asks for their own exception, with a stated reason and a
   * command id, for a named course and term. The request opens a review task;
   * it grants nothing and enrols no one.
   */
  'registration.override.request': ({ request, has }) => {
    const { actor, tenant, resource, context } = request;
    const a = resource.attributes ?? {};
    if (actor.type !== 'user') return deny('actor_not_person', 'An override is requested by the student, not by a service.');
    if (!has('registration.override.request')) return deny('capability_missing', 'Your role cannot request a registration override.');
    if (!resource.ownerId) return deny('owner_missing', 'Whose registration this is has to be known before an override is requested.');
    if (a.tenantId !== tenant.id) return deny('cross_tenant', 'This record belongs to a different institution.');
    if (resource.ownerId !== actor.id) return deny('not_owner', 'Only the student can ask for their own override. An advisor can message the registrar\'s office.');
    if (!context.idempotencyKey) return deny('idempotency_missing', 'A request needs a command id so a retry cannot file it twice.');
    if (!context.purpose) return deny('purpose_missing', 'Say why the exception is needed; the reviewer reads it.');
    if (!nonEmptyString(a.courseId) || !nonEmptyString(a.termId)) return deny('request_incomplete', 'Name the course and the term the override is for.');
    return allow(
      { type: 'audit', eventType: POLICY_ACTIONS['registration.override.request'].auditEvent },
      { type: 'human_review' },
    );
  },

  /*
   * An approval is the reviewer's decision about *one* request in *one* state,
   * not a standing permission. It needs a registrar of this institution who is
   * not the student, a request still pending review, a reason, and a binding:
   * the digest and record version the reviewer saw must be the ones that are
   * current, or the approval is stale and the request goes back for review.
   * A reviewer without fresh authentication is allowed *with the obligation* to
   * re-authenticate. Approving an override is not enrolling: the obligation to
   * reconcile is the saga waiting for the registration domain's own result.
   */
  'registration.override.approve': ({ request, grants, has }) => {
    const { actor, tenant, resource, context } = request;
    const a = resource.attributes ?? {};
    if (actor.type !== 'user') return deny('actor_not_person', 'An override is approved by a person, not by a service.');
    if (!has('registration.override.approve')) return deny('capability_missing', 'Your role cannot approve a registration override.');
    if (!resource.ownerId) return deny('owner_missing', 'Whose registration this is has to be known before an override is approved.');
    if (a.tenantId !== tenant.id) return deny('cross_tenant', 'This record belongs to a different institution.');
    if (!isRegistrar(request, grants)) return deny('reviewer_not_authorized', 'Only a registrar at this institution can approve an override.');
    if (resource.ownerId === actor.id) return deny('self_approval', 'You cannot approve your own override.');
    if (a.requestState !== 'pending_review') return deny('request_not_pending', 'This request is not waiting for review.');
    if (!nonEmptyString(a.requestDigest) || !nonEmptyString(a.reviewedDigest) || !nonEmptyString(a.resourceVersion) || !nonEmptyString(a.reviewedVersion)) {
      return deny('approval_unbound', 'An approval has to say which request and which version of the record was reviewed.');
    }
    if (a.requestDigest !== a.reviewedDigest || a.resourceVersion !== a.reviewedVersion) {
      return deny('approval_stale', 'The request or the record changed after you reviewed it. Review it again.');
    }
    if (!context.idempotencyKey) return deny('idempotency_missing', 'An approval needs a command id so a retry cannot apply it twice.');
    if (!context.purpose) return deny('purpose_missing', 'Say why the override is granted; it is recorded.');
    const obligations: PolicyObligation[] = [
      { type: 'audit', eventType: POLICY_ACTIONS['registration.override.approve'].auditEvent },
      { type: 'require_confirmation' },
      { type: 'reconcile' },
      { type: 'notify', audience: 'subject' },
    ];
    if (actor.mfaLevel !== 'fresh') obligations.unshift({ type: 'require_fresh_mfa' });
    return allow(...obligations);
  },

  /*
   * A support agent does not get generic student-record access. They get one
   * student's support context when there is a live student-created grant to
   * *them*, naming *this* ticket, within its scope and window — and the read
   * is audited and masked.
   */
  'support.case.read_context': ({ request, now, has }) => {
    const { actor, context, resource } = request;
    if (actor.type !== 'user') return deny('actor_not_person', 'Support context is read by a person, not a service.');
    if (!has('support:read_context')) return deny('capability_missing', 'Your role does not include reading support context.');
    if (!context.ticketId) return deny('ticket_missing', 'Open the ticket first; support context is read for one ticket at a time.');
    if (!context.purpose) return deny('purpose_missing', 'Say what the read is for; it is recorded with the ticket.');
    const grant = context.consentGrants.find((g) =>
      g.kind === 'support_access'
      && g.grantedTo === actor.id
      && (resource.ownerId === undefined || g.grantedBy === resource.ownerId)
      && g.ticketId === context.ticketId,
    );
    if (!grant) return deny('grant_missing', 'The student has not granted support access for this ticket.');
    if (!liveConsentGrant(grant, now)) return deny('grant_not_live', 'The student\'s support grant has ended. Ask them to grant it again.');
    if (!grant.scopes.includes('learning-progress')) return deny('scope_missing', 'This grant does not cover the context asked for.');
    return allow(
      { type: 'audit', eventType: POLICY_ACTIONS['support.case.read_context'].auditEvent },
      { type: 'mask_fields', fields: ['grades', 'ai_memory', 'accommodations', 'health'] },
      { type: 'expire_at', at: grant.expiresAt },
    );
  },

  /*
   * An AI request may ground on a chunk only when the person could read it
   * themselves, the source is still live, the course's AI policy permits the
   * mode, and the chunk's classification is one the chosen provider is
   * cleared for. A refusal names a safe alternative rather than a wall.
   */
  'ai.retrieve_source': ({ request, grants, has }) => {
    const { actor, resource, context } = request;
    const a = resource.attributes ?? {};
    if (actor.type !== 'user') return deny('actor_not_person', 'Retrieval runs for a signed-in person.');
    const courseId = typeof a.courseId === 'string' ? a.courseId : '';
    // `grants`, not `context.roleGrants`: a course grant past its expiry is not enrolment.
    const enrolled = courseId !== '' && grants.some((g) => g.scopeKind === 'course' && g.scopeId === courseId);
    const shared = context.consentGrants.some((g) => g.kind === 'share' && g.grantedTo === actor.id && g.scopes.includes(`source:${resource.id ?? ''}`));
    if (!enrolled && !shared) return deny('not_enrolled', 'This material is not in a course you belong to.');
    if (!has('ai:retrieve')) return deny('capability_missing', 'AI retrieval is not enabled for your role.');
    if (a.sourceState !== 'active') {
      return deny('source_unavailable', 'That source is no longer available to ground on.', { label: 'Open the course materials', kind: 'open_screen' });
    }
    const mode = typeof a.mode === 'string' ? a.mode : '';
    const permitted = Array.isArray(a.permittedModes) ? a.permittedModes : [];
    if (!mode || !permitted.includes(mode)) {
      return deny('mode_not_permitted', 'This course\'s AI policy does not allow that mode here.', { label: 'See what this course allows', kind: 'open_screen' });
    }
    const ceiling = a.providerCeiling;
    if (!resource.classification || !isClassification(ceiling) || rank(resource.classification) > rank(ceiling)) {
      return deny('classification_exceeds_provider', 'This material is not cleared for the selected provider.');
    }
    return allow(
      { type: 'audit', eventType: POLICY_ACTIONS['ai.retrieve_source'].auditEvent },
      { type: 'cite_sources' },
      { type: 'limit_fields', allowlist: ['chunkId', 'text', 'anchor', 'sourceId', 'sourceKind'] },
    );
  },

  /*
   * A grade leaves for the institution's gradebook only when the line item is
   * ready, the tenant's deployment is bound, the institution permits passback,
   * the call is idempotent, and — when a person triggered it — their
   * authentication is fresh. A person without fresh MFA is not refused; they
   * are allowed *with the obligation* to re-authenticate, which the
   * enforcement point turns into a challenge.
   */
  'grade.passback.submit': ({ request, has }) => {
    const { actor, tenant, resource, context } = request;
    const a = resource.attributes ?? {};
    if (actor.type === 'user' && !has('grades:passback')) return deny('capability_missing', 'Your role cannot send grades to the gradebook.');
    if (actor.type === 'service' && tenant.verifiedBy !== 'service_binding') return deny('service_unbound', 'This service is not bound to the tenant it is acting for.');
    if (actor.type === 'integration' || actor.type === 'system') return deny('actor_not_permitted', 'Grade passback is sent by course staff or the bound grade service.');
    if (a.deploymentBound !== true) return deny('deployment_unbound', 'This course is not linked to the institution\'s gradebook.');
    if (a.gradeState !== 'ready_for_passback') return deny('grade_not_ready', 'This grade is not ready to send.');
    if (a.institutionPermitsPassback !== true) return deny('institution_forbids', 'The institution has not enabled grade passback for this course.');
    if (!context.idempotencyKey) return deny('idempotency_missing', 'A passback needs an idempotency key so a retry cannot send it twice.');
    const obligations: PolicyObligation[] = [
      { type: 'audit', eventType: POLICY_ACTIONS['grade.passback.submit'].auditEvent },
      { type: 'reconcile' },
      { type: 'notify', audience: 'actor' },
    ];
    if (actor.type === 'user' && actor.mfaLevel !== 'fresh') obligations.unshift({ type: 'require_fresh_mfa' });
    return allow(...obligations);
  },
};


/**
 * Tasks and calendar events are the student's own. The two read rules and the
 * two write rules differ only in the vocabulary they speak (which verbs exist,
 * which scope a share grant must carry, which fields a shared view may show),
 * so they are built here from one description rather than copied four times.
 */
interface ProductivityKind {
  verbs: Record<string, string>;
  shareScope: string;
  sharedFields: string[];
  importable: boolean;
}

const PRODUCTIVITY: Record<'task' | 'calendar', ProductivityKind> = {
  task: {
    verbs: { create: 'task.created', update: 'task.updated', complete: 'task.completed', reopen: 'task.updated', delete: 'task.deleted' },
    shareScope: 'tasks:read',
    // Notes are the part of a task a person writes for themselves.
    sharedFields: ['id', 'title', 'status', 'dueAt', 'priority', 'courseId', 'version'],
    importable: false,
  },
  calendar: {
    verbs: { create: 'calendar_event.created', update: 'calendar_event.updated', delete: 'calendar_event.deleted' },
    shareScope: 'calendar:read',
    sharedFields: ['id', 'title', 'startsAt', 'endsAt', 'allDay', 'timezone', 'kind', 'version'],
    importable: true,
  },
};

const productivityRead = (kind: 'task' | 'calendar'): Rule => ({ request, now, has }) => {
  const { actor, resource, context } = request;
  const k = PRODUCTIVITY[kind];
  if (actor.type !== 'user') return deny('actor_not_person', 'This is read by a signed-in person, not by a service.');
  if (!has('productivity:use')) return deny('capability_missing', 'Your account does not include planning tools at this institution.');
  if (!resource.ownerId) return deny('owner_missing', 'Whose data this is has to be known before it is read.');
  if (resource.ownerId === actor.id) return allow();
  // Somebody else's: a grant to *this* person, for *this* scope, still live, and a stated purpose.
  if (!context.purpose) return deny('purpose_missing', 'Say what the read is for; it is recorded.');
  const grant = context.consentGrants.find((g) =>
    g.kind === 'share' && g.grantedTo === actor.id && g.grantedBy === resource.ownerId && g.scopes.includes(k.shareScope));
  if (!grant) return deny('grant_missing', 'This person has not shared this with you.');
  if (!liveConsentGrant(grant, now)) return deny('grant_not_live', 'The share has ended. Ask them to share it again.');
  return allow(
    { type: 'audit', eventType: POLICY_ACTIONS['task.read'].auditEvent },
    { type: 'limit_fields', allowlist: k.sharedFields },
    { type: 'expire_at', at: grant.expiresAt },
  );
};

const productivityWrite = (kind: 'task' | 'calendar'): Rule => ({ request, has }) => {
  const { actor, tenant, resource, context } = request;
  const k = PRODUCTIVITY[kind];
  const a = resource.attributes ?? {};
  const verb = typeof a.command === 'string' ? a.command : '';
  const eventType = Object.prototype.hasOwnProperty.call(k.verbs, verb) ? k.verbs[verb] : undefined;
  if (!eventType) return deny('command_unknown', 'That change is not one this tool can make.');
  if (!resource.ownerId) return deny('owner_missing', 'Whose data this is has to be known before it is changed.');
  if (!context.idempotencyKey) return deny('idempotency_missing', 'A change needs a command id so a retry cannot apply it twice.');
  // What the source says stays what the source says; the student's own additions stay theirs.
  const sourced = resource.sourceKind === 'institution_verified' || resource.sourceKind === 'imported';

  if (actor.type === 'integration') {
    // A feed job bound to this tenant, importing — never reading, never touching a task.
    if (!k.importable) return deny('actor_not_permitted', 'Only the person who owns this can change it.');
    if (tenant.verifiedBy !== 'service_binding') return deny('service_unbound', 'This job is not bound to the tenant it is acting for.');
    if (!has('calendar:import')) return deny('capability_missing', 'This job is not allowed to import calendars.');
    if (!context.purpose) return deny('purpose_missing', 'An import says which feed it comes from.');
    if (resource.sourceKind !== 'imported') return deny('source_mismatch', 'An import can only write imported entries.');
    return allow({ type: 'audit', eventType });
  }
  if (actor.type !== 'user') return deny('actor_not_permitted', 'Only the person who owns this can change it.');
  if (!has('productivity:use')) return deny('capability_missing', 'Your account does not include planning tools at this institution.');
  if (resource.ownerId !== actor.id) return deny('not_owner', 'Only the person who owns this can change it. Sharing is read-only.');
  if (sourced && a.touchesAuthoritative === true) {
    return deny('source_authoritative', 'This comes from your institution or a linked calendar, so it is changed there. You can still add your own notes.');
  }
  return allow({ type: 'audit', eventType });
};

/**
 * Registration readiness and its exceptions. Three relationships can read a
 * student's readiness and they are different relationships, not one consent
 * flag: the student themself, an advisor with an advisee grant for *that*
 * student, and a registrar with a tenant grant. Seeing the checklist is not
 * seeing the records behind it; each relationship gets its own field list.
 *
 * What these rules do not decide is whether the student is *ready*. A missing
 * prerequisite record is "unknown", not "eligible", and that is the readiness
 * evaluator's finding; an authorized reader still gets the answer "unknown".
 * Authorization failure and missing academic data are different conditions.
 */
type RegistrationRelationship = 'student_self' | 'assigned_advisor' | 'authorized_registrar';

const READINESS_FIELDS: Record<RegistrationRelationship, string[]> = {
  student_self: ['status', 'asOf', 'sources', 'freshness', 'blockers', 'holds', 'prerequisites', 'plannedCourses', 'window'],
  // An advisor sees what blocks the plan, not the detail of a hold another office placed.
  assigned_advisor: ['status', 'asOf', 'sources', 'freshness', 'blockers', 'prerequisites', 'plannedCourses', 'window'],
  authorized_registrar: ['status', 'asOf', 'sources', 'freshness', 'blockers', 'holds', 'prerequisites', 'plannedCourses', 'window'],
};

const registrationRelationship = (request: AuthorizationRequest, grants: RoleGrant[]): RegistrationRelationship | null => {
  const { actor, tenant, resource } = request;
  if (resource.ownerId === actor.id) return 'student_self';
  if (grants.some((g) => g.role === 'academic_advisor' && g.scopeKind === 'advisee' && g.scopeId === resource.ownerId)) return 'assigned_advisor';
  if (grants.some((g) => g.role === 'registrar' && g.scopeKind === 'tenant' && g.scopeId === tenant.id)) return 'authorized_registrar';
  return null;
};

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isRegistrar = (request: AuthorizationRequest, grants: RoleGrant[]): boolean =>
  grants.some((g) => g.role === 'registrar' && g.scopeKind === 'tenant' && g.scopeId === request.tenant.id);

const isClassification = (value: unknown): value is ResourceClassification =>
  typeof value === 'string' && (RESOURCE_CLASSIFICATIONS as readonly string[]).includes(value);

const rank = (c: ResourceClassification) => RESOURCE_CLASSIFICATIONS.indexOf(c);

/**
 * The decision. `now` is a parameter rather than `Date.now()` so a test can
 * stand on either side of an expiry without waiting for it.
 *
 * The checks common to every action run first, in the order the specification
 * lists them: identity, tenant, environment, grants, then the rule. A request
 * that fails an early one never reaches the rule, so a rule may assume them.
 */
export function decide(request: AuthorizationRequest, now: number = Date.now()): AuthorizationDecision {
  const { actor, tenant, action, resource, context } = request;

  if (!isPolicyAction(action)) return deny('action_unknown', 'This action is not one Semester knows how to authorize.');
  if (!context || typeof context.correlationId !== 'string' || !CORRELATION_ID_PATTERN.test(context.correlationId)) {
    return deny('correlation_missing', 'This request cannot be traced, so it cannot be authorized.');
  }
  if (!actor?.id || !(ACTOR_TYPES as readonly string[]).includes(actor.type)) return deny('actor_unknown', 'Sign in to continue.');
  if (parseTime(actor.authenticatedAt) === null) return deny('authentication_unverified', 'Sign in to continue.');
  if (!tenant?.id || !(POLICY_ENVIRONMENTS as readonly string[]).includes(tenant.environment)) return deny('tenant_unknown', 'No verified institution is attached to this request.');
  if (!tenant.verifiedBy || !(TENANT_VERIFICATIONS as readonly string[]).includes(tenant.verifiedBy)) {
    return deny('tenant_unverified', 'No verified institution is attached to this request.');
  }
  if (actor.type === 'user' && context.membershipIds.length === 0) return deny('membership_missing', 'No active membership at this institution was found for your account.');
  if (tenant.environment === 'demo' && resource.classification === 'education_record') {
    return deny('demo_cannot_touch_records', 'The demo cannot read or write education records.');
  }
  const ceiling = POLICY_ACTIONS[action].classificationCeiling;
  if (resource.classification && rank(resource.classification) > rank(ceiling)) {
    return deny('classification_exceeds_action', 'This action may not touch data of that sensitivity.');
  }

  const grants = context.roleGrants.filter((g) => {
    if (!g.expiresAt) return true;
    const t = parseTime(g.expiresAt);
    return t !== null && t > now;
  });
  const capabilities = new Set(context.capabilities);

  return RULES[action]({ request, now, grants, has: (c) => capabilities.has(c) });
}

/**
 * The obligations an enforcement point applies to a record before it leaves:
 * `mask_fields` removes the named fields, `limit_fields` keeps only the
 * allowlist. Both, when both are present. Everything else is the caller's —
 * a challenge, an audit write, a rate-limit bucket — and is returned so the
 * caller can see what it still owes.
 */
export function applyObligations<T extends Record<string, unknown>>(
  record: T,
  obligations: PolicyObligation[],
): { record: Partial<T>; remaining: PolicyObligation[] } {
  let out: Record<string, unknown> = { ...record };
  const remaining: PolicyObligation[] = [];
  for (const o of obligations) {
    if (o.type === 'mask_fields') {
      for (const f of o.fields) delete out[f];
    } else if (o.type === 'limit_fields') {
      const keep = new Set(o.allowlist);
      out = Object.fromEntries(Object.entries(out).filter(([k]) => keep.has(k)));
    } else {
      remaining.push(o);
    }
  }
  return { record: out as Partial<T>, remaining };
}
