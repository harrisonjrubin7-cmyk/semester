import type { LocalStore, SyncEngine, SyncReport, SyncState, SyncSummary } from '@semester/offline-sync';
import type { PersonalTask } from '../../types';

/** Keys a task may lack. Absent on the device must travel as `null`, or a patch could never remove one. */
const OPTIONAL = ['repeat', 'steps', 'from'] as const;

/** JSON with keys sorted, so jsonb reordering is not a change (the same idea as `cloud.ts`'s `canon`). */
export function canon(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

const record = (t: PersonalTask): Record<string, unknown> => JSON.parse(JSON.stringify(t)) as Record<string, unknown>;

/** What came back from the table as a task, or null if it is not one. Optional keys sent as `null` are absent. */
export function taskOf(value: unknown): PersonalTask | null {
  if (!value || typeof value !== 'object') return null;
  const v = { ...(value as Record<string, unknown>) };
  for (const k of OPTIONAL) if (v[k] === null) delete v[k];
  return typeof v.id === 'string' && typeof v.title === 'string' ? (v as unknown as PersonalTask) : null;
}

/** The fields of `t` that differ from what the engine holds, with a removed optional field as `null`. */
function changed(was: Record<string, unknown>, t: PersonalTask): Record<string, unknown> {
  const now = record(t);
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const next = k in now ? now[k] : OPTIONAL.includes(k as never) ? null : undefined;
    if (next === undefined) continue; // not a task field the device sets; leave it
    // A present `null` (a task with no date) is a value; only a missing key is absent.
    const before = k in was ? was[k] : OPTIONAL.includes(k as never) ? null : undefined;
    if (canon(before) !== canon(next)) out[k] = next;
  }
  return out;
}

/**
 * The student's task list, as the engine sees it.
 *
 * The store keeps an array of `PersonalTask`; the engine keeps one entity per task, with a phase. This is the
 * narrow seam between them: `adopt` turns what the student did into engine writes, `tasks` turns what the
 * engine holds back into a list, and neither reaches the network.
 */
export class TaskSync {
  private readonly engine: SyncEngine;
  private readonly store: LocalStore;
  /** Tasks the store has been given or has made, so a task it never heard of is never read as deleted. */
  private readonly known = new Set<string>();
  /** Each task as the student had it the last time it was adopted: how a later edit is told from a stale list. */
  private readonly adopted = new Map<string, string>();

  constructor(engine: SyncEngine, store: LocalStore) {
    this.engine = engine;
    this.store = store;
  }

  /** The tasks this device has been given or has made. */
  get knownIds(): ReadonlySet<string> {
    return this.known;
  }

