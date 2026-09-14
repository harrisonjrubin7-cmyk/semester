/**
 * Which hours a day's grid draws.
 *
 * `HourGrid` said it already: "the window is the day's own, not a fixed
 * 7-to-11 — a day with an 8am lab and nothing after four should not draw seven
 * empty evening rows." The arithmetic under that comment then floored the end
 * of the day at six in the evening and drew the rows anyway. On a phone that
 * is the whole screen: a Monday with one nine o'clock class rendered twelve
 * rows, eleven of them empty, and the grid you had to scroll past to reach the
 * list was ruled lines and nothing else.
 *
 * The other half is where you are. The now line was drawn only if the hour
 * happened to fall inside a window computed without it, so from about seven in
 * the evening — which is when a student opens a calendar — the day showed no
 * marker at all and read exactly like six in the morning. The hour you are in
 * is part of the day, so it belongs in the window that decides the day's
 * shape; then the marker has somewhere to land, and the empty rows between
 * your last class and now are the afternoon that has gone rather than padding.
 *
 * This lives in a file of its own because `WeekGrid` kept its own copy of the
 * same sum with a different floor — five in the evening rather than six — and
 * a second copy of arithmetic is the one that is wrong after somebody changes
 * a constant in the first. `HourGrid`'s own doc comment makes that argument
 * about the drag gesture; it applies here.
 */

/** A block on the day: when it starts, and how long it runs. */
export interface HourSpan {
  /** Minutes past midnight. */
  at: number;
  minutes: number;
}

/**
 * The fewest rows a grid draws.
 *
 * A single fifty-minute class padded by an hour either side is three rows, and
 * three rows do not read as a day — they read as a component that failed to
 * load. Six is enough to look like a morning with room around it, and it is
 * still half of what the old floor forced.
 */
export const MIN_HOURS = 6;

/**
 * The first and last hour to draw, given what is on the day and the time now.
 *
 * `now` is minutes past midnight when the day being drawn is today, and null
 * on every other day — a Thursday in three weeks has no "now" on it, and
 * stretching its grid to this afternoon would be drawing an hour that has
 * nothing to do with the day on the screen.
 */
export function hourWindow(blocks: HourSpan[], now: number | null = null): { lo: number; hi: number } {
  const edges: number[] = [];
  for (const b of blocks) edges.push(b.at, b.at + b.minutes);
  // Today always has an edge, so this is a day with nothing on it that is also
  // not today: a plain working morning, so the grid is a day rather than a
  // hairline. No caller draws one — both check for blocks first — and the
  // answer is here so that the one who forgets gets something sensible.
  if (now !== null) edges.push(now);
  if (edges.length === 0) return { lo: 8, hi: 8 + MIN_HOURS };

  let lo = Math.max(0, Math.floor(Math.min(...edges) / 60) - 1);
  let hi = Math.min(24, Math.ceil(Math.max(...edges) / 60) + 1);

  // Widened towards the evening first: a day that is short is short at the end
  // of it, and the hours somebody wants room to put something into are the
  // ones ahead of them rather than the ones before breakfast.
  while (hi - lo < MIN_HOURS && (lo > 0 || hi < 24)) {
    if (hi < 24) hi += 1;
    if (hi - lo >= MIN_HOURS) break;
    if (lo > 0) lo -= 1;
  }

  return { lo, hi };
}
