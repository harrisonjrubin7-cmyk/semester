// Student grade tracker and GPA simulator (S-72 §D and §F). Pure and unit-tested in tests/gradeCalc.test.ts.
// Planning only: nothing here reads or writes an official grade. Every result carries its errors, limitations and assumptions,
// and a partial-work estimate is never called a final grade.
export const STATUSES = ['not_started', 'submitted', 'graded', 'missing', 'excused', 'ungraded'] as const;
export type Status = (typeof STATUSES)[number];
export type Assignment = { id: string; name: string; category: string; status: Status; earned: number | null; possible: number; whatIf?: number | null };
export type Category = { id: string; name: string; weight: number | null };
export type Threshold = { letter: string; min: number };
export type CoursePlan = {
  id: string; name: string; credits: number; mode: 'weighted' | 'points'; missingPolicy: 'exclude' | 'zero'; extraCredit: boolean;
  thresholds: Threshold[]; categories: Category[]; assignments: Assignment[]; unsupportedRules: string[];
};
export const DEFAULT_THRESHOLDS: Threshold[] = [
  { letter: 'A', min: 93 }, { letter: 'A-', min: 90 }, { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 },
  { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 }, { letter: 'D', min: 60 }, { letter: 'F', min: 0 },
];

export type CategoryResult = { id: string; name: string; weight: number | null; earned: number; possible: number; score: number | null; included: number };
export type CourseResult = {
  estimate: number | null; letter: string | null; label: string; valid: boolean; coverage: number | null;
  categories: CategoryResult[]; errors: string[]; limitations: string[]; assumptions: string[]; breakdown: string[]; rejected: string[];
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Validates one score; returns a reason when it must be rejected (rules 1-2). */
export function scoreProblem(earned: number | null | undefined, possible: number, extraCredit: boolean) {
  if (!(possible > 0)) return 'possible points must be above 0';
  if (earned === null || earned === undefined) return null;
  if (earned < 0) return 'a score cannot be negative';
  if (earned > possible && !extraCredit) return 'score is above possible points and extra credit is off';
  return null;
}

export function computeCourse(c: CoursePlan, scenario = false): CourseResult {
  const errors: string[] = [], rejected: string[] = [], breakdown: string[] = [];
  const limitations = c.unsupportedRules.map((r) => `Not calculated: "${r}" is not a supported rule, so it is left out of every estimate.`);
  const assumptions = [
    'Ungraded, not-started and submitted work is left out until it has a score.',
    c.missingPolicy === 'zero' ? 'Missing work counts as zero (the policy you selected).' : 'Missing work is left out (it is not treated as zero).',
    'Excused work is left out of both earned and possible points.',
  ];
  if (scenario) assumptions.push('What-if scores are included for work without a real score.');
  const acc: Record<string, { earned: number; possible: number; n: number }> = {};
  for (const a of c.assignments) {
    const cat = c.categories.find((x) => x.id === a.category);
    if (!cat) { rejected.push(`${a.name}: its category does not exist`); continue; }
    const real = a.status === 'graded' ? a.earned : null;
    let use: number | null = null;
    if (a.status === 'excused') continue;
    if (real !== null && real !== undefined) use = real;
    else if (a.status === 'missing' && c.missingPolicy === 'zero') use = 0;
    else if (scenario && a.whatIf !== null && a.whatIf !== undefined && a.status !== 'missing') use = a.whatIf;
    if (use === null) continue;
    const bad = scoreProblem(use, a.possible, c.extraCredit);
    if (bad) { rejected.push(`${a.name}: ${bad}`); continue; }
    const s = (acc[cat.id] ??= { earned: 0, possible: 0, n: 0 });
    s.earned += use; s.possible += a.possible; s.n += 1;
  }
  const categories: CategoryResult[] = c.categories.map((cat) => {
    const s = acc[cat.id];
    return { id: cat.id, name: cat.name, weight: cat.weight, earned: s?.earned ?? 0, possible: s?.possible ?? 0, score: s && s.possible > 0 ? (s.earned / s.possible) * 100 : null, included: s?.n ?? 0 };
  });
  if (rejected.length) errors.push(`${rejected.length} score${rejected.length === 1 ? ' was' : 's were'} rejected and left out.`);

  let estimate: number | null = null, coverage: number | null = null, valid = true;
  if (c.mode === 'points') {
    const e = categories.reduce((t, x) => t + x.earned, 0), p = categories.reduce((t, x) => t + x.possible, 0);
    if (p > 0) { estimate = (e / p) * 100; breakdown.push(`${r2(e)} earned ÷ ${r2(p)} possible = ${r2(estimate)}%`); }
  } else {
    const total = c.categories.reduce((t, x) => t + (x.weight ?? 0), 0);
    if (c.categories.some((x) => x.weight === null || !(x.weight >= 0))) { errors.push('Every category needs a weight of 0 or more.'); valid = false; }
    if (Math.abs(total - 100) > 0.01) { errors.push(`Category weights total ${r2(total)}%, not 100%.`); valid = false; }
    const inc = categories.filter((x) => x.score !== null && (x.weight ?? 0) > 0);
    const w = inc.reduce((t, x) => t + (x.weight ?? 0), 0);
    if (w > 0) {
      estimate = inc.reduce((t, x) => t + (x.weight ?? 0) * (x.score as number), 0) / w;
      inc.forEach((x) => breakdown.push(`${x.name}: ${r2(x.earned)}/${r2(x.possible)} = ${r2(x.score as number)}% × weight ${x.weight}`));
      breakdown.push(`Sum of weighted scores ÷ included weight ${r2(w)} = ${r2(estimate)}%`);
    }
    coverage = total > 0 ? w / total : null;
  }
  if (estimate === null) return { estimate: null, letter: null, label: 'Not enough graded work', valid: false, coverage, categories, errors, limitations, assumptions, breakdown, rejected };
  const letter = [...c.thresholds].sort((a, b) => b.min - a.min).find((t) => (estimate as number) >= t.min)?.letter ?? null;
  const partial = c.mode === 'weighted' ? (coverage ?? 0) < 0.999 : c.assignments.some((a) => !['graded', 'excused'].includes(a.status) && !(a.status === 'missing' && c.missingPolicy === 'zero'));
  const label = !valid ? 'Not a valid weighted result' : partial ? 'Estimate from graded work so far (not a final grade)' : 'Estimate from all listed work (not an official grade)';
  return { estimate: r2(estimate), letter, label, valid, coverage: coverage === null ? null : r2(coverage), categories, errors, limitations, assumptions, breakdown, rejected };
}

// GPA simulator (S-72 §F).
export type GpaCourse = { name: string; credits: number; grade: string; basis: 'graded' | 'pass_fail' | 'excluded' };
export type Prior = { mode: 'exact'; qualityPoints: number; credits: number } | { mode: 'approx'; gpa: number; credits: number } | null;
// Same points as the Progress page's GPA (api/progress.ts), so planning and the record agree on the scale.
export const DEFAULT_SCALE: Record<string, number> = { A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, D: 1, F: 0 };
export function computeGpa(courses: GpaCourse[], prior: Prior, scale: Record<string, number>) {
  const included: string[] = [], excluded: string[] = [], errors: string[] = [];
  let qp = 0, cr = 0;
  for (const c of courses) {
    if (c.basis === 'pass_fail') { excluded.push(`${c.name}: pass/fail is not GPA-bearing`); continue; }
    if (c.basis === 'excluded') { excluded.push(`${c.name}: excluded by you`); continue; }
    if (!(c.credits > 0)) { errors.push(`${c.name}: credits must be above 0`); continue; }
    if (!c.grade) { excluded.push(`${c.name}: no expected grade yet`); continue; }
    const p = scale[c.grade];
    if (p === undefined) { errors.push(`${c.name}: "${c.grade}" is not on the grade-point scale`); continue; }
    qp += p * c.credits; cr += c.credits; included.push(`${c.name}: ${c.credits} × ${p} = ${r2(p * c.credits)}`);
  }
  // A course whose grade cannot be placed on the scale would make any GPA falsely precise: refuse to give one.
  const blocked = errors.length > 0;
  const term = !blocked && cr > 0 ? r2(qp / cr) : null;
  let cumulative: number | null = null, approximate = false;
  if (!blocked && prior) {
    const pq = prior.mode === 'exact' ? prior.qualityPoints : prior.gpa * prior.credits;
    approximate = prior.mode === 'approx';
    const den = prior.credits + cr;
    if (prior.credits < 0 || pq < 0) errors.push('Prior credits and quality points cannot be negative.');
    else if (den > 0) cumulative = r2((pq + qp) / den);
  }
  return { term, cumulative, approximate, termQualityPoints: r2(qp), termCredits: cr, included, excluded, errors,
    note: 'Planning estimate — not an official transcript calculation. Repeats, forgiveness, transfer credit and institutional rounding are not applied.' };
}
