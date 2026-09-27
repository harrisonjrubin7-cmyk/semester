/**
 * Retry, back-off, dead-lettering and per-tenant rate limits for sync work.
 *
 * Pure functions over explicit inputs (attempt, clock, random), so a worker
 * and a test compute the same schedule.
 */
import type { ErrorCategory } from './catalog.ts';

export interface RetryPolicy {
  maxAttempts: number;
  baseMs: number;
  maxMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 5, baseMs: 2_000, maxMs: 15 * 60_000 };

/** Errors that another attempt cannot fix. They dead-letter at once. */
const PERMANENT: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  'type_mismatch', 'enum_mismatch', 'missing_required', 'duplicate_external_id', 'transform_error',
  'scope_failure', 'classification_block', 'consent_block', 'schema_validation', 'authentication',
]);

export function retryable(category: ErrorCategory): boolean {
  return !PERMANENT.has(category);
}

/** Exponential back-off with full jitter, capped. `random` is in [0, 1). */
export function backoffMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY, random: () => number = Math.random): number {
  const ceiling = Math.min(policy.maxMs, policy.baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * ceiling);
}

export type NextStep =
  | { kind: 'retry'; attempt: number; retryAt: Date }
  | { kind: 'dead_letter'; reason: string };

/** What to do after attempt `attempt` (1-based) failed with this category. */
export function afterFailure(
  category: ErrorCategory,
  attempt: number,
  now: Date,
  policy: RetryPolicy = DEFAULT_RETRY,
  random: () => number = Math.random,
  retryAfterMs?: number,
): NextStep {
  if (!retryable(category)) return { kind: 'dead_letter', reason: `${category} is not retryable` };
  if (attempt >= policy.maxAttempts) {
    return { kind: 'dead_letter', reason: `${category} after ${attempt} attempts` };
  }
  // A provider's Retry-After wins when it asks for longer than our schedule.
  const wait = Math.max(backoffMs(attempt, policy, random), retryAfterMs ?? 0);
  return { kind: 'retry', attempt: attempt + 1, retryAt: new Date(now.getTime() + wait) };
}

/**
 * A token bucket per tenant and connection, so one school's backlog cannot
 * spend another's provider quota.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  private readonly perMinute: number;

  constructor(perMinute: number) {
    this.perMinute = perMinute;
  }

  take(tenantId: string, connectionId: string, now: number): boolean {
    const key = `${tenantId}\u0000${connectionId}`;
    const rate = this.perMinute / 60_000;
    const b = this.buckets.get(key) ?? { tokens: this.perMinute, at: now };
    const tokens = Math.min(this.perMinute, b.tokens + (now - b.at) * rate);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, at: now });
      return false;
    }
    this.buckets.set(key, { tokens: tokens - 1, at: now });
    return true;
  }
}
