/**
 * The deal desk: who must approve an institutional deal, and what no deal may say.
 *
 * Hybrid pricing — student plans, institutional licences, implementation,
 * AI capacity, sponsors — turns chaotic when every deal is negotiated from a
 * blank page. So a deal is described as data, and `review` returns the
 * approvers it needs and the terms that are refused outright.
 *
 * The numbers in `DEAL_POLICY` are **proposed defaults**, not a price book:
 * no institutional price list exists in this repository, and finance owns
 * setting them. They are here so the rules have something to test against and
 * so the first real deal is reviewed against a written policy rather than
 * memory. Change them in one place, with finance's sign-off in the commit.
 *
 * See docs/operating-model/COMMERCIAL-GOVERNANCE.md.
 */

export type Approver = 'sales_lead' | 'finance' | 'ceo' | 'board' | 'implementation' | 'product' | 'legal' | 'security_privacy';

export interface DealPolicy {
  /** Minimum annual contract value by tier, in cents. */
  minimumAcvCents: Record<'pilot' | 'department' | 'campus' | 'system', number>;
  /** Discount (0–1) at or below which each approver suffices; above the last, refused. */
  discountLevels: readonly { upTo: number; approvers: readonly Approver[] }[];
  /** Pilot credit as a share of first-year value, at most. */
  maxPilotCredit: number;
  /** Longest pilot, in months, before it must convert or end. */
  maxPilotMonths: number;
  implementationFeeFloorCents: number;
  /** Extra discount per contract year beyond the first, and its cap. */
  multiYearStep: number;
  multiYearCap: number;
}

export const DEAL_POLICY: DealPolicy = {
  minimumAcvCents: { pilot: 1_500_000, department: 2_500_000, campus: 7_500_000, system: 20_000_000 },
  discountLevels: [
    { upTo: 0.10, approvers: ['sales_lead'] },
    { upTo: 0.20, approvers: ['sales_lead', 'finance'] },
    { upTo: 0.30, approvers: ['sales_lead', 'finance', 'ceo'] },
    { upTo: 0.40, approvers: ['sales_lead', 'finance', 'ceo', 'board'] },
  ],
  maxPilotCredit: 0.5,
  maxPilotMonths: 6,
  implementationFeeFloorCents: 1_000_000,
  multiYearStep: 0.03,
  multiYearCap: 0.09,
};

export interface Deal {
  tier: keyof DealPolicy['minimumAcvCents'];
  listAcvCents: number;
  /** Negotiated discount off list, 0–1, excluding the multi-year step. */
  discount: number;
  years: number;
  pilotCreditShare?: number;
  pilotMonths?: number;
  implementationFeeCents: number;
  /** Any term that would make part of the service free with no end date. */
  freeForever?: boolean;
  /** Custom engineering committed in the contract. */
  customWork?: boolean;
  /** Paper that departs from the standard order form, DPA or terms. */
  nonstandardTerms?: boolean;
  /** The deal changes what data flows, or which integrations are in scope. */
  scopeChangesData?: boolean;
  /** An AI/compute overage policy is written into the order. */
  aiOverageDefined: boolean;
  /** Scholarship, low-income, nonprofit or system pricing programme applied. */
  accessProgram?: 'scholarship' | 'low_income' | 'nonprofit' | 'system';
}

export interface DealReview {
  approvers: Approver[];
  refused: string[];
  /** Net annual value after negotiated and multi-year discount. */
  netAcvCents: number;
}

export function review(deal: Deal, policy: DealPolicy = DEAL_POLICY): DealReview {
  const refused: string[] = [];
  const approvers = new Set<Approver>();

  const multi = Math.min(Math.max(0, deal.years - 1) * policy.multiYearStep, policy.multiYearCap);
  const netAcvCents = Math.round(deal.listAcvCents * (1 - deal.discount) * (1 - multi));

  // Access programmes are approved discounts with their own rule, not a way round the ladder:
  // they still need finance, and they still count against the ladder.
  if (deal.accessProgram) approvers.add('finance');
  const level = policy.discountLevels.find((l) => deal.discount <= l.upTo + 1e-9);
  if (!level) refused.push(`Discount ${Math.round(deal.discount * 100)}% is above the highest approval level.`);
  else level.approvers.forEach((a) => approvers.add(a));

  if (netAcvCents < policy.minimumAcvCents[deal.tier]) {
    refused.push(`Net annual value is below the ${deal.tier} minimum.`);
  }
  if (deal.freeForever) refused.push('No “free forever” commitments.');
  if (!deal.aiOverageDefined) refused.push('The order must state the AI/compute overage policy.');
  const credit = deal.pilotCreditShare ?? 0;
  const creditOk = credit <= policy.maxPilotCredit;
  if (!creditOk) refused.push('Pilot credit exceeds the maximum share of first-year value.');
  // The fee may fall below the floor only as a waiver carried by a pilot credit
  // that is within its cap and at least as large as the amount waived.
  const shortfall = policy.implementationFeeFloorCents - deal.implementationFeeCents;
  if (shortfall > 0 && !(credit > 0 && creditOk && shortfall <= credit * netAcvCents)) {
    refused.push('Implementation fee is below the floor; waive it only as a pilot credit, which is capped.');
  }
  if ((deal.pilotMonths ?? 0) > policy.maxPilotMonths) refused.push('Pilot is longer than the maximum; it must convert or end.');

  approvers.add('implementation');
  if (deal.customWork) approvers.add('product');
  if (deal.nonstandardTerms) approvers.add('legal');
  if (deal.scopeChangesData) approvers.add('security_privacy');

  return { approvers: [...approvers], refused, netAcvCents };
}
