import { cloud } from './cloud';
import { obj } from './device-library';
import type { FamilyCategory, FamilyItem } from './family';
import type { InviteRequest } from './familyinvites';

/**
 * What a supporter reads, and what the student sees of that reading: the
 * client side of `supabase/migrations/20260928307000_family_shared_items.sql`
 * (D-037 slice 3, D-038).
 *
 * The rule that shapes all of it: a supporter sees a **copy** of what the
 * student confirmed on Preview, stored with the code in one transaction. An
 * item edited on the device afterwards is not re-sent by itself — sharing the
 * change is a new share, with a new preview and a new confirmation (§6).
 */

/** The fields of an item a supporter sees. Nothing else leaves the device. */
export interface SharedItemPayload {
  id: string;
  category: FamilyCategory;
  kind: FamilyItem['kind'];
  title: string;
  body: string;
  due: string;
  done: boolean;
  amount: number;
}

export function sharePayload(items: FamilyItem[]): SharedItemPayload[] {
  return items.map((i) => ({
    id: i.id,
    category: i.category,
    kind: i.kind,
    title: i.title,
    body: i.body,
    due: i.due,
    done: i.done,
    amount: i.amount,
  }));
}

/** The code, and the copies of exactly the items it names. One call, one transaction. */
export async function makeShare(req: InviteRequest, items: FamilyItem[], shownAs: string): Promise<string> {
  const named = new Set(req.resources);
  const { data, error } = await (await cloud()).rpc('make_family_share', {
    want_categories: req.categories,
    want_resources: req.resources,
    want_days: req.days,
    want_items: sharePayload(items.filter((i) => named.has(i.id))),
    want_shown_as: shownAs.trim(),
  });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : '';
}

// ── The supporter's side ────────────────────────────────────────────────

export interface SharedItem extends SharedItemPayload {
  ends: string;
}

export interface ShareFrom {
  studentId: string;
  shownAs: string;
  /** `YYYY-MM-DD`: the last day of the latest live grant from this student. */
  ends: string;
  items: SharedItem[];
}

const day = (at: unknown) => String(at ?? '').slice(0, 10);

/** Rows from `read_family_share()`, grouped by the student who shared them. */
export function groupShares(rows: unknown[]): ShareFrom[] {
  const by = new Map<string, ShareFrom>();
  for (const r of rows) {
    if (!obj(r) || typeof r.student_id !== 'string' || typeof r.item_id !== 'string') continue;
    const item: SharedItem = {
      id: r.item_id,
      category: String(r.category) as FamilyCategory,
      kind: String(r.kind) as FamilyItem['kind'],
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      due: String(r.due ?? ''),
      done: r.done === true,
      amount: Number(r.amount) || 0,
      ends: day(r.ends_at),
    };
    const from = by.get(r.student_id) ?? { studentId: r.student_id, shownAs: String(r.shown_as ?? ''), ends: '', items: [] };
    from.items.push(item);
    if (item.ends > from.ends) from.ends = item.ends;
    by.set(r.student_id, from);
  }
  return [...by.values()];
}

/** Every read is logged for the student it is about; this call is that read. */
export async function readShares(): Promise<ShareFrom[]> {
  const { data, error } = await (await cloud()).rpc('read_family_share');
  if (error) throw new Error(error.message);
  return groupShares(Array.isArray(data) ? data : []);
}

/**
 * Who the supporter has seen a share from, kept on their device so a share
 * that stops can say "This share has ended" rather than simply vanishing.
 * It says that and only that whichever way it ended (D3): nothing on the
 * server tells this side whether it was revoked or ran out.
 */
export const SEEN_PREFIX = 'semester.familyseen.v1';

export function readSeen(v: unknown): Record<string, string> {
  if (!obj(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, name] of Object.entries(v)) {
    if (typeof name === 'string' && name.length <= 80 && k.length <= 64) out[k] = name;
  }
  return out;
}

/** Shares seen before and not live now, by student. */
export function endedShares(seen: Record<string, string>, live: ShareFrom[]): { studentId: string; shownAs: string }[] {
  const now = new Set(live.map((s) => s.studentId));
  return Object.entries(seen)
    .filter(([id]) => !now.has(id))
    .map(([studentId, shownAs]) => ({ studentId, shownAs }));
}

// ── The student's side ──────────────────────────────────────────────────

export interface ReadEvent {
  readerId: string | null;
  itemIds: string[];
  readAt: string;
}

/** The student's read log, newest first. RLS returns only their own. */
export async function readLog(): Promise<ReadEvent[]> {
  const { data, error } = await (await cloud())
    .from('family_access_events')
    .select('reader_id, item_ids, read_at')
    .order('read_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    readerId: typeof r.reader_id === 'string' ? r.reader_id : null,
    itemIds: Array.isArray(r.item_ids) ? (r.item_ids as string[]) : [],
    readAt: String(r.read_at),
  }));
}

/** A read's time as the student's own clock shows it, to the minute. */
export function localMinute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Reads that returned any of these items: one person's plan, from the log. */
export function readsOf(log: ReadEvent[], itemIds: string[]): ReadEvent[] {
  const mine = new Set(itemIds);
  return log.filter((e) => e.itemIds.some((i) => mine.has(i)));
}

/**
 * Stop sharing these items with whoever holds them: every live grant naming
 * any of them is revoked, and the copies are removed. Takes effect at the
 * supporter's next read, which then shows "This share has ended".
 */
export async function stopSharing(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const db = await cloud();
  const revoked = await db
    .from('family_grants')
    .update({ revoked_at: new Date().toISOString() })
    .overlaps('resource_ids', itemIds)
    .is('revoked_at', null);
  if (revoked.error) throw new Error(revoked.error.message);
  const removed = await db.from('family_shared_items').delete().in('item_id', itemIds);
  if (removed.error) throw new Error(removed.error.message);
}
