import {
  applyObligations,
  decide,
  type ActorType,
  type AuthorizationRequest,
  type PolicyEnvironment,
  type PolicyObligation,
  type RoleGrant,
  type TenantVerification,
} from './policy.ts';

/**
 * The institutional registration-readiness projection.
 *
 * This is deliberately a read contract, not a registration command. It joins
 * facts that may come from an SIS with the student's own proposed schedule,
 * keeps the source of each fact, and derives one conservative state. A caller
 * cannot stamp `ready` itself: stale, unknown, conflicting or review-bound
 * facts always win.
 */

export const READINESS_STATES = ['ready', 'blocked', 'needs_review', 'unknown', 'stale', 'reconciling'] as const;
export type RegistrationReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_FRESHNESS = ['current', 'updating', 'stale', 'blocked', 'degraded', 'reconciling'] as const;
export type RegistrationReadinessFreshness = (typeof READINESS_FRESHNESS)[number];

export const READINESS_AUTHORITIES = [
  'institution_verified',
  'connected',
  'student_entered',
  'estimated',
  'needs_review',
] as const;
export type RegistrationReadinessAuthority = (typeof READINESS_AUTHORITIES)[number];

export interface ReadinessSourceReference {
  id: string;
  authority: RegistrationReadinessAuthority;
  label: string;
  observedAt: string;
  version: string;
}

interface SourceLinked {
  sourceRefIds: string[];
}

export interface ReadinessBlocker extends SourceLinked {
  code: string;
  label: string;
}

export interface RegistrationHold extends SourceLinked {
  id: string;
  state: 'clear' | 'blocking' | 'unknown' | 'needs_review';
  label: string;
}

export interface PrerequisiteReadiness extends SourceLinked {
  courseId: string;
  state: 'met' | 'not_met' | 'unknown' | 'needs_review';
}

export interface PlannedRegistrationCourse extends SourceLinked {
  courseId: string;
  sectionId?: string;
}

export interface RegistrationWindowReadiness extends SourceLinked {
  state: 'open' | 'future' | 'closed' | 'unknown' | 'needs_review';
  opensAt?: string;
  closesAt?: string;
}

export interface RegistrationReadinessInput {
  id: string;
  tenantId: string;
  subjectId: string;
  termId: string;
  version: number;
  asOf: string;
  authority: RegistrationReadinessAuthority;
  freshness: RegistrationReadinessFreshness;
  sources: ReadinessSourceReference[];
  blockers: ReadinessBlocker[];
  holds: RegistrationHold[];
  prerequisites: PrerequisiteReadiness[];
  plannedCourses: PlannedRegistrationCourse[];
  window: RegistrationWindowReadiness;
  /** Meeting-time conflicts already computed from the selected sections. */
  conflicts: number;
}

export interface RegistrationReadinessProjection extends RegistrationReadinessInput {
  status: RegistrationReadinessState;
}

const hasText = (value: string): boolean => value.trim().length > 0;
const isTime = (value: string): boolean => Number.isFinite(Date.parse(value));

function assertInput(input: RegistrationReadinessInput): void {
  for (const [name, value] of [
    ['id', input.id],
    ['tenantId', input.tenantId],
    ['subjectId', input.subjectId],
    ['termId', input.termId],
  ] as const) {
    if (!hasText(value)) throw new Error(`Registration readiness ${name} is required.`);
  }
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error('Registration readiness version must be a positive integer.');
  if (!isTime(input.asOf)) throw new Error('Registration readiness asOf must be an ISO time.');
  if (input.conflicts < 0 || !Number.isInteger(input.conflicts)) throw new Error('Registration readiness conflicts must be a non-negative integer.');
  if (input.sources.length === 0) throw new Error('Registration readiness needs at least one source.');

  const sourceIds = new Set<string>();
  for (const source of input.sources) {
    if (!hasText(source.id) || sourceIds.has(source.id)) throw new Error(`Registration readiness source ${source.id || '(empty)'} is duplicated or invalid.`);
    if (!hasText(source.label) || !hasText(source.version) || !isTime(source.observedAt)) throw new Error(`Registration readiness source ${source.id} is incomplete.`);
    sourceIds.add(source.id);
  }

  const linked: SourceLinked[] = [
    ...input.blockers,
    ...input.holds,
    ...input.prerequisites,
    ...input.plannedCourses,
    input.window,
  ];
  for (const fact of linked) {
    if (fact.sourceRefIds.length === 0) throw new Error('Every registration-readiness fact needs a source reference.');
    for (const ref of fact.sourceRefIds) {
      if (!sourceIds.has(ref)) throw new Error(`Unknown source reference ${ref} in registration readiness.`);
    }
  }
}

function readinessStatus(input: RegistrationReadinessInput): RegistrationReadinessState {
  if (input.freshness === 'stale') return 'stale';
  if (input.freshness === 'updating' || input.freshness === 'reconciling') return 'reconciling';
  if (input.freshness === 'blocked' || input.freshness === 'degraded') return 'unknown';

  if (
    input.blockers.length > 0 ||
    input.conflicts > 0 ||
    input.holds.some((hold) => hold.state === 'blocking') ||
    input.prerequisites.some((prerequisite) => prerequisite.state === 'not_met') ||
    input.window.state === 'closed'
  ) return 'blocked';

  if (
    input.holds.some((hold) => hold.state === 'needs_review') ||
    input.prerequisites.some((prerequisite) => prerequisite.state === 'needs_review') ||
    input.window.state === 'needs_review'
  ) return 'needs_review';

  if (
    input.plannedCourses.length === 0 ||
    input.holds.some((hold) => hold.state === 'unknown') ||
    input.prerequisites.some((prerequisite) => prerequisite.state === 'unknown') ||
    input.window.state === 'unknown'
  ) return 'unknown';

  return 'ready';
}

