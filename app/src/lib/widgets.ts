/**
 * The command centre's widgets — what a student can pin to Today.
 *
 * Three to five, chosen by the student, in the order they put them. The same
 * list on every device and every layout: a phone draws them as a column of
 * cards, a desk as a grid, and neither shows different data (the brief's
 * "never different data").
 *
 * Reordered with Move up / Move down, never by dragging alone — WCAG 2.2's
 * 2.5.7, and the rule `a11y/dragging.test.ts` already holds for every other
 * arrangement in the app.
 *
 * Stored as the `pinned` look key: comma-separated ids. Unknown ids are
 * dropped on the way out, so a list written by a newer build can only lose a
 * widget here, never draw a dead one.
 */

import type { Screen } from './types';

export type WidgetId = 'week' | 'degree' | 'assignment' | 'study' | 'opportunity';

export interface Widget {
  id: WidgetId;
  label: string;
  /** Where the widget opens. */
  screen: Screen;
}

export const WIDGETS: Widget[] = [
  { id: 'week', label: 'This week’s plan', screen: 'calendar' },
  { id: 'assignment', label: 'Current assignment', screen: 'courses' },
  { id: 'degree', label: 'Degree requirement progress', screen: 'pathway' },
  { id: 'study', label: 'Study progress', screen: 'study' },
  { id: 'opportunity', label: 'Upcoming opportunity', screen: 'career' },
];

/** What is pinned before anybody has chosen. */
export const DEFAULT_PINS: WidgetId[] = ['week', 'assignment', 'study'];

export const MAX_PINS = 5;

export function readPins(saved: string | undefined): WidgetId[] {
  if (!saved) return DEFAULT_PINS;
  if (saved === NONE) return [];
  const known = new Set(WIDGETS.map((w) => w.id));
  const out: WidgetId[] = [];
  for (const id of saved.split(',')) {
    if (known.has(id as WidgetId) && !out.includes(id as WidgetId)) out.push(id as WidgetId);
  }
  return out.slice(0, MAX_PINS);
}

/**
 * Empty means nobody has chosen, so a list somebody emptied on purpose needs
 * a word of its own or it would come back as the defaults.
 */
const NONE = 'none';

export function writePins(ids: WidgetId[]): string {
  return ids.length === 0 ? NONE : ids.slice(0, MAX_PINS).join(',');
}

/** Move one pin a step; a step past either end leaves the list as it was. */
export function movePin(ids: WidgetId[], id: WidgetId, step: -1 | 1): WidgetId[] {
  const at = ids.indexOf(id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

export function togglePin(ids: WidgetId[], id: WidgetId): WidgetId[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= MAX_PINS) return ids;
  return [...ids, id];
}

export function widgetOf(id: WidgetId): Widget {
  return WIDGETS.find((w) => w.id === id)!;
}