  /** Task id → the student's copy, as it was when last adopted. */
  get adoptedCopies(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.adopted);
  }

  private async mine() {
    return (await this.store.entities.all()).filter((e) => e.dataClass === 'task');
  }

  /**
   * Bring the engine up to date with the list the student has. Creates, edits (only the fields that changed) and
   * deletions — a deletion only for a task this device had actually been given, because a task the engine holds
   * and the list lacks may simply not have been delivered yet. Returns how many writes it made.
   */
  async adopt(list: PersonalTask[]): Promise<number> {
    const have = new Map((await this.mine()).map((e) => [e.id, e]));
    const ids = new Set(list.map((t) => t.id));
    let n = 0;
    const put = async (op: 'create' | 'patch' | 'delete', id: string, payload: unknown) => {
      try {
        await this.engine.write({ dataClass: 'task', entityId: id, op, payload });
        n++;
      } catch {
        // A task waiting on a choice cannot be edited until it is made (`SyncEngine.write`). The edit is still
        // in the list; it is offered again on the next pass and goes once the choice is made.
      }
    };
    for (const t of list) {
      const e = have.get(t.id);
      this.known.add(t.id);
      this.adopted.set(t.id, canon(t));
      if (!e) await put('create', t.id, record(t));
      else if (e.value !== null) {
        const diff = changed(e.value as Record<string, unknown>, t);
        if (Object.keys(diff).length > 0) await put('patch', t.id, diff);
      }
    }
    for (const e of have.values()) {
      if (e.value !== null && !ids.has(e.id) && this.known.has(e.id)) {
        this.known.delete(e.id);
        this.adopted.delete(e.id);
        await put('delete', e.id, null);
      }
    }
    return n;
  }

  /** Every task the engine holds, as the store should have it. Also what the store is now known to hold. */
  async tasks(): Promise<PersonalTask[]> {
    const out: PersonalTask[] = [];
    for (const e of await this.mine()) {
      const t = e.value === null ? null : taskOf(e.value);
      if (!t) continue;
      this.known.add(t.id);
      out.push(t);
    }
    return out;
  }

  /** The label state of each task, for the screen that shows one. */
  async states(): Promise<Map<string, SyncState>> {
    return new Map((await this.mine()).map((e) => [e.id, this.engine.stateOf(e)]));
  }

  syncOnce(): Promise<SyncReport> {
    return this.engine.syncOnce();
  }

  summary(): Promise<SyncSummary> {
    return this.engine.summary();
  }

  /** The rows still waiting on the person: one entry per command, so a choice can be made on it. */
  async needsAction() {
    return (await this.store.outbox.all()).filter((r) => r.phase === 'rejected' || r.phase === 'conflict_requires_copy');
  }
}

/**
 * The store's list, with what the engine holds worked in. `null` when that is the list already.
 *
 * The student can edit between the moment the engine was asked and the moment its answer arrives, and that edit
 * is theirs: it is in the list and not yet in the engine. So the engine's copy of a task replaces the list's
 * only if the list's copy is *unchanged since it was adopted* (`adopted`); a task the student has touched since
 * stays as they have it, and the next pass sends the difference. The same test protects a task the engine has
 * deleted: it is dropped only if the student has not changed it since — otherwise their edit is kept and goes
 * up, where it is refused as "no longer exists" and shown, rather than silently thrown away.
 *
 * Order: the list's, for tasks in both; the engine's tasks the list lacks at the end, oldest first.
 */
export function weave(
  list: PersonalTask[],
  engineTasks: PersonalTask[],
  known: ReadonlySet<string>,
  adopted: Readonly<Record<string, string>>,
): PersonalTask[] | null {
  const theirs = new Map(engineTasks.map((t) => [t.id, t]));
  const untouched = (t: PersonalTask) => t.id in adopted && adopted[t.id] === canon(t);
  const kept: PersonalTask[] = [];
  for (const t of list) {
    const e = theirs.get(t.id);
    if (!e) {
      // Not in the engine. Gone there, if this device had been given it and the student has left it alone;
      // otherwise the student's own, waiting to be adopted.
      if (!(known.has(t.id) && untouched(t))) kept.push(t);
      continue;
    }
    kept.push(untouched(t) ? e : t);
    theirs.delete(t.id);
  }
  const added = [...theirs.values()].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  const next = [...kept, ...added];
  return canon(next) === canon(list) ? null : next;
}

/**
 * The sync line, with the engine's tasks counted in — the same move the store already makes for waiting
 * choices. A device that pushed its state cleanly but holds tasks the account has not confirmed must not say
 * "Synced": that would be true of the blob and false of the student's work. Anything worse still wins.
 */
export function withEngine<S extends { status: string; error: string }>(sync: S, e: SyncSummary | null): S {
  if (!e || sync.status !== 'synced') return sync;
  const { rejected, conflicted, pending } = e.counts;
  if (rejected > 0) {
    const them = rejected === 1 ? '1 action was' : `${rejected} actions were`;
    return { ...sync, status: 'error', error: `${them} not accepted by your account. Still saved on this device.` };
  }
  if (conflicted > 0) return { ...sync, status: 'conflict', error: 'An action was changed somewhere else too. Both versions are kept.' };
  if (pending > 0) return { ...sync, status: 'queued' };
  return sync;
}
