import { DESTINATIONS } from '../nav';
import { NON_DESTINATION_FLOWS } from '../rollout-capabilities';
import {
  CAPABILITY_DEFINITIONS,
  MATURITY_LEVELS,
  capabilityDefinition,
  type CapabilityDefinition,
} from './capability-governance';
import {
  RELEASE_PROFILES,
  sameReleaseTarget,
  type ReleaseProfileDecision,
  type ReleaseProfileId,
  type ReleaseTarget,
} from './release-profiles';

export const CAPABILITY_EXPOSURE_STATES = [
  'live',
  'connected',
  'pilot',
  'early_access',
  'institution_controlled',
  'planned_but_not_exposed',
] as const;

export const OPERATIONAL_READINESS_CHECKS = [
  'product', 'data', 'trust', 'operations', 'commercial', 'adoption',
  'reliability', 'measurement',
] as const;

export type CapabilityExposureStatus = (typeof CAPABILITY_EXPOSURE_STATES)[number];
export type OperationalReadinessCheck = (typeof OPERATIONAL_READINESS_CHECKS)[number];
export type ExposureSurface = 'navigation' | 'marketing' | 'ai' | 'tenant-control';

/**
 * Trusted, server-resolved inputs for one exposure decision. Callers must not
 * populate entitlement, cohort, connection, readiness, or kill-switch fields
 * from browser payloads; this resolver narrows authoritative state and is not
 * itself an authorization boundary.
 */
export interface CapabilityExposureContext {
  profileId: ReleaseProfileId;
  release: ReleaseProfileDecision;
  target?: ReleaseTarget;
  tenantEntitled: boolean;
  cohortAuthorized: boolean;
  connectionHealthy: boolean;
  nativeBaselineAvailable: boolean;
  aiAvailable: boolean;
  killSwitchActive: boolean;
  operationalReadiness: Readonly<Partial<Record<OperationalReadinessCheck, boolean>>>;
  retired?: boolean;
  surface?: ExposureSurface;
}

export interface CapabilityExposureDecision {
  capabilityId: string;
  surface: ExposureSurface;
  status: CapabilityExposureStatus;
  visible: boolean;
  publicClaim: string | null;
  reason: string;
  routes: readonly string[];
}

export interface CapabilityExposureIndexEntry {
  capabilityId: CapabilityDefinition['id'];
  routes: readonly string[];
  profileIds: readonly ReleaseProfileId[];
  requiredOperationalChecks: typeof OPERATIONAL_READINESS_CHECKS;
  dataAuthorities: readonly CapabilityDefinition['data'][number]['authority'][];
  securityClassifications: readonly string[];
  productOwner: string;
  supportOwner: CapabilityDefinition['supportOwner'];
  evidenceExpiry: 'release-profile-controlled';
  entitlement: 'profile-tenant-cohort';
  rollback: string;
  evidenceRefs: readonly CapabilityDefinition['sources'][number][];
  platforms: readonly ['web', 'pwa'];
  nativeMobile: 'planned_but_not_exposed';
}

export interface RouteExposureIndexEntry {
  route: string;
  capabilityIds: readonly CapabilityDefinition['id'][];
}

const profileEntries = Object.values(RELEASE_PROFILES);

export const CAPABILITY_EXPOSURE_INDEX: readonly CapabilityExposureIndexEntry[] = Object.freeze(
  CAPABILITY_DEFINITIONS.map((capability) => Object.freeze({
    capabilityId: capability.id,
    routes: Object.freeze([...capability.destinations]),
    profileIds: Object.freeze(profileEntries
      .filter((profile) => profile.capabilityIds.includes(capability.id))
      .map((profile) => profile.id)),
    requiredOperationalChecks: OPERATIONAL_READINESS_CHECKS,
    dataAuthorities: Object.freeze([...new Set(capability.data.map((rule) => rule.authority))]),
    securityClassifications: Object.freeze([...new Set(capability.data.map((rule) => rule.classification))]),
    productOwner: capability.owner,
    supportOwner: capability.supportOwner,
    evidenceExpiry: 'release-profile-controlled' as const,
    entitlement: 'profile-tenant-cohort' as const,
    rollback: capability.fallback,
    evidenceRefs: Object.freeze([...capability.sources]),
    platforms: Object.freeze(['web', 'pwa'] as const),
    nativeMobile: 'planned_but_not_exposed' as const,
  })),
);

