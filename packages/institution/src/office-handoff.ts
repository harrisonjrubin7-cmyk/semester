import type { ReadinessBlocker, RegistrationHold } from './readiness.ts';
import { transition, type WorkflowDefinition } from './workflow.ts';

/**
 * Routing a registration blocker to the office that owns it.
 *
 * A handoff asks one office to act on one readiness item. It is not
 * clearance. An office can acknowledge and resolve a handoff, but the
 * readiness projection keeps showing the item until a source refresh or
 * reconciliation confirms it clear. "Resolved" must never read as
 * "registered": readiness is not enrollment.
 *
 * This module is the decision layer only. It writes nothing. The persisted
 * record, the gateway route and the database function that backs them are
 * separate batches. requested → routed is the system's delivery step, so it
 * is not an actor action here.
 */

export const OFFICE_HANDOFF_STATES = ['requested', 'routed', 'acknowledged', 'resolved', 'withdrawn'] as const;
export type OfficeHandoffState = (typeof OFFICE_HANDOFF_STATES)[number];

export const OFFICE_HANDOFF: WorkflowDefinition<OfficeHandoffState> = {
  type: 'office_handoff',
  initial: 'requested',
  terminal: ['resolved', 'withdrawn'],
  transitions: {
    requested: ['routed', 'withdrawn'],
    routed: ['acknowledged', 'withdrawn'],
    acknowledged: ['resolved', 'withdrawn'],
    resolved: [],
    withdrawn: [],
  },
  exceptional: [
    ['requested', 'withdrawn'],
    ['routed', 'withdrawn'],
    ['acknowledged', 'withdrawn'],
  ],
};

/** A readiness item a student can route: a blocker by its code, or a non-clear hold by its id. */
export type RoutableTarget = { kind: 'blocker'; code: string } | { kind: 'hold'; id: string };

/**
 * Which office owns each routable item, keyed by `targetKey`. The institution
 * sets this table. A client never names the owning office.
 */
export type OfficeOwnership = Readonly<Record<string, string>>;

export function targetKey(target: RoutableTarget): string {
  return target.kind === 'blocker' ? `blocker:${target.code}` : `hold:${target.id}`;
}

/** The readiness facts a route decision is made against. */
export interface RoutableReadiness {
  /** Stable identity of the projection, so a retry against a different projection never replays. */
  projectionId: string;
  subjectId: string;
  version: number;
  blockers: readonly ReadinessBlocker[];
  holds: readonly RegistrationHold[];
}

export type HandoffActor =
  | { kind: 'student'; subjectId: string }
  | { kind: 'advisor'; assignedSubjectIds: readonly string[] }
  | { kind: 'office'; officeId: string };

export interface RouteBlockerRequest {
  actor: HandoffActor;
  readiness: RoutableReadiness;
  target: RoutableTarget;
  /**
   * The readiness version the caller reviewed. A newer projection refuses the
   * request rather than routing against facts the caller never saw.
   */
  readinessVersion: number;
  ownership: OfficeOwnership;
}

export type RouteRefusal =
  | 'not_authorized'
  | 'stale_readiness'
  | 'target_not_in_readiness'
  | 'target_ambiguous'
  | 'target_not_open'
  | 'no_owning_office';

export type RouteVerdict =
  | {
      ok: true;
      projectionId: string;
      subjectId: string;
      target: string;
      officeId: string;
      readinessVersion: number;
    }
  | { ok: false; reason: RouteRefusal };

/**
 * Decides whether an actor may route one readiness item to its owning office.
 * Checks run in a fixed order: who is asking, then whether their view is
 * current, then whether the item exists and is open, then whether an office
 * owns it. A refusal about the target never appears before the authorization
 * refusal, so a caller cannot probe which items exist.
 */
export function decideBlockerRoute(request: RouteBlockerRequest): RouteVerdict {
  const { actor, readiness, target, readinessVersion, ownership } = request;
  if (!actorMayRouteFor(actor, readiness.subjectId)) return { ok: false, reason: 'not_authorized' };
  if (readinessVersion !== readiness.version) return { ok: false, reason: 'stale_readiness' };

  const presence = targetPresence(readiness, target);
  if (presence === 'missing') return { ok: false, reason: 'target_not_in_readiness' };
  if (presence === 'ambiguous') return { ok: false, reason: 'target_ambiguous' };
  if (presence === 'clear') return { ok: false, reason: 'target_not_open' };

  const officeId: string | undefined = ownership[targetKey(target)];
  if (!officeId) return { ok: false, reason: 'no_owning_office' };

  return {
    ok: true,
    projectionId: readiness.projectionId,
    subjectId: readiness.subjectId,
    target: targetKey(target),
    officeId,
    readinessVersion: readiness.version,
  };
}

