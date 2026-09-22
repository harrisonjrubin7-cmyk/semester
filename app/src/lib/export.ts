/**
 * Getting your work back out.
 *
 * An app that holds a semester's worth of notes, deadlines and transcripts and
 * offers no way to take them anywhere is a trap, however good it is. This is
 * the exit, and it is deliberately plain: CSV a spreadsheet opens, Markdown any
 * editor reads, .ics every calendar imports, and one JSON file that is the
 * whole account and can be read back in.
 *
 * Everything here is a pure function from data to a string. Nothing fetches,
 * nothing writes a file and nothing talks to Drive — that is `deliver.ts`, and
 * keeping the split means the formats can be tested without a browser and
 * without an account.
 *
 * The formats are the boring ones on purpose. A proprietary bundle only this
 * app can read would be the same trap with extra steps.
 */

import type { Catalog } from '../data/catalog';
import { dateToIso, isoToDate, realDate } from './date';
import type { Appointment, DatedItem, Note, PersonalTask } from './types';
import type { MailDraft } from './mailbox';
import { standingOf, type DoneMap } from './standing';
import { NO_TIME } from './duetime';
import type { State } from '../state/shape';
import { appointmentDays, appointmentLength, spanOf } from './select';
import { rrule } from './repeat';
import { readTerm, yearFor } from './term';
import { readSchoolPack } from './schoolpack';

// ── CSV ──────────────────────────────────────────────────────────────────

/**
 * One CSV cell, quoted when it has to be.
 *
 * A deadline title with a comma in it, a note with a line break, a quotation
 * mark in a professor's remark — each of those silently corrupts a naive
 * export, and the person only finds out when a column has shifted by one in
 * Excel three weeks later.
 */
