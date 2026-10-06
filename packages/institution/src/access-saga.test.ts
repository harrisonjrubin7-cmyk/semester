import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_COMPENSATION,
  ACCESS_REQUEST_ACTIONS,
  ACCESS_SAGA,
  ACCESS_SAGA_STATES,
  AccessSagaRunner,
  DEFAULT_TIMEOUT_MS,
  Fault,
  PersistenceConflict,
  checkTransition,
  withTimeout,
  OUTCOME_STATE,
  backoff,
  canonicalJson,
  checkIdempotency,
  clientRequestIdentity,
  grantAllows,
  operationKey,
  requestDigest,
  validIdempotencyKey,
  sagaOutcomeOf,
  validateAccessRequest,
  type AccessEvent,
  type AccessSaga,
  type AccessSagaState,
  type Decision,
  type Grant,
  type Inspection,
  type Lease,
  type Services,
  type Store,
} from './access-saga.ts';
import { decide, isPolicyAction, type AuthorizationRequest } from './policy.ts';
import { transition, walk } from './workflow.ts';

const T0 = Date.parse('2026-10-06T12:00:00Z');
const HOUR = 3_600_000;

const newSaga = (over: Partial<AccessSaga> = {}): AccessSaga => ({
  id: 'saga-1', tenantId: 't1', subjectId: 'u1', intent: { resourceId: 'r1', action: 'registration.readiness.view' },
  requestDigest: 'digest', definitionVersion: 'access-saga-1', state: 'RECEIVED', revision: 0, generation: 1,
  attempts: 0, deadlineAt: T0 + HOUR, nextAttemptAt: 0, compensation: { paRevoked: false, pepRemoved: false }, staleGrantPossible: false,
  ...over,
});

// ── The machine ─────────────────────────────────────────────────────────────

