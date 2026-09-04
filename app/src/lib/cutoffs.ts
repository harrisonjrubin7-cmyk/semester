/**
 * What counts as an A, which is not a fact about arithmetic.
 *
 * The grade projection has always drawn a table of letters — A at 93, A− at
 * 90, B+ at 87 — and never said where those numbers came from. They came from
 * a constant. That is fine for one student at one university whose professors
 * happen to use them, and it is wrong the moment somebody else opens the app:
 * an A is 93 at plenty of places and 94 at plenty of others, some schools do
 * not use minus grades at all, and a course marked out of points has no
 * percentage cutoffs to speak of.
 *
 * A cutoff shown without a source is the worst of the three options. It reads
 * as institutional fact, it is acted on in week ten, and nobody checks it.
 *
 * ## Where a scale comes from, in order
 *
 * 1. **The course.** Professors deviate from their own university, and the
 *    syllabus is the thing that actually governs the grade. A per-course scale
 *    beats everything.
 * 2. **The school.** Where a university publishes one, its pack carries it.
 * 3. **The common American table**, used as a stated assumption and labelled
 *    as one everywhere it appears. Not silently.
 *
 * ## Why `min` is optional, where the spec had it required
 *
 * Because a university can publish grade *points* without publishing
 * percentage *cutoffs*, and most do. Vanderbilt is one: the 4.0 scale and what
 * an A− is worth in it are published and stable; the percentage at which a
 * particular course awards an A− is set by the instructor. Requiring a `min`
 * on every band would mean writing a number into the school pack that the
 * school has never stated — which is the exact failure this module exists to
 * stop. So a band may carry a grade point, a cutoff, or both, and a scale with
 * no cutoffs produces no cutoff table rather than a made-up one.
 */

import type { School } from './school';

/** One step of a grading scale. Either half may be absent; see the note above. */
export interface Band {
  label: string;
  /** The lowest percentage that earns this band, where the scale states one. */
  min?: number;
  /** What this band is worth towards a GPA, where the scale states one. */
  gpa?: number;
}

export interface GradeSystem {
  kind: 'letter' | 'percent' | 'points' | 'custom';
  scale?: Band[];
  /** 4.0, 4.3, 5.0. Absent where the school has not said. */
  gpaMax?: number;
}

/**
 * The table most American syllabi use, offered as an assumption.
 *
 * Every screen that renders these says so. It is here because "we cannot show
 * you a target because your school has not published cutoffs" is a worse
 * answer than a stated assumption you can correct in two taps — and because
 * this *is* what the app showed before, unlabelled.
 */
export const COMMON_LETTER: GradeSystem = {
  kind: 'letter',
  gpaMax: 4,
  scale: [
    { label: 'A', min: 93, gpa: 4 },
    { label: 'A−', min: 90, gpa: 3.7 },
    { label: 'B+', min: 87, gpa: 3.3 },
    { label: 'B', min: 83, gpa: 3 },
    { label: 'B−', min: 80, gpa: 2.7 },
    { label: 'C+', min: 77, gpa: 2.3 },
    { label: 'C', min: 73, gpa: 2 },
    { label: 'C−', min: 70, gpa: 1.7 },
    { label: 'D+', min: 67, gpa: 1.3 },
    { label: 'D', min: 63, gpa: 1 },
    { label: 'D−', min: 60, gpa: 0.7 },
    { label: 'F', min: 0, gpa: 0 },
  ],
};

/**
 * How many bands the "what you need" table shows.
 *
 * Five. The question is what the next reachable grade costs, and a table down
 * to F answers a question nobody asks while pushing the useful rows off the
 * screen.
 */
export const TOP_BANDS = 5;

/** Where a scale came from, so the screen can say. */
export type Source = 'course' | 'school' | 'assumed';

/**
 * The scale governing one course, and where it came from.
 *
 * The source is returned rather than inferred later, because every caller
 * needs it: a cutoff from the syllabus is a fact, and the same number from
 * `COMMON_LETTER` is a guess, and they must not look alike on the screen.
 */
export function systemFor(
  courseId: string,
  overrides: Record<string, GradeSystem>,
  school: School | null,
): { system: GradeSystem; source: Source } {
  const own = overrides[courseId];
  if (own) return { system: own, source: 'course' };
  const theirs = school?.data.gradeSystem;
  if (theirs) return { system: theirs, source: 'school' };
  return { system: COMMON_LETTER, source: 'assumed' };
}

/**
 * The bands worth aiming at: those with a cutoff, highest first, top five.
 *
 * A scale that states grade points and no cutoffs comes back empty, and the
 * screen says why rather than drawing a table of invented numbers.
 */