export const ROUTE_EXPOSURE_INDEX: readonly RouteExposureIndexEntry[] = Object.freeze(
  DESTINATIONS.map((destination) => Object.freeze({
    route: destination.screen,
    capabilityIds: Object.freeze(CAPABILITY_DEFINITIONS
      .filter((capability) => capability.destinations.includes(destination.screen))
      .map((capability) => capability.id)),
  })),
);

export function validateCapabilityExposureIndex(): string[] {
  const errors: string[] = [];
  const capabilityIds = CAPABILITY_EXPOSURE_INDEX.map((entry) => entry.capabilityId);
  const routeIds = ROUTE_EXPOSURE_INDEX.map((entry) => entry.route);
  const registeredRoutes = new Set(DESTINATIONS.map((destination) => destination.screen as string));
  const embeddedFlows = new Set<string>(NON_DESTINATION_FLOWS);

  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push('Duplicate capability exposure entry.');
  if (capabilityIds.length !== CAPABILITY_DEFINITIONS.length) errors.push('Capability exposure index is incomplete.');
  if (new Set(routeIds).size !== routeIds.length) errors.push('Duplicate route exposure entry.');
  if (routeIds.length !== DESTINATIONS.length) errors.push('Route exposure index is incomplete.');

  for (const capability of CAPABILITY_DEFINITIONS) {
    if (!capabilityIds.includes(capability.id)) errors.push(`Missing capability exposure entry: ${capability.id}.`);
    for (const route of capability.destinations) {
      if (!registeredRoutes.has(route) && !embeddedFlows.has(route)) {
        errors.push(`Unknown capability route: ${capability.id} / ${route}.`);
      }
    }
  }

  for (const destination of DESTINATIONS) {
    if (!routeIds.includes(destination.screen)) errors.push(`Missing route exposure entry: ${destination.screen}.`);
    if (!ROUTE_EXPOSURE_INDEX.find((entry) => entry.route === destination.screen)?.capabilityIds.length) {
      errors.push(`Unmapped route exposure entry: ${destination.screen}.`);
    }
  }

  return errors;
}

function surfaceVisible(
  status: CapabilityExposureStatus,
  surface: ExposureSurface,
  capability: CapabilityDefinition | undefined,
  context: CapabilityExposureContext,
): boolean {
  if (!capability || status === 'planned_but_not_exposed') return false;
  if (status === 'institution_controlled') return surface === 'tenant-control';
  if (surface === 'marketing') return status === 'live' || status === 'connected';
  if (surface === 'ai') return context.aiAvailable;
  if (surface === 'tenant-control') return true;
  return capability.destinations.length > 0;
}

function decision(
  capabilityId: string,
  capability: CapabilityDefinition | undefined,
  context: CapabilityExposureContext,
  status: CapabilityExposureStatus,
  reason: string,
): CapabilityExposureDecision {
  const surface = context.surface ?? 'navigation';
  const visible = surfaceVisible(status, surface, capability, context);
  const publicClaim = visible && surface === 'marketing' && (status === 'live' || status === 'connected')
    ? context.release.claim
    : null;
  return {
    capabilityId,
    surface,
    status,
    visible,
    publicClaim,
    reason,
    routes: capability ? [...capability.destinations] : [],
  };
}

/**
 * Convert capability decisions into the one predicate navigation consumes.
 *
 * A route can implement more than one capability, so one authorized
 * navigation capability is enough to keep that route discoverable. Missing
 * decisions, decisions resolved for another surface, duplicate decisions, and
 * unknown routes all fail closed. The browser must receive these decisions
 * from the trusted governance boundary; it must not reconstruct their inputs.
 */
