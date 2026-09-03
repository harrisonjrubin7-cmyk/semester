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

import { COURSES } from '../data/catalog';
import type { FeedEvent } from './types';

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
    return { date: new Date(Number(y), Number(m) - 1, Number(d)), allDay: true };
  }
  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!stamp) return null;
  const [, y, mo, d, h, mi, s, utc] = stamp;
  // A UTC stamp is converted to the device's own time; a floating or TZID
  // stamp is taken at face value, which is what a campus feed means by it.
  const date = utc
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { date, allDay: false };
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

/** Which course a feed entry looks like it belongs to, by its code. */
export function matchCourse(text: string): string | null {
  const upper = text.toUpperCase();
  for (const c of COURSES) {
    const code = c.code.toUpperCase();
    if (upper.includes(code) || upper.includes(code.replace(/\s+/g, ''))) return c.id;
  }
  // A bare subject code — "ECON" — is enough when only one course has it.
  for (const c of COURSES) {
    const subject = c.code.split(/\s+/)[0].toUpperCase();
    const others = COURSES.filter((o) => o.code.toUpperCase().startsWith(subject));
    if (others.length === 1 && upper.includes(subject)) return c.id;
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

export function parseIcs(text: string, sourceId = ''): IcsResult {
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
      if (current) events.push(...toEvents(current, sourceId));
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

function toEvents(raw: RawEvent, sourceId: string): FeedEvent[] {
  const startField = raw.DTSTART;
  if (!startField) return [];
  const when = parseWhen(startField);
  if (!when) return [];

  const title = unescape(raw.SUMMARY?.value ?? 'Untitled');
  const where = unescape(raw.LOCATION?.value ?? '');
  const note = unescape(raw.DESCRIPTION?.value ?? '').slice(0, 400);
  const uid = raw.UID?.value ?? `${title}-${when.date.getTime()}`;
  const courseId = matchCourse(`${title} ${where} ${note}`);

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
