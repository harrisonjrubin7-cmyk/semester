/**
 * A small iCalendar reader.
 *
 * Every system a student is made to use speaks this: Brightspace publishes a
 * per-user feed, Outlook and Google both export it, Zoom emails it. Reading it
 * is how the app connects to a calendar without asking anyone for a password,
 * and it is the fallback whenever an API is not available.
 *
 * What is supported is what these feeds actually contain: VEVENT with SUMMARY,
 * DTSTART, DTEND, LOCATION, DESCRIPTION, and weekly or daily RRULEs so a class
 * that repeats does not appear once — together with the two ways a repeating
 * class is changed, EXDATE for a week cancelled and RECURRENCE-ID for a week
 * moved. Anything else is skipped rather than guessed at.
 */

import type { Course, FeedEvent } from './types';
import { realDate } from './date';

/** Folded lines are continued with a space or tab. Undo that first. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(Boolean);
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

interface RawEvent {
  [key: string]: { params: Record<string, string>; value: string };
}

/** "20260903T140000Z" or "20260903" → a local Date, plus whether it is all-day. */
function parseWhen(field: { params: Record<string, string>; value: string }): {
  date: Date;
  allDay: boolean;
} | null {
  const v = field.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    // `realDate` rather than `new Date(...)`: the shape of a date is not the
    // same as the date existing, and this is the one input in the app that a
    // server the student does not control can send, and resend. See
    // `lib/date.ts`.
    const date = realDate(Number(y), Number(m), Number(d));
    return date ? { date, allDay: true } : null;
  }
  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!stamp) return null;
  const [, y, mo, d, h, mi, s, utc] = stamp;
  // A UTC stamp is converted to the device's own time; a floating or TZID
  // stamp is taken at face value, which is what a campus feed means by it.
  // Read back through whichever set of getters matches, or every correct feed
  // either side of Greenwich would be refused.
  const date = realDate(
    +y,
    +mo,
    +d,
    { hours: +h, minutes: +mi, seconds: +s },
    Boolean(utc),
  );
  return date ? { date, allDay: false } : null;
}

function iso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function clock(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

/**
 * Whether `needle` appears in `haystack` as a word, not inside one.
 *
 * `\b` rather than a space test, so a code at the very start or end of a
 * title, or up against a colon or a dash, still counts.
 */
function saysWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/**
 * Which course a feed entry looks like it belongs to, by its code.
 *
 * Two passes, and they are deliberately not equally trusting.
 *
 * A full code — "BUS 1600", "ECON1020" — carries a number, so it cannot be an
 * ordinary word and is matched however it is capitalised.
 *
 * A bare subject is a guess, and it used to be a bad one. The matcher
 * uppercased the entry first and asked whether it contained the subject, which
 * filed "Catch the bus to campus" against BUS 1600 and "3 apps to try" against
 * a course called APPS. Uppercasing destroyed the one signal that separates a
 * course code from an English word, which is that the code is written in
 * capitals and the word is not. So the bare-subject pass reads the entry as it
 * was written.
 *
 * A wrongly filed entry is worse than an unfiled one: it lands inside a
 * course's own list looking like something the professor set. What is left
 * unmatched is still on the calendar, just not attributed — which is the right
 * way round for a guess.
 */
export function matchCourse(courses: Course[], text: string): string | null {
  const upper = text.toUpperCase();
  for (const c of courses) {
    const code = c.code.toUpperCase();
    if (saysWord(upper, code) || saysWord(upper, code.replace(/\s+/g, ''))) return c.id;
  }
  for (const c of courses) {
    const subject = c.code.split(/\s+/)[0].toUpperCase();
    const others = courses.filter((o) => o.code.toUpperCase().startsWith(subject));
    // Against `text`, not `upper`: a feed entry that means the course writes
    // the subject in capitals.
    if (others.length === 1 && saysWord(text, subject)) return c.id;
  }
  return null;
}

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Dates a weekly or daily rule produces, bounded so a bad rule cannot hang. */
function expand(rule: string, start: Date): Date[] {
  const parts = Object.fromEntries(
    rule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k.toUpperCase(), v ?? ''];
    }),
  );
  const freq = parts.FREQ;
  if (freq !== 'WEEKLY' && freq !== 'DAILY') return [];

  const interval = Math.max(1, Number(parts.INTERVAL || 1));
  const count = parts.COUNT ? Number(parts.COUNT) : 0;
  const until = parts.UNTIL ? parseWhen({ params: {}, value: parts.UNTIL })?.date : undefined;
  // No end at all means an open-ended rule; a semester is the honest horizon.
  const horizon = until ?? new Date(start.getTime() + 200 * 24 * 3600 * 1000);
  const days = (parts.BYDAY || '')
    .split(',')
    .map((d) => DAY_CODES[d.slice(-2).toUpperCase()])
    .filter((d) => d !== undefined);

  const out: Date[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= horizon && guard < 400 && (count === 0 || out.length < count)) {
    guard += 1;
    if (freq === 'DAILY') {
      out.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + interval);
    } else {
      const weekStart = new Date(cursor);
      const wanted = days.length ? days : [start.getDay()];
      for (const day of wanted) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
        if (d >= start && d <= horizon) out.push(d);
      }
      cursor.setDate(cursor.getDate() + 7 * interval);
    }
  }
  return out
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, count || 200);
}

