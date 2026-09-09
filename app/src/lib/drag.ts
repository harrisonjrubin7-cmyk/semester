import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Moving something by dragging it, on a phone and on a laptop.
 *
 * The calendar had no drag handler anywhere in it. To move a task you left the
 * calendar, found the task, opened it and typed a date — on the one screen
 * whose whole subject is *when things are*. A calendar you cannot move things
 * on is a printout.
 *
 * ## Pointer events, not HTML5 drag-and-drop
 *
 * `dragstart` never fires on touch. A phone-first app whose only move gesture
 * works on a laptop has not shipped the feature, and the calendar's own code
 * said as much — the day view's task row carries a comment arguing that a drag
 * would be desktop-only and so two arrow buttons were the honest answer. The
 * arrows were right and they stay; the premise about drag was about the wrong
 * API. Pointer events are one code path for mouse, touch and pen, and
 * `setPointerCapture` keeps the gesture attached to the element even when the
 * finger leaves it.
 *
 * ## Starting a drag is deliberate
 *
 * On touch, a press has to last {@link HOLD_MS} before it becomes a drag, and
 * any movement past {@link SLOP} before then is a scroll — because a finger on
 * a calendar is usually scrolling it, and a grid that grabbed a cell the
 * instant it was touched would be unusable. With a mouse there is no scroll to
 * protect, so {@link SLOP} pixels of movement is enough and there is no wait.
 *
 * `touch-action: none` goes on the dragged element *only while it is held*.
 * Set permanently it would stop the page scrolling under the finger.
 *
 * ## The page scrolls itself at the edges
 *
 * A month is taller than a phone. Without this, moving something from the last
 * week to the first means dropping it somewhere in between and dragging again,
 * and the top of the grid can be under the header where a drop lands on the
 * header instead. So a pointer held near the top or bottom of the scrolling
 * box scrolls it, at a speed set by how close to the edge it is.
 *
 * ## What this file does not do
 *
 * It does not know what a calendar is. It reports "this thing was dropped on
 * that target" and the screen decides what that means — which is what lets the
 * same hook serve a month cell, an hour grid and a week row, and what makes
 * the arithmetic below testable without a DOM.
 */

/** How long a press must last on touch before it is a drag rather than a tap. */
export const HOLD_MS = 250;

/** How far a pointer may move before a press is a scroll rather than a hold. */
export const SLOP = 6;

/** Times snap to the quarter hour. Finer is precision nobody drags for. */
export const STEP_MINUTES = 15;

/** Round to the nearest step, and never outside the day. */
export function snapMinutes(minutes: number, step: number = STEP_MINUTES): number {
  const snapped = Math.round(minutes / step) * step;
  return Math.max(0, Math.min(24 * 60 - step, snapped));
}

/**
 * What an hour grid needs to turn a point into a time.
 *
 * Read off the grid rather than guessed: `HourGrid` and `WeekGrid` each have
 * their own row height and gutter, and hard-coding either here would make this
 * silently wrong on one of them the next time somebody changes a constant.
 */
