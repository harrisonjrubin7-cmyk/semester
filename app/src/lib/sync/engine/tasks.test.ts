import { describe, expect, it } from 'vitest';
import { memoryStore, SyncEngine } from '@semester/offline-sync';
import type { PersonalTask } from '../../types';
import { fakeTaskRows } from './fake-rows';
import { TaskSync, canon, taskOf, weave, withEngine } from './tasks';
import { tasksTransport } from './tasks-transport';

const NOW = 1_800_000_000_000;
const mk = (id: string, o: Partial<PersonalTask> = {}): PersonalTask => ({ id, title: id, date: null, time: '', note: '', done: false, created: NOW, courseId: null, ...o });

function world() {
  const t = { now: NOW };
  const rows = fakeTaskRows();
  const transport = tasksTransport(rows, { now: () => t.now });
  const device = (id: string) => {
    let n = 0;
    const store = memoryStore();
    const engine = new SyncEngine({ store, transport, identity: { tenantId: 'self', userId: 'u1', deviceId: id }, now: () => t.now, newId: () => `${id}-c${++n}`, random: () => 0.5 });
    const sync = new TaskSync(engine, store);
    /** The store's list, as the hook would keep it: adopt, sync, weave. */
    const list: { v: PersonalTask[] } = { v: [] };
    const cycle = async () => {
      await sync.adopt(list.v);
      await sync.syncOnce();
      const next = weave(list.v, await sync.tasks(), sync.knownIds, sync.adoptedCopies);
      if (next) list.v = next;
    };
    return { id, store, engine, sync, list, cycle };
  };
  return { t, rows, device };
}

describe('TaskSync.adopt', () => {
  it('turns a new task into one create, and a second adopt of the same list into nothing', async () => {
    const w = world(); const a = w.device('a');
    expect(await a.sync.adopt([mk('T1')])).toBe(1);
    expect(await a.sync.adopt([mk('T1')])).toBe(0);
  });

  it('sends only the fields that changed, and a removed optional field as null', async () => {
    const w = world(); const a = w.device('a');
    await a.sync.adopt([mk('T1', { repeat: { every: 1, unit: 'week' } as never })]); await a.sync.syncOnce();
    await a.sync.adopt([mk('T1', { title: 'Renamed' })]);
    const row = (await a.store.outbox.all())[0]!;
    expect(row.payload).toEqual({ title: 'Renamed', repeat: null });
    await a.sync.syncOnce();
    expect(w.rows.table.get('T1')!.data).toMatchObject({ title: 'Renamed', repeat: null });
    expect((await a.sync.tasks())[0]).not.toHaveProperty('repeat');
  });

  it('deletes a task the student removed, and only one this device had been given', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    a.list.v = [mk('T1')]; await a.cycle();
    // b's engine holds T1 (it synced) but b's list has never been given it.
    await b.sync.syncOnce();
    await b.sync.adopt([]);
    expect(await b.store.outbox.all()).toEqual([]);
    expect(w.rows.table.get('T1')!.deleted_at).toBeNull();
    // a removes it for real.
    a.list.v = []; await a.cycle();
    expect(w.rows.table.get('T1')!.deleted_at).not.toBeNull();
  });

  it('does not throw for a task waiting on a choice, and offers the edit again later', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.sync.adopt([mk('T1', { title: 'from a' })]); await b.sync.adopt([mk('T1', { title: 'from b' })]);
    await a.sync.syncOnce(); await b.sync.syncOnce();
    expect((await b.sync.needsAction()).length).toBe(1);
    await expect(b.sync.adopt([mk('T1', { title: 'b again' })])).resolves.toBe(0);
  });
});

