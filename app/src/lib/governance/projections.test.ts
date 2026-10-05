import { describe, expect, it } from 'vitest';
import { CLAIMS, CLAIM_STATUSES, type Claim } from '../ops/claims';
import { EVIDENCE } from '../ops/evidence';
import { CAPABILITY_DEFINITIONS, MATURITY_LEVELS, type ActivationClass } from './capability-governance';
import { capabilityReadiness, permittedClaimStatuses, projectClaim, projectionEvidence, repositoryProjectionContext, type ProjectionContext } from './projections';

const context = (patch: Partial<ProjectionContext> = {}): ProjectionContext => ({
  productMaturity: 'L3', tenantMaturity: null, activationClass: 'standard',
  evidence: 'current', namedPilot: false, generallyAvailable: false, ...patch,
});
const operational = ['institution-configured', 'limited-beta', 'available'] as const;
const capability = CAPABILITY_DEFINITIONS[0];
const claim = (patch: Partial<Claim> = {}): Claim => ({ ...CLAIMS[0], capabilityIds: [capability.id], status: 'available', ...patch });

describe('claim status ceilings', () => {
  it.each(['L0', 'L1'] as const)('%s permits only planned', (productMaturity) => {
    expect([...permittedClaimStatuses(context({ productMaturity, generallyAvailable: true }))]).toEqual(['planned']);
  });
  it('L2 permits preparation but not tested or operational claims', () => {
    expect([...permittedClaimStatuses(context({ productMaturity: 'L2' }))]).toEqual(['planned', 'in-preparation']);
  });
  it.each(['L3', 'L4'] as const)('%s permits tested and explicitly available standard capability', (productMaturity) => {
    const c = context({ productMaturity });
    expect(permittedClaimStatuses(c).has('built-tested')).toBe(true);
    expect(permittedClaimStatuses(c).has('available')).toBe(false);
    expect(permittedClaimStatuses({ ...c, generallyAvailable: true }).has('available')).toBe(true);
    expect(permittedClaimStatuses({ ...c, generallyAvailable: true, requiresTenantActivation: true }).has('available')).toBe(false);
  });
  it.each(['controlled', 'high-risk'] as const)('%s cannot claim tenant operations at L3/L4 without tenant state', (activationClass) => {
    for (const productMaturity of ['L3', 'L4'] as const) {
      const allowed = permittedClaimStatuses(context({ activationClass, productMaturity, generallyAvailable: true, namedPilot: true }));
      operational.forEach((status) => expect(allowed.has(status)).toBe(false));
    }
  });
  it('L5 controlled needs both product and tenant approval to permit institution-configured', () => {
    const c = context({ productMaturity: 'L5', tenantMaturity: 'L5', activationClass: 'controlled' });
    expect(permittedClaimStatuses(c).has('institution-configured')).toBe(true);
    expect(permittedClaimStatuses({ ...c, tenantMaturity: null }).has('institution-configured')).toBe(false);
    expect(permittedClaimStatuses({ ...c, productMaturity: 'L3' }).has('institution-configured')).toBe(false);
  });
  it.each(['L6', 'L7'] as const)('%s permits limited beta only for a named tenant pilot', (maturity) => {
    const c = context({ productMaturity: maturity, tenantMaturity: maturity, activationClass: 'controlled', namedPilot: true });
    expect(permittedClaimStatuses(c).has('limited-beta')).toBe(true);
    expect(permittedClaimStatuses({ ...c, namedPilot: false }).has('limited-beta')).toBe(false);
  });
  it.each(['controlled', 'high-risk'] as const)('%s permits available at L8/L9 only with explicit GA and tenant state', (activationClass) => {
    for (const maturity of ['L8', 'L9'] as const) {
      const c = context({ productMaturity: maturity, tenantMaturity: maturity, activationClass, generallyAvailable: true });
      expect(permittedClaimStatuses(c).has('available')).toBe(true);
      expect(permittedClaimStatuses({ ...c, generallyAvailable: false }).has('available')).toBe(false);
      expect(permittedClaimStatuses({ ...c, tenantMaturity: null }).has('available')).toBe(false);
    }
  });
  it.each(['missing', 'expired', 'revoked'] as const)('%s evidence removes every operational status', (evidence) => {
    const c = context({ productMaturity: 'L9', tenantMaturity: 'L9', generallyAvailable: true, namedPilot: true, evidence });
    for (const activationClass of ['standard', 'controlled', 'high-risk'] as const) {
      operational.forEach((status) => expect(permittedClaimStatuses({ ...c, activationClass }).has(status)).toBe(false));
    }
  });
  it('high-risk never permits available below L8', () => {
    for (const maturity of MATURITY_LEVELS.slice(0, 8)) {
      expect(permittedClaimStatuses(context({ activationClass: 'high-risk', productMaturity: maturity, tenantMaturity: 'L9', generallyAvailable: true })).has('available')).toBe(false);
    }
  });
});

