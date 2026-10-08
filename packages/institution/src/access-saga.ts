/**
 * The access saga: provisioning a bounded grant across a policy administrator
 * and an enforcement point, as a state machine that cannot skip the checks.
 *
 * `decide` (policy.ts) answers one question — may this actor do this now. A
 * grant that outlives one request is a different problem: something has to
 * ask for stronger authentication, wait for an approver, install the grant at
 * the point that enforces it, prove it is there, and take it away again, and
 * every one of those can time out halfway. This module is the description of
 * that sequence (`ACCESS_SAGA`), the pure rules around it, and a runner
 * (`AccessSagaRunner`) that advances one saga one step against two interfaces
 * it does not implement: a `Store` and the `Services`.
 *
 * ## Four things it holds
 *
 * - **Allow is reached only through a fresh evaluation.** A step-up or an
 *   approval that finishes is a wake-up signal, not a claim: the saga goes back
 *   to `VALIDATING`, rebuilds trusted context, and evaluates again. An install
 *   found `absent` goes back to `EVALUATING` at the next generation, so a
 *   decision made before the wait is never the one a grant is cut from.
 * - **ACTIVE is reached only through VERIFYING.** An install that was sent is
 *   not an install that is there.
 * - **A timeout is "outcome unknown", not "failed".** An install that throws
 *   enters `RECONCILING`, which asks the enforcement point what it holds.
 * - **Revoked access is never restored.** `DENIED`, `EXPIRED` and `REVOKED`
 *   have no exits, and a changed request is a new saga.
 *
 * ## What it does not provide
 *
 * Persistence. The runner is correct only if the `Store` does what its
 * interface says (exclusive leases with fencing tokens, compare-and-swap,
 * saga + audit + outbox in one transaction, a deduplicated wake) and the
 * `Services` do what theirs say (idempotent by key, `inspect` returning
 * `absent` only when absence is authoritative). Neither exists in this
 * repository; the tests use in-memory fakes and say so. Rego, OpenAPI and
 * AsyncAPI from the PDFs are not adopted: see `docs/decisions/D-1338.md`.
 */

import type { AuthorizationDecision } from './policy.ts';
import { transition, type WorkflowDefinition } from './workflow.ts';

export const ACCESS_SAGA_STATES = [
  'RECEIVED',
  'VALIDATING',
  'EVALUATING',
  'WAITING_STEP_UP',
  'WAITING_APPROVAL',
  'PREPARING',
  'INSTALLING',
  'VERIFYING',
  'RECONCILING',
  'ACTIVE',
  'DENIED',
  'EXPIRED',
  'REVOKING',
  'RECOVERY_REQUIRED',
  'REVOKED',
] as const;
export type AccessSagaState = (typeof ACCESS_SAGA_STATES)[number];

/**
 * Every legal move. `EXPIRED` is the end of a request that ran out of time
 * before any grant existed; once a grant may exist, running out of time means
 * `REVOKING`, because the enforcement point has to be told. `VALIDATING` and
 * `EVALUATING` can reach `REVOKING` for one reason: an install found absent
 * restarts evaluation, and the grant it left behind at the administrator
 * (`staleGrantPossible`) must still be revoked however the new attempt ends.
 */
