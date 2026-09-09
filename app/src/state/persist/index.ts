/**
 * Reading and writing the account, one record at a time.
 *
 * `shape.ts` says which field goes where and why. This is the read path, the
 * write path and the one-time move off localStorage.
 *
 * ## What is guaranteed
 *
 * **The state object does not change.** What `load()` returns is what
 * `loadPersisted()` returned yesterday, through the same `lib/migrate.ts` and
 * the same defaults. The reducer, the merge map and every screen are untouched
 * by this file.
 *
 * **The old copy is not deleted.** `semester.v1` stays exactly as it was after
 * the migration, for one release, as the way back. Deleting it belongs in a
 * later release once this has been running on a real device for a while.
 *
 * **Nothing here can break the app.** Every path resolves rather than throws,
 * and `available` reports honestly whether the database took. When it did not,
 * the caller keeps the localStorage path it has always had, shedding routine
 * and all.
 */

import { readAll, isEmpty, open, write, MAPS_STORE, SETTINGS_STORE, type Write } from './db';
import { COLLECTIONS, MAPS, SETTINGS, idOf } from './shape';
import {
  DEFAULT_PERSISTED,
  STORAGE_KEY,
  loadPersisted,
  type Persisted,
} from '../shape';

/** Where the migration records that it happened, so it happens once. */
export const MIGRATED = 'migratedFrom';
export const MIGRATED_VALUE = 'localStorage.v1';

let ready = false;

/** Whether the database opened. False means the app is on the old path. */
export function available(): boolean {
  return ready;
}

/**
 * Everything, assembled into the object the app expects.
 *
 * Assembled by overlaying what was found onto the defaults, in the same way
 * `loadPersisted` does — a field the database has never heard of takes its
 * default rather than becoming undefined halfway down a screen.
 */
async function readEverything(): Promise<Partial<Persisted>> {
  const out: Record<string, unknown> = {};

  for (const key of COLLECTIONS) {
    const rows = await readAll(key);
    if (rows.length > 0) out[key] = rows.map(([, value]) => value);
  }

  for (const [key, value] of await readAll(MAPS_STORE)) {
    if (MAPS.includes(key as keyof Persisted)) out[key] = value;
  }

  for (const [key, value] of await readAll(SETTINGS_STORE)) {
    if (key === MIGRATED) continue;
    if (SETTINGS.includes(key as keyof Persisted)) out[key] = value;
  }

  return out as Partial<Persisted>;
}

/**
 * The one-time move.
 *
 * Runs only when the database is empty and the old key exists. Reads it
 * through the app's own loader, so the same migrations and the same defaults
 * apply, and writes the result out record by record.
 */
async function migrateFromLocalStorage(): Promise<Persisted | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  // Through the app's own reader, not through `JSON.parse` here: that is what
  // applies `lib/migrate.ts`, the per-field validators and the defaults, and
  // reimplementing any of it would be a second definition of what a stored
  // account means.
  const state = loadPersisted();
  const ok = await write([...writesFor(DEFAULT_PERSISTED, state), {
    store: SETTINGS_STORE,
    key: MIGRATED,
    value: MIGRATED_VALUE,
  }]);
  // The old copy stays. It is the way back for one release.
  return ok ? state : null;
}

/**
 * Open the database, migrate if this is the first run, and read.
 *
 * Returns null when the database is unavailable, which is the caller's signal
 * to stay on localStorage.
 */
export async function load(): Promise<Persisted | null> {
  const db = await open(COLLECTIONS as string[]);
  if (!db) return null;
  ready = true;

  if (await isEmpty()) {
    const migrated = await migrateFromLocalStorage();
    // A genuinely new account has nothing to migrate and nothing to read.
    return migrated ?? { ...DEFAULT_PERSISTED };
  }

  const found = await readEverything();
  return { ...DEFAULT_PERSISTED, ...found };
}

/**
 * The writes that turn `prev` into `next`.
 *
 * Reference equality throughout, which is exactly right for a reducer that
 * returns new objects for what changed and the same objects for what did not.
 * Ticking one box writes one row.
 *
 * Exported for the test, which is the only way to check "one edit, one write"
 * without a browser.
 */
