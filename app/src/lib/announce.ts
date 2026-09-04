/**
 * The email that changes a date.
 *
 * The Brightspace feed carries dates. The thing that *changes* a date is an
 * announcement — the midterm moved, the reading is dropped, the pset is due
 * Monday now — and that arrives in an inbox or on a course page and never
 * reached the app. So the app was confidently a week out of date and nothing
 * said so.
 *
 * There is no API to read it and there does not need to be one. Paste the
 * announcement; the changes it proposes go through exactly the comparison
 * that already handles a re-imported syllabus, and you accept or ignore each
 * one. `lib/rediff.ts` did the hard half of this already — this is a second
 * door into it.
 *
 * ## Every change quotes the sentence it came from
 *
 * This is the whole safety of the thing. A model reading prose about dates
 * can misread prose about dates, and a wrong date silently applied to a
 * course is worse than no feature at all. So a proposal that cannot quote the
 * announcement is dropped before it is ever shown, the quote sits under every
 * row, and nothing is applied until it is ticked.
 *
 * ## What it may and may not do
 *
 * May: move a deadline that exists, rename one, add one the announcement
 * plainly describes, drop one it plainly cancels. May not: invent a date the
 * announcement does not state, change a weighting (that is a syllabus
 * change, and belongs in the re-import), or touch anything it cannot point at
 * a sentence for.
 */

import type { CourseModule, Item } from './types';
import { newId } from './files';

export type Op = 'move' | 'rename' | 'add' | 'drop';

export interface Change {
  op: Op;
  /** The item this affects. Empty for `add`. */
  itemId: string;
  /** The new title, for `rename` and `add`. */
  title: string;
  /** Month index, 0-based, for `move` and `add`. -1 when not stated. */
  month: number;
  day: number;
  /** How the announcement words the time, if it does. */
  dueTime: string;
  /**
   * The sentence from the announcement this rests on.
   *
   * Not decoration. A change with no quote is dropped rather than shown —
   * see the module header.
   */
  quote: string;
}

export const SYSTEM = [
  'You read a course announcement and say what it changes about a list of deadlines you are given.',
  '',
  'Rules you do not break:',
  '- Every change you propose MUST quote the exact sentence from the announcement that says so.',
  '  Copy it verbatim. If you cannot quote a sentence, do not propose the change.',
  '- Only propose a date you can read in the announcement. Never calculate, infer or assume one.',
  '  "Moved to next week" without a date is not a date; leave month and day as -1 and say so in',
  '  the title so the student can fill it in.',
  '- Only touch deadlines in the list you were given, by their id. The one exception is `add`,',
  '  for something the announcement plainly introduces that is not already there.',
  '- Do not propose changes to weightings or to the grading scheme. Those come from a syllabus,',
  '  not an announcement.',
  '- An announcement that changes nothing about the deadlines is a perfectly good answer.',
  '  Return an empty list.',
  '',
  'Reply with JSON only:',
  '{ "changes": [ { "op": "move"|"rename"|"add"|"drop", "itemId": "…", "title": "…",',
  '  "month": 0-11 or -1, "day": 1-31 or -1, "dueTime": "…", "quote": "…" } ] }',
].join('\n');

/** The current deadlines, and the announcement, as the model sees them. */
export function brief(module: CourseModule, announcement: string): string {
  const items = module.items
    .map(
      (i) =>
        `- id ${i.id} · ${i.title} · ${i.kind} · month ${i.month} day ${i.day}${
          i.dueTime ? ` · ${i.dueTime}` : ''
        }`,
    )
    .join('\n');

  return [
    `Course: ${module.course.code} — ${module.course.name}`,
    '',
    'Its deadlines as the app currently holds them:',
    items || '(none)',
    '',
    'The announcement:',
    announcement.trim(),
  ].join('\n');
}

function asMonth(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 11 ? n : -1;
}

function asDay(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : -1;
}

/**
 * The proposals, read back and made safe.
 *
 * Four things are thrown away here rather than shown: a change with no quote,
 * a change naming an item this course does not have, a move with no date in
 * it, and an add with no title. Each of those is a way the model could be
 * wrong that a person would have to catch, and catching them in code is
 * cheaper than catching them in a list of eleven rows at midnight.
 */
