import { describe, expect, it } from 'vitest';
import { encode } from './hlc';
import {
  MAX_ATTEMPTS, STATES, WAIT_MS, canMove, drain, enqueue, entries, mergeFields, release, type Enqueue, type Outcome, type Send, type Stamped,
} from './queue';
import { memoryStorage, openVault, type Identity } from './vault';

const ME: Identity = { tenantId: 'vanderbilt', personId: 'p-1', deviceId: 'd-1' };
const NOW = 1_800_000_000_000;
const st = (n: number, node = 'd-1') => encode({ wall: NOW + n, counter: 0, node });

const edit = (key: string, over: Partial<Enqueue> = {}): Enqueue => ({
  key, recordId: 'task-1', op: 'upsert', cls: 'personal_plan', fields: { title: key },
  stamp: st(Number(key.replace(/\D/g, '') || 0)), correlationId: `corr-${key}`, policyVersion: 'p1', ...over,
});

async function setup(t = { now: NOW }) {
  const vault = await openVault(ME, memoryStorage(), { now: () => t.now });
  return { vault, t };
}

const always = (o: Outcome): Send => async () => o;

describe('the states', () => {
  it('only moves forward: final states go nowhere, and saved_locally cannot skip the queue to accepted', () => {
    for (const final of ['accepted', 'rejected', 'conflict_requires_copy'] as const) {
      for (const to of STATES) expect(canMove(final, to), `${final}→${to}`).toBe(false);
    }
    expect(canMove('saved_locally', 'accepted')).toBe(false);
    expect(canMove('saved_locally', 'queued')).toBe(true);
    expect(canMove('queued', 'accepted')).toBe(true);
  });
});

describe('enqueueing', () => {
  it('stores the edit sealed, as queued, with its idempotency key and correlation id', async () => {
    const { vault } = await setup();
    const m = await enqueue(vault, edit('e1'), NOW);
    expect(m).toMatchObject({ id: 'e1', state: 'queued', attempts: 0, correlationId: 'corr-e1', policyVersion: 'p1', expiresAt: NOW + WAIT_MS });
    expect((await entries(vault)).map((x) => x.id)).toEqual(['e1']);
  });

  it('keeps the whole envelope for an allowlisted class, and minimises only the record’s own fields', async () => {
    const { vault } = await setup();
    const m = await enqueue(vault, edit('e1', { cls: 'assignment_meta', fields: { title: 'Lab 3', dueAt: 9, grade: '92' } }), NOW);
    expect(m.fields).toEqual({ title: 'Lab 3', dueAt: 9 });
    const [stored] = await entries(vault);
    expect(stored).toMatchObject({ id: 'e1', recordId: 'task-1', op: 'upsert', cls: 'assignment_meta', state: 'queued', fields: { title: 'Lab 3', dueAt: 9 } });
    // …and it still drains and records the outcome rather than vanishing.
    await drain(vault, always({ status: 'accepted' }), { now: () => NOW });
    expect((await entries(vault))[0].state).toBe('accepted');
  });

  it('returns the first entry for a repeated key instead of making a second', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1', { fields: { title: 'first' } }), NOW);
    const again = await enqueue(vault, edit('e1', { fields: { title: 'second' } }), NOW + 5);
    expect(again.fields).toEqual({ title: 'first' });
    expect(await entries(vault)).toHaveLength(1);
  });

  it('cannot enqueue an official write at all — there is no flag that lets one through', async () => {
    const { vault } = await setup();
    for (const cls of ['official_record', 'financial', 'protected_case', 'guardian_control', 'credential', 'source_raw'] as const) {
      await expect(enqueue(vault, edit(`x-${cls}`, { cls }), NOW), cls).rejects.toMatchObject({ code: 'denied_class' });
    }
    expect(await entries(vault)).toEqual([]);
  });

  it('holds an edit as saved_locally until it is released, and never sends it before', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1', { hold: true }), NOW);
    const sent: string[] = [];
    const r = await drain(vault, async (m) => (sent.push(m.id), { status: 'accepted' }), { now: () => NOW });
    expect(sent).toEqual([]);
    expect(r.sent).toBe(0);
    expect((await entries(vault))[0].state).toBe('saved_locally');
    await release(vault, 'e1');
    await drain(vault, async (m) => (sent.push(m.id), { status: 'accepted' }), { now: () => NOW });
    expect(sent).toEqual(['e1']);
  });
});