describe('two devices through the store seam', () => {
  it('a task made on one appears on the other, in order, and settles with no further writes', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    a.list.v = [mk('T1', { created: NOW }), mk('T2', { created: NOW + 1 })];
    await a.cycle(); await b.cycle();
    expect(b.list.v.map((t) => t.id)).toEqual(['T1', 'T2']);
    expect(await b.sync.adopt(b.list.v)).toBe(0);
    expect(weave(b.list.v, await b.sync.tasks(), b.sync.knownIds, b.sync.adoptedCopies)).toBeNull();
  });

  it('carries an edit and a deletion across', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    a.list.v = [mk('T1'), mk('T2')]; await a.cycle(); await b.cycle();
    b.list.v = b.list.v.map((t) => (t.id === 'T1' ? { ...t, done: true } : t)).filter((t) => t.id !== 'T2');
    await b.cycle(); await a.cycle();
    expect(a.list.v).toEqual([mk('T1', { done: true })]);
  });

  it('keeps the order the student has, and puts tasks from elsewhere after it', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    b.list.v = [mk('Z', { created: NOW + 9 }), mk('Y', { created: NOW + 8 })];
    a.list.v = [mk('N', { created: NOW + 1 })]; await a.cycle();
    await b.cycle();
    expect(b.list.v.map((t) => t.id)).toEqual(['Z', 'Y', 'N']);
  });

  it('works offline: edits queue, the list never loses them, and they land when the network returns', async () => {
    const w = world(); const a = w.device('a');
    a.list.v = [mk('T1')]; await a.cycle();
    w.rows.control.failNext = 99;
    a.list.v = [{ ...a.list.v[0]!, title: 'offline edit' }];
    await a.cycle();
    expect(a.list.v[0]!.title).toBe('offline edit');
    expect((await a.sync.summary()).counts.pending).toBe(1);
    w.rows.control.failNext = 0; w.t.now += 600_000;
    await a.cycle(); await a.cycle();
    expect(w.rows.table.get('T1')!.data.title).toBe('offline edit');
    expect((await a.sync.summary()).counts.pending).toBe(0);
  });
});

describe('taskOf and weave', () => {
  const none = {};
  it('reads only a task, and treats null on an optional field as absent', () => {
    expect(taskOf({ id: 'x', title: 'y', repeat: null, steps: null })).toEqual({ id: 'x', title: 'y' });
    expect(taskOf({ id: 3 })).toBeNull();
    expect(taskOf(null)).toBeNull();
  });
  it('leaves the list alone when nothing differs', () => {
    expect(weave([mk('A')], [mk('A')], new Set(['A']), { A: canon(mk('A')) })).toBeNull();
  });
  it('takes the engine\'s copy of a task the student has not touched since it was adopted', () => {
    const out = weave([mk('A')], [mk('A', { title: 'changed elsewhere' })], new Set(['A']), { A: canon(mk('A')) })!;
    expect(out[0]!.title).toBe('changed elsewhere');
  });
  it('keeps an edit made after the engine was asked: it is the student\'s, and the next pass sends it', () => {
    const out = weave([mk('A', { title: 'typed a moment ago' })], [mk('A')], new Set(['A']), { A: canon(mk('A')) });
    expect(out).toBeNull();
  });
  it('drops a task the engine deleted only if the student has not touched it; keeps one they have', () => {
    const adopted = { GONE: canon(mk('GONE')), EDITED: canon(mk('EDITED')) };
    const list = [mk('GONE'), mk('EDITED', { note: 'wrote something' }), mk('NEW')];
    expect(weave(list, [], new Set(['GONE', 'EDITED']), adopted)!.map((t) => t.id)).toEqual(['EDITED', 'NEW']);
  });
  it('keeps a task it was never told of, and puts tasks from elsewhere after the list in the order made', () => {
    expect(weave([mk('NEW')], [mk('Z', { created: 9 }), mk('Y', { created: 3 })], new Set(), none)!.map((t) => t.id)).toEqual(['NEW', 'Y', 'Z']);
  });
});

describe('withEngine: what the sync line says', () => {
  const sum = (c: Partial<Record<string, number>>) => ({ counts: { local: 0, pending: 0, synced: 0, rejected: 0, conflicted: 0, ...c }, pending: c.pending ?? 0, oldestPendingAt: null, nextAttemptAt: null, lastSyncAt: null }) as never;
  const line = { status: 'synced', error: '' };
  it('never says Synced over tasks the account has not confirmed', () => {
    expect(withEngine(line, sum({ pending: 2 })).status).toBe('queued');
  });
  it('says refused tasks are still saved here', () => {
    const r = withEngine(line, sum({ rejected: 2 }));
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/2 actions were not accepted/);
    expect(r.error).toMatch(/saved on this device/);
  });
  it('asks about a conflict', () => {
    expect(withEngine(line, sum({ conflicted: 1 })).status).toBe('conflict');
  });
  it('lets anything worse win, and leaves a clean line alone', () => {
    const bad = { status: 'offline', error: '' };
    expect(withEngine(bad, sum({ pending: 3 }))).toBe(bad);
    expect(withEngine(line, sum({ synced: 4 }))).toBe(line);
    expect(withEngine(line, null)).toBe(line);
  });
});
