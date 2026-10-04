/**
 * A hybrid logical clock, so two devices can order edits without trusting
 * either one's wall clock.
 *
 * A phone whose clock is a day fast would, under plain last-writer-wins, win
 * every conflict for a day. The clock here takes the larger of the wall time
 * and the largest it has seen, and a counter breaks ties inside one
 * millisecond, so a device that is behind catches up the first time it hears
 * from one that is ahead, and a device that is ahead cannot run away without
 * bound (`MAX_DRIFT_MS`: a remote stamp further ahead than that is refused,
 * not adopted, because adopting it would let one bad clock fix every later
 * write far in the future).
 *
 * Stamps are strings that sort as text: 15 hex digits of time, 4 of counter,
 * then the device. Ordering by `localeCompare` would be wrong; compare with
 * `compare`, which is plain code-unit order.
 */

export const MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

export interface Hlc {
  wall: number;
  counter: number;
  node: string;
}

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;
const COUNTER_MAX = 16 ** COUNTER_DIGITS - 1;

export function encode(h: Hlc): string {
  return `${h.wall.toString(16).padStart(WALL_DIGITS, '0')}-${h.counter.toString(16).padStart(COUNTER_DIGITS, '0')}-${h.node}`;
}

export function decode(s: string): Hlc | null {
  const m = /^([0-9a-f]{15})-([0-9a-f]{4})-(.+)$/.exec(s);
  if (!m) return null;
  return { wall: parseInt(m[1], 16), counter: parseInt(m[2], 16), node: m[3] };
}

/** Code-unit order of the encoded stamps: negative if a is earlier. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class Clock {
  readonly node: string;
  private readonly now: () => number;
  private last: Hlc;
  constructor(node: string, now: () => number = Date.now) {
    this.node = node;
    this.now = now;
    this.last = { wall: 0, counter: 0, node };
  }

  /** A stamp for a local event. Always later than every stamp this clock has issued or received. */
  tick(): string {
    const wall = Math.max(this.last.wall, this.now());
    const counter = wall === this.last.wall ? this.last.counter + 1 : 0;
    return this.commit({ wall, counter, node: this.node });
  }

  /**
   * Fold in a stamp from another device. Returns the new local stamp, or
   * `null` — and changes nothing — if the remote one is malformed, or so far
   * ahead of this device's wall time that adopting it would be the bug.
   */
  receive(remote: string): string | null {
    const r = decode(remote);
    if (!r) return null;
    const now = this.now();
    if (r.wall - now > MAX_DRIFT_MS) return null;
    const wall = Math.max(this.last.wall, r.wall, now);
    let counter: number;
    if (wall === this.last.wall && wall === r.wall) counter = Math.max(this.last.counter, r.counter) + 1;
    else if (wall === this.last.wall) counter = this.last.counter + 1;
    else if (wall === r.wall) counter = r.counter + 1;
    else counter = 0;
    return this.commit({ wall, counter, node: this.node });
  }

  private commit(h: Hlc): string {
    // A counter that wraps would issue a stamp earlier than one already
    // issued; carry into the wall instead.
    if (h.counter > COUNTER_MAX) h = { wall: h.wall + 1, counter: 0, node: h.node };
    this.last = h;
    return encode(h);
  }
}
