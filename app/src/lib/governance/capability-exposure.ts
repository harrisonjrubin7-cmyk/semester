import { DESTINATIONS } from '../nav';
import { SEATS, type Seat } from '../launchreadiness';
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
export type CapabilityAudience = 'student' | 'family' | 'institution' | 'partner' | 'operator';

export interface CapabilityCoreEntity {
  readonly classification: string;
  readonly authority: CapabilityDefinition['data'][number]['authority'];
  readonly purpose: string;
  readonly retention: string;
}

export interface CapabilityValueMeasure {
  readonly id: 'successful-task-completion' | 'fallback-use' | 'support-burden';
  readonly definition: string;
  readonly collection: 'device-local-or-approved-aggregate';
  readonly evidenceStatus: 'measurement-requirement-not-live-result';
}

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
  coreEntities: readonly CapabilityCoreEntity[];
  governance: {
    identity: 'shared-account-and-person-graph';
    tenant: 'personal-context-or-exact-authorized-tenant' | 'exact-authorized-tenant';
    permission: 'shared-role-permission-entitlement';
    consent: 'shared-policy-and-authority-check' | 'explicit-purpose-scoped-consent-when-required';
    aiActions: 'shared-authorization-no-bypass';
  };
  audiences: readonly CapabilityAudience[];
  productMaturity: CapabilityDefinition['maturity'];
  permittedExposureStates: typeof CAPABILITY_EXPOSURE_STATES;
  valueMeasures: readonly CapabilityValueMeasure[];
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
  mobileExperience: {
    current: 'responsive-web-and-pwa';
    native: 'planned_but_not_exposed';
    acceptance: string;
  };
  operations: {
    audit: 'docs/institutional-readiness/AUDIT-LOGGING-EVIDENCE.md';
    support: 'docs/SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md';
    incident: 'docs/RELEASE-INCIDENT-OPERATOR-RUNBOOK.md';
    auditOwner: Seat;
    supportOwner: CapabilityDefinition['supportOwner'];
    incidentOwner: 'operations';
  };
}

export interface RouteExposureIndexEntry {
  route: string;
  capabilityIds: readonly CapabilityDefinition['id'][];
}

const profileEntries = Object.values(RELEASE_PROFILES);

function audiencesFor(capability: CapabilityDefinition): readonly CapabilityAudience[] {
  const audiences = new Set<CapabilityAudience>(['student']);
  if (capability.id === 'CAP-041') audiences.add('family');
  if (capability.activationClass !== 'standard') {
    audiences.add('institution');
    audiences.add('operator');
  }
  if (capability.data.some((rule) => rule.authority === 'external-provider')) audiences.add('partner');
  return Object.freeze([...audiences]);
}

function valueMeasuresFor(capability: CapabilityDefinition): readonly CapabilityValueMeasure[] {
  const common = {
    collection: 'device-local-or-approved-aggregate' as const,
    evidenceStatus: 'measurement-requirement-not-live-result' as const,
  };
  return Object.freeze([
    Object.freeze({
      id: 'successful-task-completion' as const,
      definition: `Count an explicitly completed ${capability.name} action only when the capability acceptance condition is met; never infer completion from attention, content, or time spent.`,
      ...common,
    }),
    Object.freeze({
      id: 'fallback-use' as const,
      definition: `Measure how often an eligible ${capability.name} attempt uses the declared unavailable-source fallback, without recording protected content.`,
      ...common,
    }),
    Object.freeze({
      id: 'support-burden' as const,
      definition: `Measure support cases and unresolved incidents for ${capability.name} against authorized active use, using approved aggregate thresholds.`,
      ...common,
    }),
  ]);
}

