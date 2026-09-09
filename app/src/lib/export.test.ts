import { describe, expect, it } from 'vitest';
import {
  ALARMS,
  appointmentEvents,
  backupOf,
  readBackup,
  cell,
  deadlineCsv,
  deadlineEvents,
  fold,
  icsText,
  notesMarkdown,
  safeName,
  stampedName,
  toCsv,
  toIcs,
} from './export';
import { parseIcs } from './ics';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import { NO_TIME } from './duetime';
import type { Appointment, Course, DatedItem, Note } from './types';

const item = (over: Partial<DatedItem> = {}): DatedItem =>
  ({
    id: 'econ-p1',
    c: 'econ',
    title: 'Essay 2, final draft',
    kind: 'Paper',
    month: 8,
    day: 14,
    dueTime: '11:59p',
    dueAt: 23 * 60 + 59,
    where: 'Brightspace',
    weight: '15%',
    date: new Date(2026, 8, 14),
    dueShort: 'Sep 14',
    dow: 'Mon',
    mon: 'Sep',
    isToday: false,
    isPast: false,
    daysAway: 11,
    ...over,
  }) as DatedItem;

const code = () => 'ECON 1020';

describe('cell', () => {
  it('leaves a plain value alone', () => {
    expect(cell('Paper')).toBe('Paper');
  });

  it('quotes a comma, so a column does not shift by one', () => {
    expect(cell('Essay 2, final draft')).toBe('"Essay 2, final draft"');
  });

  it('doubles a quotation mark rather than losing it', () => {
    expect(cell('the "final" draft')).toBe('"the ""final"" draft"');
  });

  it('quotes a line break', () => {
    expect(cell('one\ntwo')).toBe('"one\ntwo"');
  });
});

describe('toCsv', () => {
  it('uses CRLF, which is what the spec says and Excel expects', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2');
  });
});

describe('deadlineCsv', () => {
  it('carries the standing, so the sheet knows what was missed', () => {
    const csv = deadlineCsv([item(), item({ id: 'x', isPast: true })], { 'econ-p1': true }, code);
    const rows = csv.split('\r\n');
    expect(rows[0]).toContain('Standing');
    expect(rows[1]).toContain('done');
    expect(rows[2]).toContain('overdue');
  });

  it('quotes a title with a comma in it', () => {
    expect(deadlineCsv([item()], {}, code)).toContain('"Essay 2, final draft"');
  });
});

describe('icsText', () => {
  it('escapes the characters that are syntax in the format', () => {
    // An unescaped comma splits one property into two on import.
    expect(icsText('Essay 2, final draft')).toBe('Essay 2\\, final draft');
    expect(icsText('a;b')).toBe('a\\;b');
    expect(icsText('one\ntwo')).toBe('one\\ntwo');
    expect(icsText('back\\slash')).toBe('back\\\\slash');
  });
});