export const ACCESS_SAGA: WorkflowDefinition<AccessSagaState> = {
  type: 'access_saga',
  initial: 'RECEIVED',
  terminal: ['DENIED', 'EXPIRED', 'REVOKED'],
  transitions: {
    RECEIVED: ['VALIDATING', 'EXPIRED'],
    VALIDATING: ['EVALUATING', 'DENIED', 'EXPIRED', 'REVOKING'],
    EVALUATING: ['WAITING_STEP_UP', 'WAITING_APPROVAL', 'PREPARING', 'DENIED', 'EXPIRED', 'REVOKING'],
    WAITING_STEP_UP: ['VALIDATING', 'EXPIRED', 'REVOKING'],
    WAITING_APPROVAL: ['VALIDATING', 'EXPIRED', 'REVOKING'],
    PREPARING: ['INSTALLING', 'DENIED', 'EXPIRED', 'REVOKING'],
    INSTALLING: ['VERIFYING', 'RECONCILING', 'REVOKING'],
    VERIFYING: ['ACTIVE', 'RECONCILING', 'REVOKING'],
    RECONCILING: ['VERIFYING', 'EVALUATING', 'REVOKING'],
    ACTIVE: ['REVOKING'],
    DENIED: [],
    EXPIRED: [],
    REVOKING: ['REVOKED', 'RECOVERY_REQUIRED'],
    RECOVERY_REQUIRED: ['REVOKING'],
    REVOKED: [],
  },
  exceptional: [
    ['INSTALLING', 'RECONCILING'],
    ['VERIFYING', 'RECONCILING'],
    ['RECONCILING', 'EVALUATING'],
    ['RECONCILING', 'REVOKING'],
    ['REVOKING', 'RECOVERY_REQUIRED'],
    ['RECOVERY_REQUIRED', 'REVOKING'],
  ],
};

export interface AccessIntent {
  resourceId: string;
  action: string;
}

/** The durable record. Every field is set by the server; nothing here is a client's claim of authority. */
export interface AccessSaga {
  id: string;
  tenantId: string;
  subjectId: string;
  intent: AccessIntent;
  requestDigest: string;
  definitionVersion: string;
  state: AccessSagaState;
  /** Compare-and-swap token: every saved move is `revision + 1`. */
  revision: number;
  /** Bumped when a decision must not be reused; operation keys include it. */
  generation: number;
  attempts: number;
  deadlineAt: number;
  nextAttemptAt: number;
  decisionId?: string;
  grantId?: string;
  grantExpiresAt?: number;
  /**
   * Set when an install was found absent and evaluation restarted: a grant of
   * an earlier generation may still exist at the administrator even though
   * `grantId` was cleared. Every way out of the saga then revokes, and
   * `revokePa` covers every generation up to the current one.
   */
  staleGrantPossible: boolean;
  /** Cleanup is two independent sides, each confirmed on its own; neither implies the other. */
  compensation: { paRevoked: boolean; pepRemoved: boolean };
  lastError?: string;
}

export interface Decision {
  id: string;
  outcome: 'allow' | 'deny' | 'require_step_up' | 'require_approval';
}

/**
 * The saga's word for what `decide` returned. A denial is `deny`. An allow
 * that carries `require_fresh_mfa` is `require_step_up`: `decide` expresses
 * step-up as an obligation on an allow, not as an outcome of its own, and the
 * saga waits for the stronger authentication before it prepares anything. Any
 * other allow is `allow`. `require_approval` is not produced here: an approval
 * is its own action (`registration.override.approve`) decided for a different
 * person, not a precondition `decide` attaches to the first.
 *
 * Because `decide` refuses a wrong institution, a missing relationship or a
 * missing capability before any rule returns an allow, a request that would be
 * refused anyway is never asked to step up.
 */
export function sagaOutcomeOf(decision: AuthorizationDecision): Decision['outcome'] {
  if (!decision.allow) return 'deny';
  return decision.obligations.some((o) => o.type === 'require_fresh_mfa') ? 'require_step_up' : 'allow';
}

export interface Grant {
  id: string;
  expiresAt: number;
}

export interface Inspection {
  status: 'absent' | 'installed' | 'conflict' | 'unknown';
}

export interface AccessEvent {
  eventId: string;
  type: 'access.state.changed';
  sagaId: string;
  tenantId: string;
  revision: number;
  occurredAt: string;
  reasonCode?: string;
}

export interface Lease {
  token: string;
  saga: AccessSaga;
}

