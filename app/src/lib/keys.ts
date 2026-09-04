/**
 * Keys, for the half of the term spent at a laptop.
 *
 * The app was built thumb-first and it shows: everything is a tap target, the
 * navigation is a bar along the bottom, and on a desktop that means reaching
 * for a mouse to do things a keyboard does in one stroke. Somebody with a
 * paper open in one window and this in another switches between them forty
 * times an evening.
 *
 * ## Nothing is bound that a person might type
 *
 * Single letters are the fastest thing to press and the easiest thing to break
 * with. `?` and `/` and a bare `g` are all characters that belong in a note, a
 * question to Claude, or a course name — so the first rule here is that no
 * shortcut fires while the caret is in a field. That check is `typing()`, and
 * it covers inputs, textareas, selects and anything a browser has made
 * editable, because a rich-text field is not an `<input>` and losing a
 * sentence to a stray `n` is exactly the kind of thing that makes somebody
 * stop trusting an app.
 *
 * ## And nothing the browser has already claimed
 *
 * A shortcut carrying Meta or Control is the browser's, or the operating
 * system's. Rebinding those wins an argument nobody asked to have — ⌘L is the
 * address bar in every window a student has open, and an app that steals it is
 * an app they will find a way to avoid.
 */

import type { Screen } from './types';

export interface Shortcut {
  /** The key as `KeyboardEvent.key` reports it, lower case. */
  key: string;
  /** What it does, in the second person, for the help sheet. */
  does: string;
  /** A screen to open, for the plain navigation ones. */
  screen?: Screen;
  /** A named action for the ones that are not navigation. */
  action?: 'search' | 'back' | 'help' | 'timer' | 'capture';
}

/**
 * The bindings.
 *
 * Deliberately few. A list of thirty shortcuts is a list nobody learns; these
 * are the handful somebody would reach for without being told, plus the two
 * that make the rest discoverable — `?` for the sheet and Escape to leave it.
 */
export const SHORTCUTS: Shortcut[] = [
  { key: 't', does: 'Today', screen: 'home' },
  { key: 'c', does: 'Courses', screen: 'courses' },
  { key: 's', does: 'Study', screen: 'study' },
  { key: 'k', does: 'The calendar', screen: 'calendar' },
  { key: 'm', does: 'Mine — your tasks, notes and files', screen: 'mine' },
  { key: 'a', does: 'Ask Claude about this course', screen: 'ask' },
  { key: 'n', does: 'Add a course from a syllabus', screen: 'import' },
  { key: 'q', does: 'Add something in one line', action: 'capture' },
  { key: '/', does: 'Search everything', action: 'search' },
  { key: 'escape', does: 'Back', action: 'back' },
  { key: '?', does: 'This list', action: 'help' },
];

/**
 * Whether the caret is somewhere a keystroke means a character.
 *
 * `contentEditable` is checked separately from the tag names: a note editor
 * built on a div is still typing, and treating it as not-typing would eat a
 * letter out of the middle of a sentence.
 */
export function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * The shortcut a keystroke means, or null.
 *
 * Null for every modifier combination, because those belong to the browser,
 * and null while typing, because those belong to the sentence.
 */
export function shortcutFor(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | null;
}): Shortcut | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  const key = e.key.toLowerCase();
  // Escape is the exception to the typing rule, and has to be: it is how you
  // get out of a field, and a search box you cannot escape from is a trap.
  if (key !== 'escape' && typing(e.target ?? null)) return null;

  return SHORTCUTS.find((s) => s.key === key) ?? null;
}

/** How a key is drawn on the help sheet. */
export function keyLabel(key: string): string {
  if (key === 'escape') return 'Esc';
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key;
}
