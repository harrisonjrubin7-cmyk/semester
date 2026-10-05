/**
 * Handoff packs: what a student hands to a human service, chosen field by
 * field.
 *
 * `advisor-meeting.ts` already has this shape for one destination — a payload
 * built from what the student ticked, shown in full, then frozen. This
 * generalises it to the rest of the services a student is sent to, without
 * becoming a second sharing system: a pack is a *list of fields the student
 * ticked, out of a fixed list for that destination*, and nothing else.
 *
 * ## The allowlist is the boundary
 *
 * Each destination names the fields it may receive. A field that is not on
 * that list cannot be in the pack however it is asked for — the financial-aid
 * office never receives a draft, the writing centre never receives a grade.
 * "Specialists receive only what is needed" is enforced here rather than
 * promised in a caption.
 *
 * ## Nothing is ticked for the student
 *
 * A pack starts empty. The values Semester already holds are offered, each with
 * its own tick, and `leftOut` says what stays private so the review screen can
 * say so. A pack with nothing ticked is not ready, rather than an empty
 * message that looks like a share.
 *
 * ## A snapshot
 *
 * `buildPack` copies the values. A later edit to a note or a draft changes
 * nothing that was handed over, and the pack says when it was made.
 */

export type Destination =
  | 'advisor'
  | 'tutor'
  | 'writing'
  | 'librarian'
  | 'career'
  | 'money'
  | 'accessibility'
  | 'international'
  | 'office-hours';

export interface FieldSpec {
  id: string;
  label: string;
}

export interface PackSpec {
  label: string;
  fields: readonly FieldSpec[];
}

const f = (id: string, label: string): FieldSpec => ({ id, label });

export const PACKS: Readonly<Record<Destination, PackSpec>> = {
  advisor: { label: 'Advisor', fields: [f('plan', 'Current plan'), f('scenarios', 'Scenarios'), f('questions', 'Questions'), f('sources', 'Requirement sources')] },
  tutor: { label: 'Tutor', fields: [f('topic', 'Topic'), f('attempted', 'Attempted work'), f('material', 'Source material'), f('goal', 'Learning goal')] },
  writing: { label: 'Writing center', fields: [f('prompt', 'Assignment prompt'), f('stage', 'Draft stage'), f('rubric', 'Rubric'), f('revision', 'Revision goal')] },
  librarian: { label: 'Librarian', fields: [f('question', 'Research question'), f('found', 'Sources found'), f('style', 'Citation style'), f('gaps', 'Gaps')] },
  career: { label: 'Career coach', fields: [f('role', 'Target role'), f('resume', 'Résumé version'), f('status', 'Application status'), f('questions', 'Questions')] },
  money: { label: 'Financial aid office', fields: [f('checklist', 'Deadline or checklist'), f('notice', 'Official notice reference'), f('questions', 'Questions')] },
  accessibility: { label: 'Accessibility office', fields: [f('barrier', 'Barrier, in your own words'), f('contact', 'Preferred contact route')] },
  international: { label: 'International office', fields: [f('checklist', 'Checklist status'), f('deadlines', 'Official deadlines'), f('questions', 'Questions')] },
  'office-hours': { label: 'Faculty office hours', fields: [f('topic', 'Course topic'), f('attempted', 'Attempted examples'), f('references', 'Source references')] },
};

export const DESTINATIONS = Object.keys(PACKS) as Destination[];

/** Values the student holds, by field id. Blank means nothing to hand over. */
export type Available = Readonly<Record<string, string | undefined>>;

export interface Pack {
  destination: Destination;
  label: string;
  /** When it was made. A later edit does not change it. */
  madeAt: number;
  fields: readonly { id: string; label: string; value: string }[];
}

const has = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * The pack for one destination: only ticked fields, only ones that
 * destination may receive, only ones with something in them. Null when that
 * leaves nothing.
 */
export function buildPack(destination: Destination, available: Available, ticked: ReadonlySet<string>, now: number): Pack | null {
  const spec = PACKS[destination];
  const fields = spec.fields
    .filter((s) => ticked.has(s.id) && has(available[s.id]))
    .map((s) => ({ id: s.id, label: s.label, value: (available[s.id] as string).trim() }))
    .map((x) => Object.freeze(x));
  if (fields.length === 0) return null;
  return Object.freeze({ destination, label: spec.label, madeAt: now, fields: Object.freeze(fields) }) as Pack;
}

/** What could have been handed over and is not, so the review says so. */
export function leftOut(destination: Destination, available: Available, ticked: ReadonlySet<string>): string[] {
  return PACKS[destination].fields.filter((s) => has(available[s.id]) && !ticked.has(s.id)).map((s) => s.label);
}

/** The pack as it would be read out, in full, before anything is sent. */
export function previewLines(pack: Pack): string[] {
  return [`For: ${pack.label}`, ...pack.fields.map((x) => `${x.label}: ${x.value}`)];
}
