import { effectiveFreshness, type RecordRow } from './integration/school-records';
import type { Freshness } from './integration/catalog';

/**
 * Which study rooms are free, from the school's booking system.
 *
 * Reads two canonical types the school syncs: `study_space` (a room, its hours
 * and booking page) and `space_availability` (its free and busy slots — never
 * who holds a busy one). A room is "free now" only while a free slot covers
 * this minute; otherwise it shows when it next frees today.
 *
 * Every line carries the slot's freshness, and a stale one says so: a room
 * shown free an hour ago is a walk across campus to a taken room. Booking is
 * the school's page — `writeback.space_booking` is off and not built.
 */

export interface RoomNow {
  space: string;
  /** `unknown`: the school listed no slots for this room today, so nothing is claimed. */
  status: 'free_now' | 'free_later' | 'busy_today' | 'unknown';
  /** Minutes since midnight: until when free now, or from when free later. */
  at: number | null;
  bookUrl: string | null;
  freshness: Freshness;
  quiet: boolean;
}

const https = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function roomsNow(rows: readonly RecordRow[], now: Date): RoomNow[] {
  const spaces = rows.filter((r) => r.canonical_entity_type === 'study_space' && str(r.display.name).trim());
  const slots = rows.filter((r) => r.canonical_entity_type === 'space_availability');
  const sameDay = (d: Date) => d.toDateString() === now.toDateString();
  const out: RoomNow[] = [];
  for (const sp of spaces) {
    const name = str(sp.display.name).trim();
    // Today's slots for this room, free or busy: a slot counts if it starts
    // today or is still running now (an overnight one that began yesterday).
    const today = slots
      .filter((sl) => str(sl.display.space).trim() === name)
      .map((sl) => ({ row: sl, free: str(sl.display.status) === 'free', from: new Date(str(sl.display.starts_at)), to: new Date(str(sl.display.ends_at)) }))
      .filter((x) => !Number.isNaN(x.from.getTime()) && !Number.isNaN(x.to.getTime()) && (sameDay(x.from) || (x.from <= now && x.to > now)));
    const mine = today
      .filter((x) => x.free && x.to > now)
      .sort((a, b) => a.from.getTime() - b.from.getTime());
    const current = mine.find((x) => x.from <= now && x.to > now);
    const next = mine.find((x) => x.from > now);
    const pick = current ?? next;
    out.push({
      space: name,
      status: current ? 'free_now' : next ? 'free_later' : today.length ? 'busy_today' : 'unknown',
      at: current ? minuteOf(current.to) : next ? minuteOf(next.from) : null,
      bookUrl: https(pick?.row.display.book_url) ?? https(sp.display.book_url),
      freshness: pick ? effectiveFreshness(pick.row, now) : effectiveFreshness(sp, now),
      quiet: sp.display.quiet === true,
    });
  }
  const rank = { free_now: 0, free_later: 1, busy_today: 2, unknown: 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.at ?? 1e9) - (b.at ?? 1e9) || a.space.localeCompare(b.space));
}

/** With sensory-friendly on, quiet rooms first within the same availability; nothing hidden. */
export function quietFirst(rooms: readonly RoomNow[]): RoomNow[] {
  const rank = { free_now: 0, free_later: 1, busy_today: 2, unknown: 3 };
  return [...rooms].sort((a, b) => rank[a.status] - rank[b.status] || Number(b.quiet) - Number(a.quiet));
}
