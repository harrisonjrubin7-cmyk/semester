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
  { id: 'next', label: 'Next class', blurb: 'The countdown, and anything overdue.' },
  { id: 'due', label: 'Due today', blurb: 'The checklist, with the headline that counts down.' },
  { id: 'tasks', label: 'Your own tasks', blurb: 'Things you added that are not from a syllabus.' },
  { id: 'rail', label: 'Today’s rail', blurb: 'The day hour by hour.' },
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

/**
 * The accents the app will wear.
 *
 * All metals. The palette is silver on near-black and the whole look depends
 * on the accent not being a colour — a saturated one turns a drawn interface
 * into a dashboard. These are four metals and one warm stone, each still
 * desaturated enough to sit under text without fighting it.
 */
export interface Accent {
  id: string;
  label: string;
  /** The accent itself. */
  base: string;
  /** A lighter one for hover and emphasis. */
  bright: string;
  /** A darker one for secondary marks. */
  deep: string;
}

export const ACCENTS: Accent[] = [
  { id: 'sterling', label: 'Sterling', base: '#d4d9e2', bright: '#f6f8fb', deep: '#949cab' },
  { id: 'brass', label: 'Brass', base: '#d8c79a', bright: '#f2e7c8', deep: '#a3936a' },
  { id: 'copper', label: 'Copper', base: '#d6a98d', bright: '#f0d3c0', deep: '#a67c63' },
  { id: 'jade', label: 'Jade', base: '#a8ccbd', bright: '#d3e9e0', deep: '#7a9a8d' },
  { id: 'slate', label: 'Slate', base: '#aebdd0', bright: '#d8e2ee', deep: '#7f8c9d' },
];

export function accent(id: string | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Text scale, for a phone held at arm's length or a small screen. */
export const SIZES = [
  { id: 'compact', label: 'Compact', scale: 0.94 },
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.09 },
];

export function scaleOf(id: string | undefined): number {
  return SIZES.find((s) => s.id === id)?.scale ?? 1;
}