/**
 * What the persistence layer must do for the runner to be safe.
 *
 * - `claim` takes an exclusive lease for `leaseMs` with a fencing token, or null.
 * - `save` atomically checks the lease and `expectedRevision`, then writes the
 *   saga, an audit entry and the outbox event in one transaction. An expired or
 *   stale fencing token, or a revision that moved, throws `PersistenceConflict`:
 *   another owner or a cancellation advanced the saga, and the runner stands
 *   down without overwriting it. Any other error from the store is a storage
 *   failure and is never reinterpreted as a participant's.
 * - `flagRecovery` records and schedules operator recovery. It does not mark
 *   cleanup complete, and the runner keeps retrying after it.
 * - `wake` authenticates the sender, deduplicates by `eventId` transactionally,
 *   and bumps `generation` when it resumes validation. A wake is a signal; it
 *   carries no claim that anyone is approved or authenticated.
 */
export interface Store {
  claim(id: string, leaseMs: number): Promise<Lease | null>;
  save(lease: Lease, expectedRevision: number, next: AccessSaga, event: AccessEvent): Promise<void>;
  flagRecovery(lease: Lease, code: string): Promise<void>;
  release(lease: Lease): Promise<void>;
  wake(id: string, eventId: string, kind: 'requirements_changed' | 'revoke' | 'recover'): Promise<void>;
}

/**
 * What the adapters must do. They authenticate workloads, validate tenant
 * scope, enforce current policy, and persist idempotent operation results, so
 * a call repeated under the same key returns the first outcome. `prepare`
 * validates the decision's expiry, scope, policy revision and request digest,
 * and supersedes any grant of an earlier generation of the same saga;
 * `install` enforces expiry and cannot resurrect a revoked one; `inspect`
 * returns `absent` only when absence is authoritative, not because a read
 * failed.
 *
 * Cleanup is three calls, not one, so each side is proved on its own:
 *
 * - `revokePa` revokes by saga and generation (every generation up to the
 *   current one) *even when no grant id is known*, so a grant prepared before a crash that never reached the saga row
 *   cannot survive. It records a barrier: an installation whose generation is
 *   at or below the revoked one is rejected, however late its message arrives.
 * - `removePep` removes enforcement at every required point, by the same key.
 * - `verifyCleanup` checks both: the PA will no longer authorize an
 *   installation, and the PEP no longer enforces the grant. Seeing no grant at
 *   the PEP alone does not exclude an installation still in flight.
 *
 * Every call gets an `AbortSignal` that fires at the operation's timeout. A
 * timeout stops the *wait*, not the remote work: participants stay idempotent
 * and keep their barriers whether or not the signal is honoured.
 */
export interface Services {
  validate(saga: AccessSaga, key: string, signal: AbortSignal): Promise<void>;
  evaluate(saga: AccessSaga, key: string, signal: AbortSignal): Promise<Decision>;
  prepare(saga: AccessSaga, key: string, signal: AbortSignal): Promise<Grant>;
  install(saga: AccessSaga, key: string, signal: AbortSignal): Promise<void>;
  inspect(saga: AccessSaga, signal: AbortSignal): Promise<Inspection>;
  revokePa(saga: AccessSaga, key: string, signal: AbortSignal): Promise<'confirmed' | 'unknown'>;
  removePep(saga: AccessSaga, key: string, signal: AbortSignal): Promise<'confirmed' | 'unknown'>;
  verifyCleanup(saga: AccessSaga, signal: AbortSignal): Promise<{ paRevoked: boolean; pepAbsent: boolean }>;
}

/**
 * A participant's failure, classified. `retryable`: trying again with the same
 * key is safe. `outcomeUnknown`: the remote effect may have happened, so the
 * caller must inspect before assuming either way.
 */
export class Fault extends Error {
  code: string;
  retryable: boolean;
  outcomeUnknown: boolean;
  constructor(code: string, retryable: boolean, outcomeUnknown: boolean = false, message: string = code) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.outcomeUnknown = outcomeUnknown;
  }
}

/** Thrown by `Store.save` when the saga moved under the worker. Not a participant failure. */
export class PersistenceConflict extends Error {}

/** A participant call that failed, as opposed to a store or guard failure. Internal to the runner. */
class OperationFailure extends Error {
  fault: Fault;
  constructor(fault: Fault) {
    super(fault.code);
    this.fault = fault;
  }
}

