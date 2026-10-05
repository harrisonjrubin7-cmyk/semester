/**
 * Continue where you left off: the deadlines and courses opened lately.
 *
 * `state.recent` remembers screens, which is where somebody goes. This
 * remembers the *thing* — the lab report they were reading when the bus
 * arrived — so the way back is one tap onto that page rather than a tap onto
 * the list it was in and a scan down it.
 *
 * ## Only unfinished work is offered back
 *
 * A "Continue" row for something already ticked off is noise that looks like
 * a to-do, so `continuing` drops finished deadlines at render time. The id
 * stays in the stored list — ticking something by mistake and unticking it
 * should not lose your place — it is simply not offered while it is done.
 *
 * ## Ids, not copies
 *
 * Titles are looked up from the catalogue when the row is drawn. A stored
 * title would go stale on the first rename, and one for a deadline that has
 * since been deleted would be a row that opens nothing.
 */

import type { Catalog } from '../data/catalog';
import type { CourseId } from './types';

export type OpenedKind = 'item' | 'course';

export interface Opened {
  kind: OpenedKind;
  id: string;
}

/** How many are kept. The search page shows fewer; the rest survive a tick. */
export const KEEP = 8;

/** Newest first, one entry per thing, capped. */
export function rememberOpened(list: Opened[], next: Opened): Opened[] {
  return [next, ...list.filter((o) => !(o.kind === next.kind && o.id === next.id))].slice(0, KEEP);
}

/** Whatever storage held, as a clean list — damaged entries are dropped. */
export function readOpened(raw: unknown): Opened[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (o): o is Opened =>
        !!o &&
        typeof o === 'object' &&
        ((o as Opened).kind === 'item' || (o as Opened).kind === 'course') &&
        typeof (o as Opened).id === 'string' &&
        (o as Opened).id !== '',
    )
    .map((o) => ({ kind: o.kind, id: o.id }))
    .slice(0, KEEP);
}

export interface Continuing extends Opened {
  /** What the row says. */
  title: string;
  /** The course code, so two "Problem Set 4"s can be told apart. */
  context: string;
}

/**
 * The rows to offer, resolved against the catalogue.
 *
 * Drops anything the catalogue no longer has and any deadline already done.
 */
export function continuing(
  list: Opened[],
  catalog: Pick<Catalog, 'items' | 'byId'>,
  done: Record<string, boolean>,
  limit = 4,
): Continuing[] {
  const out: Continuing[] = [];
  for (const o of list) {
    if (out.length >= limit) break;
    if (o.kind === 'item') {
      if (done[o.id]) continue;
      const item = catalog.items.find((i) => i.id === o.id);
      if (!item) continue;
      out.push({ ...o, title: item.title, context: catalog.byId[item.c]?.code ?? '' });
    } else {
      const course = catalog.byId[o.id as CourseId];
      if (!course) continue;
      out.push({ ...o, title: course.name || course.code, context: course.code });
    }
  }
  return out;
}
