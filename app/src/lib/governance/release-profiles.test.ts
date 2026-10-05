import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CAPABILITIES } from '../rollout-capabilities';
import { COUNCIL, GATES, SEATS, type LaunchState } from '../launchreadiness';
import { controlLine, renderedFrom, table } from '../ops/render';
import {
  ACTIVATION_GATES,
  COMMERCIAL_ACTIVATION_GATES,
  ENTERPRISE_ACTIVATION_GATES,
  PAID_ASSURANCE_GATES,
  PILOT_ACTIVATION_GATES,
  VALIDATION_ACTIVATION_GATES,
  RELEASE_PROFILES,
  REPOSITORY_RELEASE_EVIDENCE,
  TECHNICAL_RELEASE_GATES,
  evaluateReleaseProfile,
  type ReleaseApproverRole,
  type ReleaseEvidence,
  type ReleaseProfileId,
  type ReleaseTarget,
  type TechnicalReleaseGate,
} from './release-profiles';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md';
const AS_OF = '2026-10-02';
const SOURCE_SHA = 'abc123abc123abc123abc123abc123abc123abcd';
const MANUAL_PROFILE = 'institutional-manual-pilot' as ReleaseProfileId;
const TARGETS: Record<ReleaseProfileId, ReleaseTarget> = {
  'individual-scale': { environment: 'production', deployedSha: SOURCE_SHA, configurationVersion: 'individual-v1' },
  'invitation-only-individual-validation': {
    environment: 'production', deployedSha: SOURCE_SHA, configurationVersion: 'validation-v1', cohortId: 'validation-cohort-a',
  },
  'institutional-manual-pilot': {
    environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'manual-v1', tenantId: 'tenant-a', cohortId: 'cohort-a',
    registrationWriteback: 'disabled', dataMode: 'manual',
  },
  'institutional-pilot': {
    environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'pilot-v1', tenantId: 'tenant-a', cohortId: 'cohort-a',
    registrationWriteback: 'disabled', dataMode: 'connected',
  },
  'paid-institutional-manual-pilot': {
    environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'paid-manual-v1', tenantId: 'tenant-a', cohortId: 'cohort-a',
    registrationWriteback: 'disabled', dataMode: 'manual',
  },
  'paid-institutional-pilot': {
    environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'paid-pilot-v1', tenantId: 'tenant-a', cohortId: 'cohort-a',
    registrationWriteback: 'disabled', dataMode: 'connected',
  },
  'broad-enterprise-sale': {
    environment: 'production', deployedSha: SOURCE_SHA, configurationVersion: 'enterprise-v1', tenantId: 'tenant-a', cohortId: 'cohort-a',
    registrationWriteback: 'disabled', dataMode: 'connected',
  },
};
const TEST_APPROVERS: Record<(typeof ACTIVATION_GATES)[number], readonly ReleaseApproverRole[]> = {
  'deployed-exact-sha': ['operations-owner', 'security-owner'],
  'production-smoke': ['operations-owner'],
  'support-route-live': ['support-owner'],
  'rollback-current': ['operations-owner', 'security-owner'],
  'kill-switch-clear': ['operations-owner', 'security-owner'],
  'participant-terms-and-consent': ['privacy-owner', 'product-owner'],
  'qualified-legal-public-policy-approval': ['legal-owner', 'privacy-owner'],
  'representative-user-acceptance': ['participant-representative', 'product-owner'],
  'target-account-lifecycle-acceptance': ['participant-representative', 'privacy-owner', 'operations-owner'],
  'validation-support-roster': ['support-owner', 'operations-owner'],
  'validation-outcome-agreed': ['product-owner', 'trust-owner'],
  'qualified-accessibility-conformance': ['accessibility-owner', 'trust-owner'],
  'validation-launch-decision': [
    'executive-owner', 'product-owner', 'security-owner', 'privacy-owner',
    'accessibility-owner', 'support-owner', 'operations-owner', 'trust-owner',
  ],
  'named-tenant-agreement': ['executive-owner', 'security-owner'],
  'named-data-owner': ['data-owner'],
  'tenant-accessibility-review': ['accessibility-owner'],
  'tenant-security-privacy-review': ['security-owner', 'privacy-owner'],
  'approved-data-scope': ['data-owner', 'privacy-owner'],
  'pilot-cohort-consent': ['privacy-owner'],
  'pilot-support-roster': ['support-owner', 'operations-owner'],
  'pilot-outcome-agreed': ['pilot-champion', 'product-owner'],
  'canonical-launch-decision': [
    'executive-owner', 'product-owner', 'engineering-owner', 'security-owner',
    'privacy-owner', 'accessibility-owner', 'support-owner', 'trust-owner',
    'data-owner', 'finance-owner', 'operations-owner', 'pilot-champion',
  ],
  'design-partner-activation-and-measured-closeout': [
    'pilot-champion', 'product-owner', 'trust-owner', 'finance-owner',
  ],
  'broad-individual-rollout-approval': [
    'executive-owner', 'legal-owner', 'product-owner', 'security-owner',
    'privacy-owner', 'accessibility-owner', 'support-owner', 'operations-owner',
  ],
  'counsel-approved-commercial-paper': ['executive-owner', 'legal-owner', 'privacy-owner'],
  'pricing-and-signing-authority': ['executive-owner', 'finance-owner'],
  'tax-accounting-and-payment-controls': ['finance-owner', 'operations-owner'],
  'insurance-decision-current': ['executive-owner', 'finance-owner'],
  'customer-purchase-and-billing-authorization': ['pilot-champion', 'executive-owner', 'finance-owner'],
  'target-dast-clean-rescan': ['security-owner', 'operations-owner'],
  'target-restore-rehearsal': ['operations-owner', 'security-owner'],
  'target-incident-alert-drill': ['operations-owner', 'security-owner', 'support-owner'],
  'target-data-rights-rehearsal': ['privacy-owner', 'operations-owner'],
  'target-access-revocation-rehearsal': ['security-owner', 'operations-owner'],
  'target-offboarding-rehearsal': ['pilot-champion', 'privacy-owner', 'operations-owner'],
  'production-provider-approval': ['legal-owner', 'privacy-owner', 'security-owner', 'data-owner'],
  'broad-enterprise-sale-decision': [
    'pilot-champion', 'executive-owner', 'legal-owner', 'finance-owner',
    'product-owner', 'security-owner', 'privacy-owner', 'accessibility-owner',
  ],
  'repeatable-multi-customer-deployments': ['operations-owner', 'product-owner'],
  'capacity-and-error-budget-accepted': ['engineering-owner', 'operations-owner'],
  'independent-security-assurance': ['security-owner', 'trust-owner'],
  'reference-and-claims-permission': ['executive-owner', 'product-owner'],
};
const readyLaunchState = (): LaunchState => ({
  gates: GATES.map((gate) => ({
    ...gate,
    status: 'met',
    evidence: [{ path: 'README.md', shows: 'test evidence' }],
  })),
  council: COUNCIL.map((seat) => ({ ...seat, holder: `${seat.seat}-holder` })),
  signoffs: [...SEATS],
  blockers: [],
  acceptances: [],
  on: AS_OF,
});
const runtime = (gate: (typeof ACTIVATION_GATES)[number], target: ReleaseTarget): ReleaseEvidence => ({
  gate,
  status: 'current',
  reference: `trust-room://release/${gate}/verified`,
  checkedAt: AS_OF,
  expiresAt: '2026-11-01',
  target,
  approvals: TEST_APPROVERS[gate].map((role) => ({ role, subjectRef: `${role}-subject` })),
  ...(gate === 'canonical-launch-decision'
    ? { launchState: readyLaunchState() }
    : gate === 'validation-launch-decision'
      ? { validationDecision: { verdict: 'go' as const, on: AS_OF, conditions: [] } }
    : {}),
});
const dependency = (name: string, target: ReleaseTarget): ReleaseEvidence => ({
  gate: `dependency:${name}`, status: 'current', reference: `vault://release/dependency/${encodeURIComponent(name)}`,
  checkedAt: AS_OF,
  expiresAt: '2026-11-01',
  target,
  approvals: [
    { role: 'product-owner', subjectRef: 'product-owner-subject' },
    { role: 'security-owner', subjectRef: 'security-owner-subject' },
  ],
});
const technical = (target: ReleaseTarget): ReleaseEvidence[] => REPOSITORY_RELEASE_EVIDENCE.map((item) => ({
  ...item,
  reference: `github-actions://harrisonjrubin7-cmyk/semester/runs/37137770928/gates/${item.gate}?sha=${target.deployedSha}`,
  sourceSha: target.deployedSha,
}));