export const CAPABILITY_EXPOSURE_INDEX: readonly CapabilityExposureIndexEntry[] = Object.freeze(
  CAPABILITY_DEFINITIONS.map((capability) => Object.freeze({
    capabilityId: capability.id,
    routes: Object.freeze([...capability.destinations]),
    coreEntities: Object.freeze(capability.data.map((rule) => Object.freeze({ ...rule }))),
    governance: Object.freeze({
      identity: 'shared-account-and-person-graph' as const,
      tenant: capability.activationClass === 'standard'
        ? 'personal-context-or-exact-authorized-tenant' as const
        : 'exact-authorized-tenant' as const,
      permission: 'shared-role-permission-entitlement' as const,
      consent: capability.primitives.includes('permission-consent-authority')
        ? 'explicit-purpose-scoped-consent-when-required' as const
        : 'shared-policy-and-authority-check' as const,
      aiActions: 'shared-authorization-no-bypass' as const,
    }),
    audiences: audiencesFor(capability),
    productMaturity: capability.maturity,
    permittedExposureStates: CAPABILITY_EXPOSURE_STATES,
    valueMeasures: valueMeasuresFor(capability),
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
    mobileExperience: Object.freeze({
      current: 'responsive-web-and-pwa' as const,
      native: 'planned_but_not_exposed' as const,
      acceptance: capability.accessibility,
    }),
    operations: Object.freeze({
      audit: 'docs/institutional-readiness/AUDIT-LOGGING-EVIDENCE.md' as const,
      support: 'docs/SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md' as const,
      incident: 'docs/RELEASE-INCIDENT-OPERATOR-RUNBOOK.md' as const,
      auditOwner: 'privacy' as const,
      supportOwner: capability.supportOwner,
      incidentOwner: 'operations' as const,
    }),
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

export function validateCapabilityExposureIndex(
  exposureIndex: readonly CapabilityExposureIndexEntry[] = CAPABILITY_EXPOSURE_INDEX,
): string[] {
  const errors: string[] = [];
  const requiredValueMeasureIds: readonly CapabilityValueMeasure['id'][] = [
    'successful-task-completion',
    'fallback-use',
    'support-burden',
  ];
  const capabilityIds = exposureIndex.map((entry) => entry.capabilityId);
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

  for (const entry of exposureIndex) {
    const canonicalCapability = capabilityDefinition(entry.capabilityId);
    if (!entry.coreEntities.length || entry.coreEntities.some((entity) =>
      [entity.classification, entity.authority, entity.purpose, entity.retention].some((value) => !value.trim()))) {
      errors.push(`Incomplete core entities: ${entry.capabilityId}.`);
    }
    if (!entry.audiences.length) errors.push(`Missing audiences: ${entry.capabilityId}.`);
    if (canonicalCapability) {
      const requiredAudiences = audiencesFor(canonicalCapability);
      if (entry.audiences.length !== requiredAudiences.length
        || requiredAudiences.some((audience) => !entry.audiences.includes(audience))) {
        errors.push(`Invalid audiences: ${entry.capabilityId}.`);
      }
    }
    if (!MATURITY_LEVELS.includes(entry.productMaturity)) errors.push(`Unknown product maturity: ${entry.capabilityId}.`);
    if (entry.permittedExposureStates.length !== CAPABILITY_EXPOSURE_STATES.length
      || CAPABILITY_EXPOSURE_STATES.some((state, index) => entry.permittedExposureStates[index] !== state)) {
      errors.push(`Invalid exposure vocabulary: ${entry.capabilityId}.`);
    }
    const valueMeasureIds = entry.valueMeasures.map((measure) => measure.id);
    if (entry.valueMeasures.length !== requiredValueMeasureIds.length
      || new Set(valueMeasureIds).size !== requiredValueMeasureIds.length
      || requiredValueMeasureIds.some((id) => !valueMeasureIds.includes(id))
      || entry.valueMeasures.some((measure) => !measure.definition.trim())) {
      errors.push(`Incomplete value measures: ${entry.capabilityId}.`);
    }
    if (!entry.rollback.trim()) errors.push(`Missing fallback: ${entry.capabilityId}.`);
    if (!entry.mobileExperience.acceptance.trim()) errors.push(`Missing mobile acceptance: ${entry.capabilityId}.`);
    if (Object.values(entry.governance).some((value) => !value.trim())) errors.push(`Incomplete governance: ${entry.capabilityId}.`);
    if (Object.values(entry.operations).some((value) => !value.trim())) errors.push(`Incomplete operations: ${entry.capabilityId}.`);
    if (!SEATS.includes(entry.operations.auditOwner)) errors.push(`Invalid audit owner: ${entry.capabilityId}.`);
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
