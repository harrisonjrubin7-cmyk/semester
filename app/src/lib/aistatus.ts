/**
 * Whether the consumer door may send, given the AI status a server last signed.
 *
 * `ask()` is the one door out of the consumer app and nothing in it reads
 * `kill.ai_generation`, so a student's own key is a route no server switch can
 * stop (docs/ai-governance/07-incident-response-and-shutdown.md). This is the
 * decision that closes it as far as an app can: an app control and not a
 * security boundary, since a modified client can ignore it. Institution-held
 * data is protected by the gateway, not by this.
 *
 * The decision, made once and held by `aistatus.test.ts`:
 *
 * - **A fresh status that says stop is obeyed on every route**, the student's
 *   own key included.
 * - **No status, or one past its life: a managed account fails closed.** A
 *   school's policy is the contract, and a stale authority is not authority.
 * - **An individual fails open, with a banner.** Their own key and device;
 *   blocking them on a Semester outage would punish the choice that avoided
 *   Semester.
 * - **A last-known kill is never failed open from**, for anyone, until a fresh
 *   status releases it. A kill is an incident; staying closed is the safe side.
 *
 * Nothing here fetches, stores or reads the clock. The status endpoint and the
 * wiring into `ask()` are phase 3 of the build order and are not done.
 */

import type { Route } from './governance/ai-systems';

export interface AiStatus {
  killed: boolean;
  /** True when the school's own AI policy state is off. */
  tenantOff: boolean;
  routesDisabled: readonly Route[];
  /** Milliseconds since the epoch the server signed this. */
  issuedAt: number;
  /** How long the signature is good for, in milliseconds. */
  ttlMs: number;
}

export type AccountKind = 'managed' | 'individual';

export type DoorDecision =
  | { allow: true; banner?: string }
  | { allow: false; reason: 'killed' | 'tenant-off' | 'route-disabled' | 'status-stale'; message: string };

/** The sentence the server says when the switch is engaged; the test holds it equal. */
export const KILLED = 'AI generation is switched off right now. Everything else in Semester still works, and nothing you typed has been lost.';

const STALE =
  'Semester could not confirm your school’s AI settings, so AI help is paused. Everything else still works, and nothing you typed has been lost.';
const BANNER = 'Semester could not check whether AI help is switched on. You are using your own key, so it is still available.';

export function decideDoor(input: { status: AiStatus | null; account: AccountKind; route: Route; now: number }): DoorDecision {
  const { status, account, route, now } = input;
  const fresh = status !== null && now - status.issuedAt <= status.ttlMs && now >= status.issuedAt;

  if (status?.killed) return { allow: false, reason: 'killed', message: KILLED };
  if (fresh && status.tenantOff) return { allow: false, reason: 'tenant-off', message: KILLED };
  if (fresh && status.routesDisabled.includes(route)) return { allow: false, reason: 'route-disabled', message: KILLED };
  if (fresh) return { allow: true };

  return account === 'managed'
    ? { allow: false, reason: 'status-stale', message: STALE }
    : { allow: true, banner: BANNER };
}
