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
 */
export function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) out.push(` ${rest}`);
  return out.join('\r\n');
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
}

/**
 * A calendar file.
 *
 * Deadlines go in as all-day entries rather than timed ones, and that is a
 * decision rather than laziness: this app dates a deadline to the day because
 * that is what a syllabus states, and "11:59 PM" as written in a PDF is not a
 * timestamp in a timezone. Inventing 23:59 local for it would put a
 * confident-looking wrong time in someone's calendar. The stated time goes in
 * the title instead, where it is read rather than relied on.
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
    `X-WR-CALNAME:${icsText(name)}`,
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
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function deadlineEvents(items: DatedItem[], code: (id: string) => string): IcsEvent[] {
  return items.map((i) => ({
    uid: `item-${i.id}`,
    summary: `${code(i.c)}: ${i.title}${i.dueTime ? ` (due ${i.dueTime})` : ''}`,
    description: [i.kind, i.weight, i.where].filter(Boolean).join(' · '),
    date: i.date,
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