export function cell(value: string): string {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: string[][]): string {
  // CRLF, because that is what the spec says and what Excel expects.
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function deadlineCsv(items: DatedItem[], done: DoneMap, code: (id: string) => string) {
  const rows = items.map((i) => [
    code(i.c),
    i.title,
    i.kind,
    `${i.mon} ${i.day}`,
    i.dueTime,
    i.weight ?? '',
    i.where ?? '',
    standingOf(i, done),
  ]);
  return toCsv(
    ['Course', 'Title', 'Kind', 'Due', 'Time', 'Weight', 'Where', 'Standing'],
    rows,
  );
}

export function taskCsv(tasks: PersonalTask[], code: (id: string) => string) {
  const rows = tasks.map((t) => [
    t.title,
    t.date ?? '',
    t.time,
    t.courseId ? code(t.courseId) : '',
    t.note,
    t.done ? 'done' : 'open',
  ]);
  return toCsv(['Title', 'Date', 'Time', 'Course', 'Note', 'Status'], rows);
}

// ── Markdown ─────────────────────────────────────────────────────────────

/**
 * Everything you wrote, which now includes what you wrote to a professor.
 *
 * `drafts` is a parameter rather than a second file because the Export screen
 * has promised for as long as the mail composer has existed that Notes is
 * "everything you wrote, including transcripts and email drafts" — and the
 * transcripts were true, because a kept transcript is a note, while the
 * drafts were not: they are their own collection and nothing exported them.
 * A half-written message asking for an extension is exactly the text somebody
 * would look for in that file.
 *
 * Optional, so the two callers that have only notes — and the tests about
 * notes — read the way they did.
 */
export function notesMarkdown(
  notes: Note[],
  code: (id: string) => string,
  drafts: MailDraft[] = [],
): string {
  if (notes.length === 0 && drafts.length === 0) return '# Notes\n\nNothing written yet.\n';
  const parts = notes.map((n) => {
    // The day the student wrote it, on their clock. `toISOString` would give
    // the UTC day, which is tomorrow's date for anything written in the
    // evening west of Greenwich — see `dateToIso`.
    const when = dateToIso(new Date(n.updated || n.created));
    const tag = n.courseId ? ` · ${code(n.courseId)}` : '';
    return `## ${n.title || 'Untitled'}\n\n_${when}${tag}_\n\n${n.body.trim() || '(empty)'}\n`;
  });
  const written = parts.length > 0 ? `# Notes\n\n${parts.join('\n---\n\n')}` : '# Notes\n\nNothing written yet.\n';
  if (drafts.length === 0) return written;

  const composed = drafts.map((d) => {
    // Same clock as the notes above, for the same reason: a draft written in
    // the evening west of Greenwich is already tomorrow in UTC, and the two
    // halves of one file disagreeing about what day it is is worse than either
    // date being wrong on its own.
    const when = dateToIso(new Date(d.updated));
    const tag = d.courseId ? ` · ${code(d.courseId)}` : '';
    // Said plainly, because a draft that was handed to a mail app may or may
    // not have been sent from it — the app saw it leave and nothing after.
    const stage = d.handed ? 'opened in your mail app' : 'not sent';
    const to = d.to.trim() ? `To: ${d.to.trim()}` : 'No recipient yet';
    return `## ${d.subject.trim() || 'No subject'}\n\n_${when}${tag} · ${stage}_\n\n${to}\n\n${d.body.trim() || '(empty)'}\n`;
  });
  return `${written}\n\n# Email drafts\n\n${composed.join('\n---\n\n')}`;
}

export function coursesMarkdown(cat: Catalog, items: DatedItem[]): string {
  const parts = cat.courses.map((c) => {
    const mine = items.filter((i) => i.c === c.id);
    const deadlines = mine.length
      ? mine.map((i) => `- **${i.title}** — ${i.kind}, ${i.mon} ${i.day}, ${i.dueTime}`).join('\n')
      : '- nothing dated';
    const grading = c.grading.length
      ? c.grading.map((g) => `| ${g.what} | ${g.pct} |`).join('\n')
      : '| — | — |';
    return [
      `## ${c.code} — ${c.name}`,
      '',
      `${c.prof}${c.email ? ` · ${c.email}` : ''}`,
      `${c.meets}${c.room ? ` · ${c.room}` : ''}${c.credits ? ` · ${c.credits}` : ''}`,
      '',
      '### How the grade is built',
      '',
      '| Part | Weight |',
      '| --- | --- |',
      grading,
      '',
      '### Deadlines',
      '',
      deadlines,
      '',
    ].join('\n');
  });
  return `# Courses\n\n${parts.join('\n')}`;
}

// ── Calendar ─────────────────────────────────────────────────────────────

/**
 * Escaping for iCalendar text, which is its own small language.
 *
 * Commas and semicolons separate fields in the format itself, so an unescaped
 * comma in "Essay 2, final draft" splits one event into two properties and the
 * import either fails or quietly loses half the title.
 */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Long lines folded to 75 octets, as the spec requires.
 *
 * Google and Apple both forgive an unfolded line; Outlook has historically not,
 * and an import that half-works is harder to debug than one that fails.
 *
 * Counted in octets, not characters, and never splitting one. The limit is
 * bytes: this app's own calendar name carries an em dash, a course title can
 * carry an accent, and a note title can carry an emoji — sliced by character
 * count those sail past 75 bytes, and slicing mid-character produces a line
 * an importer reads as mojibake or refuses outright.
 */
export function fold(line: string): string {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(line) <= 75) return line;

  const out: string[] = [];
  let current = '';
  let limit = 75;
  for (const ch of line) {
    if (bytes(current + ch) > limit) {
      out.push(current);
      current = ch;
      // Continuation lines carry a leading space, which costs one of the 75.
      limit = 74;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  date: Date;
  /** Minutes past midnight. Omit for an all-day entry. */
  at?: number;
  minutes?: number;
  /**
   * How many days an all-day entry covers, counting the first. Absent is one.
   *
   * Ignored when `at` names an hour, for the reason `Appointment.days` gives:
   * a span is an all-day span. Read only to work out the exclusive `DTEND`
   * below.
   */
  days?: number;
  /**
   * An iCalendar `RRULE` body, for something that happens again.
   *
   * Written as the rule rather than as one entry per occurrence, which is the
   * whole difference between a timetable that arrives in Google Calendar as
   * four courses and one that arrives as two hundred and forty rows nobody
   * can delete. `lib/repeat.ts` builds it.
   */
  rrule?: string;
  /**
   * Dates the rule skips — a cancelled class, an occurrence moved out.
   *
   * `EXDATE` has to name the *start instant* of the occurrence being skipped,
   * not the day: a date-only EXDATE against a timed DTSTART is ignored by
   * Google and by Outlook, which is how a cancelled lecture stays on the
   * calendar in both. So these are Dates, and the hour comes from `at`.
   */
  except?: Date[];
  /**
   * Minutes before the start, for a `VALARM` each. Empty or omitted for none.
   *
   * This is the part that makes a calendar file worth more than a list: the
   * reminder fires on a lock screen and a watch without this app being open,
   * without a push key, without a notification permission, and for the
   * majority of people who never turn notifications on.
   */
  alarms?: number[];
}

/**
 * How far ahead of a deadline the calendar's own alarm fires.
 *
 * Two, deliberately: the evening before is when something can still be
 * started, and an hour before is when it can still be submitted. More than two
 * and a calendar app starts to feel like the app it was meant to replace.
 */
export const ALARMS = [16 * 60, 60];

/**
 * A calendar file.
 *
 * A deadline goes in at the hour the syllabus actually stated, and as an
 * all-day entry when it stated none. That is a change: this used to write
 * every deadline as all-day, on the grounds that "11:59 PM" in a PDF is not a
 * timestamp in a timezone and inventing one would put a confident-looking
 * wrong time in someone's calendar. The first half of that is still true — a
 * deadline with no stated hour is still all-day rather than midnight, because
 * midnight is wrong twice, showing on the previous evening in some clients and
 * asserting a time nobody wrote. What changed is that the app now reads the
 * hour out of the due text (`lib/duetime.ts`) and marks the ones it could not
 * read, so an hour that *was* written down is no longer thrown away. An
 * all-day banner for something due at 11:59 PM is its own wrong answer: it
 * sorts above the day's classes and gives no runway.
 *
 * `METHOD:PUBLISH` marks this as a feed rather than an invitation, which stops
 * a mail client offering to RSVP to a problem set.
 */
export function toIcs(events: IcsEvent[], name = 'Semester'): string {
  const now = new Date();
  /*
   * DTSTAMP is the one field in this file that is a moment rather than a day,
   * and the `Z` on the end promises it is in UTC. It was built out of
   * `dateStamp` — which reads the *local* year, month and day, correctly, for
   * the DTSTART lines below — glued to UTC hours and minutes. West of
   * Greenwich after about six in the evening those two disagree, so the stamp
   * named yesterday and still claimed to be UTC. A client that compares
   * DTSTAMPs to decide which copy of an event is newer would then read a
   * fresh export as a day older than the one it already had, and keep the old
   * one. All six fields come from the same clock now.
   */
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Semester//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`,
    // Ask a subscribing client not to hammer this. A deadline that moves is
    // not urgent to the minute, and a feed polled every minute is one an
    // operator eventually blocks.
    'X-PUBLISHED-TTL:PT4H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
  ];

  for (const e of events) {
    /*
     * A day that is not a day is left out, rather than written down.
     *
     * `dateStamp` reads three fields off the Date and pads them, so an
     * Invalid Date — which is what `new Date(year, NaN, day)` is, and every
     * caller here builds its Date out of fields that came from a syllabus or
     * out of storage — wrote `DTSTART;VALUE=DATE:NaNNaNNaN`. Measured. That is
     * not a wrong date, it is a line no parser accepts, and a strict client
     * refuses the *file*: one unreadable appointment takes a whole semester of
     * deadlines down with it. Skipping is the smaller loss and the honest one
     * — the event was already unshowable, and what is saved is every other
     * event in the export.
     */
    if (Number.isNaN(e.date.getTime())) continue;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}@semester.app`);
    lines.push(`DTSTAMP:${stamp}`);
    /*
     * And an hour outside the clock is no hour, which is a thing this file can
     * already say. `at` is minutes past midnight; anything below 0 or at 1440
     * and above came out of a reader rather than off a clock — `-1` is how a
     * stored appointment records that no hour was read, and a hand-edited
     * backup can hold any figure at all. Passed through, -1 wrote
     * `DTSTART:19000101T-1-100` and 5000 wrote hour 83. All-day is what this
     * function already does for a deadline whose hour nobody stated, and it is
     * the same claim: the day is known and the time is not.
     */
    const at = Number.isInteger(e.at) && e.at! >= 0 && e.at! < 1440 ? e.at : undefined;
    if (at === undefined) {
      /*
       * `DTEND` on an all-day event is **exclusive** — RFC 5545 §3.6.1 — so
       * the day after the last one it covers. A one-day entry is therefore
       * start+1, which is what this wrote before spans existed and is the
       * same arithmetic: start + however many days it runs.
       *
       * Getting this wrong is the classic all-day bug and it is invisible on
       * the writing side. Off by one the short way and a Friday-to-Sunday
       * trip arrives ending Saturday; off by one the long way and every
       * single-day entry eats the next morning. Both import without a
       * warning, because both are valid files saying something else.
       */
      const span = Math.max(1, Math.floor(e.days ?? 1));
      const next = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate() + span);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(next)}`);
    } else {
      /*
       * The end rolls into the next day, which it did not.
       *
       * The end was minutes-past-midnight formatted as an hour and a minute,
       * so anything finishing after midnight wrote an hour of 24 or more: a
       * deadline at 11:59 PM — the commonest time in any syllabus, and this
       * app's own default — came out as `DTEND:20260904T242900`. RFC 5545
       * gives the hour two digits and the range 00–23, so that is not a late
       * time, it is a malformed one, and a client is free to drop the event,
       * drop its end, or refuse the file.
       *
       * Counted in whole days and leftover minutes rather than by adding
       * milliseconds to a Date: an iCalendar time with no `Z` is a wall clock,
       * and wall clocks are what these are. Adding half an hour to 11:59 PM on
       * the night the clocks go forward should still be half an hour later on
       * the clock.
       */
      const total = at + Math.max(0, e.minutes ?? 60);
      const endDate = new Date(
        e.date.getFullYear(),
        e.date.getMonth(),
        e.date.getDate() + Math.floor(total / 1440),
      );
      const endAt = total % 1440;
      lines.push(`DTSTART:${dateStamp(e.date)}T${pad(Math.floor(at / 60))}${pad(at % 60)}00`);
      lines.push(`DTEND:${dateStamp(endDate)}T${pad(Math.floor(endAt / 60))}${pad(endAt % 60)}00`);
    }
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    /*
     * One `EXDATE` line per skipped day, each carrying the occurrence's own
     * start time. A date-only EXDATE against a timed DTSTART is silently
     * ignored by both Google and Outlook — which is how a lecture cancelled
     * for a holiday stays on the calendar in both, looking like the app got it
     * wrong.
     */
    for (const gone of e.except ?? []) {
      if (Number.isNaN(gone.getTime())) continue;
      if (at === undefined) {
        lines.push(`EXDATE;VALUE=DATE:${dateStamp(gone)}`);
      } else {
        lines.push(`EXDATE:${dateStamp(gone)}T${pad(Math.floor(at / 60))}${pad(at % 60)}00`);
      }
    }
    lines.push(`SUMMARY:${icsText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    for (const minutes of e.alarms ?? []) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsText(e.summary)}`,
        `TRIGGER:-PT${Math.max(0, Math.round(minutes))}M`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/**
 * Deadlines as calendar entries.
 *
 * The `uid` is the item's own id and carries no date in it, which is what
 * makes a deadline that moves *update* the entry already in someone's calendar
 * instead of appearing beside the old one. Get that wrong and re-importing
 * leaves a student with two of everything and no way to tell which is real.
 */
export function deadlineEvents(
  items: DatedItem[],
  code: (id: string) => string,
  alarms: number[] = [],
): IcsEvent[] {
  return items.map((i) => ({
    uid: `item-${i.id}`,
    summary: `${code(i.c)}: ${i.title}${i.dueTime ? ` (due ${i.dueTime})` : ''}`,
    description: [i.kind, i.weight, i.where].filter(Boolean).join(' · '),
    date: i.date,
    // `NO_TIME` is what `lib/duetime.ts` returns when the syllabus named no
    // hour. Those stay all-day; the rest get the hour that was written down,
    // and half an hour of it, because a calendar wants a duration.
    at: i.dueAt >= NO_TIME ? undefined : i.dueAt,
    minutes: 30,
    alarms,
  }));
}

/**
 * The timetable, as repeating calendar entries.
 *
 * The one thing missing from every file this app has ever written, and the
 * thing a student most wants in their phone: the classes. Deadlines and
 * appointments were exported and the four courses that fill the week were
 * not, so "put my semester in my calendar" produced a calendar with the
 * homework on it and no lectures.
 *
 * ## One event per meeting pattern, not one per meeting
 *
 * `MWF 9:05` is a single `VEVENT` with `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`.
 * Written the other way — a row per meeting — a term of four courses is about
 * two hundred and forty entries, and nobody can move, recolour or delete them
 * afterwards without doing it two hundred and forty times.
 *
 * ## Cancellations travel with it
 *
 * The catalogue already knows which dates a course does not meet — reading
 * week, a holiday, a professor away — and each becomes an `EXDATE`. Without
 * them the exported calendar says there is a lecture on Thanksgiving, which
 * is worse than a calendar with no lectures on it: it is one that is wrong on
 * exactly the days somebody is relying on it.
 *
 * A one-off class *added* by an exception — a guest lecture, a make-up
 * session — comes out as its own entry, because that is what it is.
 *
 * ## Where the range comes from
 *
 * The caller's, and it has to be: a recurring schedule states no first or
 * last day. `screens/Export.tsx` takes it from the term's own dated
 * obligations, which is the same span the semester view draws.
 */
export function classEvents(
  cat: Catalog,
  from: Date,
  to: Date,
  opts: { officeHours?: boolean } = {},
): IcsEvent[] {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return [];
  const out: IcsEvent[] = [];
  const until = dateToIso(to);

  for (const mod of cat.modules) {
    const term = readTerm(mod.course.term);
    const exceptions = mod.exceptions ?? [];
    const room = mod.course.room ?? '';
    const length = spanOf(mod.course.meets ?? '') ?? 50;

    for (const [n, b] of mod.schedule.entries()) {
      // Office hours and standing calls are on the syllabus and are not
      // appointments; they go only when they are asked for.
      if (b.optional && !opts.officeHours) continue;
      if (b.days.length === 0) continue;

      const first = firstOn(from, b.days);
      if (!first || dateToIso(first) > until) continue;

      /*
       * The days named in iCalendar's own two-letter form, in week order.
       *
       * Sorted rather than taken in the order the syllabus happened to write
       * them: `BYDAY=WE,MO` is legal and is read back by some clients as a
       * week starting on Wednesday, which shifts the whole series.
       */
      const days = [...new Set(b.days)]
        .filter((d) => d >= 0 && d <= 6)
        .sort((x, y) => x - y)
        .map((d) => BYDAY[d])
        .join(',');

      const gone = exceptions
        .filter((e) => e.canceled && !e.extra && (e.title ? e.title === b.title : !b.optional))
        .map((e) => new Date(yearFor(term, e.month), e.month, e.day))
        .filter((d) => !Number.isNaN(d.getTime()) && b.days.includes(d.getDay()));

      out.push({
        // The block's position rather than its title: two blocks of one
        // course can share a title — a lab section and its lecture often do —
        // and a uid collision means one of them silently replaces the other
        // in the calendar it lands in.
        uid: `class-${mod.course.id}-${n}`,
        summary: `${mod.course.code}${b.title ? ` ${b.title}` : ''}`,
        description: [mod.course.name, mod.course.prof].filter(Boolean).join(' · '),
        location: b.meta || room,
        date: first,
        at: b.at,
        minutes: length,
        rrule: `FREQ=WEEKLY;BYDAY=${days};UNTIL=${until.replace(/-/g, '')}`,
        except: gone,
      });
    }

    for (const e of exceptions) {
      if (!e.extra) continue;
      const day = new Date(yearFor(term, e.month), e.month, e.day);
      if (Number.isNaN(day.getTime()) || day < from || day > to) continue;
      out.push({
        uid: `class-extra-${mod.course.id}-${e.month}-${e.day}`,
        summary: `${mod.course.code} ${e.extra.title}`,
        description: mod.course.name,
        location: e.extra.meta || room,
        date: day,
        at: e.extra.at,
        minutes: length,
      });
    }
  }

  return out;
}

/** iCalendar's two letters per weekday, Sunday first, as `Date.getDay` counts. */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * The first date on or after `from` that falls on one of these weekdays.
 *
 * Which is where a weekly series has to start: `DTSTART` is itself the first
 * occurrence in iCalendar, so a Monday/Wednesday/Friday class whose DTSTART
 * landed on a Tuesday would be read by a strict client as meeting on Tuesdays
 * too, and by a lenient one as starting a week late.
 */
function firstOn(from: Date, days: number[]): Date | null {
  for (let n = 0; n < 7; n += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
    if (days.includes(day.getDay())) return day;
  }
  return null;
}

/**
 * Appointments as calendar entries — the ones that name a day.
 *
 * The date was split into three numbers and handed to `new Date` unchecked,
 * and both halves of that are wrong for a record that has been through
 * storage. `Number('')` is 0, not NaN, so an appointment saved without a date
 * did not fall to the `|| 1` guards written beside it: it became 1 January
 * 1900 and went into the downloaded file as a real-looking entry on a day
 * nobody named. And a date of the shape `2026-02-31`, which a syllabus reader
 * or a hand-edited backup can hold, became 3 March the same silent way.
 *
 * `realDate` is the check this app already wrote for exactly that, and it
 * answers with the Date so there is nothing left to build. An appointment with
 * no usable date is dropped rather than placed: it is still in the app, on
 * every screen that lists it, and the alternative is a confident wrong entry
 * in somebody's actual calendar — the failure this whole file is careful
 * about, as the stable `uid` above says.
 */
export function appointmentEvents(appts: Appointment[]): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const a of appts) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.date);
    const day = parts && realDate(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    if (!day) continue;
    out.push({
      uid: `appt-${a.id}`,
      summary: a.title,
      description: a.kind ?? '',
      location: a.where || undefined,
      date: day,
      // -1 is how a stored appointment records that no hour was read. `toIcs`
      // turns any hour off the clock into an all-day entry anyway; this keeps
      // the sentinel from having to be understood twice.
      at: typeof a.at === 'number' ? a.at : undefined,
      // Its own length, so a four-hour shift is four hours in the calendar it
      // lands in rather than the hour every appointment used to get.
      minutes: appointmentLength(a),
      // And how many days, for the one with no hour to be long for. A week
      // off exported as a single Monday was the old behaviour, and it looked
      // right in the file.
      days: appointmentDays(a),
      // And its rule, so the Tuesday shift arrives as one repeating event.
      ...(a.repeat ? { rrule: rrule(a.repeat) } : {}),
      except: (a.repeat?.except ?? [])
        .map((iso) => isoToDate(iso))
        .filter((d) => !Number.isNaN(d.getTime())),
    });
  }
  return out;
}

