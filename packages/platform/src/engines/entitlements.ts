/**
 * Billing entitlement: what a subscription lets a tenant or a person use,
 * and the things no subscription state can take away.
 *
 * Billing is a *consequence*, not a gate on the student's own life. The
 * product thesis is that every part of a student's educational life works
 * natively; so a lapsed card must not lock a student out of their records,
 * their export, their account deletion, their accessibility settings or a
 * safety channel. `ALWAYS_ENTITLED` is that list, it is checked **before**
 * the plan, and `architecture.test.ts` proves no plan can remove an item from
 * it.
 *
 * - A **plan** maps entitlement keys to `{ enabled, limit? }`.
 * - A **subscription** says which plan applies to whom and its state:
 *   `trialing`/`active` entitle; `past_due` entitles for a grace window then
 *   stops; `canceled` stops at `endsAt`. Per-entitlement **overrides** exist for
 *   contracts (an institution negotiated 500 seats) and carry a reason.
 * - **Usage** is metered with an idempotent `record`: a retried consumer
 *   cannot double-count, and a limit is checked against the recorded total.
 * - Stripe (or any processor) state changes only from a signature-verified
 *   webhook (ARCHITECTURE.md invariant 8); this module takes the resulting
 *   state as input and never calls a processor.
 */

import { PlatformError } from '../gateway/errors.ts';

export const ALWAYS_ENTITLED = [
  'records.access',
  'data.export',
  'account.delete',
  'accessibility.settings',
  'safety.alerts',
  'support.contact',
  'billing.manage',
] as const;

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface PlanEntitlement {
  enabled: boolean;
  /** Maximum units in the metering window; absent = unlimited. */
  limit?: number;
}

export interface Plan {
  id: string;
  entitlements: Readonly<Record<string, PlanEntitlement>>;
}

export interface Subscription {
  /** The holder: a tenant (institutional) or a person (individual). */
  holder: { kind: 'tenant' | 'person'; id: string };
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  /** For past_due: entitlement continues until this instant. */
  graceUntil?: string;
  /** For canceled: entitlement ends here. */
  endsAt?: string;
  overrides?: Readonly<Record<string, PlanEntitlement & { reason: string }>>;
}

export type EntitlementReason =
  | 'always_entitled'
  | 'plan'
  | 'override'
  | 'grace'
  | 'not_in_plan'
  | 'limit_reached'
  | 'subscription_inactive'
  | 'no_subscription'
  | 'tenant_mismatch';

export interface EntitlementDecision {
  allowed: boolean;
  reason: EntitlementReason;
  remaining?: number;
}

export function checkEntitlement(
  tenantId: string,
  sub: Subscription | undefined,
  plan: Plan | undefined,
  key: string,
  used: number,
  nowMs: number,
): EntitlementDecision {
  if ((ALWAYS_ENTITLED as readonly string[]).includes(key)) return { allowed: true, reason: 'always_entitled' };
  if (!sub || !plan) return { allowed: false, reason: 'no_subscription' };
  if (sub.tenantId !== tenantId) return { allowed: false, reason: 'tenant_mismatch' };
  if (plan.id !== sub.planId) return { allowed: false, reason: 'no_subscription' };

  let live = false;
  let viaGrace = false;
  if (sub.status === 'trialing' || sub.status === 'active') live = true;
  else if (sub.status === 'past_due' && sub.graceUntil !== undefined && Date.parse(sub.graceUntil) > nowMs) {
    live = true;
    viaGrace = true;
  } else if (sub.status === 'canceled' && sub.endsAt !== undefined && Date.parse(sub.endsAt) > nowMs) live = true;
  if (!live) return { allowed: false, reason: 'subscription_inactive' };

  const override = sub.overrides?.[key];
  const ent = override ?? plan.entitlements[key];
  if (!ent || !ent.enabled) return { allowed: false, reason: 'not_in_plan' };
  if (ent.limit !== undefined) {
    const remaining = ent.limit - used;
    if (remaining <= 0) return { allowed: false, reason: 'limit_reached', remaining: 0 };
    return { allowed: true, reason: viaGrace ? 'grace' : override ? 'override' : 'plan', remaining };
  }
  return { allowed: true, reason: viaGrace ? 'grace' : override ? 'override' : 'plan' };
}

/** Idempotent usage metering: one count per `(tenant, key, eventId)`. */
export class MemoryMeter {
  private readonly seen = new Set<string>();
  private readonly totals = new Map<string, number>();

  /** Returns false if this `eventId` was already recorded. */
  record(tenantId: string, key: string, eventId: string, units: number): boolean {
    if (!Number.isFinite(units) || units <= 0) throw new Error('Usage must be a positive number.');
    const id = JSON.stringify([tenantId, key, eventId]);
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    const k = JSON.stringify([tenantId, key]);
    this.totals.set(k, (this.totals.get(k) ?? 0) + units);
    return true;
  }

  total(tenantId: string, key: string): number {
    return this.totals.get(JSON.stringify([tenantId, key])) ?? 0;
  }
}

/** The enforcement half: throws `entitlement_required` (HTTP 402) with a way forward, or returns the decision. */
export function requireEntitlement(d: EntitlementDecision, label: string): EntitlementDecision {
  if (d.allowed) return d;
  const message =
    d.reason === 'limit_reached'
      ? `You have used all of your ${label} for now.`
      : d.reason === 'subscription_inactive'
        ? `${label} is paused because the subscription is not active.`
        : `${label} is not part of this plan.`;
  throw new PlatformError('entitlement_required', message, { userAction: { label: 'See plans', kind: 'open_screen' } });
}