describe('the machine', () => {
  it('declares every state it uses, and every state reaches an end', () => {
    expect(Object.keys(ACCESS_SAGA.transitions).sort()).toEqual([...ACCESS_SAGA_STATES].sort());
    const endsFrom = (s: AccessSagaState, seen = new Set<string>()): boolean => {
      if (ACCESS_SAGA.terminal.includes(s)) return true;
      if (seen.has(s)) return false;
      seen.add(s);
      return ACCESS_SAGA.transitions[s].some((n) => endsFrom(n, seen));
    };
    for (const s of ACCESS_SAGA_STATES) expect(endsFrom(s), `${s} can end`).toBe(true);
  });

  const reachableAvoiding = (blocked: AccessSagaState): Set<AccessSagaState> => {
    const seen = new Set<AccessSagaState>(['RECEIVED']);
    const queue: AccessSagaState[] = ['RECEIVED'];
    while (queue.length) {
      for (const next of ACCESS_SAGA.transitions[queue.shift()!]) {
        if (next !== blocked && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };

  it('cannot reach a grant without an evaluation, or ACTIVE without verification', () => {
    expect(reachableAvoiding('EVALUATING').has('PREPARING')).toBe(false);
    expect(reachableAvoiding('VERIFYING').has('ACTIVE')).toBe(false);
    // Controls: the same walk does reach them when the gate is open.
    expect(reachableAvoiding('REVOKING').has('PREPARING')).toBe(true);
    expect(reachableAvoiding('REVOKING').has('ACTIVE')).toBe(true);
  });

  it('sends a finished step-up or approval back through validation, never to a grant or a decision', () => {
    for (const waiting of ['WAITING_STEP_UP', 'WAITING_APPROVAL'] as const) {
      for (const to of ['PREPARING', 'EVALUATING', 'INSTALLING', 'ACTIVE'] as const) expect(transition(ACCESS_SAGA, waiting, to).ok, `${waiting} → ${to}`).toBe(false);
      expect(transition(ACCESS_SAGA, waiting, 'VALIDATING').ok).toBe(true);
    }
  });

  it('sends an install found absent back through evaluation, not to another install', () => {
    expect(transition(ACCESS_SAGA, 'RECONCILING', 'EVALUATING').ok).toBe(true);
    expect(transition(ACCESS_SAGA, 'RECONCILING', 'INSTALLING').ok).toBe(false);
  });

  it('never restores access once denied, expired or revoked, and a revoke never returns to ACTIVE', () => {
    for (const end of ['DENIED', 'EXPIRED', 'REVOKED'] as const) {
      for (const to of ACCESS_SAGA_STATES) expect(transition(ACCESS_SAGA, end, to).ok, `${end} → ${to}`).toBe(false);
    }
    for (const from of ['REVOKING', 'RECOVERY_REQUIRED'] as const) {
      for (const to of ['ACTIVE', 'PREPARING', 'INSTALLING', 'VERIFYING', 'EVALUATING'] as const) expect(transition(ACCESS_SAGA, from, to).ok, `${from} → ${to}`).toBe(false);
    }
  });

  it('walks the happy path and the unknown-outcome paths the PDF draws', () => {
    expect(walk(ACCESS_SAGA, 'RECEIVED', ['VALIDATING', 'EVALUATING', 'PREPARING', 'INSTALLING', 'VERIFYING', 'ACTIVE', 'REVOKING', 'REVOKED'])).toMatchObject({ ok: true, state: 'REVOKED' });
    expect(walk(ACCESS_SAGA, 'INSTALLING', ['RECONCILING', 'EVALUATING', 'PREPARING'])).toMatchObject({ ok: true });
    expect(walk(ACCESS_SAGA, 'EVALUATING', ['WAITING_APPROVAL', 'VALIDATING', 'EVALUATING'])).toMatchObject({ ok: true });
    expect(walk(ACCESS_SAGA, 'REVOKING', ['RECOVERY_REQUIRED', 'REVOKING', 'REVOKED'])).toMatchObject({ ok: true });
  });
});

// ── In-memory fakes. Not persistence: they show the runner's contract, nothing more. ──

interface Rig {
  runner: AccessSagaRunner;
  store: FakeStore;
  calls: string[];
  keys: Map<string, string[]>;
  events: AccessEvent[];
  clock: { now: number };
  script: {
    validate?: () => void;
    evaluate: () => Decision;
    prepare?: () => Grant;
    install?: () => void;
    inspect: () => Inspection;
    revokePa: () => 'confirmed' | 'unknown';
    removePep: () => 'confirmed' | 'unknown';
    verifyCleanup: () => { paRevoked: boolean; pepAbsent: boolean };
  };
}

class FakeStore implements Store {
  saved: AccessSaga;
  released = 0;
  held = false;
  rejectSave: Error | null = null;
  flagged: string[] = [];
  events: AccessEvent[] = [];
  constructor(initial: AccessSaga) { this.saved = initial; }
  async claim(_id: string, _leaseMs: number): Promise<Lease | null> {
    if (this.held) return null;
    this.held = true;
    return { token: 'fence-1', saga: this.saved };
  }
  async save(_l: Lease, expectedRevision: number, next: AccessSaga, event: AccessEvent): Promise<void> {
    if (this.rejectSave) {
      // One failure, then storage recovers: a runner that retried or denied on it would show as a second save.
      const failure = this.rejectSave;
      this.rejectSave = null;
      throw failure;
    }
    if (this.saved.revision !== expectedRevision) throw new PersistenceConflict('REVISION_CONFLICT');
    this.saved = next;
    this.events.push(event);
  }
  async flagRecovery(_l: Lease, code: string): Promise<void> { this.flagged.push(code); }
  async release(): Promise<void> { this.held = false; this.released += 1; }
  async wake(): Promise<void> {}
}

function rig(initial: AccessSaga, script: Partial<Rig['script']> = {}): Rig {
  const store = new FakeStore(initial);
  const calls: string[] = [];
  const keys = new Map<string, string[]>();
  const clock = { now: T0 };
  const full: Rig['script'] = {
    evaluate: () => ({ id: 'dec-1', outcome: 'allow' }),
    inspect: () => ({ status: 'installed' }),
    revokePa: () => 'confirmed',
    removePep: () => 'confirmed',
    verifyCleanup: () => ({ paRevoked: true, pepAbsent: true }),
    ...script,
  };
  const note = (name: string, key?: string) => {
    calls.push(name);
    if (key !== undefined) keys.set(name, [...(keys.get(name) ?? []), key]);
  };
  const services: Services = {
    async validate(_s, key) { note('validate', key); full.validate?.(); },
    async evaluate(_s, key) { note('evaluate', key); return full.evaluate(); },
    async prepare(_s, key) { note('prepare', key); return full.prepare ? full.prepare() : { id: 'grant-1', expiresAt: T0 + 30 * 60_000 }; },
    async install(_s, key) { note('install', key); full.install?.(); },
    async inspect() { note('inspect'); return full.inspect(); },
    async revokePa(_s, key) { note('revoke_pa', key); return full.revokePa(); },
    async removePep(_s, key) { note('remove_pep', key); return full.removePep(); },
    async verifyCleanup() { note('verify_cleanup'); return full.verifyCleanup(); },
  };
  let n = 0;
  const runner = new AccessSagaRunner(store, services, { now: () => clock.now, random: () => 0.5, newId: () => `evt-${++n}` });
  return { runner, store, calls, keys, events: store.events, clock, script: full };
}

const tick = (r: Rig) => r.runner.tick('saga-1');

/** Tick until the saga stops moving, at most `max` times. */
async function drive(r: Rig, max = 30): Promise<AccessSagaState[]> {
  const path: AccessSagaState[] = [r.store.saved.state];
  for (let i = 0; i < max; i += 1) {
    const before = r.store.saved.revision;
    await tick(r);
    if (r.store.saved.revision === before) break;
    path.push(r.store.saved.state);
  }
  return path;
}

describe('the runner', () => {
  it('provisions a grant one move per tick, through verification, and leaves ACTIVE alone', async () => {
    const r = rig(newSaga());
    expect(await drive(r)).toEqual(['RECEIVED', 'VALIDATING', 'EVALUATING', 'PREPARING', 'INSTALLING', 'VERIFYING', 'ACTIVE']);
    expect(r.store.saved).toMatchObject({ state: 'ACTIVE', grantId: 'grant-1', decisionId: 'dec-1', revision: 6 });
    expect(r.events.map((e) => e.revision)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.store.released).toBeGreaterThanOrEqual(7);
  });

  it('writes a state-changed event with every move, in the same save', async () => {
    const r = rig(newSaga());
    await tick(r);
    expect(r.events).toEqual([{ eventId: 'evt-1', type: 'access.state.changed', sagaId: 'saga-1', tenantId: 't1', revision: 1, occurredAt: '2026-10-06T12:00:00.000Z', reasonCode: undefined }]);
  });

  it('does nothing when it cannot take the lease, and releases it when it can', async () => {
    const r = rig(newSaga());
    r.store.held = true;
    await tick(r);
    expect(r.store.saved.revision).toBe(0);
    expect(r.store.released).toBe(0);
    r.store.held = false;
    await tick(r);
    expect(r.store.saved.revision).toBe(1);
    expect(r.store.held).toBe(false);
  });

  it('does nothing to a terminal saga, or before its next attempt is due', async () => {
    for (const state of ['DENIED', 'EXPIRED', 'REVOKED'] as const) {
      const r = rig(newSaga({ state }));
      await tick(r);
      expect(r.store.saved.revision, state).toBe(0);
      // Long after its deadline, a finished saga is still finished: it is not moved to EXPIRED.
      const late = rig(newSaga({ state }));
      late.clock.now = T0 + 10 * HOUR;
      await tick(late);
      expect(late.store.saved, `${state} past its deadline`).toMatchObject({ state, revision: 0 });
    }
    const waiting = rig(newSaga({ state: 'VALIDATING', nextAttemptAt: T0 + 5_000 }));
    await tick(waiting);
    expect(waiting.calls).toEqual([]);
    waiting.clock.now = T0 + 5_000;
    await tick(waiting);
    expect(waiting.calls).toEqual(['validate']);
  });

  it('leaves a waiting saga waiting: no event it receives can approve it', async () => {
    for (const state of ['WAITING_STEP_UP', 'WAITING_APPROVAL'] as const) {
      const r = rig(newSaga({ state }));
      await tick(r);
      expect(r.store.saved.state).toBe(state);
      expect(r.calls).toEqual([]);
    }
  });

  it.each([
    ['deny', 'DENIED'], ['require_step_up', 'WAITING_STEP_UP'], ['require_approval', 'WAITING_APPROVAL'], ['allow', 'PREPARING'],
  ] as const)('maps a %s decision to %s and records which decision it was', async (outcome, state) => {
    const r = rig(newSaga({ state: 'EVALUATING' }), { evaluate: () => ({ id: 'dec-9', outcome }) });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state, decisionId: 'dec-9' });
    expect(OUTCOME_STATE[outcome]).toBe(state);
  });

  it('never prepares a grant from a deny or a wait', async () => {
    for (const outcome of ['deny', 'require_step_up', 'require_approval'] as const) {
      const r = rig(newSaga({ state: 'EVALUATING' }), { evaluate: () => ({ id: 'd', outcome }) });
      await drive(r);
      expect(r.calls, outcome).not.toContain('prepare');
    }
  });

  it('keys each operation by saga, definition, generation and step, and reuses the key on a retry', async () => {
    let failures = 1;
    const r = rig(newSaga({ state: 'VALIDATING' }), { validate: () => { if (failures-- > 0) throw new Fault('DEPENDENCY_UNAVAILABLE', true); } });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'VALIDATING', attempts: 1, lastError: 'DEPENDENCY_UNAVAILABLE' });
    r.clock.now = r.store.saved.nextAttemptAt;
    await tick(r);
    expect(r.keys.get('validate')).toEqual([operationKey(newSaga(), 'validate'), operationKey(newSaga(), 'validate')]);
    expect(r.store.saved.state).toBe('EVALUATING');
    expect(operationKey(newSaga(), 'validate')).not.toBe(operationKey(newSaga({ generation: 2 }), 'validate'));
  });

  it('backs off with jitter, capped, and resets the count on progress', async () => {
    expect(backoff(1, () => 0)).toBe(0);
    expect(backoff(1, () => 0.999)).toBeLessThan(1000);
    expect(backoff(20, () => 0.999999)).toBeLessThan(60_000);
    expect(backoff(20, () => 0.999999)).toBeGreaterThan(30_000);
    const r = rig(newSaga({ state: 'VALIDATING', attempts: 4 }));
    await tick(r);
    expect(r.store.saved.attempts).toBe(0);
  });

  it('a non-retryable fault before any grant denies; after one, revokes', async () => {
    const before = rig(newSaga({ state: 'EVALUATING' }), { evaluate: () => { throw new Fault('FORBIDDEN', false); } });
    await tick(before);
    expect(before.store.saved).toMatchObject({ state: 'DENIED', lastError: 'FORBIDDEN' });
    const after = rig(newSaga({ state: 'VERIFYING', grantId: 'g', grantExpiresAt: T0 + HOUR }), { inspect: () => { throw new Fault('FORBIDDEN', false); } });
    await tick(after);
    expect(after.store.saved.state).toBe('REVOKING');
  });

  it('refuses to cut a grant from a stale decision', async () => {
    const r = rig(newSaga({ state: 'PREPARING' }), { prepare: () => { throw new Fault('STALE_DECISION', true); } });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'DENIED', lastError: 'STALE_DECISION' });
    expect(r.store.saved.grantId).toBeUndefined();
  });

  it('stands down when the saga moved under it: nothing overwritten, nothing retried, lease released', async () => {
    const r = rig(newSaga({ state: 'VALIDATING' }));
    r.store.rejectSave = new PersistenceConflict('stale fencing token');
    await tick(r);
    expect(r.store.saved.revision).toBe(0);
    expect(r.store.held).toBe(false);
    expect(r.calls).toEqual(['validate']);
    expect(r.store.flagged).toEqual([]);
  });

  it('does not take a storage failure for a participant failure: it is raised, not retried, denied or revoked', async () => {
    const r = rig(newSaga({ state: 'VALIDATING' }));
    r.store.rejectSave = new Error('connection reset');
    await expect(tick(r)).rejects.toThrow('connection reset');
    expect(r.store.saved).toMatchObject({ state: 'VALIDATING', revision: 0, attempts: 0 });
    expect(r.store.held).toBe(false);
    // The same failure while installing is not an install of unknown outcome either.
    const installing = rig(newSaga({ state: 'INSTALLING', grantId: 'g', grantExpiresAt: T0 + HOUR }));
    installing.store.rejectSave = new Error('connection reset');
    await expect(tick(installing)).rejects.toThrow('connection reset');
    expect(installing.store.saved.state).toBe('INSTALLING');
});
});

