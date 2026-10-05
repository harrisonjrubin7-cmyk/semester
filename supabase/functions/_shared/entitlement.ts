/**
 * Whether one person may take one action in one institutional module, decided
 * in a fixed order, with the first refusal named.
 *
 * The order is the one `docs/ENTITLEMENT-RESOLUTION.md` argues for: switches an
 * operator controls first, then what the institution bought, then who the
 * person currently is to the institution, then what the course and the data
 * permit, and only last what the person's own plan and allowance cover. It is
 * written as a list rather than a chain of `if`s so the order is data a test
 * can read back, and so a refusal can always say which step it was.
 *
 * ## Nothing here widens anything else
 *
 * This is an additional gate, not a replacement. Row-level security and
 * `private.has_capability` still decide what rows a person can read; the AI
 * Toolkit's `entitle()` still decides whether a tool is usable at all. A pass
 * here means only that no institutional plan, lifecycle or policy reason
 * refuses the action. The `capability` step takes the capabilities the caller
 * already resolved from the database, and never derives them from IdP, SCIM or
 * LTI claims.
 */

export const ENTITLEMENT_STEPS = [
  'kill-switch',
  'environment',
  'tenant-plan',
  'module',
  'sso-policy',
  'lifecycle',
  'capability',
  'course-scope',
  'course-policy',
  'data-classification',
  'individual-plan',
  'usage-allowance',
] as const;

export type EntitlementStep = (typeof ENTITLEMENT_STEPS)[number];

export type Environment = 'local' | 'preview' | 'staging' | 'production';

/** A plan held by the person rather than the tenant: bought, or sponsored. */
export interface PersonalGrant {
  modules: readonly string[];
  expiresAt?: string;
}

export interface EntitlementRequest {
  now: Date;
  /** A module or the whole platform switched off by an operator. */
  killSwitched: boolean;
  environment: Environment;
  /** Environments this module may run in. Production is never implied. */
  moduleEnvironments: readonly Environment[];
  module: string;
  tenant: {
    planStatus: 'active' | 'trial' | 'suspended' | 'ended';
    planEndsAt?: string;
    modules: readonly string[];
    requireSso: boolean;
  };
  session: { viaInstitutionSso: boolean };
  membership: { status: 'pending' | 'active' | 'suspended' | 'deprovisioned' } | null;
  /** Resolved from the database for this tenant. Never from a token claim. */
  capabilities: readonly string[];
  requiredCapability: string;
  course?: {
    id: string;
    inScope: readonly string[];
    policy: 'allowed' | 'guided' | 'prohibited' | 'unset';
  };
  /** 0-6, the AI Toolkit's T-tiers. Unclassified data is passed as 3. */
  dataTier: number;
  maxDataTier: number;
  personal?: PersonalGrant;
  usage?: { used: number; allowance: number };
}

export type EntitlementVerdict =
  | { allowed: true; source: 'tenant' | 'personal' }
  | { allowed: false; step: EntitlementStep; reason: string };

const past = (iso: string | undefined, now: Date) => iso !== undefined && !(Date.parse(iso) > now.getTime());

type Check = (r: EntitlementRequest) => string | null;

const personalCovers = (r: EntitlementRequest) =>
  !!r.personal && r.personal.modules.includes(r.module) && !past(r.personal.expiresAt, r.now);

const CHECKS: Record<EntitlementStep, Check> = {
  'kill-switch': (r) => (r.killSwitched ? 'This is switched off for everyone right now.' : null),
  environment: (r) =>
    r.moduleEnvironments.includes(r.environment) ? null : `Not enabled in the ${r.environment} environment.`,
  'tenant-plan': (r) => {
    if (r.tenant.planStatus === 'suspended' || r.tenant.planStatus === 'ended') return 'The institution plan is not active.';
    return past(r.tenant.planEndsAt, r.now) ? 'The institution plan has ended.' : null;
  },
  // Listed anywhere: the tenant's plan, or a personal grant whether or not it
  // is still current. Currency of a personal grant is `individual-plan`'s job,
  // so an expired one is refused as expired rather than as never bought.
  module: (r) =>
    r.tenant.modules.includes(r.module) || r.personal?.modules.includes(r.module)
      ? null
      : 'This module is not part of the institution plan.',
  'sso-policy': (r) =>
    r.tenant.requireSso && !r.session.viaInstitutionSso ? 'The institution requires signing in with campus SSO.' : null,
  lifecycle: (r) => (r.membership?.status === 'active' ? null : 'There is no active institutional membership.'),
  capability: (r) =>
    r.capabilities.includes(r.requiredCapability) ? null : `Requires the ${r.requiredCapability} capability.`,
  'course-scope': (r) =>
    !r.course || r.course.inScope.includes(r.course.id) ? null : 'This course is outside your access.',
  'course-policy': (r) => (r.course?.policy === 'prohibited' ? 'The course policy does not permit this.' : null),
  'data-classification': (r) => {
    const tier = Number.isInteger(r.dataTier) && r.dataTier >= 0 ? r.dataTier : 3;
    return tier > r.maxDataTier ? `Data at tier T${tier} is above what this module may handle.` : null;
  },
  'individual-plan': (r) =>
    r.tenant.modules.includes(r.module) || personalCovers(r) ? null : 'Your personal or sponsored plan has ended.',
  'usage-allowance': (r) =>
    !r.usage || r.usage.used < r.usage.allowance ? null : 'The usage allowance for this period is spent.',
};

export function resolveEntitlement(request: EntitlementRequest): EntitlementVerdict {
  for (const step of ENTITLEMENT_STEPS) {
    const reason = CHECKS[step](request);
    if (reason) return { allowed: false, step, reason };
  }
  return { allowed: true, source: request.tenant.modules.includes(request.module) ? 'tenant' : 'personal' };
}
