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
  action?: 'search' | 'back' | 'help' | 'timer' | 'capture' | 'assistant';
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
  /*
   * The assistant, not the Ask screen.
   *
   * It used to open `ask`, and for a while both were true: this navigated
   * there while the assistant's own listener opened its sheet on the same
   * key. So `a` took you off the screen you were looking at and then opened a
   * panel that said "Looking at: Ask Claude" — the one thing the app-wide
   * assistant exists to avoid. The sheet is the thing worth a key; the screen
   * behind it is settings, and settings are somewhere you go on purpose.
   */
  { key: 'a', does: 'Ask about this screen', action: 'assistant' },
  { key: 'n', does: 'Add a course from a syllabus', screen: 'import' },
  { key: 'q', does: 'Add something in one line', action: 'capture' },
  { key: '/', does: 'Search everything', action: 'search' },
  { key: 'escape', does: 'Back', action: 'back' },
  { key: '?', does: 'This list', action: 'help' },
];

/**
 * Whether a dialog has claimed the page.
 *
 * `aria-modal="true"` says that everything outside this element is not there.
 * A screen reader believes it; the keyboard did not — `Keys` listens on the
 * window, so with the app launcher open on a laptop, `/` opened the search
 * palette *behind* the launcher, and `t` walked to Today under it. Whichever
 * you then closed, you were somewhere you had not asked to be.
 *
 * Read off the document rather than off the event's target, and both halves
 * matter. A dialog whose focus is still settling leaves the target on
 * `<body>`, which is outside the dialog by ancestry and would let the
 * shortcut through; and this is the promise the attribute makes about the
 * whole page, not about one element's subtree. The dialogs that hold a field
 * were already safe by `typing()` below — this is for the ones that do not,
 * which is every sheet made of buttons.
 *
 * `aria-modal="false"` is not caught, which is right: the shortcut sheet
 * itself carries that, and `?` has to keep closing it.
 */
export function underModal(doc?: Document): boolean {
  const d = doc ?? (typeof document === 'undefined' ? null : document);
  return Boolean(d?.querySelector('[role="dialog"][aria-modal="true"]'));
}

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
 * null while typing, because those belong to the sentence, and null under a
 * modal dialog, because that dialog has said the rest of the page is not
 * there.
 */
export function shortcutFor(
  e: {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    target?: EventTarget | null;
  },
  /** The document to ask about open dialogs. Passed only by the test. */
  doc?: Document,
): Shortcut | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  /*
   * Escape included, and that is the point rather than an oversight. A dialog
   * with a way out handles its own — `a11y/modal.ts` stops the event before
   * it reaches the window — and `Adopting`, the one with no way out, would
   * otherwise have had Escape navigate the app behind the question it is
   * waiting on.
   */
  if (underModal(doc)) return null;

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