describe('draining', () => {
  it('sends in clock order with the idempotency key, and records the outcome', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e2', { recordId: 'r2' }), NOW);
    await enqueue(vault, edit('e1', { recordId: 'r1' }), NOW);
    const seen: [string, string][] = [];
    const r = await drain(vault, async (m, key) => (seen.push([m.id, key]), { status: 'accepted' }), { now: () => NOW });
    expect(seen).toEqual([['e1', 'e1'], ['e2', 'e2']]);
    expect(r).toMatchObject({ sent: 2, accepted: 2 });
    expect((await entries(vault)).map((m) => m.state)).toEqual(['accepted', 'accepted']);
  });

  it('never sends an accepted edit again', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1'), NOW);
    await drain(vault, always({ status: 'accepted' }), { now: () => NOW });
    let calls = 0;
    await drain(vault, async () => (calls++, { status: 'accepted' }), { now: () => NOW });
    expect(calls).toBe(0);
  });

  it('keeps a rejection, with the server’s reason, rather than dropping it', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1'), NOW);
    await drain(vault, always({ status: 'rejected', reason: 'task was deleted elsewhere' }), { now: () => NOW });
    expect((await entries(vault))[0]).toMatchObject({ state: 'rejected', reason: 'task was deleted elsewhere' });
  });

  it('turns a conflict into a final state that asks for a copy', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1'), NOW);
    const r = await drain(vault, always({ status: 'conflict' }), { now: () => NOW });
    expect(r.conflicts).toBe(1);
    expect((await entries(vault))[0].state).toBe('conflict_requires_copy');
  });

  it('retries with growing backoff, treats a thrown send as a retry, and does not call early', async () => {
    const t = { now: NOW };
    const { vault } = await setup(t);
    await enqueue(vault, edit('e1'), NOW);
    let calls = 0;
    const flaky: Send = async () => { calls++; throw new Error('offline'); };

    await drain(vault, flaky, { now: () => t.now });
    expect(calls).toBe(1);
    const first = (await entries(vault))[0];
    expect(first).toMatchObject({ state: 'queued', attempts: 1 });

    const r = await drain(vault, flaky, { now: () => t.now }); // too soon
    expect(calls).toBe(1);
    expect(r.skipped).toBe(1);

    t.now = first.nextAttemptAt;
    await drain(vault, flaky, { now: () => t.now });
    expect(calls).toBe(2);
    const second = (await entries(vault))[0];
    expect(second.nextAttemptAt - t.now).toBeGreaterThan(first.nextAttemptAt - NOW); // backoff grew
  });

  it('dead-letters after the attempt limit and says why — it does not retry forever', async () => {
    const t = { now: NOW };
    const { vault } = await setup(t);
    await enqueue(vault, edit('e1'), NOW);
    let calls = 0;
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
      await drain(vault, async () => (calls++, { status: 'retry' }), { now: () => t.now });
      t.now += 10 * 60 * 1000;
    }
    expect(calls).toBe(MAX_ATTEMPTS);
    expect((await entries(vault))[0]).toMatchObject({ state: 'rejected', reason: 'retries_exhausted' });
  });

  it('never sends an edit that waited too long, and marks it expired', async () => {
    const t = { now: NOW };
    const { vault } = await setup(t);
    await enqueue(vault, edit('e1'), NOW);
    t.now = NOW + WAIT_MS - 1;
    // Control: just inside the window it is sent.
    let calls = 0;
    await enqueue(vault, edit('e2', { recordId: 'r2' }), t.now);
    await drain(vault, async (m) => (calls++, m.id === 'e2' ? { status: 'accepted' } : { status: 'accepted' }), { now: () => t.now });
    expect(calls).toBe(2);

    const t2 = { now: NOW };
    const b = await setup(t2);
    await enqueue(b.vault, edit('e1'), NOW);
    t2.now = NOW + WAIT_MS;
    let sent = 0;
    await drain(b.vault, async () => (sent++, { status: 'accepted' }), { now: () => t2.now });
    expect(sent).toBe(0);
    expect((await entries(b.vault))[0]).toMatchObject({ state: 'rejected', reason: 'expired' });
  });

  it('keeps one record’s edits in order: a later edit waits behind an earlier one that is retrying', async () => {
    const { vault } = await setup();
    await enqueue(vault, edit('e1', { recordId: 'same' }), NOW);
    await enqueue(vault, edit('e2', { recordId: 'same' }), NOW);
    await enqueue(vault, edit('e3', { recordId: 'other' }), NOW);
    const sent: string[] = [];
    await drain(vault, async (m) => (sent.push(m.id), m.id === 'e1' ? { status: 'retry' } : { status: 'accepted' }), { now: () => NOW });
    expect(sent).toEqual(['e1', 'e3']); // e2 did not overtake e1; e3 is a different record and was free to go
  });

  it('survives a reopen: the queue is in the vault, not in memory', async () => {
    const storage = memoryStorage();
    const v1 = await openVault(ME, storage, { now: () => NOW });
    await enqueue(v1, edit('e1'), NOW);
    // The key is in storage, so a second vault over the same storage reads the same queue.
    const v2 = await openVault(ME, storage, { now: () => NOW });
    expect((await entries(v2)).map((m) => m.id)).toEqual(['e1']);
  });
});

