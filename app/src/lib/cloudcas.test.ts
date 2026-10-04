import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Two devices, one account, and the push that used to win by arriving last.
 *
 * `push` was an upsert. The pull side merged field by field, but a merge only
 * helps a device that pulls before it pushes, and nothing made it: a laptop
 * left open overnight pushed its copy over the phone's morning, and the
 * phone's edits were gone from the account without a word. Now every write
 * names the `updated_at` it expects, and a write over a copy this device has
 * not read throws `Stale` instead of landing.
 *
 * `cloud.test.ts` fakes the database as a recorder, which is right for "what
 * was sent". This needs one that keeps rows and honours filters, because the
 * behaviour under test is a filter matching nothing. `updated_at` is stamped
 * here the way `touch_updated_at` stamps it — by the table, on every write,
 * from a clock no client holds.
 */

type Row = { user_id: string; id?: string; data: unknown; updated_at: string };

function makeDb() {
  const tables: Record<string, Row[]> = { state: [], courses: [] };
  // A refusal the next matching write returns, the way a CHECK constraint does.
  const refuse: { table?: string; op?: string; error?: { message: string; code: string } } = {};
  let tick = 0;
  const now = () => `2026-09-27T12:00:${String(++tick).padStart(2, '0')}.000000+00:00`;
  const key = (table: string, r: Partial<Row>) => (table === 'state' ? r.user_id : `${r.user_id}/${r.id}`);

  const from = (table: string) => {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: unknown = null;
    const filters: [string, unknown][] = [];
    const within: [string, unknown[]][] = [];
    let single = false;

    const matches = (r: Row) =>
      filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v) &&
      within.every(([c, vs]) => vs.includes((r as Record<string, unknown>)[c]));

    const run = () => {
      const rows = tables[table];
      if (refuse.error && refuse.table === table && refuse.op === op) return { data: null, error: refuse.error };
      if (op === 'insert') {
        const incoming = (Array.isArray(payload) ? payload : [payload]) as Row[];
        if (incoming.some((n) => rows.some((r) => key(table, r) === key(table, n)))) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
        }
        const made = incoming.map((n) => ({ ...n, updated_at: now() }));
        rows.push(...made);
        return { data: single ? made[0] : made, error: null };
      }
      if (op === 'update') {
        const hit = rows.filter(matches);
        for (const r of hit) Object.assign(r, payload, { updated_at: now() });
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter((r) => !matches(r));
        return { data: null, error: null };
      }
      const hit = rows.filter(matches).map((r) => ({ ...r }));
      return { data: single ? (hit[0] ?? null) : hit, error: null };
    };

    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: unknown) => ((op = 'insert'), (payload = p), b),
      update: (p: unknown) => ((op = 'update'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      eq: (c: string, v: unknown) => (filters.push([c, v]), b),
      in: (c: string, vs: unknown[]) => (within.push([c, vs]), b),
      maybeSingle: () => ((single = true), b),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return b;
  };

  return { tables, refuse, db: { from } };
}

let harness: ReturnType<typeof makeDb>;

async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_KEY', 'a-publishable-key');
  harness = makeDb();
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => harness.db }));
  return import('./cloud');
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://example.test' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock('@supabase/supabase-js');
});

const econ = (note: string) => ({ id: 'econ', data: { code: 'ECON', note } });
const stateData = () => harness.tables.state[0]?.data;
const courseData = (id: string) => harness.tables.courses.find((r) => r.id === id)?.data;

describe('a push over a copy this device has read', () => {
  it('lands, and reports the stamp the database wrote', async () => {
    const { push, pull } = await load();
    await push('u', { v: 1 }, [econ('first')]);
    const read = (await pull('u')).seen;
    const after = await push('u', { v: 2 }, [econ('second')], [], read);
    expect(stateData()).toEqual({ v: 2 });
    expect(courseData('econ')).toEqual({ code: 'ECON', note: 'second' });
    expect(after.state).not.toBe(read.state);
    expect(after.courses.econ).not.toBe(read.courses.econ);
  });

  it('can push again on the stamps its own push returned, without pulling', async () => {
    // The ordinary case — one device, editing — must not cost a pull a push.
    const { push } = await load();
    const first = await push('u', { v: 1 }, [econ('a')]);
    const second = await push('u', { v: 2 }, [econ('b')], [], first);
    await push('u', { v: 3 }, [econ('c')], [], second);
    expect(stateData()).toEqual({ v: 3 });
  });
});

