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
import { readIncoming } from '../../lib/stored';
import { migrate, versionOf } from '../../lib/migrate';
import {
  DEFAULT_PERSISTED,
  STORAGE_KEY,
  loadPersisted,
  type Persisted,
} from '../shape';

/** Where the migration records that it happened, so it happens once. */
export const MIGRATED = 'migratedFrom';
export const MIGRATED_VALUE = 'localStorage.v1';

/**
 * The version a database account is assumed to be at when it does not say.
 *
 * Most of them do not say, and it is not damage. `writesFor` only writes a
 * setting that differs from the default, and every account written here was
 * written by a build whose `SCHEMA` equalled its own `DEFAULT_PERSISTED`
 * marker — so the row was identical to the default and never stored. Reading
 * that silence as version 1, which is what `versionOf` does for a plain
 * localStorage blob, would re-run every step ever written on every single
 * load: step 3 would empty a `list` somebody has since chosen on purpose.
 *
 * Three, because three is what the build that added this directory wrote.
 * `persist/index.ts` and `SCHEMA = 3` arrived in the same commit, so no
 * database account can predate it — which is a fact about the history rather
 * than an assumption, and `index.test.ts` pins the two together so a future
 * step cannot quietly invalidate it.
 */
export const FIRST_DB_SCHEMA = 3;

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
 * What the first run found, told apart rather than collapsed into null.
 *
 * Three different things used to come back as `null` here, and `load` could
 * only treat them alike: an account moved, nothing to move, and a move that
 * was tried and did not land. The last two need opposite handling — one is a
 * new account to stamp, the other is a move to try again next time — so they
 * are named.
 */
type FirstRun =
  /** An account was read out of `semester.v1` and written to the database. */
  | { kind: 'moved'; state: Persisted }
  /** There was nothing to move: this device is starting from scratch. */
  | { kind: 'fresh' }
  /** There was something to move and the write did not land. Try again. */
  | { kind: 'incomplete' };

/**
 * The one-time move.
 *
 * Runs only when the database is empty and the old key exists. Reads it
 * through the app's own loader, so the same migrations and the same defaults
 * apply, and writes the result out record by record.
 */
