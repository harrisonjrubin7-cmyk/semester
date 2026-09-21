/**
 * How far a proposal reaches, and what that costs to confirm.
 *
 * `lib/tools.ts` already refuses to execute anything: a tool call becomes a
 * proposal with a sentence and a button, and the student decides. That is the
 * confirmation step, and it is the reason an assistant here cannot quietly
 * edit a semester.
 *
 * What it does not have is a way to say that some proposals deserve *more*
 * than a tap. The only axis is `sort: 'write' | 'view'` — whether this changes
 * what you have or only what you are looking at — and both of its values get
 * the same single button. That is right for every tool the app has today,
 * because every one of them touches the student's own device and nothing
 * else: sixteen tools, all of them a dispatch into the local store, none of
 * them visible to another person.
 *
 * It stops being right the moment a tool sends something. "Message this
 * classmate", "RSVP to this event", "post this announcement" — the writes a
 * campus platform wants — would arrive, be perfectly well described by
 * `sort: 'write'`, and get the confirmation a checkbox gets. Nothing in the
 * file would object, because nothing in the file is asking the question.
 *
 * So this is the question, asked once, in a vocabulary every tool must answer
 * in. It changes no behaviour today — every existing tool is `look` or `mine`,
 * and both confirm exactly as they did. It is a tripwire for the tool that has
 * not been written yet, which is the only moment it could be installed
 * cheaply.
 */

/**
 * The five, smallest first. Named for what they touch rather than A–E,
 * because a level called `'C'` is one nobody can check at the call site.
 */
export type Reach =
  /** Changes what you are looking at. Nothing is kept and nothing is lost. */
  | 'look'
  /** Changes your own things, on your own device, and can be put back. */
  | 'mine'
  /** Another person can see it. Sending is not undoing. */
  | 'outward'
  /** Costs money, a place, a record, or somebody's time. */
  | 'binding'
  /** Needs more than a tap: an identity check, or an institution's own gate. */
  | 'guarded';

/** Ordered, so "at least this far" is a comparison rather than a list of ifs. */
export const FURTHER: readonly Reach[] = ['look', 'mine', 'outward', 'binding', 'guarded'];

/** Whether `a` reaches at least as far as `b`. */
export function reaches(a: Reach, b: Reach): boolean {
  return FURTHER.indexOf(a) >= FURTHER.indexOf(b);
}

/**
 * The drawing decision, derived rather than declared a second time.
 *
 * `sort` and `reach` answering separately is two fields that can disagree
 * about one proposal, and the disagreement would be invisible: a tool marked
 * `outward` and `view` would be sent without being kept. One is the source.
 */
export function sortFor(reach: Reach): 'write' | 'view' {
  return reach === 'look' ? 'view' : 'write';
}

/**
 * Whether a single button is enough.
 *
 * `look` and `mine` are a tap, which is what the app does today and is not
 * changed by this file. Anything further is not, and the reason is not
 * severity in the abstract — it is that the undo stops working. A task you
 * added can be taken off your list; a message somebody has read cannot be
 * unread, and a seat you took cannot be given back by pressing the same
 * button again.
 */
export function needsMoreThanATap(reach: Reach): boolean {
  return reaches(reach, 'outward');
}

/**
 * What the confirmation has to show before it may be taken.
 *
 * Returns the empty string when a tap is enough. Otherwise a sentence naming
 * what cannot be taken back — which is the thing a student is actually being
 * asked to accept, and is not "are you sure".
 */
export function beforeYouSend(reach: Reach): string {
  if (reach === 'outward') return 'Somebody else will see this. It cannot be unsent.';
  if (reach === 'binding') return 'This commits something — money, a place, or a record.';
  if (reach === 'guarded') return 'This needs more than a tap to confirm.';
  return '';
}

/** What the apply loop must do with a proposal, decided in one place. */
export type Taking =
  /** Dispatch it now. One tap was the whole confirmation. */
  | { take: true }
  /** Hold it, and say this first. Nothing has happened yet. */
  | { take: false; because: string };

/**
 * Whether a proposal may be applied on the tap that was just made.
 *
 * Pulled out of the apply loop so it can be tested without a React root, and
 * so there is exactly one place that decides. The loop asking
 * `needsMoreThanATap` inline would work and would be the second place — and
 * the second place is the one that gets missed when a level is added.
 *
 * `held` is whether the student has already been shown the sentence and said
 * yes to it. The loop passes false on the first tap and true on the second;
 * nothing else may pass true.
 */
export function taking(reach: Reach, held: boolean): Taking {
  if (!needsMoreThanATap(reach) || held) return { take: true };
  return { take: false, because: beforeYouSend(reach) };
}
