/**
 * What the app measured about itself, so "slow" can be a number.
 *
 * §7.1 of the completion plan is about performance under volumes nobody has
 * hit yet — a student with seven courses and their own added readings, where
 * `buildCatalog` runs over an order of magnitude more material than the four
 * shipped courses. It says what to do about that, and it is not optimisation:
 *
 * > The honest first move is not optimisation — it is instrumentation a
 * > student can see: a measured render and build time on the existing
 * > diagnostics screen, so the first person with seven courses can say what is
 * > slow rather than that it feels slow.
 *
 * This is that. It is the instrument, not a conclusion: nothing here decides
 * anything is too slow, because the figure that would decide it does not exist
 * until somebody's own semester produces one.
 *
 * ## It is not telemetry, and the difference is the whole design
 *
 * §7's preamble is emphatic about this, and `lib/usage.ts` made the same call
 * before it: the privacy page says that signed out nothing leaves the device
 * and there is no third-party analytics, and *"those sentences are the reason
 * somebody hands this app their coursework"*. A timing store that quietly
 * narrowed them to learn which screens are slow would be the same bad trade in
 * a different coat.
 *
 * So:
 *
 * - **Memory only.** Nothing here touches `localStorage`, IndexedDB or the
 *   sync payload. A reload empties it. That is not a limitation to work around
 *   later — it is the property that makes this safe to add.
 * - **Summary, not a trail.** Each name keeps how many times, the last, the
 *   slowest and the total. Not when, not in what order, not what was on screen
 *   — the same refusal `lib/usage.ts` makes about screen opens, for the same
 *   reason.
 * - **A student reads it out.** §7 says Phase 3's inputs come from the pilot
 *   the way research data comes from participants: somebody who agreed, with
 *   the screen open, telling us. This gives them something to read.
 *
 * ## Bounded, because an unbounded name is a leak
 *
 * A caller that marks `build econ`, `build psci`, `build the one they added on
 * Tuesday` would grow this map for as long as the tab is open. {@link MOST}
 * caps it, and the cap is visible: once it is reached, a new name is dropped
 * rather than an old one, so a reading that was already being watched does not
 * vanish mid-sentence.
 */

/** One thing that was measured, as the summary it keeps. */
export interface Reading {
  name: string;
  /** How many times it has been measured since the tab opened. */
  count: number;
  /** The most recent, in milliseconds. */
  last: number;
  /** The slowest, which is the one worth reporting. */
  worst: number;
  /** All of them added up, so a mean can be taken without keeping a trail. */
  total: number;
  /**
   * What the **slowest** of them ran over — `4 courses`, `guide`.
   *
   * A duration with no volume beside it cannot be acted on: eleven
   * milliseconds is fast for a hundred courses and slow for none, and the
   * whole question §7.1 asks is what happens when the volume changes.
   *
   * The slowest rather than the last, and that pairing is what lets one
   * reading stand for sixty screens. `Drawing a screen` is measured on every
   * screen there is; kept as sixty names it would overflow {@link MOST} and
   * silently drop whichever screens were visited last, which is the
   * unbounded-name leak the header is about. Kept as one name whose `over`
   * says *which* screen was slowest, it answers the same question in a line —
   * and it is the honest pairing anyway, since a worst time beside the volume
   * of some other run is two facts about two different moments.
   */
  over: string;
}

/** How many distinct names are kept. See the header. */
export const MOST = 24;

const taken_ = new Map<string, Reading>();

/** Record one measurement. Silent about a name that would overflow the cap. */
export function mark(name: string, ms: number, over = ''): void {
  const had = taken_.get(name);
  if (!had && taken_.size >= MOST) return;
  if (!had) {
    taken_.set(name, { name, count: 1, last: ms, worst: ms, total: ms, over });
    return;
  }
  had.count += 1;
  had.last = ms;
  had.total += ms;
  // The volume travels with the worst time, not with the most recent one. See
  // {@link Reading.over}: the two together are one fact about one run.
  if (ms > had.worst) {
    had.worst = ms;
    if (over) had.over = over;
  }
}

/**
 * The clock, where there is one. `null` where there is not.
 *
 * `performance` is absent in some test environments and behind a flag in
 * others, and a measurement is never worth failing a render over.
 */
export function now(): number | null {
  return typeof performance === 'object' && typeof performance.now === 'function'
    ? performance.now()
    : null;
}

/**
 * Run something and record how long it took.
 *
 * Written so there is no path through it that does not run the work. An
 * earlier version read the clock first and returned `work()` early when there
 * was none, which is the same behaviour and one edit away from being wrong —
 * and the test that proved the early return deleted `globalThis.performance`
 * to reach it, restored it with `defineProperty`, and left it read-only. The
 * next file to install fake timers could not, and `state/clock.test.ts` failed
 * three tests in a run where nothing about clocks had changed. A test that has
 * to break the environment to reach a branch is a reason to remove the branch.
 */
export function timed<T>(name: string, over: string, work: () => T): T {
  const began = now();
  const answer = work();
  const ended = now();
  if (began !== null && ended !== null) mark(name, ended - began, over);
  return answer;
}

/**
 * Everything measured, slowest first, as a copy.
 *
 * By the worst rather than the last, because the question a student is
 * answering is "what is slow here" and the answer is the slowest thing that
 * has happened, not whatever happened most recently.
 *
 * A copy because the first version handed back the live objects, and the
 * screen that reads this holds its result in a `useState` initialiser calling
 * it a snapshot. It was not one: `mark` updates those objects in place, so the
 * figures went on moving under a list that had already decided not to
 * re-render. Driven in a browser, the Data screen's own draw appeared in its
 * own readings — a screen reporting a measurement of the render that was
 * drawing the report. The numbers are only as honest as the moment they were
 * taken, and this is what makes the moment real.
 */
export function readings(): Reading[] {
  return [...taken_.values()]
    .map((r) => ({ ...r }))
    .sort((a, b) => b.worst - a.worst || a.name.localeCompare(b.name));
}

/** Empty it. For a test, and for the button that clears the screen. */
export function forget(): void {
  taken_.clear();
}

/**
 * When the browser first put something on the screen, in milliseconds.
 *
 * The browser's own figure, not one this app takes: `first-contentful-paint`
 * is measured by the engine across the whole load, including the network and
 * the parse, which is not a thing a timer inside the page can see. `null`
 * where the browser does not report it — every engine that matters does, and
 * saying nothing is better than reporting a zero as though it were instant.
 */
export function firstPaint(): number | null {
  try {
    const entries = performance.getEntriesByType('paint');
    const painted = entries.find((e) => e.name === 'first-contentful-paint');
    return painted ? painted.startTime : null;
  } catch {
    return null;
  }
}

/**
 * `4 courses`, `1 course` — what a measurement ran over, said in words.
 *
 * Here rather than beside a caller because two of them need it and the third
 * will: a volume is half of every reading on this screen, and the count on its
 * own (`4`) is a number with no noun, which is exactly the shape of figure
 * §7.1 is trying to get away from.
 */
export function over(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/**
 * A duration at the precision it was measured to.
 *
 * Two decimals under ten milliseconds, one under a hundred, none above — and
 * seconds past a thousand. A render time printed as `12.4173871 ms` reads as a
 * machine talking to itself; printed as `12 ms` when it was 12.4 it has thrown
 * away the digit that distinguishes two runs.
 */
export function saidMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 100) return `${Math.round(ms)} ms`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}
