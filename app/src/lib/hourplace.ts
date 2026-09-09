/**
 * Where a block sits on an hour grid, in pixels.
 *
 * Both grids — the day's and the week's — drew a block by turning its start
 * into a `top` and its length into a `height` and trusting the two to land
 * inside the grid. They do not, and a deadline at 11:59pm is where it shows:
 * the grid stops at midnight, so a block that starts a minute before it and
 * runs any length at all is drawn *below the last row*, on top of whatever
 * the screen put under the grid. On the week that was the line of help text,
 * with a block of the app's own sitting across it — the one thing a calendar
 * must never do is print two things on top of each other.
 *
 * Widening the grid is not the fix. The grid is one day tall by construction:
 * midnight is the bottom of it, and an hour past midnight belongs to the next
 * column, not to a row this grid could grow. So the block is clamped instead —
 * pushed up until it fits and, where it is long, cut off at the bottom of the
 * grid, which is exactly the claim the grid is making anyway.
 *
 * It is here rather than in either component because the two had the same
 * arithmetic twice with different constants, which is how one of them ends up
 * fixed and the other does not.
 */

export interface Placement {
  /** Pixels from the top of the grid. */
  top: number;
  /** Pixels tall. Never less than `minHeight`, never past the last row. */
  height: number;
}

export interface Placing {
  /** Minutes past midnight the block starts at. */
  at: number;
  /** How long it runs, in minutes. */
  minutes: number;
  /** The first hour the grid draws — these grids skip the small hours. */
  startHour: number;
  /** The hour the grid ends at, exclusive. 24 where it runs to midnight. */
  endHour: number;
  /** Pixels per hour. */
  rowPx: number;
  /** The shortest a block may be drawn and still be read. */
  minHeight: number;
  /**
   * Pixels shaved off the bottom so a block does not touch the next one.
   *
   * Part of the height rather than a margin because the height is what gets
   * clamped, and a margin would put the gap back outside the grid.
   */
  gap?: number;
}

/**
 * A hairline below the hour rule, so a block on the hour does not sit on it.
 *
 * Both grids added this by hand to `top`; it is here so the clamp knows about
 * it rather than being handed a number that has already been nudged.
 */
const HAIRLINE = 1;

export function placeBlock({
  at,
  minutes,
  startHour,
  endHour,
  rowPx,
  minHeight,
  gap = 3,
}: Placing): Placement {
  const grid = Math.max(0, (endHour - startHour) * rowPx);
  const wanted = ((at - startHour * 60) / 60) * rowPx + HAIRLINE;
  // Above the first hour is the first hour, below the last is the last: a
  // block outside the window the grid drew is still a block somebody has to
  // be able to see and to drag.
  const top = Math.max(0, Math.min(wanted, grid - minHeight - HAIRLINE));
  const height = Math.max(
    minHeight,
    Math.min(Math.max(minHeight, (minutes / 60) * rowPx - gap), grid - top - HAIRLINE),
  );
  return { top, height };
}