describe('fold', () => {
  it('leaves a short line alone', () => {
    expect(fold('SUMMARY:Short')).toBe('SUMMARY:Short');
  });

  it('folds a long line with a leading space on each continuation', () => {
    const folded = fold(`SUMMARY:${'x'.repeat(200)}`);
    const lines = folded.split('\r\n');
    expect(lines[0]).toHaveLength(75);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    // Unfolding puts it back exactly.
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(`SUMMARY:${'x'.repeat(200)}`);
  });

  it('counts octets rather than characters', () => {
    // The limit is bytes. An em dash is one character and three of them, so
    // counting characters sails straight past 75 and produces a line Outlook
    // has historically refused.
    const long = `SUMMARY:${'—'.repeat(60)}`;
    for (const line of fold(long).split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('never splits a character across the fold', () => {
    // Half of a multi-byte character on each side of a line break is mojibake
    // at best and a refused import at worst.
    const long = `SUMMARY:${'é'.repeat(80)}`;
    const folded = fold(long);
    expect(folded).not.toContain('�');
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});

describe('toIcs', () => {
  const ics = toIcs(deadlineEvents([item()], code));

  it('is a calendar an importer will accept', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('is a feed rather than an invitation, and asks not to be polled to death', () => {
    // Without METHOD:PUBLISH a mail client offers to RSVP to a problem set.
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT4H');
  });

  it('puts a deadline at the hour the syllabus stated', () => {
    // This used to be all-day for everything. The app now reads the hour out
    // of the due text, and an all-day banner for something due at 11:59p
    // sorts above the day's classes and gives no runway.
    expect(ics).toContain('DTSTART:20260914T235900');
    expect(ics).toContain('due 11:59p');
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260914');
  });

  /*
   * The DTSTART of this very item was already asserted above. Its DTEND was
   * not, and it read `20260914T242900` — minutes past midnight printed as an
   * hour, so anything ending after midnight wrote an hour of 24 or more.
   * RFC 5545 gives the hour the range 00-23; that is a malformed time, not a
   * late one, and a client may drop the event, drop its end, or refuse the
   * file. 11:59 PM is the commonest deadline in any syllabus and this app's
   * own default, so it was very nearly every timed export.
   */
  it('rolls a deadline that ends after midnight into the next day', () => {
    expect(ics).toContain('DTSTART:20260914T235900');
    expect(ics).toContain('DTEND:20260915T002900');
    expect(ics).not.toMatch(/DTEND:\d{8}T(2[4-9]|[3-9]\d)/);
  });

  it('keeps an ordinary hour on its own day', () => {
    const five = toIcs(deadlineEvents([item({ dueAt: 17 * 60, dueTime: '5:00p' })], code));
    expect(five).toContain('DTSTART:20260914T170000');
    expect(five).toContain('DTEND:20260914T173000');
  });

  it('writes no hour above 23 anywhere, whatever the length', () => {
    // The wall clock is what an iCalendar time with no `Z` means, so the
    // arithmetic is in whole days and leftover minutes rather than in
    // milliseconds added to a Date.
    for (const at of [0, 1, 12 * 60, 23 * 60 + 30, 23 * 60 + 59]) {
      for (const minutes of [0, 30, 60, 90, 24 * 60, 3 * 24 * 60 + 5]) {
        const out = toIcs([{ uid: 'u', summary: 's', date: new Date(2026, 8, 14), at, minutes }]);
        for (const line of out.split('\r\n')) {
          const m = /^DT(?:START|END):\d{8}T(\d{2})(\d{2})/.exec(line);
          if (!m) continue;
          expect(Number(m[1]), `${line} from at=${at} minutes=${minutes}`).toBeLessThan(24);
          expect(Number(m[2])).toBeLessThan(60);
        }
      }
    }
  });

  /*
   * DTSTAMP is the field a calendar uses to decide which version of an event
   * is newer, so a wrong one is a re-import that gets ignored — and that
   * defeats the stable `uid` this file is careful about, whose whole job is
   * that a deadline that moves updates the entry already in the calendar.
   *
   * The date came off the local calendar while the clock beside it was
   * already UTC, under a `Z` that claims both are. Invisible on a UTC runner,
   * which is why `npm run test:zones` exists — and why this assertion is
   * about the date and not only the shape.
   */
  it('stamps in UTC, all of it, because the Z says so', () => {
    // A fixed instant, so this says the same thing in every timezone. Late
    // on the 14th in UTC is already the 15th anywhere past UTC+1, which is
    // the disagreement the old line printed: the local date under a UTC
    // clock, with a `Z` claiming both.
    const at = new Date(Date.UTC(2026, 8, 14, 23, 30, 5));
    const line = toIcs(deadlineEvents([item()], code), 'Semester', at)
      .split('\r\n')
      .find((l) => l.startsWith('DTSTAMP:'))!;
    expect(line).toBe('DTSTAMP:20260914T233005Z');
  });

  it('leaves a deadline with no stated hour all-day rather than at midnight', () => {
    // Midnight is wrong twice: some clients show it on the previous evening,
    // and it asserts a time nobody wrote.
    const vague = toIcs(deadlineEvents([item({ dueAt: NO_TIME, dueTime: 'In class' })], code));
    expect(vague).toContain('DTSTART;VALUE=DATE:20260914');
    expect(vague).toContain('DTEND;VALUE=DATE:20260915');
    expect(vague).not.toContain('DTSTART:20260914T');
  });

  it('writes an alarm per reminder, and none when none was asked for', () => {
    const withAlarms = toIcs(deadlineEvents([item()], code, ALARMS));
    expect(withAlarms.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(withAlarms).toContain('TRIGGER:-PT960M');
    expect(withAlarms).toContain('TRIGGER:-PT60M');
    expect(ics).not.toContain('VALARM');
  });

  it('reminds the evening before and an hour before', () => {
    // One is for starting it, the other for submitting it.
    expect(ALARMS).toEqual([960, 60]);
  });

  it('gives every event a unique id', () => {
    const two = toIcs(deadlineEvents([item(), item({ id: 'other' })], code));
    expect(two.match(/^UID:/gm)).toHaveLength(2);
    expect(two).toContain('UID:item-econ-p1@semester.app');
    expect(two).toContain('UID:item-other@semester.app');
  });

  it('keeps a UID stable when the deadline moves', () => {
    // The whole update-rather-than-duplicate story. A UID with the date in it
    // leaves the old deadline sitting beside the new one.
    const uid = (s: string) => /^UID:(.+)$/m.exec(s)?.[1];
    const moved = toIcs(deadlineEvents([item({ date: new Date(2026, 8, 21), day: 21 })], code));
    expect(uid(moved)).toBe(uid(ics));
  });

  it('produces a valid empty calendar rather than nothing', () => {
    const empty = toIcs([]);
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('BEGIN:VEVENT');
  });

  it('round-trips through the parser this app reads Brightspace with', () => {
    // The strongest check available without a calendar client: the parser
    // already trusted for a real feed reads what this writes.
    const read = parseIcs(
      [{ id: 'econ', code: 'ECON 1020', name: 'Principles' } as Course],
      toIcs(deadlineEvents([item()], code, ALARMS)),
    );
    expect(read.events).toHaveLength(1);
    expect(read.events[0].date).toBe('2026-09-14');
    expect(read.events[0].courseId).toBe('econ');
    // Including the comma in "Essay 2, final draft", which is syntax in the
    // format and would otherwise split one event into two properties.
    expect(read.events[0].title).toContain('Essay 2, final draft');
  });
});

describe('appointmentEvents', () => {
  const appt = {
    id: 'a1',
    title: 'Advising',
    date: '2026-10-02',
    at: 14 * 60 + 30,
    time: '2:30p',
    where: 'Kirkland',
    note: '',
    created: 0,
  } as Appointment;

  it('keeps a real time, because this one has one', () => {
    const ics = toIcs(appointmentEvents([appt]));
    expect(ics).toContain('DTSTART:20261002T143000');
    expect(ics).toContain('DTEND:20261002T153000');
  });

  it('reads the ISO date without drifting a day', () => {
    // new Date('2026-10-02') is UTC midnight and lands on the 1st in Nashville.
    const [event] = appointmentEvents([appt]);
    expect(event.date.getDate()).toBe(2);
    expect(event.date.getMonth()).toBe(9);
  });
});

describe('notesMarkdown', () => {
  const note = {
    id: 'n1',
    title: 'Lecture 4',
    body: 'Inflation expectations.',
    created: Date.UTC(2026, 8, 3),
    updated: Date.UTC(2026, 8, 4),
    courseId: 'econ',
    fileIds: [],
  } as Note;

  it('writes a heading, a date and the body', () => {
    const md = notesMarkdown([note], code);
    expect(md).toContain('## Lecture 4');
    expect(md).toContain('2026-09-04');
    expect(md).toContain('Inflation expectations.');
    expect(md).toContain('ECON 1020');
  });

  it('says so rather than producing an empty file', () => {
    expect(notesMarkdown([], code)).toContain('Nothing written yet');
  });

  it('does not leave an untitled note headingless', () => {
    expect(notesMarkdown([{ ...note, title: '', body: '' }], code)).toContain('## Untitled');
  });
});

describe('safeName', () => {
  it('strips what a filesystem or a header would choke on', () => {
    expect(safeName('ECON 1020 / notes: "final"')).toBe('ECON-1020-notes-final');
  });

  it('never returns an empty name', () => {
    expect(safeName('///')).toBe('export');
    expect(safeName('', 'notes')).toBe('notes');
  });

  it('does not start or end with a dot, which hides a file', () => {
    expect(safeName('.hidden.')).toBe('hidden');
  });
});

describe('stampedName', () => {
  it('sorts chronologically in a file list', () => {
    expect(stampedName('semester', new Date(2026, 8, 3))).toBe('semester-2026-09-03');
  });
});

describe('readBackup', () => {
  const good = JSON.stringify({
    format: 'semester.backup.v1',
    exported: '2026-09-03T12:00:00.000Z',
    notes: [{ id: 'n1' }],
    done: { a: true },
    sample: true,
  });

  it('reads what it recognises and names it', () => {
    const { parts, data } = readBackup(good);
    expect(data.notes).toHaveLength(1);
    expect(data.done).toEqual({ a: true });
    expect(data.sample).toBe(true);
    expect(parts.join(', ')).toContain('1 notes');
  });

  it('refuses a file without the marker', () => {
    // Otherwise any JSON could be poured into an account.
    expect(() => readBackup(JSON.stringify({ notes: [] }))).toThrow(/backup marker/);
  });

  it('refuses something that is not JSON at all', () => {
    expect(() => readBackup('hello')).toThrow(/not even JSON/);
  });

  it('skips a section of the wrong shape instead of failing whole', () => {
    // A file from an older version restores what it has.
    const odd = JSON.stringify({ format: 'semester.backup.v1', notes: 'lots', tasks: [{ id: 't' }] });
    const { data } = readBackup(odd);
    expect(data.notes).toBeUndefined();
    expect(data.tasks).toHaveLength(1);
  });

  it('refuses a backup with nothing readable in it', () => {
    expect(() => readBackup(JSON.stringify({ format: 'semester.backup.v1' }))).toThrow(/nothing in it/);
  });

  it('does not carry across anything not on the list', () => {
    // Notably not tokens or keys, whatever a hand-edited file claims.
    const sneaky = JSON.stringify({
      format: 'semester.backup.v1',
      notes: [],
      tokens: { google: 'secret' },
      screen: 'account',
    });
    const { data } = readBackup(sneaky);
    expect(data.tokens).toBeUndefined();
    expect(data.screen).toBeUndefined();
  });
});

/**
 * The grade and the pieces it is worked out from travel together.
 *
 * `grades` was in the backup and `pieces` and `drops` were not, which is two
 * halves of one number kept apart. `standing` scores a category from its
 * pieces where there are any and only falls back to the single box otherwise,
 * so a restore did not merely lose them — it changed the grade on the screen,
 * quietly, with a valid file and a successful restore.
 */
describe('a backup carries the working as well as the answer', () => {
  const state = {
    ...DEFAULT_PERSISTED,
    ...initialEphemeral(new Date()),
    grades: { 'econ:0': '88' },
    pieces: { 'econ:0': '88, 92, 76' },
    drops: { 'econ:0': 1 },
  } as State;

  it('writes the typed-in pieces and the drop rule', () => {
    const out = backupOf(state) as Record<string, unknown>;
    expect(out.pieces).toEqual({ 'econ:0': '88, 92, 76' });
    expect(out.drops).toEqual({ 'econ:0': 1 });
  });

  it('reads them back, so the same figure comes out', () => {
    const { data, parts } = readBackup(JSON.stringify(backupOf(state)));
    expect(data.pieces).toEqual({ 'econ:0': '88, 92, 76' });
    expect(data.drops).toEqual({ 'econ:0': 1 });
    // Named in the preview too, or a restore would say it was changing less
    // than it is.
    expect(parts.join(', ')).toContain('scores you typed in');
  });
});

/**
 * What a backup is for, which the restructure did not change.
 *
 * Acceptance criterion 10 asks that export and import round-trip identically
 * before and after Command 2. They do, and the reason is worth pinning down
 * rather than re-checking by hand every time a look key is added: a backup
 * carries the semester, not the way it is drawn. No accent, no ground, no
 * shell — and so neither `groupOrder` nor `boardOrder`, the arrangement keys
 * the launcher and the home screen added.
 *
 * That is the right line and it is easy to cross by accident, because a look
 * key is a field on the same `Persisted` object as everything a backup does
 * carry. Restoring somebody's backup onto their laptop should give them their
 * courses, not repaint their laptop.
 */
describe('a backup carries the semester, not the look', () => {
  const LOOK = [
    'accent', 'textSize', 'ground', 'density', 'corners', 'typeface', 'bodyface',
    'lineHeight', 'readingWidth', 'iconShape', 'labels', 'badges', 'feed', 'shell',
    'groupOrder', 'boardOrder', 'hue',
  ];

  it('names no look key', () => {
    const keys = Object.keys(backupOf({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date()) } as State));
    expect(keys.filter((k) => LOOK.includes(k))).toEqual([]);
  });

  it('will not restore one either, however the file was edited', () => {
    // The allow-list is the guard; this is what stops a hand-written file
    // repainting an account it was restored into.
    const meddled = JSON.stringify({
      format: 'semester.backup.v1',
      notes: [],
      ...Object.fromEntries(LOOK.map((k) => [k, { any: 'thing' }])),
    });
    const { data } = readBackup(meddled);
    for (const k of LOOK) expect(data[k], k).toBeUndefined();
  });
});