export type AccessOperation = 'validate' | 'evaluate' | 'prepare' | 'install' | 'inspect' | 'revoke_pa' | 'remove_pep' | 'verify_cleanup';

/** Illustrative starting points, not measured SLOs. */
export const DEFAULT_TIMEOUT_MS: Readonly<Record<AccessOperation, number>> = {
  validate: 5_000,
  evaluate: 5_000,
  prepare: 8_000,
  install: 8_000,
  inspect: 5_000,
  revoke_pa: 8_000,
  remove_pep: 8_000,
  verify_cleanup: 5_000,
};

/** Run `run`, abort it and report an unknown outcome if it outlasts `timeoutMs`. */
export async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<T>;
  try {
    running = run(controller.signal);
  } catch (error) {
    running = Promise.reject(error);
  }
  // If the timer wins, the call is still running and may reject later. `Promise.race` already subscribes
  // to it, so that is not an unhandled rejection today; the explicit no-op keeps it from depending on that.
  // Its outcome is reconciled through the participant, not here.
  running.catch(() => {});
  try {
    return await Promise.race([
      running,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Fault('OPERATION_TIMEOUT', true, true));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * A guard on every move the *runner* commits, independent of the code that
 * built it. `Store.wake` is not a runner move: it is the store's own write, it
 * bumps `generation` when it resumes validation from a wait, and the runner
 * then reads that bumped saga as `current` — so the generation rule below
 * compares against the post-wake value and a wake never meets this guard.
 * The guard checks: the
 * same identity, one revision on, a legal edge, a generation that changes only
 * when a new evaluation is started from reconciliation, and no `REVOKED`
 * without both sides of the cleanup confirmed. Returns the reason it refuses,
 * or null. A refusal is a bug in the runner or an adapter, so it is raised,
 * never retried and never turned into a denial.
 */
export function checkTransition(current: AccessSaga, next: AccessSaga): string | null {
  if (next.id !== current.id || next.tenantId !== current.tenantId || next.requestDigest !== current.requestDigest) return 'IDENTITY_CHANGED';
  if (next.revision !== current.revision + 1) return 'REVISION_NOT_NEXT';
  if (next.state !== current.state) {
    const verdict = transition(ACCESS_SAGA, current.state, next.state);
    if (!verdict.ok) return `ILLEGAL_EDGE: ${verdict.reason}`;
  }
  const restartsEvaluation = current.state === 'RECONCILING' && next.state === 'EVALUATING';
  if (restartsEvaluation ? next.generation !== current.generation + 1 : next.generation !== current.generation) return 'GENERATION_CHANGED';
  if (next.state === 'REVOKED' && !(next.compensation.paRevoked && next.compensation.pepRemoved)) return 'CLEANUP_NOT_CONFIRMED';
  return null;
}

/** One logical step of one saga at one generation: a retry reuses it, a changed operation does not. */
export function operationKey(saga: Pick<AccessSaga, 'id' | 'definitionVersion' | 'generation'>, step: string): string {
  // A JSON array, not a joined string, so ids that contain the separator cannot collide.
  return JSON.stringify([saga.id, saga.definitionVersion, saga.generation, step]);
}

/** Capped exponential backoff with full jitter. `random` is injected so a test can pin it. */
export function backoff(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(60_000, 500 * 2 ** Math.min(attempt, 7));
  return Math.floor(random() * ceiling);
}

/** The decision outcomes mapped to the state each one leads to. */
export const OUTCOME_STATE: Readonly<Record<Decision['outcome'], AccessSagaState>> = {
  allow: 'PREPARING',
  deny: 'DENIED',
  require_step_up: 'WAITING_STEP_UP',
  require_approval: 'WAITING_APPROVAL',
};

/**
 * States in which a grant may exist at the administrator even though the saga
 * row holds no `grantId`: `prepare` can succeed and the worker die before the
 * save. Leaving any of them means revoking, never merely expiring.
 */
const MAY_HOLD_GRANT: ReadonlySet<AccessSagaState> = new Set<AccessSagaState>(['PREPARING', 'INSTALLING', 'VERIFYING', 'RECONCILING', 'ACTIVE']);

/** Whether the administrator may hold a grant for this saga that the saga row cannot name. */
function mayHoldGrant(s: AccessSaga): boolean {
  return s.grantId !== undefined || s.staleGrantPossible || MAY_HOLD_GRANT.has(s.state);
}

export interface RunnerOptions {
  /** Per-operation wait limits; each falls back to `DEFAULT_TIMEOUT_MS`. */
  timeouts?: Partial<Record<AccessOperation, number>>;
  /** How long a claimed lease lasts. Default 30 s. */
  leaseMs?: number;
  /** Failed attempts in one state before an operator is told. The runner keeps retrying. Default 8. */
  escalateAfter?: number;
  now?: () => number;
  random?: () => number;
  newId?: () => string;
}

/**
 * Advances one saga by one step. Call it again (a scheduler, a wake) to
 * advance further: one tick is one move, so a crash between two moves loses
 * nothing the store did not already hold.
 */
export class AccessSagaRunner {
  private store: Store;
  private services: Services;
  private now: () => number;
  private random: () => number;
  private newId: () => string;
  private timeouts: Record<AccessOperation, number>;
  private leaseMs: number;
  private escalateAfter: number;

  constructor(store: Store, services: Services, options: RunnerOptions = {}) {
    this.store = store;
    this.services = services;
    this.timeouts = { ...DEFAULT_TIMEOUT_MS, ...options.timeouts };
    this.leaseMs = options.leaseMs ?? 30_000;
    this.escalateAfter = options.escalateAfter ?? 8;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.newId = options.newId ?? (() => globalThis.crypto.randomUUID());
  }

  async tick(id: string): Promise<void> {
    const lease = await this.store.claim(id, this.leaseMs);
    if (!lease) return;
    const s = lease.saga;

    try {
      if (ACCESS_SAGA.terminal.includes(s.state) || s.nextAttemptAt > this.now()) return;

      const move = async (state: AccessSagaState, patch: Partial<AccessSaga> = {}, reasonCode?: string): Promise<void> => {
        const next: AccessSaga = { ...s, ...patch, state, revision: s.revision + 1 };
        const refused = checkTransition(s, next);
        if (refused) throw new Error(`TRANSITION_REJECTED: ${refused}`);
        // Repeated failure is an operational event as well as a retry: tell an operator once the budget is spent.
        if (next.attempts > s.attempts && next.attempts >= this.escalateAfter) await this.store.flagRecovery(lease, reasonCode ?? 'RECOVERY_THRESHOLD_EXCEEDED');
        await this.store.save(lease, s.revision, next, {
          eventId: this.newId(),
          type: 'access.state.changed',
          sagaId: s.id,
          tenantId: s.tenantId,
          revision: next.revision,
          occurredAt: new Date(this.now()).toISOString(),
          reasonCode,
        });
      };

      /** A participant call: bounded by its timeout, and any failure is classified as the participant's. */
      const call = async <T>(operation: AccessOperation, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
        try {
          return await withTimeout(this.timeouts[operation], run);
        } catch (error) {
          throw new OperationFailure(error instanceof Fault ? error : new Fault('UNCLASSIFIED_OPERATION_FAILURE', true, true));
        }
      };

      const retry = (code: string) =>
        move(s.state, { attempts: s.attempts + 1, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random), lastError: code }, code);

      const accessExpired = s.grantExpiresAt !== undefined && this.now() >= s.grantExpiresAt;
      const provisioningExpired = s.state !== 'ACTIVE' && this.now() >= s.deadlineAt;
      if (s.state !== 'REVOKING' && s.state !== 'RECOVERY_REQUIRED' && (accessExpired || provisioningExpired)) {
        await move(mayHoldGrant(s) ? 'REVOKING' : 'EXPIRED', { nextAttemptAt: 0 }, 'DEADLINE_EXCEEDED');
        return;
      }

      try {
        switch (s.state) {
          case 'RECEIVED':
            await move('VALIDATING');
            return;

          case 'VALIDATING':
            await call('validate', (signal) => this.services.validate(s, operationKey(s, 'validate'), signal));
            await move('EVALUATING', { attempts: 0, nextAttemptAt: 0 });
            return;

          case 'EVALUATING': {
            const d = await call('evaluate', (signal) => this.services.evaluate(s, operationKey(s, 'evaluate'), signal));
            // A denial ends the request, but not what an earlier generation may have left at the administrator.
            const target = d.outcome === 'deny' && s.staleGrantPossible ? 'REVOKING' : OUTCOME_STATE[d.outcome];
            await move(target, { decisionId: d.id, attempts: 0, nextAttemptAt: 0 });
            return;
          }

          case 'WAITING_STEP_UP':
          case 'WAITING_APPROVAL':
            // Only a verified wake leaves here, and it goes back to VALIDATING.
            return;

          case 'PREPARING': {
            const grant = await call('prepare', (signal) => this.services.prepare(s, operationKey(s, 'prepare'), signal));
            await move('INSTALLING', { grantId: grant.id, grantExpiresAt: grant.expiresAt, attempts: 0, nextAttemptAt: 0 });
            return;
          }

          case 'INSTALLING':
            await call('install', (signal) => this.services.install(s, operationKey(s, 'install'), signal));
            await move('VERIFYING', { attempts: 0, nextAttemptAt: 0 });
            return;

          case 'VERIFYING': {
            const observed = await call('inspect', (signal) => this.services.inspect(s, signal));
            if (observed.status === 'installed') await move('ACTIVE', { attempts: 0, nextAttemptAt: 0 });
            else await move(observed.status === 'conflict' ? 'REVOKING' : 'RECONCILING', { nextAttemptAt: 0 });
            return;
          }

          case 'RECONCILING': {
            const observed = await call('inspect', (signal) => this.services.inspect(s, signal));
            if (observed.status === 'installed') await move('VERIFYING', { nextAttemptAt: 0 });
            else if (observed.status === 'absent') {
              // A new evaluation at a new generation: a stale decision must not be reused.
              await move('EVALUATING', {
                generation: s.generation + 1,
                staleGrantPossible: true,
                decisionId: undefined,
                grantId: undefined,
                grantExpiresAt: undefined,
                attempts: 0,
                nextAttemptAt: 0,
              });
            } else if (observed.status === 'conflict') await move('REVOKING', { nextAttemptAt: 0 });
            else await retry('ENFORCEMENT_UNKNOWN');
            return;
          }

          case 'ACTIVE':
            // Per-request enforcement and the periodic reconciliation sweep live at the
            // enforcement point and in scheduled workers, not in a tick.
            return;

          case 'REVOKING': {
            // One side of the cleanup per tick, each confirmed on its own. A grant id is not
            // needed: the adapters revoke by saga and generation.
            const done = s.compensation;
            const unconfirmed = (code: string) =>
              move('RECOVERY_REQUIRED', { attempts: s.attempts + 1, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random) }, code);
            if (!done.paRevoked) {
              if ((await call('revoke_pa', (signal) => this.services.revokePa(s, operationKey(s, 'revoke_pa'), signal))) === 'confirmed') {
                await move('REVOKING', { compensation: { ...done, paRevoked: true }, attempts: 0, nextAttemptAt: 0 });
              } else await unconfirmed('REVOCATION_UNCONFIRMED');
            } else if (!done.pepRemoved) {
              if ((await call('remove_pep', (signal) => this.services.removePep(s, operationKey(s, 'remove_pep'), signal))) === 'confirmed') {
                await move('REVOKING', { compensation: { ...done, pepRemoved: true }, attempts: 0, nextAttemptAt: 0 });
              } else await unconfirmed('REMOVAL_UNCONFIRMED');
            } else {
              const v = await call('verify_cleanup', (signal) => this.services.verifyCleanup(s, signal));
              if (v.paRevoked && v.pepAbsent) await move('REVOKED', { nextAttemptAt: 0 });
              else {
                // Verification disagrees with what was confirmed: reopen only the side that failed.
                await move(
                  'RECOVERY_REQUIRED',
                  { compensation: { paRevoked: v.paRevoked, pepRemoved: v.pepAbsent }, attempts: s.attempts + 1, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random) },
                  'CLEANUP_UNVERIFIED',
                );
              }
            }
            return;
          }

          case 'RECOVERY_REQUIRED':
            await move('REVOKING', { nextAttemptAt: 0 });
            return;

          default:
            return;
        }
      } catch (error) {
        // Storage and guard failures are not participant failures: raise them, never retry or deny on them.
        if (!(error instanceof OperationFailure)) throw error;
        const fault = error.fault;

        // An install whose outcome is unknown is never assumed to have failed.
        if (s.state === 'INSTALLING') {
          await move('RECONCILING', { lastError: fault.code, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random) }, fault.code);
          return;
        }
        if (s.state === 'REVOKING') {
          await move(
            'RECOVERY_REQUIRED',
            { attempts: s.attempts + 1, lastError: fault.code, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random) },
            fault.code,
          );
          return;
        }
        // A grant must never be cut from a decision that went stale.
        if (fault.code === 'STALE_DECISION' && s.state === 'PREPARING') {
          await move(s.staleGrantPossible ? 'REVOKING' : 'DENIED', { lastError: fault.code }, fault.code);
          return;
        }
        if (fault.retryable || fault.outcomeUnknown) {
          await retry(fault.code);
          return;
        }
        await move(s.grantId || s.staleGrantPossible ? 'REVOKING' : 'DENIED', { lastError: fault.code, nextAttemptAt: 0 }, fault.code);
      }
    } catch (error) {
      // A saga that moved under us belongs to whoever moved it: stand down, overwrite nothing.
      if (error instanceof PersistenceConflict) return;
      throw error;
    } finally {
      await this.store.release(lease);
    }
  }
}

