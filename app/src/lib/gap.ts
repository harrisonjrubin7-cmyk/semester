/**
 * The twenty minutes between two classes.
 *
 * Everything else in the app assumes you are sitting down. Drill wants a
 * course chosen and a unit picked; the guide wants scrolling; the quiz wants
 * a finger on each hand. None of that survives a courtyard. What actually
 * happens between Buttrick and Furman is one thumb, a phone held at chest
 * height, and a person who will stop the moment they have to think about the
 * interface.
 *
 * So this mode asks nothing. It works out how long you have, fills it, and
 * gets out of the way when it is time to walk.
 *
 * ## The window is measured, not assumed
 *
 * "You have eight minutes" is the sort of thing an app says when it has not
 * looked. The app knows when your next class starts, and — once you have
 * saved the two buildings on the map — how far apart they are and how long
 * that is at a walking pace. The window is what is left after the walk.
 *
 * Where it cannot measure the walk it says so and counts the whole gap as
 * yours, rather than deducting an invented number and making you late by a
 * margin you never agreed to.
 *
 * ## How many cards fit is learned, not guessed
 *
 * The first few runs use a stated default and say that it is one. After that
 * the number comes from the median of your own runs, which is not the app's
 * figure — and a mode that promises thirty cards and delivers eighteen is one
 * you stop believing.
 */

import { buildingOf, matchPlace, walkMinutes } from './rooms';
import { metresBetween, type SavedPlace } from './place';

/**
 * Seconds a card takes, before you have done enough runs to say.
 *
 * Deliberately slow. Reading a question, recalling, turning it over and
 * judging yourself is not a five-second act while walking, and the failure
 * that matters here is the optimistic one: a mode that promises thirty cards
 * and delivers eighteen is a mode you stop believing. Erring long offers a
 * shorter deck than you can manage, which costs nothing.
 */
export const DEFAULT_SECONDS = 20;

/** Runs before your own median replaces the default. */
export const ENOUGH = 15;

/** Below this there is no point starting something. */
const MIN_GAP = 5;

/**
 * Above this it is not a gap.
 *
 * An hour and a half free is a work window — a thing to sit down for, which
 * the app already plans elsewhere. Calling it a between-classes moment would
 * spend it on flashcards, which is the worst available use of ninety minutes.
 */
const LONG_GAP = 45;

/** Under two seconds is a mis-tap; over two minutes the phone went away. */
const FLOOR_SECONDS = 2;
const CEILING_SECONDS = 120;

/** Samples kept. Enough for a stable median, small enough to follow a change. */
const KEEP = 60;

export interface Gap {
  /** Minutes from now until you have to set off. */
  minutes: number;
  /** Minutes from now until it starts. */
  startsIn: number;
  /** Minutes of walking. Zero when the app cannot say. */
  walk: number;
  /** Whether the walk was measured between two places you saved. */
  walkKnown: boolean;
  /** What you are going to, and where. */
  title: string;
  where: string;
  /** Long enough to be a work window rather than a gap. */
  long: boolean;
}

export interface NextUp {
  title: string;
  where: string;
  /** Minutes from now until it starts. Negative once it has begun. */
  inMinutes: number;
  isTomorrow: boolean;
}

/**
 * What is left of the time before the next thing, after the walk to it.
 *
 * Null whenever there is nothing to fill: no next class, one tomorrow rather
 * than today, one already begun, or a window too short to be worth opening
 * anything for.
 */
export function gapNow(next: NextUp | null, walk: { minutes: number; known: boolean }): Gap | null {
  if (!next || next.isTomorrow || next.inMinutes <= 0) return null;

  const deduct = walk.known ? walk.minutes : 0;
  const minutes = next.inMinutes - deduct;
  if (minutes < MIN_GAP) return null;

  return {
    minutes,
    startsIn: next.inMinutes,
    walk: walk.known ? walk.minutes : 0,
    walkKnown: walk.known,
    title: next.title,
    where: next.where,
    long: minutes > LONG_GAP,
  };
}

/** How long a card takes you, and whether that is your figure or the app's. */
export function cardSeconds(samples: number[]): { seconds: number; measured: boolean } {
  const usable = samples.filter((s) => s >= FLOOR_SECONDS && s <= CEILING_SECONDS);
  if (usable.length < ENOUGH) return { seconds: DEFAULT_SECONDS, measured: false };
  const sorted = [...usable].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { seconds: Math.max(1, Math.round(median)), measured: true };
}

/** How many cards fit in the window. */
export function cardsThatFit(minutes: number, samples: number[]): number {
  const { seconds } = cardSeconds(samples);
  return Math.max(1, Math.floor((minutes * 60) / seconds));
}

/**
 * A new timing, folded in.
 *
 * A mis-tap and a phone that went in a pocket are both thrown away rather
 * than averaged, because either one moves a median built from fifteen
 * samples further than any real answer ever would.
 */
export function addSample(samples: number[], seconds: number): number[] {
  if (!Number.isFinite(seconds) || seconds < FLOOR_SECONDS || seconds > CEILING_SECONDS) {
    return samples;
  }
  return [...samples, Math.round(seconds)].slice(-KEEP);
}

