/**
 * Types and the field registry for the GTM financial model.
 *
 * What this model is: a 36-month, driver-based planning tool for the founder,
 * run in the operations console on local sample data. Nothing in it is read
 * from a bank, a ledger or a billing system, so every output it produces is a
 * FORECAST. `Basis` exists so that stays visible: the engine tags every row
 * 'forecast', and `financialModel.test.ts` refuses a row tagged anything else
 * until a real actuals feed exists to justify it.
 *
 * Every input is a PLANNING ASSUMPTION unless its `source` says otherwise.
 * None is an approved price, budget or target (CLM-015; see
 * docs/business/finance/PRICING_AND_PACKAGING.md and
 * docs/business/finance/FINANCIAL_MODEL_SPEC.md).
 */

/** Whether a figure is measured or projected. Only 'forecast' is produced today. */
export type Basis = 'forecast' | 'actual';

export type Unit = 'usd' | 'pct' | 'count' | 'months' | 'days' | 'hours' | 'flag' | 'ratio';

export type Group =
  | 'Pricing'
  | 'Institution'
  | 'Funnel'
  | 'Students'
  | 'Retention'
  | 'Unit costs'
  | 'Implementation'
  | 'Headcount'
  | 'Operating expense'
  | 'Required obligations'
  | 'Cash'
  | 'Thresholds';

/** Where an input's default came from. Nothing here is a verified actual. */
export type Source =
  | 'brief'
  | 'repo'
  | 'placeholder'
  | 'assumption';

export interface FieldSpec {
  key: keyof Assumptions;
  label: string;
  group: Group;
  unit: Unit;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  default: number;
  source: Source;
  /** Where the default comes from, or what to replace it with. */
  note: string;
}

/** Every editable input is a number: a flag is 0 or 1, a year-indexed value is three keys. */
export interface Assumptions {
  // Pricing (planning assumptions from the founder's brief; not approved prices)
  studentPremiumMonthly: number;
  studentPremiumAnnual: number;
  annualPlanShare: number;
  platformPricePerStudent: number;
  platformAnnualMinimum: number;
  aiPoolPerStudentYear: number;
  aiOveragePricePer1000: number;
  implementationFee: number;
  premiumSupportPct: number;
  premiumSupportMinimum: number;
  premiumSupportAttachRate: number;
  pilotFee: number;
  marketplaceEnabled: number;
  marketplaceCommissionPct: number;
  marketplaceGmvPerActiveUserMonth: number;

  // Institution
  pilotCohortStudents: number;
  annualScopeStudents: number;
  pilotMonths: number;
  conversionLagMonths: number;
  pilotsPerMonthOverride: number;

  // Funnel (account-based; every rate is the share entering the next stage)
  outreachAccountsPerMonth: number;
  replyRate: number;
  discoveryRate: number;
  qualificationRate: number;
  demoRate: number;
  pilotDesignRate: number;
  proposalRate: number;
  pilotCloseRate: number;
  pilotActivationRate: number;
  pilotSuccessRate: number;
  pilotToAnnualConversion: number;
  directAnnualShare: number;
  directAnnualExtraCycleMonths: number;
  salesCycleMonths: number;
  firstPaidPilotMonth: number;
  paymentTermsDays: number;

  // Students
  studentInviteRate: number;
  studentActivationRate: number;
  studentPremiumConversion: number;
  directPremiumSignupsPerMonth: number;
  studentMonthlyChurn: number;
  studentPaymentFeePct: number;

  // Retention
  institutionRetention: number;
  expansionRate: number;

  // Unit costs
  cloudCostPerActiveUserMonth: number;
  aiRequestsPerActiveUserMonth: number;
  aiCostPerRequest: number;
  aiIncludedRevenueShare: number;
  supportCostPerCustomerMonth: number;

  // Implementation
  implementationHoursPerProject: number;
  implementationMonths: number;
  implementationThirdPartyCost: number;
  contractorHourlyCost: number;
  deliveryHoursPerFtePerMonth: number;

