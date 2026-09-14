/**
 * What a new sheet and a new deck start as — and nothing else.
 *
 * ## Why these two functions have a file of their own
 *
 * They are twenty-nine lines between them, and they were costing the app a
 * thousand lines of first paint.
 *
 * `state/slices/made.ts` is part of the reducer, so it is reached from
 * `state/store.tsx` on the way to the first render, statically, always. It
 * imported `blankSheet` from `lib/sheet.ts` — a 2,239-line spreadsheet engine
 * with a formula parser in it — and `blankDeck` from `lib/decks.ts`, which
 * imports a palette constant from `lib/pptx.ts`, a .pptx serialiser. So
 * creating the *option* of a new sheet meant a student who had never opened
 * one still downloaded and evaluated the engine that recalculates it and the
 * writer that exports it, before Today was drawn.
 *
 * A module is the unit a bundler can split on. Two factories that need
 * nothing but a title, a date and two numbers do not belong inside the two
 * largest things in `lib/`.
 *
 * ## What this file may import
 *
 * Types, and nothing else. `import type` is erased at build, so naming `Sheet`
 * and `StoredDeck` here costs nothing and keeps the shapes defined where they
 * are documented. The moment something in here needs a *value* out of
 * `sheet.ts` or `decks.ts`, the saving is gone and it belongs back there
 * instead.
 *
 * `sheet.ts` and `decks.ts` re-export what moved, so every existing caller is
 * unchanged and the engine remains the one place you look for the sheet. Only
 * the reducer reaches past them, and only because it must not pull them in.
 *
 * See `ENGINEERING-AUDIT.md` §1.
 */

import type { CourseId } from './types';
import type { Sheet } from './sheet';
import type { StoredDeck } from './decks';

/** The size a new sheet opens at: enough to look like a sheet, small enough to read. */
export const NEW_ROWS = 12;
export const NEW_COLS = 6;

export function blankSheet(
  title: string,
  courseId: CourseId | null = null,
  itemId: string | null = null,
): Omit<Sheet, 'id'> {
  return {
    title: title.trim() || 'Untitled sheet',
    courseId,
    itemId,
    cells: {},
    rows: NEW_ROWS,
    cols: NEW_COLS,
    created: Date.now(),
    updated: Date.now(),
  };
}

export function blankDeck(
  title: string,
  courseId: CourseId | null = null,
  itemId: string | null = null,
): Omit<StoredDeck, 'id'> {
  const now = Date.now();
  return {
    title: title.trim() || 'Untitled deck',
    subtitle: '',
    slides: [{ title: title.trim() || 'Untitled deck', bullets: [], opening: true }],
    courseId,
    itemId,
    created: now,
    updated: now,
    hidden: [],
    theme: 'ink',
  };
}