export function navigationExposureGate(
  decisions: readonly CapabilityExposureDecision[],
): (route: string) => boolean {
  const byCapability = new Map<string, CapabilityExposureDecision>();
  const duplicates = new Set<string>();

  for (const item of decisions) {
    if (byCapability.has(item.capabilityId)) duplicates.add(item.capabilityId);
    byCapability.set(item.capabilityId, item);
  }

  const byRoute = new Map(ROUTE_EXPOSURE_INDEX.map((item) => [item.route, item.capabilityIds]));
  return (route: string): boolean => {
    const capabilityIds = byRoute.get(route);
    if (!capabilityIds?.length) return false;
    return capabilityIds.some((capabilityId) => {
      if (duplicates.has(capabilityId)) return false;
      const item = byCapability.get(capabilityId);
      return item?.surface === 'navigation' && item.visible === true;
    });
  };
}

function operationallyReady(context: CapabilityExposureContext): boolean {
  return OPERATIONAL_READINESS_CHECKS.every((check) => context.operationalReadiness[check] === true);
}

export function resolveCapabilityExposure(
  capabilityId: string,
  context: CapabilityExposureContext,
): CapabilityExposureDecision {
  const capability = capabilityDefinition(capabilityId);
  if (!capability) return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'unknown-capability');
  if (context.retired) return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'capability-retired');
  if (context.release.profileId !== context.profileId) {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'release-profile-mismatch');
  }
  if (!context.target || !sameReleaseTarget(context.release.target, context.target)) {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'release-target-mismatch');
  }
  if (context.killSwitchActive) {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'kill-switch-active');
  }
  if (!context.tenantEntitled || !context.cohortAuthorized) {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'scope-not-authorized');
  }
  if (MATURITY_LEVELS.indexOf(capability.maturity) < MATURITY_LEVELS.indexOf('L2')) {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'capability-not-built');
  }

  const profile = RELEASE_PROFILES[context.profileId];
  const included = profile.capabilityIds.includes(capability.id);
  if (!included) {
    const status = capability.activationClass === 'standard'
      ? 'planned_but_not_exposed'
      : 'institution_controlled';
    return decision(capabilityId, capability, context, status, 'capability-not-in-release-profile');
  }
  if (context.release.technicalStatus !== 'ready') {
    return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'technical-release-not-ready');
  }
  if (context.release.rolloutStatus !== 'authorized' || !context.release.targetBound) {
    const status = capability.activationClass === 'standard' && context.nativeBaselineAvailable
      ? 'early_access'
      : 'institution_controlled';
    return decision(capabilityId, capability, context, status, 'rollout-held');
  }
  if (!operationallyReady(context)) {
    const status = capability.activationClass === 'standard' && context.nativeBaselineAvailable
      ? 'early_access'
      : 'institution_controlled';
    return decision(capabilityId, capability, context, status, 'operational-evidence-incomplete');
  }

  if (profile.targetKind === 'public-individual') {
    if (context.target?.environment !== 'production') {
      return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'production-target-required');
    }
    return decision(capabilityId, capability, context, 'live', 'production-release-authorized');
  }

  if (profile.targetKind === 'invitation-validation') {
    if (context.target?.environment !== 'production' || !context.target.cohortId) {
      return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'bounded-target-required');
    }
    return decision(capabilityId, capability, context, 'pilot', 'bounded-pilot-authorized');
  }

  if (profile.targetKind === 'manual-pilot' || profile.targetKind === 'connected-pilot') {
    if (context.target?.environment !== 'pilot' || !context.target.tenantId || !context.target.cohortId) {
      return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'bounded-target-required');
    }
    if (profile.targetKind === 'connected-pilot' && !context.connectionHealthy) {
      return decision(capabilityId, capability, context, 'institution_controlled', 'connection-not-healthy');
    }
    return decision(capabilityId, capability, context, 'pilot', 'bounded-pilot-authorized');
  }

  if (profile.targetKind === 'enterprise') {
    if (context.target?.environment !== 'production' || context.target.dataMode !== 'connected') {
      return decision(capabilityId, capability, context, 'institution_controlled', 'connected-target-required');
    }
    if (!context.connectionHealthy) {
      return decision(capabilityId, capability, context, 'institution_controlled', 'connection-not-healthy');
    }
    return decision(capabilityId, capability, context, 'connected', 'connected-target-authorized');
  }

  return decision(capabilityId, capability, context, 'planned_but_not_exposed', 'unsupported-release-target');
}
