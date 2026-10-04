import { describe, expect, it } from 'vitest';
import { DESTINATIONS, offered } from '../nav';
import { NO_SCHOOL } from '../school';
import { CAPABILITY_DEFINITIONS } from './capability-governance';
import {
  CAPABILITY_EXPOSURE_STATES,
  CAPABILITY_EXPOSURE_INDEX,
  OPERATIONAL_READINESS_CHECKS,
  ROUTE_EXPOSURE_INDEX,
  navigationExposureGate,
  resolveCapabilityExposure,
  validateCapabilityExposureIndex,
  type CapabilityExposureContext,
} from './capability-exposure';
import type { ReleaseProfileDecision, ReleaseTarget } from './release-profiles';

const productionTarget: ReleaseTarget = {
  environment: 'production',
  deployedSha: 'abc123abc123abc123abc123abc123abc123abcd',
  configurationVersion: 'individual-v1',
};

const pilotTarget: ReleaseTarget = {
  environment: 'pilot',
  deployedSha: 'abc123abc123abc123abc123abc123abc123abcd',
  configurationVersion: 'pilot-v1',
  tenantId: 'tenant-a',
  cohortId: 'cohort-a',
  dataMode: 'manual',
  registrationWriteback: 'disabled',
};

const connectedTarget: ReleaseTarget = {
  ...pilotTarget,
  environment: 'production',
  configurationVersion: 'enterprise-v1',
  dataMode: 'connected',
};

const release = (
  overrides: Partial<ReleaseProfileDecision> = {},
  target: ReleaseTarget = productionTarget,
): ReleaseProfileDecision => ({
  profileId: 'individual-scale',
  target,
  technicalStatus: 'ready',
  rolloutStatus: 'authorized',
  missingTechnical: [],
  missingActivation: [],
  missingDependencies: [],
  targetBound: true,
  launchVerdict: 'go',
  launchConditions: [],
  claim: 'Authorized for the exact evaluated target.',
  ...overrides,
});

const context = (overrides: Partial<CapabilityExposureContext> = {}): CapabilityExposureContext => ({
  profileId: 'individual-scale',
  release: release(),
  target: productionTarget,
  tenantEntitled: true,
  cohortAuthorized: true,
  connectionHealthy: false,
  nativeBaselineAvailable: true,
  aiAvailable: false,
  killSwitchActive: false,
  operationalReadiness: Object.fromEntries(OPERATIONAL_READINESS_CHECKS.map((check) => [check, true])),
  ...overrides,
});