// ── The request body and idempotency ──────────────────────────────────────

/** The actions the access-request schema names. Each has a rule in `policy.ts`; `access-saga.test.ts` fails if one loses it. */
export const ACCESS_REQUEST_ACTIONS = ['registration.readiness.view', 'registration.override.request', 'registration.override.approve'] as const;

/**
 * The public request body: intent only. An identity, a capability list, a
 * trust score or an approval flag in the body is an error, not an ignored
 * field; the server resolves all of those itself.
 */
export function validateAccessRequest(input: unknown): { ok: true; intent: AccessIntent } | { ok: false; errors: string[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['$: must be an object'] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(body)) if (key !== 'resourceId' && key !== 'action') errors.push(`$.${key}: not allowed`);
  const { resourceId, action } = body;
  if (typeof resourceId !== 'string' || resourceId.length < 1 || resourceId.length > 200) errors.push('$.resourceId: must be a string of 1–200 characters');
  if (typeof action !== 'string' || !(ACCESS_REQUEST_ACTIONS as readonly string[]).includes(action)) errors.push(`$.action: must be one of ${ACCESS_REQUEST_ACTIONS.join(', ')}`);
  return errors.length === 0 ? { ok: true, intent: { resourceId: resourceId as string, action: action as string } } : { ok: false, errors };
}

