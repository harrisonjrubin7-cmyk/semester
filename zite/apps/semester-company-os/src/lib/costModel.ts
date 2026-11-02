// Capacity and cost model for the Architecture and Launch Simulator. Pure; tested in tests/costModel.test.ts.
// Rules from the brief: every provider price is editable and starts blank (no fabricated vendor prices);
// every output is an Estimate; handle zero users, zero revenue, missing prices, mixed currencies and
// monthly versus annual inputs.

export type Period = 'month' | 'year';
export type Money = { amount: number | null; currency: string; period?: Period };

export type CostInputs = {
  currency: string;
  institutions: number;
  activeStudents: number;
  staff: number;
  monthlyActiveShare: number; // 0..1 of students + staff active in a month
  requestsPerActiveUser: number; // per month
  aiRequestsPerActiveUser: number; // per month
  tokensPerAiRequest: number;
  fileStorageGb: number;
  egressGb: number; // per month
  jobsPerMonth: number;
  supportHoursPerMonth: number;
  implementationHoursPerInstitution: number;
  prices: {
    platformBase: Money; // fixed hosting / plan fee
    perMillionRequests: Money;
    perMillionAiTokens: Money;
    perGbStorage: Money; // per GB-month
    perGbEgress: Money;
    perThousandJobs: Money;
    supportHourly: Money;
    implementationHourly: Money;
  };
  revenue: {
    perStudent: Money; // contract price per enrolled student
    floorPerInstitution: Money; // minimum per institution
  };
};

export type Line = { key: string; label: string; monthly: number | null; formula: string; note?: string };
export type CostResult = {
  label: 'Estimate';
  currency: string;
  activeUsers: number;
  lines: Line[];
  monthlyRecurring: number;
  oneTimeImplementation: number | null;
  monthlyRevenue: number | null;
  costPerActiveUser: number | null;
  costPerInstitution: number | null;
  grossMarginPct: number | null;
  warnings: string[];
};

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Price per month in the base currency, or null with a reason when it can't be used. */
export function monthly(m: Money, base: string): { value: number | null; reason?: string } {
  if (m.amount === null || m.amount === undefined || !Number.isFinite(m.amount)) return { value: null, reason: 'missing price' };
  if (m.amount < 0) return { value: null, reason: 'negative price' };
  if ((m.currency || base).toUpperCase() !== base.toUpperCase()) return { value: null, reason: `in ${m.currency}, not ${base}; not converted` };
  return { value: m.period === 'year' ? m.amount / 12 : m.amount };
}

