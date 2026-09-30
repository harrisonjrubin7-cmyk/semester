/**
 * Swipe sharing: a student gives meal swipes to their school's basic-needs
 * pool, and another student eats on one without anybody knowing who gave it.
 *
 * `docs/BASIC-NEEDS-NAVIGATOR.md` holds the rule this answers to: a student
 * should never have to trade privacy for help. So the pool is anonymous by
 * construction, not by a filter somebody could forget to apply:
 *
 * - a donation row names its donor (so the donor can see what they gave) and
 *   no recipient; a claim row names its recipient and no donor. Nothing joins
 *   the two. There is no answer to "whose swipe was this", in this file or in
 *   `public.dining_pool_donations` / `public.dining_pool_claims`;
 * - when a donor's account is deleted their donation stays in the pool with
 *   the donor cleared, rather than taking meals back from the pool;
 * - staff see totals and nothing per person.
 *
 * Giving needs consent to the current wording, by version; a click without
 * the version is not consent to anything in particular. Drawing is limited to
 * `POOL_CLAIMS_PER_WEEK` in any seven days so one account cannot empty a pool
 * meant for many — and the limit, like the pool, says nothing about why.
 */
import { IDEMPOTENCY_KEY, no, yes, type Decision } from './decision';

export const SHARE_CONSENT_VERSION = 'dining-share-v1';
export const SHARE_CONSENT_TEXT =
  'I am giving these meal swipes to my school’s basic-needs pool. They come out of my plan now, I cannot take them back, and nobody who uses one will be told who gave it.';
export const MAX_DONATION = 5;
export const POOL_CLAIMS_PER_WEEK = 2;
const WEEK_MS = 7 * 86_400_000;

export interface PoolDonation {
  id: string;
  tenantId: string;
  /** Null once the donor's account is gone; the swipes stay in the pool. */
  donorId: string | null;
  swipes: number;
  consentVersion: string;
  at: number;
  idempotencyKey: string;
}

export interface PoolClaim {
  id: string;
  tenantId: string;
  recipientId: string;
  /** +1 when a swipe is drawn for an order, -1 when that order is cancelled. */
  swipes: 1 | -1;
  orderId: string;
  at: number;
}

export interface Pool {
  donations: readonly PoolDonation[];
  claims: readonly PoolClaim[];
}

export const EMPTY_POOL: Pool = { donations: [], claims: [] };

export function poolAvailable(pool: Pool, tenantId: string): number {
  let n = 0;
  for (const d of pool.donations) if (d.tenantId === tenantId) n += d.swipes;
  for (const c of pool.claims) if (c.tenantId === tenantId) n -= c.swipes;
  return n;
}

/** Net swipes a student drew in the seven days before `now`. */
export function claimedThisWeek(pool: Pool, tenantId: string, recipientId: string, now: number): number {
  let n = 0;
  for (const c of pool.claims) {
    if (c.tenantId === tenantId && c.recipientId === recipientId && c.at > now - WEEK_MS && c.at <= now) n += c.swipes;
  }
  return n;
}

/** Whether a student may draw one swipe now. */
export function mayClaim(pool: Pool, tenantId: string, recipientId: string, now: number): Decision<true> {
  if (poolAvailable(pool, tenantId) < 1) return no('pool_empty', 'The shared pool has no swipes right now.');
  if (claimedThisWeek(pool, tenantId, recipientId, now) >= POOL_CLAIMS_PER_WEEK) {
    return no('claim_limit', `The pool allows ${POOL_CLAIMS_PER_WEEK} shared swipes in any seven days.`);
  }
  return yes(true, 'A shared swipe is available.');
}

export interface Consent {
  version: string;
  given: boolean;
}

export interface DonationRequest {
  tenantId: string;
  donorId: string;
  swipes: number;
  consent: Consent | null;
  idempotencyKey: string;
}

/** The checks on a donation that do not need the donor's plan. */
export function checkDonation(req: DonationRequest): Decision<true> {
  if (!req.consent || !req.consent.given || req.consent.version !== SHARE_CONSENT_VERSION) {
    return no('consent_required', 'Giving swipes needs your consent to the current wording.');
  }
  if (!Number.isInteger(req.swipes) || req.swipes < 1 || req.swipes > MAX_DONATION) {
    return no('invalid', `You can give 1 to ${MAX_DONATION} swipes at a time.`);
  }
  if (!IDEMPOTENCY_KEY.test(req.idempotencyKey)) return no('invalid', 'The request key is not one this pool accepts.');
  return yes(true, 'Consent given to the current wording.');
}

/** What a student who drew from the pool is shown: their own count, and nothing about anybody else. */
export function recipientView(pool: Pool, tenantId: string, recipientId: string, now: number): { usedThisWeek: number; limit: number } {
  return { usedThisWeek: claimedThisWeek(pool, tenantId, recipientId, now), limit: POOL_CLAIMS_PER_WEEK };
}

/** What a donor is shown: what they gave. Never who used it. */
export function donorView(pool: Pool, tenantId: string, donorId: string): { given: number } {
  let given = 0;
  for (const d of pool.donations) if (d.tenantId === tenantId && d.donorId === donorId) given += d.swipes;
  return { given };
}

/** What dining staff are shown: totals for their school. */
export function poolSummary(pool: Pool, tenantId: string): { donated: number; drawn: number; available: number } {
  let donated = 0;
  let drawn = 0;
  for (const d of pool.donations) if (d.tenantId === tenantId) donated += d.swipes;
  for (const c of pool.claims) if (c.tenantId === tenantId) drawn += c.swipes;
  return { donated, drawn, available: donated - drawn };
}
