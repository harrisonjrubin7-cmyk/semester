import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT_PLANS } from './exitplans';
import { PARTIES } from './subprocessors';
import { SUPPLIER_RISK_PLANS, renderSupplierRiskPlan } from './supplier-risk-plan';

const register = () => readFileSync(join(process.cwd(), '..', 'docs', 'trust', 'VENDOR-RISK-REGISTER.md'), 'utf8');
const subprocessors = PARTIES.filter((party) => party.kind === 'subprocessor');

describe('the proposed supplier-risk ownership plan', () => {
  it('covers every Semester subprocessor exactly once, and no other party', () => {
    expect(SUPPLIER_RISK_PLANS.map((plan) => plan.party).sort()).toEqual(subprocessors.map((party) => party.name).sort());
  });

  it('keeps proposed ownership distinct from an accepted or completed review', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const plan of SUPPLIER_RISK_PLANS) {
      expect(plan.status, plan.party).toBe('proposed');
      expect(plan.proposedOwner, plan.party).not.toBe(plan.proposedBackup);
      expect(plan.proposedOwner.trim().length, plan.party).toBeGreaterThan(0);
      expect(plan.proposedBackup.trim().length, plan.party).toBeGreaterThan(0);
      expect(plan.reviewTarget, plan.party).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(plan.reviewTarget >= today, `${plan.party} review target is overdue`).toBe(true);
    }
  });

  it('uses the risk tiers already disclosed in the vendor register', () => {
    for (const plan of SUPPLIER_RISK_PLANS) {
      const row = register().split('\n').find((line) => line.startsWith(`| ${plan.party} | Subprocessor |`));
      expect(row, plan.party).toBeDefined();
      expect(row, plan.party).toMatch(new RegExp(`\\| ${plan.riskTier} \\| \\| \\|$`));
    }
  });

  it('links every proposed owner row to its existing tested exit plan', () => {
    expect(SUPPLIER_RISK_PLANS.map((plan) => plan.party).sort()).toEqual(EXIT_PLANS.map((plan) => plan.party).sort());
  });

  it('never promotes a proposed seat or target into authoritative review fields', () => {
    const authoritative = register().slice(register().indexOf('## The register'));
    for (const plan of SUPPLIER_RISK_PLANS) {
      const row = authoritative.split('\n').find((line) => line.startsWith(`| ${plan.party} | Subprocessor |`));
      const cells = row?.split('|').slice(1, -1).map((cell) => cell.trim());
      expect(cells?.[7], `${plan.party} authoritative owner`).toBe('');
      expect(cells?.[8], `${plan.party} authoritative review date`).toBe('');
    }
  });

  it('renders the held planning overlay verbatim in the vendor register', () => {
    expect(register()).toContain(renderSupplierRiskPlan());
    expect(register()).toContain('Proposed seats are not assignments or sign-offs');
  });
});
