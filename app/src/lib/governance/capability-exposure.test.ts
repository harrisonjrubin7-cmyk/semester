import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
  type CapabilityExposureIndexEntry,
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

const root = join(import.meta.dirname, '../../../..');

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
  missingPrerequisites: [],
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
      'live', 'connected', 'pilot', 'early_access', 'institution_controlled', 'planned_but_not_exposed',
    ]);
    for (const item of CAPABILITY_EXPOSURE_INDEX) {
      expect(item.coreEntities.length).toBeGreaterThan(0);
      expect(item.audiences).toContain('student');
      expect(item.productMaturity).toMatch(/^L[0-9]$/);
      expect(item.permittedExposureStates).toBe(CAPABILITY_EXPOSURE_STATES);
      expect(item.valueMeasures.map((measure) => measure.id)).toEqual([
        'successful-task-completion', 'fallback-use', 'support-burden',
      ]);
      expect(item.valueMeasures.every(Object.isFrozen)).toBe(true);
      expect(item.valueMeasures.every((measure) =>
        measure.collection === 'device-local-or-approved-aggregate' &&
        measure.evidenceStatus === 'measurement-requirement-not-live-result')).toBe(true);
      expect(item.requiredOperationalChecks).toEqual(OPERATIONAL_READINESS_CHECKS);
      expect(item.dataAuthorities.length).toBeGreaterThan(0);
      expect(item.securityClassifications.length).toBeGreaterThan(0);
      expect(item.productOwner.trim()).not.toBe('');
      expect(item.supportOwner.trim()).not.toBe('');
      expect(item.rollback.trim()).not.toBe('');
      expect(item.evidenceRefs.length).toBeGreaterThan(0);
      expect(item.platforms).toEqual(['web', 'pwa']);
      expect(item.nativeMobile).toBe('planned_but_not_exposed');
      expect(item.mobileExperience).toMatchObject({
        current: 'responsive-web-and-pwa',
        native: 'planned_but_not_exposed',
      });
      expect(item.mobileExperience.acceptance.trim()).not.toBe('');
      expect(item.operations.supportOwner).toBe(item.supportOwner);
      expect(item.operations.auditOwner).toBe('privacy-security');
      expect(item.operations.incidentOwner).toBe('operations');
      for (const reference of [item.operations.audit, item.operations.support, item.operations.incident]) {
        expect(existsSync(join(root, reference))).toBe(true);
      }
    }
  });

  it('derives governed audiences without turning every capability into a family, partner, or institutional surface', () => {
    const entry = (id: string) => CAPABILITY_EXPOSURE_INDEX.find((item) => item.capabilityId === id)!;
    expect(entry('CAP-001').audiences).toEqual(['student']);
    expect(entry('CAP-013').audiences).toEqual(['student', 'institution', 'operator', 'partner']);
    expect(entry('CAP-027').audiences).toEqual(['student', 'institution', 'operator']);
    expect(entry('CAP-041').audiences).toEqual(['student', 'family', 'institution', 'operator']);
  });

  it('rejects an incomplete operating contract instead of silently publishing it', () => {
    const incomplete: CapabilityExposureIndexEntry = {
      ...CAPABILITY_EXPOSURE_INDEX[0]!,
      audiences: [],
      valueMeasures: [],
    };
    const mutated = [incomplete, ...CAPABILITY_EXPOSURE_INDEX.slice(1)];
    expect(validateCapabilityExposureIndex(mutated)).toEqual(expect.arrayContaining([
      `Missing audiences: ${incomplete.capabilityId}.`,
      `Incomplete value measures: ${incomplete.capabilityId}.`,
    ]));
  });

  it('rejects duplicate value-measure identities even when three definitions are present', () => {
    const original = CAPABILITY_EXPOSURE_INDEX[0]!;
    const duplicated: CapabilityExposureIndexEntry = {
      ...original,
      valueMeasures: original.valueMeasures.map((measure) => ({
        ...measure,
        id: 'support-burden',
      })),
    };
    const mutated = [duplicated, ...CAPABILITY_EXPOSURE_INDEX.slice(1)];
    expect(validateCapabilityExposureIndex(mutated)).toContain(
      `Incomplete value measures: ${duplicated.capabilityId}.`,
    );
  });

  it('rejects an incomplete audience set derived from the canonical capability', () => {
    const family = CAPABILITY_EXPOSURE_INDEX.find((item) => item.capabilityId === 'CAP-041')!;
    const incomplete: CapabilityExposureIndexEntry = { ...family, audiences: ['student'] };
    const mutated = CAPABILITY_EXPOSURE_INDEX.map((item) => item.capabilityId === family.capabilityId ? incomplete : item);
    expect(validateCapabilityExposureIndex(mutated)).toContain(`Invalid audiences: ${family.capabilityId}.`);
  });

  it('accepts the exposure-state vocabulary by value after serialization', () => {
    const cloned = CAPABILITY_EXPOSURE_INDEX.map((item) => ({
      ...item,
      permittedExposureStates: [...item.permittedExposureStates] as typeof CAPABILITY_EXPOSURE_STATES,
    }));
    expect(validateCapabilityExposureIndex(cloned)).toEqual([]);
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
    })).status).toBe('planned_but_not_exposed');
    expect(resolveCapabilityExposure('CAP-044', context({
      profileId: 'broad-enterprise-sale',
      release: release({ profileId: 'broad-enterprise-sale' }, connectedTarget),
      target: connectedTarget,
      connectionHealthy: false,
    })).status).toBe('institution_controlled');
    expect(resolveCapabilityExposure('CAP-001', context({ cohortAuthorized: false })).status).toBe('planned_but_not_exposed');
    expect(resolveCapabilityExposure('CAP-001', context({
      target: { ...productionTarget, configurationVersion: 'different' },
    }))).toMatchObject({ status: 'planned_but_not_exposed', reason: 'release-target-mismatch' });
    expect(resolveCapabilityExposure('CAP-001', context({ killSwitchActive: true }))).toMatchObject({
      status: 'planned_but_not_exposed', visible: false, reason: 'kill-switch-active',
    });
    expect(resolveCapabilityExposure('CAP-999', context())).toMatchObject({
      status: 'planned_but_not_exposed', visible: false, reason: 'unknown-capability',
    });
    expect(resolveCapabilityExposure('CAP-001', context({ retired: true }))).toMatchObject({
      status: 'planned_but_not_exposed', visible: false, reason: 'capability-retired',
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