describe('an install of unknown outcome', () => {
  const installing = () => newSaga({ state: 'INSTALLING', grantId: 'grant-1', grantExpiresAt: T0 + 30 * 60_000, decisionId: 'dec-1' });

  it('is reconciliation, never failure, whatever the error', async () => {
    for (const err of [new Fault('TIMEOUT', true), new Fault('REFUSED', false), new Error('boom')]) {
      const r = rig(installing(), { install: () => { throw err; } });
      await tick(r);
      expect(r.store.saved.state, String(err)).toBe('RECONCILING');
      expect(r.store.saved.grantId).toBe('grant-1');
    }
  });

  const reconciling = () => newSaga({ state: 'RECONCILING', grantId: 'grant-1', grantExpiresAt: T0 + 30 * 60_000, decisionId: 'dec-1', attempts: 2 });

  it('installed → VERIFYING', async () => {
    const r = rig(reconciling(), { inspect: () => ({ status: 'installed' }) });
    await tick(r);
    expect(r.store.saved.state).toBe('VERIFYING');
  });

  it('absent → a new evaluation at the next generation, with the old decision and grant forgotten', async () => {
    const r = rig(reconciling(), { inspect: () => ({ status: 'absent' }) });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'EVALUATING', generation: 2, attempts: 0 });
    expect(r.store.saved.decisionId).toBeUndefined();
    expect(r.store.saved.grantId).toBeUndefined();
    expect(r.store.saved.grantExpiresAt).toBeUndefined();
    await tick(r);
    expect(r.keys.get('evaluate')).toEqual([operationKey(newSaga({ generation: 2 }), 'evaluate')]);
  });

  it('conflict → REVOKING', async () => {
    const r = rig(reconciling(), { inspect: () => ({ status: 'conflict' }) });
    await tick(r);
    expect(r.store.saved.state).toBe('REVOKING');
  });

  it('unknown → stay, retry later, and let the deadline end it in revocation', async () => {
    const r = rig(reconciling(), { inspect: () => ({ status: 'unknown' }) });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'RECONCILING', attempts: 3, lastError: 'ENFORCEMENT_UNKNOWN' });
    expect(r.store.saved.nextAttemptAt).toBeGreaterThan(T0);
    r.clock.now = T0 + 2 * HOUR;
    r.store.saved = { ...r.store.saved, nextAttemptAt: 0 };
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'REVOKING' });
  });

  it('a verification that finds a conflict revokes; one that cannot tell reconciles', async () => {
    const v = (status: Inspection['status']) => rig(newSaga({ state: 'VERIFYING', grantId: 'g', grantExpiresAt: T0 + HOUR }), { inspect: () => ({ status }) });
    const conflict = v('conflict'); await tick(conflict); expect(conflict.store.saved.state).toBe('REVOKING');
    const unknown = v('unknown'); await tick(unknown); expect(unknown.store.saved.state).toBe('RECONCILING');
    const absent = v('absent'); await tick(absent); expect(absent.store.saved.state).toBe('RECONCILING');
    const installed = v('installed'); await tick(installed); expect(installed.store.saved.state).toBe('ACTIVE');
  });
});

