/**
 * What moved while you were not looking.
 *
 * The app now merges two devices properly, folds in announcements, and pulls
 * calendar feeds — so things genuinely change without you doing them. A
 * deadline you ticked on the laptop is ticked here. An announcement you
 * accepted last night moved a midterm. A feed brought in four events. None of
 * that was ever said out loud, so the app quietly became different and left
 * you to notice.
 *
 * One line on Today, and only when there is something to say.
 *
 * ## Counted against a mark, not against a memory
 *
 * The comparison is with the last time you opened the app, which is a stamp
 * the app sets and nothing else touches. That makes "since you last looked"
 * mean something precise rather than "recently", and it means the line
 * disappears once you have seen it rather than nagging for a week.
 *
 * ## What it will not do
 *
 * It does not list what *you* did. A person who just ticked four things does
 * not need telling they ticked four things, and a change log that includes
 * your own actions is one nobody reads twice. Everything here is a change
 * that arrived from somewhere else — another device, a feed, an import.
 */

import { daysBetween } from './date';

export interface Change {
  /** What happened, in one clause. */
  said: string;
  /** Where to go to see it, or empty. */
  screen: string;
}

export interface SinceInput {
  /** Epoch ms of the last time this device opened the app. Zero on a first run. */
  lastSeen: number;
  now: Date;
  /** Deadlines ticked, with when. From `tickedAt`. */
  tickedAt: Record<string, number>;
  /** Which of those were ticked on this device this session. */
  mine: string[];
  /** Calendar events, with when their feed last pulled. */
  feeds: { id: string; name: string; synced: number; count: number }[];
  /** Course material added, with when. */
  updates: { id: string; created: number }[];
  /** Practice papers sat, with when. */
  sittings: { id: string; at: number }[];
}

/**
 * How long ago the app was last opened, for deciding whether to speak at all.
 *
 * Under a couple of hours is the same sitting — somebody who closed the tab
 * to look something up does not want a change report on the way back. Over a
 * fortnight the phrase stops meaning anything useful and the line says so
 * differently.
 */
const QUIET_MS = 2 * 60 * 60 * 1000;

export function shouldSpeak(lastSeen: number, now: Date): boolean {
  if (lastSeen <= 0) return false;
  return now.getTime() - lastSeen >= QUIET_MS;
}

/** Everything that changed since the mark, that you did not do yourself. */
export function changes(input: SinceInput): Change[] {
  const { lastSeen, tickedAt, mine, feeds, updates, sittings } = input;
  if (lastSeen <= 0) return [];
  const out: Change[] = [];

  const elsewhere = Object.entries(tickedAt).filter(
    ([id, at]) => at > lastSeen && !mine.includes(id),
  );
  if (elsewhere.length > 0) {
    out.push({
      said: `${elsewhere.length} ${elsewhere.length === 1 ? 'deadline was' : 'deadlines were'} ticked on your other device`,
      screen: 'home',
    });
  }

  const pulled = feeds.filter((f) => f.synced > lastSeen && f.count > 0);
  if (pulled.length > 0) {
    const total = pulled.reduce((n, f) => n + f.count, 0);
    out.push({
      said: `${pulled[0].name} brought in ${total} ${total === 1 ? 'event' : 'events'}`,
      screen: 'connect',
    });
  }

  const added = updates.filter((u) => u.created > lastSeen);
  if (added.length > 0) {
    out.push({
      said: `${added.length} ${added.length === 1 ? 'reading was' : 'readings were'} added to a course`,
      screen: 'courses',
    });
  }

  const sat = sittings.filter((s) => s.at > lastSeen);
  if (sat.length > 0) {
    out.push({
      said: `${sat.length} practice ${sat.length === 1 ? 'paper was' : 'papers were'} sat`,
      screen: 'exam',
    });
  }

  return out;
}

/**
 * "Since yesterday" — how the gap reads.
 *
 * Counted in calendar days rather than in elapsed hours, because that is what
 * the words mean. Nine in the morning on Monday to eight on Wednesday is
 * forty-seven hours, which divides into one "day" and would have read "since
 * yesterday" about a Monday.
 */
export function sinceLabel(lastSeen: number, now: Date): string {
  const days = daysBetween(new Date(lastSeen), now);
  if (days <= 0) return 'Since earlier today';
  if (days === 1) return 'Since yesterday';
  if (days <= 13) return `In the ${days} days since you last opened this`;
  return 'Since you were last here';
}

/** The whole thing as one sentence, for a screen that wants one line. */
export function line(list: Change[]): string {
  if (list.length === 0) return '';
  const said = list.map((c) => c.said);
  if (said.length === 1) return `${said[0]}.`;
  const last = said.pop() as string;
  return `${said.join(', ')} and ${last}.`;
}

const SEEN_KEY = 'semester.seen';

/**
 * When this device last had the app open.
 *
 * On the device rather than in the account, deliberately: a laptop and a
 * phone were last opened at different times, and syncing this would make each
 * of them wrong about the other.
 */
export function readSeen(): number {
  try {
    const n = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    // A private window, or storage off. No mark, so nothing is claimed.
    return 0;
  }
}

export function writeSeen(at: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    /* storage off; the line simply never appears */
  }
}
