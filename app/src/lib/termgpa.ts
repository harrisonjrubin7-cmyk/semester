/**
 * The GPA this term is heading for, which the app had every number for and
 * never worked out.
 *
 * `lib/degree.ts` computes a GPA and skips in-progress courses on purpose —
 * they have no grade, and inventing one would put a fiction on the transcript
 * screen. `lib/grades.ts` says where each course stands and what the rest has
 * to be. `lib/worth.ts` projects one course's landing as a band.
 * `lib/cutoffs.ts` turns a percentage into a letter and a letter into grade
 * points. Four files, and between them the question a student actually asks in
 * week ten — *what is this term going to do to my GPA?* — went unanswered,
 * with the arithmetic left to somebody at midnight with a calculator and four
 * syllabi open.
 *
 * ## A band, because a GPA built on projections is not a number
 *
 * Every input here is already a range. Folding four ranges into one figure and
 * printing "3.62" would be the most confident-looking thing in the app and the
 * least earned. So the term GPA is low, middle and high, the middle is "if the
 * rest goes like the graded part", and the edges come from each course's own
 * variation — the band `lib/worth.ts` already computes, carried through the
 * arithmetic instead of thrown away at the last step.
 *
 * ## A letter is a cliff, and the arithmetic has to treat it as one
 *
 * 89.94 is a B+. Rounding it to 90 and calling it an A− would move a whole
 * grade point off a tenth of a percent, and it is exactly the case where
 * somebody is looking. Percentages are never rounded before the scale reads
 * them, in any of the three positions of the band.
 *
 * ## What it will not count, and says so
 *
 * A course with nothing graded, a course whose credit hours cannot be read
 * from the syllabus line, and a scale that leaves a letter this course could
 * land on unpriced are three different holes with three different fixes. Each
 * is named, per course, rather than silently dropped — a GPA quietly computed
 * over three of your four courses is worse than no GPA, which is the same
 * argument `gpaLine` already makes about pass/fail.
 */

import { creditHours } from './credits';
import { systemFor, letterFor, type GradeSystem } from './cutoffs';
import { NO_POLICY, pointsOff, rate, tally, type AttendPolicy, type Attended } from './attend';
import { needFor, reachFor, standing, type Reach, type Standing } from './grades';
import { projectGrade, type Projection } from './worth';
import type { School } from './school';
import type { Course, CourseId } from './types';

/** One position of the band: a percentage, the letter it earns, its points. */
export interface Landing {
  pct: number;
  letter: string;
  /** Grade points on this course's scale, or null where the scale states none. */
  points: number | null;
}

/** Why a course is not in the arithmetic — one of these, or empty. */
export type Missing = '' | 'ungraded' | 'hours' | 'points';

export interface CourseTerm {
  courseId: CourseId;
  code: string;
  /** Credit hours read from the syllabus line, or null when it does not say. */
  hours: number | null;
  standing: Standing;
  projection: Projection | null;
  /** Where it lands, low / middle / high. Null when nothing is graded. */
  band: { low: Landing; mid: Landing; high: Landing } | null;
  missing: Missing;
}

export interface Band {
  low: number;
  mid: number;
  high: number;
}

export interface TermStanding {
  /** Every course, counted or not, in the order they were handed over. */
  courses: CourseTerm[];
  /** The ones the arithmetic could use. */
  counted: CourseTerm[];
  /** Credit hours behind the number. */
  hours: number;
  gpa: Band | null;
  /** The finished record, and what this term does to it. */
  cumulative: { before: number; hours: number; after: Band } | null;
}

/** The grade points a percentage earns on this scale, letter and all. */
export function landingAt(pct: number, system: GradeSystem): Landing {
  const letter = letterFor(pct, system);
  const band = (system.scale ?? []).find((b) => b.label === letter);
  const points = typeof band?.gpa === 'number' && Number.isFinite(band.gpa) ? band.gpa : null;
  return { pct, letter, points };
}

/** What one course contributes, with the reason when it contributes nothing. */
export interface Sitting {
  courseId: CourseId;
  code: string;
  credits: string | undefined;
  standing: Standing;
  /** The scores behind the standing, for the width of the band. */
  scores: number[];
  system: GradeSystem;
}

function courseTerm(s: Sitting): CourseTerm {
  const hours = creditHours(s.credits);
  const projection = projectGrade(s.standing, s.scores);
  const band = projection
    ? {
        low: landingAt(projection.low, s.system),
        mid: landingAt(projection.middle, s.system),
        high: landingAt(projection.high, s.system),
      }
    : null;

  // Ordered by which fix the student would make first: a course with nothing
  // entered needs a score, and asking them to check the credit hours of a
  // course that has no grades yet would be pointing at the wrong field.
  let missing: Missing = '';
  if (!band) missing = 'ungraded';
  else if (hours === null) missing = 'hours';
  else if (unpriced(band.mid) || unpriced(band.low) || unpriced(band.high)) {
    missing = 'points';
  }

  return {
    courseId: s.courseId,
    code: s.code,
    hours,
    standing: s.standing,
    projection,
    band,
    missing,
  };
}