export interface IcsResult {
  events: FeedEvent[];
  /** The calendar's own name, when it gives one. */
  name: string;
}

export function parseIcs(courses: Course[], text: string, sourceId = ''): IcsResult {
  const lines = unfold(text);
  /*
   * Read every entry before drawing any of them.
   *
   * An entry that moves one week of a repeating class is a second VEVENT
   * carrying the same UID and a RECURRENCE-ID naming the week it replaces, and
   * it may be written before or after the entry it replaces. So which
   * occurrences the rule actually produces is not known until the whole file
   * has been read — emitting each entry as its END line arrives cannot express
   * that, and drew the class on the day it moved from as well as the day it
   * moved to.
   */
  const raws: RawEvent[] = [];
  let name = '';
  let current: RawEvent | null = null;

  /*
   * How deep inside a component we are that is not the event itself.
   *
   * A VEVENT can contain a whole other component, and in practice almost
   * always does: Google Calendar writes a VALARM into every event that has a
   * reminder on it, which for a student's own calendar is most of them. This
   * reader knew only BEGIN:VEVENT, so every other BEGIN line fell through to
   * the property branch below and the nested component's own properties were
   * written onto the event, last one winning.
   *
   * An alarm carries a DESCRIPTION, and Google's says "This is an event
   * reminder". It appears after the event's own DESCRIPTION, so that sentence
   * replaced whatever the professor actually wrote — the room change, the
   * reading, the link. An ACTION:EMAIL alarm carries a SUMMARY as well, which
   * RFC 5545 requires of it, and that replaced the event's *title*. Measured
   * against exports shaped the way Google and Outlook shape them.
   *
   * Nothing about that is specific to alarms, so nothing here is either: an
   * event's properties are the ones written directly inside it, and anything
   * between a nested BEGIN and its END belongs to that component instead.
   * Counted rather than flagged, because components nest more than one deep.
   */
  let inside = 0;

  for (const line of lines) {
    // Component names are case-insensitive in RFC 5545, and property names are
    // already read that way a few lines down. A feed that writes `begin:valarm`
    // in lower case is rare, but it must not be the one that gets through.
    const mark = /^(BEGIN|END):(.*)$/i.exec(line);
    const opens = mark?.[1].toUpperCase() === 'BEGIN';
    const of = mark?.[2].trim().toUpperCase();

    if (mark && of === 'VEVENT') {
      if (opens) {
        current = {};
      } else {
        if (current) raws.push(current);
        current = null;
      }
      inside = 0;
      continue;
    }
    // Outside an event, a component boundary is nothing to track: the calendar
    // header is read by key, and a VTIMEZONE's properties are already ignored
    // for want of an event to attach them to.
    if (mark && current) {
      inside = opens ? inside + 1 : Math.max(0, inside - 1);
      continue;
    }
    if (inside > 0) continue;

    const split = line.indexOf(':');
    if (split === -1) continue;
    const rawKey = line.slice(0, split);
    const value = line.slice(split + 1);
    const [key, ...paramParts] = rawKey.split(';');
    const params = Object.fromEntries(
      paramParts.map((p) => {
        const [k, v] = p.split('=');
        return [k.toUpperCase(), v ?? ''];
      }),
    );

    if (!current) {
      if (key.toUpperCase() === 'X-WR-CALNAME') name = unescape(value);
      continue;
    }
    const k = key.toUpperCase();
    /*
     * A property may be written once — except the exclusions, which RFC 5545
     * lets a calendar spread over as many EXDATE lines as it likes, and Google
     * writes one line per cancelled week. Every other property here is
     * single-valued and the last one written wins. EXDATE's value is already a
     * comma-separated list, so joining the lines with a comma is not a special
     * case downstream; it is the same list, written out in full.
     */
    const held = current[k];
    current[k] = held && k === 'EXDATE' ? { params, value: `${held.value},${value}` } : { params, value };
  }

  /*
   * The weeks a rule generates but the calendar has taken back: one map from
   * an entry's UID to the days some other entry says it now happens on
   * instead. Held by day rather than by the exact stamp, because a calendar is
   * free to write the replaced week as a floating time, a UTC time or a bare
   * date, and the app draws these by the day either way — the alternative is
   * an exact match that a correct feed can miss, leaving the class on both
   * days again.
   */
  const replaced = new Map<string, Set<string>>();
  const onward = new Map<string, Onward[]>();
  /*
   * The entries that describe a class in their own right — and can be drawn.
   *
   * Both halves matter. A change for good is not drawn on its own, because the
   * occurrence it names is one the entry it changes already makes; it only
   * falls back to drawing itself where there is no such entry. Counting one
   * that cannot be read as though it were there left neither drawn: the entry
   * it changes produces nothing for want of a date, and the change stood down
   * for it. A readable move naming a real day and a real time, and the class
   * gone from the calendar altogether.
   *
   * That is the third shape of the same mistake on this reader, and the shape
   * is worth naming: an entry the app cannot read should cost only itself. It
   * must not take a week, an id, or another entry down with it. The two
   * before it are the guards on `replaced` below, and the fallback id where
   * RECURRENCE-ID is unreadable.
   */
  const described = new Set<string>();
  for (const raw of raws) {
    if (raw['RECURRENCE-ID'] || !raw.DTSTART || !parseWhen(raw.DTSTART)) continue;
    described.add(raw.UID?.value ?? '');
  }

  for (const raw of raws) {
    const at = raw['RECURRENCE-ID'];
    if (!at) continue;
    const day = parseWhen(at);
    if (!day) continue;
    /*
     * A week is only taken back by an entry that actually puts something in
     * its place. An override with no DTSTART, or one this reader cannot read a
     * date out of, draws nothing — and counting it here suppressed the week
     * anyway, so a malformed entry deleted a lecture outright rather than
     * failing to move it. Read on its own the week simply stays where the rule
     * put it, which is what the reader did before it knew about overrides at
     * all, and the smaller wrong answer of the two.
     */
    const moved = raw.DTSTART && parseWhen(raw.DTSTART);
    if (!moved) continue;
    const uid = raw.UID?.value ?? '';

    /*
     * `RANGE=THISANDFUTURE` changes the rest of the series, not one week of it
     * — the class that moves to Thursday for good, rather than the one Monday
     * that clashed with a holiday. Taking back only the week it names left
     * every later week sitting on the day the class no longer meets, which is
     * the same wrong answer this whole section exists to stop, only quieter
     * for lasting the rest of term.
     *
     * The change is carried as a whole number of days between the week it
     * names and the day it moved to, and applied to each later occurrence by
     * that count — not by adding milliseconds to a Date. A class is a wall
     * clock: two o'clock stays two o'clock across the weekend the clocks go
     * back, and an offset in milliseconds would make it one.
     */
    if ((at.params.RANGE ?? '').toUpperCase() === 'THISANDFUTURE') {
      const list = onward.get(uid) ?? [];
      list.push({
        from: iso(day.date),
        shift: Math.round((dayOf(moved.date).getTime() - dayOf(day.date).getTime()) / 86400000),
        clockAt: moved.date,
        allDay: moved.allDay,
        look: lookOf(courses, raw),
        /*
         * Nothing draws it on its own: the occurrence it names is one of the
         * ones the rule already makes, and this moves that one along with the
         * rest. Where the entry it changes is not in the file at all there is
         * no series to move, so it falls through and is drawn once, which is
         * the only thing left that does not lose it.
         */
        alone: !described.has(uid),
      });
      onward.set(uid, list);
      continue;
    }

    const days = replaced.get(uid) ?? new Set<string>();
    days.add(iso(day.date));
    replaced.set(uid, days);
  }

  for (const list of onward.values()) list.sort((a, b) => a.from.localeCompare(b.from));

  const events: FeedEvent[] = [];
  for (const raw of raws) events.push(...toEvents(courses, raw, sourceId, replaced, onward));

  return { events, name };
}

