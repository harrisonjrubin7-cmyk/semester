import { DESTINATIONS } from './nav';

/**
 * One field for search, ask and add.
 *
 * The UI constitution (§12, decision 4) asks for a single entry point: "Ask
 * Semester, search, or add something…". The search palette
 * (`components/Command.tsx`) already searched, and its Ask button already
 * handed the text to the assistant. What it could not do was add: somebody
 * typing "add lab report friday" into the one box the app offers got a
 * results page for the word "add". This is the part that tells the two apart.
 *
 * ## Only an explicit verb
 *
 * An add is recognised only when the text opens with a verb that means it —
 * "add …", "create a task: …", "remind me to …" — and never from the shape of
 * the rest. "Lab report friday" is a search, because a search that quietly
 * files a task is worse than one that asks for a second keystroke. "New" is
 * not a verb here, because "new york" is a search. "Create" alone is not one
 * either: Create is a screen.
 *
 * And an add that is really the name of a screen is still a search: "add a
 * course" and "add a reading" are what the importer and the reading screen are
 * called, and somebody typing a screen's name is looking for it.
 */

const ADD =
  /^\s*(?:add|create\s+(?:an?\s+)?(?:task|reminder|to-?do)|remind\s+me(?:\s+to)?)\b[\s:,-]*(?:(?:an?\s+)?(?:task|reminder|to-?do)\b[\s:,-]*)?(.*)$/i;

/** Every screen's name, lower-cased — "Add a course" among them. */
const NAMED = new Set(DESTINATIONS.map((d) => d.label.toLowerCase()));

/**
 * What to capture, when the text asks to add something; `null` when it is a
 * search. The verb is taken off so the capture box opens on the thing itself.
 */
export function addIntent(text: string): string | null {
  const t = text.trim();
  if (NAMED.has(t.toLowerCase())) return null;
  const m = ADD.exec(t);
  if (!m) return null;
  const rest = m[1].trim();
  return rest === '' ? null : rest;
}

/*
 * The hand-off from the field to the capture box.
 *
 * The box opens as its own overlay (`state.quickAdd`) and mounts fresh, so the
 * text has to be waiting for it rather than passed as a prop through the
 * three layouts that mount it. Taken once: a box opened later from the `+`
 * starts empty, as it always has.
 */
let waiting = '';

export function seedQuickAdd(text: string): void {
  waiting = text;
}

export function takeQuickAddSeed(): string {
  const was = waiting;
  waiting = '';
  return was;
}

/** Navigation only: exact phrases open reviewable workflows, never execute them. */
const NAVIGATION_COMMANDS: Readonly<Record<string, import('./types').Screen>> = {
  'find my next deadline': 'home',
  'open my fall plan': 'degree',
  'open my spring plan': 'degree',
  'prepare my advisor agenda': 'meet',
  'prepare meeting packet': 'meet',
  'add a study block': 'calendar',
  'create study block': 'calendar',
  'find tutoring': 'support',
  'compare course options': 'degree',
  'show my shared items': 'meet',
  'open privacy controls': 'privacy',
  'report incorrect information': 'support',
};

export function navigationIntent(text: string): import('./types').Screen | null {
  const phrase = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(NAVIGATION_COMMANDS, phrase) ? NAVIGATION_COMMANDS[phrase] : null;
}
