import { test, eq } from './harness';
import { computeCourse, computeGpa, scoreProblem, DEFAULT_THRESHOLDS, DEFAULT_SCALE, CoursePlan } from '../src/lib/gradeCalc';

const base = (over: Partial<CoursePlan> = {}): CoursePlan => ({
  id: 'c', name: 'ECON 1010', credits: 3, mode: 'weighted', missingPolicy: 'exclude', extraCredit: false, thresholds: DEFAULT_THRESHOLDS, unsupportedRules: [],
  categories: [{ id: 'hw', name: 'Homework', weight: 40 }, { id: 'ex', name: 'Exams', weight: 60 }],
  assignments: [
    { id: '1', name: 'HW1', category: 'hw', status: 'graded', earned: 9, possible: 10 },
    { id: '2', name: 'HW2', category: 'hw', status: 'graded', earned: 7, possible: 10 },
    { id: '3', name: 'Midterm', category: 'ex', status: 'graded', earned: 85, possible: 100 },
    { id: '4', name: 'Final', category: 'ex', status: 'not_started', earned: null, possible: 100, whatIf: 95 },
  ], ...over,
});

test('weighted estimate over all categories (control)', () => {
  const r = computeCourse(base());
  eq(r.estimate, 83); // 0.4*80 + 0.6*85
  eq(r.coverage, 1);
  eq(r.letter, 'B');
  eq(r.valid, true);
});
test('rule 1-2: negative, zero-possible and above-possible scores are rejected', () => {
  eq(scoreProblem(-1, 10, false) !== null, true);
  eq(scoreProblem(5, 0, false) !== null, true);
  eq(scoreProblem(11, 10, false) !== null, true);
  eq(scoreProblem(11, 10, true), null);
  const r = computeCourse(base({ assignments: [{ id: '1', name: 'HW1', category: 'hw', status: 'graded', earned: 12, possible: 10 }] }));
  eq(r.rejected.length, 1);
  eq(r.label, 'Not enough graded work');
});
test('rule 3-4: ungraded is not zero; missing is zero only by policy', () => {
  const a = base({ assignments: [{ id: '1', name: 'HW1', category: 'hw', status: 'graded', earned: 10, possible: 10 }, { id: '2', name: 'HW2', category: 'hw', status: 'missing', earned: null, possible: 10 }, { id: '3', name: 'HW3', category: 'hw', status: 'ungraded', earned: null, possible: 10 }] });
  eq(computeCourse(a).categories[0].score, 100);
  eq(computeCourse({ ...a, missingPolicy: 'zero' }).categories[0].score, 50);
});
test('rule 5: excused leaves the denominator', () => {
  const a = base({ assignments: [{ id: '1', name: 'HW1', category: 'hw', status: 'graded', earned: 8, possible: 10 }, { id: '2', name: 'HW2', category: 'hw', status: 'excused', earned: 0, possible: 10 }] });
  eq(computeCourse(a).categories[0].possible, 10);
});
test('rule 6: points-based course', () => {
  const r = computeCourse(base({ mode: 'points' }));
  eq(r.estimate, 84.17); // 101 / 120
});
test('rule 7-8: partial weighted estimate is normalised and shows coverage', () => {
  const r = computeCourse(base({ assignments: [{ id: '1', name: 'HW1', category: 'hw', status: 'graded', earned: 9, possible: 10 }] }));
  eq(r.estimate, 90);
  eq(r.coverage, 0.4);
  eq(r.label.startsWith('Estimate from graded work so far'), true);
});
test('rule 9: weights not totalling 100 are an error and not valid', () => {
  const r = computeCourse(base({ categories: [{ id: 'hw', name: 'Homework', weight: 40 }, { id: 'ex', name: 'Exams', weight: 50 }] }));
  eq(r.valid, false);
  eq(r.label, 'Not a valid weighted result');
  eq(r.errors.some((e) => e.includes('90%')), true);
});
test('rule 10: no valid work', () => {
  eq(computeCourse(base({ assignments: [] })).label, 'Not enough graded work');
});
test('rule 11: unsupported rules become visible limitations', () => {
  eq(computeCourse(base({ unsupportedRules: ['Drop lowest quiz'] })).limitations[0].includes('Drop lowest quiz'), true);
});
test('what-if scenario includes hypothetical scores without touching the baseline', () => {
  const c = base();
  eq(computeCourse(c, true).estimate, 86); // exams (85+95)/200 = 90 → 0.4*80 + 0.6*90
  eq(computeCourse(c).estimate, 83);
});
test('GPA: exact prior, pass/fail excluded, approximate flagged', () => {
  const g = computeGpa([{ name: 'A', credits: 3, grade: 'A', basis: 'graded' }, { name: 'B', credits: 4, grade: 'B', basis: 'graded' }, { name: 'PE', credits: 1, grade: 'P', basis: 'pass_fail' }], { mode: 'exact', qualityPoints: 45, credits: 15 }, DEFAULT_SCALE);
  eq(g.term, 3.43); // (12+12)/7
  eq(g.cumulative, 3.14); // (45+24)/22 = 3.136
  eq(g.approximate, false);
  eq(computeGpa([{ name: 'A', credits: 3, grade: 'A', basis: 'graded' }], { mode: 'approx', gpa: 3.5, credits: 30 }, DEFAULT_SCALE).approximate, true);
});
test('GPA: unknown letters block a falsely precise answer; zero denominators return null', () => {
  const g = computeGpa([{ name: 'A', credits: 3, grade: 'A+', basis: 'graded' }], null, DEFAULT_SCALE);
  eq(g.term, null); eq(g.errors.length, 1);
  eq(computeGpa([], null, DEFAULT_SCALE).term, null);
});
