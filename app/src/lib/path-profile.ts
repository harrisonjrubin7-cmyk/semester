import { finite, obj, textValue } from './device-library';
import { hours, type Taken } from './degree';
import type { PathSnapshot } from './today-decision';

/**
 * Where the student says they are headed: a programme, a target term, the
 * credits their own audit says the degree needs, and a few goals.
 *
 * Every field is optional and every field is the student's. Semester does not
 * know a university's requirements and will not pretend to (`lib/degree.ts`),
 * so none of this is prefilled — in particular there is no default credit
 * total. The Scenarios tab starts at 120 as an editable guess; this does not,
 * because "credits remaining" shown against a number nobody entered is the
 * invented denominator `docs/IMPLEMENTATION_STATUS.md` rules out.
 *
 * Stored per account under `semester.path-profile.v1:<account>`, separate from
 * `semester.v1`, so the main store's shape does not change (the rule in
 * `REGRESSION-CHECKLIST.md` §Q).
 */

export const PATH_PROFILE_PREFIX = 'semester.path-profile.v1';
export const MAX_GOALS = 5;

export type Season = 'Spring' | 'Summer' | 'Fall';
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall'];

export interface TargetTerm {
  season: Season;
  year: number;
}

export interface PathProfile {
  version: 1;
  programme: string;
  targetTerm: TargetTerm | null;
  /** Credit hours the degree needs, from the student's own audit. Null until they say. */
  creditTarget: number | null;
  goals: string[];
  /** When the student last saved this, epoch ms. */
  updatedAt: number | null;
}

export const EMPTY_PATH_PROFILE: PathProfile = {
  version: 1,
  programme: '',
  targetTerm: null,
  creditTarget: null,
  goals: [],
  updatedAt: null,
};

function readTerm(v: unknown): TargetTerm | null {
  if (!obj(v) || !SEASONS.includes(v.season as Season) || !finite(v.year, 2000, 2100)) return null;
  return { season: v.season as Season, year: Math.round(v.year) };
}

/** The validator for every read and write. Throws on something that is not a profile at all. */
export function readPathProfile(value: unknown): PathProfile {
  if (!obj(value) || value.version !== 1) throw new Error('Not a path profile.');
  const goals = Array.isArray(value.goals)
    ? value.goals.filter((g): g is string => textValue(g, 200)).map((g) => g.trim()).filter(Boolean).slice(0, MAX_GOALS)
    : [];
  return {
    version: 1,
    programme: textValue(value.programme, 200) ? value.programme.trim() : '',
    targetTerm: readTerm(value.targetTerm),
    creditTarget: finite(value.creditTarget, 1, 400) ? Math.round(value.creditTarget) : null,
    goals,
    updatedAt: finite(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ? value.updatedAt : null,
  };
}

export function hasPathProfile(p: PathProfile): boolean {
  return Boolean(p.programme || p.targetTerm || p.creditTarget || p.goals.length);
}

export function termLine(t: TargetTerm | null): string | null {
  return t ? `${t.season} ${t.year}` : null;
}

export interface PathCredits {
  complete: number;
  inProgress: number;
  /** In the registration cart: planned, not registered. */
  planned: number;
  target: number | null;
  /** Only when the student gave a target. Never negative. */
  remaining: number | null;
}

export function pathCredits(profile: PathProfile, taken: Taken[], planned: number): PathCredits {
  const h = hours(taken);
  const complete = h.done;
  const inProgress = h.withThisTerm - h.done;
  const target = profile.creditTarget;
  return {
    complete,
    inProgress,
    planned: Math.max(0, planned),
    target,
    remaining: target === null ? null : Math.max(0, target - complete - inProgress - Math.max(0, planned)),
  };
}

export type PathStatus = 'on_track' | 'review' | 'incomplete';

/**
 * The three statuses the brief names, read off the snapshot Today already
 * computes. "On track" is qualified every time it is shown: it means *by the
 * requirements you recorded*, which is all Semester can see.
 */
export function pathStatus(snapshot: PathSnapshot): { status: PathStatus; label: string } {
  if (snapshot.state === 'moving') return { status: 'on_track', label: 'On track by what you recorded' };
  if (snapshot.state === 'review') return { status: 'review', label: 'Review recommended' };
  return { status: 'incomplete', label: 'Incomplete' };
}

export const NOT_OFFICIAL =
  'A planning estimate from what you entered. It is not an official degree audit or degree clearance — confirm with your advisor and registrar.';
