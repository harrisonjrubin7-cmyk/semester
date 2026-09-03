import { describe, expect, it } from 'vitest';
import {
  appointmentEvents,
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
import type { Appointment, DatedItem, Note } from './types';

const item = (over: Partial<DatedItem> = {}): DatedItem =>
  ({
    id: 'econ-p1',
    c: 'econ',
    title: 'Essay 2, final draft',
    kind: 'Paper',
    month: 8,
    day: 14,
    dueTime: '11:59p',
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
});

describe('toIcs', () => {
  const ics = toIcs(deadlineEvents([item()], code));

  it('is a calendar an importer will accept', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('writes a deadline as an all-day entry, with the stated time in the title', () => {
    // The syllabus says "11:59p"; that is not a timestamp in a timezone, and
    // inventing one would put a confident wrong time in a calendar.
    expect(ics).toContain('DTSTART;VALUE=DATE:20260914');
    expect(ics).toContain('DTEND;VALUE=DATE:20260915');
    expect(ics).toContain('due 11:59p');
    expect(ics).not.toContain('DTSTART:20260914T');
  });

  it('gives every event a unique id', () => {
    const two = toIcs(deadlineEvents([item(), item({ id: 'other' })], code));
    expect(two.match(/^UID:/gm)).toHaveLength(2);
    expect(two).toContain('UID:item-econ-p1@semester.app');
    expect(two).toContain('UID:item-other@semester.app');
  });

  it('produces a valid empty calendar rather than nothing', () => {
    const empty = toIcs([]);
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('BEGIN:VEVENT');
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