export function buildRegistrationReadinessProjection(input: RegistrationReadinessInput): RegistrationReadinessProjection {
  assertInput(input);
  return Object.freeze({
    ...input,
    sources: Object.freeze(input.sources.map((source) => Object.freeze({ ...source }))) as unknown as ReadinessSourceReference[],
    blockers: Object.freeze(input.blockers.map((blocker) => Object.freeze({ ...blocker, sourceRefIds: Object.freeze([...blocker.sourceRefIds]) }))) as unknown as ReadinessBlocker[],
    holds: Object.freeze(input.holds.map((hold) => Object.freeze({ ...hold, sourceRefIds: Object.freeze([...hold.sourceRefIds]) }))) as unknown as RegistrationHold[],
    prerequisites: Object.freeze(input.prerequisites.map((item) => Object.freeze({ ...item, sourceRefIds: Object.freeze([...item.sourceRefIds]) }))) as unknown as PrerequisiteReadiness[],
    plannedCourses: Object.freeze(input.plannedCourses.map((course) => Object.freeze({ ...course, sourceRefIds: Object.freeze([...course.sourceRefIds]) }))) as unknown as PlannedRegistrationCourse[],
    window: Object.freeze({ ...input.window, sourceRefIds: Object.freeze([...input.window.sourceRefIds]) }) as unknown as RegistrationWindowReadiness,
    status: readinessStatus(input),
  });
}

/** The structural subset of the canonical platform RequestContext this read needs. */
export interface ReadinessRequestContext {
  readonly tenantId: string;
  readonly environment: PolicyEnvironment;
  readonly verifiedBy: TenantVerification;
  readonly actor: Readonly<{
    personId: string;
    type: ActorType;
    authenticatedAt: string;
    mfaLevel?: 'none' | 'standard' | 'fresh';
    sessionId?: string;
  }>;
  readonly membershipIds: readonly string[];
  readonly roleGrants: readonly RoleGrant[];
  readonly capabilities: readonly string[];
  readonly purpose: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly idempotencyKey?: string;
  readonly receivedAt: string;
}

export type RegistrationReadinessViewProjection = Pick<
  RegistrationReadinessProjection,
  'id' | 'tenantId' | 'subjectId' | 'termId' | 'version' | 'authority'
> & Partial<Pick<
  RegistrationReadinessProjection,
  'status' | 'asOf' | 'sources' | 'freshness' | 'blockers' | 'holds' | 'prerequisites' | 'plannedCourses' | 'window'
>>;

export type RegistrationReadinessView =
  | { allow: true; projection: RegistrationReadinessViewProjection; obligations: PolicyObligation[] }
  | { allow: false; reasonCode: string; userMessage: string };

const sourceKind = (authority: RegistrationReadinessAuthority): 'institution_verified' | 'imported' | 'student_entered' | 'estimated' => {
  if (authority === 'connected') return 'imported';
  if (authority === 'needs_review') return 'estimated';
  return authority;
};

/**
 * Apply the central readiness policy to one already-built projection.
 *
 * The envelope identifiers are restored after field limiting so a caller can
 * still bind caches, audit rows and UI keys to the correct tenant, student and
 * term. The policy allowlist controls only the domain fields. Audit and source
 * obligations remain in the result for the server enforcement point to fulfil.
 */
export function viewRegistrationReadiness(
  context: ReadinessRequestContext,
  projection: RegistrationReadinessProjection,
): RegistrationReadinessView {
  const request: AuthorizationRequest = {
    actor: {
      id: context.actor.personId,
      type: context.actor.type,
      authenticatedAt: context.actor.authenticatedAt,
      ...(context.actor.mfaLevel === undefined ? {} : { mfaLevel: context.actor.mfaLevel }),
      ...(context.actor.sessionId === undefined ? {} : { sessionId: context.actor.sessionId }),
    },
    tenant: { id: context.tenantId, environment: context.environment, verifiedBy: context.verifiedBy },
    action: 'registration.readiness.view',
    resource: {
      type: 'registration_readiness',
      id: projection.id,
      ownerId: projection.subjectId,
      classification: 'education_record',
      sourceKind: sourceKind(projection.authority),
      attributes: { tenantId: projection.tenantId, termId: projection.termId, version: projection.version },
    },
    context: {
      membershipIds: [...context.membershipIds],
      roleGrants: context.roleGrants.map((grant) => ({ ...grant })),
      capabilities: [...context.capabilities],
      consentGrants: [],
      featureFlags: [],
      policyVersions: {},
      purpose: context.purpose,
      ...(context.idempotencyKey === undefined ? {} : { idempotencyKey: context.idempotencyKey }),
      correlationId: context.correlationId,
    },
  };

  const decision = decide(request, Date.parse(context.receivedAt));
  if (!decision.allow) return { allow: false, reasonCode: decision.reasonCode, userMessage: decision.userMessage };

  const applied = applyObligations(projection as unknown as Record<string, unknown>, decision.obligations);
  return {
    allow: true,
    projection: {
      id: projection.id,
      tenantId: projection.tenantId,
      subjectId: projection.subjectId,
      termId: projection.termId,
      version: projection.version,
      authority: projection.authority,
      ...applied.record,
    } as RegistrationReadinessViewProjection,
    obligations: applied.remaining,
  };
}