describe('capability exposure resolver', () => {
  it('indexes all sixty capabilities and every registered destination exactly once', () => {
    expect(validateCapabilityExposureIndex()).toEqual([]);
    expect(CAPABILITY_EXPOSURE_INDEX).toHaveLength(60);
    expect(new Set(CAPABILITY_EXPOSURE_INDEX.map((item) => item.capabilityId)).size).toBe(60);
    expect(ROUTE_EXPOSURE_INDEX.map((item) => item.route)).toEqual(DESTINATIONS.map((item) => item.screen));
    expect(ROUTE_EXPOSURE_INDEX.every((item) => item.capabilityIds.length > 0)).toBe(true);
    expect(CAPABILITY_EXPOSURE_STATES).toEqual([
      'live', 'connected', 'pilot', 'early_access', 'institution_controlled', 'hidden', 'retired',
    ]);
    for (const item of CAPABILITY_EXPOSURE_INDEX) {
      expect(item.requiredOperationalChecks).toEqual(OPERATIONAL_READINESS_CHECKS);
      expect(item.dataAuthorities.length).toBeGreaterThan(0);
      expect(item.securityClassifications.length).toBeGreaterThan(0);
      expect(item.productOwner.trim()).not.toBe('');
      expect(item.supportOwner.trim()).not.toBe('');
      expect(item.rollback.trim()).not.toBe('');
      expect(item.evidenceRefs.length).toBeGreaterThan(0);
      expect(item.platforms).toEqual(['web', 'pwa']);
      expect(item.nativeMobile).toBe('hidden');
    }
  });

  it('authorizes live only for an exact production release of an included standard capability', () => {
    expect(resolveCapabilityExposure('CAP-001', context({ surface: 'marketing' }))).toMatchObject({
      status: 'live',
      visible: true,
      publicClaim: 'Authorized for the exact evaluated target.',
      reason: 'production-release-authorized',
    });
  });

  it('uses early access for a safe native capability when technical evidence is ready but rollout is held', () => {
    const result = resolveCapabilityExposure('CAP-001', context({
      release: release({ rolloutStatus: 'held', claim: 'Technical release candidate; rollout held.' }),
      surface: 'navigation',
    }));
    expect(result).toMatchObject({ status: 'early_access', visible: true, publicClaim: null });
  });

  it('cannot label a capability live while any operational evidence category is incomplete', () => {
    const result = resolveCapabilityExposure('CAP-001', context({
      operationalReadiness: {
        ...Object.fromEntries(OPERATIONAL_READINESS_CHECKS.map((check) => [check, true])),
        measurement: false,
      },
    }));
    expect(result).toMatchObject({
      status: 'early_access',
      publicClaim: null,
      reason: 'operational-evidence-incomplete',
    });
  });

  it('keeps controlled and high-risk capabilities institution controlled without authorized tenant rollout', () => {
    const result = resolveCapabilityExposure('CAP-041', context({
      profileId: 'institutional-pilot',
      release: release({ profileId: 'institutional-pilot', rolloutStatus: 'held' }, pilotTarget),
      target: pilotTarget,
      surface: 'tenant-control',
    }));
    expect(result).toMatchObject({ status: 'institution_controlled', visible: true, publicClaim: null });
    expect(resolveCapabilityExposure('CAP-041', context({
      profileId: 'institutional-pilot',
      release: release({ profileId: 'institutional-pilot', rolloutStatus: 'held' }, pilotTarget),
      target: pilotTarget,
      surface: 'navigation',
    }))).toMatchObject({ status: 'institution_controlled', visible: false });
  });

  it('reports an authorized bounded cohort as pilot without turning it into a public claim', () => {
    expect(resolveCapabilityExposure('CAP-001', context({
      profileId: 'institutional-manual-pilot',
      release: release({ profileId: 'institutional-manual-pilot' }, pilotTarget),
      target: pilotTarget,
    }))).toMatchObject({ status: 'pilot', visible: true, publicClaim: null, reason: 'bounded-pilot-authorized' });
  });

  it('reports a healthy production provider path as connected rather than universally live', () => {
    expect(resolveCapabilityExposure('CAP-044', context({
      profileId: 'broad-enterprise-sale',
      release: release({ profileId: 'broad-enterprise-sale' }, connectedTarget),
      target: connectedTarget,
      connectionHealthy: true,
    }))).toMatchObject({ status: 'connected', visible: true, reason: 'connected-target-authorized' });
  });

  it('fails closed for mismatched profiles, missing scope, unhealthy connections and kill switches', () => {
    expect(resolveCapabilityExposure('CAP-001', context({
      release: release({ profileId: 'institutional-pilot' }),
    })).status).toBe('hidden');
    expect(resolveCapabilityExposure('CAP-044', context({
      profileId: 'broad-enterprise-sale',
      release: release({ profileId: 'broad-enterprise-sale' }, connectedTarget),
      target: connectedTarget,
      connectionHealthy: false,
    })).status).toBe('institution_controlled');
    expect(resolveCapabilityExposure('CAP-001', context({ cohortAuthorized: false })).status).toBe('hidden');
    expect(resolveCapabilityExposure('CAP-001', context({
      target: { ...productionTarget, configurationVersion: 'different' },
    }))).toMatchObject({ status: 'hidden', reason: 'release-target-mismatch' });
    expect(resolveCapabilityExposure('CAP-001', context({ killSwitchActive: true }))).toMatchObject({
      status: 'hidden', visible: false, reason: 'kill-switch-active',
    });
    expect(resolveCapabilityExposure('CAP-999', context())).toMatchObject({
      status: 'hidden', visible: false, reason: 'unknown-capability',
    });
    expect(resolveCapabilityExposure('CAP-001', context({ retired: true }))).toMatchObject({
      status: 'retired', visible: false, reason: 'capability-retired',
    });
  });

  it('never exposes marketing or AI above the resolved operational state', () => {
    expect(resolveCapabilityExposure('CAP-001', context({
      release: release({ rolloutStatus: 'held' }),
      surface: 'marketing',
    })).visible).toBe(false);
    expect(resolveCapabilityExposure('CAP-001', context({ surface: 'ai', aiAvailable: false }))).toMatchObject({
      visible: false,
      publicClaim: null,
    });
    expect(resolveCapabilityExposure('CAP-001', context({ surface: 'ai', aiAvailable: true })).visible).toBe(true);
  });

  it('gates the navigation registry with navigation decisions and fails closed otherwise', () => {
    const navigationDecision = resolveCapabilityExposure('CAP-001', context({ surface: 'navigation' }));
    const gate = navigationExposureGate([navigationDecision]);

    expect(gate('home')).toBe(true);
    expect(gate('brief')).toBe(false);
    expect(gate('not-a-route')).toBe(false);
    expect(offered(NO_SCHOOL.capabilities, 'student', gate).map((item) => item.screen)).toEqual(['home']);

    const marketingDecision = resolveCapabilityExposure('CAP-001', context({ surface: 'marketing' }));
    expect(navigationExposureGate([marketingDecision])('home')).toBe(false);
    expect(navigationExposureGate([navigationDecision, navigationDecision])('home')).toBe(false);
  });

  it('does not mutate the canonical capability definitions while resolving', () => {
    const before = JSON.stringify(CAPABILITY_DEFINITIONS);
    resolveCapabilityExposure('CAP-001', context());
    expect(JSON.stringify(CAPABILITY_DEFINITIONS)).toBe(before);
  });
});
