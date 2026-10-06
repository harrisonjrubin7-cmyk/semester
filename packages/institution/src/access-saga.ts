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
 * AsyncAPI from the PDFs are not adopted: see `docs/decisions/D-1331.md`.
 */

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
 * before any grant existed; once a grant exists, running out of time means
 * `REVOKING`, because the enforcement point has to be told.
 */
export const ACCESS_SAGA: WorkflowDefinition<AccessSagaState> = {
  type: 'access_saga',
  initial: 'RECEIVED',
  terminal: ['DENIED', 'EXPIRED', 'REVOKED'],
  transitions: {
    RECEIVED: ['VALIDATING', 'EXPIRED'],
    VALIDATING: ['EVALUATING', 'DENIED', 'EXPIRED'],
    EVALUATING: ['WAITING_STEP_UP', 'WAITING_APPROVAL', 'PREPARING', 'DENIED', 'EXPIRED'],
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
  /** Cleanup is two independent sides, each confirmed on its own; neither implies the other. */
  compensation: { paRevoked: boolean; pepRemoved: boolean };
  lastError?: string;
}

export interface Decision {
  id: string;
  outcome: 'allow' | 'deny' | 'require_step_up' | 'require_approval';
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
 * - `claim` takes an exclusive, expiring lease with a fencing token, or null.
 * - `save` atomically checks the lease and `expectedRevision`, then writes the
 *   saga, an audit entry and the outbox event in one transaction, rejecting an
 *   expired or stale fencing token.
 * - `wake` authenticates the sender, deduplicates by `eventId` transactionally,
 *   and bumps `generation` when it resumes validation. A wake is a signal; it
 *   carries no claim that anyone is approved or authenticated.
 */
export interface Store {
  claim(id: string): Promise<Lease | null>;
  save(lease: Lease, expectedRevision: number, next: AccessSaga, event: AccessEvent): Promise<void>;
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
 * - `revokePa` revokes by saga and generation *even when no grant id is
 *   known*, so a grant prepared before a crash that never reached the saga row
 *   cannot survive. It records a barrier: an installation whose generation is
 *   at or below the revoked one is rejected, however late its message arrives.
 * - `removePep` removes enforcement at every required point, by the same key.
 * - `verifyCleanup` checks both: the PA will no longer authorize an
 *   installation, and the PEP no longer enforces the grant. Seeing no grant at
 *   the PEP alone does not exclude an installation still in flight.
 */
export interface Services {
  validate(saga: AccessSaga, key: string): Promise<void>;
  evaluate(saga: AccessSaga, key: string): Promise<Decision>;
  prepare(saga: AccessSaga, key: string): Promise<Grant>;
  install(saga: AccessSaga, key: string): Promise<void>;
  inspect(saga: AccessSaga): Promise<Inspection>;
  revokePa(saga: AccessSaga, key: string): Promise<'confirmed' | 'unknown'>;
  removePep(saga: AccessSaga, key: string): Promise<'confirmed' | 'unknown'>;
  verifyCleanup(saga: AccessSaga): Promise<{ paRevoked: boolean; pepAbsent: boolean }>;
}

export class Fault extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, retryable: boolean, message: string = code) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
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

export interface RunnerOptions {
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

  constructor(store: Store, services: Services, options: RunnerOptions = {}) {
    this.store = store;
    this.services = services;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.newId = options.newId ?? (() => globalThis.crypto.randomUUID());
  }

  async tick(id: string): Promise<void> {
    const lease = await this.store.claim(id);
    if (!lease) return;
    const s = lease.saga;

    try {
      if (ACCESS_SAGA.terminal.includes(s.state) || s.nextAttemptAt > this.now()) return;

      const move = async (state: AccessSagaState, patch: Partial<AccessSaga> = {}, reasonCode?: string): Promise<void> => {
        if (state !== s.state) {
          const verdict = transition(ACCESS_SAGA, s.state, state);
          if (!verdict.ok) throw new Fault('INVALID_TRANSITION', false, verdict.reason);
        }
        const next: AccessSaga = { ...s, ...patch, state, revision: s.revision + 1 };
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

      const retry = (code: string) =>
        move(s.state, { attempts: s.attempts + 1, nextAttemptAt: this.now() + backoff(s.attempts + 1, this.random), lastError: code }, code);

      const accessExpired = s.grantExpiresAt !== undefined && this.now() >= s.grantExpiresAt;
      const provisioningExpired = s.state !== 'ACTIVE' && this.now() >= s.deadlineAt;
      if (s.state !== 'REVOKING' && s.state !== 'RECOVERY_REQUIRED' && (accessExpired || provisioningExpired)) {
        await move(s.grantId || MAY_HOLD_GRANT.has(s.state) ? 'REVOKING' : 'EXPIRED', { nextAttemptAt: 0 }, 'DEADLINE_EXCEEDED');
        return;
      }

      try {
        switch (s.state) {
          case 'RECEIVED':
            await move('VALIDATING');
            return;

          case 'VALIDATING':
            await this.services.validate(s, operationKey(s, 'validate'));
            await move('EVALUATING', { attempts: 0, nextAttemptAt: 0 });
            return;

          case 'EVALUATING': {
            const d = await this.services.evaluate(s, operationKey(s, 'evaluate'));
            await move(OUTCOME_STATE[d.outcome], { decisionId: d.id, attempts: 0, nextAttemptAt: 0 });
            return;
          }

          case 'WAITING_STEP_UP':
          case 'WAITING_APPROVAL':
            // Only a verified wake leaves here, and it goes back to VALIDATING.
            return;

          case 'PREPARING': {
            const grant = await this.services.prepare(s, operationKey(s, 'prepare'));
            await move('INSTALLING', { grantId: grant.id, grantExpiresAt: grant.expiresAt, attempts: 0, nextAttemptAt: 0 });
            return;
          }

          case 'INSTALLING':
            await this.services.install(s, operationKey(s, 'install'));
            await move('VERIFYING', { attempts: 0, nextAttemptAt: 0 });
            return;

          case 'VERIFYING': {
            const observed = await this.services.inspect(s);
            if (observed.status === 'installed') await move('ACTIVE', { attempts: 0, nextAttemptAt: 0 });
            else await move(observed.status === 'conflict' ? 'REVOKING' : 'RECONCILING', { nextAttemptAt: 0 });
            return;
          }

          case 'RECONCILING': {
            const observed = await this.services.inspect(s);
            if (observed.status === 'installed') await move('VERIFYING', { nextAttemptAt: 0 });
            else if (observed.status === 'absent') {
              // A new evaluation at a new generation: a stale decision must not be reused.
              await move('EVALUATING', {
                generation: s.generation + 1,
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
              if ((await this.services.revokePa(s, operationKey(s, 'revoke_pa'))) === 'confirmed') {
                await move('REVOKING', { compensation: { ...done, paRevoked: true }, attempts: 0, nextAttemptAt: 0 });
              } else await unconfirmed('REVOCATION_UNCONFIRMED');
            } else if (!done.pepRemoved) {
              if ((await this.services.removePep(s, operationKey(s, 'remove_pep'))) === 'confirmed') {
                await move('REVOKING', { compensation: { ...done, pepRemoved: true }, attempts: 0, nextAttemptAt: 0 });
              } else await unconfirmed('REMOVAL_UNCONFIRMED');
            } else {
              const v = await this.services.verifyCleanup(s);
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
        const fault = error instanceof Fault ? error : new Fault('UNEXPECTED_FAILURE', true);

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
          await move('DENIED', { lastError: fault.code }, fault.code);
          return;
        }
        if (fault.retryable) {
          await retry(fault.code);
          return;
        }
        await move(s.grantId ? 'REVOKING' : 'DENIED', { lastError: fault.code, nextAttemptAt: 0 }, fault.code);
      }
    } finally {
      await this.store.release(lease);
    }
  }
}

// ── The request body and idempotency ──────────────────────────────────────

/** The actions the access-request schema names. Each needs a rule in `policy.ts` before `decide` will allow it. */
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
