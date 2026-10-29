import { test, eq } from './harness';
import { whatIf, compare } from '../src/lib/whatIfRules';

const credits = { 'ECON-101': 3, 'ECON-201': 3, 'MATH-101': 4, 'PSCI-101': 3, 'PSCI-301': 3 };
const econ = { code: 'ECON-BA', name: 'Economics', credential: 'bachelor', totalCredits: 13, termCap: 6, terms: [['ECON-101', 'MATH-101'], ['ECON-201']] };
const psci = { code: 'PSCI-MIN', name: 'Political science', credential: 'certificate', totalCredits: 6, termCap: 6, terms: [['PSCI-101'], ['PSCI-301']] };

test('completed and in-progress pathway courses count; the rest is what remains', () => {
  const r = whatIf(econ, credits, new Set(['ECON-101']), new Set(['MATH-101']));
  eq([r.countedCredits, r.inProgressCredits, r.remainingCredits, r.percent, r.estimatedTerms], [3, 4, 6, 54, 1]);
  eq(r.remaining, ['ECON-201']);
});
test('a course both completed and listed as current counts once, as completed', () => {
  const r = whatIf(econ, credits, new Set(['ECON-101']), new Set(['ECON-101']));
  eq([r.countedCredits, r.inProgressCredits], [3, 0]);
});
test('courses outside the pathway never count toward it', () => eq(whatIf(psci, credits, new Set(['ECON-101']), new Set()).countedCredits, 0));
test('remaining never goes below zero and percent never above 100', () => {
  const r = whatIf({ ...psci, totalCredits: 3 }, credits, new Set(['PSCI-101', 'PSCI-301']), new Set());
  eq([r.remainingCredits, r.percent, r.estimatedTerms], [0, 100, 0]);
});
test('compare puts least-left first, ties by code', () => {
  const rows = compare([whatIf(econ, credits, new Set(), new Set()), whatIf(psci, credits, new Set(), new Set()), whatIf({ ...psci, code: 'AAA' }, credits, new Set(), new Set())]);
  eq(rows.map((r) => r.code), ['AAA', 'PSCI-MIN', 'ECON-BA']);
});
