/**
 * The order of your own front page.
 *
 * Today opens on four things and the right order is not the same for everyone.
 * Somebody with a job and one class wants the rail first; somebody with four
 * courses and a paper due wants the checklist and would rather not scroll past
 * a countdown to a lecture they are already walking to. The app had one
 * opinion about that and no way to disagree with it.
 *
 * Both halves are here: which sections appear, and in what order. Kept as a
 * list of ids rather than as indexes on the sections themselves, so a section
 * added later slots in without renumbering anything, and one removed from a
 * future version does not leave a hole in somebody's saved order.
 */

export interface FeedSection {
  id: string;
  label: string;
  /** What it is, for the settings list. */
  blurb: string;
}

export const SECTIONS: FeedSection[] = [
  {
    id: 'since',
    label: 'What changed',
    blurb: 'Anything that moved while you were not looking — another device, a feed, an import.',
  },
  { id: 'next', label: 'Next class', blurb: 'The countdown, and anything overdue.' },
  { id: 'due', label: 'Due today', blurb: 'The checklist, with the headline that counts down.' },
  {
    id: 'dropby',
    label: 'Worth dropping by',
    blurb: 'Office hours, in a week the app can say why.',
  },
  {
    id: 'registrar',
    label: 'University deadlines',
    blurb: 'Add/drop, withdrawal, registration — the dates that cost money.',
  },
  { id: 'tasks', label: 'Your own tasks', blurb: 'Things you added that are not from a syllabus.' },
  { id: 'rail', label: 'Today’s rail', blurb: 'The day hour by hour.' },
  {
    id: 'walks',
    label: 'Getting between them',
    blurb: 'The walk between two buildings, and whether the gap covers it.',
  },
];

export const DEFAULT_ORDER = SECTIONS.map((s) => s.id);

const KNOWN = new Set(DEFAULT_ORDER);

/**
 * A saved order, made safe to render from.
 *
 * Anything unknown is dropped and anything missing is appended, so a stored
 * order from an older version never hides a section that exists now — the
 * failure people would report as "the app lost my tasks" when in fact it was
 * only never listed.
 */
export function ordered(saved: string[] | undefined): string[] {
  const out = (saved ?? []).filter((id, i, all) => KNOWN.has(id) && all.indexOf(id) === i);
  for (const id of DEFAULT_ORDER) if (!out.includes(id)) out.push(id);
  return out;
}

/** The order actually drawn — hidden ones taken out. */
export function visible(saved: string[] | undefined, hidden: Record<string, boolean>): string[] {
  return ordered(saved).filter((id) => !hidden[id]);
}

/**
 * One section moved up or down.
 *
 * Returns the list unchanged at either end rather than wrapping around.
 * Wrapping is a delight in a carousel and a bug in a list: you press up once
 * too often and the thing you were promoting is suddenly last.
 */
export function move(saved: string[] | undefined, id: string, by: -1 | 1): string[] {
  const list = ordered(saved);
  const from = list.indexOf(id);
  if (from === -1) return list;
  const to = from + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function sectionLabel(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.label ?? id;
}
