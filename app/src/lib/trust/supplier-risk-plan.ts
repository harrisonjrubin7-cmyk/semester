/**
 * A candidate ownership overlay for Semester's subprocessors.
 *
 * This is a planning constraint, not a vendor assessment or an assignment of
 * authority. The vendor register remains the source of truth for completed
 * reviews: its Owner and Last review cells stay blank until a human accepts
 * the work and the supporting vendor evidence is filed.
 */

export type SupplierRiskTier = 'High' | 'Medium';
export type SupplierRiskSeat = 'engineering' | 'finance' | 'operations' | 'privacy' | 'security';

export interface SupplierRiskPlan {
  /** Must match a `subprocessor` party exactly. */
  party: string;
  /** Must match the disclosed tier in the vendor risk register. */
  riskTier: SupplierRiskTier;
  /** Candidate accountable seat; nobody is assigned merely by this file. */
  proposedOwner: SupplierRiskSeat;
  /** Candidate independent backup seat. */
  proposedBackup: SupplierRiskSeat;
  /** Target for a human decision and evidence review, not a completed-review date. */
  reviewTarget: string;
  status: 'proposed';
}

export const SUPPLIER_RISK_PLANS: readonly SupplierRiskPlan[] = [
  { party: 'Supabase', riskTier: 'High', proposedOwner: 'security', proposedBackup: 'engineering', reviewTarget: '2027-03-31', status: 'proposed' },
  { party: 'GitHub Pages', riskTier: 'Medium', proposedOwner: 'engineering', proposedBackup: 'security', reviewTarget: '2027-03-31', status: 'proposed' },
  { party: 'Vercel', riskTier: 'High', proposedOwner: 'engineering', proposedBackup: 'security', reviewTarget: '2027-03-31', status: 'proposed' },
  { party: 'Anthropic (Semester’s key)', riskTier: 'High', proposedOwner: 'privacy', proposedBackup: 'security', reviewTarget: '2027-03-31', status: 'proposed' },
  { party: 'Stripe', riskTier: 'High', proposedOwner: 'finance', proposedBackup: 'security', reviewTarget: '2027-03-31', status: 'proposed' },
  { party: 'Resend', riskTier: 'Medium', proposedOwner: 'operations', proposedBackup: 'privacy', reviewTarget: '2027-03-31', status: 'proposed' },
];

/** The proposed overlay as a Markdown table, held verbatim in the register. */
export function renderSupplierRiskPlan(plans: readonly SupplierRiskPlan[] = SUPPLIER_RISK_PLANS): string {
  const rows = plans.map((plan) =>
    `| ${plan.party} | ${plan.riskTier} | \`${plan.proposedOwner}\` | \`${plan.proposedBackup}\` | ${plan.reviewTarget} | Proposed |`,
  );
  return [
    '| Party | Risk tier | Proposed owner seat | Proposed backup seat | Review target | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}