export interface GridSpec {
  /** Pixels per hour. */
  rowPx: number;
  /** The time column down the left, in pixels. */
  gutterPx: number;
  /** The hour the grid starts at — these grids do not draw the small hours. */
  startHour: number;
  /** How many day columns. One for a day grid, seven for a week. */
  columns: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridPoint {
  /** Minutes past midnight, snapped. */
  minutes: number;
  /** Which day column, from 0. Always 0 on a one-column grid. */
  column: number;
}

/**
 * Where a point lands on an hour grid.
 *
 * The inverse of the arithmetic the grids already do to draw a block: top is
 * `(at - startHour * 60) / 60 * rowPx`, so minutes is that read backwards. It
 * is a separate function rather than a line inside a pointer handler because
 * this is the part that can be wrong in a way nobody sees — an off-by-one-row
 * drop is an hour, and an hour is a missed class.
 *
 * Clamped rather than left to run off the ends: dropping above the first hour
 * means the first hour, not yesterday.
 */
export function pointIn(spec: GridSpec, rect: Rect, x: number, y: number): GridPoint {
  const usable = Math.max(1, rect.width - spec.gutterPx);
  const across = Math.max(0, Math.min(usable - 1, x - rect.left - spec.gutterPx));
  const column = Math.max(
    0,
    Math.min(spec.columns - 1, Math.floor((across / usable) * spec.columns)),
  );

  const down = y - rect.top;
  const minutes = spec.startHour * 60 + (down / spec.rowPx) * 60;
  // The last hour the grid draws, so a drop below the bottom row is that hour
  // rather than a time the grid has no space for.
  const lastDrawn = spec.startHour * 60 + Math.max(0, rect.height / spec.rowPx) * 60;
  return {
    minutes: snapMinutes(Math.max(spec.startHour * 60, Math.min(lastDrawn, minutes))),
    column,
  };
}

/** "9:30", "12", "1:15" — how these grids write a time. */
export function clockOf(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}` : `${hour}:${String(m).padStart(2, '0')}`;
}

/** The same, with the meridiem, for a time a person will read on its own. */
export function timeLabel(minutes: number): string {
  return `${clockOf(minutes)}${Math.floor(minutes / 60) < 12 ? 'a' : 'p'}`;
}

/**
 * The grid's spec, as data attributes on the element that drew it.
 *
 * `gridAttrs` writes them and this reads them back, so the two cannot drift —
 * which is the whole reason they are attributes rather than props passed
 * around: a drop can start anywhere on the screen and land on a grid the
 * dragging code has never heard of.
 */
export function gridAttrs(name: string, spec: GridSpec) {
  return {
    'data-drop-grid': name,
    'data-row-px': String(spec.rowPx),
    'data-gutter-px': String(spec.gutterPx),
    'data-start-hour': String(spec.startHour),
    'data-columns': String(spec.columns),
  };
}

export function specOf(el: HTMLElement): GridSpec | null {
  const rowPx = Number(el.dataset.rowPx);
  const gutterPx = Number(el.dataset.gutterPx);
  const startHour = Number(el.dataset.startHour);
  const columns = Number(el.dataset.columns);
  if (![rowPx, gutterPx, startHour, columns].every(Number.isFinite)) return null;
  return { rowPx, gutterPx, startHour, columns };
}

/** How close to an edge starts the scroll, and how fast it goes at the edge. */
const EDGE_PX = 72;
const EDGE_SPEED = 14;

/** The nearest ancestor that actually scrolls, or null. */
function scrollerOf(el: Element | null): HTMLElement | null {
  let node = el as HTMLElement | null;
  while (node) {
    const style = getComputedStyle(node);
    const scrolls = /auto|scroll|overlay/.test(style.overflowY);
    if (scrolls && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

/** What was picked up, and what it was dropped on. */
export interface Dropped<T> {
  payload: T;
  /** The `data-drop` value of the target under the pointer, when there was one. */
  target: string | null;
  /** Where on a continuous grid it landed, when the target was one. */
  point: GridPoint | null;
}

export interface DragOptions<T> {
  onDrop: (dropped: Dropped<T>) => void;
  /** The grid to read a point off, where the target is a continuous one. */
  grid?: GridSpec;
  /** Off entirely — a sample course, a class, anything that may not move. */
  disabled?: boolean;
}

/**
 * The hook a draggable row or block uses.
 *
 * Returns the handlers to spread, plus what is currently held and what it is
 * over, so the caller can draw the two things a drag must show: the thing
 * following the finger, and where it would land.
 */
export function useDragToMove<T>({ onDrop, grid, disabled }: DragOptions<T>) {
  const [held, setHeld] = useState<T | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  /** Where the press started, to tell a drag from a tap and a scroll. */
  const from = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const armed = useRef(false);
  /** Set on a drop, read by the click that follows it, then cleared. */
  const moved = useRef(false);

  /** The box being auto-scrolled, and the frame doing it. */
  const scroller = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const edge = useRef(0);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    scroller.current = null;
    edge.current = 0;
    armed.current = false;
    from.current = null;
    setHeld(null);
    setOver(null);
    setAt(null);
  }, []);

  // Escape cancels, wherever the pointer is. A drag somebody has changed their
  // mind about must not need them to find a safe place to let go.
  useEffect(() => {
    if (held === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [held, stop]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  /**
   * Scroll while the pointer is held near an edge.
   *
   * A loop rather than one nudge per move event: a finger held still at the
   * top of the screen is asking to keep going, and there are no move events
   * while it is still.
   */
  const nudge = useCallback((y: number) => {
    const box = scroller.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const above = y - rect.top;
    const below = rect.bottom - y;
    edge.current =
      above < EDGE_PX ? -EDGE_SPEED * (1 - Math.max(0, above) / EDGE_PX)
      : below < EDGE_PX ? EDGE_SPEED * (1 - Math.max(0, below) / EDGE_PX)
      : 0;

    if (edge.current === 0) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      return;
    }
    if (frame.current !== null) return;
    const step = () => {
      if (edge.current === 0 || !scroller.current) {
        frame.current = null;
        return;
      }
      scroller.current.scrollTop += edge.current;
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  /** What is under the pointer: a discrete target, a grid point, or neither. */
  const under = (x: number, y: number): { target: string | null; point: GridPoint | null } => {
    const el = document.elementFromPoint(x, y);
    const drop = el?.closest<HTMLElement>('[data-drop]');
    if (drop) return { target: drop.dataset.drop ?? null, point: null };
    const cont = el?.closest<HTMLElement>('[data-drop-grid]');
    if (!cont) return { target: null, point: null };
    // The grid's own numbers, read off the element it drew.
    //
    // The alternative is the caller passing them in, and the caller does not
    // reliably know them: an hour grid works out its own window from the day
    // it was handed, so a row somewhere else dragging onto it would be using a
    // second, stale copy of `startHour`. The one that drew the grid is the one
    // that knows.
    const spec = specOf(cont) ?? grid;
    if (!spec) return { target: cont.dataset.dropGrid ?? null, point: null };
    const rect = cont.getBoundingClientRect();
    return { target: cont.dataset.dropGrid ?? null, point: pointIn(spec, rect, x, y) };
  };

  const handlers = (payload: T) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled || e.button > 0) return;
      moved.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      const target = e.currentTarget as HTMLElement;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        // A finger is usually scrolling. Hold it still to mean something else.
        timer.current = window.setTimeout(() => {
          armed.current = true;
          setHeld(payload);
          setAt({ x: from.current?.x ?? 0, y: from.current?.y ?? 0 });
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            // A pointer that has already been released. Nothing to capture.
          }
        }, HOLD_MS);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (disabled) return;
      const start = from.current;
      if (!start) return;
      const far = Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP;

      if (!armed.current) {
        // A mouse has no scroll to protect, so movement is the whole signal.
        if (e.pointerType === 'mouse' && far) {
          armed.current = true;
          setHeld(payload);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // As above.
          }
        } else if (far && timer.current !== null) {
          // The finger left before the hold finished: this is a scroll.
          window.clearTimeout(timer.current);
          timer.current = null;
          from.current = null;
        }
        if (!armed.current) return;
      }

      e.preventDefault();
      setAt({ x: e.clientX, y: e.clientY });
      if (!scroller.current) scroller.current = scrollerOf(e.currentTarget as HTMLElement);
      nudge(e.clientY);
      const found = under(e.clientX, e.clientY);
      setOver(found.target);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!armed.current) {
        stop();
        return;
      }
      const found = under(e.clientX, e.clientY);
      if (found.target !== null) {
        moved.current = true;
        onDrop({ payload, target: found.target, point: found.point });
      }
      stop();
    },
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    style: held !== null ? ({ touchAction: 'none' } as const) : undefined,
  });

  return {
    handlers,
    held,
    over,
    at,
    /**
     * Whether the click about to fire came from a drop.
     *
     * A pointer sequence that moved something still ends in a click, and
     * without this the row would also open whatever it was dragged onto.
     * Reading it clears it, so one drop suppresses exactly one click.
     */
    tookDrop: () => {
      const was = moved.current;
      moved.current = false;
      return was;
    },
  };
}

/**
 * Keyboard equivalent: pick up, move, drop.
 *
 * Not optional and not a nicety. A calendar whose only move gesture is a drag
 * is a calendar nobody can use with a keyboard or a screen reader, and this
 * app does not ship that anywhere else. Space or Enter picks up, the arrows
 * move, Enter drops, Escape puts it back — the pattern every drag-and-drop
 * accessibility guide describes, and the one the month grid's own roving focus
 * already prepares people for.
 */
export interface Carrying<T> {
  payload: T;
  /** Days moved so far, so the caller can say where it would land. */
  days: number;
  /** Minutes moved so far, on the grids that have an hour axis. */
  minutes: number;
}

