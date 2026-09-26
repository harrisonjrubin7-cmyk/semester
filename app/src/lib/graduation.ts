/**
 * When do I finish, and what does a change cost me?
 *
 * The degree screen answers what is left. The question students actually take
 * to an advisor is the next one: *if I drop this class, add a minor, go
 * part-time, or take a summer course, when do I graduate — and what does the
 * extra semester cost?* The answer is arithmetic over three numbers the
 * student knows better than any system does (how many hours they need, how
 * many they take a term, what a term costs them), so it is done here, in the
 * open, and labelled an estimate everywhere it appears.
 *
 * ## What it will not do
 *
 * It does not know the requirement. `needed` is the student's figure from
 * their own audit — the degree screen ships no requirements, and neither does
 * this. It does not know sequencing: a capstone offered only in spring can
 * push a finish later than hours alone say. And it does not know aid: cost is
 * what the student typed per term, never an aid determination. The screen says
 * all three beside the result.
 *
 * ## Why simulate term by term instead of dividing
 *
 * Division gives a fraction of a term, and nobody graduates 0.4 of the way
 * through a spring. Walking the calendar also lets summers count only when the
 * student says they will take one, and makes "part-time" and "summer" the same
 * kind of change as "add a minor" — a different load, not a different formula.
 */

import { finite, obj, textValue } from './device-library';

export const GRADUATION_KEY = 'semester.graduation.v1';

export type Season = 'Spring' | 'Summer' | 'Fall';
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall'];

export interface Term {
  season: Season;
  year: number;
}

export interface Plan {
  /** Credit hours the degree needs in total, from the student's own audit. */
  needed: number;
  /** Credits in a normal fall or spring. */
  perTerm: number;
  /** Credits each summer; zero means no summers. */
  summer: number;
  /** Dollars per fall/spring term, as the student estimates it. Zero means unknown. */
  costPerTerm: number;
  /** Dollars per summer taken. */
  summerCost: number;
  /** The first term still to come. */
  next: Term;
}

export interface Scenario {
  id: string;
  name: string;
  /** Hours added (a minor, a switch) or removed (credit already earned elsewhere). */
  extra: number;
  perTerm: number;
  summer: number;
}

export interface GraduationData {
  plan: Plan;
  scenarios: Scenario[];
}

export const MAX_SCENARIOS = 8;
/** Twenty years of terms. Anything later is "not at this pace". */
const HORIZON = 60;

export function defaultNext(now: Date): Term {
  // Months 0–3 → the next thing is summer; 4–7 → fall; 8–11 → next spring.
  const m = now.getMonth();
  const y = now.getFullYear();
  if (m <= 3) return { season: 'Summer', year: y };
  if (m <= 7) return { season: 'Fall', year: y };
  return { season: 'Spring', year: y + 1 };
}

export function emptyGraduation(now: Date = new Date()): GraduationData {
  return {
    plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 0, summerCost: 0, next: defaultNext(now) },
    scenarios: [],
  };
}

export const EMPTY_GRADUATION = emptyGraduation(new Date(2026, 8, 1));

const readTerm = (v: unknown): Term => {
  if (!obj(v) || !SEASONS.includes(v.season as Season) || !finite(v.year, 2000, 2100) || !Number.isInteger(v.year)) {
    throw new Error('Saved term is not valid.');
  }
  return { season: v.season as Season, year: v.year };
};

export function readGraduation(value: unknown): GraduationData {
  if (!obj(value) || !obj(value.plan) || !Array.isArray(value.scenarios)) {
    throw new Error('Saved graduation plan is not valid.');
  }
  const p = value.plan;
  if (
    !finite(p.needed, 1, 400) ||
    !finite(p.perTerm, 0, 30) ||
    !finite(p.summer, 0, 20) ||
    !finite(p.costPerTerm, 0, 1_000_000) ||
    !finite(p.summerCost, 0, 1_000_000)
  ) {
    throw new Error('Saved graduation plan is not valid.');
  }
  if (value.scenarios.length > MAX_SCENARIOS) throw new Error('Too many saved scenarios.');
  const scenarios = value.scenarios.map((s) => {
    if (
      !obj(s) ||
      !textValue(s.id, 100) ||
      !s.id ||
      !textValue(s.name, 80) ||
      !s.name.trim() ||
      !finite(s.extra, -200, 200) ||
      !finite(s.perTerm, 0, 30) ||
      !finite(s.summer, 0, 20)
    ) {
      throw new Error('A saved scenario is not valid.');
    }
    return { id: s.id, name: s.name, extra: s.extra, perTerm: s.perTerm, summer: s.summer };
  });
  if (new Set(scenarios.map((s) => s.id)).size !== scenarios.length) throw new Error('Scenario ids must be unique.');
  return {
    plan: {
      needed: p.needed,
      perTerm: p.perTerm,
      summer: p.summer,
      costPerTerm: p.costPerTerm,
      summerCost: p.summerCost,
      next: readTerm(p.next),
    },
    scenarios,
  };
}

export function after(t: Term): Term {
  const i = SEASONS.indexOf(t.season);
  return i === SEASONS.length - 1 ? { season: SEASONS[0], year: t.year + 1 } : { season: SEASONS[i + 1], year: t.year };
}

export const termLabel = (t: Term) => `${t.season} ${t.year}`;

