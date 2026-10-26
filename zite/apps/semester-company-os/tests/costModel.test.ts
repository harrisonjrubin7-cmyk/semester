import { test, eq } from './harness';
import { estimate, emptyInputs, monthly, BOOK1_PLANNING_REVENUE, CostInputs } from '../src/lib/costModel';

const priced = (): CostInputs => {
  const i = emptyInputs('Lean pilot');
  i.institutions = 2; i.activeStudents = 1000; i.staff = 0; i.monthlyActiveShare = 0.5; // 500 active
  i.requestsPerActiveUser = 2000; i.aiRequestsPerActiveUser = 2; i.tokensPerAiRequest = 1000; // 1,000,000 requests; 1,000,000 tokens
  i.fileStorageGb = 10; i.egressGb = 0; i.jobsPerMonth = 0; i.supportHoursPerMonth = 0; i.implementationHoursPerInstitution = 10;
  const p = (amount: number, period: 'month' | 'year' = 'month') => ({ amount, currency: 'USD', period });
  i.prices = { platformBase: p(1200, 'year'), perMillionRequests: p(2), perMillionAiTokens: p(5), perGbStorage: p(0.1), perGbEgress: p(0.05), perThousandJobs: p(0.4), supportHourly: p(50), implementationHourly: p(100) };
  i.revenue = { perStudent: p(12, 'year'), floorPerInstitution: p(1200, 'year') };
  return i;
};

test('outputs are labelled Estimate', () => eq(estimate(priced()).label, 'Estimate'));
test('annual prices are normalised to monthly', () => eq(monthly({ amount: 1200, currency: 'USD', period: 'year' }, 'USD').value, 100));
test('monthly total adds every priced line', () => {
  const r = estimate(priced());
  // platform 100 + requests 2 + AI 5 + storage 1 = 108
  eq(Math.round(r.monthlyRecurring * 100) / 100, 108);
  eq(r.activeUsers, 500);
  eq(Math.round((r.costPerActiveUser ?? 0) * 1000) / 1000, 0.216);
  eq(r.costPerInstitution, 54);
});
test('revenue uses max(per-student, floor) per institution', () => {
  const r = estimate(priced()); // 500 students each × 1/month = 500 vs floor 100 → 500 × 2 = 1000
  eq(r.monthlyRevenue, 1000);
  eq(Math.round(r.grossMarginPct!), 89);
});
test('floor applies when per-student revenue is lower', () => {
  const i = priced(); i.activeStudents = 20; // 10 each × 1 = 10 < floor 100
  eq(estimate(i).monthlyRevenue, 200);
});
test('missing prices are excluded and warned, never guessed', () => {
  const r = estimate(emptyInputs('Lean pilot'));
  eq(r.monthlyRecurring, 0);
  eq(r.warnings.some((w) => w.includes('missing price')), true);
  eq(r.lines.every((l) => l.monthly === null), true);
});
test('zero users: no per-user cost', () => {
  const i = priced(); i.activeStudents = 0; i.staff = 0;
  const r = estimate(i); eq(r.costPerActiveUser, null); eq(r.warnings.some((w) => w.startsWith('No active users')), true);
});
test('zero revenue: no margin', () => {
  const i = priced(); i.revenue = { perStudent: { amount: null, currency: 'USD', period: 'year' }, floorPerInstitution: { amount: null, currency: 'USD', period: 'year' } };
  const r = estimate(i); eq(r.monthlyRevenue, null); eq(r.grossMarginPct, null);
});
test('mixed currencies are not converted', () => {
  const i = priced(); i.prices.perMillionAiTokens = { amount: 5, currency: 'EUR', period: 'month' };
  const r = estimate(i);
  eq(r.lines.find((l) => l.key === 'ai')!.monthly, null);
  eq(r.warnings.some((w) => w.includes('EUR')), true);
});
test('zero institutions: no per-institution figures', () => {
  const i = priced(); i.institutions = 0;
  const r = estimate(i); eq(r.costPerInstitution, null); eq(r.monthlyRevenue, null);
});
test('Book 1 planning revenue is labelled as an assumption', () => eq(BOOK1_PLANNING_REVENUE.label.includes('Not quotes'), true));
test('one-time implementation = institutions × hours × rate', () => eq(estimate(priced()).oneTimeImplementation, 2000));