/**
 * A letter the scale names and never prices.
 *
 * `landingAt` returns null points for two different silences, and only one of
 * them is this. A percentage below every band the scale states earns no letter
 * at all, and the term arithmetic has always read that as nothing — which on
 * every American scale is what a mark below the lowest stated cutoff is worth.
 *
 * This is the other one: the scale named the letter and did not say what it is
 * worth. `readGradeSystem` takes `min` and `gpa` band by band, so a published
 * table that lists A+ as a cutoff and prices nothing above 4.0 arrives exactly
 * like this — and folding it in as zero produced a term whose high end came
 * out *below* its low end, printed on the degree screen as "somewhere between
 * 3.30 and 0.00". An unpriced letter lives at the top of a scale, which is
 * precisely the end the middle cannot see, so all three ends ask this and the
 * middle is not a special case: reading a fail as "the scale states no grade
 * points" dropped a whole course out of a term for a table that prices four.
 */
function unpriced(l: Landing): boolean {
  return l.points === null && l.letter !== '';
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The term, as a band of grade points.
 *
 * `finished` is the record `lib/degree.ts` holds — points and hours already
 * banked — and is optional: a first-year with nothing behind them still has a
 * term GPA, and the cumulative line simply does not appear.
 */
export function termGpa(
  sittings: Sitting[],
  finished?: { points: number; hours: number } | null,
): TermStanding {
  const courses = sittings.map(courseTerm);
  const counted = courses.filter((c) => c.missing === '' && c.hours !== null && c.band);
  const hours = counted.reduce((n, c) => n + (c.hours ?? 0), 0);

  if (hours === 0) {
    return { courses, counted, hours: 0, gpa: null, cumulative: null };
  }

  const at = (pick: (c: CourseTerm) => Landing) =>
    round(
      counted.reduce((n, c) => n + (pick(c).points ?? 0) * (c.hours ?? 0), 0) / hours,
    );

  const gpa: Band = {
    low: at((c) => c.band!.low),
    mid: at((c) => c.band!.mid),
    high: at((c) => c.band!.high),
  };

  const cumulative =
    finished && finished.hours > 0
      ? {
          before: round(finished.points / finished.hours),
          hours: finished.hours + hours,
          after: {
            low: round((finished.points + gpa.low * hours) / (finished.hours + hours)),
            mid: round((finished.points + gpa.mid * hours) / (finished.hours + hours)),
            high: round((finished.points + gpa.high * hours) / (finished.hours + hours)),
          },
        }
      : null;

  return { courses, counted, hours, gpa, cumulative };
}

/** Why a course is not in the number, in the words of the fix for it. */
export function missingLine(c: CourseTerm): string {
  switch (c.missing) {
    case 'ungraded':
      return `${c.code} — nothing graded yet, so there is nothing to project from.`;
    case 'hours':
      return `${c.code} — the syllabus line does not say how many credit hours it is. Edit the course to add them.`;
    case 'points': {
      const ends = c.band ? [c.band.low, c.band.mid, c.band.high] : [];
      const blank = [...new Set(ends.filter(unpriced).map((l) => l.letter))];
      // A scale that prices nothing is one fix; a scale that prices all but one
      // letter is another, and it is the letter that has to be named. "No grade
      // points" would be false of a table that states eleven of them.
      if (blank.length === 0 || !ends.some((l) => l.points !== null)) {
        return `${c.code} — its grade scale has cutoffs but no grade points, so a letter cannot become a number.`;
      }
      const one = blank.length === 1;
      const list = one ? blank[0] : `${blank.slice(0, -1).join(', ')} or ${blank[blank.length - 1]}`;
      return `${c.code} — this could land on ${list}, and the scale states no grade points for ${
        one ? 'it' : 'those'
      }. Add ${one ? 'that' : 'them'} to the scale and the course counts.`;
    }
    default:
      return '';
  }
}

/**
 * The term GPA in a sentence, with the width of the band as the point of it.
 *
 * The band is stated before the middle rather than after, because a middle
 * read first is a middle remembered and the edges become a footnote on a
 * number somebody has already written down.
 */
export function termLine(t: TermStanding): string {
  if (!t.gpa) {
    const why = t.courses.length === 0 ? 'No courses.' : 'Nothing yet has both a grade and credit hours.';
    return `${why} A term GPA needs at least one of each.`;
  }
  const n = t.counted.length;
  const spread = round(t.gpa.high - t.gpa.low);
  const head = `Somewhere between ${t.gpa.low.toFixed(2)} and ${t.gpa.high.toFixed(2)} — ${t.gpa.mid.toFixed(
    2,
  )} if the rest goes like the graded part. ${n} ${n === 1 ? 'course' : 'courses'}, ${t.hours} hours.`;
  if (spread >= 0.5) {
    return `${head} That is a wide band: most of these grades are still to play for.`;
  }
  return `${head} This is your arithmetic, not the registrar’s.`;
}

/** One grade step up, and what it would do to the term. */
export interface Move {
  courseId: CourseId;
  code: string;
  /** The letter it is heading for now. */
  from: string;
  /** The letter one step above it. */
  to: string;
  /** What everything still to come has to average. Null when nothing is left. */
  need: number | null;
  /** How hard that is, in the words `lib/grades.ts` already uses. */
  reach: Reach;
  /** The term GPA if this course landed there and nothing else changed. */
  then: number;
  /** What that is worth, in grade points. */
  gain: number;
}

/**
 * Where an hour tonight is worth the most, counted in GPA rather than in
 * percentage points.
 *
 * `lib/worth.ts` already ranks tonight's work by marginal points of a single
 * course's grade. This asks the different question a student with four
 * courses actually has: a percentage point is not worth the same in a
 * two-credit course as in a four-credit one, and a course sitting at 89.9 is
 * one point from a whole grade step while a course at 84 is six from the next.
 *
 * It will not tell anybody to give a course up. Every course with a step above
 * it is listed, in order of what the step is worth, with the reach beside it —
 * an unreachable step is shown as unreachable rather than hidden, because
 * knowing a grade is out of range is what stops the hours going there.
 */
export function moves(t: TermStanding, systems: Record<string, GradeSystem>): Move[] {
  if (!t.gpa || t.hours === 0) return [];
  const out: Move[] = [];

  for (const c of t.counted) {
    const system = systems[c.courseId];
    const bands = (system?.scale ?? [])
      .filter((b) => typeof b.min === 'number' && typeof b.gpa === 'number')
      .sort((a, b) => (a.min as number) - (b.min as number));
    // The first band strictly above where it is heading. Already at the top of
    // the scale, there is no step and no row.
    const next = bands.find((b) => (b.min as number) > c.band!.mid.pct);
    if (!next) continue;

    const points = next.gpa as number;
    const nowPoints = c.band!.mid.points ?? 0;
    const hours = c.hours ?? 0;
    const then = round(
      (t.gpa.mid * t.hours - nowPoints * hours + points * hours) / t.hours,
    );
    const need = needFor(c.standing, next.min as number);
    out.push({
      courseId: c.courseId,
      code: c.code,
      from: c.band!.mid.letter,
      to: next.label,
      need: need === null ? null : Math.round(need * 10) / 10,
      reach: reachFor(c.standing, next.min as number, next.label).reach,
      then,
      gain: round(then - t.gpa.mid),
    });
  }

  // By what the step is worth, then by how reachable it is — two steps worth
  // the same are not the same when one needs 91% of what is left and the other
  // needs 78%.
  const order: Record<Reach, number> = {
    settled: 0,
    secured: 1,
    ordinary: 2,
    hard: 3,
    unknown: 4,
    unreachable: 5,
  };
  return out.sort((a, b) => b.gain - a.gain || order[a.reach] - order[b.reach]);
}

/** One move, as the sentence a person would say about it. */
export function moveLine(m: Move): string {
  const worth = `${m.gain > 0 ? '+' : ''}${m.gain.toFixed(2)} on the term`;
  if (m.reach === 'unreachable') {
    return `${m.from} → ${m.to} is out of reach in ${m.code}, whatever the rest of it looks like.`;
  }
  if (m.need === null) {
    return `${m.code} is decided — nothing left to play for.`;
  }
  return `${m.code}: ${m.need}% on everything left turns ${m.from} into ${m.to}. ${worth}.`;
}

/**
 * Everything the arithmetic needs out of the store, in one argument.
 *
 * Built here rather than in the screen because two callers want it — the
 * screen and the assistant's provider — and the failure mode of two copies is
 * the one this app keeps designing against: a figure that is right on the page
 * and different in the answer to a question about the page. It is the same
 * assembly `screens/Grades.tsx` does per course, done once for the term.
 */
export interface TermInput {
  courses: Course[];
  grades: Record<string, string>;
  pieces: Record<string, string>;
  drops: Record<string, number>;
  attendance: Attended[];
  attendPolicy: Record<string, AttendPolicy>;
  gradeSystems: Record<string, GradeSystem>;
  school: School | null;
}

export function sittings(input: TermInput): Sitting[] {
  return input.courses.map((c) => {
    const policy = input.attendPolicy[c.id] ?? NO_POLICY;
    const t = tally(input.attendance, c.id);
    const s = standing(c, input.grades, {
      pieces: input.pieces,
      drops: input.drops,
      pointsOff: pointsOff(policy, t),
      attendance: { worth: policy.worth, rate: rate(t) },
    });
    return {
      courseId: c.id,
      code: c.code,
      credits: c.credits,
      standing: s,
      // The width of the band comes from how much your own scores have varied,
      // which is the scores themselves and not the standing's summary of them.
      scores: s.rows.map((r) => r.score).filter((n): n is number => typeof n === 'number'),
      system: systemFor(c.id, input.gradeSystems, input.school).system,
    };
  });
}

/** The scales in force, keyed by course — what `moves` needs beside a term. */
export function systemsFor(input: TermInput): Record<string, GradeSystem> {
  return Object.fromEntries(
    input.courses.map((c) => [c.id, systemFor(c.id, input.gradeSystems, input.school).system]),
  );
}