describe('canonical claim projections and readiness', () => {
  it('intersects statuses, including an expired capability and distinct operational states', () => {
    const other = CAPABILITY_DEFINITIONS[1];
    const multi = claim({ capabilityIds: [capability.id, other.id] });
    const contexts = { [capability.id]: context({ generallyAvailable: true }), [other.id]: context({ generallyAvailable: true, evidence: 'expired' }) };
    expect(projectClaim(multi, [capability, other], contexts)).toMatchObject({ permitted: false, allowed: ['planned', 'in-preparation', 'built-tested'] });
    expect(projectClaim(multi, [capability, other], { ...contexts, [other.id]: context({ productMaturity: 'L1' }) }).allowed).toEqual(['planned']);
    const pilot = { ...other, maturity: 'L7' as const, activationClass: 'controlled' as ActivationClass };
    expect(projectClaim(multi, [capability, pilot], { ...contexts, [other.id]: context({ productMaturity: 'L7', tenantMaturity: 'L7', activationClass: 'controlled', namedPilot: true }) }).allowed).toEqual(['planned', 'in-preparation', 'built-tested']);
  });
  it('rejects empty, unknown, duplicate or missing capability context bindings', () => {
    for (const capabilityIds of [[], ['CAP-999'], [capability.id, capability.id]]) {
      expect(projectClaim(claim({ capabilityIds }), CAPABILITY_DEFINITIONS, {}).permitted).toBe(false);
    }
    expect(projectClaim(claim(), CAPABILITY_DEFINITIONS, {}).reason).toMatch(/context/i);
  });
  it('does not let caller context raise canonical maturity, weaken class or bypass tenant configuration', () => {
    const controlled = CAPABILITY_DEFINITIONS.find((c) => c.activationClass === 'controlled')!;
    const result = capabilityReadiness(controlled, context({ productMaturity: 'L9', tenantMaturity: 'L9', generallyAvailable: true }));
    expect(result.productMaturity).toBe(controlled.maturity);
    expect(result.activationClass).toBe('controlled');
    expect(result.allowed).not.toContain('available');
    expect(capabilityReadiness({ ...capability, safeDefaultEligible: false }, context({ generallyAvailable: true })).allowed).not.toContain('available');
  });
  it('an activation denial removes operations; readiness never represents a new activation', () => {
    const activationDecision = { outcome: 'deny', reason: 'kill_switch_engaged', receipt: null, missing: [] } as const;
    const result = capabilityReadiness(capability, context({ generallyAvailable: true, activationDecision }));
    expect(result.allowed).not.toContain('available');
    expect(result.activationOutcome).toBe('deny');
    expect(result.reason).toContain('kill_switch_engaged');
    expect(capabilityReadiness(capability, context()).activationOutcome).toBeNull();
  });
  it('never promotes a stored claim, mutates claims, or treats repository evidence as tenant activation', () => {
    const before = JSON.stringify(CLAIMS);
    const contexts = Object.fromEntries(CAPABILITY_DEFINITIONS.map((c) => [c.id, repositoryProjectionContext(c, EVIDENCE, '2026-09-30', CLAIMS)]));
    for (const c of CLAIMS) {
      const projected = projectClaim(c, CAPABILITY_DEFINITIONS, contexts);
      expect(projected.allowed.every((s) => CLAIM_STATUSES.indexOf(s) >= CLAIM_STATUSES.indexOf(c.status))).toBe(true);
    }
    expect(JSON.stringify(CLAIMS)).toBe(before);
    expect(contexts[capability.id]).toMatchObject({ tenantMaturity: null, generallyAvailable: false, namedPilot: false });
  });
  it('uses only directly bound evidence and lets stale claim evidence defeat a fresh row record', () => {
    const fresh = { ...EVIDENCE[0], produced: '2026-09-01', validFor: 91, rows: [capability.masterRows[0]], claims: [] };
    const unrelated = { ...fresh, rows: ['UNRELATED'] };
    const stale = { ...fresh, id: 'stale-claim', produced: '2026-01-01', rows: [], claims: ['fixture'] };
    const fixture = claim({ id: 'fixture' });
    expect(repositoryProjectionContext(capability, [unrelated], '2026-09-30', [fixture]).evidence).toBe('missing');
    expect(repositoryProjectionContext(capability, [fresh], '2026-09-30', [fixture]).evidence).toBe('current');
    expect(repositoryProjectionContext(capability, [fresh, stale], '2026-09-30', [fixture]).evidence).toBe('expired');
  });
});

describe('dated evidence projection', () => {
  const record = { ...EVIDENCE[0], produced: '2026-09-01', validFor: 91 };
  it('uses the existing UTC evidence state, expires at midnight, and keeps the worst record', () => {
    expect(projectionEvidence([record], '2026-09-30')).toBe('current');
    expect(projectionEvidence([record], '2026-11-30')).toBe('expiring');
    expect(projectionEvidence([record], '2026-12-01')).toBe('expired');
    expect(projectionEvidence([record, { ...record, produced: '2026-01-01' }], '2026-09-30')).toBe('expired');
    expect(projectionEvidence([record], '2026-09-30', [record.id])).toBe('revoked');
    expect(projectionEvidence([], '2026-09-30')).toBe('missing');
  });
  it('fails closed for invalid, ambiguous or future dates and invalid validity', () => {
    for (const produced of ['2026-02-30', '2026-09-30T01:00:00', '2026-10-01', 'no date']) {
      expect(projectionEvidence([{ ...record, produced }], '2026-09-30')).toBe('missing');
    }
    expect(projectionEvidence([record], '2026-02-30')).toBe('missing');
    for (const validFor of [NaN, Infinity, -1, 1.5]) expect(projectionEvidence([{ ...record, validFor }], '2026-09-30')).toBe('missing');
  });
});
