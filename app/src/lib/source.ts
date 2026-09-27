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
 * What the badge can say: the five above, and two that never reach a row.
 *
 * The UI constitution (`docs/design/SEMESTER-UI-CONSTITUTION.md` §7) asks for
 * one trust vocabulary everywhere, and two kinds of content had their own:
 * an assistant answer said "Inference" in `intelligence/Disclosure.tsx`, and
 * nothing said that a fact came from outside the institution and outside the
 * student. These two join the five **for display only**. `SOURCE_LABELS` is
 * unchanged, because it is the database's check constraint and
 * `source.test.ts` holds it to the migration; an AI answer or a web page is
 * never stored as a `source_label`, so it never needs to be one.
 */
export const TRUST_KINDS = [...SOURCE_LABELS, 'ai_assisted', 'external'] as const;

export type TrustKind = (typeof TRUST_KINDS)[number];

export const TRUST_TEXT: Record<TrustKind, string> = {
  ...SOURCE_TEXT,
  ai_assisted: 'AI-assisted',
  external: 'External',
};

export const TRUST_MEANING: Record<TrustKind, string> = {
  ...SOURCE_MEANING,
  ai_assisted: 'Written with Semester’s assistant. It is not an official answer — check anything you act on.',
  external: 'From a source outside your institution and outside Semester, such as a web page.',
};

/**
 * Labels that should draw the eye. An estimate or a doubtful figure is the
 * one a student is most likely to over-trust, so it is the one styled to be
 * noticed — the opposite of the usual rule that official things look louder.
 */
export function wantsAttention(label: TrustKind): boolean {
  // An AI answer is the newest thing a student might over-trust, so it is
  // styled with the estimates rather than with the records.
  return label === 'estimated' || label === 'needs_review' || label === 'ai_assisted';
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
