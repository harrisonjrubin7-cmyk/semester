/**
 * Rolling copies of the account, kept on the device, so a bad five minutes is
 * recoverable.
 *
 * The app already has two ways back: the undo banner, which reverses the last
 * action, and the export file, which is a backup somebody has to have
 * remembered to make. Between those is the gap where the real damage happens —
 * an AI import that read a syllabus wrong and rewrote a course, a term closed
 * by mistake, a bulk tick, a paste into the wrong note, anything noticed an
 * hour later rather than immediately. Undo has moved on by then and there is no
 * export because nobody exports on an ordinary Tuesday.
 *
 * So the app takes them itself. One a day, plus one immediately before
 * anything that rewrites a lot at once, and it keeps them for a week.
 *
 * ## Where they live, and why not localStorage
 *
 * IndexedDB, like the attached files. `semester.v1` is already the largest
 * thing in a 5MB localStorage budget — `lib/keep.ts` exists entirely because
 * that budget runs out — and putting seven more copies of it beside itself
 * would guarantee the failure that file was written to prevent. IndexedDB has
 * room, stores a Blob natively, and is the same store the app already asks
 * permission for.
 *
 * They are gzipped where the browser can (`CompressionStream`, which every
 * current browser has) and stored plain where it cannot, because a snapshot
 * that failed to save is worth less than a large one that saved.
 *
 * ## Nothing here leaves the device
 *
 * Snapshots are not synced, not uploaded and not part of the export. They are
 * local history of a local store. A second device has its own.
 *
 * ## The rule about restoring
 *
 * A restore replaces. That runs against the ground rule the whole sync design
 * is built on — existing data is adopted, never replaced — so it is fenced:
 *
 *   * it says what would change, in counts, before it happens;
 *   * it takes a snapshot of *now* first, so restoring is itself undoable;
 *   * it never runs on its own, on a schedule, or as a side effect of
 *     anything else.
 */

import { BACKUP_SECTIONS } from './export';

/** How many days back the app keeps a copy of each day. */
export const KEEP_DAYS = 7;

/**
 * Everything from the last day is kept, whatever the daily rule says.
 *
 * The day you make the mistake is the day you have taken four snapshots, and
 * thinning them to one that morning is thinning away the one you need.
 */
export const KEEP_ALL_HOURS = 24;

/** A ceiling, so a day of heavy importing cannot fill the disk. */
export const MOST = 20;

/** Why a snapshot was taken. The reason is shown, so each one has to be true. */
export type Reason = 'daily' | 'import' | 'restore' | 'bulk' | 'close' | 'asked';

export const REASONS: Record<Reason, string> = {
  daily: 'Start of the day',
  import: 'Before an import',
  restore: 'Before restoring',
  bulk: 'Before a bulk change',
  close: 'Before closing a term',
  asked: 'You asked for it',
};

export function reasonLabel(reason: string): string {
  return REASONS[reason as Reason] ?? 'Saved';
}

export interface Snapshot {
  id: string;
  /** Milliseconds. */
  at: number;
  reason: Reason;
  /** Stored size, so the screen can say what this is costing. */
  bytes: number;
  /** How much of each thing was in it, for the list and for the diff. */
  counts: Record<string, number>;
}

/** What was in a store, by the same sections a backup file carries. */
export function countsOf(data: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const section of BACKUP_SECTIONS) {
    const value = data[section.key];
    if (section.array) {
      if (Array.isArray(value)) out[section.key] = value.length;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[section.key] = Object.keys(value).length;
    }
  }
  return out;
}

