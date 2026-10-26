import { ZiteError } from 'zitejs/backend';
import { pg } from './pg';
import { RL_MIGRATION } from './rlMigration';
import { BUDGETS, BudgetKey } from './rateLimit';

let ready: Promise<void> | null = null;

/** SEC-046: takes one token from the bucket or refuses with a retry time. Atomic in Postgres (rl_take). Fails closed. */
export async function rateLimit(key: BudgetKey, subject: string, cost = 1) {
  const sql = pg();
  if (!ready) ready = (async () => { for (const q of RL_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; });
  const b = BUDGETS[key];
  let r: { ok: boolean; retryAfter: number };
  try {
    await ready;
    r = ((await sql.query(`SELECT rl_take($1,$2,$3,$4,$5) AS r`, [key, subject, b.capacity, b.perSecond, cost])) as { r: { ok: boolean; retryAfter: number } }[])[0].r;
  } catch {
    throw new ZiteError({ code: 'RATE_LIMITED', message: `ratelimit:unavailable:${key}`, userFacingMessage: 'This is unavailable right now. Try again in a moment.' });
  }
  if (!r.ok) {
    const s = Number(r.retryAfter);
    const wait = s < 90 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`;
    throw new ZiteError({ code: 'RATE_LIMITED', message: `ratelimit:${key}`, userFacingMessage: key.endsWith('.tenant') ? `Your institution is using this heavily right now. Try again in ${wait}.` : `You've hit the limit for now. Try again in ${wait}.` });
  }
}
