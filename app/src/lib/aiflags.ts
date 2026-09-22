/**
 * What a university may switch off in the assistant, one category at a time.
 *
 * A school could already turn the assistant off entirely — no key, no
 * assistant — and that is the only control it had. It is a bad control,
 * because the question a university actually asks in procurement is never
 * "may students use AI" but "may it see the grade book". Those are different
 * questions and until now the app could only answer the first.
 *
 * ## The categories are what `lib/context.ts` actually assembles
 *
 * Each one below names a block that file really builds, and switching it off
 * stops that block being built. That constraint is deliberate and it is the
 * whole reason this list is six long rather than the ten in the brief that
 * suggested it: `ai_registration` would be a switch over a feature this app
 * does not have, and a console full of switches that govern nothing is worse
 * than no console — it is a promise to a university that nothing keeps.
 *
 * When a registration path exists, it gets a line here and a gate in `build`
 * on the same day, or it does not ship.
 *
 * ## Off, never on
 *
 * The list a school configures is the list of what it has **turned off**, so a
 * school that has configured nothing behaves exactly as it does today. The
 * alternative — an allowlist of enabled categories — reads stricter and would
 * have silently emptied the assistant for every existing user the moment this
 * shipped, including the schools that never asked for any of it.
 *
 * A university that wants deny-by-default gets it by naming every category,
 * which is a thing a console can offer in one button and a default cannot
 * safely be.
 *
 * ## Where the list comes from
 *
 * `Capabilities`, on the school — the same bag that already says whether there
 * is a meal plan and what the registrar is called, delivered by the same pack
 * a university already supplies. There is no second configuration system and
 * no new table: `lib/school.ts` is where a school says what it has, and this
 * is a thing a school has.
 */

/** A category of what may travel with a question. Fixed: `build` gates each one. */
export type AiOff =
  | 'screen'
  | 'deadlines'
  | 'grades'
  | 'attendance'
  | 'coursework'
  | 'courses';

/** The categories, with what a university is actually deciding about each. */
export const AI_CATEGORIES: { id: AiOff; label: string; blurb: string }[] = [
  {
    id: 'screen',
    label: 'What is on screen',
    blurb: 'The summary and visible rows of the screen the question was asked from.',
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    blurb: 'Titles, dates and weights of work due in the window the question names.',
  },
  {
    id: 'grades',
    label: 'Grades',
    blurb: 'Marks and component weights for a course the question names.',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    blurb: 'Presence counts against the course policy.',
  },
  {
    id: 'coursework',
    label: 'Course material',
    blurb: 'Unit names and how well each is known.',
  },
  {
    id: 'courses',
    label: 'Course list',
    blurb: 'Which courses are being taken — codes and titles, never contents.',
  },
];

/** Whether a string names a category. Narrow, so a pack's value can be trusted after. */
export function isAiOff(value: string): value is AiOff {
  return AI_CATEGORIES.some((c) => c.id === value);
}

/**
 * A pack's list, made safe.
 *
 * Anything unrecognised is dropped rather than kept: a school pack is
 * user-supplied data, and a typo like `grade` must not silently become a
 * category nothing gates. Dropping it means the category stays **on**, which
 * is the unsafe direction — so `offLine` below prints what was understood, and
 * a console shows that back rather than echoing what was typed.
 */
export function readAiOff(raw: unknown): AiOff[] {
  if (!Array.isArray(raw)) return [];
  const out: AiOff[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim().toLowerCase();
    if (isAiOff(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Whether this category may travel.
 *
 * The one question `lib/context.ts` asks. Written as a function rather than a
 * `.includes` at each of six call sites so that there is one place to read,
 * and one place a test can prove is consulted.
 */
export function aiAllows(off: readonly AiOff[] | undefined, what: AiOff): boolean {
  return !off?.includes(what);
}

/** What a school has switched off, for a screen to show. Empty when nothing is. */
export function offLine(off: readonly AiOff[] | undefined): string {
  if (!off || off.length === 0) return '';
  const names = AI_CATEGORIES.filter((c) => off.includes(c.id)).map((c) => c.label.toLowerCase());
  if (names.length === 1) return `Your university has switched off ${names[0]}.`;
  const last = names[names.length - 1];
  return `Your university has switched off ${names.slice(0, -1).join(', ')} and ${last}.`;
}
