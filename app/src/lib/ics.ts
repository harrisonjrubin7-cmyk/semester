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
 * that repeats does not appear once. Anything else is skipped rather than
 * guessed at.
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
  const events: FeedEvent[] = [];
  let name = '';
  let current: RawEvent | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (current) events.push(...toEvents(courses, current, sourceId));
      current = null;
      continue;
    }

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
    current[key.toUpperCase()] = { params, value };
  }

  return { events, name };
}

function toEvents(courses: Course[], raw: RawEvent, sourceId: string): FeedEvent[] {
  const startField = raw.DTSTART;
  if (!startField) return [];
  const when = parseWhen(startField);
  if (!when) return [];

  const title = unescape(raw.SUMMARY?.value ?? 'Untitled');
  const where = unescape(raw.LOCATION?.value ?? '');
  const note = unescape(raw.DESCRIPTION?.value ?? '').slice(0, 400);
  const uid = raw.UID?.value ?? `${title}-${when.date.getTime()}`;
  const courseId = matchCourse(courses, `${title} ${where} ${note}`);

  const dates = raw.RRULE ? expand(raw.RRULE.value, when.date) : [when.date];
  const all = dates.length ? dates : [when.date];

  return all.map((date, i) => ({
    id: `${uid}-${i}`,
    sourceId,
    title,
    date: iso(date),
    at: when.allDay ? null : date.getHours() * 60 + date.getMinutes(),
    time: when.allDay ? 'All day' : clock(date),
    where,
    note,
    courseId,
  }));
}

/**
 * Why a body is not a calendar, in a sentence — or null, when it is one.
 *
 * Asked before "how many events has it got", because those were one question
 * with one answer and that made the app blame the student's link for
 * something else entirely. Measured on the production build, pasting a
 * correct Brightspace feed address:
 *
 *   dev          The feed answered 403. A subscribed link needs the dev
 *                proxy running…                                      (true)
 *   production   No events in that calendar. It may be the wrong link —
 *                the feed has to be the .ics one.                    (not)
 *
 * `/feed` is a dev-server middleware (see `vite.config.ts`), so in a built app
 * the request is not proxied anywhere: it reaches the static host, which
 * answers a path it does not know with the app's own `index.html` — 200, and
 * `res.ok`. That HTML went through `parseIcs`, which quite correctly found no
 * events in it, and the student was told their link was wrong. Every
 * subscription in the shipped build failed that way, and the advice was to go
 * and find a different correct link.
 *
 * `BEGIN:VCALENDAR` is the first line of the format and the cheapest honest
 * question — at the start of a line, because a page that merely mentions the
 * word is not a calendar, and a leading BOM is what a Windows-written .ics
 * arrives with. Three answers rather than one, because the three have different
 * things to do about them: the app's own page means the request never left,
 * any other page means the address answered with something that is not a
 * feed — which is the mistake the old sentence was written for, pasting the
 * calendar's web page — and a real calendar is the caller's to count.
 */
export function notCalendar(text: string): string | null {
  if (/^[\uFEFF\s]*BEGIN:VCALENDAR/im.test(text)) return null;
  if (/<title>\s*Semester\s*</i.test(text)) {
    return (
      'That address was never reached: a browser is not allowed to fetch another site\u2019s ' +
      'calendar directly, and this build has nothing to do it for it. Download the .ics from ' +
      'Brightspace and add the file \u2014 the button beside this one takes it.'
    );
  }
  return (
    'What came back is not a calendar \u2014 a web page, most likely, rather than the .ics feed ' +
    'itself. Check that the link is the one Subscribe gave you, or download the file and add it.'
  );
}
