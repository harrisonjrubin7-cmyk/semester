/**
 * Which plan a signed-in account's shared-key calls are served under.
 *
 * `public.my_entitlements()` answers "what does this person's subscription
 * currently entitle", and this reads the same rows the same way: a
 * subscription counts only while its status is one in which paid features keep
 * working, its period has not ended, and it **still has entitlements**. That
 * last condition is the one that matters. The dunning job removes a
 * subscription's `subscription_entitlements` when grace ends and leaves the
 * subscription itself `past_due`, so a lapsed payer is told apart from a
 * paying one by their entitlements and not by their status
 * (`docs/COMMERCIAL-CORE.md`, "Dunning").
 *
 * Pure, and free of Deno APIs, so the app's test suite imports it the way it
 * imports `clamp.ts`. The query that produces the rows is in
 * `../claude/index.ts`.
 *
 * ## What it never does
 *
 * - **Never widens on doubt.** A malformed row, an unknown plan, an expired
 *   period or no subscription at all is `free`. The only way to a wider list
 *   is a subscription that is in date, in a paying status, and holds an
 *   entitlement.
 * - **Never reads a plan as authorization.** The answer chooses which models
 *   the shared key will pay for. Nothing about a student's data depends on it.
 *
 * ## One thing that is true today and may not stay true
 *
 * `pro` has a plan row and no `plan_entitlements`, so nothing gives a Pro
 * subscription the entitlement rows this requires, and a Pro subscriber would
 * read as `free` here. Pro cannot be bought — it has no price — so no one is
 * affected. Seeding Pro's entitlements is what makes this return `pro`, and
 * `sharedplan.test.ts` states it so that nobody has to find it out.
 */
import { PLAN_MODELS, type SharedPlan } from './clamp.ts';

/** The statuses in which a subscription's paid features keep working. */
const LIVE_STATUSES = new Set(['trialing', 'active', 'past_due', 'grace']);

/** Widest last, so the first match from the end of this list is the best plan held. */
const RANK: readonly SharedPlan[] = ['free', 'plus', 'pro'];

/** One subscription, as the nested select in `../claude/index.ts` returns it. */
export interface SubscriptionRow {
  plan_code?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  subscription_entitlements?: unknown;
}

const isPlan = (v: unknown): v is SharedPlan =>
  typeof v === 'string' && Object.hasOwn(PLAN_MODELS, v);

/** The best plan any of these subscriptions currently entitles; `free` when none does. */
export function planFromSubscriptions(rows: unknown, now: Date = new Date()): SharedPlan {
  if (!Array.isArray(rows)) return 'free';
  let best = 0;
  for (const row of rows as SubscriptionRow[]) {
    if (typeof row !== 'object' || row === null) continue;
    const { plan_code: plan, status, current_period_end: ends, subscription_entitlements: held } = row;
    if (!isPlan(plan) || typeof status !== 'string' || !LIVE_STATUSES.has(status)) continue;
    // A date that does not parse is not "in the future": it counts as ended.
    const end = typeof ends === 'string' ? Date.parse(ends) : Number.NaN;
    if (!(end > now.getTime())) continue;
    if (!Array.isArray(held) || held.length === 0) continue;
    best = Math.max(best, RANK.indexOf(plan));
  }
  return RANK[best];
}