  // Headcount (heads by model year) and loaded monthly cost per head
  headsFoundersY1: number;
  headsFoundersY2: number;
  headsFoundersY3: number;
  headsEngineeringY1: number;
  headsEngineeringY2: number;
  headsEngineeringY3: number;
  headsSalesY1: number;
  headsSalesY2: number;
  headsSalesY3: number;
  headsDeliveryY1: number;
  headsDeliveryY2: number;
  headsDeliveryY3: number;
  headsAdminY1: number;
  headsAdminY2: number;
  headsAdminY3: number;
  founderLoadedMonthly: number;
  engineeringLoadedMonthly: number;
  salesLoadedMonthly: number;
  deliveryLoadedMonthly: number;
  adminLoadedMonthly: number;
  founderSalesShare: number;
  wageInflation: number;

  // Operating expense, monthly
  contractorMonthly: number;
  marketingMonthly: number;
  legalComplianceMonthly: number;
  insuranceMonthly: number;
  accountingMonthly: number;
  softwareMonthly: number;
  travelEventsMonthly: number;
  otherAdminMonthly: number;

  // Required cash obligations (one-time), tied to the go/no-go blockers
  obligationSecurityAmount: number;
  obligationSecurityMonth: number;
  obligationAccessibilityAmount: number;
  obligationAccessibilityMonth: number;
  obligationCounselAmount: number;
  obligationCounselMonth: number;
  obligationEntityInsuranceAmount: number;
  obligationEntityInsuranceMonth: number;

  // Cash
  openingCash: number;
  fundingAmount: number;
  fundingMonth: number;

  // Warning thresholds
  grossMarginThreshold: number;
  runwayThresholdMonths: number;
}

export type AssumptionKey = keyof Assumptions;

export type ScenarioId =
  | 'conservative'
  | 'base'
  | 'ambitious'
  | 'downside'
  | 'longProcurement'
  | 'pilotHeavy'
  | 'annualHeavy'
  | 'highAi'
  | 'lowAdoption'
  | 'highImplementation'
  | 'lowConversion'
  | 'highConversion';

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** What this scenario asks the founder to consider. */
  description: string;
  /** Changes against Base. Every value is a planning assumption. */
  patch: Partial<Assumptions>;
}

export interface ValidationIssue {
  key: AssumptionKey | 'model';
  severity: 'error' | 'warning';
  message: string;
}

/** One month of the model. All money is USD; counts are expected values, not whole customers. */
export interface MonthRow {
  month: number;
  /** Calendar label, YYYY-MM, from the model's start month. */
  label: string;
  year: 1 | 2 | 3;
  basis: Basis;

  // Funnel (expected values; accounts and deals are fractional by design)
  contacted: number;
  replies: number;
  discoveries: number;
  qualified: number;
  demos: number;
  designs: number;
  proposals: number;
  pilotsSigned: number;
  directAnnualSigned: number;
  pilotsActive: number;
  annualStarts: number;
  annualCustomers: number;
  customersChurned: number;

  // Students
  activeInstitutionalStudents: number;
  premiumSubscribers: number;
  activeStudentsTotal: number;

  // AI
  aiRequests: number;
  aiOverageRequests: number;

  // Revenue, recognised
  revenuePilot: number;
  revenueImplementation: number;
  revenuePlatform: number;
  revenueSupport: number;
  revenueAiOverage: number;
  revenueStudentPremium: number;
  /** Core revenue: everything except the marketplace. */
  revenueCore: number;
  /** Marketplace/partner commission, modelled separately and never counted in core. */
  revenueMarketplace: number;
  revenueTotal: number;

  // Cost of revenue
  cogsCloud: number;
  cogsAi: number;
  cogsSupport: number;
  cogsImplementation: number;
  cogsPayments: number;
  cogsDeliveryPayroll: number;
  cogsTotal: number;
  /** Core gross profit (excludes marketplace). */
  grossProfit: number;
  /** Null when the month has no core revenue. */
  grossMarginPct: number | null;

