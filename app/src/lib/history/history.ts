import { newId, store, type Store } from '../idb';
import {
  DEFAULT_POLICY, clampPolicy, forget as forgetIn, makeRecord, prune, readRecord, toExport, visible,
  type EvaluationInput, type EvaluationRecord, type HistoryExport, type HistoryPolicy, type Scope, type State,
} from './evaluations';

/**
 * The evaluation history on the device: the pure lifecycle in `evaluations.ts`
 * with storage put under it.
 *
 * Every call returns a result and none throws into the caller. A history that
 * cannot be written must never stop the screen that asked "why did it say
 * that?", and a history that cannot be *cleared* must say so, not claim it
 * did. Nothing here uses the network, so it behaves the same offline: there is
 * no queue to flush and no server copy to reconcile, which is the point of
 * keeping it on the device.
 *
 * Stored rows are read through `readRecord`, so a row that is not exactly a
 * record, from an older version or a damaged store, is ignored and removed at
 * the next purge rather than shown.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface Backing {
  all(): Promise<unknown[]>;
  put(record: EvaluationRecord): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export const DB_NAME = 'semester-history';
export const POLICY_KEY = 'semester.history.policy.v1';

/** The production backing: one object store in its own database, so erasing it touches nothing else. */
export function idbBacking(s: Store): Backing {
  return {
    all: () => s.tx('readonly', (o) => o.getAll() as IDBRequest<unknown[]>).then((rows) => rows ?? []),
    put: (r) => s.tx('readwrite', (o) => o.put(r)).then(() => undefined),
    remove: (ids) => (ids.length === 0 ? Promise.resolve() : s.work<void>('readwrite', (o, done) => { for (const id of ids) o.delete(id); done(undefined); })),
    clear: () => s.tx('readwrite', (o) => o.clear()).then(() => undefined),
  };
}

const fail = (e: unknown): { ok: false; reason: string } => ({ ok: false, reason: e instanceof Error ? e.message : 'The history could not be read or written.' });

export interface Options {
  policy: () => HistoryPolicy;
  now?: () => number;
  id?: () => string;
}

export function createHistory(backing: Backing, o: Options) {
  const now = o.now ?? Date.now;
  const id = o.id ?? (() => newId('ev-'));

  async function load(): Promise<{ state: State; stored: number; unreadable: string[] }> {
    const rows = await backing.all();
    const records: EvaluationRecord[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const r = readRecord(row);
      if (r) records.push(r);
      else if (typeof row === 'object' && row !== null && typeof (row as { id?: unknown }).id === 'string') unreadable.push((row as { id: string }).id);
    }
    return { state: { records, policy: clampPolicy(o.policy()) }, stored: rows.length, unreadable };
  }

  /** Remove what is kept but is no longer shown, and any row that is not a record. */
  async function sweep(state: State, unreadable: readonly string[]): Promise<number> {
    const keep = new Set(prune(state, now()).records.map((r) => r.id));
    const drop = [...state.records.filter((r) => !keep.has(r.id)).map((r) => r.id), ...unreadable];
    await backing.remove(drop);
    return drop.length;
  }

  return {
    /** Write one evaluation. `value` is null when the policy says nothing is stored. */
    async record(input: EvaluationInput): Promise<Outcome<EvaluationRecord | null>> {
      try {
        const { state, unreadable } = await load();
        const rec = makeRecord(input, id(), now(), state.policy);
        if (rec) await backing.put(rec);
        // Swept from the state *with* the new record but *before* pruning: a state
        // that is already pruned has nothing left to delete, and the expired rows
        // would stay on disk while looking gone.
        await sweep(rec ? { ...state, records: [...state.records.filter((r) => r.id !== rec.id), rec] } : state, unreadable);
        return { ok: true, value: rec };
      } catch (e) {
        return fail(e);
      }
    },

    /** Everything that may be shown now, newest first. An expired record is never returned, whether or not it has been purged. */
    async list(): Promise<Outcome<EvaluationRecord[]>> {
      try {
        const { state } = await load();
        return { ok: true, value: visible(state, now()) };
      } catch (e) {
        return fail(e);
      }
    },

    /** Delete what has expired, is over the cap, or is not a record. With the history off this deletes everything. */
    async purge(): Promise<Outcome<number>> {
      try {
        const { state, unreadable } = await load();
        return { ok: true, value: await sweep(state, unreadable) };
      } catch (e) {
        return fail(e);
      }
    },

    /** Delete what the scope names: a school's records, or a subject's, or everything up to a time. */
    async forget(scope: Scope): Promise<Outcome<number>> {
      try {
        const { state } = await load();
        const after = new Set(forgetIn(state, scope).records.map((r) => r.id));
        const drop = state.records.filter((r) => !after.has(r.id)).map((r) => r.id);
        await backing.remove(drop);
        return { ok: true, value: drop.length };
      } catch (e) {
        return fail(e);
      }
    },

    /** Everything the student could be shown, in full, to take away. */
    async exportAll(): Promise<Outcome<HistoryExport>> {
      try {
        const { state } = await load();
        return { ok: true, value: toExport(state, now()) };
      } catch (e) {
        return fail(e);
      }
    },

    /** Delete it all. False when it could not be confirmed, so a screen never says it is gone when it is not. */
    async clear(): Promise<boolean> {
      try {
        await backing.clear();
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ── The device's own instance ─────────────────────────────────────────────

/** The device's policy: what was saved, made safe, or the default. */
export function readPolicy(): HistoryPolicy {
  try {
    const raw = localStorage.getItem(POLICY_KEY);
    return clampPolicy(raw ? (JSON.parse(raw) as Partial<HistoryPolicy>) : DEFAULT_POLICY);
  } catch {
    return clampPolicy(DEFAULT_POLICY);
  }
}

/** Save a policy, made safe. Returns what was actually saved, which may be lower than what was asked. */
export function savePolicy(requested: Partial<HistoryPolicy>): HistoryPolicy {
  const policy = clampPolicy(requested);
  try {
    localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
  } catch {
    // A browser that refuses storage keeps the default, which is the short one.
  }
  return policy;
}

export const history = createHistory(idbBacking(store(DB_NAME, 'records')), { policy: readPolicy });

/** For "Erase from this device". */
export const clearHistory = (): Promise<boolean> => history.clear();
