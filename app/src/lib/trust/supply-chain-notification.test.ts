import { describe, expect, it } from 'vitest';
import { assessAdvisoryImpact } from '../supplychain';
import { routeSupplyChainNotice } from './supply-chain-notification';

const advisory = {
  advisoryId: 'GHSA-test-5678',
  packageName: 'example-package',
  installedVersion: '2.0.0',
  detectedAt: '2026-10-29T18:00:00Z',
  lockfile: 'app',
} as const;

const incomplete = assessAdvisoryImpact(advisory);
const complete = assessAdvisoryImpact({
  ...advisory,
  serviceImpact: {
    services: ['web-application'],
    evidence: 'SBOM sha256:abc plus import trace run 40984628690',
  },
  tenantReach: {
    scope: 'named-tenants',
    tenantIds: ['tenant-001'],
    evidence: 'authoritative deployment inventory export evidence-2026-10-29',
  },
});

describe('supply-chain notification routing', () => {
  it('stays undetermined without an authorized notification basis', () => {
    const route = routeSupplyChainNotice({ assessment: incomplete });
    expect(route.state).toBe('undetermined');
    if (route.state !== 'undetermined') throw new Error('expected undetermined route');
    expect(route.blockers).toEqual(expect.arrayContaining([
      expect.stringMatching(/notification basis/i),
      expect.stringMatching(/package-to-service/i),
      expect.stringMatching(/tenant reach/i),
    ]));
    expect(route.customerNoticeSent).toBe(false);
  });

  it('requires complete service and tenant evidence before confirmed impact can route a notice', () => {
    const trigger = {
      kind: 'confirmed-impact',
      decidedBy: 'Legal',
      evidence: 'Incident IR-42 confirmed the affected workflow and tenant exposure.',
    } as const;
    expect(routeSupplyChainNotice({ assessment: incomplete, trigger })).toMatchObject({
      state: 'undetermined',
      blockers: expect.arrayContaining([expect.stringMatching(/assessment.*complete/i)]),
      customerNoticeSent: false,
    });

    const route = routeSupplyChainNotice({ assessment: complete, trigger });
    expect(route).toMatchObject({
      state: 'notice-required',
      audience: 'security',
      exposure: 'Confirmed',
      basis: 'confirmed-impact',
      requiredApprovers: ['Security owner', 'Legal'],
      notifyInstitution: true,
      customerNoticeSent: false,
      unresolvedAssessmentBlockers: [],
    });
  });

  it('routes an evidenced contractual duty while preserving unknown impact', () => {
    const route = routeSupplyChainNotice({
      assessment: incomplete,
      trigger: {
        kind: 'contractual-duty',
        decidedBy: 'Privacy owner',
        evidence: 'Counsel decision LD-7 says the uncertainty meets the contract notice clause.',
      },
    });
    expect(route).toMatchObject({
      state: 'notice-required',
      audience: 'security',
      exposure: 'Unknown',
      basis: 'contractual-duty',
      customerNoticeSent: false,
    });
    if (route.state !== 'notice-required') throw new Error('expected notice route');
    expect(route.unresolvedAssessmentBlockers).toEqual(incomplete.blockers);
  });

  it('requires an exact deadline for a regulatory-duty route', () => {
    const base = {
      assessment: incomplete,
      trigger: {
        kind: 'regulatory-duty',
        decidedBy: 'Legal',
        evidence: 'Counsel decision LD-8 identifies a notification deadline.',
      },
    } as const;
    expect(() => routeSupplyChainNotice(base as never)).toThrow(/deadline/i);
    expect(() => routeSupplyChainNotice({
      assessment: incomplete,
      trigger: { ...base.trigger, deadline: 'sometime tomorrow' },
    })).toThrow(/deadline/i);
    const route = routeSupplyChainNotice({
      assessment: incomplete,
      trigger: { ...base.trigger, deadline: '2026-10-30T17:00:00Z' },
    });
    expect(route).toMatchObject({ state: 'notice-required', deadline: '2026-10-30T17:00:00Z', exposure: 'Unknown' });
  });

  it('routes an authorized uncertainty decision without pretending impact is known', () => {
    const route = routeSupplyChainNotice({
      assessment: incomplete,
      trigger: {
        kind: 'authorized-uncertainty',
        decidedBy: 'Legal',
        evidence: 'Decision LD-9 records that unresolved reachability itself requires notice.',
      },
    });
    expect(route).toMatchObject({
      state: 'notice-required',
      basis: 'authorized-uncertainty',
      exposure: 'Unknown',
      deadline: null,
      customerNoticeSent: false,
    });
    if (route.state !== 'notice-required') throw new Error('expected notice route');
    expect(route.unresolvedAssessmentBlockers).toEqual(incomplete.blockers);
  });

  it('rejects empty evidence, placeholders, and unauthorized decision makers', () => {
    expect(() => routeSupplyChainNotice({
      assessment: complete,
      trigger: { kind: 'confirmed-impact', decidedBy: 'Legal', evidence: ' ' },
    })).toThrow(/evidence/i);
    expect(() => routeSupplyChainNotice({
      assessment: complete,
      trigger: { kind: 'confirmed-impact', decidedBy: 'Legal', evidence: 'See [incident]' },
    })).toThrow(/placeholder/i);
    expect(() => routeSupplyChainNotice({
      assessment: complete,
      trigger: { kind: 'confirmed-impact', decidedBy: 'Founder', evidence: 'Incident IR-42' } as never,
    })).toThrow(/authorized/i);
  });

  it('does not turn a no-active-tenants assessment into confirmed customer impact', () => {
    const noActiveTenants = assessAdvisoryImpact({
      ...advisory,
      serviceImpact: { services: ['web-application'], evidence: 'Import trace run 40984628690' },
      tenantReach: { scope: 'no-active-tenants', evidence: 'Authoritative deployment inventory export' },
    });
    expect(routeSupplyChainNotice({
      assessment: noActiveTenants,
      trigger: { kind: 'confirmed-impact', decidedBy: 'Legal', evidence: 'Incident IR-43' },
    })).toMatchObject({
      state: 'undetermined',
      blockers: expect.arrayContaining([expect.stringMatching(/no active tenants/i)]),
    });
  });
});