export interface Projection {
  /** Null when this pace never reaches the total within the horizon. */
  finish: Term | null;
  /** Fall and spring terms still to take. */
  terms: number;
  summers: number;
  /** Null when the student has not entered a cost. */
  cost: number | null;
  remaining: number;
}

/**
 * Walk the calendar from `next` until `done` reaches `needed`.
 *
 * A term counts only if it adds credit: a summer with a zero load is skipped,
 * not counted as a term taken.
 */
export function project(plan: Plan, done: number, change?: Pick<Scenario, 'extra' | 'perTerm' | 'summer'>): Projection {
  const needed = Math.max(0, plan.needed + (change?.extra ?? 0));
  const perTerm = change?.perTerm ?? plan.perTerm;
  const summer = change?.summer ?? plan.summer;
  const remaining = Math.max(0, needed - done);
  const costKnown = plan.costPerTerm > 0;
  if (remaining === 0) return { finish: null, terms: 0, summers: 0, cost: costKnown ? 0 : null, remaining };

  let have = done;
  let t = plan.next;
  let terms = 0;
  let summers = 0;
  for (let i = 0; i < HORIZON; i++) {
    const load = t.season === 'Summer' ? summer : perTerm;
    if (load > 0) {
      have += load;
      if (t.season === 'Summer') summers++;
      else terms++;
      if (have >= needed) {
        const cost = costKnown ? terms * plan.costPerTerm + summers * plan.summerCost : null;
        return { finish: t, terms, summers, cost, remaining };
      }
    }
    t = after(t);
  }
  return { finish: null, terms, summers, cost: null, remaining };
}

/** Terms between two finishes, counting only fall and spring. */
export function delay(base: Projection, other: Projection): number {
  return other.terms - base.terms;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * One sentence comparing a scenario with the plan as it stands, in the words a
 * student would say to an advisor. Never "late" or "behind" — a later finish is
 * a choice with a cost, not a failure.
 */
export function compareLine(base: Projection, other: Projection): string {
  if (!other.finish) return 'At this pace the total is not reached. Try a heavier load or a summer term.';
  if (!base.finish) return `Estimated finish: ${termLabel(other.finish)}.`;
  const d = delay(base, other);
  const when = `Estimated finish: ${termLabel(other.finish)}`;
  const costDiff = base.cost !== null && other.cost !== null ? other.cost - base.cost : null;
  const costPart =
    costDiff === null
      ? ''
      : costDiff > 0
        ? ` About ${money(costDiff)} more.`
        : costDiff < 0
          ? ` About ${money(-costDiff)} less.`
          : ' About the same cost.';
  if (d === 0) return `${when}, the same number of fall and spring terms.${costPart}`;
  const n = Math.abs(d);
  return `${when}, ${n} ${n === 1 ? 'term' : 'terms'} ${d > 0 ? 'more' : 'fewer'} than your current plan.${costPart}`;
}

/** The kinds of change a student brings to an advisor, as starting points. */
export const PRESETS: { id: string; name: string; build: (p: Plan) => Omit<Scenario, 'id'> }[] = [
  { id: 'drop', name: 'Drop one class this term', build: (p) => ({ name: 'Drop one class', extra: 3, perTerm: p.perTerm, summer: p.summer }) },
  { id: 'minor', name: 'Add a minor (about 18 hours)', build: (p) => ({ name: 'Add a minor', extra: 18, perTerm: p.perTerm, summer: p.summer }) },
  { id: 'switch', name: 'Switch majors (about 24 extra hours)', build: (p) => ({ name: 'Switch majors', extra: 24, perTerm: p.perTerm, summer: p.summer }) },
  { id: 'summer', name: 'Take 6 hours each summer', build: (p) => ({ name: 'Summer courses', extra: 0, perTerm: p.perTerm, summer: 6 }) },
  { id: 'part', name: 'Go part-time (9 hours a term)', build: (p) => ({ name: 'Part-time', extra: 0, perTerm: 9, summer: p.summer }) },
  { id: 'heavy', name: 'Take 18 hours a term', build: (p) => ({ name: 'Heavier load', extra: 0, perTerm: 18, summer: p.summer }) },
];

export function addScenario(data: GraduationData, s: Omit<Scenario, 'id'>, id: string): GraduationData {
  if (data.scenarios.length >= MAX_SCENARIOS) return data;
  return { ...data, scenarios: [...data.scenarios, { ...s, id }] };
}

export function removeScenario(data: GraduationData, id: string): GraduationData {
  return { ...data, scenarios: data.scenarios.filter((s) => s.id !== id) };
}

/** A plain-text summary to take to an advising meeting. */
export function summary(data: GraduationData, done: number): string {
  const base = project(data.plan, done);
  const lines = [
    'Graduation scenarios (estimates — confirm with your advisor)',
    `Hours finished: ${done} of ${data.plan.needed}`,
    `Current plan: ${data.plan.perTerm} hours a term${data.plan.summer ? `, ${data.plan.summer} each summer` : ''} → ${
      base.finish ? termLabel(base.finish) : base.remaining === 0 ? 'complete' : 'not reached at this pace'
    }${base.cost !== null && base.finish ? `, about ${money(base.cost)} remaining` : ''}`,
    ...data.scenarios.map((s) => `${s.name}: ${compareLine(base, project(data.plan, done, s))}`),
  ];
  return lines.join('\n');
}