describe('a push over a copy another device changed', () => {
  it('throws Stale and leaves the other device’s semester in the account', async () => {
    /*
     * The bug, as it happened. Both devices read the same copy; the phone
     * pushes first; the laptop, which never pulled, pushes second. It used to
     * win outright.
     */
    const { push, pull, isStale } = await load();
    await push('u', { v: 'start' }, [econ('start')]);
    const both = (await pull('u')).seen;

    await push('u', { v: 'phone' }, [econ('phone')], [], both);
    const laptop = push('u', { v: 'laptop' }, [econ('laptop')], [], both);

    await expect(laptop).rejects.toSatisfy(isStale);
    expect(stateData()).toEqual({ v: 'phone' });
    expect(courseData('econ')).toEqual({ code: 'ECON', note: 'phone' });
  });

  it('lands once the laptop has pulled — which is what the store does next', async () => {
    const { push, pull, isStale } = await load();
    await push('u', { v: 'start' }, [econ('start')]);
    const both = (await pull('u')).seen;
    await push('u', { v: 'phone' }, [econ('phone')], [], both);
    await expect(push('u', { v: 'laptop' }, [econ('laptop')], [], both)).rejects.toSatisfy(isStale);

    // Pull (the store merges here), then push the merge on the new stamps.
    const fresh = (await pull('u')).seen;
    await push('u', { v: 'merged' }, [econ('merged')], [], fresh);
    expect(stateData()).toEqual({ v: 'merged' });
  });

  it('is Stale on a single course moved on, even when the state row matches', async () => {
    const { push, pull, isStale } = await load();
    await push('u', {}, [econ('start')]);
    const read = (await pull('u')).seen;
    // Another device wrote the course and nothing else: its stamp moved on.
    harness.tables.courses[0].data = { code: 'ECON', note: 'elsewhere' };
    harness.tables.courses[0].updated_at = '2026-09-27T13:00:00.000000+00:00';
    await expect(push('u', {}, [econ('here')], [], read)).rejects.toSatisfy(isStale);
    expect(courseData('econ')).toEqual({ code: 'ECON', note: 'elsewhere' });
  });
});

describe('a push from a device that has read nothing', () => {
  it('inserts into an empty account', async () => {
    const { push } = await load();
    const seen = await push('u', { v: 1 }, [econ('a')], [], null);
    expect(stateData()).toEqual({ v: 1 });
    expect(Object.keys(seen.courses)).toEqual(['econ']);
  });

  it('is Stale when the account already has a semester, rather than replacing it', async () => {
    // The first-sign-in dialogue exists to ask about exactly this. A push that
    // slipped in before it was answered used to settle the question itself.
    const { push, isStale } = await load();
    await push('u', { v: 'account' }, [econ('account')]);
    await expect(push('u', { v: 'device' }, [], [], null)).rejects.toSatisfy(isStale);
    expect(stateData()).toEqual({ v: 'account' });
  });

  it('is Stale when a course it thinks is new is already there', async () => {
    const { push, pull, isStale } = await load();
    await push('u', {}, []);
    const read = (await pull('u')).seen; // the state row, no courses
    await push('u', {}, [econ('laptop')], [], read).catch(() => {});
    const phoneRead = { state: harness.tables.state[0].updated_at, courses: {} };
    await expect(push('u', {}, [econ('phone')], [], phoneRead)).rejects.toSatisfy(isStale);
    expect(courseData('econ')).toEqual({ code: 'ECON', note: 'laptop' });
  });
});

describe('what Stale is not', () => {
  it('is not an ordinary failure, so the sync line never reports it as one', async () => {
    const { Stale, isStale } = await load();
    expect(isStale(new Stale('x'))).toBe(true);
    expect(isStale(new Error('JWT expired'))).toBe(false);
    expect(isStale('Stale')).toBe(false);
  });
});

describe('a write the database refuses outright', () => {
  /*
   * The retry decision is `classify`'s, and it reads the code before the
   * words. A check violation's words match none of its fallbacks, so an Error
   * carrying only the message was INTERNAL_ERROR — retried every five minutes
   * against the same check, with a line saying it might recover by itself.
   */
  const check = { message: 'new row for relation "courses" violates check constraint "courses_data_size"', code: '23514' };

  it.each([
    ['updating the semester', 'state', 'update', true],
    ['inserting the first semester', 'state', 'insert', false],
    ['inserting a new course', 'courses', 'insert', true],
    ['updating a known course', 'courses', 'update', true],
  ] as const)('keeps the code when %s, so it is not retried', async (_, table, op, afterRead) => {
    const { push, pull, explainSync } = await load();
    const { retriesOnItsOwn } = await import('./syncstatus');
    let seen = null;
    if (afterRead) {
      await push('u', { v: 1 }, table === 'courses' && op === 'insert' ? [] : [econ('a')]);
      seen = (await pull('u')).seen;
    }
    Object.assign(harness.refuse, { table, op, error: check });
    const e = await push('u', { v: 2 }, [econ('b')], [], seen).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as { code?: string }).code).toBe('23514');
    const { code } = explainSync(e);
    expect(code).toBe('VALIDATION_ERROR');
    expect(retriesOnItsOwn(code)).toBe(false);
  });
});

