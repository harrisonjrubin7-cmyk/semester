/**
 * Every dining decision answers yes with a value, or no with a code and a
 * sentence. Nothing in `lib/dining/` throws for a refusal: a refusal is an
 * answer the screen shows, and a thrown error is one it cannot.
 *
 * The codes are the database's too. `supabase/migrations/20260929330000_dining.sql`
 * raises `dining: <code>: …` for the same refusals, and `migration.test.ts`
 * holds every code the SQL raises to this list, so the two layers cannot
 * refuse for reasons the other has no name for.
 */

export const REFUSALS = [
  'flag_off',
  'kill_switch',
  'partner_unavailable',
  'not_found',
  'ordering_paused',
  'closed',
  'item_unavailable',
  'at_capacity',
  'no_plan',
  'swipes_exhausted',
  'insufficient_funds',
  'pool_empty',
  'claim_limit',
  'consent_required',
  'invalid',
  'idempotency_conflict',
  'not_allowed',
  'bad_transition',
  'no_figure',
] as const;

export type Refusal = (typeof REFUSALS)[number];

export type Decision<T> =
  | { ok: true; value: T; reason: string }
  | { ok: false; code: Refusal; reason: string };

export const yes = <T>(value: T, reason: string): Decision<T> => ({ ok: true, value, reason });
export const no = <T = never>(code: Refusal, reason: string): Decision<T> => ({ ok: false, code, reason });

/**
 * An idempotency key: what a client generates once per intent and sends again
 * on every retry. Same pattern as the SQL `private.dining_key` check.
 */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,64}$/;

/**
 * A ledger entry's key: the client's key with a short prefix naming what it
 * paid for (`o.` an order, `r.` its refund, `d.` a donation), or the vendor's
 * own reference for a partner sync. Same pattern as the ledger's column check.
 */
export const LEDGER_KEY = /^[A-Za-z0-9_.:-]{8,80}$/;

export function validKey(key: string): boolean {
  return IDEMPOTENCY_KEY.test(key);
}
