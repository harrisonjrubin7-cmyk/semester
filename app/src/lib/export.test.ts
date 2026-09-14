import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALARMS,
  appointmentEvents,
  backupOf,
  classEvents,
  BACKUP_SECTIONS,
  NOT_IN_BACKUP,
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
import type { Appointment, Course, CourseModule, DatedItem, Note } from './types';
import { buildCatalog } from '../data/catalog';

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

describe('the lines toIcs refuses to write', () => {
  const good = { uid: 'ok', summary: 'Fine', date: new Date(2026, 8, 10), minutes: 60 };

  it('drops an event whose date is not a date, instead of writing NaNNaNNaN', () => {
    // `dateStamp` pads three fields off the Date, so an Invalid Date came out
    // as `DTSTART;VALUE=DATE:NaNNaNNaN` — a line no parser accepts, in a file
    // a strict client then refuses whole.
    const ics = toIcs([{ uid: 'broken', summary: 'Broken', date: new Date(NaN) }, good]);
    expect(ics).not.toContain('NaN');
    expect(ics).toContain('UID:ok@semester.app');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('treats an hour off the clock as no hour', () => {
    // RFC 5545 gives the hour two digits, 00-23. 5000 minutes wrote hour 83.
    for (const at of [-1, -600, 1440, 5000, 1.5]) {
      const ics = toIcs([{ ...good, at }]);
      expect(ics, String(at)).toContain('DTSTART;VALUE=DATE:20260910');
    }
  });

  it('keeps the hours that are on it', () => {
    expect(toIcs([{ ...good, at: 0 }])).toContain('DTSTART:20260910T000000');
    expect(toIcs([{ ...good, at: 1439 }])).toContain('DTSTART:20260910T235900');
  });

  it('rolls an end past midnight into the next day rather than writing hour 24', () => {
    // 11:59 PM is the commonest time in any syllabus and this app's own
    // default. Half an hour later used to be `DTEND:20260910T242900`.
    const ics = toIcs([{ ...good, at: 23 * 60 + 59, minutes: 30 }]);
    expect(ics).toContain('DTSTART:20260910T235900');
    expect(ics).toContain('DTEND:20260911T002900');
    expect(ics).not.toMatch(/DTEND:\d{8}T(2[4-9]|[3-9]\d)/);
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

  /*
   * The dates that are not dates.
   *
   * A stored appointment saved without one arrives as `date: ''`, and
   * `Number('')` is 0 rather than NaN — so the split-and-construct this used
   * to do sailed past its own `|| 1` guards and produced 1 January 1900: a
   * confident entry, in the downloaded file, on a day nobody named.
   */
  it('leaves out an appointment with no date rather than inventing 1900', () => {
    const none = { ...appt, id: 'a2', date: '' } as Appointment;
    expect(appointmentEvents([none])).toEqual([]);
    expect(toIcs(appointmentEvents([none]))).not.toContain('19000101');
  });

  it('leaves out a date the calendar does not have', () => {
    // 31 February reads back as 3 March, which is a day nobody wrote down.
    for (const date of ['2026-02-31', '2026-13-01', '2026-10-2', '0026-01-01', 'soon']) {
      expect(appointmentEvents([{ ...appt, date } as Appointment]), date).toEqual([]);
    }
  });

  it('still exports the good ones beside a bad one', () => {
    const ics = toIcs(appointmentEvents([{ ...appt, id: 'bad', date: '' } as Appointment, appt]));
    expect(ics).toContain('UID:appt-a1@semester.app');
    expect(ics).not.toContain('appt-bad');
  });

  it.each([
    ['2026-09-15T02:30:00Z', 'the evening, west of Greenwich'],
    ['2026-09-14T11:30:00Z', 'the next morning, east of it'],
  ])('stamps the file in one clock and not half of each — %s', (instant) => {
    /*
     * DTSTAMP promises UTC — that is what the `Z` means — and it was built
     * from the local year, month and day glued to the UTC hour, minute and
     * second. Those two agree only while the local date and the UTC date are
     * the same day, which for anyone west of Greenwich stops being true every
     * evening, and for anyone far enough east every morning. The stamp then
     * named the wrong day while still claiming to be UTC, and a calendar
     * comparing DTSTAMPs to decide which copy of an event is newer would read
     * a fresh export as older than the one it already had, and keep the old.
     *
     * Two instants, pinned, because one of them only lands on the wrong side
     * of midnight in half the world: whichever zone the suite runs in, one of
     * these has the local day and the UTC day disagreeing. Left to the real
     * clock this caught the bug or not depending on the hour it ran at.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    try {
      const ics = toIcs(deadlineEvents([item()], code));
      const utc = new Date(instant);
      const two = (n: number) => String(n).padStart(2, '0');
      const want =
        `${utc.getUTCFullYear()}${two(utc.getUTCMonth() + 1)}${two(utc.getUTCDate())}` +
        `T${two(utc.getUTCHours())}${two(utc.getUTCMinutes())}${two(utc.getUTCSeconds())}Z`;
      expect(ics).toContain(`DTSTAMP:${want}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes an appointment with no recorded hour as all-day, not as hour -1', () => {
    // -1 is what a stored appointment holds when neither the number nor the
    // words could be read. It used to reach the formatter and write `T-1-100`.
    const ics = toIcs(appointmentEvents([{ ...appt, at: -1 } as Appointment]));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261002');
    expect(ics).not.toMatch(/DTSTART:.*T-/);
  });
});

describe('notesMarkdown', () => {
  const note = {
    id: 'n1',
    title: 'Lecture 4',
    body: 'Inflation expectations.',
    created: new Date(2026, 8, 3, 9, 0).getTime(),
    updated: new Date(2026, 8, 4, 9, 0).getTime(),
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

  it('dates a note by the day it was written on, not the day it was in Greenwich', () => {
    /*
     * Half past nine on a Thursday evening in Nashville is already Friday in
     * UTC, and `toISOString().slice(0, 10)` — which is what this wrote — says
     * so. The student sees an export of tonight's note dated tomorrow.
     *
     * Built from local fields and asserted against local fields, so this
     * holds in every zone `npm run test:zones` runs in rather than only in
     * the one the export happened to be written in.
     */
    const evening = new Date(2026, 8, 3, 21, 30);
    const md = notesMarkdown([{ ...note, updated: evening.getTime() }], code);
    expect(md).toContain('2026-09-03');
  });

  /*
   * The Export screen says this file is "everything you wrote, including
   * transcripts and email drafts". Transcripts were true — a kept transcript
   * is a note — and drafts were not: they are their own collection, and the
   * sentence had been wrong for as long as the composer has existed.
   */
  const draft = {
    id: 'd1',
    to: 'prof@example.edu',
    cc: '',
    bcc: '',
    subject: 'Extension on the essay',
    body: 'I am writing to ask…',
    courseId: 'econ' as const,
    purposeId: 'extension',
    updated: Date.UTC(2026, 8, 5),
    handed: null,
  };

  it('carries the email drafts the screen says it carries', () => {
    const md = notesMarkdown([note], code, [draft]);
    expect(md).toContain('# Email drafts');
    expect(md).toContain('## Extension on the essay');
    expect(md).toContain('To: prof@example.edu');
    expect(md).toContain('I am writing to ask…');
  });

  it('says whether a draft ever left the app, without claiming it was sent', () => {
    expect(notesMarkdown([], code, [draft])).toContain('not sent');
    expect(notesMarkdown([], code, [{ ...draft, handed: 1 }])).toContain('opened in your mail app');
  });

  it('writes a file for drafts alone rather than saying nothing was written', () => {
    const md = notesMarkdown([], code, [draft]);
    expect(md).toContain('## Extension on the essay');
  });

  it('is unchanged for a caller that has no drafts', () => {
    expect(notesMarkdown([note], code, [])).toBe(notesMarkdown([note], code));
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

describe('a backup that can be restored from', () => {
  const feed = {
    id: 'f1',
    kind: 'ics' as const,
    name: 'Rowing',
    url: 'https://example.invalid/rowing.ics',
    added: 111,
    synced: 999,
    status: 'Pulled 12 events',
    count: 12,
  };
  const withFeed = () =>
    ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date()), feeds: [feed] }) as State;

  /*
   * The failure this catches, and why it is written as a set difference.
   *
   * `backupOf` wrote `feeds` and `BACKUP_SECTIONS` never named them, so
   * `readBackup` walked past: a backup holding a subscription restored to
   * `feeds: undefined`, and the confirmation — which is built from the same
   * list — never mentioned them, so nobody could tell. The comment above the
   * list says it exists so that "a section added to a backup is automatically
   * a section a restore warns you about"; nothing was checking that, and this
   * is that check rather than one more remembered case.
   */
  it('reads back every section it writes', () => {
    const written = Object.keys(backupOf(withFeed())).filter(
      (k) => k !== 'format' && k !== 'exported' && k !== 'sample',
    );
    const read = new Set(BACKUP_SECTIONS.map((s) => s.key));
    expect(written.filter((k) => !read.has(k))).toEqual([]);
  });

  it('brings the calendars you subscribed to back with it', () => {
    const { parts, data } = readBackup(JSON.stringify(backupOf(withFeed())));
    expect(data.feeds).toHaveLength(1);
    expect(parts.join(' · ')).toContain('connected calendars');
  });

  it('carries what the subscription is, including the kind that names it', () => {
    // `{ id, name, url }` was what went. `kind` decides the label and the
    // icon, so a feed restored without it arrives nameless on the screen.
    const [back] = readBackup(JSON.stringify(backupOf(withFeed()))).data.feeds as typeof feed[];
    // The id first: `FeedEvent.sourceId` points at it, so a feed restored
    // without one is a subscription nothing pulled can be attributed to.
    expect(back.id).toBe('f1');
    expect(back.kind).toBe('ics');
    expect(back.url).toBe(feed.url);
    expect(back.name).toBe('Rowing');
    expect(back.added).toBe(111);
  });

  it('does not carry a pull that happened on the other device', () => {
    // These are facts about a machine, not about a subscription. "Last synced
    // in March" on a phone that has never seen this feed is a worse answer
    // than "not yet", and the next pull fills them in truthfully.
    const [back] = readBackup(JSON.stringify(backupOf(withFeed()))).data.feeds as typeof feed[];
    expect(back.synced).toBe(0);
    expect(back.status).toBe('');
    expect(back.count).toBe(0);
  });
});

describe('every field the store holds is a decision about the backup', () => {
  /**
   * The field names, read out of the store itself.
   *
   * The same reading `merge.test.ts` does, and for the same reason:
   * `pickPersisted` is the one place that says what a persisted field is, and
   * a guard written against a copy of that list is a guard that drifts with
   * the copy.
   */
  const persistedFields = (): string[] => {
    const source = readFileSync(join(process.cwd(), 'src/state/shape.ts'), 'utf8');
    const body = source.split('export function pickPersisted')[1]?.split('\n}')[0] ?? '';
    return [...body.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
  };

  /**
   * Carried, but not through a section.
   *
   * `sample` is a flag rather than a collection — whether the term on screen
   * is the demonstration one — and `readBackup` reads it by hand, because a
   * section would report it to the person restoring as "1 sample courses".
   */
  const BY_HAND = ['sample'];

  const named = new Set([
    ...BACKUP_SECTIONS.map((s) => s.key),
    ...Object.keys(NOT_IN_BACKUP),
    ...BY_HAND,
  ]);

  it('found the store, so the rest of this means something', () => {
    expect(persistedFields().length).toBeGreaterThan(20);
  });

  it('leaves no field unaccounted for', () => {
    /*
     * The failure this exists for.
     *
     * `plots` and `mailDrafts` — a graph built line by line, a message to a
     * professor half written — were persisted, synced and shown on the Data
     * screen while being in neither half of the backup. Nothing failed: the
     * file restored cleanly and the work was not in it, which is the worst
     * shape a data-loss bug can take.
     *
     * So a field in neither list fails here, and the fix is to decide which
     * list it is in rather than to remember.
     */
    const undecided = persistedFields().filter((f) => !named.has(f));
    expect(undecided).toEqual([]);
  });

  it('holds nothing the store no longer persists', () => {
    const fields = new Set(persistedFields());
    const stale = [...named].filter((f) => !fields.has(f));
    expect(stale).toEqual([]);
  });

  it('says why for everything it leaves out', () => {
    // A key with an empty reason is a key somebody added to silence the test
    // above, which is the one way this guard could be worse than nothing.
    const blank = Object.entries(NOT_IN_BACKUP).filter(([, why]) => why.trim().length < 10);
    expect(blank).toEqual([]);
  });

  it('cannot both carry and omit the same field', () => {
    const both = BACKUP_SECTIONS.map((s) => s.key).filter((k) => k in NOT_IN_BACKUP);
    expect(both).toEqual([]);
  });
});

describe('the work the app grew after the backup was written', () => {
  const state = (over: Partial<State> = {}): State =>
    ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date()), ...over }) as State;

  const draft = {
    id: 'd1',
    to: 'prof@example.edu',
    cc: '',
    bcc: '',
    subject: 'Extension on the essay',
    body: 'I am writing to ask…',
    courseId: 'econ' as const,
    purposeId: 'extension',
    updated: 222,
    handed: null,
  };

  it('carries a graph somebody built', () => {
    const plots = [{ id: 'p1', text: 'y = x^2 - 3', on: true }];
    const { data } = readBackup(JSON.stringify(backupOf(state({ plots }))));
    expect(data.plots).toEqual(plots);
  });

  it('carries an unsent draft, which is the one nobody can retype', () => {
    const { data } = readBackup(JSON.stringify(backupOf(state({ mailDrafts: [draft] }))));
    expect((data.mailDrafts as typeof draft[])[0].body).toBe('I am writing to ask…');
  });

  it('says what it found, so the restore names them', () => {
    const { parts } = readBackup(
      JSON.stringify(backupOf(state({ mailDrafts: [draft], plots: [{ id: 'p1', text: 'y = x', on: true }] }))),
    );
    expect(parts).toContain('1 graphs');
    expect(parts).toContain('1 email drafts');
  });

  it('carries the name letters are signed with', () => {
    const { data } = readBackup(JSON.stringify(backupOf(state({ myName: 'Harrison Rubin' }))));
    expect(data.myName).toBe('Harrison Rubin');
  });
});

/**
 * The timetable in the file, which is the half a student most wants and the
 * half no export this app has ever written carried.
 *
 * Two things here are the difference between a calendar that is useful and
 * one that is actively wrong, and neither is visible by reading the file:
 * a series whose `DTSTART` falls on a day the class does not meet, and an
 * `EXDATE` written as a date against a timed `DTSTART` — which both Google
 * and Outlook silently ignore, so the lecture cancelled for a holiday stays
 * on the calendar and the app looks like it got the term wrong.
 */
describe('classes as repeating events', () => {
  const course: Course = {
    id: 'econ',
    code: 'ECON 1010',
    name: 'Principles of Macroeconomics',
    prof: 'Stromme',
    email: '',
    meets: 'MWF · 9:05–9:55a',
    room: 'Buttrick 101',
    credits: '3',
    term: '2026FA',
    source: '',
    grading: [],
  };

  const guide = { code: 'ECON 1010', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] };

  const cat = (over: Partial<CourseModule> = {}) =>
    buildCatalog([
      {
        course,
        items: [],
        // Monday, Wednesday, Friday at 9:05.
        schedule: [
          { days: [1, 3, 5], at: 545, time: '9:05a', title: 'lecture', meta: 'Buttrick 101' },
        ],
        guide,
        planMinutes: '',
        frameLabel: '',
        ...over,
      },
    ]);

  // A Tuesday, on purpose: the first occurrence has to be the Wednesday.
  const from = new Date(2026, 8, 1);
  const to = new Date(2026, 11, 11);

  it('writes one event for the whole meeting pattern, not one per meeting', () => {
    const made = classEvents(cat(), from, to);
    expect(made).toHaveLength(1);
    expect(made[0].rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261211');
  });

  /*
   * `DTSTART` is itself the first occurrence in iCalendar. A Monday/Wednesday/
   * Friday class starting on a Tuesday is read by a strict client as meeting
   * on Tuesdays too, and by a lenient one as starting a week late.
   */
  it('starts on the first day the class actually meets', () => {
    const made = classEvents(cat(), from, to);
    expect(made[0].date.getDay()).toBe(3);
    expect(made[0].date.getDate()).toBe(2);
  });

  it('names the days in week order, whatever order the syllabus wrote them', () => {
    const made = classEvents(
      cat({ schedule: [{ days: [5, 1, 3], at: 545, time: '9:05a', title: 'lecture', meta: '' }] }),
      from,
      to,
    );
    expect(made[0]?.rrule).toContain('BYDAY=MO,WE,FR');
  });

  it('takes its length off the syllabus’s own meeting line', () => {
    expect(classEvents(cat(), from, to)[0].minutes).toBe(50);
  });

  it('leaves office hours out unless they are asked for', () => {
    const withHours = cat({
      schedule: [
        { days: [1, 3, 5], at: 545, time: '9:05a', title: 'lecture', meta: '' },
        { days: [2], at: 840, time: '2:00p', title: 'office hours', meta: '', optional: true },
      ],
    });
    expect(classEvents(withHours, from, to)).toHaveLength(1);
    expect(classEvents(withHours, from, to, { officeHours: true })).toHaveLength(2);
  });

  it('carries a cancelled class out as an EXDATE at the class’s own hour', () => {
    const made = classEvents(
      cat({ exceptions: [{ month: 10, day: 25, canceled: true }] }),
      from,
      to,
    );
    expect(made[0].except?.[0].getDate()).toBe(25);
    const file = toIcs(made);
    expect(file).toContain('EXDATE:20261125T090500');
    expect(file).not.toContain('EXDATE;VALUE=DATE');
  });

  it('ignores a cancellation on a day the class does not meet', () => {
    // 26 November 2026 is a Thursday; this class is MWF.
    const made = classEvents(cat({ exceptions: [{ month: 10, day: 26, canceled: true }] }), from, to);
    expect(made[0].except).toEqual([]);
  });

  it('writes a one-off extra class as its own entry', () => {
    const made = classEvents(
      cat({
        exceptions: [
          { month: 9, day: 14, extra: { at: 600, time: '10:00a', title: 'make-up', meta: 'Rand 308' } },
        ],
      }),
      from,
      to,
    );
    expect(made).toHaveLength(2);
    expect(made[1].rrule).toBeUndefined();
    expect(made[1].summary).toContain('make-up');
  });

  it('gives two blocks of one course different ids, even with the same title', () => {
    const made = classEvents(
      cat({
        schedule: [
          { days: [1], at: 545, time: '9:05a', title: 'lecture', meta: '' },
          { days: [4], at: 780, time: '1:00p', title: 'lecture', meta: '' },
        ],
      }),
      from,
      to,
    );
    expect(new Set(made.map((e) => e.uid)).size).toBe(2);
  });

  it('writes nothing for a range that runs backwards or is not a range at all', () => {
    expect(classEvents(cat(), to, from)).toEqual([]);
    expect(classEvents(cat(), new Date(Number.NaN), to)).toEqual([]);
  });
});

describe('an appointment that repeats', () => {
  const shift = (over: Partial<Appointment> = {}): Appointment => ({
    id: 'a1',
    title: 'Shift',
    date: '2026-09-15',
    at: 16 * 60,
    time: '4:00p',
    where: 'Rand',
    note: '',
    created: 0,
    ...over,
  });

  it('goes in as one repeating event rather than as fifteen rows', () => {
    const made = appointmentEvents([
      shift({ repeat: { every: 'weekly', until: '2026-12-11' }, minutes: 240 }),
    ]);
    expect(made[0].rrule).toBe('FREQ=WEEKLY;UNTIL=20261211');
    expect(made[0].minutes).toBe(240);
  });

  it('carries the occurrences taken out of it', () => {
    const made = appointmentEvents([
      shift({ repeat: { every: 'weekly', until: '2026-12-11', except: ['2026-09-22'] } }),
    ]);
    expect(toIcs(made)).toContain('EXDATE:20260922T160000');
  });

  it('gives one that says no length an hour, as every calendar does', () => {
    expect(appointmentEvents([shift()])[0].minutes).toBe(60);
  });

  it('writes no rule at all for a one-off', () => {
    expect(appointmentEvents([shift()])[0].rrule).toBeUndefined();
  });
});
