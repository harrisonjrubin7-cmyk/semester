// Generated from app/src/lib/integration/rate-control.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * Everything that decides whether a call to a provider may be made right now,
 * in one place: the per-connection token bucket (`retry.ts`'s `RateLimiter`),
 * a penalty box for when the provider says slow down, a concurrency cap, and a
 * circuit breaker for when it has stopped answering.
 *
 * Keyed by tenant *and* connection, so one school's backlog or outage cannot
 * spend another school's quota or open another school's breaker.
 *
 * The clock is always passed in. Nothing here sleeps; a refusal says when to
 * try again and the scheduler decides what to do with that.
 *
 * What counts against the breaker is deliberate. Only `retryable_failure`
 * (the provider down, slow, or throttling past its allowance) trips it. A
 * `permanent_failure` — bad mapping, refused scope, dead grant — is a fault in
 * *our* configuration; opening the breaker would hide it behind "provider
 * unavailable". Those go to dead letters and to `reauthorization_required`.
 */
import { RateLimiter } from './retry.ts';
import type { BreakerState } from './health.ts';

export interface GuardOptions {
  perMinute: number;
  maxConcurrent?: number;
  /** Consecutive retryable failures that open the breaker. Default 5. */
  failureThreshold?: number;
  /** How long the breaker stays open before one probe. Default 60 seconds. */
  openMs?: number;
}

export type Admission =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'circuit_open' | 'penalized' | 'concurrency' | 'rate_limited'; retryAtMs: number };

export type Outcome = 'success' | 'retryable_failure' | 'permanent_failure';

interface State {
  failures: number;
  openedAt: number | null;
  probing: boolean;
  penalizedUntil: number;
  inFlight: number;
}

export class ConnectionGuard {
  private readonly limiter: RateLimiter;
  private readonly states = new Map<string, State>();
  private readonly maxConcurrent: number;
  private readonly threshold: number;
  private readonly openMs: number;
  private readonly perMinute: number;

  constructor(options: GuardOptions) {
    this.perMinute = options.perMinute;
    this.limiter = new RateLimiter(options.perMinute);
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.threshold = options.failureThreshold ?? 5;
    this.openMs = options.openMs ?? 60_000;
  }

  private state(tenantId: string, connectionId: string): State {
    const key = `${tenantId}\u0000${connectionId}`;
    let s = this.states.get(key);
    if (!s) {
      s = { failures: 0, openedAt: null, probing: false, penalizedUntil: 0, inFlight: 0 };
      this.states.set(key, s);
    }
    return s;
  }

  breaker(tenantId: string, connectionId: string, now: number): BreakerState {
    const s = this.state(tenantId, connectionId);
    if (s.openedAt === null) return 'closed';
    return now - s.openedAt >= this.openMs ? 'half_open' : 'open';
  }

  /**
   * May a call go out? Checks are ordered cheapest-and-most-final first, and a
   * refusal never spends a token, so being turned away does not make the next
   * attempt harder.
   */
  admit(tenantId: string, connectionId: string, now: number): Admission {
    const s = this.state(tenantId, connectionId);
    const breaker = this.breaker(tenantId, connectionId, now);
    if (breaker === 'open') return { ok: false, reason: 'circuit_open', retryAtMs: (s.openedAt as number) + this.openMs };
    // Half open lets exactly one probe through; everyone else waits for its verdict.
    if (breaker === 'half_open' && s.probing) return { ok: false, reason: 'circuit_open', retryAtMs: now + this.openMs };
    if (now < s.penalizedUntil) return { ok: false, reason: 'penalized', retryAtMs: s.penalizedUntil };
    if (s.inFlight >= this.maxConcurrent) return { ok: false, reason: 'concurrency', retryAtMs: now + 1_000 };
    if (!this.limiter.take(tenantId, connectionId, now)) {
      return { ok: false, reason: 'rate_limited', retryAtMs: now + Math.ceil(60_000 / this.perMinute) };
    }
    s.inFlight++;
    if (breaker === 'half_open') s.probing = true;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        s.inFlight = Math.max(0, s.inFlight - 1);
      },
    };
  }

  /** Report how the call went. `retryAfterMs` is the provider's own request to wait. */
  record(tenantId: string, connectionId: string, outcome: Outcome, now: number, retryAfterMs?: number): void {
    const s = this.state(tenantId, connectionId);
    const probe = s.probing;
    s.probing = false;    if (retryAfterMs && retryAfterMs > 0) s.penalizedUntil = Math.max(s.penalizedUntil, now + retryAfterMs);
    if (outcome === 'success') {
      s.failures = 0;
      s.openedAt = null;
      return;
    }
    if (outcome === 'permanent_failure') {
      // Our fault, not the provider's: it neither trips the breaker nor closes
      // it. A probe that failed this way tells us nothing about the provider,
      // so the breaker stays half open and the next call probes again.
      return;
    }
    s.failures++;
    if (probe || s.failures >= this.threshold) s.openedAt = now;
  }

  /** Tests and the dashboard: when the penalty box releases, or 0. */
  penalizedUntil(tenantId: string, connectionId: string): number {
    return this.state(tenantId, connectionId).penalizedUntil;
  }
}
