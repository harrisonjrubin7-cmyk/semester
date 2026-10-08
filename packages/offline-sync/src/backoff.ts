export interface BackoffOptions {
  baseMs: number
  capMs: number
  /** Give up and dead-letter after this many attempts. */
  maxAttempts: number
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 2_000, capMs: 15 * 60_000, maxAttempts: 12 }

/**
 * Full jitter: a random wait between zero and the exponential ceiling.
 * Without it, every phone that lost signal in the same tunnel retries in the
 * same second. `random` is injected so a test can pin it.
 */
export function backoffDelay(attempt: number, o: BackoffOptions = DEFAULT_BACKOFF, random: () => number = Math.random): number {
  const ceiling = Math.min(o.capMs, o.baseMs * 2 ** Math.max(0, attempt - 1))
  return Math.floor(random() * ceiling)
}

/** A server-sent Retry-After wins over our own guess, up to the cap. */
export function retryAt(now: number, attempt: number, retryAfterMs: number | undefined, o: BackoffOptions = DEFAULT_BACKOFF, random: () => number = Math.random): number {
  const own = backoffDelay(attempt, o, random)
  return now + (retryAfterMs !== undefined ? Math.min(Math.max(retryAfterMs, own), o.capMs) : own)
}
