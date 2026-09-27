import { agoLine } from './profile';

/**
 * Where a fact on screen came from, in the five words the whole app uses.
 *
 * Every figure Semester shows was either checked by the institution, pulled in
 * from a file or feed, typed by the student, worked out by the app, or is
 * known to be doubtful. A student deciding what to register for needs to tell
 * those apart at a glance, and until now each screen said it its own way:
 * registration day wrote "Source: Student entered" in a sentence, the skills
 * graph had its own three-value enum, the Today briefing a free-text string.
 *
 * These five are **the same five the database enforces** — the check
 * constraint on `term_plan_courses.source_label` and
 * `registration_time_tickets.source_label` in
 * `supabase/migrations/20260926150000_expansion_roles_and_features.sql`.
 * `source.test.ts` reads that migration and fails if the two lists drift, so
 * a value can travel from a device store to a row and back without a
 * translation table in between.
 */
export const SOURCE_LABELS = [
  'institution_verified',
  'imported',
  'student_entered',
  'estimated',
  'needs_review',
] as const;

export type SourceLabel = (typeof SOURCE_LABELS)[number];

export function isSourceLabel(value: unknown): value is SourceLabel {
  return typeof value === 'string' && (SOURCE_LABELS as readonly string[]).includes(value);
}

/** What a student reads. Sentence case, no jargon, never "verified" unless it was. */
export const SOURCE_TEXT: Record<SourceLabel, string> = {
  institution_verified: 'Institution verified',
  imported: 'Imported',
  student_entered: 'Student entered',
  estimated: 'Estimated',
  needs_review: 'Needs review',
};

/** One sentence on what the label means, for a tooltip or a screen reader. */
export const SOURCE_MEANING: Record<SourceLabel, string> = {
  institution_verified: 'Confirmed by your institution’s own system.',
  imported: 'Copied in from a file or feed. Semester has not checked it with your institution.',
  student_entered: 'You typed this in. Semester has not checked it with your institution.',
  estimated: 'Worked out by Semester from what it knows. Not an official figure.',
  needs_review: 'Something about this looks wrong or out of date. Check it before relying on it.',
};

/**
 * Labels that should draw the eye. An estimate or a doubtful figure is the
 * one a student is most likely to over-trust, so it is the one styled to be
 * noticed — the opposite of the usual rule that official things look louder.
 */
export function wantsAttention(label: SourceLabel): boolean {
  return label === 'estimated' || label === 'needs_review';
}

/**
 * "Updated 3 days ago", or nothing when the time is not known.
 *
 * `agoLine` answers "just now" for a missing time, which is right for a sync
 * that has just happened and wrong here: a source with no time on it has an
 * unknown age, and saying "just now" would make it look fresher than
 * anything else on the screen.
 */
export function freshnessLine(at: number | null | undefined, now = Date.now()): string | null {
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return null;
  if (at > now) return 'Updated just now';
  return `Updated ${agoLine(at, now)}`;
}

/** The whole label as one string, for places that cannot render the badge. */
export function sourceLine(label: SourceLabel, at?: number | null, now = Date.now()): string {
  const fresh = freshnessLine(at, now);
  return fresh ? `${SOURCE_TEXT[label]} · ${fresh}` : SOURCE_TEXT[label];
}