export function readChanges(text: string, module: CourseModule): Change[] {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Nothing came back — try again.');

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error('That came back malformed. Try again.');
  }

  const list = (raw as { changes?: unknown }).changes;
  if (!Array.isArray(list)) return [];

  const known = new Set(module.items.map((i) => i.id));
  const out: Change[] = [];

  for (const row of list) {
    const r = row as Partial<Change>;
    const op = r.op;
    if (op !== 'move' && op !== 'rename' && op !== 'add' && op !== 'drop') continue;

    const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
    if (!quote) continue;

    const itemId = typeof r.itemId === 'string' ? r.itemId : '';
    if (op !== 'add' && !known.has(itemId)) continue;

    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (op === 'add' && !title) continue;
    if (op === 'rename' && !title) continue;

    const month = asMonth(r.month);
    const day = asDay(r.day);
    // A move with no date to move to is not a move. The model is told to say
    // so in the title instead, which reaches the student as a rename.
    if (op === 'move' && (month < 0 || day < 0)) continue;
    if (op === 'add' && (month < 0 || day < 0)) continue;

    out.push({
      op,
      itemId,
      title,
      month,
      day,
      dueTime: typeof r.dueTime === 'string' ? r.dueTime.trim() : '',
      quote,
    });
  }

  return out;
}

/** What a proposal will do, in the words a person would use. */
export function describe(change: Change, module: CourseModule): string {
  const item = module.items.find((i) => i.id === change.itemId);
  const when = change.month >= 0 ? `${MONTHS[change.month]} ${change.day}` : '';

  switch (change.op) {
    case 'move':
      return `Move ${item?.title ?? 'a deadline'} to ${when}${
        change.dueTime ? `, ${change.dueTime}` : ''
      }`;
    case 'rename':
      return `Rename ${item?.title ?? 'a deadline'} to "${change.title}"`;
    case 'add':
      return `Add ${change.title}, ${when}`;
    default:
      return `Remove ${item?.title ?? 'a deadline'}`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The course, with the accepted changes folded in.
 *
 * Item ids survive every operation but `add`, which is what keeps a ticked box
 * ticked when its deadline moves — the same reasoning `keepIds` follows for a
 * re-imported syllabus. A dropped item takes its tick with it, which is
 * correct: the work is not owed any more.
 */
export function apply(module: CourseModule, changes: Change[]): CourseModule {
  let items = [...module.items];

  for (const c of changes) {
    switch (c.op) {
      case 'move':
        items = items.map((i) =>
          i.id === c.itemId
            ? { ...i, month: c.month, day: c.day, dueTime: c.dueTime || i.dueTime }
            : i,
        );
        break;
      case 'rename':
        items = items.map((i) => (i.id === c.itemId ? { ...i, title: c.title } : i));
        break;
      case 'drop':
        items = items.filter((i) => i.id !== c.itemId);
        break;
      case 'add': {
        const added: Item = {
          id: newId(),
          c: module.course.id,
          title: c.title,
          kind: 'From an announcement',
          month: c.month,
          day: c.day,
          dueTime: c.dueTime,
          weight: '',
          where: '',
          detail: '',
          // The announcement is the source, so it goes where a syllabus quote
          // would — which is what "Straight from the syllabus" reads from.
          quote: c.quote,
          source: 'Announcement',
        };
        items = [...items, added];
        break;
      }
    }
  }

  return { ...module, items };
}

/** One line for the whole set, for the button and the confirmation. */
export function summary(changes: Change[]): string {
  if (changes.length === 0) return 'Nothing in that changes a deadline.';
  const counts: Record<Op, number> = { move: 0, rename: 0, add: 0, drop: 0 };
  for (const c of changes) counts[c.op] += 1;
  const bits: string[] = [];
  if (counts.move) bits.push(`${counts.move} moved`);
  if (counts.add) bits.push(`${counts.add} added`);
  if (counts.drop) bits.push(`${counts.drop} removed`);
  if (counts.rename) bits.push(`${counts.rename} renamed`);
  return bits.join(', ');
}
