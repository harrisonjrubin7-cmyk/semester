/**
 * Which sections are folded shut, and what that is worth remembering.
 *
 * Every screen in this app is a stack of sections under uppercase headings —
 * `SectionLabel` draws about three hundred of them — and on the long screens
 * that stack is the whole problem. Today is five sections; a course is nine;
 * the guide is however many units the syllabus had. Somebody who only wants
 * tonight's reading scrolls past four sections to reach it, every time, and
 * the app has no way of being told that four of those five are not what they
 * came for.
 *
 * So a heading is now a control: tap it and its section folds away, leaving
 * the heading as a one-line summary of what is underneath. That is the whole
 * feature. What is in this file is the part that has no React in it — the
 * naming of a section, the set of the ones that are shut, and the write to
 * the device — so the rules can be tested without a browser. The React half
 * is `folds.hook.ts` and the drawing is `components/Fold.tsx`.
 *
 * ## Open is the default, and only the shut ones are stored
 *
 * The set holds what somebody has *closed*, never what they have left alone.
 * That matters for two reasons. A new device, a cleared browser or a screen
 * nobody has touched shows everything, which is the app as it was — folding
 * can only ever be something you did on purpose. And a section added to a
 * screen next month appears open rather than inheriting the state of whatever
 * heading happened to sit at its index.
 *
 * ## On the device, not in the account
 *
 * Alongside `semester.seen` and the drafts, and for the same reason: which
 * sections you have folded on the phone in a lecture is not a fact about you
 * that the laptop should be told. It also keeps this out of the store's
 * budget, which is holding notes and deadlines and has better uses for the
 * room.
 */

export const FOLDS_KEY = 'semester.folds';

/** The keys of the sections that are shut. Everything absent is open. */
export type Folds = Readonly<Record<string, true>>;

/**
 * As many folded sections as are worth carrying.
 *
 * A ceiling rather than a guess at a number somebody would reach: fifty
 * screens with a handful of sections each is a couple of hundred, so this is
 * generous for a person and still bounded against the one case that is not a
 * person — a screen that names its sections after data, folded once each,
 * every term, forever.
 */
export const MOST = 500;

/**
 * A section's name, as a key that survives a reload.
 *
 * The screen it is on and what its heading says, rather than where it sits.
 * An index would be shorter and would be wrong the first time a section moved
 * or a conditional one appeared above it: you would fold "What's coming" and
 * come back to find "Today's schedule" shut instead. Two sections on one
 * screen that genuinely say the same words are told apart by `nth`, which is
 * the only case where position gets a say.
 */
export function foldKey(scope: string, label: string, nth = 0): string {
  const said = label.trim().replace(/\s+/g, ' ').toLowerCase();
  const stem = `${scope}${NAMED}${said || '§'}`;
  return nth > 0 ? `${stem}${NAMED}${nth + 1}` : stem;
}

/** Between a scope and what a heading says. `/` separates one scope from another. */
const NAMED = '·';

/**
 * Is this section on that screen — or in something drawn on it?
 *
 * A screen's own sections are named `home·what’s coming`; a component it
 * drops in names its own `home/YourCourses·this week`. Both belong to Today,
 * which is what "collapse all" has to mean: everything in front of you, not
 * everything the screen literally wrote itself.
 */
export function inScope(key: string, scope: string): boolean {
  if (scope === '') return true;
  return key.startsWith(`${scope}${NAMED}`) || key.startsWith(`${scope}/`);
}

/** The folded sections belonging to one screen. */
export function foldedIn(folds: Folds, scope: string): string[] {
  return Object.keys(folds).filter((key) => inScope(key, scope));
}

/** What was on the device, defended against anything that is not this. */
export function readFolds(raw: string | null): Folds {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    const out: Record<string, true> = {};
    for (const key of parsed.slice(0, MOST)) if (typeof key === 'string' && key) out[key] = true;
    return out;
  } catch {
    // Somebody else's key, or a half-written value. An unreadable memory of
    // which sections were shut is a screen with everything open, which is
    // the app working.
    return {};
  }
}

/** The set as it goes to disk. An array, because a Set does not serialise. */
export function writeFolds(folds: Folds): string {
  return JSON.stringify(Object.keys(folds).slice(0, MOST));
}

/** Is this one shut? */
export function isFolded(folds: Folds, key: string): boolean {
  return folds[key] === true;
}

/**
 * The set with one section shut or opened.
 *
 * Opening deletes the key rather than storing `false`, so the file holds only
 * what was done on purpose and a section nobody has ever touched costs
 * nothing.
 */
export function setFold(folds: Folds, key: string, shut: boolean): Folds {
  if (shut === isFolded(folds, key)) return folds;
  const next = { ...folds };
  if (shut) next[key] = true;
  else delete next[key];
  return trim(next);
}

/** The same, for the whole screen at once. */
export function setFolds(folds: Folds, keys: readonly string[], shut: boolean): Folds {
  let next: Folds = folds;
  for (const key of keys) next = setFold(next, key, shut);
  return next;
}

/**
 * What the "all" control should do next, and what it should say it does.
 *
 * One button rather than two, and it offers the move that changes something:
 * while anything on the screen is open it collapses, and once everything is
 * shut it is the way back. A screen with a single section does not get one at
 * all — a control that folds one thing is the thing's own heading.
 */
export function nextForAll(folds: Folds, keys: readonly string[]): { shut: boolean; said: string } {
  const anyOpen = keys.some((k) => !isFolded(folds, k));
  return anyOpen ? { shut: true, said: 'Collapse all' } : { shut: false, said: 'Expand all' };
}

/**
 * The set after "all" was pressed on one screen.
 *
 * Collapsing shuts what is on screen. Opening drops every fold the screen
 * has, on screen or not — a section inside one that is itself shut is not
 * visible to count, and leaving it folded would mean pressing "Expand all",
 * watching sections appear still folded, and pressing it again.
 */
export function allIn(folds: Folds, scope: string, shown: readonly string[], shut: boolean): Folds {
  return shut ? setFolds(folds, shown, true) : setFolds(folds, foldedIn(folds, scope), false);
}

/** Keep the set under the ceiling. Oldest first, which is insertion order. */
function trim(folds: Record<string, true>): Folds {
  const keys = Object.keys(folds);
  if (keys.length <= MOST) return folds;
  const out: Record<string, true> = {};
  for (const key of keys.slice(keys.length - MOST)) out[key] = true;
  return out;
}
