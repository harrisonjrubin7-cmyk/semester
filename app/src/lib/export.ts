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
import type { Appointment, DatedItem, Note, PersonalTask } from './types';
import { standingOf, type DoneMap } from './standing';
import { NO_TIME } from './duetime';

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

export function notesMarkdown(notes: Note[], code: (id: string) => string): string {
  if (notes.length === 0) return '# Notes\n\nNothing written yet.\n';
  const parts = notes.map((n) => {
    const when = new Date(n.updated || n.created).toISOString().slice(0, 10);
    const tag = n.courseId ? ` · ${code(n.courseId)}` : '';
    return `## ${n.title || 'Untitled'}\n\n_${when}${tag}_\n\n${n.body.trim() || '(empty)'}\n`;
  });
  return `# Notes\n\n${parts.join('\n---\n\n')}`;
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
  const stamp =
    `${dateStamp(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}` +
    `${pad(now.getUTCSeconds())}Z`;

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
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}@semester.app`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.at === undefined) {
      const next = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(next)}`);
    } else {
      const start = `${dateStamp(e.date)}T${pad(Math.floor(e.at / 60))}${pad(e.at % 60)}00`;
      const end = e.at + (e.minutes ?? 60);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${dateStamp(e.date)}T${pad(Math.floor(end / 60))}${pad(end % 60)}00`);
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

export function appointmentEvents(appts: Appointment[]): IcsEvent[] {
  return appts.map((a) => {
    const [y, m, d] = a.date.split('-').map(Number);
    return {
      uid: `appt-${a.id}`,
      summary: a.title,
      description: a.kind ?? '',
      date: new Date(y, (m || 1) - 1, d || 1),
      at: typeof a.at === 'number' ? a.at : undefined,
      minutes: 60,
    };
  });
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

const SECTIONS: { key: string; label: string; array: boolean }[] = [
  { key: 'courses', label: 'courses', array: true },
  { key: 'updates', label: 'added readings', array: true },
  { key: 'notes', label: 'notes', array: true },
  { key: 'tasks', label: 'tasks', array: true },
  { key: 'appointments', label: 'appointments', array: true },
  { key: 'places', label: 'saved places', array: true },
  { key: 'extraLinks', label: 'your links', array: true },
  { key: 'grades', label: 'grades', array: false },
  { key: 'reviews', label: 'what you have drilled', array: false },
  { key: 'done', label: 'what you have ticked off', array: false },
  { key: 'saved', label: 'saved items', array: false },
  { key: 'linkUrls', label: 'link addresses', array: false },
];

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
  for (const section of SECTIONS) {
    const value = obj[section.key];
    if (value === undefined || value === null) continue;
    const ok = section.array
      ? Array.isArray(value)
      : typeof value === 'object' && !Array.isArray(value);
    if (!ok) continue;
    data[section.key] = value;
    const count = section.array
      ? (value as unknown[]).length
      : Object.keys(value as object).length;
    if (count > 0) parts.push(`${count} ${section.label}`);
  }
  if (typeof obj.sample === 'boolean') data.sample = obj.sample;

  if (Object.keys(data).length === 0) {
    throw new Error('That backup has nothing in it this version can read.');
  }
  return { parts, data };
}

/** When the backup was made, for the confirmation. */
export function backupDate(text: string): string {
  try {
    const when = (JSON.parse(text) as { exported?: string }).exported;
    return when ? new Date(when).toLocaleString() : '';
  } catch {
    return '';
  }
}