describe('merging two devices’ copies of a record', () => {
  const a: Stamped = { title: { v: 'Read ch. 4', stamp: st(1, 'a') }, due: { v: 'Mon', stamp: st(5, 'a') } };
  const b: Stamped = { title: { v: 'Read ch. 4–5', stamp: st(3, 'b') }, note: { v: 'bring book', stamp: st(2, 'b') } };

  it('keeps independent edits to different fields from both', () => {
    const { merged } = mergeFields(a, b);
    expect(Object.keys(merged).sort()).toEqual(['due', 'note', 'title']);
    expect(merged.due.v).toBe('Mon');
    expect(merged.note.v).toBe('bring book');
  });

  it('lets the later stamp win a contested field and reports what lost', () => {
    const { merged, conflicts } = mergeFields(a, b);
    expect(merged.title.v).toBe('Read ch. 4–5');
    expect(conflicts).toEqual([{ field: 'title', kept: 'Read ch. 4–5', dropped: 'Read ch. 4' }]);
  });

  it('is commutative and idempotent, so replays and reorderings converge', () => {
    expect(mergeFields(a, b).merged).toEqual(mergeFields(b, a).merged);
    const once = mergeFields(a, b).merged;
    expect(mergeFields(once, b).merged).toEqual(once);
    expect(mergeFields(once, once).merged).toEqual(once);
    expect(mergeFields(a, a).conflicts).toEqual([]);
  });

  it('is not fooled by a device whose wall clock is a day fast once the clocks have met', () => {
    // The fast device wrote first in real time but with a stamp a day ahead; the
    // slow device then received it and ticked, so its stamp is later and wins.
    const fast: Stamped = { title: { v: 'old', stamp: encode({ wall: NOW + 86_400_000, counter: 0, node: 'f' }) } };
    const slow: Stamped = { title: { v: 'new', stamp: encode({ wall: NOW + 86_400_000, counter: 1, node: 's' }) } };
    expect(mergeFields(fast, slow).merged.title.v).toBe('new');
  });
});
