import type { Assumptions, AssumptionKey, FieldSpec, Group, Source, Unit, ValidationIssue } from './financialModelTypes';

/**
 * The model's inputs, their bounds, and where each default came from.
 *
 * Source key:
 *   brief        the founder's planning assumption (docs/business/finance/PRICING_AND_PACKAGING.md)
 *   repo         a figure the repository already carries (named in `note`)
 *   placeholder  no figure exists anywhere; replace with the company's own
 *   assumption   a modelling choice with no external evidence
 *
 * None is an approved price, budget or target. Prices in particular conflict
 * across the repository (D-134, D-1154, the brief); the model treats them as
 * inputs to compare, not as a price book.
 */

const f = (
  key: AssumptionKey,
  label: string,
  group: Group,
  unit: Unit,
  def: number,
  min: number,
  max: number,
  step: number,
  source: Source,
  note: string,
  integer = false,
): FieldSpec => ({ key, label, group, unit, default: def, min, max, step, source, note, integer });

const PRICES = 'Founder planning assumption; not an approved price (CLM-015).';

export const FIELDS: readonly FieldSpec[] = [
  // Pricing
  f('studentPremiumMonthly', 'Student Premium, monthly price', 'Pricing', 'usd', 8.99, 0, 100, 0.01, 'brief', `${PRICES} D-134 recorded $7.99 and D-1154 recorded $15; none is approved.`),
  f('studentPremiumAnnual', 'Student Premium, annual price', 'Pricing', 'usd', 69, 0, 1000, 1, 'brief', `${PRICES} D-134 recorded $59.`),
  f('annualPlanShare', 'Share of premium subscribers on the annual plan', 'Pricing', 'pct', 0.5, 0, 1, 0.01, 'assumption', 'Blends the two prices into one monthly figure; annual prepayment timing is not modelled.'),
  f('platformPricePerStudent', 'Institutional platform, per enrolled student per year', 'Pricing', 'usd', 18, 0, 500, 0.5, 'brief', PRICES),
  f('platformAnnualMinimum', 'Institutional platform, annual minimum', 'Pricing', 'usd', 30000, 0, 1000000, 500, 'brief', PRICES),
  f('aiPoolPerStudentYear', 'Governed AI requests included, per enrolled student per year', 'Pricing', 'count', 2400, 0, 100000, 100, 'brief', 'Pooled; 2,400 a year is 200 a month on average.'),
  f('aiOveragePricePer1000', 'AI overage, per 1,000 governed requests', 'Pricing', 'usd', 30, 0, 1000, 1, 'brief', PRICES),
  f('implementationFee', 'Implementation fee, one-time per institution', 'Pricing', 'usd', 60000, 0, 500000, 1000, 'brief', 'Brief range is $35,000 to $150,000, set by integrations, migration, security review, configuration, training and rollout. A mid-range placeholder.'),
  f('premiumSupportPct', 'Premium support, share of annual platform fee', 'Pricing', 'pct', 0.15, 0, 1, 0.01, 'brief', PRICES),
  f('premiumSupportMinimum', 'Premium support, annual minimum', 'Pricing', 'usd', 15000, 0, 500000, 500, 'brief', PRICES),
  f('premiumSupportAttachRate', 'Share of institutions buying premium support', 'Pricing', 'pct', 0.3, 0, 1, 0.01, 'assumption', 'No evidence of demand; support staffing is not evidenced (GO-NO-GO priority 6).'),
  f('pilotFee', 'Pilot fee, per pilot', 'Pricing', 'usd', 20000, 0, 500000, 500, 'placeholder', 'No pilot price exists: docs/commercial/PILOT-OFFER.md says [APPROVED PRICE OR "NO-FEE DESIGN PARTNER"]. Set 0 to model a no-fee design partner.'),
  f('marketplaceEnabled', 'Include marketplace / partner revenue (1 yes, 0 no)', 'Pricing', 'flag', 0, 0, 1, 1, 'assumption', 'Modelled separately; the core business must work without it. Off by default.', true),
  f('marketplaceCommissionPct', 'Marketplace commission', 'Pricing', 'pct', 0.12, 0, 1, 0.01, 'brief', 'Optional partner revenue; needs counsel and tax review before any marketplace exists.'),
  f('marketplaceGmvPerActiveUserMonth', 'Marketplace volume per active student per month', 'Pricing', 'usd', 0.5, 0, 100, 0.1, 'placeholder', 'No marketplace exists; a placeholder to size the line.'),

  // Institution
  f('pilotCohortStudents', 'Pilot cohort size (students)', 'Institution', 'count', 150, 10, 200, 5, 'repo', 'docs/PAID-PILOT-FRAMEWORK.md bounds a pilot cohort to 10-200 as a checklist item; pilotReadiness in code does not enforce it.', true),
  f('annualScopeStudents', 'Enrolled students in an annual contract, per institution', 'Institution', 'count', 2500, 100, 100000, 100, 'assumption', 'Defines the platform fee. At the brief\'s $18, the $30,000 minimum binds below about 1,667 students.', true),
  f('pilotMonths', 'Pilot length (months)', 'Institution', 'months', 6, 1, 12, 1, 'repo', 'Code enforces 26 weeks (PILOT_WEEKS, D-134), about 6 months. The brief assumes 8-12 weeks. Open founder decision.', true),
  f('conversionLagMonths', 'Months from pilot end to annual start', 'Institution', 'months', 1, 0, 6, 1, 'assumption', 'Decision and paper time after the final value review.', true),
  f('pilotsPerMonthOverride', 'Pilots signed per month (0 = derive from the funnel)', 'Institution', 'count', 0, 0, 10, 0.1, 'assumption', 'Set above 0 to override the funnel with a fixed number from the paid-pilot gate month onward.'),

  // Funnel
  f('outreachAccountsPerMonth', 'Target accounts contacted per month', 'Funnel', 'count', 20, 0, 500, 1, 'assumption', 'Founder capacity, not a market measure. A 100-account list is 5 months at this rate.', true),
  f('replyRate', 'Contacted to reply', 'Funnel', 'pct', 0.2, 0, 1, 0.01, 'assumption', 'Account-based outreach with a real reason; unvalidated.'),
  f('discoveryRate', 'Reply to discovery call', 'Funnel', 'pct', 0.6, 0, 1, 0.01, 'assumption', 'Unvalidated.'),
  f('qualificationRate', 'Discovery to qualified opportunity', 'Funnel', 'pct', 0.6, 0, 1, 0.01, 'assumption', 'Unvalidated.'),
  f('demoRate', 'Qualified to demo', 'Funnel', 'pct', 0.8, 0, 1, 0.01, 'assumption', 'Unvalidated.'),
  f('pilotDesignRate', 'Demo to pilot design session', 'Funnel', 'pct', 0.7, 0, 1, 0.01, 'assumption', 'Unvalidated.'),
  f('proposalRate', 'Design session to proposal', 'Funnel', 'pct', 0.8, 0, 1, 0.01, 'assumption', 'Unvalidated.'),
  f('pilotCloseRate', 'Proposal to signed pilot', 'Funnel', 'pct', 0.4, 0, 1, 0.01, 'assumption', 'Unvalidated; held by the go/no-go until the paid-pilot gate flips.'),
  f('pilotActivationRate', 'Signed pilot to activated pilot', 'Funnel', 'pct', 0.9, 0, 1, 0.01, 'assumption', 'Activation needs tenant, data scope and sponsor in place.'),
  f('pilotSuccessRate', 'Activated pilot to success criteria met', 'Funnel', 'pct', 0.7, 0, 1, 0.01, 'assumption', 'Success is defined in writing before the pilot starts.'),
  f('pilotToAnnualConversion', 'Successful pilot to annual contract', 'Funnel', 'pct', 0.6, 0, 1, 0.01, 'assumption', 'Pilot-to-annual conversion rate on successful pilots; the end-to-end yield is shown beside the results.'),
  f('directAnnualShare', 'Share of closes that skip the pilot and sign annual', 'Funnel', 'pct', 0, 0, 1, 0.01, 'assumption', 'Annual-contract-heavy scenarios raise this. A direct annual deal still pays an implementation fee.'),
  f('directAnnualExtraCycleMonths', 'Extra sales-cycle months for a direct annual deal', 'Funnel', 'months', 3, 0, 12, 1, 'assumption', 'Procurement for a multi-year-style order is slower than for a pilot.', true),
  f('salesCycleMonths', 'Sales cycle, first contact to signed pilot (months)', 'Funnel', 'months', 6, 1, 24, 1, 'assumption', 'Higher-ed procurement is slow; unvalidated.', true),
  f('firstPaidPilotMonth', 'First month a paid pilot may be signed', 'Funnel', 'months', 7, 1, 36, 1, 'assumption', 'Paid institutional pilot is NO-GO/RED today (GO-NO-GO-DECISION.md). Deals ready earlier wait for this month.', true),
  f('paymentTermsDays', 'Customer payment terms (days)', 'Funnel', 'days', 45, 0, 180, 5, 'assumption', 'Collections lag the invoice by this many days, rounded to whole months.', true),

  // Students
  f('studentInviteRate', 'Enrolled students invited', 'Students', 'pct', 0.7, 0, 1, 0.01, 'assumption', 'Share of the in-scope population that receives an invitation.'),
  f('studentActivationRate', 'Invited students who activate', 'Students', 'pct', 0.5, 0, 1, 0.01, 'repo', 'The repository defines activation as completing the core job within 7 days; 50% is the existing finance model\'s hypothesis (docs/finance/assumption-register.md A-008).'),
  f('studentPremiumConversion', 'Newly activated students who buy Premium', 'Students', 'pct', 0.03, 0, 1, 0.005, 'assumption', 'Institutional students already have the platform; Premium is an individual upgrade. Unvalidated.'),
  f('directPremiumSignupsPerMonth', 'Direct Premium sign-ups per month, outside institutions', 'Students', 'count', 0, 0, 10000, 5, 'assumption', 'Individual acquisition is invitation-only and unpaid today (GO-NO-GO-DECISION.md), so 0.'),
  f('studentMonthlyChurn', 'Premium subscriber monthly churn', 'Students', 'pct', 0.08, 0, 1, 0.005, 'repo', 'docs/finance/assumption-register.md A-015 (8% a month, a hypothesis).'),
  f('studentPaymentFeePct', 'Payment and app-store fees, share of Premium revenue', 'Students', 'pct', 0.06, 0, 0.5, 0.005, 'assumption', 'Blends card fees and app-store commission (assumption-register A-019 to A-022).'),

  // Retention
  f('institutionRetention', 'Institution annual logo retention', 'Retention', 'pct', 0.85, 0, 1, 0.01, 'assumption', 'No renewal has ever happened. Use ranges until retention data exists.'),
  f('expansionRate', 'Annual expansion of retained institutions', 'Retention', 'pct', 0.1, 0, 2, 0.01, 'assumption', 'Growth in enrolled scope at renewal. Unvalidated.'),

  // Unit costs
  f('cloudCostPerActiveUserMonth', 'Cloud cost per active user per month', 'Unit costs', 'usd', 0.21, 0, 50, 0.01, 'repo', 'docs/finance/03-COST-MODEL.md: $0.212 platform cost per active user per month, excluding AI and support. A hypothesis.'),
  f('aiRequestsPerActiveUserMonth', 'Governed AI requests per active student per month', 'Unit costs', 'count', 60, 0, 5000, 5, 'assumption', 'Usage is unmeasured. The included pool averages 200 per enrolled student per month.'),
  f('aiCostPerRequest', 'AI cost per governed request', 'Unit costs', 'usd', 0.0146, 0, 5, 0.0001, 'repo', 'docs/finance/03-COST-MODEL.md: $0.0146 per action with overhead, from illustrative vendor list prices to verify.'),
  f('aiIncludedRevenueShare', 'Share of platform, pilot and Premium revenue treated as funding included AI', 'Unit costs', 'pct', 0.2, 0, 1, 0.01, 'assumption', 'Drives the AI warning: AI cost should be covered by overage revenue plus this included share. A management choice, not a price.'),
  f('supportCostPerCustomerMonth', 'Support cost per institution per month', 'Unit costs', 'usd', 500, 0, 50000, 50, 'assumption', 'Staffed support is not evidenced (GO-NO-GO priority 6).'),

  // Implementation
  f('implementationHoursPerProject', 'Delivery hours per implementation', 'Implementation', 'hours', 400, 0, 5000, 20, 'assumption', 'Integration, configuration, security review, training and rollout.'),
  f('implementationMonths', 'Months an implementation takes', 'Implementation', 'months', 2, 1, 12, 1, 'assumption', 'Delivery effort is spread evenly across these months.', true),
  f('implementationThirdPartyCost', 'Third-party cost per implementation', 'Implementation', 'usd', 3000, 0, 200000, 500, 'assumption', 'Tooling, review fees or travel specific to a deployment.'),
  f('contractorHourlyCost', 'Contractor cost per delivery hour', 'Implementation', 'usd', 90, 0, 1000, 5, 'assumption', 'Used for hours the delivery team cannot absorb.'),
  f('deliveryHoursPerFtePerMonth', 'Billable delivery hours per delivery head per month', 'Implementation', 'hours', 120, 1, 200, 5, 'assumption', 'Capacity of one delivery head.'),

  // Headcount
  f('headsFoundersY1', 'Founders, model year 1', 'Headcount', 'count', 1, 0, 20, 1, 'repo', 'One founder today (docs/company/).', true),
  f('headsFoundersY2', 'Founders, model year 2', 'Headcount', 'count', 1, 0, 20, 1, 'assumption', '', true),
  f('headsFoundersY3', 'Founders, model year 3', 'Headcount', 'count', 1, 0, 20, 1, 'assumption', '', true),
  f('headsEngineeringY1', 'Engineering heads, model year 1', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', 'Engineering is founder-led in year 1 in this lean default.', true),
  f('headsEngineeringY2', 'Engineering heads, model year 2', 'Headcount', 'count', 1, 0, 50, 1, 'assumption', '', true),
  f('headsEngineeringY3', 'Engineering heads, model year 3', 'Headcount', 'count', 1, 0, 50, 1, 'assumption', '', true),
  f('headsSalesY1', 'Sales heads, model year 1', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', 'Founder-led sales in year 1.', true),
  f('headsSalesY2', 'Sales heads, model year 2', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', '', true),
  f('headsSalesY3', 'Sales heads, model year 3', 'Headcount', 'count', 1, 0, 50, 1, 'assumption', '', true),
  f('headsDeliveryY1', 'Delivery and success heads, model year 1', 'Headcount', 'count', 1, 0, 50, 1, 'assumption', 'Implementation and customer success.', true),
  f('headsDeliveryY2', 'Delivery and success heads, model year 2', 'Headcount', 'count', 1, 0, 50, 1, 'assumption', '', true),
  f('headsDeliveryY3', 'Delivery and success heads, model year 3', 'Headcount', 'count', 2, 0, 50, 1, 'assumption', '', true),
  f('headsAdminY1', 'Admin and finance heads, model year 1', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', '', true),
  f('headsAdminY2', 'Admin and finance heads, model year 2', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', '', true),
  f('headsAdminY3', 'Admin and finance heads, model year 3', 'Headcount', 'count', 0, 0, 50, 1, 'assumption', '', true),
  f('founderLoadedMonthly', 'Founder, loaded monthly cost', 'Headcount', 'usd', 5000, 0, 50000, 250, 'placeholder', 'A modest draw; replace with the real figure. Loaded means including employer burden (about 20% in the finance model, A-004).'),
  f('engineeringLoadedMonthly', 'Engineer, loaded monthly cost', 'Headcount', 'usd', 10000, 0, 50000, 250, 'assumption', 'Replace with a quote or offer.'),
  f('salesLoadedMonthly', 'Sales head, loaded monthly cost', 'Headcount', 'usd', 9000, 0, 50000, 250, 'assumption', 'Replace with a quote or offer.'),
  f('deliveryLoadedMonthly', 'Delivery head, loaded monthly cost', 'Headcount', 'usd', 7500, 0, 50000, 250, 'assumption', 'Replace with a quote or offer.'),
  f('adminLoadedMonthly', 'Admin head, loaded monthly cost', 'Headcount', 'usd', 6500, 0, 50000, 250, 'assumption', 'Replace with a quote or offer.'),
  f('founderSalesShare', 'Share of founder cost counted as sales and marketing', 'Headcount', 'pct', 0.5, 0, 1, 0.05, 'assumption', 'Feeds CAC. Founder-led sales is a real acquisition cost.'),
  f('wageInflation', 'Annual wage inflation from model year 2', 'Headcount', 'pct', 0.03, 0, 0.5, 0.005, 'repo', 'docs/finance/assumption-register.md A-003.'),

  // Operating expense
  f('contractorMonthly', 'Baseline contractor spend per month', 'Operating expense', 'usd', 3000, 0, 500000, 250, 'assumption', 'Design, content, part-time help. Delivery overflow is costed separately.'),
  f('marketingMonthly', 'Marketing spend per month', 'Operating expense', 'usd', 3000, 0, 500000, 250, 'assumption', 'No broad paid acquisition until the offer and conversion path are validated.'),
  f('legalComplianceMonthly', 'Legal and compliance per month', 'Operating expense', 'usd', 2500, 0, 500000, 250, 'assumption', 'Ongoing counsel and compliance tooling. One-time items are under Required obligations.'),
  f('insuranceMonthly', 'Insurance per month', 'Operating expense', 'usd', 800, 0, 100000, 50, 'placeholder', 'Replace with a broker quote; no coverage is evidenced.'),
  f('accountingMonthly', 'Accounting and tax per month', 'Operating expense', 'usd', 600, 0, 100000, 50, 'placeholder', 'Replace with an accountant quote; none is engaged.'),
  f('softwareMonthly', 'Software and vendors per month', 'Operating expense', 'usd', 1500, 0, 100000, 50, 'assumption', 'Tools not counted in cost of revenue.'),
  f('travelEventsMonthly', 'Travel and events per month', 'Operating expense', 'usd', 1000, 0, 100000, 50, 'assumption', 'Counted in sales and marketing.'),
  f('otherAdminMonthly', 'Other general and administrative per month', 'Operating expense', 'usd', 500, 0, 100000, 50, 'assumption', ''),

  // Required obligations
  f('obligationSecurityAmount', 'Independent security assessment', 'Required obligations', 'usd', 30000, 0, 1000000, 500, 'placeholder', 'GO-NO-GO priority 2. No quote exists.'),
  f('obligationSecurityMonth', 'Independent security assessment, month paid', 'Required obligations', 'months', 6, 1, 36, 1, 'assumption', '', true),
  f('obligationAccessibilityAmount', 'Qualified accessibility review', 'Required obligations', 'usd', 15000, 0, 1000000, 500, 'placeholder', 'GO-NO-GO priority 3. No quote exists.'),
  f('obligationAccessibilityMonth', 'Accessibility review, month paid', 'Required obligations', 'months', 6, 1, 36, 1, 'assumption', '', true),
  f('obligationCounselAmount', 'Counsel for pilot paper, DPA and public policies', 'Required obligations', 'usd', 20000, 0, 1000000, 500, 'placeholder', 'GO-NO-GO priority 4. No engagement exists.'),
  f('obligationCounselMonth', 'Counsel, month paid', 'Required obligations', 'months', 4, 1, 36, 1, 'assumption', '', true),
  f('obligationEntityInsuranceAmount', 'Entity, tax set-up and insurance premium', 'Required obligations', 'usd', 8000, 0, 1000000, 500, 'placeholder', 'GO-NO-GO priority 5.'),
  f('obligationEntityInsuranceMonth', 'Entity and insurance, month paid', 'Required obligations', 'months', 2, 1, 36, 1, 'assumption', '', true),

  // Cash
  f('openingCash', 'Opening cash', 'Cash', 'usd', 100000, -10000000, 100000000, 1000, 'placeholder', 'PLACEHOLDER. No company cash is evidenced in the repository; enter the reconciled bank balance.'),
  f('fundingAmount', 'Funding received', 'Cash', 'usd', 0, 0, 100000000, 1000, 'assumption', 'A grant, loan or round, if one is expected. 0 means none.'),
  f('fundingMonth', 'Funding, month received', 'Cash', 'months', 6, 1, 36, 1, 'assumption', '', true),

  // Thresholds
  f('grossMarginThreshold', 'Gross-margin warning threshold', 'Thresholds', 'pct', 0.65, 0, 1, 0.01, 'assumption', 'A management threshold, not a target.'),
  f('runwayThresholdMonths', 'Runway warning threshold (months)', 'Thresholds', 'months', 12, 1, 60, 1, 'assumption', 'A management threshold, not a target.', true),
];

const bySpec = new Map<AssumptionKey, FieldSpec>(FIELDS.map((s) => [s.key, s]));

export const fieldFor = (key: AssumptionKey): FieldSpec => {
  const spec = bySpec.get(key);
  if (!spec) throw new Error(`No field spec for ${key}`);
  return spec;
};

/** The Base defaults, built from the registry so the two can never disagree. */
export const DEFAULT_ASSUMPTIONS: Assumptions = Object.freeze(
  Object.fromEntries(FIELDS.map((s) => [s.key, s.default])) as unknown as Assumptions,
);

export const GROUPS: readonly Group[] = [
  'Pricing',
  'Institution',
  'Funnel',
  'Students',
  'Retention',
  'Unit costs',
  'Implementation',
  'Headcount',
  'Operating expense',
  'Required obligations',
  'Cash',
  'Thresholds',
];

/** Fixed model start: the first month of the model, as YYYY-MM. Model years run from here. */
export const START_MONTH = '2026-11';

/**
 * Validate a full or partial assumption set. Errors stop the model from running
 * on the value; warnings let it run and say why the number deserves a second look.
 */
export function validate(values: Partial<Record<AssumptionKey, unknown>>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const spec of FIELDS) {
    if (!(spec.key in values)) continue;
    const raw = values[spec.key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      issues.push({ key: spec.key, severity: 'error', message: `${spec.label} must be a number.` });
      continue;
    }
    if (raw < spec.min || raw > spec.max) {
      issues.push({ key: spec.key, severity: 'error', message: `${spec.label} must be between ${spec.min} and ${spec.max}.` });
      continue;
    }
    if (spec.integer && !Number.isInteger(raw)) {
      issues.push({ key: spec.key, severity: 'error', message: `${spec.label} must be a whole number.` });
    }
  }

  const n = (k: AssumptionKey): number | null => {
    const v = values[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const impl = n('implementationFee');
  if (impl !== null && impl > 0 && (impl < 35000 || impl > 150000)) {
    issues.push({ key: 'implementationFee', severity: 'warning', message: 'Implementation fee is outside the brief\'s $35,000 to $150,000 planning range.' });
  }
  const months = n('pilotMonths');
  if (months !== null && months !== 6) {
    issues.push({ key: 'pilotMonths', severity: 'warning', message: 'The code enforces a 26-week pilot (about 6 months, D-134). Any other length is an assumption pending a founder decision.' });
  }
  const minimum = n('platformAnnualMinimum');
  if (minimum !== null && minimum !== 30000) {
    issues.push({ key: 'platformAnnualMinimum', severity: 'warning', message: 'The brief\'s planning assumption for the annual minimum is $30,000.' });
  }
  const cycle = n('salesCycleMonths');
  const gate = n('firstPaidPilotMonth');
  if (cycle !== null && gate !== null && gate > 36) {
    issues.push({ key: 'firstPaidPilotMonth', severity: 'error', message: 'The first paid pilot month cannot fall after the model horizon.' });
  }
  return issues;
}

export const hasErrors = (issues: readonly ValidationIssue[]): boolean => issues.some((i) => i.severity === 'error');

/** Merge a scenario patch onto Base, then onto the founder's edits. */
export function withOverrides(base: Assumptions, ...layers: Partial<Assumptions>[]): Assumptions {
  return Object.assign({}, base, ...layers) as Assumptions;
}
