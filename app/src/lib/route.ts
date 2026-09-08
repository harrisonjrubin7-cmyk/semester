/**
 * A URL per screen, so the browser's own controls work.
 *
 * Every screen in this app has lived at the same address. Moving between
 * Today, a course guide and Settings left the URL untouched, which costs four
 * things people expect from anything in a browser: Back and Forward do not
 * work, a refresh drops you at Today, a bookmark is a bookmark of the app
 * rather than of the thing you were looking at, and a link you send somebody
 * opens the front page.
 *
 * ## The hash, not the path
 *
 * `#/course/econ`, not `/course/econ`. This is served as static files from a
 * subpath on GitHub Pages, where a request for `/semester/course/econ` is a
 * request for a file that is not there — a 404 on every refresh, on every
 * bookmark, on every shared link. There is no server to rewrite it. A hash
 * never reaches the server at all, which is exactly why static sites use one.
 *
 * ## What a route carries
 *
 * The screen, and the one identifier that screen is about — a course, a
 * deadline, a guide, an event, a note. That is the difference between "the
 * study screen" and "ECON's field guide", and it is what makes a link worth
 * sending. Study mode rides along on the guide, because opening a guide in
 * cards and opening it in slides are different things to link to.
 *
 * ## What it does not carry
 *
 * Anything typed, anything private, anything that would end up in a browser
 * history somebody else can read. A note's *id* is in the URL; its text is
 * not, and the id means nothing without the device it was written on.
 */

import type { ChangeSource, ReportGrain, Screen, StudyMode } from './types';

/** What a screen is currently about, if anything. */
export interface Route {
  screen: Screen;
  /** The thing named in the URL. Empty when the screen is about nothing. */
  id: string;
  /** Only for a guide: which way it is being read. */
  mode?: StudyMode;
  /**
   * Which part of a merged screen a retired link meant.
   *
   * Only ever set by the `RETIRED` table below. A live URL does not carry
   * these: the grain and the source are a switch somebody flips while they
   * are there, not part of the address, and putting them in the hash would
   * mean every flip pushed a history entry.
   */
  opens?: { report?: ReportGrain; changes?: ChangeSource };
}

/**
 * Screens that name something, and which state field holds it.
 *
 * Everything not listed is a screen you are simply on, and its route is its
 * name. Kept as a table so a screen cannot be routable in one direction only.
 */
export const NAMED: Partial<Record<Screen, 'courseId' | 'itemId' | 'eventId' | 'guideId' | 'noteId'>> = {
  course: 'courseId',
  edit: 'courseId',
  grades: 'courseId',
  item: 'itemId',
  event: 'eventId',
  guide: 'guideId',
  drill: 'guideId',
  quiz: 'guideId',
  lesson: 'guideId',
  slides: 'guideId',
  note: 'noteId',
};

/**
 * Screens that used to exist, and where their links go now.
 *
 * A URL is a promise: somebody bookmarked `#/weekly` in October and the app
 * merged that screen into the report in November. Dropping them would land a
 * saved link on a screen the switch in `App.tsx` does not have — a blank page
 * that reads as the app being broken rather than as a screen having moved.
 *
 * Only ever grows, and only ever by a merge. A screen that was *removed*
 * rather than merged does not belong here: sending somebody somewhere
 * unrelated is worse than telling them the link is dead.
 */
const RETIRED: Record<string, { screen: Screen; opens?: Route['opens'] }> = {
  // Three grains of one report — see `screens/Reports.tsx`. Each link says
  // which grain it meant: `#/weekly` opening today's report is the promise
  // technically kept and actually broken.
  weekly: { screen: 'brief' as Screen, opens: { report: 'week' } },
  worked: { screen: 'brief' as Screen, opens: { report: 'term' } },
  // Both halves of "something says a date moved" — see `screens/Changes.tsx`.
  check: { screen: 'announce' as Screen, opens: { changes: 'feed' } },
  // The chat was a second door into the conversation the Ask tab now is.
  chat: { screen: 'ask' as Screen },
};

/** A screen id is already url-safe; an account's own ids may not be. */
function safe(id: string): string {
  return encodeURIComponent(id);
}

/**
 * The address for where the app currently is.
 *
 * Always begins `#/`, so it reads as a path and so an empty hash and the home
 * screen are the same thing rather than two.
 */
export function toHash(route: Route): string {
  const parts = ['#', route.screen];
  if (NAMED[route.screen] && route.id) parts.push(safe(route.id));
  const hash = parts.join('/');
  // The mode rides on the guide only. Anywhere else it would be a parameter
  // nothing reads, which is worse than not having one.
  return route.screen === 'guide' && route.mode ? `${hash}?mode=${route.mode}` : hash;
}

/**
 * Read one back.
 *
 * Returns null for anything it does not recognise rather than guessing, so a
 * mangled link lands on the app rather than on a blank screen. Whether the
 * screen named actually exists is the caller's question — this file has no
 * business knowing which screens a given university has.
 */
export function fromHash(hash: string): Route | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw || raw === '/') return null;

  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const named = parts[0];
  // A screen name is written by this file and read by this file; anything
  // with a character it would never have produced is not one of ours.
  if (!/^[A-Za-z]+$/.test(named)) return null;
  const moved = RETIRED[named];
  const screen = (moved?.screen ?? named) as Screen;

  const id = parts[1] ? decodeURIComponent(parts[1]) : '';
  const mode = new URLSearchParams(query ?? '').get('mode');
  return {
    screen,
    id: NAMED[screen] ? id : '',
    ...(screen === 'guide' && mode ? { mode: mode as StudyMode } : {}),
    ...(moved?.opens ? { opens: moved.opens } : {}),
  };
}

/**
 * Whether moving between two routes should replace the current entry.
 *
 * Changing how a guide is being read is not a new place, it is the same place
 * differently — and pushing an entry for it means Back walks somebody through
 * every mode they tried rather than out of the guide.
 */
export function replaces(from: Route | null, to: Route): boolean {
  if (!from) return true;
  return from.screen === to.screen && from.id === to.id;
}

/** The same route, for comparing without caring about key order. */
export function same(a: Route | null, b: Route | null): boolean {
  if (!a || !b) return a === b;
  return a.screen === b.screen && a.id === b.id && (a.mode ?? '') === (b.mode ?? '');
}

/**
 * The full address, for a link somebody can send.
 *
 * Built from the current page rather than from a constant, because this app is
 * served from a subpath in one place and the root in another, and hardcoding
 * either produces links that work for exactly one of them.
 */
export function linkTo(route: Route, here: { origin: string; pathname: string }): string {
  return `${here.origin}${here.pathname}${toHash(route)}`;
}
