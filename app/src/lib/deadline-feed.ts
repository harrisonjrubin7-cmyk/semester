/**
 * Course items as deadlines for the horizon view.
 *
 * Only what the syllabus said, labelled for what it is. A date with a page
 * cited from the syllabus is `imported`: copied from a source, not checked
 * with the institution, so it is never offered as institution verified. A date
 * without one is `needs_review`, which sends it to Needs confirmation rather
 * than letting it stand in Today as fact. Nothing here is guessed.
 */

import type { Deadline } from './deadline-groups';
import type { DatedItem } from './types';

const MINUTE = 60_000;

export function fromItems(items: DatedItem[], done: Record<string, boolean>, courseCode: (id: string) => string): Deadline[] {
  return items.map((i) => {
    // `dueAt` is minutes into the day, or past a day's worth for "no time".
    const minutes = i.dueAt != null && i.dueAt < 24 * 60 ? i.dueAt : 23 * 60 + 59;
    const code = i.c ? courseCode(i.c) : '';
    return {
      id: i.id,
      title: code ? `${code} · ${i.title}` : i.title,
      due: i.date.getTime() + minutes * MINUTE,
      label: i.checked?.confirmed ? 'imported' : 'needs_review',
      done: Boolean(done[i.id]),
    };
  });
}