function labelOf(key: string): string {
  return BACKUP_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

/** The same calendar day, in the device's own timezone. */
function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Whether today's daily copy still needs taking.
 *
 * By calendar day rather than by elapsed hours, so somebody who opens the app
 * at 9am every day gets one a day rather than one every other day.
 */
export function dueForDaily(snaps: Snapshot[], now: Date): boolean {
  return !snaps.some((s) => s.reason === 'daily' && sameDay(s.at, now.getTime()));
}

/**
 * Which snapshots to drop, oldest first.
 *
 * Three rules, in order:
 *
 *   1. Everything from the last day stays. That is the day the mistake was
 *      made, and it is the day the extra copies are worth having.
 *   2. Older than that, the newest one per calendar day, back `KEEP_DAYS`.
 *   3. Nothing older than `KEEP_DAYS`, and never more than `MOST`.
 *
 * Returns ids rather than doing the deleting, so the decision can be tested
 * without a database.
 */
export function stale(snaps: Snapshot[], now: Date): string[] {
  const ms = now.getTime();
  const newest = [...snaps].sort((a, b) => b.at - a.at);
  const keep = new Set<string>();
  const seenDays = new Set<string>();

  for (const s of newest) {
    const age = ms - s.at;
    if (age > KEEP_DAYS * 86_400_000) continue;
    if (age <= KEEP_ALL_HOURS * 3_600_000) {
      keep.add(s.id);
      continue;
    }
    const day = new Date(s.at).toDateString();
    if (!seenDays.has(day)) {
      seenDays.add(day);
      keep.add(s.id);
    }
  }

  // The cap applies to what survived, newest first.
  const capped = newest.filter((s) => keep.has(s.id)).slice(0, MOST);
  const final = new Set(capped.map((s) => s.id));
  return newest.filter((s) => !final.has(s.id)).map((s) => s.id);
}

/**
 * What restoring this snapshot would change, in the app's own words.
 *
 * Counts, not a field-by-field diff. Somebody deciding whether to restore
 * wants "you would lose 3 notes", not a list of keys — and a count is a claim
 * the app can actually stand behind, where "nothing else changes" would not
 * be.
 */
export function changed(
  now: Record<string, number>,
  then: Record<string, number>,
): { line: string; loses: boolean }[] {
  const keys = [...new Set([...Object.keys(now), ...Object.keys(then)])];
  const out: { line: string; loses: boolean }[] = [];
  for (const key of BACKUP_SECTIONS.map((s) => s.key).filter((k) => keys.includes(k))) {
    const before = now[key] ?? 0;
    const after = then[key] ?? 0;
    if (before === after) continue;
    const n = Math.abs(before - after);
    // The label ahead of the numbers, and the count on its own after them.
    // The labels are plural phrases — "notes", "what you have ticked off" —
    // and putting a count in front of one produces "1 notes" for the single
    // most alarming case there is.
    out.push({
      line: `${labelOf(key)} — ${before} now, ${after} then. ${n} would ${
        after < before ? 'go' : 'come back'
      }.`,
      loses: after < before,
    });
  }
  return out;
}

/**
 * The headline above that list.
 *
 * Says plainly when a restore costs nothing, and refuses to be reassuring when
 * it does. The count is what it is; there is no rounding it down.
 */
export function costLine(rows: { loses: boolean }[]): string {
  const losing = rows.filter((r) => r.loses).length;
  if (rows.length === 0) {
    return 'Nothing would change. This copy holds the same amount of everything you have now.';
  }
  if (losing === 0) return 'Nothing would be lost — this copy holds more than you have now.';
  return 'Restoring puts the account back as it was. Anything added since is not merged in, it goes.';
}

/** How long ago, said the way somebody deciding would say it. */
export function whenLine(at: number, now: Date): string {
  const mins = Math.floor((now.getTime() - at) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(mins / 60);
  if (sameDay(at, now.getTime())) return `Today, ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return 'Yesterday';
  return `${days} days ago`;
}

/** What the list says when there is nothing in it yet. */
export const NONE_LINE =
  'No copies yet. The app takes one the first time you open it each day, and one before anything that rewrites a lot at once.';

/** Said above the list, so nobody mistakes this for a backup that survives the device. */
export const LOCAL_LINE =
  'These stay on this device. They are not synced, not uploaded, and not in your export — so they survive a mistake, not a lost phone. For that, use Take it with you.';

/** Said next to the button, every time. */
export const RESTORE_LINE =
  'A restore replaces what is here; it does not merge. The app takes a copy of right now first, so this is undoable — but only from this device.';

/** After it has happened. */
export const RESTORED_LINE =
  'Restored. A copy of what was here a moment ago is at the top of the list, so if this was the wrong one you can go straight back.';

// ── Storage ───────────────────────────────────────────────────────────────
//
// IndexedDB, in its own database rather than beside the attached files, so
// clearing one has never any chance of touching the other.

const DB_NAME = 'semester-snapshots';
const DB_VERSION = 1;
const STORE = 'snapshots';

interface Stored extends Snapshot {
  /** The JSON, gzipped where the browser can. */
  body: Blob;
  gzip: boolean;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** Squeeze the JSON where the browser offers it, and shrug where it does not. */
async function squeeze(text: string): Promise<{ blob: Blob; gzip: boolean }> {
  const plain = new Blob([text], { type: 'application/json' });
  if (typeof CompressionStream === 'undefined') return { blob: plain, gzip: false };
  try {
    const stream = plain.stream().pipeThrough(new CompressionStream('gzip'));
    return { blob: await new Response(stream).blob(), gzip: true };
  } catch {
    // A snapshot that failed to save is worth less than a large one that saved.
    return { blob: plain, gzip: false };
  }
}

async function unsqueeze(blob: Blob, gzip: boolean): Promise<string> {
  if (!gzip) return blob.text();
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export function newId(): string {
  return `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Whether this page load has already looked at the daily copy.
 *
 * `dueForDaily` reads the list asynchronously, so two callers that start
 * before either finishes both see no copy for today and both write one. React
 * runs effects twice in development, which is enough on its own — and driving
 * it produced exactly that: two "Start of the day" copies a second apart.
 *
 * Module-level and synchronous, because the whole point is to close the gap
 * before the first `await`.
 */
let dailyTried = false;

/** Reset between tests. Nothing in the app calls this. */
export function forgetDailyTry(): void {
  dailyTried = false;
}

/**
 * Take today's copy, if today has not had one.
 *
 * Safe to call more than once per page load: the second call returns null
 * without touching the database.
 */
export async function takeDaily(
  data: Record<string, unknown>,
  now = new Date(),
): Promise<Snapshot | null> {
  if (dailyTried) return null;
  dailyTried = true;
  if (!dueForDaily(await listSnapshots(), now)) return null;
  return takeSnapshot('daily', data, now);
}

function meta(row: Stored): Snapshot {
  return { id: row.id, at: row.at, reason: row.reason, bytes: row.bytes, counts: row.counts };
}

/** Every snapshot on this device, newest first, without pulling the bodies. */
export async function listSnapshots(): Promise<Snapshot[]> {
  try {
    const rows = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
    return rows.map(meta).sort((a, b) => b.at - a.at);
  } catch {
    // A private window with storage switched off is not an error worth
    // shouting about; it is a device with no history.
    return [];
  }
}

/**
 * Take one.
 *
 * Returns the snapshot, or null when the device would not store it. Never
 * throws: a failed snapshot must not be able to break the action it was
 * protecting — the point of taking one before an import is that the import
 * still happens.
 */
export async function takeSnapshot(
  reason: Reason,
  data: Record<string, unknown>,
  now = new Date(),
): Promise<Snapshot | null> {
  try {
    const text = JSON.stringify(data);
    const { blob, gzip } = await squeeze(text);
    const row: Stored = {
      id: newId(),
      at: now.getTime(),
      reason,
      bytes: blob.size,
      counts: countsOf(data),
      body: blob,
      gzip,
    };
    await tx('readwrite', (s) => s.put(row));
    await thin(now);
    return meta(row);
  } catch {
    return null;
  }
}

/** Read one back. Null when it is gone or unreadable rather than throwing. */
export async function readSnapshot(id: string): Promise<Record<string, unknown> | null> {
  try {
    const row = await tx<Stored | undefined>(
      'readonly',
      (s) => s.get(id) as IDBRequest<Stored | undefined>,
    );
    if (!row) return null;
    const parsed: unknown = JSON.parse(await unsqueeze(row.body, row.gzip));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function dropSnapshot(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    // Nothing to do about it, and nothing worth saying.
  }
}

/** Apply the keeping rules. Called after every new one. */
export async function thin(now = new Date()): Promise<void> {
  for (const id of stale(await listSnapshots(), now)) await dropSnapshot(id);
}

/** Everything, for "delete all my data". */
export async function clearSnapshots(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    // As above.
  }
}
