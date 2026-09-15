/**
 * Where a thing on screen came from, and how far it should be trusted.
 *
 * The app draws six kinds of fact in one typeface. A deadline compiled into
 * the shipped semester, a deadline out of a subscribed calendar, a deadline
 * somebody typed at midnight and a deadline the app derived from a syllabus
 * are four different claims, and Today puts them in the same list looking
 * identical. `components/SampleMark.tsx` says this out loud in its own header
 * — *"import one real syllabus alongside it and Today mixes your Thursday
 * paper with somebody else's, with nothing distinguishing them"* — and then
 * answers it with one banner about the whole app.
 *
 * A banner is the right answer to "what is this app showing me" and the wrong
 * answer to "what is this row". This is the per-row version.
 *
 * ## One axis, not six categories
 *
 * The six read as a list of buckets and they are not: they are a single
 * ordering of **how much a row should be trusted as a record of fact**, and
 * putting them in any other order produces nonsense. Official outranks
 * connected because an institution's record beats a copy of it; connected
 * outranks made because a live system beats something the app inferred; made
 * outranks yours because an extraction from a syllabus beats a typed guess;
 * yours outranks sample because your guess is at least about you. `TRUST`
 * publishes the order so a caller that wants the weakest thing in a list does
 * not invent its own opinion of weak.
 *
 * ## Nothing here is Official, and that is the point of having the word
 *
 * `server/institution/` has an empty production adapter registry, so no code
 * path in this build returns `official` — `where.test.ts` asserts it, which
 * makes the assertion a tripwire rather than a decoration: the day an adapter
 * lands, that test fails and somebody has to decide what earns the word.
 * Shipping the label unused is deliberate. A vocabulary that gains its most
 * important term late is a vocabulary every existing caller has already been
 * written around.
 */

import { daysBetween } from './date';

/** Where a row came from, strongest claim first. */
export type Where = 'official' | 'connected' | 'made' | 'yours' | 'sample' | 'stale';

/**
 * The ordering, strongest first.
 *
 * `stale` is last rather than beside `connected`, which is the one placement
 * worth arguing. It *was* connected; what it is now is a copy of something
 * that may have moved, and a copy nobody has checked is worth less than a
 * guess somebody made on purpose — because the guess knows it is a guess.
 */
export const TRUST: Record<Where, number> = {
  official: 0,
  connected: 1,
  made: 2,
  yours: 3,
  sample: 4,
  stale: 5,
};

/**
 * What each is called on screen.
 *
 * The blueprint's words are Official, Connected, Semester-created, Local,
 * Sample and Out of date. Four are kept; two are not, because the blueprint
 * also says to use plain names first and two of its own are not plain.
 * "Semester-created" is the product talking about itself, and a student
 * reading "Local" thinks about their town. "Made here" and "Yours" say the
 * same two things in words somebody would use.
 */
export function saysWhere(w: Where): string {
  switch (w) {
    case 'official':
      return 'Official';
    case 'connected':
      return 'Connected';
    case 'made':
      return 'Made here';
    case 'yours':
      return 'Yours';
    case 'sample':
      return 'Sample';
    case 'stale':
      return 'Out of date';
  }
}

/** The sentence behind the word, for anywhere with room to explain. */
export function aboutWhere(w: Where): string {
  switch (w) {
    case 'official':
      return 'Your institution’s own record, read from its system.';
    case 'connected':
      return 'From a calendar or account you connected, last checked recently.';
    case 'made':
      return 'The app built this from sources you gave it.';
    case 'yours':
      return 'You entered this yourself. Nothing has checked it.';
    case 'sample':
      return 'Shipped with the app as a demonstration. Not your semester.';
    case 'stale':
      return 'From a connection that has not been checked lately. It may have moved.';
  }
}

/**
 * Whether a row's origin is worth drawing attention to.
 *
 * `connected`, `made` and `yours` are the ordinary states of an ordinary
 * semester, and a badge on every row is a badge nobody reads. The two worth
 * interrupting for are the two that mean *this may not be about you or may
 * not be current* — which is exactly the pair the app could not distinguish
 * before.
 */
export function worthSaying(w: Where): boolean {
  return w === 'sample' || w === 'stale' || w === 'official';
}

/**
 * Days a subscription may go unchecked before its rows are out of date.
 *
 * Three, and it is a floor chosen to be quiet rather than accurate. The
 * accurate number is "longer than the thing it describes takes to change",
 * which for a class calendar is hours and for a term calendar is weeks — the
 * app cannot tell those apart from an ICS URL. Three days is short enough to
 * catch a subscription that has actually stopped and long enough that a
 * weekend away does not paint the calendar with warnings.
 */
export const QUIET_DAYS = 3;

/** The shape this module needs from a feed. Narrow so a test need not build one. */
export interface Pulled {
  /** The subscribed address, or '' for a file imported once. */
  url: string;
  /** When it last pulled, epoch ms. 0 = never. */
  synced: number;
}

/**
 * Where a calendar feed's rows stand.
 *
 * Three answers, and the first is the one that is easy to get wrong. **A file
 * imported once is not a subscription**: it has no URL to re-read, it was
 * never going to update, and calling it out of date after three days would
 * put a warning on every imported `.ics` in the app forever, for a fault
 * nobody can fix. It is `yours` — a thing you brought in — and it stays that
 * however old it gets.
 *
 * A subscription that has never pulled is `stale` rather than `connected`.
 * Nothing has been checked, so nothing from it is current, and "Connected" on
 * a feed that has never once succeeded is the app claiming a link it does not
 * have.
 */
export function whereFeed(feed: Pulled, now: number): Where {
  if (!feed.url) return 'yours';
  if (feed.synced <= 0) return 'stale';
  return daysBetween(new Date(feed.synced), new Date(now)) >= QUIET_DAYS ? 'stale' : 'connected';
}

/**
 * When it last pulled, in words, for the row that says so.
 *
 * The Connect screen showed a feed's last *status message* and never a time,
 * so a subscription that succeeded three weeks ago read "14 events read" —
 * identical to one that succeeded a minute ago, and the difference between
 * them is the whole question.
 */
export function lastPulled(synced: number, now: number): string {
  if (synced <= 0) return 'never checked';
  const days = daysBetween(new Date(synced), new Date(now));
  if (days <= 0) return 'checked today';
  if (days === 1) return 'checked yesterday';
  return `checked ${days} days ago`;
}

/**
 * The weakest claim in a set, which is what a group of rows is worth.
 *
 * A week containing one out-of-date row is a week you cannot act on without
 * checking, and reporting the group at its *best* row would say the opposite.
 * Empty comes back null rather than defaulting to anything — a set with
 * nothing in it makes no claim, and picking a word for it would be inventing
 * one.
 */
export function weakest(list: Where[]): Where | null {
  if (list.length === 0) return null;
  return list.reduce((worst, w) => (TRUST[w] > TRUST[worst] ? w : worst));
}