describe('a revocation that arrives while an install is in flight', () => {
  it('cannot be undone by the install finishing: the late result is rejected and access never becomes ACTIVE', async () => {
    const r = rig(newSaga({ state: 'INSTALLING', grantId: 'grant-1', grantExpiresAt: T0 + HOUR }), {
      // The wake lands while `install` is still running: the store moves on under the worker.
      install: () => { r.store.saved = { ...r.store.saved, state: 'REVOKING', revision: r.store.saved.revision + 1 }; },
    });
    await tick(r); // stands down: the revocation owns the saga now
    expect(r.store.saved.state).toBe('REVOKING');
    expect(r.events.map((e) => e.reasonCode)).not.toContain('RESULT_INSTALL');
    // The next worker finishes the revocation; at no point was the saga ACTIVE.
    await drive(r);
    expect(r.store.saved.state).toBe('REVOKED');
    expect(r.calls).not.toContain('inspect');
  });
});

describe('time', () => {
  it('ends a request that ran out of time before any grant as EXPIRED, with nothing to revoke', async () => {
    const r = rig(newSaga({ state: 'WAITING_APPROVAL' }));
    r.clock.now = T0 + HOUR;
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'EXPIRED' });
    expect(r.calls).toEqual([]);
  });

  it('revokes, not expires, once a grant exists', async () => {
    for (const state of ['PREPARING', 'INSTALLING', 'VERIFYING', 'RECONCILING'] as const) {
      const r = rig(newSaga({ state, grantId: 'g', grantExpiresAt: T0 + 2 * HOUR }));
      r.clock.now = T0 + HOUR;
      await tick(r);
      expect(r.store.saved, state).toMatchObject({ state: 'REVOKING' });
      expect(r.events.at(-1)?.reasonCode).toBe('DEADLINE_EXCEEDED');
    }
  });

  it('revokes an ACTIVE grant when it expires, but not when only the provisioning deadline has passed', async () => {
    const active = rig(newSaga({ state: 'ACTIVE', grantId: 'g', grantExpiresAt: T0 + 30 * 60_000 }));
    active.clock.now = T0 + 2 * HOUR; // past both
    await tick(active);
    expect(active.store.saved.state).toBe('REVOKING');
    const inTime = rig(newSaga({ state: 'ACTIVE', grantId: 'g', grantExpiresAt: T0 + 3 * HOUR }));
    inTime.clock.now = T0 + 2 * HOUR; // past the provisioning deadline only
    await tick(inTime);
    expect(inTime.store.saved.state).toBe('ACTIVE');
  });

  it('keeps revoking after the deadline: a revocation must not be abandoned by the clock', async () => {
    const r = rig(newSaga({ state: 'REVOKING', grantId: 'g', grantExpiresAt: T0 + 1 }));
    r.clock.now = T0 + 10 * HOUR;
    await drive(r);
    expect(r.store.saved.state).toBe('REVOKED');
  });

  it('revokes a grant that may exist unattached: a crash after prepare succeeded, before the saga row learned of it', async () => {
    // No grantId is recorded, yet the administrator may hold a prepared grant. Expiring would leave it standing.
    const r = rig(newSaga({ state: 'PREPARING' }));
    r.clock.now = T0 + HOUR;
    expect(await drive(r)).toEqual(['PREPARING', 'REVOKING', 'REVOKING', 'REVOKING', 'REVOKED']);
    expect(r.calls).toEqual(['revoke_pa', 'remove_pep', 'verify_cleanup']);
    expect(r.store.saved.grantId).toBeUndefined();
  });

  it('only expires a request that cannot have a grant', async () => {
    for (const state of ['RECEIVED', 'VALIDATING', 'EVALUATING', 'WAITING_STEP_UP', 'WAITING_APPROVAL'] as const) {
      const r = rig(newSaga({ state }));
      r.clock.now = T0 + HOUR;
      await tick(r);
      expect(r.store.saved.state, state).toBe('EXPIRED');
    }
  });
});