/** `Idempotency-Key` as the OpenAPI draft bounds it. */
export const IDEMPOTENCY_KEY_MIN = 16;
export const IDEMPOTENCY_KEY_MAX = 200;

export function validIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && key.length >= IDEMPOTENCY_KEY_MIN && key.length <= IDEMPOTENCY_KEY_MAX;
}

/** Who is asking, for what: tenant, authenticated caller, endpoint and key, as a JSON array so no field can bleed into the next. */
export function clientRequestIdentity(p: { tenantId: string; callerId: string; endpoint: string; idempotencyKey: string }): string {
  return JSON.stringify([p.tenantId, p.callerId, p.endpoint, p.idempotencyKey]);
}

/** Key order must not change a digest: `{a,b}` and `{b,a}` are the same request. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** SHA-256 of the canonical form, hex. */
export async function requestDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface IdempotencyRecord {
  identity: string;
  digest: string;
  result: unknown;
}

export type IdempotencyVerdict =
  | { kind: 'new' }
  | { kind: 'replay'; result: unknown }
  | { kind: 'conflict'; status: 409; code: 'IDEMPOTENCY_CONFLICT' };

/**
 * Same identity and same payload: hand back what was recorded. Same identity
 * and a different payload: refuse, never run the new one under the old key.
 * `existing` must come from durable storage with a uniqueness constraint on
 * `identity`; an in-memory map forgets on restart, which is when it matters.
 */
