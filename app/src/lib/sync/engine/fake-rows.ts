// Test support: not shipped, and not a test file so `tsc` checks it.
import type { TaskRow, TaskRows } from './rows';
import { versionToStamp } from './stamp';

/**
 * `public.tasks` as the database behaves, in memory: a primary key, a `touch_updated_at` trigger that stamps
 * every write with a strictly increasing microsecond clock the client cannot set, and a compare-and-swap that
 * matches only the exact stamp. `data` is jsonb, so it is stored as a copy and read as one.
 */
export function fakeTaskRows(start = 1_800_000_000_000_000) {
  const table = new Map<string, TaskRow>();
  let clock = start;
  const stamp = () => versionToStamp((clock += 7));
  const copy = (r: TaskRow): TaskRow => structuredClone(r);
  const calls = { get: 0, insert: 0, updateIf: 0, byCommand: 0, since: 0 };
  const control = { failNext: 0 };
  /** A dropped connection: the next N calls throw before touching anything. */
  const fail = () => {
    if (control.failNext > 0) { control.failNext--; throw new Error('network: connection lost'); }
  };
  const port: TaskRows = {
    async get(id) {
      calls.get++; fail();
      const r = table.get(id);
      return r ? copy(r) : null;
    },
    async insert(id, data) {
      calls.insert++; fail();
      if (table.has(id)) return 'taken';
      const r: TaskRow = { id, data: structuredClone(data), updated_at: stamp(), deleted_at: null };
      table.set(id, r);
      return copy(r);
    },
    async updateIf(id, at, data, deletedAt) {
      calls.updateIf++; fail();
      const r = table.get(id);
      if (!r || r.updated_at !== at) return null;
      const next: TaskRow = { id, data: structuredClone(data), updated_at: stamp(), deleted_at: deletedAt ?? r.deleted_at };
      table.set(id, next);
      return copy(next);
    },
    async byCommand(cmd) {
      calls.byCommand++; fail();
      const r = [...table.values()].find((x) => x.data._cmd === cmd);
      return r ? copy(r) : null;
    },
    async since(at, limit) {
      calls.since++; fail();
      const all = [...table.values()].sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      const out = at === null ? all.filter((r) => r.deleted_at === null) : all.filter((r) => r.updated_at >= at);
      return out.slice(0, limit).map(copy);
    },
  };
  return {
    ...port,
    table,
    calls,
    control,
    /** Another device writing the row directly. */
    touch(id: string, data: Record<string, unknown>, deletedAt: string | null = null) {
      table.set(id, { id, data: structuredClone(data), updated_at: stamp(), deleted_at: deletedAt });
    },
  };
}
