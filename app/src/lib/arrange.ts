/**
 * Arranging a list by dragging it, wherever a list has an order.
 *
 * The calendar stopped being a printout when things on it could be moved. The
 * rest of the app had not caught up: every ordered list in it — the bottom
 * bar, your courses, the sections of Today, the tiles on a shelf, the
 * directory — was arranged with a pair of ↑ ↓ buttons, one tap per position.
 * Moving a course from sixth to first is five taps and five re-renders of a
 * list that has already moved under your thumb.
 *
 * A list you can only nudge is a list nobody rearranges. So the same gesture
 * the calendar uses moves a row here: hold it, drag it where it goes, let go.
 *
 * ## The arrows stay
 *
 * All of them. A drag is not available to everybody — a keyboard, a switch, a
 * screen reader and a shaky hand all need the other control, and the arrows
 * are also the only *visible* sign that a list has an order at all. So this
 * adds a gesture and removes nothing, and adds Alt with the arrow keys on top
 * so the keyboard has the fast version too.
 *
 * ## One implementation of "it moved"
 *
 * There were four before this: `launcher.reorder`, `yours.reorder`,
 * `feed.move` and `tabbar.moveTab`, each splicing or swapping an array by
 * hand, one of them written as a swap and the other three as a splice. At one
 * step apart those agree, which is exactly why the difference survived — it
 * was invisible until something dropped a row two places instead of one.
 * Both operations live here now and those four call them.
 *
 * The two are genuinely different operations, not one with a parameter:
 *
 * - {@link dropped} is a drag. The row lands *at* the position it was dropped
 *   on and everything else shifts, so dragging the last row onto the first
 *   makes it first. A swap would exchange two rows at opposite ends of a list
 *   and leave the middle alone, which is not what the finger just described.
 * - {@link nudged} is an arrow. One step, clamped at the ends.
 */

import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { useDragToMove } from './drag';

/**
 * `moved` takes `target`'s place; everything between them shifts by one.
 *
 * Returns the list unchanged — the same array, so a caller can skip a write —
 * when the move is a no-op or names something that is not in the list. A
 * stale id is the ordinary case rather than an error: a drop can land on a
 * row that has just been filtered out from under it.
 */
export function dropped<T>(list: readonly T[], moved: T, target: T): T[] {
  // The same array back, so `next !== list` is how a caller skips the write.
  if (moved === target) return list as T[];
  const from = list.indexOf(moved);
  const to = list.indexOf(target);
  if (from < 0 || to < 0) return list as T[];
  const out = list.filter((x) => x !== moved);
  out.splice(to, 0, moved);
  return out;
}

/** One step along the list, clamped at both ends. The arrows' arithmetic. */
export function nudged<T>(list: readonly T[], item: T, step: number): T[] {
  const from = list.indexOf(item);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return list as T[];
  const out = [...list];
  out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/**
 * An arrangement of several named lists, as one string.
 *
 * `Semester:home,brief|Courses:courses,import` — the format the launcher's
 * shelf order already used, lifted out of it because the home screen's pages,
 * its folders and its dock all need the same thing: a preference *over* a
 * built-in order, small enough to live in a look key.
 *
 * A saved arrangement is never an inventory. Reading it back is deliberately
 * forgiving — an unparseable chunk is dropped rather than trusted — and the
 * lists it names are resolved against whatever the app actually offers today,
 * by the caller. That is what makes a stale string harmless: at worst it
 * arranges things oddly, and it can never hide one.
 */
const LIST_SEP = '|';
const NAME_SEP = ':';
const ITEM_SEP = ',';

export function readLists(saved: string | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!saved) return out;
  for (const chunk of saved.split(LIST_SEP)) {
    const at = chunk.indexOf(NAME_SEP);
    if (at < 0) continue;
    const name = chunk.slice(0, at).trim();
    if (!name) continue;
    const items = chunk
      .slice(at + 1)
      .split(ITEM_SEP)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) out[name] = items;
  }
  return out;
}