export function checkIdempotency(existing: IdempotencyRecord | undefined, identity: string, digest: string): IdempotencyVerdict {
  if (existing === undefined || existing.identity !== identity) return { kind: 'new' };
  if (existing.digest === digest) return { kind: 'replay', result: existing.result };
  return { kind: 'conflict', status: 409, code: 'IDEMPOTENCY_CONFLICT' };
}

// ── What an active grant permits ───────────────────────────────────────────

/**
 * Whether an ACTIVE saga covers *this* operation, now. An active grant is not
 * open access until expiry: subject, tenant, resource and action must match,
 * the clock must be inside the grant, and the saga must still be ACTIVE — a
 * revocation that has begun ends it at once, before the enforcement point
 * confirms. Fails closed on any mismatch.
 */
export function grantAllows(
  saga: Pick<AccessSaga, 'state' | 'tenantId' | 'subjectId' | 'intent' | 'grantExpiresAt'>,
  request: { tenantId: string; subjectId: string; resourceId: string; action: string },
  nowMs: number,
): boolean {
  return (
    saga.state === 'ACTIVE' &&
    saga.grantExpiresAt !== undefined &&
    nowMs < saga.grantExpiresAt &&
    saga.tenantId === request.tenantId &&
    saga.subjectId === request.subjectId &&
    saga.intent.resourceId === request.resourceId &&
    saga.intent.action === request.action
  );
}