// ── Naming ───────────────────────────────────────────────────────────────

/** A filename a filesystem, a Drive and a download header all accept. */
export function safeName(text: string, fallback = 'export'): string {
  const clean = text
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

/** "semester-2026-09-03" — sorts chronologically in any file list. */
export function stampedName(stem: string, at = new Date()): string {
  return `${safeName(stem)}-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

// ── Coming back in ───────────────────────────────────────────────────────

/**
 * Reading a backup this app wrote.
 *
 * An export nobody can import is a museum piece, so this is the other half.
 * It is deliberately strict about the envelope and forgiving about the
 * contents: the format tag has to match, and then each section is taken only
 * if it is the right shape, so a file from an older version restores what it
 * has and silently skips what it does not — rather than failing whole, or
 * worse, half-applying and leaving an account in a state neither version
 * understands.
 *
 * Nothing is merged. Restoring replaces the sections present in the file,
 * because merging two semesters produces duplicate courses with the same ids
 * and no way to tell which deadline belonged to which — and a restore that
 * silently doubles your deadlines is worse than one that refuses.
 */
export interface Restore {
  /** The sections that will be applied, named for the confirmation. */
  parts: string[];
  data: Record<string, unknown>;
}

/**
 * The parts of an account a backup carries, and what to call each one.
 *
 * Exported because `lib/snapshots.ts` counts the same things to say what a
 * restore would change. One list, so a section added to a backup is
 * automatically a section a restore warns you about.
 */
export const BACKUP_SECTIONS: { key: string; label: string; array: boolean; valueType?: 'string'|'number' }[] = [
  { key: 'courses', label: 'courses', array: true },
  { key: 'updates', label: 'added readings', array: true },
  { key: 'notes', label: 'notes', array: true },
  { key: 'tasks', label: 'tasks', array: true },
  { key: 'appointments', label: 'appointments', array: true },
  { key: 'places', label: 'saved places', array: true },
  { key: 'extraLinks', label: 'your links', array: true },
  /*
   * The calendars you subscribed to.
   *
   * `backupOf` has always written these and this list has never named them,
   * so `readBackup` walked straight past: the subscriptions were in the file,
   * the confirmation did not mention them, and restoring dropped every one.
   * Measured — a backup holding one feed restored to `feeds: undefined`.
   *
   * Which is the failure the comment above this list describes and was meant
   * to prevent: "One list, so a section added to a backup is automatically a
   * section a restore warns you about." A section added to `backupOf` and not
   * to this list is the case it does not cover, and this was it.
   */
  { key: 'feeds', label: 'connected calendars', array: true },
  { key: 'grades', label: 'grades', array: false },
  { key: 'reviews', label: 'what you have drilled', array: false },
  { key: 'done', label: 'what you have ticked off', array: false },
  { key: 'saved', label: 'saved items', array: false },
  { key: 'linkUrls', label: 'link addresses', array: false },
  { key: 'documents', label: 'documents', array: true },
  { key: 'sheets', label: 'spreadsheets', array: true },
  { key: 'decks', label: 'presentations', array: true },
  { key: 'equations', label: 'equations', array: true },
  /*
   * The graphing workspace and the mail composer, which arrived after this
   * list did.
   *
   * Both store work a person typed — a curve they built up line by line, a
   * message to a professor they are part way through — and both were in the
   * store, in the sync and on the Data screen while being in neither half of
   * the backup. "The whole account in one file", on the Export screen, was
   * short by two features, and the failure was silent in the direction that
   * matters: the file restored cleanly and the graphs were not in it.
   *
   * This is the `feeds` gap above happening again for the same reason — a
   * feature added, the two lists not — which is why `export.test.ts` now
   * holds every persisted field against these lists rather than trusting
   * that whoever adds the next one remembers.
   */
  { key: 'plots', label: 'graphs', array: true },
  { key: 'mailDrafts', label: 'email drafts', array: true },
  /*
   * Rules are written, not derived. Losing one in a restore is silent in the
   * particular way this list exists to prevent: the mailbox still works, and
   * the newsletter it was archiving is back in the inbox with no message
   * saying why. The marks a rule *produces* are not in the file and do not
   * need to be — they are recomputed from the rule, which is the point of
   * `lib/mailrules.ts` keeping them out of `mailMarks`.
   */
  { key: 'mailRules', label: 'mail rules', array: true },
  /*
   * Which courses you silenced. Small, and silent to lose: a restore that
   * dropped it would turn every muted course's reminders back on, and the
   * student would find out from a buzz about the class they were auditing.
   */
  { key: 'mutedCourses', label: 'silenced courses', array: true },
  { key: 'folders', label: 'folders', array: true },
  { key: 'sources', label: 'sources', array: true },
  { key: 'sittings', label: 'practice papers', array: true },
  { key: 'sessions', label: 'planned study sittings', array: true },
  { key: 'commitments', label: 'activities', array: true },
  { key: 'timers', label: 'timers', array: true },
  { key: 'alarms', label: 'alarms', array: true },
  { key: 'applications', label: 'applications', array: true },
  { key: 'returned', label: 'returned work', array: true },
  { key: 'requirements', label: 'degree requirements', array: true },
  { key: 'taken', label: 'completed courses', array: true },
  { key: 'people', label: 'contacts', array: true },
  { key: 'visits', label: 'advising visits', array: true },
  { key: 'letters', label: 'recommendation requests', array: true },
  { key: 'answers', label: 'practice answers', array: true },
  { key: 'rest', label: 'rest periods', array: true },
  { key: 'myRules', label: 'reminder rules', array: true },
  { key: 'aboutMe', label: 'what you told the assistant about you', array: true },
  { key: 'attendance', label: 'attendance records', array: true },
  { key: 'registrar', label: 'registrar dates', array: true },
  { key: 'spent', label: 'study sessions', array: true },
  { key: 'windows', label: 'work windows', array: true },
  { key: 'costs', label: 'expenses', array: true },
  { key: 'charges', label: 'bill charges', array: true },
  { key: 'aid', label: 'aid awards', array: true },
  { key: 'payments', label: 'recorded payments', array: true },
  { key: 'balances', label: 'meal balances', array: true },
  { key: 'residences', label: 'housing records', array: true },
  { key: 'mySchools', label: 'school profiles', array: true },
  { key: 'archivedTerms', label: 'archived terms', array: true },
  { key: 'gradeSystems', label: 'grade systems', array: false },
  { key: 'pretested', label: 'pretest history', array: false },
  { key: 'wanted', label: 'opportunity preferences', array: false },
  { key: 'progress', label: 'assignment progress', array: false },
  { key: 'regradeWindows', label: 'regrade windows', array: false },
  { key: 'scale', label: 'grading scale', array: false },
  { key: 'floor', label: 'rest settings', array: false },
  { key: 'contract', label: 'weekly workload plan', array: false },
  { key: 'attendPolicy', label: 'attendance policies', array: false },
  { key: 'pieces', label: 'assignment steps', array: false },
  { key: 'drops', label: 'grade drop rules', array: false },
  { key: 'examCovers', label: 'exam coverage', array: false },
  { key: 'dayBudget', label: 'daily budgets', array: false },
  { key: 'plans', label: 'payment plans', array: false },
  { key: 'tickedAt', label: 'completion history', array: false },
  { key: 'started', label: 'work start history', array: false },
  { key: 'term', label: 'current term', array: false, valueType: 'string' },
  { key: 'schoolId', label: 'school selection', array: false, valueType: 'string' },
  { key: 'myName', label: 'your name', array: false, valueType: 'string' },
  { key: 'accessLeadDays', label: 'testing lead time', array: false, valueType: 'number' },

];

/**
 * What a backup deliberately leaves behind, and why each one.
 *
 * The list above says what a person's work is. This says what the rest of the
 * store is, so that "not in the backup" is a decision somebody wrote down
 * rather than a field nobody thought about — which is what `plots` and
 * `mailDrafts` were for as long as those two features have existed.
 *
 * `export.test.ts` holds every field `pickPersisted` returns against these two
 * lists and fails on a field in neither. A collection added next term cannot
 * quietly miss the backup again: it fails the suite until somebody says which
 * of the two it is.
 */
export const NOT_IN_BACKUP: Record<string, string> = {
  // How the app looks and is arranged. A backup carries the semester, not the
  // phone it was taken on — and restoring somebody's type size onto a laptop
  // is the one thing that makes a restore feel like it went wrong.
  accent: 'the accent colour, chosen per device',
  badges: 'whether counts appear on the tabs',
  bodyface: 'the face everything is read in',
  corners: 'how square the edges are',
  courseColours: 'the colour each course is drawn in',
  density: 'how much space sits between rows',
  feed: 'the shape of Today',
  ground: 'the background the app is drawn on',
  hue: 'the tint behind the ground',
  calm: 'how much the app may move and decorate itself',
  iconShape: 'how the icons are drawn',
  labels: 'whether the tab bar names its tabs',
  lineHeight: 'how far apart the lines sit',
  readingWidth: 'how wide a paragraph gets',
  shell: 'how a screen is arranged once you are on it',
  textSize: 'the size text is set at here',
  tone: 'how much the app explains itself',
  typeface: 'the heading face',

  // Where things sit. Each is a choice about this device's navigation, and
  // every one of them is remade in a few seconds on a new one.
  boardOrder: 'the order of the springboard pages',
  courseOrder: 'the order the courses are listed in',
  directory: 'how the directory is drawn',
  favourites: 'the screens pinned to hand',
  feedHidden: 'which calendars are hidden from view',
  feedOrder: 'the order the calendars are listed in',
  groupOrder: 'the order of the shelves',
  keyOpen: 'whether a disclosure was left open',
  mailPane: 'which mail pane was last open',
  nav: 'which navigation the app draws',
  shortcuts: 'the shortcuts put on Today',
  tabs: 'which tabs are in the bar',
  waysOpen: 'whether a disclosure was left open',
  yours: 'how your own lists are grouped',

  // Settings that are about this device or this browser rather than about the
  // semester. Reminders are the clearest: the permission belongs to the
  // browser, and a restored switch claiming reminders are on would be a lie
  // on a device that has never been asked.
  controls: 'which controls the editors show',
  geocode: 'whether place lookup is switched on, which is off until you say so',
  notifs: 'which reminders are on, which the browser grants per device',
  quiet: 'the hours reminders are held back',
  role: 'which role the app is being used as',
  showAll: 'whether the screens held back on a first morning are shown',

  // Facts about this install, true of the device and not of the person. A
  // restore that carried these would describe the machine the backup came
  // from.
  cleared: 'whether the sample term has been cleared',
  countScreens: 'whether screen opens are counted at all',
  lastSync: 'when this device last reached the account',
  registered: 'whether this device registered for reminders',
  schemaVersion: 'the shape the file is in, written by the backup itself',
  seenOnboarding: 'whether onboarding has run here',
  visited: 'which screens have been opened here',

  // Held back for a reason of its own, one each.
  liveSession:
    'which sitting a drill is part way through, which is about the run open on this device — the plan it points into, and everything answered in it, the file does carry',
  feedEvents: 'the events pulled from your calendars, fetched again from the subscriptions the file does carry',
  mailMarks: 'read and flagged marks on messages the file does not carry',
  mathGiven: 'the values the calculator is currently holding, not a saved thing',
  mathWorking: 'what is currently typed into the calculator, not a saved thing',
};

export function readBackup(text: string): Restore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That is not a file this app wrote — it is not even JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('That is not a backup file.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'semester.backup.v1') {
    throw new Error(
      'That file does not carry this app\'s backup marker, so restoring it could put nonsense ' +
        'into your account. Only a file from Take it with you can be read here.',
    );
  }

  const data: Record<string, unknown> = {};
  const parts: string[] = [];
  for (const section of BACKUP_SECTIONS) {
    const value = obj[section.key];
    if (value === undefined || value === null) continue;
    const ok = section.valueType ? typeof value === section.valueType && (section.valueType !== 'number' || Number.isFinite(value)) : section.array
      ? Array.isArray(value)
      : typeof value === 'object' && !Array.isArray(value);
    if (!ok) continue;
    data[section.key] = value;
    const count = section.valueType ? 1 : section.array
      ? (value as unknown[]).length
      : Object.keys(value as object).length;
    if (count > 0) parts.push(`${count} ${section.label}`);
  }
  if (typeof obj.sample === 'boolean') data.sample = obj.sample;
  /*
   * By hand, for the reason `sample` is by hand.
   *
   * A university's data pack is one record holding a school and the date the
   * file was written. As a section it would be counted by its keys and the
   * restore would offer "2 school data packs", which is the miscount the
   * by-hand list exists for. It is carried — losing it on a restore would
   * take the term calendar, the buildings and the meal plans with it — and it
   * is read by `readSchoolPack` rather than trusted, because a backup file is
   * as editable as anything else on the device.
   */
  const pack = readSchoolPack(obj.schoolPack);
  if (pack) {
    data.schoolPack = pack;
    parts.push('your university’s data file');
  }

  if (Object.keys(data).length === 0) {
    throw new Error('That backup has nothing in it this version can read.');
  }
  return { parts, data };
}

// ── The account as data ───────────────────────────────────────────────────

/**
 * Everything a backup carries, and nothing else.
 *
 * Built by naming what goes in rather than by removing what should not, so a
 * field added to the store later cannot leak into an exported file by
 * accident. Tokens and API keys are not here and never will be.
 *
 * It lives here rather than on the Export screen because two things now write
 * it: the file somebody downloads, and the rolling snapshots in
 * `lib/snapshots.ts`. One definition, so a snapshot can never turn out to hold
 * less than the backup a person thought they were taking.
 */
export function backupOf(state: State) {
  return {
    format: 'semester.backup.v1',
    exported: new Date().toISOString(),
    courses: state.courses,
    updates: state.updates,
    notes: state.notes,
    tasks: state.tasks,
    appointments: state.appointments,
    grades: state.grades,
    places: state.places,
    reviews: state.reviews,
    done: state.done,
    saved: state.saved,
    /*
     * The subscription, and not the last thing it did.
     *
     * This wrote `{ id, name, url }` under a note about not carrying a feed's
     * token — but `FeedSource` has no token and never has; the URL is the
     * whole credential, and it was already going. What the three fields did
     * do was leave out `kind`, which decides the label and the icon, so a
     * feed restored from one of these files would have arrived nameless even
     * once the restore read them at all.
     *
     * `synced`, `status` and `count` are written as never-pulled rather than
     * carried, because they are facts about a device rather than about a
     * subscription: a restored phone has genuinely never pulled this feed,
     * and "last synced in March" on a machine that has never seen it is a
     * worse answer than "not yet".
     */
    feeds: state.feeds.map((f) => ({
      id: f.id,
      kind: f.kind,
      name: f.name,
      url: f.url,
      added: f.added,
      synced: 0,
      status: '',
      count: 0,
    })),
    linkUrls: state.linkUrls,
    extraLinks: state.extraLinks,
    documents: state.documents,
    sheets: state.sheets,
    decks: state.decks,
    equations: state.equations,
    plots: state.plots,
    mailDrafts: state.mailDrafts,
    mailRules: state.mailRules,
    mutedCourses: state.mutedCourses,
    folders: state.folders,
    sources: state.sources,
    sittings: state.sittings,
    sessions: state.sessions,
    commitments: state.commitments,
    timers: state.timers,
    alarms: state.alarms,
    applications: state.applications,
    returned: state.returned,
    requirements: state.requirements,
    taken: state.taken,
    people: state.people,
    visits: state.visits,
    letters: state.letters,
    answers: state.answers,
    rest: state.rest,
    myRules: state.myRules,
    aboutMe: state.aboutMe,
    attendance: state.attendance,
    registrar: state.registrar,
    spent: state.spent,
    windows: state.windows,
    costs: state.costs,
    charges: state.charges,
    aid: state.aid,
    payments: state.payments,
    balances: state.balances,
    residences: state.residences,
    mySchools: state.mySchools,
    schoolPack: state.schoolPack,
    archivedTerms: state.archivedTerms,
    gradeSystems: state.gradeSystems,
    pretested: state.pretested,
    wanted: state.wanted,
    progress: state.progress,
    regradeWindows: state.regradeWindows,
    scale: state.scale,
    floor: state.floor,
    contract: state.contract,
    attendPolicy: state.attendPolicy,
    pieces: state.pieces,
    drops: state.drops,
    examCovers: state.examCovers,
    dayBudget: state.dayBudget,
    plans: state.plans,
    tickedAt: state.tickedAt,
    started: state.started,
    term: state.term,
    schoolId: state.schoolId,
    myName: state.myName,
    accessLeadDays: state.accessLeadDays,
    sample: state.sample,
  };
}
