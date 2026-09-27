import type { Screen } from './types';
import type { SourceLabel } from './source';

/**
 * One inbox for what the term is telling you, with every message's source on it.
 *
 * A student hears from the registrar by email, from aid through a portal, from
 * safety by text, from a course through the LMS and from this app through its
 * own reminders. The hub puts them in one list — and the one list is only safe
 * if nothing in it can be mistaken for something else. So:
 *
 * - **Every message carries its source.** `admit` drops one without.
 * - **Required is official-only, and current-only.** A registrar hold is
 *   required while the school's record is current; a Semester reminder never
 *   is, nor is a stale official fact, and `admit` downgrades any that claims to be.
 * - **Nothing sponsored.** Sponsored content is dropped outright, not sorted
 *   below — "no sponsor content mixed with official notices" is not satisfied
 *   by putting it lower down.
 * - **No escalation.** The hub shows; it does not email, text or push beyond
 *   what the student switched on elsewhere. There is no send function here, and
 *   `comms.test.ts` holds that there is not.
 * - **Required notices ignore mute and quiet hours.** Quiet hours hold back the
 *   optional ones only. A student can silence Semester entirely; they cannot
 *   silence the registrar through Semester, because the registrar will not
 *   know they did.
 */

export const CHANNELS = [
  { id: 'official', label: 'Official', says: 'Registrar, financial aid, campus safety and departments.' },
  { id: 'course', label: 'Courses', says: 'Instructors and your course sites.' },
  { id: 'semester', label: 'Semester', says: 'Your own plan, study and support reminders.' },
] as const;

export type Channel = (typeof CHANNELS)[number]['id'];

export type Priority = 'required' | 'high' | 'normal' | 'low';

export const PRIORITY_LABEL: Record<Priority, string> = {
  required: 'Required',
  high: 'Soon',
  normal: 'Update',
  low: 'FYI',
};

export interface Message {
  id: string;
  channel: Channel;
  /** "Registrar", "ECON 1010", "Launchpad" — drawn on every message. */
  source: string;
  title: string;
  body?: string;
  /** ISO date-time. */
  at: string;
  priority: Priority;
  /** Somewhere in the app to act on it. */
  screen?: Screen;
  /** Set by whoever produced it. Dropped by `admit`. */
  sponsored?: boolean;
  /**
   * Whether an official message is the school's current record. Required is
   * allowed only when this is `true`; `admit` downgrades anything else.
   */
  current?: boolean;
  /** The app-wide source label (lib/source.ts), for messages that carry facts. */
  sourceLabel?: SourceLabel;
  /** The official page. Only `https:` survives `admit`. */
  url?: string;
  urlLabel?: string;
}

/**
 * What the hub will show, cleaned.
 *
 * Returns the survivors and a count of what was refused, so a test — or a
 * future connector author — can see that something was dropped rather than
 * wondering where it went.
 */
export function admit(messages: readonly Message[]): { shown: Message[]; refused: number } {
  const shown: Message[] = [];
  let refused = 0;
  for (const m of messages) {
    if (m.sponsored || !m.source.trim() || !m.title.trim()) {
      refused += 1;
      continue;
    }
    // Required only from an official channel, and only while that channel says
    // the fact is current — it is the one label that ignores quiet hours and mute.
    const mayRequire = m.channel === 'official' && m.current === true;
    const url = m.url && /^https:\/\//i.test(m.url) ? m.url : undefined;
    shown.push({ ...m, url, priority: m.priority === 'required' && !mayRequire ? 'high' : m.priority });
  }
  const rank: Record<Priority, number> = { required: 0, high: 1, normal: 2, low: 3 };
  shown.sort((a, b) => rank[a.priority] - rank[b.priority] || a.at.localeCompare(b.at));
  return { shown, refused };
}

export type Digest = 'instant' | 'daily' | 'weekly';

export interface HubPrefs {
  /** Muted channels. `official` may be muted, but required messages still show. */
  muted: Channel[];
  /** Minutes since midnight; equal means no quiet hours. */
  quietFrom: number;
  quietTo: number;
  digest: Digest;
  read: string[];
  saved: string[];
  followUp: string[];
}

export const EMPTY_PREFS: HubPrefs = {
  muted: [],
  quietFrom: 22 * 60,
  quietTo: 7 * 60,
  digest: 'instant',
  read: [],
  saved: [],
  followUp: [],
};

/** Whether a minute of the day falls in quiet hours, which may wrap midnight. */
export function inQuietHours(minute: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/**
 * What to draw now, given the student's preferences.
 *
 * Required always. Otherwise: not muted, and — when `now` is in quiet hours —
 * held until they end. Held is not hidden: `held` is returned so the screen
 * can say "3 waiting until 7:00".
 */
export function visible(messages: readonly Message[], prefs: HubPrefs, minuteNow: number) {
  const quiet = inQuietHours(minuteNow, prefs.quietFrom, prefs.quietTo);
  const now: Message[] = [];
  let held = 0;
  for (const m of messages) {
    if (m.priority === 'required') {
      now.push(m);
    } else if (prefs.muted.includes(m.channel)) {
      continue;
    } else if (quiet) {
      held += 1;
    } else {
      now.push(m);
    }
  }
  return { now, held };
}

/** Group for a digest: by day for daily, by ISO week start (Monday) for weekly. */
export function digestGroups(messages: readonly Message[], digest: Digest): { key: string; items: Message[] }[] {
  if (digest === 'instant') return [{ key: 'All', items: [...messages] }];
  const out = new Map<string, Message[]>();
  for (const m of messages) {
    const d = new Date(m.at);
    let key = m.at.slice(0, 10);
    if (digest === 'weekly' && !Number.isNaN(d.getTime())) {
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
      key = `Week of ${monday.toISOString().slice(0, 10)}`;
    }
    out.set(key, [...(out.get(key) ?? []), m]);
  }
  return [...out.entries()].map(([key, items]) => ({ key, items }));
}

function ids(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-500) : [];
}

export function readHubPrefs(v: unknown): HubPrefs {
  if (!v || typeof v !== 'object') return EMPTY_PREFS;
  const o = v as Record<string, unknown>;
  const minute = (x: unknown, d: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 1440 ? x : d);
  const channels = new Set<string>(CHANNELS.map((c) => c.id));
  return {
    muted: ids(o.muted).filter((c) => channels.has(c)) as Channel[],
    quietFrom: minute(o.quietFrom, EMPTY_PREFS.quietFrom),
    quietTo: minute(o.quietTo, EMPTY_PREFS.quietTo),
    digest: o.digest === 'daily' || o.digest === 'weekly' ? o.digest : 'instant',
    read: ids(o.read),
    saved: ids(o.saved),
    followUp: ids(o.followUp),
  };
}

/** Add or remove one id from a list, for read / saved / follow-up. */
export function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
