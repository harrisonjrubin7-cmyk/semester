/**
 * The entitlement order, run on an LTI launch in shadow: evaluated, logged,
 * never enforced.
 *
 * `entitlement.ts` decides in twelve steps. On a launch, four have a source:
 *
 *   kill-switch   `kill.integration_sync` (lti_launch_entitlement_facts)
 *   tenant-plan   `tenant_plan` (the same function); unsourced for a school
 *                 with no plan row, which is "not recorded", not "ended"
 *   module        `integration.lms_lti` feature state (the same function)
 *   lifecycle     the membership join (`ltimembership.ts`)
 *
 * The other eight have nothing to read yet: no SSO-required policy, no course scope, no data tier, no personal grant, no usage counter,
 * and no service-side capability lookup. They are given the values that pass,
 * and **named in the log as unsourced**, so a pass through one of them reads
 * as "not checked", never as "checked and allowed". A shadow log that hid
 * that would teach whoever reads it to trust a gate that is not there.
 *
 * Shadow, because `integration.lms_lti` defaults to `off`, and enforcing the
 * module step would refuse launches at every school that has not switched it
 * on. This log is how a school, or whoever turns enforcement on, sees what
 * enforcing would do first. Nothing here returns a refusal to the caller.
 */

import { resolveEntitlement, type Environment, type EntitlementRequest, type EntitlementVerdict } from './entitlement.ts';
import type { MembershipJoin } from './ltimembership.ts';

export const LTI_MODULE = 'integration.lms_lti';

/**
 * The steps an LTI launch has no source for today. `tenant-plan` is not here:
 * it is sourced from `tenant_plan`, and added to a launch's unsourced list
 * only when that school has no plan row (see `launchEntitlement`).
 */
export const UNSOURCED_STEPS = [
  'environment', 'sso-policy', 'capability', 'course-scope',
  'course-policy', 'data-classification', 'individual-plan', 'usage-allowance',
] as const;

export type PlanStatus = 'trial' | 'active' | 'suspended' | 'ended';

export interface LaunchFacts {
  killSwitched: boolean;
  moduleState: string;
  /** The school's recorded plan, or null when it has none. */
  plan: { status: PlanStatus; endsAt?: string } | null;
}

export type LaunchEntitlement =
  | { evaluated: true; verdict: EntitlementVerdict; unsourced: readonly string[] }
  | { evaluated: false; why: string };

const STATES = new Set(['off', 'preview', 'sandbox', 'production']);
const PLAN_STATUSES = new Set<string>(['trial', 'active', 'suspended', 'ended']);

/** The facts row as the RPC returns it, or null when it cannot be trusted. */
export function readFacts(data: unknown, error: { message?: string } | null): LaunchFacts | null {
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.kill_switched !== 'boolean' || typeof r.module_state !== 'string' || !STATES.has(r.module_state)) return null;

  // No plan: null, or absent from a database that predates tenant_plan. Both
  // mean nothing is recorded, not that a plan ended.
  const status = r.plan_status ?? null;
  const ends = r.plan_ends_at ?? null;
  if (status === null) {
    return ends === null ? { killSwitched: r.kill_switched, moduleState: r.module_state, plan: null } : null;
  }
  if (typeof status !== 'string' || !PLAN_STATUSES.has(status)) return null;
  if (ends !== null && (typeof ends !== 'string' || !Number.isFinite(Date.parse(ends)))) return null;
  return {
    killSwitched: r.kill_switched,
    moduleState: r.module_state,
    plan: { status: status as PlanStatus, ...(ends === null ? {} : { endsAt: ends }) },
  };
}

const INACTIVE = ['pending', 'suspended', 'deprovisioned'] as const;

/** `membership-suspended` → suspended; anything else → no membership. */
function inactiveStatus(outcome: string): { status: (typeof INACTIVE)[number] } | null {
  const status = outcome.startsWith('membership-') ? outcome.slice('membership-'.length) : '';
  return (INACTIVE as readonly string[]).includes(status) ? { status: status as (typeof INACTIVE)[number] } : null;
}

/**
 * Evaluate the order for one launch. Not evaluated, with the reason, when
 * there is no school to evaluate against or its facts could not be read:
 * every sourced step is per school, and guessing one is the thing
 * `launchTenant` exists to refuse.
 */
export function launchEntitlement(join: MembershipJoin, facts: LaunchFacts | null, now: Date): LaunchEntitlement {
  if (!join.tenantId) return { evaluated: false, why: join.outcome };
  if (!facts) return { evaluated: false, why: 'facts-unreadable' };

  const everywhere: Environment[] = ['local', 'preview', 'staging', 'production'];
  const request: EntitlementRequest = {
    now,
    killSwitched: facts.killSwitched,
    // Unsourced: which environment this function runs in is not recorded, so
    // environment passes and the flag's state is judged at `module`.
    environment: 'production',
    moduleEnvironments: everywhere,
    module: LTI_MODULE,
    tenant: {
      // Sourced from tenant_plan. With no plan row, a passing value, and the
      // step is named unsourced for this launch below.
      planStatus: facts.plan?.status ?? 'active',
      ...(facts.plan?.endsAt ? { planEndsAt: facts.plan.endsAt } : {}),
      modules: facts.moduleState === 'off' ? [] : [LTI_MODULE],
      requireSso: false, // unsourced
    },
    session: { viaInstitutionSso: false },
    membership: join.joined ? { status: 'active' } : inactiveStatus(join.outcome),
    // Unsourced: no service-side capability lookup; required is what is held.
    capabilities: ['lti:launch'],
    requiredCapability: 'lti:launch',
    dataTier: 0, // unsourced
    maxDataTier: 6,
  };
  const unsourced: readonly string[] = facts.plan ? UNSOURCED_STEPS : ['tenant-plan', ...UNSOURCED_STEPS];
  return { evaluated: true, verdict: resolveEntitlement(request), unsourced };
}

/** One log line, ids and step names only. */
export function entitlementLogLine(result: LaunchEntitlement): string {
  if (!result.evaluated) return `lti entitlement (shadow): not evaluated — ${result.why}`;
  const unsourced = `unsourced=${result.unsourced.join(',')}`;
  return result.verdict.allowed
    ? `lti entitlement (shadow): would allow; ${unsourced}`
    : `lti entitlement (shadow): would refuse at ${result.verdict.step}; ${unsourced}`;
}