export function estimate(i: CostInputs): CostResult {
  const base = (i.currency || 'USD').toUpperCase();
  const warnings: string[] = [];
  const share = Math.min(1, nonNeg(i.monthlyActiveShare));
  const activeUsers = Math.round((nonNeg(i.activeStudents) + nonNeg(i.staff)) * share);
  const lines: Line[] = [];
  const add = (key: string, label: string, price: Money, qty: number, unitLabel: string, per = 1, kind: 'usage' | 'fixed' = 'usage') => {
    const p = monthly(price, base);
    if (p.value === null) {
      if (qty > 0 || kind === 'fixed') warnings.push(`${label}: ${p.reason}. Excluded from totals.`);
      lines.push({ key, label, monthly: null, formula: `${qty.toLocaleString()} ${unitLabel} × price (${p.reason})`, note: p.reason });
      return;
    }
    const value = kind === 'fixed' ? p.value : (qty / per) * p.value;
    lines.push({ key, label, monthly: value, formula: kind === 'fixed' ? `fixed ${p.value.toFixed(2)} ${base}/month` : `${qty.toLocaleString()} ${unitLabel} ÷ ${per.toLocaleString()} × ${p.value.toFixed(4)} ${base}` });
  };
  const requests = activeUsers * nonNeg(i.requestsPerActiveUser);
  const tokens = activeUsers * nonNeg(i.aiRequestsPerActiveUser) * nonNeg(i.tokensPerAiRequest);
  add('platform', 'Platform base', i.prices.platformBase, 1, 'plan', 1, 'fixed');
  add('requests', 'Requests', i.prices.perMillionRequests, requests, 'requests', 1_000_000);
  add('ai', 'AI tokens', i.prices.perMillionAiTokens, tokens, 'tokens', 1_000_000);
  add('storage', 'File storage', i.prices.perGbStorage, nonNeg(i.fileStorageGb), 'GB-month');
  add('egress', 'Egress', i.prices.perGbEgress, nonNeg(i.egressGb), 'GB');
  add('jobs', 'Background jobs', i.prices.perThousandJobs, nonNeg(i.jobsPerMonth), 'jobs', 1_000);
  add('support', 'Support time', i.prices.supportHourly, nonNeg(i.supportHoursPerMonth), 'hours');

  const monthlyRecurring = lines.reduce((s, l) => s + (l.monthly ?? 0), 0);
  const impl = monthly({ ...i.prices.implementationHourly, period: 'month' }, base);
  const implHours = nonNeg(i.institutions) * nonNeg(i.implementationHoursPerInstitution);
  const oneTimeImplementation = impl.value === null ? (implHours > 0 ? (warnings.push(`Implementation: ${impl.reason}.`), null) : 0) : implHours * impl.value;

  // Revenue: per institution, max(per-student price × its students, floor). Students are split evenly across institutions.
  let monthlyRevenue: number | null = null;
  const per = monthly(i.revenue.perStudent, base);
  const floor = monthly(i.revenue.floorPerInstitution, base);
  const inst = Math.floor(nonNeg(i.institutions));
  if (inst > 0 && (per.value !== null || floor.value !== null)) {
    const studentsEach = nonNeg(i.activeStudents) / inst;
    const each = Math.max((per.value ?? 0) * studentsEach, floor.value ?? 0);
    monthlyRevenue = each * inst;
  } else if (inst > 0) {
    warnings.push('No revenue inputs: margin not calculated.');
  }
  if (activeUsers === 0) warnings.push('No active users: per-user cost not calculated.');
  if (inst === 0) warnings.push('No institutions: per-institution cost and revenue not calculated.');

  return {
    label: 'Estimate', currency: base, activeUsers, lines, monthlyRecurring,
    oneTimeImplementation,
    monthlyRevenue,
    costPerActiveUser: activeUsers > 0 ? monthlyRecurring / activeUsers : null,
    costPerInstitution: inst > 0 ? monthlyRecurring / inst : null,
    grossMarginPct: monthlyRevenue && monthlyRevenue > 0 ? ((monthlyRevenue - monthlyRecurring) / monthlyRevenue) * 100 : null,
    warnings,
  };
}

const blank = (currency = 'USD', period: Period = 'month'): Money => ({ amount: null, currency, period });

/** Starting inputs: usage assumptions filled, every price blank (enter your own provider prices). */
export function emptyInputs(kind: 'Lean pilot' | 'Multi-institution launch' | 'Expanded native platform' = 'Lean pilot'): CostInputs {
  const scale = { 'Lean pilot': [1, 500, 10], 'Multi-institution launch': [5, 15000, 150], 'Expanded native platform': [25, 150000, 1500] }[kind];
  return {
    currency: 'USD', institutions: scale[0], activeStudents: scale[1], staff: scale[2], monthlyActiveShare: 0.6,
    requestsPerActiveUser: 300, aiRequestsPerActiveUser: 10, tokensPerAiRequest: 1500, fileStorageGb: scale[1] / 100, egressGb: scale[1] / 50,
    jobsPerMonth: scale[1] * 4, supportHoursPerMonth: scale[0] * 8, implementationHoursPerInstitution: 60,
    prices: { platformBase: blank(), perMillionRequests: blank(), perMillionAiTokens: blank(), perGbStorage: blank(), perGbEgress: blank(), perThousandJobs: blank(), supportHourly: blank(), implementationHourly: blank() },
    revenue: { perStudent: blank('USD', 'year'), floorPerInstitution: blank('USD', 'year') },
  };
}

/** Book 1 planning assumptions, clearly labelled. Not quotes, not prices to publish. */
export const BOOK1_PLANNING_REVENUE = { perStudent: { amount: 18, currency: 'USD', period: 'year' as Period }, floorPerInstitution: { amount: 30000, currency: 'USD', period: 'year' as Period }, label: 'Book 1 planning assumptions ($18 per student per year, $30,000 floor). Not quotes.' };