export function writesFor(prev: Partial<Persisted>, next: Partial<Persisted>): Write[] {
  const out: Write[] = [];

  for (const key of COLLECTIONS) {
    const before = (prev[key] ?? []) as unknown[];
    const after = (next[key] ?? []) as unknown[];
    if (before === after) continue;

    const had = new Map(before.map((r, i) => [idOf(r, i), r]));
    const has = new Map(after.map((r, i) => [idOf(r, i), r]));
    for (const [id, record] of has) {
      // Only what actually moved. A course untouched by an edit to its
      // neighbour keeps its reference and is not rewritten.
      if (had.get(id) !== record) out.push({ store: key, key: id, value: record });
    }
    for (const id of had.keys()) {
      if (!has.has(id)) out.push({ store: key, key: id, value: null });
    }
  }

  for (const key of MAPS) {
    if (prev[key] !== next[key]) out.push({ store: MAPS_STORE, key, value: next[key] });
  }

  for (const key of SETTINGS) {
    if (prev[key] !== next[key]) out.push({ store: SETTINGS_STORE, key, value: next[key] });
  }

  return out;
}

/** How long after the last change the writes go out. */
export const SETTLE_MS = 250;

let pending: Partial<Persisted> | null = null;
let last: Partial<Persisted> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> = Promise.resolve();

async function flush(): Promise<void> {
  const next = pending;
  pending = null;
  if (!next || !last) return;
  const writes = writesFor(last, next);
  last = next;
  if (writes.length === 0) return;
  try {
    await write(writes);
    // Only now, and only because something was actually written. See
    // `persist` below on why the order matters.
    const say = announce;
    announce = null;
    say?.();
  } catch {
    // A failed write must never break the app. The state is still in memory,
    // the old localStorage copy is still on disk, and the next change tries
    // again — this is the one place where carrying on is better than saying
    // so, because there is nothing the person could do about it mid-keystroke.
  }
}

/** What the app last read or wrote, so the first diff has something to be against. */
export function prime(state: Partial<Persisted>): void {
  last = state;
}

/**
 * Save, eventually.
 *
 * Debounced and coalesced: typing a note produces one write a quarter of a
 * second after the typing stops, not one per keystroke. Asynchronous
 * throughout, so nothing here can block a render.
 */
let announce: (() => void) | null = null;

/**
 * Save, eventually.
 *
 * Debounced and coalesced: typing a note produces one write a quarter of a
 * second after the typing stops, not one per keystroke. Asynchronous
 * throughout, so nothing here can block a render.
 *
 * `onWrote` is called once the write has landed, and only when there was
 * something to write. That is what the caller uses to tell the other tabs,
 * and the ordering is the point. `lib/tabs.ts` claims there is "no ordering
 * problem between a broadcast and a write" — true of the localStorage path,
 * where the write is synchronous and done before anyone is told. On this path
 * the write is a quarter of a second away, so telling the other tab first sent
 * it to read a disk that did not have the change on it yet: it hydrated the
 * old copy, and wrote that back over the new one.
 *
 * Measured with two tabs open and a note typed in one: the note's row reached
 * the database with an empty title. The title was on screen, in memory, and
 * nowhere else.
 */
export function persist(next: Partial<Persisted>, onWrote?: () => void): void {
  if (!ready) return;
  pending = next;
  if (onWrote) announce = onWrote;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    inFlight = inFlight.then(flush);
  }, SETTLE_MS);
}

/**
 * Stop writing, for good.
 *
 * One caller: `lib/erase.ts`. `persist()` settles a quarter of a second after
 * the last change, so at the moment somebody presses Erase there is very
 * likely a write in flight — and a write that lands after the stores are
 * emptied puts a row back into an emptied store. The app reloads immediately
 * afterwards, so there is nothing to turn back on.
 */
export function stopWriting(): void {
  ready = false;
  pending = null;
  announce = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Write whatever is owing right now. For a tab closing, and for tests. */
export async function flushNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  inFlight = inFlight.then(flush);
  await inFlight;
}