/** "23 minutes before you set off for ECON 1020." */
export function gapLine(gap: Gap): string {
  const m = `${gap.minutes} ${gap.minutes === 1 ? 'minute' : 'minutes'}`;
  return gap.walkKnown
    ? `${m} before you set off for ${gap.title}.`
    : `${m} until ${gap.title}.`;
}

/** What the app did and did not know about getting there. */
export function walkLine(gap: Gap): string {
  if (gap.walkKnown && gap.walk === 0) {
    return `${gap.title} is in the building you are already in, so there is no walk to take off.`;
  }
  if (gap.walkKnown) {
    return `${gap.where} is a ${gap.walk} minute walk, already taken off.`;
  }
  return `The app has not been told where ${gap.where || 'that'} is, so none of this is walking time. Save the building on the map and it will take the walk off.`;
}

/** What fits, and whose number that is. */
export function budgetLine(cards: number, samples: number[]): string {
  const { seconds, measured } = cardSeconds(samples);
  const n = `${cards} ${cards === 1 ? 'card' : 'cards'}`;
  return measured
    ? `${n}, at the ${seconds} seconds a card you actually take.`
    : `${n}, at ${seconds} seconds each — the app's guess until it has watched you do a few.`;
}

/** The line that ends the run. */
export function goLine(gap: Gap): string {
  if (gap.walkKnown && gap.walk > 0) {
    return `Set off now. ${gap.title}, ${gap.where}, ${gap.walk} ${gap.walk === 1 ? 'minute' : 'minutes'} away.`;
  }
  return `${gap.title} next, in ${gap.where}.`;
}

/**
 * The room out of a rail entry.
 *
 * A block's `meta` is "Garland 162 · Prof. Trounstine", which is right on a
 * timetable and wrong in a sentence about walking to a building. Everything
 * after the divider is who, not where.
 */
export function roomOf(meta: string): string {
  return meta.split('·')[0].trim();
}

/**
 * How far it is to the next thing, from whatever you are at now.
 *
 * "Now" is the last block on the rail that has already started, because that
 * is where the app has any reason to think you are. Before the first class of
 * the day it has one other candidate: the residence hall from the housing
 * portal, which is where you were before anything on the timetable. Without
 * that it still has none — you could be in bed or in the library — and it
 * says so rather than measuring from a building you are not in.
 *
 * Two classes in the same building is a known walk of zero, which is a
 * different thing from an unknown one and is reported as such.
 */
export function walkTo(
  rail: { meta: string; at: number; canceled?: boolean }[],
  nextAt: number,
  places: SavedPlace[],
  /**
   * Where you live, from the housing portal. Used only for the first class of
   * the day, which is the one you leave the building for — see
   * `lib/housing.ts`. Empty when it has not been filled in, which puts this
   * back where it was: unable to say where you are before your first class.
   */
  home = '',
): { minutes: number; known: boolean } {
  const real = rail.filter((b) => !b.canceled);
  const to = real.find((b) => b.at === nextAt);
  const previous = real.filter((b) => b.at < nextAt).pop();
  const from = previous ?? (home.trim() ? { meta: home, at: 0 } : undefined);
  if (!from || !to) return { minutes: 0, known: false };

  const a = buildingOf(from.meta);
  const b = buildingOf(to.meta);
  if (!a || !b) return { minutes: 0, known: false };
  if (a.toLowerCase() === b.toLowerCase()) return { minutes: 0, known: true };

  const pa = matchPlace(from.meta, places);
  const pb = matchPlace(to.meta, places);
  if (!pa || !pb) return { minutes: 0, known: false };
  return { minutes: walkMinutes(metresBetween(pa, pb)), known: true };
}

const PACE_KEY = 'semester.gappace';

/**
 * Your timings, on the device rather than in the account.
 *
 * Deliberately not synced. How fast you answer a card in a courtyard on a
 * phone is not how fast you answer one sitting at a laptop, and pooling the
 * two would give each device a median describing neither. The account merge
 * would be worse than useless here besides: these are bare numbers with no
 * ids, so the union that keeps two devices' lists would collapse fifteen
 * samples of nine seconds into one and destroy the distribution it exists to
 * measure.
 */
export function readPace(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PACE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n) => typeof n === 'number' && Number.isFinite(n)) : [];
  } catch {
    // A private window, or storage off. No samples, so the default is used
    // and the screen says it is a default.
    return [];
  }
}

export function writePace(samples: number[]): void {
  try {
    localStorage.setItem(PACE_KEY, JSON.stringify(samples));
  } catch {
    /* storage off; the app keeps using its stated default */
  }
}

/**
 * Minutes left of the window, floored at zero.
 *
 * Elapsed time is floored too. The store's clock has its seconds zeroed and
 * a run starts from an unrounded stamp, so the first render can hand this a
 * negative elapsed and get back a window a minute longer than the one the
 * offer promised.
 */
export function leftOf(gap: Gap, elapsedMs: number): number {
  return Math.max(0, gap.minutes - Math.floor(Math.max(0, elapsedMs) / 60_000));
}

/** How a finished run reads. Never a score out of the deck you did not reach. */
export function runLine(done: number, got: number): string {
  if (done === 0) return 'Nothing this time.';
  return `${got} of ${done} on the way.`;
}