/** Back to the string. An empty list is left out rather than written blank. */
export function writeLists(lists: Record<string, readonly string[]>): string {
  return Object.entries(lists)
    .filter(([, items]) => items.length > 0)
    .map(([name, items]) => `${name}${NAME_SEP}${items.join(ITEM_SEP)}`)
    .join(LIST_SEP);
}

/**
 * Everything on offer, with the saved order first and the rest behind it.
 *
 * The rule every arrangement in the app follows, in one place: what exists is
 * decided by the app, and only the sequence is the person's. A screen the
 * school gate has switched off does not come back because an old order names
 * it; one added since the order was saved appears at the end rather than not
 * at all; a name that is no longer anything is dropped.
 */
export function arranged<T>(all: readonly T[], wanted: readonly T[]): T[] {
  const left = new Set(all);
  const first: T[] = [];
  for (const item of wanted) {
    // The delete is what stops a name written twice drawing the thing twice.
    if (!left.delete(item)) continue;
    first.push(item);
  }
  return [...first, ...all.filter((item) => left.has(item))];
}

/**
 * What a row says it is, for a screen reader that cannot see it move.
 *
 * Appended to the row's own label rather than replacing it: "Econ 1020.
 * Hold to drag, or Alt with the arrow keys, to move it."
 */
export const MOVE_HINT = 'Hold to drag, or Alt with the arrow keys, to move it.';

/** The properties a movable row merges into its own. */
export interface RowExtras {
  style?: CSSProperties;
  className?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export interface Movable<T extends string> {
  /** Spread onto the element that is the row. Merges what you pass it. */
  props: (id: T, extra?: RowExtras) => {
    'data-drop': T;
    className: string;
    style: CSSProperties | undefined;
    onKeyDown: (e: KeyboardEvent) => void;
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  /** The row in your hand, and the one it would take the place of. */
  held: T | null;
  over: T | null;
  /**
   * Whether the click about to fire is the tail of a drop.
   *
   * A pointer sequence that moved a row still ends in a click, and a row that
   * is also a link would follow it. Rows that do something when tapped read
   * this first and stand down. Reading it clears it.
   */
  tookDrop: () => boolean;
}

/**
 * The hook a list of movable rows uses.
 *
 * `items` is the order as *drawn*, which is not always the order as stored: a
 * saved order can be partial, or name something the school gate has since
 * switched off. Dragging within what is on screen and writing the whole of it
 * back is what keeps a drop landing where the finger was.
 */
export function useMovable<T extends string>({
  items,
  onMove,
  disabled,
}: {
  items: readonly T[];
  onMove: (next: T[]) => void;
  disabled?: boolean;
}): Movable<T> {
  const settle = (next: T[]) => {
    // Never the same array: `dropped` and `nudged` hand back what they were
    // given when the move is a no-op, which is what makes this cheap.
    if (next !== items) onMove(next);
  };

  const { handlers, held, over, tookDrop } = useDragToMove<T>({
    disabled,
    onDrop: ({ payload, target }) => {
      if (!target) return;
      settle(dropped(items, payload, target as T));
    },
  });

  return {
    held,
    over: over as T | null,
    tookDrop,
    props: (id, extra) => {
      const drag = handlers(id);
      const state =
        held === id ? ' is-held'
        : over === id && held !== null ? ' is-over'
        : '';
      return {
        ...drag,
        'data-drop': id,
        className: `movable${state}${extra?.className ? ` ${extra.className}` : ''}`,
        style: extra?.style || drag.style ? { ...extra?.style, ...drag.style } : undefined,
        onKeyDown: (e: KeyboardEvent) => {
          extra?.onKeyDown?.(e);
          if (e.defaultPrevented || disabled || !e.altKey) return;
          // Up and left both mean earlier, down and right both mean later, so
          // one hook serves a column of rows and a grid of tiles without
          // either having to say which it is.
          const step =
            e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1
            : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
            : 0;
          if (step === 0) return;
          e.preventDefault();
          settle(nudged(items, id, step));
        },
      };
    },
  };
}
