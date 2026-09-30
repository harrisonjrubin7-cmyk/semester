import { describe, expect, it } from 'vitest';
import type { Claim } from '../ops/claims';
import { capabilityDefinition, type MaturityLevel } from './capability-governance';
import { capabilityReadiness, permittedClaimStatuses, projectClaim, type ProjectionContext } from './projections';

const context = (productMaturity: MaturityLevel, over: Partial<ProjectionContext> = {}): ProjectionContext => ({
  productMaturity, tenantMaturity: null, activationClass: 'standard', evidence: 'current', namedPilot: false,
  generallyAvailable: false, ...over,
});
const statuses = (c: ProjectionContext) => [...permittedClaimStatuses(c)];

const claim = (status: Claim['status'], capabilityIds = ['CAP-001']): Claim => ({
  id: 'projection-fixture', claim: 'Projection fixture', scope: 'Tests projection behavior.', status,
  owner: 'product', pages: ['/'], audiences: ['students'], evidence: [], rows: ['STU-001'], capabilityIds,
});

describe('claim status ceilings', () => {
  it('moves through planned, preparation and built-tested without inventing tenant state', () => {
    expect(statuses(context('L0'))).toEqual(['planned']);
    expect(statuses(context('L1'))).toEqual(['planned']);
    expect(statuses(context('L2'))).toEqual(['planned', 'in-preparation']);
    expect(statuses(context('L3'))).toEqual(['planned', 'in-preparation', 'built-tested']);
    expect(statuses(context('L4', { activationClass: 'controlled' }))).toEqual(['planned', 'in-preparation', 'built-tested']);
  });

  it('allows standard GA at L3 only with current evidence and no tenant activation', () => {
    expect(statuses(context('L3', { generallyAvailable: true }))).toContain('available');
    expect(statuses(context('L3', { generallyAvailable: true, evidence: 'expired' }))).not.toContain('available');
    expect(statuses(context('L3', { generallyAvailable: true, tenantMaturity: 'L8' }))).not.toContain('available');
  });

  it('requires tenant maturity for controlled and high-risk operational words', () => {
    const controlled = (level: MaturityLevel, tenantMaturity: MaturityLevel | null, over: Partial<ProjectionContext> = {}) =>
      context(level, { activationClass: 'controlled', tenantMaturity, ...over });
    expect(statuses(controlled('L5', 'L5'))).toContain('institution-configured');
    expect(statuses(controlled('L6', 'L6', { namedPilot: true }))).toContain('limited-beta');
    expect(statuses(controlled('L8', 'L8', { generallyAvailable: true }))).toContain('available');
    expect(statuses(context('L7', { activationClass: 'high-risk', tenantMaturity: 'L7', generallyAvailable: true }))).not.toContain('available');
  });

  it('removes every tenant-operational word when evidence is not current', () => {
    for (const evidence of ['expired', 'revoked', 'missing'] as const) {
      const allowed = statuses(context('L9', { activationClass: 'high-risk', tenantMaturity: 'L9', namedPilot: true, generallyAvailable: true, evidence }));
      expect(allowed).not.toEqual(expect.arrayContaining(['institution-configured', 'limited-beta', 'available']));
    }
  });
});

describe('multi-capability projections', () => {
  it('uses the intersection, so the most restrictive capability wins', () => {
    const contexts: Record<string, ProjectionContext> = {
      'CAP-001': context('L3', { generallyAvailable: true }),
      'CAP-002': context('L2'),
    };
    const projected = projectClaim(claim('available', ['CAP-001', 'CAP-002']), [capabilityDefinition('CAP-001')!, capabilityDefinition('CAP-002')!], contexts);
    expect(projected).toMatchObject({ permitted: false, allowed: ['planned', 'in-preparation'] });
  });

  it('never upgrades the status stored on the claim', () => {
    const projected = projectClaim(claim('planned'), [capabilityDefinition('CAP-001')!], {
      'CAP-001': context('L9', { generallyAvailable: true }),
    });
    expect(projected.permitted).toBe(true);
    expect(claim('planned').status).toBe('planned');
  });

  it('fails closed for an unknown binding and exposes capability readiness', () => {
    expect(projectClaim(claim('planned', ['CAP-999']), [], {})).toMatchObject({ permitted: false, allowed: [] });
    const capability = capabilityDefinition('CAP-001')!;
    expect(capabilityReadiness(capability, context('L3')).capabilityId).toBe('CAP-001');
  });
});
