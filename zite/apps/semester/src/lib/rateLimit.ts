// SEC-046: token-bucket rate limits. Pure budget table + refill math (unit-tested); the atomic take runs in Postgres (rlMigration).
export type Bucket = { capacity: number; perSecond: number };

/** Budgets. Per-user first; the tenant budget is only charged after a membership check (SEC-046). */
export const BUDGETS = {
  'ask.user': { capacity: 20, perSecond: 1 / 30 },      // burst 20, then 2/min
  'ask.tenant': { capacity: 300, perSecond: 1 },        // whole institution
  'onboard.user': { capacity: 5, perSecond: 1 / 60 },   // burst 5, then 1/min
} satisfies Record<string, Bucket>;
export type BudgetKey = keyof typeof BUDGETS;

/** Tokens after refilling for `elapsedSec`, capped at capacity. Mirrors rl_take in SQL. */
export function refill(tokens: number, elapsedSec: number, b: Bucket) {
  return Math.min(b.capacity, tokens + Math.max(0, elapsedSec) * b.perSecond);
}

/** Can `cost` be taken now; if not, seconds until it can. */
export function take(tokens: number, elapsedSec: number, b: Bucket, cost = 1): { ok: boolean; left: number; retryAfter: number } {
  const t = refill(tokens, elapsedSec, b);
  if (cost > b.capacity) return { ok: false, left: t, retryAfter: Infinity };
  if (t >= cost) return { ok: true, left: t - cost, retryAfter: 0 };
  return { ok: false, left: t, retryAfter: Math.ceil((cost - t) / b.perSecond) };
}