// ── Compensation ───────────────────────────────────────────────────────────

export interface CompensationRule {
  operation: string;
  failureHandling: string;
  /** What restores an acceptable future state, or null when there is nothing to undo. Never reverses history. */
  compensation: string | null;
}

/**
 * The compensation policy, as data so a test can hold it. Compensation means
 * restoring an acceptable future state, not reversing history: revocation
 * cannot undo content already viewed or downloaded.
 */
export const ACCESS_COMPENSATION: readonly CompensationRule[] = [
  { operation: 'Context validation', failureHandling: 'Retry dependency failures; deny invalid requests', compensation: null },
  { operation: 'Policy evaluation', failureHandling: 'No new grant while the decision is unavailable', compensation: null },
  { operation: 'Stronger authentication', failureHandling: 'Wait or expire; revalidate when resumed', compensation: 'Cancel the outstanding challenge where supported' },
  { operation: 'Approval', failureHandling: 'Revalidate approval eligibility and exact input binding', compensation: 'Invalidate the obsolete approval' },
  { operation: 'Prepare grant', failureHandling: 'Query or retry with the same logical operation key', compensation: 'Revoke or cancel the prepared grant if abandoning' },
  { operation: 'Install grant', failureHandling: 'A timeout enters reconciliation, never a blind assumption', compensation: 'Revoke an uncertain or incorrect installation' },
  { operation: 'Verify grant', failureHandling: 'Check scope, generation, expiry and current authority', compensation: 'Revoke on conflict' },
  { operation: 'Active access', failureHandling: 'Revoke on expiry or loss of relevant authority', compensation: 'Terminate future access' },
  { operation: 'Revoke grant', failureHandling: 'Retry and escalate while state is uncertain', compensation: 'Enforce expiry or additional containment' },
  { operation: 'Evidence delivery', failureHandling: 'Retry from the durable outbox', compensation: 'Preserve existing audit history' },
];