describe('revocation', () => {
  const revoking = (over: Partial<AccessSaga> = {}) => newSaga({ state: 'REVOKING', grantId: 'grant-1', grantExpiresAt: T0 + HOUR, ...over });

  it('confirms the administrator, then the enforcement point, then verifies both, one step per tick', async () => {
    const r = rig(revoking());
    expect(await drive(r)).toEqual(['REVOKING', 'REVOKING', 'REVOKING', 'REVOKED']);
    expect(r.calls).toEqual(['revoke_pa', 'remove_pep', 'verify_cleanup']);
    expect(r.keys.get('revoke_pa')).toEqual([operationKey(newSaga(), 'revoke_pa')]);
    expect(r.keys.get('remove_pep')).toEqual([operationKey(newSaga(), 'remove_pep')]);
  });

  it('needs no grant id: it revokes by saga and generation', async () => {
    const r = rig(revoking({ grantId: undefined }));
    await drive(r);
    expect(r.store.saved.state).toBe('REVOKED');
    expect(r.calls).toEqual(['revoke_pa', 'remove_pep', 'verify_cleanup']);
  });

  it('an unconfirmed or failed side is RECOVERY_REQUIRED, retried, and never REVOKED', async () => {
    for (const [which, script] of [
      ['revoke_pa unknown', { revokePa: () => 'unknown' as const }],
      ['revoke_pa throws', { revokePa: () => { throw new Fault('PA_UNREACHABLE', true); } }],
    ] as const) {
      const r = rig(revoking(), script);
      await tick(r);
      expect(r.store.saved.state, which).toBe('RECOVERY_REQUIRED');
      expect(r.store.saved.attempts, which).toBe(1);
      expect(r.store.saved.compensation, which).toEqual({ paRevoked: false, pepRemoved: false });
    }
    const pep = rig(revoking({ compensation: { paRevoked: true, pepRemoved: false } }), { removePep: () => 'unknown' });
    await tick(pep);
    expect(pep.store.saved).toMatchObject({ state: 'RECOVERY_REQUIRED', compensation: { paRevoked: true, pepRemoved: false } });
    // Recovery resumes at the side that failed; the one already confirmed is not repeated.
    pep.script.removePep = () => 'confirmed';
    pep.clock.now = T0 + 10 * HOUR;
    pep.store.saved = { ...pep.store.saved, nextAttemptAt: 0, deadlineAt: T0 + 20 * HOUR };
    await drive(pep);
    expect(pep.store.saved.state).toBe('REVOKED');
    expect(pep.calls.filter((c) => c === 'revoke_pa')).toEqual([]);
  });

  it('is not complete until the cleanup is verified on both sides, and reopens the side that is not', async () => {
    for (const [which, v, expected] of [
      ['the PEP still enforces', { paRevoked: true, pepAbsent: false }, { paRevoked: true, pepRemoved: false }],
      ['the PA would still authorize', { paRevoked: false, pepAbsent: true }, { paRevoked: false, pepRemoved: true }],
      ['neither', { paRevoked: false, pepAbsent: false }, { paRevoked: false, pepRemoved: false }],
    ] as const) {
      const r = rig(revoking({ compensation: { paRevoked: true, pepRemoved: true } }), { verifyCleanup: () => v });
      await tick(r);
      expect(r.store.saved, which).toMatchObject({ state: 'RECOVERY_REQUIRED', compensation: expected });
      expect(r.events.at(-1)?.reasonCode, which).toBe('CLEANUP_UNVERIFIED');
    }
  });

  it('turns RECOVERY_REQUIRED back into REVOKING, and does not call anything on the way', async () => {
    const r = rig(revoking({ state: 'RECOVERY_REQUIRED' }));
    await tick(r);
    expect(r.store.saved.state).toBe('REVOKING');
    expect(r.calls).toEqual([]);
  });
});

// ── Request body, idempotency, grants, policy as data ─────────────────────

const schema = JSON.parse(readFileSync(new URL('../../../docs/control-plane/access-request.schema.json', import.meta.url), 'utf8'));

describe('the access request', () => {
  it('holds the schema file and the validator to each other', () => {
    expect(schema.required).toEqual(['resourceId', 'action']);
    expect(Object.keys(schema.properties)).toEqual(['resourceId', 'action']);
    expect(schema.properties.action.enum).toEqual([...ACCESS_REQUEST_ACTIONS]);
    expect(schema.properties.resourceId).toMatchObject({ minLength: 1, maxLength: 200 });
  });

  it('accepts intent and nothing else', () => {
    expect(validateAccessRequest({ resourceId: 'r1', action: 'registration.readiness.view' })).toEqual({ ok: true, intent: { resourceId: 'r1', action: 'registration.readiness.view' } });
    for (const claim of ['subjectId', 'tenantId', 'capabilities', 'trustScore', 'approved', 'authenticated']) {
      expect(validateAccessRequest({ resourceId: 'r1', action: 'registration.readiness.view', [claim]: 'x' }), claim).toMatchObject({ ok: false, errors: [`$.${claim}: not allowed`] });
    }
  });

  it('bounds the resource id and names only the three actions', () => {
    expect(validateAccessRequest({ resourceId: '', action: 'registration.readiness.view' }).ok).toBe(false);
    expect(validateAccessRequest({ resourceId: 'x'.repeat(200), action: 'registration.readiness.view' }).ok).toBe(true);
    expect(validateAccessRequest({ resourceId: 'x'.repeat(201), action: 'registration.readiness.view' }).ok).toBe(false);
    expect(validateAccessRequest({ resourceId: 'r', action: 'grades.delete' }).ok).toBe(false);
    for (const v of [null, undefined, 'x', 3, []]) expect(validateAccessRequest(v).ok).toBe(false);
  });
});