async function migrateFromLocalStorage(): Promise<FirstRun> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage off, in a private window or behind a setting. There is nothing
    // to move and there never will be, so this is a fresh account rather
    // than a move to retry.
    return { kind: 'fresh' };
  }
  if (!raw) return { kind: 'fresh' };

  // Through the app's own reader, not through `JSON.parse` here: that is what
  // applies `lib/migrate.ts`, the per-field validators and the defaults, and
  // reimplementing any of it would be a second definition of what a stored
  // account means.
  const state = loadPersisted();
  const ok = await write([
    ...writesFor(DEFAULT_PERSISTED, state),
    {
      store: SETTINGS_STORE,
      key: MIGRATED,
      value: MIGRATED_VALUE,
    },
    /*
     * And the version, written whether or not it differs from the default.
     *
     * `writesFor` stores only what differs, and this field almost never does:
     * a copy that has just been through `loadPersisted` is stamped with this
     * build's `SCHEMA`, which is the same number the defaults carry. So the
     * row was silently left out of every account this has ever moved, and the
     * database came out saying nothing about what shape it was in.
     *
     * `forward` reads that silence as `FIRST_DB_SCHEMA` and is right about
     * every account that exists today. It is right by a fact about the
     * history rather than by construction, though, and there was one window
     * where the difference showed: move on Monday, choose a navigation on
     * Tuesday, reopen — and the step that had already run ran again, because
     * nothing on disk said it had. Writing the marker at the moment the
     * account is created closes it by construction.
     */
    { store: SETTINGS_STORE, key: 'schemaVersion', value: state.schemaVersion },
  ]);
  // The old copy stays. It is the way back for one release.
  return ok ? { kind: 'moved', state } : { kind: 'incomplete' };
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
    const first = await migrateFromLocalStorage();
    if (first.kind === 'moved') return first.state;
    /*
     * A genuinely new account has nothing to migrate and nothing to read —
     * but it does have a version, and it has to say so.
     *
     * `writesFor` stores only a setting that differs from the default, and a
     * new account's version *is* the default, so the marker was never
     * written. Nothing here says that: the account went to disk with no
     * `schemaVersion` row, and on the next open `forwardFrom` read that
     * silence as `FIRST_DB_SCHEMA` and ran every step above it — on an
     * account created by this build, which had never needed any of them.
     *
     * Steps 4, 5 and 6 each rewrite `nav` unconditionally, so the cost was
     * exact and silent: choose a navigation on the day you install the app,
     * reopen it, and you are back on the default with nothing said. Step 3
     * takes `directory` the same way. From the second open it stuck, because
     * by then the steps had written the marker themselves — which is what
     * made it look like a fluke rather than a rule.
     *
     * `migrateFromLocalStorage` already writes this marker on its own path,
     * for the reason its comment gives: closing the window by construction
     * rather than by a fact about history. This is the same door, and it was
     * the one left open.
     *
     * Only for `fresh`. An `incomplete` move must not be stamped: the stamp
     * fills the settings store, `isEmpty` is false next time, and the
     * `semester.v1` account it failed to move would never be looked at again.
     * A write that does not land leaves the marker off and the steps run
     * once, which is exactly where this started — no worse than today.
     */
    if (first.kind === 'fresh') {
      await write([
        { store: SETTINGS_STORE, key: 'schemaVersion', value: DEFAULT_PERSISTED.schemaVersion },
      ]);
    }
    return { ...DEFAULT_PERSISTED };
  }

  const found = await readEverything();
  // The database path never goes near `loadPersisted` — the value is primed
  // before the reducer's initialiser runs, so its field rules are not in the
  // way. The third door, through the same reader as the other two. See
  // `lib/stored.ts`.
  const moved = await forward(found);
  return { ...DEFAULT_PERSISTED, ...readIncoming(moved as Record<string, unknown>) } as Persisted;
}

/**
 * The schema steps, on the database path too.
 *
 * This file's own promise at the top is that `load()` returns what
 * `loadPersisted()` returned yesterday, *through the same `lib/migrate.ts`* —
 * and until now that was only true of the one-time move off localStorage.
 * Everything already in the database was read straight out and handed to the
 * app, so a step added to `STEPS` reached the copies that had not moved yet
 * and silently missed every account that had. That is every account of
 * anybody who has opened the app since the database shipped: exactly the
 * people a migration is written for.
 *
 * ## And it is written back
 *
 * A step that runs on every load is not a migration, it is a policy — it
 * would undo the setting somebody changed after it, every morning. So when a
 * step runs, the fields it moved go back to the database with the new marker
 * beside them, and `versionOf` skips them next time. `writesFor` computes
 * that diff the same way every other save does: `migrate` copies the top
 * level and leaves the collections by reference, so only what actually
 * changed is written.
 *
 * A failed write is not a failed load. The app opens on the migrated value
 * either way; the worst a write that did not land can do is make the step run
 * again on the next open, which is where it started.
 */
async function forward(found: Partial<Persisted>): Promise<Partial<Persisted>> {
  const { state, writes } = forwardFrom(found);
  if (writes.length > 0) await write(writes);
  return state;
}

/**
 * The decision inside `forward`, with the database taken out of it.
 *
 * Exported for the test, which is the only way to check "steps run, and run
 * once" without an IndexedDB — the same reason `writesFor` above is exported,
 * and the same shape: everything that decides anything is a pure function of
 * what was read.
 */
