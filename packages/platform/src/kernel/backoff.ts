import type { Rng } from './clock.ts';

/** Exponential backoff with full jitter, capped. `attempt` starts at 1. Used by connectors and the SDK. */
export function backoffMs(attempt: number, rng: Rng, opts: { baseMs?: number; capMs?: number } = {}): number {
  const base = opts.baseMs ?? 1_000;
  const cap = opts.capMs ?? 15 * 60_000;
  const ceiling = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  return Math.floor(rng.next() * ceiling) + 1;
}