/** Midnight of a date, so a difference between two of them counts whole days. */
function dayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface Look {
  title: string;
  where: string;
  note: string;
  courseId: string | null;
}

function lookOf(courses: Course[], raw: RawEvent): Look {
  const title = unescape(raw.SUMMARY?.value ?? 'Untitled');
  const where = unescape(raw.LOCATION?.value ?? '');
  const note = unescape(raw.DESCRIPTION?.value ?? '').slice(0, 400);
  return { title, where, note, courseId: matchCourse(courses, `${title} ${where} ${note}`) };
}

/** A change an entry makes to its series from one week onward. */
interface Onward {
  from: string;
  shift: number;
  clockAt: Date;
  allDay: boolean;
  look: Look;
  alone: boolean;
}

function toEvents(
  courses: Course[],
  raw: RawEvent,
  sourceId: string,
  replaced: Map<string, Set<string>>,
  onward: Map<string, Onward[]>,
): FeedEvent[] {
  const startField = raw.DTSTART;
  if (!startField) return [];
  const when = parseWhen(startField);
  if (!when) return [];

  const look = lookOf(courses, raw);
  const uid = raw.UID?.value ?? `${look.title}-${when.date.getTime()}`;

  const draw = (date: Date, id: string, as: Look = look, allDay = when.allDay): FeedEvent => ({
    id,
    sourceId,
    title: as.title,
    date: iso(date),
    at: allDay ? null : date.getHours() * 60 + date.getMinutes(),
    time: allDay ? 'All day' : clock(date),
    where: as.where,
    note: as.note,
    courseId: as.courseId,
  });

  /*
   * This entry replaces one week of a repeating class rather than describing a
   * class of its own, so it is drawn once, on its own date, and its rule — if
   * it even carries one — is not expanded.
   *
   * Its id is the week it replaces — the RECURRENCE-ID, not the day it moved
   * to. Two reasons, and the second is the one that is easy to get wrong.
   *
   * `${uid}-0` is what the first occurrence of the master entry is called, and
   * an override of the first week is exactly the common case, so numbering
   * this one would have given two entries the same id. `union` in
   * `lib/merge.ts` keeps one row per id, so the first sync silently dropped
   * one of the two, and re-reading the feed only recreated the collision.
   *
   * And the week it replaces is the only part of an override that does not
   * change. Name it after the day it moved to and moving that same week a
   * second time — the professor settling on Friday after trying Thursday —
   * renames the row, so `union` cannot match what the other device already
   * holds and keeps both: the class drawn on Thursday *and* Friday. The
   * RECURRENCE-ID is what this entry is about, and it is the same on every
   * reading.
   *
   * A RECURRENCE-ID this reader cannot read a date out of leaves nothing
   * stable to use, so the moved day stands in. The entry is still drawn: it
   * names a real day and dropping it would lose a class outright, which is the
   * trade made where `replaced` is built, in the other direction.
   */
  const at = raw['RECURRENCE-ID'];
  if (at) {
    const original = parseWhen(at);
    // A change to the rest of the series is drawn by the entry it changes, not
    // here — unless that entry is not in the file, when this is all there is.
    const range = (at.params.RANGE ?? '').toUpperCase() === 'THISANDFUTURE';
    if (range && !(onward.get(uid) ?? []).some((o) => o.alone)) return [];
    return [draw(when.date, `${uid}-at-${iso((original ?? when).date)}`)];
  }

  /*
   * Weeks the calendar has taken back — the class was cancelled, or it moved
   * and some other entry now draws it. Both are read by day, for the reason
   * given where `replaced` is built.
   */
  const gone = new Set(replaced.get(uid) ?? []);
  for (const value of (raw.EXDATE?.value ?? '').split(',')) {
    if (!value.trim()) continue;
    const day = parseWhen({ params: raw.EXDATE?.params ?? {}, value });
    if (day) gone.add(iso(day.date));
  }

  const dates = raw.RRULE ? expand(raw.RRULE.value, when.date) : [when.date];
  const all = dates.length ? dates : [when.date];

  /*
   * Numbered before the cancelled weeks are taken out, so that cancelling one
   * week does not renumber the ones after it. An id is what ties a row to the
   * one already synced to another device; renumbering would make every later
   * week of the term look like a new entry, and leave the old ones behind.
   */
  /*
   * A week changed for good keeps the id of the occurrence it came from: it is
   * the same class on a new day, so the row a device already holds is updated
   * rather than joined by a second one. The last change that has come into
   * force by that week is the one that applies, so a class moved twice ends
   * where it was moved to last.
   */
  const changes = onward.get(uid) ?? [];
  const changeOn = (day: string): Onward | undefined => {
    let found: Onward | undefined;
    for (const c of changes) if (c.from <= day) found = c;
    return found;
  };

  return all
    .map((date, i) => ({ date, id: `${uid}-${i}` }))
    .filter((o) => !gone.has(iso(o.date)))
    .map((o) => {
      const change = changeOn(iso(o.date));
      if (!change) return draw(o.date, o.id);
      const moved = new Date(
        o.date.getFullYear(),
        o.date.getMonth(),
        o.date.getDate() + change.shift,
        change.clockAt.getHours(),
        change.clockAt.getMinutes(),
      );
      return draw(moved, o.id, change.look, change.allDay);
    });
}