  // Operating expense
  opexPayroll: number;
  opexContractors: number;
  opexMarketing: number;
  opexLegalCompliance: number;
  opexInsurance: number;
  opexAccounting: number;
  opexSoftware: number;
  opexTravelEvents: number;
  opexOther: number;
  opexTotal: number;
  /** Sales and marketing spend, the numerator of CAC. A subset of the lines above. */
  salesAndMarketing: number;
  operatingResult: number;
  obligations: number;

  // Cash
  billings: number;
  collections: number;
  cashOut: number;
  netCash: number;
  endingCash: number;
  deferredRevenue: number;
  /** Months of cash left at the trailing three-month average burn; null when not burning. */
  forwardRunwayMonths: number | null;

  // Recurring revenue
  mrr: number;
  arr: number;

  // Delivery capacity
  implementationDemandHours: number;
  deliveryCapacityHours: number;
  contractorOverflowHours: number;
  cumulativeGrossProfit: number;
  cumulativeOpexAndObligations: number;
}

export interface YearSummary {
  year: 1 | 2 | 3;
  basis: Basis;
  revenueCore: number;
  revenueMarketplace: number;
  grossProfit: number;
  grossMarginPct: number | null;
  opexTotal: number;
  operatingResult: number;
  endingCash: number;
  arrEnd: number;
  salesAndMarketing: number;
  newAnnualCustomers: number;
  newPilots: number;
  headcount: number;
  revenuePerEmployee: number | null;
  /** Null when nothing was acquired in the year. */
  cac: number | null;
  mix: Record<'pilot' | 'implementation' | 'platform' | 'support' | 'aiOverage' | 'studentPremium' | 'marketplace', number>;
}

export interface UnitEconomics {
  basis: Basis;
  /** Annual recurring revenue of one annual institutional customer at signing. */
  arrPerCustomer: number;
  platformFeePerCustomer: number;
  supportFeePerCustomer: number;
  aiOveragePerCustomerYear: number;
  minimumApplies: boolean;
  /** Customer-level gross margin: recurring revenue less variable cost to serve. */
  unitGrossMargin: number | null;
  monthlyGrossProfitPerCustomer: number | null;
  /** Whole-horizon sales and marketing spend per annual customer acquired. */
  cac: number | null;
  cacPerPilot: number | null;
  cacPaybackMonths: number | null;
  paybackNote: string;
  annualLogoChurn: number;
  /** ARR x gross margin / annual logo churn. Null when churn is zero (undefined by the formula). */
  ltv: number | null;
  ltvToCac: number | null;
  grossRetention: number;
  netRevenueRetention: number;
  /** Measured from the model's own cohorts at month 36 versus month 24; null if no cohort spans both. */
  measuredNrr: number | null;
  /** Share of pilots signed that become an annual customer, end to end. */
  pilotYield: number;
}

export interface BreakEven {
  basis: Basis;
  /** First month where cumulative core gross profit covers cumulative opex and required obligations. */
  month: number | null;
  /** True when the condition still holds in month 36. */
  sustained: boolean;
  /** First month with a non-negative monthly operating result. */
  operatingMonth: number | null;
}

export type WarningId =
  | 'paid-pilot-gate'
  | 'capacity'
  | 'margin'
  | 'runway'
  | 'ai'
  | 'marketplace-dependence'
  | 'minimum-binds'
  | 'pilot-length'
  | 'no-conversions';

export interface ModelWarning {
  id: WarningId;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  /** First month the condition appears, when it is month-based. */
  month?: number;
}

export interface FunnelStage {
  stage: string;
  /** Expected count over the 36 months. */
  count: number;
  /** Share of the previous stage; null for the first. */
  rate: number | null;
}

export interface ModelResult {
  basis: Basis;
  assumptions: Assumptions;
  months: MonthRow[];
  years: [YearSummary, YearSummary, YearSummary];
  unit: UnitEconomics;
  breakEven: BreakEven;
  /** First month ending cash is negative; null if it never is inside the horizon. */
  cashOutMonth: number | null;
  runwayMonths: number | null;
  lowestCash: number;
  /** Extra funding needed to keep cash at or above zero in every month; 0 when cash never goes negative. */
  peakFundingNeed: number;
  funnel: FunnelStage[];
  warnings: ModelWarning[];
}

export const MODEL_MONTHS = 36;