export function targetsOf(system: GradeSystem): { label: string; at: number }[] {
  const bands = (system.scale ?? []).filter(
    (b) => typeof b.min === 'number' && Number.isFinite(b.min),
  );
  return [...bands]
    .sort((a, b) => (b.min as number) - (a.min as number))
    .slice(0, TOP_BANDS)
    .map((b) => ({ label: b.label, at: b.min as number }));
}

/** The letter a percentage earns on this scale, or '' where it cannot say. */
export function letterFor(pct: number | null, system: GradeSystem): string {
  if (pct === null || !Number.isFinite(pct)) return '';
  const bands = (system.scale ?? [])
    .filter((b) => typeof b.min === 'number')
    .sort((a, b) => (b.min as number) - (a.min as number));
  for (const b of bands) if (pct >= (b.min as number)) return b.label;
  return '';
}

/**
 * Where these numbers came from, said in the place they are shown.
 *
 * Named schools rather than "your institution", and the assumption stated as
 * an assumption with the way to fix it in the same breath — a caveat nobody
 * can act on is decoration.
 */
export function sourceLine(source: Source, school: School | null): string {
  if (source === 'course') return 'Cutoffs from this course, as you entered them.';
  if (source === 'school') {
    return `Cutoffs published by ${school?.shortName ?? school?.name ?? 'your school'}.`;
  }
  // Short because it repeats under every course. The long form of the argument
  // belongs in the module comment, not four times down one screen.
  return 'Assumed cutoffs — not from your syllabus. Set them here if it differs.';
}

/** Whether a scale is worth showing a "no targets" explanation for. */
export function hasCutoffs(system: GradeSystem): boolean {
  return targetsOf(system).length > 0;
}

/** What to say when a scale carries no cutoffs at all. */
export const NO_CUTOFFS =
  'No percentage cutoffs here — this course is marked out of points, or the scale only states grade points. Enter the cutoffs from your syllabus and the targets come back.';

/**
 * A scale from JSON, a synced row, or a newer build, made safe to render.
 *
 * Returns null rather than a repaired half-scale: an override that came back
 * malformed should fall through to the school and then to the stated
 * assumption, not become a scale with two bands in it.
 */
export function readGradeSystem(raw: unknown): GradeSystem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (kind !== 'letter' && kind !== 'percent' && kind !== 'points' && kind !== 'custom') {
    return null;
  }
  const out: GradeSystem = { kind };

  if (typeof r.gpaMax === 'number' && Number.isFinite(r.gpaMax) && r.gpaMax > 0) {
    out.gpaMax = r.gpaMax;
  }

  if (Array.isArray(r.scale)) {
    const bands: Band[] = [];
    for (const b of r.scale) {
      if (!b || typeof b !== 'object') continue;
      const row = b as Record<string, unknown>;
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      if (!label) continue;
      const band: Band = { label: label.slice(0, 12) };
      // A cutoff outside 0–100 is not a percentage, whatever it is.
      if (typeof row.min === 'number' && Number.isFinite(row.min) && row.min >= 0 && row.min <= 100) {
        band.min = row.min;
      }
      if (typeof row.gpa === 'number' && Number.isFinite(row.gpa) && row.gpa >= 0) {
        band.gpa = row.gpa;
      }
      bands.push(band);
    }
    if (bands.length > 0) out.scale = bands;
  }

  return out;
}

/** Every stored override, read safely. Malformed rows are dropped, not repaired. */
export function readOverrides(raw: unknown): Record<string, GradeSystem> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, GradeSystem> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const system = readGradeSystem(value);
    if (system) out[id] = system;
  }
  return out;
}

/**
 * A scale built from cutoffs somebody typed.
 *
 * Labels come from whatever scale they are editing, so a school that does not
 * use minus grades keeps its own letters. Blank and unreadable entries drop
 * the band rather than defaulting it to zero, which would make everything an A.
 */
export function fromTyped(
  typed: { label: string; min: string }[],
  gpaMax?: number,
): GradeSystem | null {
  const scale: Band[] = [];
  for (const t of typed) {
    const label = t.label.trim();
    if (!label) continue;
    const min = Number(t.min.trim());
    if (!t.min.trim() || !Number.isFinite(min) || min < 0 || min > 100) continue;
    scale.push({ label: label.slice(0, 12), min });
  }
  if (scale.length === 0) return null;
  return { kind: 'letter', scale, ...(gpaMax === undefined ? {} : { gpaMax }) };
}