export function forwardFrom(found: Partial<Persisted>): {
  state: Partial<Persisted>;
  writes: Write[];
} {
  const at = { ...(found as Record<string, unknown>) };
  // The floor, not `versionOf`'s answer for a missing marker. See
  // `FIRST_DB_SCHEMA` for why silence here means three rather than one.
  if (versionOf(at) === 1) at.schemaVersion = FIRST_DB_SCHEMA;

  const moved = migrate(at);
  if (moved.ran.length === 0) return { state: found, writes: [] };

  const next = moved.state as Partial<Persisted>;
  return { state: next, writes: writesFor(found, next) };
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

/**
 * Who to tell once a write has actually landed.
 *
 * Carried alongside `pending` rather than passed through, because the calls
 * coalesce: five keystrokes make one write, and the callback of the last one
 * is the one that matters. Cleared as the write goes out, so a settled write
 * with nothing following it tells nobody twice.
 */
let told: (() => void) | null = null;

/**
 * Told whether writes are landing.
 *
 * A standing registration rather than an argument to `persist`, because it is
 * about the writer and not about one write, and because `stopWriting` is
 * already that shape. `state/store.tsx` turns the banner on and off with it.
 */
let watching: ((failing: boolean) => void) | null = null;

/** Register the one listener, or clear it with null. */
export function whileWriting(fn: ((failing: boolean) => void) | null): void {
  watching = fn;
}

async function flush(): Promise<void> {
  const next = pending;
  const tell = told;
  pending = null;
  told = null;
  if (!next || !last) return;
  const before = last;
  const writes = writesFor(last, next);
  last = next;
  // Nothing to write is not something to announce. A tab told to re-read a
  // disk that did not change is the first step of a loop, not an update.
  if (writes.length === 0) return;
  /*
   * `write` reports a failure by answering false, not by throwing.
   *
   * This was a `try`/`catch` around it, whose catch could therefore never run
   * — `db.ts` resolves false on an error, on an abort and on a synchronous
   * throw. So every write counted as a success: `last` moved on to a state
   * the database had refused, and `tell` went out.
   *
   * That last one matters most, because `tell` is the nudge that sends the
   * other tab to re-read the disk. Sent after a write that did not land, it
   * sends that tab to read a disk without the change on it — which is the
   * hazard the ordering here exists to prevent, re-armed in the one case
   * where it does most damage.
   *
   * Measured on the production build, with `put` refusing the way a full disk
   * refuses it: a task added through the quick-add sheet drew on screen,
   * stayed in memory, and was gone after a reload — no warning while typing,
   * none afterwards, and nothing in the console.
   */
  let ok = false;
  try {
    ok = await write(writes);
  } catch {
    ok = false;
  }

  if (!ok) {
    /*
     * Nothing is thrown and no screen is taken down: the state is still in
     * memory, and there is nothing a person could do about one failed write
     * mid-keystroke. That much was right, and it is kept.
     *
     * Two things are new. `last` goes back, so the next write carries this
     * change as well — it had already moved on to what the database *would*
     * have held, so the failed change was never retried, not even when the
     * failure was one transaction losing one race. And nobody is told, for
     * the reason the old comment gave.
     *
     * Then it is said out loud. `App.tsx` draws a banner for exactly this and
     * argues for it above: *"Until it is fixed, everything the person does is
     * being lost on the next reload, and a message that fades after four
     * seconds is worse than none because it makes them think they imagined
     * it."* The only thing that could turn it on was
     * `navigator.storage.estimate()` — a guess about a quota rather than news
     * about a write, and no help at all when the disk is full but the
     * origin's quota is not.
     */
    last = before;
    watching?.(true);
    return;
  }

  tell?.();
  // And the writer is working, which clears a warning left by a failure that
  // has since passed — a browser that made room, or a transaction that lost a
  // race and won the next one.
  watching?.(false);
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
 *
 * `onWrote` runs after the write has landed, and only when there was
 * something to write. It exists for the other tabs, and the ordering is the
 * whole point of it: `lib/tabs.ts` reasons that there is "no ordering problem
 * between a broadcast and a write", which is true of the localStorage path,
 * where the write is synchronous and finished before anyone is told. It is
 * not true of this one. Announcing on the way in sends the other tab to read
 * a disk that is still a quarter of a second behind, and what it reads it
 * writes back — over the change that had not landed yet.
 */
export function persist(next: Partial<Persisted>, onWrote?: () => void): void {
  if (!ready) return;
  pending = next;
  told = onWrote ?? null;
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
  told = null;
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