function actorMayRouteFor(actor: HandoffActor, subjectId: string): boolean {
  if (subjectId.length === 0) return false;
  switch (actor.kind) {
    case 'student':
      return actor.subjectId === subjectId;
    case 'advisor':
      return actor.assignedSubjectIds.includes(subjectId);
    case 'office':
      // An office acts on handoffs that were routed to it. It does not start them.
      return false;
  }
}

function targetPresence(
  readiness: RoutableReadiness,
  target: RoutableTarget,
): 'missing' | 'ambiguous' | 'clear' | 'open' {
  if (target.kind === 'blocker') {
    // A blocker in the projection is open by definition. The projection does not enforce unique
    // codes, so a code that names two blockers cannot say which one the student means. Refuse it.
    const { code } = target;
    const matches = readiness.blockers.filter((blocker) => blocker.code === code).length;
    if (matches === 0) return 'missing';
    return matches === 1 ? 'open' : 'ambiguous';
  }
  const { id } = target;
  // The projection does not enforce unique hold ids either, so two holds with one id are refused
  // rather than letting list order pick the outcome.
  const matches = readiness.holds.filter((candidate) => candidate.id === id);
  const [hold] = matches;
  if (!hold) return 'missing';
  return hold.state === 'clear' ? 'clear' : 'open';
}

export interface HandoffRecord {
  state: OfficeHandoffState;
  subjectId: string;
  officeId: string;
}

export type HandoffAction = 'acknowledge' | 'resolve' | 'withdraw';

const ACTION_TARGET = {
  acknowledge: 'acknowledged',
  resolve: 'resolved',
  withdraw: 'withdrawn',
} as const satisfies Record<HandoffAction, OfficeHandoffState>;

export type HandoffVerdict =
  | { ok: true; state: OfficeHandoffState }
  | { ok: false; reason: 'not_authorized' | 'illegal_transition' };

/**
 * Decides one action on an existing handoff. Only the owning office may
 * acknowledge or resolve it, and only the student it concerns may withdraw
 * it. Nobody else can change a handoff's state, and resolving one never
 * clears the readiness item it names.
 */
export function decideHandoffAction(actor: HandoffActor, handoff: HandoffRecord, action: HandoffAction): HandoffVerdict {
  if (!actorMayAct(actor, handoff, action)) return { ok: false, reason: 'not_authorized' };
  const verdict = transition(OFFICE_HANDOFF, handoff.state, ACTION_TARGET[action]);
  if (!verdict.ok) return { ok: false, reason: 'illegal_transition' };
  return { ok: true, state: verdict.state };
}

function actorMayAct(actor: HandoffActor, handoff: HandoffRecord, action: HandoffAction): boolean {
  if (action === 'withdraw') return actor.kind === 'student' && actor.subjectId === handoff.subjectId;
  return actor.kind === 'office' && actor.officeId === handoff.officeId;
}

/**
 * The reviewed inputs of a route request, taken before any current-state check. A caller
 * matches the idempotency key against this first. A retry after the projection, the target's
 * status or the owning office has moved is then still recognised as the same request and
 * replays the stored outcome, rather than being re-decided against new state. The office is
 * deliberately absent: it is derived from ownership, which is current state.
 */
export interface RouteRequestIdentity {
  projectionId: string;
  subjectId: string;
  target: RoutableTarget;
  readinessVersion: number;
}

export function requestFingerprint(request: RouteRequestIdentity): string {
  return JSON.stringify([request.projectionId, request.subjectId, targetKey(request.target), request.readinessVersion]);
}

export type RetryOutcome = 'new' | 'replay' | 'conflict';

/**
 * Classifies a retry against the fingerprint stored under the same actor and
 * idempotency key. Same key with a different payload is a conflict, never a
 * silent second route.
 */
export function classifyRetry(stored: string | undefined, incoming: string): RetryOutcome {
  if (stored === undefined) return 'new';
  return stored === incoming ? 'replay' : 'conflict';
}
