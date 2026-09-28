import { dollars } from './cost';
import { project, termLabel, type Plan, type Projection, type Scenario } from './graduation';

/**
 * Current plan against one proposed change, row by row (Phase D,
 * `graduation_simulator`).
 *
 * `compareLine` in `lib/graduation.ts` says the difference in one sentence.
 * An advisor meeting needs the table behind it: when, how many terms, how
 * many credits, how heavy each term is, what it costs — each with the change
 * written out in words and a sign, never in colour alone.
 *
 * Every figure is an estimate from numbers the student entered, and the rows
 * say so. None is a promise: not the finish, not the cost, not whether a
 * course will be offered when the plan needs it.
 */

export interface CompareRow {
  id: string;
  label: string;
  current: string;
  proposed: string;
  /** "+1 term", "−3 credits", "No change". */
  change: string;
  changed: boolean;
}

const money = dollars;
const signed = (n: number, one: string, many = `${one}s`) =>
  n === 0 ? 'No change' : `${n > 0 ? '+' : '−'}${Math.abs(n)} ${Math.abs(n) === 1 ? one : many}`;

const finishText = (p: Projection) => (p.finish ? termLabel(p.finish) : p.remaining === 0 ? 'Complete' : 'Not reached at this pace');

export function compareRows(plan: Plan, done: number, scenario: Scenario): CompareRow[] {
  const base = project(plan, done);
  const next = project(plan, done, scenario);
  const needBase = plan.needed;
  const needNext = Math.max(0, plan.needed + scenario.extra);
  const rows: CompareRow[] = [];

  const termDelta = next.finish && base.finish ? next.terms - base.terms : null;
  rows.push({
    id: 'finish',
    label: 'Estimated finish',
    current: finishText(base),
    proposed: finishText(next),
    change: termDelta === null ? (finishText(base) === finishText(next) ? 'No change' : 'Different') : signed(termDelta, 'term'),
    changed: finishText(base) !== finishText(next),
  });
  rows.push({
    id: 'terms',
    label: 'Fall and spring terms left',
    current: String(base.terms),
    proposed: String(next.terms),
    change: signed(next.terms - base.terms, 'term'),
    changed: next.terms !== base.terms,
  });
  rows.push({
    id: 'summers',
    label: 'Summer terms',
    current: String(base.summers),
    proposed: String(next.summers),
    change: signed(next.summers - base.summers, 'summer'),
    changed: next.summers !== base.summers,
  });
  rows.push({
    id: 'needed',
    label: 'Credits needed in total',
    current: String(needBase),
    proposed: String(needNext),
    change: signed(needNext - needBase, 'credit'),
    changed: needNext !== needBase,
  });
  rows.push({
    id: 'remaining',
    label: 'Credits still to earn',
    current: String(base.remaining),
    proposed: String(next.remaining),
    change: signed(next.remaining - base.remaining, 'credit'),
    changed: next.remaining !== base.remaining,
  });
  const load = (per: number, summer: number) => `${per} a term${summer ? `, ${summer} each summer` : ''}`;
  const loadNext = scenario.abroad
    ? `${load(scenario.perTerm, scenario.summer)}; ${scenario.abroad.credits} abroad`
    : load(scenario.perTerm, scenario.summer);
  rows.push({
    id: 'load',
    label: 'Term load (credits)',
    current: load(plan.perTerm, plan.summer),
    proposed: loadNext,
    change: [
      scenario.perTerm !== plan.perTerm ? `${signed(scenario.perTerm - plan.perTerm, 'credit')} a term` : '',
      scenario.abroad ? `${scenario.abroad.credits} abroad for ${scenario.abroad.terms} ${scenario.abroad.terms === 1 ? 'term' : 'terms'}` : '',
      scenario.summer !== plan.summer ? `${signed(scenario.summer - plan.summer, 'credit')} each summer` : '',
    ].filter(Boolean).join('; ') || 'No change',
    changed: loadNext !== load(plan.perTerm, plan.summer),
  });
  if (base.cost !== null && next.cost !== null) {
    const d = next.cost - base.cost;
    rows.push({
      id: 'cost',
      label: 'Estimated remaining cost',
      current: money(base.cost),
      proposed: money(next.cost),
      change: d === 0 ? 'No change' : `${d > 0 ? '+' : '−'}${money(Math.abs(d))}`,
      changed: d !== 0,
    });
  } else {
    rows.push({
      id: 'cost',
      label: 'Estimated remaining cost',
      current: 'Add a cost per term',
      proposed: 'Add a cost per term',
      change: 'Not estimated',
      changed: false,
    });
  }
  return rows;
}

/**
 * What the table cannot see, said beside it. The first is always there; the
 * others appear when the change makes them likely to matter.
 */
export function limits(plan: Plan, scenario: Scenario): string[] {
  const out = [
    'Sequence: Semester cannot see which courses must be taken in order, or which are offered only once a year. A change that adds credits or moves a term is the kind most likely to meet one — check the plan with your advisor.',
  ];
  if (scenario.perTerm > 18) {
    out.push(`${scenario.perTerm} credits a term is above many schools’ standard limit. Check your school’s rule and whether it needs approval before planning on it.`);
  }
  if (scenario.perTerm > 0 && scenario.perTerm < 12) {
    out.push(`${scenario.perTerm} credits a term is below the full-time line at many schools. That can matter for aid, housing, athletics or a visa — ask the office concerned before you rely on it.`);
  }
  if (scenario.abroad) {
    out.push('Transfer credit from study abroad is decided by your school, course by course. Confirm what will count before you plan on it.');
  }
  if (scenario.extra < 0) {
    out.push('Credit earned elsewhere counts only once your school has accepted it.');
  }
  if (plan.costPerTerm > 0) {
    out.push('Cost is what you entered per term, before any aid. It is not a bill and not an aid decision.');
  }
  return out;
}

/**
 * The changes Phase D adds to #762's six presets: the command's "12 instead
 * of 15", study abroad, and one extra term. Shown only with
 * `graduation_simulator` on, so #762's list is unchanged without it.
 */
export const MORE_PRESETS: { id: string; name: string; build: (p: Plan) => Omit<Scenario, 'id'> }[] = [
  { id: 'twelve', name: 'Take 12 credits a term', build: (p) => ({ name: '12 credits a term', extra: 0, perTerm: 12, summer: p.summer }) },
  {
    id: 'abroad',
    name: 'Study abroad for one term',
    build: (p) => ({
      name: 'Study abroad',
      extra: 0,
      perTerm: p.perTerm,
      summer: p.summer,
      abroad: { terms: 1, credits: Math.min(p.perTerm, 12), costPerTerm: null },
    }),
  },
  {
    id: 'extra',
    name: 'One extra term',
    build: (p) => ({ name: 'One extra term', extra: p.perTerm, perTerm: p.perTerm, summer: p.summer }),
  },
];

/** The comparison as plain text, for an advisor. Estimates, and says so. */
export function comparisonText(plan: Plan, done: number, scenario: Scenario): string {
  const rows = compareRows(plan, done, scenario);
  return [
    `${scenario.name} compared with your current plan (estimates — planning guidance only)`,
    ...rows.map((r) => `${r.label}: ${r.current} → ${r.proposed} (${r.change})`),
    ...limits(plan, scenario).map((l) => `Note: ${l}`),
  ].join('\n');
}