describe('idempotency', () => {
  const identity = clientRequestIdentity({ tenantId: 't1', callerId: 'u1', endpoint: 'POST /pep/access-requests', idempotencyKey: 'k'.repeat(16) });

  it('bounds the key at 16–200 characters, and only strings', () => {
    expect(validIdempotencyKey('k'.repeat(16))).toBe(true);
    expect(validIdempotencyKey('k'.repeat(200))).toBe(true);
    expect(validIdempotencyKey('k'.repeat(15))).toBe(false);
    expect(validIdempotencyKey('k'.repeat(201))).toBe(false);
    expect(validIdempotencyKey(undefined)).toBe(false);
    expect(validIdempotencyKey(1234567890123456)).toBe(false);
  });

  it('is new, replays the recorded result, and refuses a changed payload under the same key', () => {
    expect(checkIdempotency(undefined, identity, 'abc')).toEqual({ kind: 'new' });
    const rec = { identity, digest: 'abc', result: { requestId: 'r1' } };
    expect(checkIdempotency(rec, identity, 'abc')).toEqual({ kind: 'replay', result: { requestId: 'r1' } });
    expect(checkIdempotency(rec, identity, 'xyz')).toEqual({ kind: 'conflict', status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('keys per tenant, caller and endpoint: the same key from someone else is a new request', () => {
    const rec = { identity, digest: 'abc', result: 1 };
    for (const other of [
      { tenantId: 't2', callerId: 'u1', endpoint: 'POST /pep/access-requests' },
      { tenantId: 't1', callerId: 'u2', endpoint: 'POST /pep/access-requests' },
      { tenantId: 't1', callerId: 'u1', endpoint: 'POST /pa/grants' },
    ]) expect(checkIdempotency(rec, clientRequestIdentity({ ...other, idempotencyKey: 'k'.repeat(16) }), 'abc')).toEqual({ kind: 'new' });
  });

  it('cannot be made to collide by moving a separator between fields', () => {
    const a = clientRequestIdentity({ tenantId: 'a:b', callerId: 'c', endpoint: 'e', idempotencyKey: 'k'.repeat(16) });
    const b = clientRequestIdentity({ tenantId: 'a', callerId: 'b:c', endpoint: 'e', idempotencyKey: 'k'.repeat(16) });
    expect(a).not.toBe(b);
    expect(operationKey({ id: 'a:b', definitionVersion: 'c', generation: 1 }, 's')).not.toBe(operationKey({ id: 'a', definitionVersion: 'b:c', generation: 1 }, 's'));
  });

  it('digests a payload the same whatever order its keys arrive in, and differently when a value differs', async () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    const x = await requestDigest({ resourceId: 'r1', action: 'read' });
    expect(x).toMatch(/^[0-9a-f]{64}$/);
    expect(await requestDigest({ action: 'read', resourceId: 'r1' })).toBe(x);
    expect(await requestDigest({ action: 'write', resourceId: 'r1' })).not.toBe(x);
  });
});

describe('what an active saga permits', () => {
  const active = newSaga({ state: 'ACTIVE', grantId: 'g', grantExpiresAt: T0 + HOUR });
  const request = { tenantId: 't1', subjectId: 'u1', resourceId: 'r1', action: 'registration.readiness.view' };

  it('allows the exact operation while active and in time', () => {
    expect(grantAllows(active, request, T0)).toBe(true);
  });

  it('refuses one thing changed at a time', () => {
    for (const [what, ok] of [
      ['another resource', grantAllows(active, { ...request, resourceId: 'r2' }, T0)],
      ['another action', grantAllows(active, { ...request, action: 'registration.override.approve' }, T0)],
      ['another subject', grantAllows(active, { ...request, subjectId: 'u2' }, T0)],
      ['another tenant', grantAllows(active, { ...request, tenantId: 't2' }, T0)],
      ['at the expiry instant', grantAllows(active, request, T0 + HOUR)],
      ['a revocation underway', grantAllows({ ...active, state: 'REVOKING' }, request, T0)],
      ['not yet verified', grantAllows({ ...active, state: 'VERIFYING' }, request, T0)],
      ['no expiry recorded', grantAllows({ ...active, grantExpiresAt: undefined }, request, T0)],
    ] as const) expect(ok, what).toBe(false);
  });
});

describe('the compensation policy', () => {
  it('names an operation, a handling and a way back for each, and never offers to restore revoked access', () => {
    expect(ACCESS_COMPENSATION).toHaveLength(10);
    for (const c of ACCESS_COMPENSATION) {
      expect(c.failureHandling.length, c.operation).toBeGreaterThan(0);
      expect(c.compensation ?? '', c.operation).not.toMatch(/restore (the )?access|re-?grant|reverse/i);
    }
    expect(ACCESS_COMPENSATION.find((c) => c.operation === 'Install grant')?.failureHandling).toMatch(/never a blind assumption/);
  });
});

describe('time limits on a participant', () => {
  it('stops waiting at the operation timeout and reports an unknown outcome, aborting the call', async () => {
    let aborted = false;
    const r = rig(newSaga({ state: 'VALIDATING' }));
    const stuck: Services['validate'] = (_s, _k, signal) => new Promise<void>(() => { signal.addEventListener('abort', () => { aborted = true; }); });
    const runner = new AccessSagaRunner(r.store, { validate: stuck } as unknown as Services, { now: () => T0, random: () => 0.5, newId: () => 'e', timeouts: { validate: 15 } });
    await runner.tick('saga-1');
    expect(aborted).toBe(true);
    expect(r.store.saved).toMatchObject({ state: 'VALIDATING', attempts: 1, lastError: 'OPERATION_TIMEOUT' });
  });

  it('a timed-out install is reconciled, not retried blind', async () => {
    const r = rig(newSaga({ state: 'INSTALLING', grantId: 'g', grantExpiresAt: T0 + HOUR }));
    const slow = { install: () => new Promise<void>(() => {}) } as unknown as Services;
    const runner = new AccessSagaRunner(r.store, slow, { now: () => T0, random: () => 0.5, newId: () => 'e', timeouts: { install: 15 } });
    await runner.tick('saga-1');
    expect(r.store.saved).toMatchObject({ state: 'RECONCILING', lastError: 'OPERATION_TIMEOUT' });
  });

  it('withTimeout passes a result through, and clears its timer', async () => {
    expect(await withTimeout(1_000, async () => 7)).toBe(7);
    await expect(withTimeout(10, () => new Promise<number>(() => {}))).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT', retryable: true, outcomeUnknown: true });
  });

  it('names a limit for every operation', () => {
    expect(Object.keys(DEFAULT_TIMEOUT_MS).sort()).toEqual(['evaluate', 'inspect', 'install', 'prepare', 'remove_pep', 'revoke_pa', 'validate', 'verify_cleanup']);
    for (const ms of Object.values(DEFAULT_TIMEOUT_MS)) expect(ms).toBeGreaterThan(0);
  });
});

describe('escalation', () => {
  it('tells an operator once the retry budget is spent, and keeps retrying: escalation is not closure', async () => {
    const r = rig(newSaga({ state: 'RECONCILING', grantId: 'g', grantExpiresAt: T0 + HOUR, attempts: 7 }), { inspect: () => ({ status: 'unknown' }) });
    const escalating = new AccessSagaRunner(r.store, { inspect: async () => ({ status: 'unknown' as const }) } as unknown as Services, { now: () => T0, random: () => 0.5, newId: () => 'e', escalateAfter: 8 });
    await escalating.tick('saga-1');
    expect(r.store.flagged).toEqual(['ENFORCEMENT_UNKNOWN']);
    expect(r.store.saved).toMatchObject({ state: 'RECONCILING', attempts: 8 });
    // Below the budget, nothing is flagged.
    const early = rig(newSaga({ state: 'RECONCILING', grantId: 'g', grantExpiresAt: T0 + HOUR, attempts: 2 }), { inspect: () => ({ status: 'unknown' }) });
    await tick(early);
    expect(early.store.flagged).toEqual([]);
  });

  it('applies to a revocation that will not confirm, which is never given up on', async () => {
    const r = rig(newSaga({ state: 'REVOKING', grantId: 'g', attempts: 9 }), { revokePa: () => 'unknown' });
    await tick(r);
    expect(r.store.flagged).toEqual(['REVOCATION_UNCONFIRMED']);
    expect(r.store.saved.state).toBe('RECOVERY_REQUIRED');
  });
});

describe('the transition guard', () => {
  const cur = newSaga({ state: 'REVOKING', compensation: { paRevoked: true, pepRemoved: true }, revision: 4 });
  const nxt = (over: Partial<AccessSaga>): AccessSaga => ({ ...cur, revision: 5, ...over });

  it('passes the moves the runner makes', () => {
    expect(checkTransition(cur, nxt({ state: 'REVOKED' }))).toBeNull();
    expect(checkTransition(newSaga({ state: 'RECONCILING', revision: 1 }), newSaga({ state: 'EVALUATING', revision: 2, generation: 2 }))).toBeNull();
  });

  it('refuses one thing wrong at a time', () => {
    for (const [what, next, code] of [
      ['another saga', nxt({ id: 'saga-2' }), 'IDENTITY_CHANGED'],
      ['another tenant', nxt({ tenantId: 't2' }), 'IDENTITY_CHANGED'],
      ['another request', nxt({ requestDigest: 'other' }), 'IDENTITY_CHANGED'],
      ['a stale revision', nxt({ revision: 4 }), 'REVISION_NOT_NEXT'],
      ['a skipped revision', nxt({ revision: 6 }), 'REVISION_NOT_NEXT'],
      ['an illegal edge', nxt({ state: 'ACTIVE' }), 'ILLEGAL_EDGE'],
      ['a generation bumped for no reason', nxt({ generation: 2 }), 'GENERATION_CHANGED'],
      ['REVOKED with the PA unconfirmed', nxt({ state: 'REVOKED', compensation: { paRevoked: false, pepRemoved: true } }), 'CLEANUP_NOT_CONFIRMED'],
      ['REVOKED with the PEP unconfirmed', nxt({ state: 'REVOKED', compensation: { paRevoked: true, pepRemoved: false } }), 'CLEANUP_NOT_CONFIRMED'],
    ] as const) expect(checkTransition(cur, next), what).toMatch(new RegExp(code));
  });

  it('requires the generation to move when evaluation restarts from reconciliation, and only then', () => {
    const rec = newSaga({ state: 'RECONCILING', revision: 1 });
    expect(checkTransition(rec, newSaga({ state: 'EVALUATING', revision: 2, generation: 1 }))).toMatch(/GENERATION_CHANGED/);
    expect(checkTransition(rec, newSaga({ state: 'VERIFYING', revision: 2, generation: 2 }))).toMatch(/GENERATION_CHANGED/);
  });

  it('lets an honest cleanup close the saga through it', async () => {
    // No path in the runner reaches a refusal today, by design: the guard is a second line behind the
    // runner's own checks, so what is shown here is that the runner's closing move passes it.
    const r = rig(newSaga({ state: 'REVOKING', compensation: { paRevoked: true, pepRemoved: true } }));
    await tick(r);
    expect(r.store.saved.state).toBe('REVOKED');
});
});

describe('a grant an earlier generation may have left behind', () => {
  const absent = () => newSaga({ state: 'RECONCILING', grantId: 'grant-1', grantExpiresAt: T0 + HOUR, decisionId: 'dec-1' });

  it('is remembered when an install is found absent, though the grant id is forgotten', async () => {
    const r = rig(absent(), { inspect: () => ({ status: 'absent' }) });
    await tick(r);
    expect(r.store.saved).toMatchObject({ state: 'EVALUATING', generation: 2, staleGrantPossible: true });
    expect(r.store.saved.grantId).toBeUndefined();
  });

  it('is revoked if the new evaluation denies, instead of ending as DENIED', async () => {
    const r = rig(absent(), { inspect: () => ({ status: 'absent' }), evaluate: () => ({ id: 'dec-2', outcome: 'deny' }) });
    await tick(r);
    await tick(r);
    expect(r.store.saved.state).toBe('REVOKING');
    await drive(r);
    expect(r.store.saved.state).toBe('REVOKED');
    expect(r.calls).toContain('revoke_pa');
    // The control: the same denial with no earlier generation ends the request as DENIED.
    const clean = rig(newSaga({ state: 'EVALUATING' }), { evaluate: () => ({ id: 'd', outcome: 'deny' }) });
    await tick(clean);
    expect(clean.store.saved.state).toBe('DENIED');
  });

  it('is revoked, not expired, when the deadline passes in any state after the restart', async () => {
    for (const state of ['VALIDATING', 'EVALUATING', 'WAITING_STEP_UP', 'WAITING_APPROVAL', 'PREPARING'] as const) {
      const r = rig(newSaga({ state, generation: 2, staleGrantPossible: true }));
      r.clock.now = T0 + HOUR;
      await tick(r);
      expect(r.store.saved.state, state).toBe('REVOKING');
    }
  });

  it('is revoked on a non-retryable fault and on a stale decision after the restart', async () => {
    const forbidden = rig(newSaga({ state: 'EVALUATING', generation: 2, staleGrantPossible: true }), { evaluate: () => { throw new Fault('FORBIDDEN', false); } });
    await tick(forbidden);
    expect(forbidden.store.saved.state).toBe('REVOKING');
    const stale = rig(newSaga({ state: 'PREPARING', generation: 2, staleGrantPossible: true }), { prepare: () => { throw new Fault('STALE_DECISION', true); } });
    await tick(stale);
    expect(stale.store.saved.state).toBe('REVOKING');
  });
});

describe('a wake that resumes validation from a wait', () => {
  it('leaves the saga at the generation the store gave it, and the next evaluation gets a new key', async () => {
    // The store's wake moved WAITING_APPROVAL -> VALIDATING and bumped the generation; the runner reads that as current.
    const r = rig(newSaga({ state: 'VALIDATING', generation: 2 }));
    await drive(r);
    expect(r.store.saved).toMatchObject({ state: 'ACTIVE', generation: 2 });
    expect(r.keys.get('evaluate')).toEqual([operationKey(newSaga({ generation: 2 }), 'evaluate')]);
    expect(operationKey(newSaga({ generation: 2 }), 'evaluate')).not.toBe(operationKey(newSaga({ generation: 1 }), 'evaluate'));
  });
});

describe('a call that outlives its timeout', () => {
  it('does not leave an unhandled rejection behind when it fails after the wait was abandoned', async () => {
    const seen: unknown[] = [];
    const listener = (reason: unknown) => { seen.push(reason); };
    process.on('unhandledRejection', listener);
    try {
      await expect(withTimeout(5, (signal) => new Promise<number>((_, reject) => {
        signal.addEventListener('abort', () => setTimeout(() => reject(new Error('aborted late')), 10));
      }))).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('treats a call that throws synchronously as the participant failing, not the worker', async () => {
    await expect(withTimeout(50, () => { throw new Fault('BOOM', false); })).rejects.toMatchObject({ code: 'BOOM' });
  });
});

describe('the access-request actions and the policy that decides them', () => {
  it('every action the request schema names is an action `decide` has a rule for', () => {
    for (const action of ACCESS_REQUEST_ACTIONS) expect(isPolicyAction(action), action).toBe(true);
  });

  const NOW_ISO = '2026-10-06T12:00:00Z';
  const readiness = (over: Partial<AuthorizationRequest['actor']> = {}): AuthorizationRequest => ({
    actor: { id: 'student-1', type: 'user', authenticatedAt: '2026-10-06T11:55:00Z', ...over },
    tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' },
    action: 'registration.override.approve',
    resource: {
      type: 'override_request', id: 'ovr-1', ownerId: 'student-2', classification: 'education_record',
      attributes: { tenantId: 'school-a', requestState: 'pending_review', requestDigest: 'd1', reviewedDigest: 'd1', resourceVersion: 'v3', reviewedVersion: 'v3' },
    },
    context: {
      membershipIds: ['m1'], roleGrants: [{ role: 'registrar', scopeKind: 'tenant', scopeId: 'school-a' }],
      capabilities: ['registration.override.approve'], consentGrants: [], featureFlags: [], policyVersions: {},
      purpose: 'prerequisite waived by the department', idempotencyKey: 'idem-0123456789abcdef', correlationId: 'req-0123456789abcdef',
    },
  });

  it('maps a denial to deny, a step-up obligation to require_step_up, and a plain allow to allow', () => {
    const now = Date.parse(NOW_ISO);
    expect(sagaOutcomeOf(decide(readiness({ mfaLevel: 'fresh' }), now))).toBe('allow');
    expect(sagaOutcomeOf(decide(readiness({ mfaLevel: 'standard' }), now))).toBe('require_step_up');
    expect(sagaOutcomeOf(decide(readiness({ mfaLevel: 'none' }), now))).toBe('require_step_up');
    const denied = readiness({ mfaLevel: 'fresh' });
    denied.context.capabilities = [];
    expect(sagaOutcomeOf(decide(denied, now))).toBe('deny');
  });

  it('never asks a request that would be refused anyway to step up first', () => {
    const now = Date.parse(NOW_ISO);
    for (const [what, mutate] of [
      ['another institution', (r: AuthorizationRequest) => { r.resource.attributes = { ...r.resource.attributes, tenantId: 'school-b' }; }],
      ['no registrar grant', (r: AuthorizationRequest) => { r.context.roleGrants = []; }],
      ['approving their own', (r: AuthorizationRequest) => { r.resource.ownerId = 'student-1'; }],
      ['a stale review', (r: AuthorizationRequest) => { r.resource.attributes = { ...r.resource.attributes, reviewedDigest: 'old' }; }],
    ] as const) {
      const r = readiness({ mfaLevel: 'none' });
      mutate(r);
      expect(sagaOutcomeOf(decide(r, now)), what).toBe('deny');
    }
  });
});