describe('a push sends only the courses that changed', () => {
  /*
   * Every push used to rewrite every course, and on the load harness that
   * was where capacity gave first. A course the database already holds, at
   * the stamp this device names, is not sent. The stamp it had is the one it
   * keeps, in the table and in what the push returns.
   */
  const hist = (note: string) => ({ id: 'hist', data: { code: 'HIST', note } });
  const stampOf = (id: string) => harness.tables.courses.find((r) => r.id === id)?.updated_at;

  it('leaves an unchanged course unwritten and carries its stamp', async () => {
    const { push } = await load();
    const first = await push('u', { v: 1 }, [econ('a'), hist('a')]);
    const histAt = stampOf('hist');
    const second = await push('u', { v: 2 }, [econ('b'), hist('a')], [], first);
    expect(stampOf('hist')).toBe(histAt);
    expect(second.courses.hist).toBe(histAt);
    expect(courseData('econ')).toEqual({ code: 'ECON', note: 'b' });
    expect(second.courses.econ).not.toBe(first.courses.econ);
    // And the carried stamp is good for the push after: no insert, no Stale.
    await push('u', { v: 3 }, [econ('b'), hist('c')], [], second);
    expect(courseData('hist')).toEqual({ code: 'HIST', note: 'c' });
  });

  it('knows a pulled course as unchanged, whatever order jsonb kept its keys in', async () => {
    const { push, pull } = await load();
    await push('u', {}, [hist('a')]);
    // jsonb does not keep key order.
    harness.tables.courses[0].data = { note: 'a', code: 'HIST' };
    const read = (await pull('u')).seen;
    const at = stampOf('hist');
    await push('u', { v: 1 }, [hist('a')], [], read);
    expect(stampOf('hist')).toBe(at);
  });

  it('still writes a course that changed back to what it was', async () => {
    const { push } = await load();
    const one = await push('u', {}, [hist('a')]);
    const two = await push('u', {}, [hist('b')], [], one);
    await push('u', {}, [hist('a')], [], two);
    expect(courseData('hist')).toEqual({ code: 'HIST', note: 'a' });
  });

  it('writes an unchanged course again when the stamp it names is not the one it last confirmed', async () => {
    // A device holding stamps it did not get from this module (restored from
    // disk after a reload, say) cannot vouch that the row is unchanged, so the
    // compare-and-swap runs and says Stale if the row moved.
    const { push, isStale } = await load();
    const one = await push('u', {}, [hist('a')]);
    harness.tables.courses[0].data = { code: 'HIST', note: 'elsewhere' };
    harness.tables.courses[0].updated_at = '2026-09-27T13:00:00.000000+00:00';
    const fromDisk = { ...one, courses: { hist: '2026-09-27T12:59:00.000000+00:00' } };
    await expect(push('u', {}, [hist('a')], [], fromDisk)).rejects.toSatisfy(isStale);
    expect(courseData('hist')).toEqual({ code: 'HIST', note: 'elsewhere' });
  });

  it('loses nothing when another device changed the course it skips', async () => {
    // The skipped row is not written, and the state row, which every push
    // moves, refuses the push.
    const { push, isStale } = await load();
    const both = await push('u', { v: 'start' }, [hist('start')]);
    // The phone, a module this one never hears from, pushes both rows.
    harness.tables.state[0].data = { v: 'phone' };
    harness.tables.state[0].updated_at = '2026-09-27T13:00:00.000000+00:00';
    harness.tables.courses[0].data = { code: 'HIST', note: 'phone' };
    harness.tables.courses[0].updated_at = '2026-09-27T13:00:01.000000+00:00';
    await expect(push('u', { v: 'laptop' }, [hist('start')], [], both)).rejects.toSatisfy(isStale);
    expect(stateData()).toEqual({ v: 'phone' });
    expect(courseData('hist')).toEqual({ code: 'HIST', note: 'phone' });
  });
});

describe('while the engine owns this device’s tasks', () => {
  const owns = (on: boolean) =>
    vi.stubGlobal('localStorage', { getItem: (k: string) => (on && k === 'semester.engine.tasks' ? 'on' : null), setItem() {}, removeItem() {} });

  it('does not read the account’s old copy of them back, and still sends this device’s', async () => {
    vi.stubEnv('VITE_OFFLINE_ENGINE_TASKS', 'production');
    const { push, pull } = await load();
    owns(true);
    await push('u', { v: 1, tasks: [{ id: 'T1', title: 'mine' }] }, []);
    // What is stored carries them — a device that has not opted in keeps receiving them.
    expect(stateData()).toEqual({ v: 1, tasks: [{ id: 'T1', title: 'mine' }] });
    // What is read back does not: another device's stale mirror must not resurrect what the engine deleted.
    expect((await pull('u')).state).toEqual({ v: 1 });
  });

  it('reads them as ever when the build\'s module flag is off, even on a device that opted in', async () => {
    const { push, pull } = await load();
    owns(true);
    await push('u', { v: 1, tasks: [{ id: 'T1', title: 'mine' }] }, []);
    expect((await pull('u')).state).toEqual({ v: 1, tasks: [{ id: 'T1', title: 'mine' }] });
  });

  it('reads them as ever with the device switch off', async () => {
    vi.stubEnv('VITE_OFFLINE_ENGINE_TASKS', 'production');
    const { push, pull } = await load();
    owns(false);
    await push('u', { v: 1, tasks: [{ id: 'T1', title: 'mine' }] }, []);
    expect((await pull('u')).state).toEqual({ v: 1, tasks: [{ id: 'T1', title: 'mine' }] });
  });
});