describe('pilot and individual release profiles', () => {
  it('keeps a manual institutional pilot closed over capabilities with no external dependency', () => {
    const manual = RELEASE_PROFILES[MANUAL_PROFILE];
    expect(manual.capabilityIds).toEqual([
      'CAP-001', 'CAP-003', 'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016',
      'CAP-017', 'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024',
    ]);
    expect(manual.requiredDependencies).toEqual([]);
    expect(manual.defaultOff).toBe(true);
    expect(manual.requiredTechnicalGates).toEqual(TECHNICAL_RELEASE_GATES);
    expect(manual.requiredActivationGates).toEqual(PILOT_ACTIVATION_GATES);
    expect(manual.allowedOperations.join(' ')).toMatch(/manual|student-confirmed|personal planning/i);
    expect(manual.forbiddenOperations.join(' ')).toMatch(/institutional read|registration|system of record/i);
    for (const connected of ['CAP-013', 'CAP-019', 'CAP-043', 'CAP-044', 'CAP-045', 'CAP-050']) {
      expect(manual.capabilityIds).not.toContain(connected);
    }
  });

  it('preserves the connected institutional pilot dependency contract exactly', () => {
    expect(RELEASE_PROFILES['institutional-pilot'].requiredDependencies).toEqual([
      'CAP-013',
      'CAP-043',
      'external:approved catalog and degree-audit data',
      'external:approved read-only SIS registration-readiness adapter',
      'external:authoritative registrar calendar feed',
      'external:institution agreement and approved service adapters',
      'external:provider credentials and institution approval',
    ]);
  });

  it('makes validation, paid-pilot, and enterprise authority cumulative and fail-closed', () => {
    const validation = RELEASE_PROFILES['invitation-only-individual-validation'];
    const paidManual = RELEASE_PROFILES['paid-institutional-manual-pilot'];
    const paid = RELEASE_PROFILES['paid-institutional-pilot'];
    const enterprise = RELEASE_PROFILES['broad-enterprise-sale'];

    expect(validation.requiredActivationGates).toEqual(VALIDATION_ACTIVATION_GATES);
    expect(validation.requiredActivationGates).toContain('qualified-accessibility-conformance');
    expect(paidManual.requiredActivationGates).toEqual([
      ...PILOT_ACTIVATION_GATES, ...COMMERCIAL_ACTIVATION_GATES, ...PAID_ASSURANCE_GATES,
    ]);
    expect(paid.requiredActivationGates).toEqual([
      ...PILOT_ACTIVATION_GATES, ...COMMERCIAL_ACTIVATION_GATES, ...PAID_ASSURANCE_GATES,
    ]);
    expect(enterprise.requiredActivationGates).toEqual([
      ...PILOT_ACTIVATION_GATES, ...COMMERCIAL_ACTIVATION_GATES, ...PAID_ASSURANCE_GATES, ...ENTERPRISE_ACTIVATION_GATES,
    ]);
    expect(paidManual.requiredDependencies).toEqual([]);
    expect(PAID_ASSURANCE_GATES).toEqual([
      'target-dast-clean-rescan', 'independent-security-assurance', 'qualified-accessibility-conformance',
      'target-restore-rehearsal', 'target-incident-alert-drill', 'target-data-rights-rehearsal',
      'target-access-revocation-rehearsal', 'target-offboarding-rehearsal', 'production-provider-approval',
    ]);
    expect(COMMERCIAL_ACTIVATION_GATES).toContain('design-partner-activation-and-measured-closeout');
    expect(paidManual.allowedOperations.join(' ')).toMatch(/manual/i);
    expect(paidManual.forbiddenOperations.join(' ')).toMatch(/institutional reads/i);
    expect(paid.forbiddenOperations).toEqual(expect.arrayContaining(['unapproved charge', 'write to SIS', 'act as system of record']));
    expect(enterprise.forbiddenOperations).toEqual(expect.arrayContaining(['replace the SIS or LMS', 'act as system of record']));

    for (const profile of [validation, paidManual, paid, enterprise]) {
      const target = TARGETS[profile.id];
      const complete = [
        ...technical(target),
        ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
        ...profile.requiredDependencies.map((item) => dependency(item, target)),
      ];
      expect(evaluateReleaseProfile(profile.id, complete, AS_OF, target)).toMatchObject({
        technicalStatus: 'ready', rolloutStatus: 'authorized', targetBound: true,
      });
      for (const gate of profile.requiredActivationGates) {
        expect(evaluateReleaseProfile(
          profile.id,
          complete.filter((item) => item.gate !== gate),
          AS_OF,
          target,
        )).toMatchObject({ rolloutStatus: 'held', missingActivation: expect.arrayContaining([gate]) });
      }
    }
  });

  it('binds validation and enterprise authority to their exact market-motion target', () => {
    const validation = RELEASE_PROFILES['invitation-only-individual-validation'];
    const validationTarget = TARGETS[validation.id];
    const validationEvidence = [
      ...technical(validationTarget),
      ...validation.requiredActivationGates.map((gate) => runtime(gate, validationTarget)),
    ];
    expect(evaluateReleaseProfile(validation.id, validationEvidence, AS_OF, {
      ...validationTarget, cohortId: undefined,
    })).toMatchObject({ targetBound: false, rolloutStatus: 'held' });
    expect(evaluateReleaseProfile(validation.id, validationEvidence, AS_OF, {
      ...validationTarget, tenantId: 'institution-a',
    })).toMatchObject({ targetBound: false, rolloutStatus: 'held' });

    const enterprise = RELEASE_PROFILES['broad-enterprise-sale'];
    const enterpriseTarget = TARGETS[enterprise.id];
    const enterpriseEvidence = [
      ...technical(enterpriseTarget),
      ...enterprise.requiredActivationGates.map((gate) => runtime(gate, enterpriseTarget)),
      ...enterprise.requiredDependencies.map((item) => dependency(item, enterpriseTarget)),
    ];
    expect(evaluateReleaseProfile(enterprise.id, enterpriseEvidence, AS_OF, {
      ...enterpriseTarget, environment: 'pilot',
    })).toMatchObject({ targetBound: false, rolloutStatus: 'held' });
  });

  it('keeps the non-institutional validation decision fail-closed without a pilot champion', () => {
    const profile = RELEASE_PROFILES['invitation-only-individual-validation'];
    const target = TARGETS[profile.id];
    const complete = [
      ...technical(target),
      ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
      ...profile.requiredDependencies.map((item) => dependency(item, target)),
    ];
    const decisionIndex = complete.findIndex((item) => item.gate === 'validation-launch-decision');
    expect(complete[decisionIndex].approvals?.map((approval) => approval.role)).not.toContain('pilot-champion');
    expect(evaluateReleaseProfile(profile.id, complete, AS_OF, target)).toMatchObject({
      rolloutStatus: 'authorized', launchVerdict: 'go',
    });
    const conditional = complete.with(decisionIndex, {
      ...complete[decisionIndex],
      validationDecision: {
        verdict: 'go-with-conditions' as const,
        on: AS_OF,
        conditions: [{
          blocker: 'validation-risk', severity: 'P2' as const, by: 'founder' as const,
          reason: 'bounded validation', disclosure: 'Participants receive this notice.', expires: '2026-11-01',
        }],
      },
    });
    expect(evaluateReleaseProfile(profile.id, conditional, AS_OF, target)).toMatchObject({
      rolloutStatus: 'authorized',
      launchVerdict: 'go-with-conditions',
      claim: expect.stringMatching(/participants receive this notice/i),
    });
    const mixedDecision = conditional.with(decisionIndex, {
      ...conditional[decisionIndex], launchState: readyLaunchState(),
    });
    expect(evaluateReleaseProfile(profile.id, mixedDecision, AS_OF, target).rolloutStatus).toBe('held');
    for (const validationDecision of [
      { verdict: 'no-go' as const, on: AS_OF, conditions: [] },
      {
        verdict: 'go-with-conditions' as const,
        on: AS_OF,
        conditions: [{
          blocker: 'expired-risk', severity: 'P2' as const, by: 'founder' as const,
          reason: 'bounded validation', disclosure: 'Participants receive this notice.', expires: AS_OF,
        }],
      },
      {
        verdict: 'go-with-conditions' as const,
        on: AS_OF,
        conditions: [{
          blocker: 'critical-risk', severity: 'P1' as const, by: 'founder' as const,
          reason: 'cannot waive', disclosure: 'Participants receive this notice.', expires: '2026-11-01',
        }],
      },
    ]) {
      const evidence = complete.with(decisionIndex, { ...complete[decisionIndex], validationDecision });
      expect(evaluateReleaseProfile(profile.id, evidence, AS_OF, target).rolloutStatus).toBe('held');
    }
  });

  it('binds institutional evidence to an explicit manual or connected data mode', () => {
    const manual = RELEASE_PROFILES[MANUAL_PROFILE];
    const manualTarget = {
      environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'manual-v1',
      tenantId: 'tenant-a', cohortId: 'cohort-a', registrationWriteback: 'disabled', dataMode: 'manual',
    } as ReleaseTarget;
    const manualEvidence = [
      ...technical(manualTarget),
      ...manual.requiredActivationGates.map((gate) => runtime(gate, manualTarget)),
    ];
    expect(evaluateReleaseProfile(MANUAL_PROFILE, manualEvidence, AS_OF, manualTarget)).toMatchObject({
      targetBound: true,
      technicalStatus: 'ready',
      rolloutStatus: 'authorized',
      launchVerdict: 'go',
    });
    for (const dataMode of [undefined, null, 'connected', 'unknown', 1, {}]) {
      const target = { ...manualTarget, dataMode } as ReleaseTarget;
      expect(evaluateReleaseProfile(MANUAL_PROFILE, manualEvidence, AS_OF, target)).toMatchObject({
        targetBound: false,
        rolloutStatus: 'held',
      });
    }

    const connected = RELEASE_PROFILES['institutional-pilot'];
    const connectedTarget = { ...TARGETS['institutional-pilot'], dataMode: 'connected' } as ReleaseTarget;
    const connectedEvidence = [
      ...technical(connectedTarget),
      ...connected.requiredActivationGates.map((gate) => runtime(gate, connectedTarget)),
      ...connected.requiredDependencies.map((item) => dependency(item, connectedTarget)),
    ];
    expect(evaluateReleaseProfile('institutional-pilot', connectedEvidence, AS_OF, connectedTarget).rolloutStatus).toBe('authorized');
    expect(evaluateReleaseProfile('institutional-pilot', connectedEvidence, AS_OF, {
      ...connectedTarget, dataMode: 'manual',
    } as ReleaseTarget)).toMatchObject({ targetBound: false, rolloutStatus: 'held' });

    const individual = RELEASE_PROFILES['individual-scale'];
    const individualTarget = TARGETS[individual.id];
    const individualEvidence = [
      ...technical(individualTarget),
      ...individual.requiredActivationGates.map((gate) => runtime(gate, individualTarget)),
    ];
    for (const dataMode of ['manual', 'connected', null, 'unknown']) {
      expect(evaluateReleaseProfile(individual.id, individualEvidence, AS_OF, {
        ...individualTarget, dataMode,
      } as ReleaseTarget)).toMatchObject({ targetBound: false, rolloutStatus: 'held' });
    }
  });

  it('uses a non-institutional decision record for invitation-only validation', () => {
    const profile = RELEASE_PROFILES['invitation-only-individual-validation'];
    const target = TARGETS[profile.id];
    expect(profile.requiredActivationGates).toContain('validation-launch-decision');
    expect(profile.requiredActivationGates).not.toContain('canonical-launch-decision');
    expect(TEST_APPROVERS['validation-launch-decision']).not.toContain('pilot-champion');
    expect(TEST_APPROVERS['validation-launch-decision']).not.toContain('finance-owner');

    const complete = [
      ...technical(target),
      ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
      ...profile.requiredDependencies.map((item) => dependency(item, target)),
    ];
    expect(evaluateReleaseProfile(profile.id, complete, AS_OF, target)).toMatchObject({
      rolloutStatus: 'authorized',
      launchVerdict: 'go',
    });

    const decisionIndex = complete.findIndex((item) => item.gate === 'validation-launch-decision');
    const institutionalDecision = complete.with(decisionIndex, {
      ...complete[decisionIndex],
      validationDecision: undefined,
      launchState: readyLaunchState(),
    });
    expect(evaluateReleaseProfile(profile.id, institutionalDecision, AS_OF, target)).toMatchObject({
      rolloutStatus: 'held',
      missingActivation: expect.arrayContaining(['validation-launch-decision']),
    });
  });

  it.each([MANUAL_PROFILE, 'institutional-pilot'] as const)(
    'requires every technical and activation gate for %s',
    (profileId) => {
      const profile = RELEASE_PROFILES[profileId];
      const target = TARGETS[profileId];
      const technicalEvidence = technical(target);
      const activationEvidence = profile.requiredActivationGates.map((gate) => runtime(gate, target));
      const dependencyEvidence = profile.requiredDependencies.map((item) => dependency(item, target));
      const complete = [...technicalEvidence, ...activationEvidence, ...dependencyEvidence];
      expect(profile.requiredTechnicalGates).toHaveLength(10);
      expect(profile.requiredActivationGates).toHaveLength(14);
      expect(profile.requiredActivationGates).toContain('support-route-live');
      expect(evaluateReleaseProfile(profileId, complete, AS_OF, target).rolloutStatus).toBe('authorized');
      for (const gate of profile.requiredTechnicalGates) {
        const withoutGate = complete.filter((item) => item.gate !== gate);
        expect(evaluateReleaseProfile(profileId, withoutGate, AS_OF, target)).toMatchObject({
          technicalStatus: 'not-ready',
          rolloutStatus: 'held',
          missingTechnical: expect.arrayContaining([gate]),
        });
      }
      for (const gate of profile.requiredActivationGates) {
        const withoutGate = complete.filter((item) => item.gate !== gate);
        expect(evaluateReleaseProfile(profileId, withoutGate, AS_OF, target)).toMatchObject({
          rolloutStatus: 'held',
          missingActivation: expect.arrayContaining([gate]),
        });
      }
    },
  );

  it('preserves conditional-launch disclosures for a manual institutional pilot', () => {
    const profile = RELEASE_PROFILES[MANUAL_PROFILE];
    const target = {
      environment: 'pilot', deployedSha: SOURCE_SHA, configurationVersion: 'manual-v1',
      tenantId: 'tenant-a', cohortId: 'cohort-a', registrationWriteback: 'disabled', dataMode: 'manual',
    } as ReleaseTarget;
    const activation = profile.requiredActivationGates.map((gate) => runtime(gate, target));
    const launchIndex = activation.findIndex((item) => item.gate === 'canonical-launch-decision');
    activation[launchIndex] = {
      ...activation[launchIndex],
      launchState: {
        ...readyLaunchState(),
        on: '2026-09-30',
        blockers: [{ id: 'manual-risk', severity: 'P2', summary: 'Bounded accepted risk' }],
        acceptances: [{
          blocker: 'manual-risk', by: 'founder', reason: 'bounded pilot',
          disclosure: 'Manual-pilot users receive this notice.', expires: '2026-11-01',
        }],
      },
    };
    expect(evaluateReleaseProfile(MANUAL_PROFILE, [...technical(target), ...activation], AS_OF, target)).toMatchObject({
      rolloutStatus: 'authorized',
      launchVerdict: 'go-with-conditions',
      launchConditions: [expect.objectContaining({ blocker: 'manual-risk' })],
      claim: expect.stringMatching(/authorized with conditions.*manual-pilot users receive this notice/i),
    });
  });

  it('fails a manual pilot closed on no-go, expired conditions, or aliased approvers', () => {
    const profile = RELEASE_PROFILES[MANUAL_PROFILE];
    const target = TARGETS[MANUAL_PROFILE];
    const complete = [
      ...technical(target),
      ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
    ];
    const launchIndex = complete.findIndex((item) => item.gate === 'canonical-launch-decision');
    const agreementIndex = complete.findIndex((item) => item.gate === 'named-tenant-agreement');
    const noGo = complete.with(launchIndex, {
      ...complete[launchIndex], launchState: { ...readyLaunchState(), signoffs: [] },
    });
    expect(evaluateReleaseProfile(MANUAL_PROFILE, noGo, AS_OF, target).rolloutStatus).toBe('held');
    const expired = complete.with(launchIndex, {
      ...complete[launchIndex],
      launchState: {
        ...readyLaunchState(),
        on: '2026-09-30',
        blockers: [{ id: 'expired-risk', severity: 'P2', summary: 'Expired risk acceptance' }],
        acceptances: [{
          blocker: 'expired-risk', by: 'founder', reason: 'bounded pilot',
          disclosure: 'Pilot users receive this notice.', expires: AS_OF,
        }],
      },
    });
    expect(evaluateReleaseProfile(MANUAL_PROFILE, expired, AS_OF, target).rolloutStatus).toBe('held');
    const aliased = complete.with(agreementIndex, {
      ...complete[agreementIndex],
      approvals: [
        { role: 'executive-owner', subjectRef: 'same-person' },
        { role: 'security-owner', subjectRef: ' same-person ' },
      ],
    });
    expect(evaluateReleaseProfile(MANUAL_PROFILE, aliased, AS_OF, target).rolloutStatus).toBe('held');
  });

  it('binds every scoped capability to the canonical registry', () => {
    const ids = new Set(CAPABILITIES.map((capability) => capability.id));
    for (const profile of Object.values(RELEASE_PROFILES)) {
      expect(profile.capabilityIds.length).toBeGreaterThan(0);
      expect(profile.capabilityIds.every((id) => ids.has(id as (typeof CAPABILITIES)[number]['id']))).toBe(true);
      expect(new Set(profile.requiredTechnicalGates)).toEqual(new Set(TECHNICAL_RELEASE_GATES));
      expect(profile.requiredDependencies).toEqual([...new Set(profile.requiredDependencies)].sort());
    }
    expect(RELEASE_PROFILES['institutional-pilot'].requiredDependencies).toEqual(expect.arrayContaining([
      'CAP-043',
      'CAP-013',
      'external:institution agreement and approved service adapters',
      'external:provider credentials and institution approval',
    ]));
  });

  it('makes the institutional pilot default-off and planning-only', () => {
    const pilot = RELEASE_PROFILES['institutional-pilot'];
    expect(pilot.defaultOff).toBe(true);
    expect(pilot.capabilityIds).toContain('CAP-050');
    expect(pilot.allowedOperations.join(' ')).toMatch(/planning|comparison|validation/i);
    expect(pilot.forbiddenOperations).toEqual(expect.arrayContaining(['enroll', 'drop', 'write to SIS', 'act as system of record']));
    expect(pilot.requiredActivationGates).toEqual(expect.arrayContaining([
      'approved-data-scope', 'kill-switch-clear', 'pilot-outcome-agreed', 'canonical-launch-decision',
    ]));
    expect(RELEASE_PROFILES['individual-scale'].requiredActivationGates).toContain('kill-switch-clear');
    expect(pilot.requiredDependencies).toContain('external:approved read-only SIS registration-readiness adapter');
    expect(pilot.requiredDependencies).not.toContain('external:approved SIS registration adapter and write authorization');
    expect(RELEASE_PROFILES['individual-scale'].capabilityIds).not.toEqual(expect.arrayContaining(['CAP-019', 'CAP-044']));
    expect(RELEASE_PROFILES['individual-scale'].requiredDependencies.some((item) => item.startsWith('external:'))).toBe(false);
  });

  it('resolves immutable canonical gates from a profile id', () => {
    const profile = RELEASE_PROFILES['individual-scale'];
    expect(Object.isFrozen(RELEASE_PROFILES)).toBe(true);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.requiredTechnicalGates)).toBe(true);
    expect(() => (profile.requiredTechnicalGates as TechnicalReleaseGate[]).pop()).toThrow();
    expect(evaluateReleaseProfile(profile.id, [], AS_OF, TARGETS[profile.id])).toMatchObject({
      technicalStatus: 'not-ready',
      missingTechnical: TECHNICAL_RELEASE_GATES,
    });
  });

  it('never turns repository references without exact-SHA run evidence into readiness or authorization', () => {
    for (const profile of Object.values(RELEASE_PROFILES)) {
      const result = evaluateReleaseProfile(profile.id, REPOSITORY_RELEASE_EVIDENCE, AS_OF);
      expect(result.technicalStatus).toBe('not-ready');
      expect(result.rolloutStatus).toBe('held');
      expect(result.missingTechnical).toEqual(TECHNICAL_RELEASE_GATES);
    }
  });

  it('requires every profile-specific activation record before rollout', () => {
    for (const profile of Object.values(RELEASE_PROFILES)) {
      const target = TARGETS[profile.id];
      const evidence = [
        ...technical(target),
        ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
        ...profile.requiredDependencies.map((item) => dependency(item, target)),
      ];
      const authorized = evaluateReleaseProfile(profile.id, evidence, AS_OF, target);
      expect(authorized).toMatchObject({ technicalStatus: 'ready', rolloutStatus: 'authorized', targetBound: true });
      expect(authorized.claim).toBe(profile.authorizedClaim);
      expect(authorized.claim).not.toMatch(/still requires/i);
      expect(evaluateReleaseProfile(profile.id, evidence.slice(0, -1), AS_OF, target).rolloutStatus).toBe('held');
    }
  });

  it('requires secure approval provenance and the complete approver-role set', () => {
    const profile = RELEASE_PROFILES['institutional-pilot'];
    const target = TARGETS[profile.id];
    const evidence = [
      ...technical(target),
      ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
      ...profile.requiredDependencies.map((item) => dependency(item, target)),
    ];
    const agreementIndex = evidence.findIndex((item) => item.gate === 'named-tenant-agreement');
    const insecure = evidence.with(agreementIndex, { ...evidence[agreementIndex], reference: 'x' });
    expect(evaluateReleaseProfile(profile.id, insecure, AS_OF, target).rolloutStatus).toBe('held');
    const missingRole = evidence.with(agreementIndex, {
      ...evidence[agreementIndex], approvals: [{ role: 'executive-owner', subjectRef: 'executive-owner-subject' }],
    });
    expect(evaluateReleaseProfile(profile.id, missingRole, AS_OF, target).rolloutStatus).toBe('held');
    for (const approvals of [
      [null],
      [{ role: 'executive-owner', subjectRef: null }],
      { role: 'executive-owner', subjectRef: 'not-an-array' },
    ]) {
      const malformedApproval = evidence.with(agreementIndex, {
        ...evidence[agreementIndex], approvals: approvals as unknown as ReleaseEvidence['approvals'],
      });
      expect(() => evaluateReleaseProfile(profile.id, malformedApproval, AS_OF, target)).not.toThrow();
      expect(evaluateReleaseProfile(profile.id, malformedApproval, AS_OF, target).rolloutStatus).toBe('held');
    }
    const sameApprover = evidence.with(agreementIndex, {
      ...evidence[agreementIndex],
      approvals: [
        { role: 'executive-owner', subjectRef: 'same-subject' },
        { role: 'security-owner', subjectRef: 'same-subject' },
      ],
    });
    expect(evaluateReleaseProfile(profile.id, sameApprover, AS_OF, target).rolloutStatus).toBe('held');
    const whitespaceAlias = evidence.with(agreementIndex, {
      ...evidence[agreementIndex],
      approvals: [
        { role: 'executive-owner', subjectRef: 'same-subject' },
        { role: 'security-owner', subjectRef: ' same-subject ' },
      ],
    });
    expect(evaluateReleaseProfile(profile.id, whitespaceAlias, AS_OF, target).rolloutStatus).toBe('held');
    const duplicateRoleIndex = evidence.findIndex((item) => item.gate === 'named-tenant-agreement');
    const duplicateRole = evidence.with(duplicateRoleIndex, {
      ...evidence[duplicateRoleIndex],
      approvals: [
        { role: 'executive-owner', subjectRef: 'executive-a' },
        { role: 'executive-owner', subjectRef: 'executive-b' },
        { role: 'security-owner', subjectRef: 'executive-a' },
      ],
    });
    expect(evaluateReleaseProfile(profile.id, duplicateRole, AS_OF, target).rolloutStatus).toBe('held');
    const launchIndex = evidence.findIndex((item) => item.gate === 'canonical-launch-decision');
    const noGo = evidence.with(launchIndex, {
      ...evidence[launchIndex], launchState: { ...readyLaunchState(), signoffs: [] },
    });
    expect(evaluateReleaseProfile(profile.id, noGo, AS_OF, target).rolloutStatus).toBe('held');
    const expiredConditionalGo = evidence.with(launchIndex, {
      ...evidence[launchIndex],
      launchState: {
        ...readyLaunchState(),
        on: '2026-09-30',
        blockers: [{ id: 'risk-1', severity: 'P2', summary: 'Accepted risk' }],
        acceptances: [{
          blocker: 'risk-1', by: 'founder', reason: 'bounded pilot', disclosure: 'Pilot users are told.', expires: AS_OF,
        }],
      },
    });
    expect(evaluateReleaseProfile(profile.id, expiredConditionalGo, AS_OF, target).rolloutStatus).toBe('held');
    const futureDecision = evidence.with(launchIndex, {
      ...evidence[launchIndex], launchState: { ...readyLaunchState(), on: '2026-10-03' },
    });
    expect(evaluateReleaseProfile(profile.id, futureDecision, AS_OF, target).rolloutStatus).toBe('held');
    const malformedDecision = evidence.with(launchIndex, {
      ...evidence[launchIndex], launchState: { on: AS_OF } as LaunchState,
    });
    expect(() => evaluateReleaseProfile(profile.id, malformedDecision, AS_OF, target)).not.toThrow();
    expect(evaluateReleaseProfile(profile.id, malformedDecision, AS_OF, target).rolloutStatus).toBe('held');
    const currentConditional = evidence.with(launchIndex, {
      ...evidence[launchIndex],
      launchState: {
        ...readyLaunchState(),
        on: '2026-09-30',
        blockers: [{ id: 'risk-2', severity: 'P2', summary: 'Bounded accepted risk' }],
        acceptances: [{
          blocker: 'risk-2', by: 'founder', reason: 'bounded pilot', disclosure: 'Pilot users receive this notice.', expires: '2026-11-01',
        }],
      },
    });
    expect(evaluateReleaseProfile(profile.id, currentConditional, AS_OF, target)).toMatchObject({
      rolloutStatus: 'authorized',
      launchVerdict: 'go-with-conditions',
      launchConditions: [expect.objectContaining({ blocker: 'risk-2', expires: '2026-11-01' })],
      claim: expect.stringMatching(/authorized with conditions.*pilot users receive this notice/i),
    });
  });

  it('fails closed on stale, failed, revoked, or expired evidence', () => {
    const profile = RELEASE_PROFILES['individual-scale'];
    const target = TARGETS[profile.id];
    for (const status of ['expired', 'failed', 'revoked'] as const) {
      const evidence = technical(target).map((item, index) => index === 0 ? { ...item, status } : item);
      expect(evaluateReleaseProfile(profile.id, evidence, AS_OF, target).technicalStatus).toBe('not-ready');
    }
    const expired = technical(target).map((item, index) => index === 0 ? { ...item, expiresAt: '2026-10-01' } : item);
    expect(evaluateReleaseProfile(profile.id, expired, AS_OF, target).technicalStatus).toBe('not-ready');
    const malformed = technical(target).map((item, index) => index === 0 ? { ...item, expiresAt: 'never' } : item);
    expect(evaluateReleaseProfile(profile.id, malformed, AS_OF, target).technicalStatus).toBe('not-ready');
    const impossible = technical(target).map((item, index) => index === 0 ? { ...item, expiresAt: '2026-02-30' } : item);
    expect(evaluateReleaseProfile(profile.id, impossible, AS_OF, target).technicalStatus).toBe('not-ready');
    const malformedReference = technical(target).map((item, index) => index === 0
      ? { ...item, reference: null as unknown as string }
      : item);
    expect(() => evaluateReleaseProfile(profile.id, malformedReference, AS_OF, target)).not.toThrow();
    expect(evaluateReleaseProfile(profile.id, malformedReference, AS_OF, target).technicalStatus).toBe('not-ready');
    const unverifiedReference = technical(target).map((item, index) => index === 0
      ? { ...item, reference: 'x' }
      : item);
    expect(evaluateReleaseProfile(profile.id, unverifiedReference, AS_OF, target).technicalStatus).toBe('not-ready');
    const wrongGateReference = technical(target).map((item, index) => index === 0
      ? { ...item, reference: `github-actions://harrisonjrubin7-cmyk/semester/runs/37137770928/gates/security-scan?sha=${target.deployedSha}` }
      : item);
    expect(evaluateReleaseProfile(profile.id, wrongGateReference, AS_OF, target).technicalStatus).toBe('not-ready');
    const wrongShaReference = technical(target).map((item, index) => index === 0
      ? { ...item, reference: `github-actions://harrisonjrubin7-cmyk/semester/runs/37137770928/gates/${item.gate}?sha=${'0'.repeat(40)}` }
      : item);
    expect(evaluateReleaseProfile(profile.id, wrongShaReference, AS_OF, target).technicalStatus).toBe('not-ready');
    const malformedTarget = { ...target, configurationVersion: null as unknown as string };
    expect(() => evaluateReleaseProfile(profile.id, technical(malformedTarget), AS_OF, malformedTarget)).not.toThrow();
    expect(evaluateReleaseProfile(profile.id, technical(malformedTarget), AS_OF, malformedTarget).targetBound).toBe(false);
    const malformedCollection = [...technical(target), null] as unknown as ReleaseEvidence[];
    expect(() => evaluateReleaseProfile(profile.id, malformedCollection, AS_OF, target)).not.toThrow();
    expect(evaluateReleaseProfile(profile.id, malformedCollection, AS_OF, target)).toMatchObject({
      technicalStatus: 'not-ready',
      rolloutStatus: 'held',
    });
  });

  it('expires evidence at the start of its expiry date and strictly before its timestamp boundary', () => {
    const profile = RELEASE_PROFILES['individual-scale'];
    const target = TARGETS[profile.id];
    const expiring = (expiresAt: string) => technical(target).map((item) => ({ ...item, expiresAt }));

    expect(evaluateReleaseProfile(profile.id, expiring('2026-10-02'), AS_OF, target).technicalStatus).toBe('not-ready');
    expect(evaluateReleaseProfile(
      profile.id,
      expiring('2026-10-02T07:00:00-05:00'),
      '2026-10-02T12:00:00Z',
      target,
    ).technicalStatus).toBe('not-ready');
    expect(evaluateReleaseProfile(
      profile.id,
      expiring('2026-10-02T07:00:00.001-05:00'),
      '2026-10-02T12:00:00Z',
      target,
    ).technicalStatus).toBe('ready');
    expect(evaluateReleaseProfile(
      profile.id,
      expiring('2026-10-02T07:00:00+24:00'),
      '2026-10-02T12:00:00Z',
      target,
    ).technicalStatus).toBe('not-ready');
  });

  it('rejects future-dated evidence and lets the latest denial override an older current record', () => {
    const profile = RELEASE_PROFILES['individual-scale'];
    const target = TARGETS[profile.id];
    const future = technical(target).map((item, index) => index === 0 ? { ...item, checkedAt: '2026-10-03' } : item);
    expect(evaluateReleaseProfile(profile.id, future, AS_OF, target).technicalStatus).toBe('not-ready');
    const revoked: ReleaseEvidence = {
      ...technical(target)[0], status: 'revoked', checkedAt: AS_OF, reference: 'repo:docs/PRODUCT-STATUS-MAP.md',
    };
    expect(evaluateReleaseProfile(profile.id, [...technical(target), revoked], AS_OF, target).technicalStatus).toBe('not-ready');
    const malformedRevocation: ReleaseEvidence = {
      ...technical(target)[0],
      status: 'revoked',
      checkedAt: '2026-10-02T12:00:00Z',
      expiresAt: 'never',
      reference: 'runtime://revocation/malformed-expiry',
    };
    expect(evaluateReleaseProfile(profile.id, [...technical(target), malformedRevocation], AS_OF, target).technicalStatus).toBe('not-ready');
    const malformedCheckedAt: ReleaseEvidence = {
      ...technical(target)[0],
      status: 'revoked',
      checkedAt: 'not-a-date',
      reference: 'runtime://revocation/malformed-checked-at',
    };
    expect(evaluateReleaseProfile(profile.id, [...technical(target), malformedCheckedAt], AS_OF, target).technicalStatus).toBe('not-ready');
    const timestamped = technical(target).map((item) => ({ ...item, checkedAt: '2026-10-02T10:00:00Z' }));
    expect(evaluateReleaseProfile(profile.id, timestamped, AS_OF, target).technicalStatus).toBe('ready');
    const offsetTimestamped = technical(target).map((item) => ({
      ...item, checkedAt: '2026-10-02T05:00:00-05:00', expiresAt: '2026-11-01T00:00:00.123456+00:00',
    }));
    expect(evaluateReleaseProfile(profile.id, offsetTimestamped, AS_OF, target).technicalStatus).toBe('ready');
    const invalidOffset = technical(target).map((item, index) => index === 0
      ? { ...item, checkedAt: '2026-10-02T05:00:00+24:00' }
      : item);
    expect(evaluateReleaseProfile(profile.id, invalidOffset, AS_OF, target).technicalStatus).toBe('not-ready');
  });

  it('binds every activation and dependency record to one exact release target', () => {
    const profile = RELEASE_PROFILES['institutional-pilot'];
    const target = TARGETS[profile.id];
    const evidence = [
      ...technical(target),
      ...profile.requiredActivationGates.map((gate) => runtime(gate, target)),
      ...profile.requiredDependencies.map((item) => dependency(item, target)),
    ];
    expect(evaluateReleaseProfile(profile.id, evidence, AS_OF).rolloutStatus).toBe('held');
    expect(evaluateReleaseProfile(profile.id, evidence, AS_OF, { ...target, tenantId: 'tenant-b' }).rolloutStatus).toBe('held');
    expect(evaluateReleaseProfile(profile.id, evidence, AS_OF, target).rolloutStatus).toBe('authorized');
    const killSwitchEngaged: ReleaseEvidence = {
      ...runtime('kill-switch-clear', target),
      status: 'revoked',
      checkedAt: '2026-10-02T12:00:00Z',
      reference: 'runtime://kill-switch/engaged',
    };
    expect(evaluateReleaseProfile(profile.id, [...evidence, killSwitchEngaged], AS_OF, target)).toMatchObject({
      rolloutStatus: 'held',
      missingActivation: expect.arrayContaining(['kill-switch-clear']),
    });
  });

  it('requires the intended environment and the exact tested source SHA', () => {
    const individual = RELEASE_PROFILES['individual-scale'];
    const target = TARGETS[individual.id];
    const activation = individual.requiredActivationGates.map((gate) => runtime(gate, target));
    const dependencies = individual.requiredDependencies.map((item) => dependency(item, target));
    const evidence = [...technical(target), ...activation, ...dependencies];
    expect(evaluateReleaseProfile(individual.id, evidence, AS_OF, { ...target, environment: 'pilot' }).rolloutStatus).toBe('held');
    const tenantScopedTarget = { ...target, tenantId: 'tenant-a', cohortId: 'cohort-a' };
    const tenantScopedEvidence = [
      ...technical(tenantScopedTarget),
      ...individual.requiredActivationGates.map((gate) => runtime(gate, tenantScopedTarget)),
      ...individual.requiredDependencies.map((item) => dependency(item, tenantScopedTarget)),
    ];
    expect(evaluateReleaseProfile(individual.id, tenantScopedEvidence, AS_OF, tenantScopedTarget)).toMatchObject({
      targetBound: false,
      rolloutStatus: 'held',
    });
    const staleSha = 'def456def456def456def456def456def456def4';
    expect(evaluateReleaseProfile(individual.id, evidence, AS_OF, { ...target, deployedSha: staleSha }).technicalStatus).toBe('not-ready');
    expect(evaluateReleaseProfile(individual.id, evidence, AS_OF, {
      ...target, deployedSha: target.deployedSha.toUpperCase(),
    })).toMatchObject({ targetBound: false, technicalStatus: 'not-ready', rolloutStatus: 'held' });
    const individualWriteEnabled = { ...target, registrationWriteback: 'production' as const };
    const individualWriteEvidence = [
      ...technical(individualWriteEnabled),
      ...individual.requiredActivationGates.map((gate) => runtime(gate, individualWriteEnabled)),
      ...individual.requiredDependencies.map((item) => dependency(item, individualWriteEnabled)),
    ];
    expect(evaluateReleaseProfile(individual.id, individualWriteEvidence, AS_OF, individualWriteEnabled)).toMatchObject({
      targetBound: false,
      rolloutStatus: 'held',
    });
    const pilot = RELEASE_PROFILES['institutional-pilot'];
    const pilotTarget = TARGETS[pilot.id];
    const writeEnabled = { ...pilotTarget, registrationWriteback: 'production' as const };
    const pilotEvidence = [
      ...technical(writeEnabled),
      ...pilot.requiredActivationGates.map((gate) => runtime(gate, writeEnabled)),
      ...pilot.requiredDependencies.map((item) => dependency(item, writeEnabled)),
    ];
    expect(evaluateReleaseProfile(pilot.id, pilotEvidence, AS_OF, writeEnabled)).toMatchObject({
      targetBound: false,
      rolloutStatus: 'held',
    });
  });

  it('keeps exact-SHA technical readiness separate from activation target completeness', () => {
    const profile = RELEASE_PROFILES['institutional-pilot'];
    const target = TARGETS[profile.id];
    const incomplete = { ...target, configurationVersion: '', tenantId: undefined, cohortId: undefined };
    expect(evaluateReleaseProfile(profile.id, technical(target), AS_OF, incomplete)).toMatchObject({
      technicalStatus: 'ready',
      rolloutStatus: 'held',
      targetBound: false,
    });
  });

  it('uses the current instant for live decisions instead of the end of the UTC day', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime('2026-10-02T08:00:00Z');
      const profile = RELEASE_PROFILES['individual-scale'];
      const target = TARGETS[profile.id];
      const evidence = technical(target).map((item) => ({
        ...item,
        checkedAt: '2026-10-02T20:00:00Z',
        expiresAt: '2026-10-03T00:00:00Z',
      }));
      expect(evaluateReleaseProfile(profile.id, evidence, undefined, target).technicalStatus).toBe('not-ready');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps prohibited institutional and financial claims out of broad individual use', () => {
    const individual = RELEASE_PROFILES['individual-scale'];
    expect(individual.forbiddenOperations).toEqual(expect.arrayContaining(['official registration', 'financial aid', 'payroll', 'general ledger']));
    expect(individual.claimBoundary).toMatch(/no institutional connection, certification, or system-of-record claim/i);
  });

  it('points every repository evidence record at a real file', () => {
    for (const item of REPOSITORY_RELEASE_EVIDENCE) {
      expect(item.reference.startsWith('repo:')).toBe(true);
      expect(item.expiresAt).toBe('2026-11-01');
      expect(existsSync(join(root, item.reference.slice('repo:'.length))), item.reference).toBe(true);
    }
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run npm run registers from app/`).toBe(rendered);
  });
});

function render(): string {
  const decisions = Object.values(RELEASE_PROFILES).map((profile) => evaluateReleaseProfile(profile.id, REPOSITORY_RELEASE_EVIDENCE, AS_OF));
  return [
    '# Market-motion release profiles', '',
    renderedFrom('app/src/lib/governance/release-profiles.ts', 'release-profiles.test.ts'), '', controlLine(DOC), '',
    'These executable profiles define an evidence-gated path from invitation-only individual validation through bounded pilots and enterprise contracting.',
    'They do not rename repository completion as deployment, participant or tenant approval, commercial authority, independent assurance, or live operation.', '',
    `## Repository snapshot decision (${AS_OF})`, '',
    ...table(['Profile', 'Technical candidate', 'Rollout', 'Still required'], decisions.map((decision) => [
      decision.profileId,
      decision.technicalStatus,
      decision.rolloutStatus,
      [
        ...decision.missingTechnical,
        ...decision.missingActivation,
        ...decision.missingDependencies.map((item) => `dependency:${item}`),
      ].join(', '),
    ])), '',
    'This historical source snapshot lists the technical evidence contract, but source references are not exact-SHA run records.',
    'All profiles therefore remain not ready in this evaluator until current run evidence names the evaluated commit. Rollout also',
    'requires deployment and the profile-specific participant, tenant, commercial, assurance, and approval records that do not live in source code.', '',
    '## Scope and boundaries', '',
    ...Object.values(RELEASE_PROFILES).flatMap((profile) => [
      `### ${profile.id}`, '',
      `**Audience:** ${profile.audience}`, '',
      `**Default:** ${profile.defaultOff ? 'off' : 'available after production release gates'}`, '',
      `**Capabilities:** ${profile.capabilityIds.map((id) => `\`${id}\``).join(', ')}`, '',
      `**Unsatisfied capability dependencies:** ${profile.requiredDependencies.length > 0 ? profile.requiredDependencies.map((item) => `\`${item}\``).join(', ') : 'none'}`, '',
      `**Allowed:** ${profile.allowedOperations.join('; ')}`, '',
      `**Forbidden:** ${profile.forbiddenOperations.join('; ')}`, '',
      `**Claim boundary:** ${profile.claimBoundary}`, '',
      `**Fallback:** ${profile.fallback}`, '',
    ]),
    '## Technical evidence contract', '',
    ...table(['Gate', 'Repository reference', 'Checked', 'Expires'], TECHNICAL_RELEASE_GATES.map((gate) => [
      gate,
      REPOSITORY_RELEASE_EVIDENCE.find((item) => item.gate === gate)?.reference ?? 'missing',
      REPOSITORY_RELEASE_EVIDENCE.find((item) => item.gate === gate)?.checkedAt ?? 'missing',
      REPOSITORY_RELEASE_EVIDENCE.find((item) => item.gate === gate)?.expiresAt ?? 'missing',
    ])), '',
    '## Activation boundary', '',
    '- This is a release-evidence evaluator, not runtime entitlement enforcement. The manual profile does not itself hide or block shared Account, Courses or Import surfaces; a deployment must separately enforce its configured entitlements.',
    '- Broad individual rollout remains held behind every invitation-validation gate plus a separate broad-rollout decision; the current product checkout hold independently disables new paid acquisition.',
    '- Invitation-only unpaid validation requires one named cohort, participant terms and consent, qualified legal/public-policy approval, representative-user acceptance, target account-lifecycle acceptance, qualified accessibility conformance, a staffed validation support roster, agreed outcomes and stop criteria, and a current non-institutional launch decision.',
    '- Either institutional pilot additionally needs a named agreement, data owner, approved data scope, cohort consent, tenant accessibility/security/privacy reviews, a live support route, a staffed support roster, agreed baseline, success, review, expansion and exit criteria, and a current target-bound `go` or `go-with-conditions` record re-derived from the canonical launch-readiness council evaluator.',
    '- A paid pilot additionally requires an approved design-partner activation and measured closeout; target-bound DAST, restore, incident/alert, data-rights, access-revocation and offboarding exercises; independent security assurance; qualified accessibility conformance; approved production providers; counsel-approved commercial paper; pricing and signing authority; tax/accounting/payment controls; a current insurance decision; and customer-side purchase and billing authorization.',
    '- A broad enterprise sale additionally requires a separate broad-sale decision, repeated customer deployments, accepted capacity and error budgets, and claim-specific reference permission.',
    '- Activation and dependency decisions count only when a secure trust-room, vault or ticket artifact names every required approval function; arbitrary strings cannot authorize rollout.',
    '- Every technical record must name the exact 40-character source SHA exercised by that gate; repository file references alone are not run evidence.',
    '- Every activation and dependency record must match one environment, deployed SHA, configuration version and, for a pilot, one tenant, cohort and explicit manual or connected data mode. Mixed-target evidence fails closed.',
    '- Canonical external and out-of-scope capability dependencies are activation requirements; green generic gates cannot bypass them.',
    '- CAP-050 is admitted only for search, comparison, validation, and official-system handoff. Enrollment, waitlist, drop, withdrawal, and SIS writes remain prohibited.',
    '- No profile activates financial aid, payments, payroll, general ledger, official grading, certification, or system-of-record authority.', '',
  ].join('\n');
}
