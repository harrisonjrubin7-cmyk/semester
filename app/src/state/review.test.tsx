// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * A note rewritten on two devices before either synced, end to end.
 *
 * The pull brings the other device's version; the merge keeps the later one,
 * as it always has; and now the one it did not keep is on the review list,
 * the sync line says so, and the student can choose it — which puts it back
 * and sends it up.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

const pull = vi.fn();
const push = vi.fn();

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: () => false,
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));

const { StoreProvider, useStore } = await import('./store');
const { Review } = await import('../components/Review');
const { baseOf, BASE_KEY, REVIEW_KEY, fingerprint } = await import('../lib/conflicts');
const { SEEN_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;

function Peek() {
  const seen = useStore();
  useEffect(() => {
    store = seen;
  });
  return null;
}

const note = (body: string, updated: number) => ({
  id: 'n1',
  title: 'Week 6 notes',
  body,
  created: 1,
  updated,
  courseId: null,
  fileIds: [],
});

const agreed = note('as synced', 100);

async function wait(ms: number) {
  for (let t = 0; t < ms; t += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Peek />
        <Review />
      </StoreProvider>,
    );
  });
  await wait(3_000);
}

/** This device holds `mine`; the account holds `theirs`; both last agreed on `agreed`. */
function devices(mine: ReturnType<typeof note>, theirs: ReturnType<typeof note>) {
  localStorage.setItem(
    'semester.v1',
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, notes: [mine] }),
  );
  localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: {} }));
  localStorage.setItem(BASE_KEY, JSON.stringify(baseOf({ notes: [agreed] })));
  pull.mockResolvedValue({ state: { notes: [theirs] }, courses: [], updated: 0, seen: { state: 's1', courses: {} } });
}

const bodies = () => store.state.notes.filter((n) => n.id === 'n1').map((n) => n.body);

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.clear();
  pull.mockReset();
  push.mockReset();
  let n = 1;
  push.mockImplementation(async () => ({ state: `s${++n}`, courses: {} }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  localStorage.clear();
});

describe('a note edited on both devices', () => {
  it('keeps the later one in use, and puts the other on the review list', async () => {
    devices(note('on the bus', 200), note('in the library', 300));
    await mount();
    expect(bodies()).toEqual(['in the library']);
    expect(store.review).toHaveLength(1);
    expect(store.review[0]).toMatchObject({ key: 'notes/n1', kept: 'theirs' });
    expect(store.sync.status).toBe('review');
    expect(localStorage.getItem(REVIEW_KEY)).not.toBeNull();
    expect(host.textContent).toMatch(/Choose a version/);
    expect(host.textContent).toMatch(/on the bus/);
    expect(host.textContent).toMatch(/in the library/);
  });

  it('puts the chosen one back, stamped now, and sends it up', async () => {
    devices(note('on the bus', 200), note('in the library', 300));
    await mount();
    const before = push.mock.calls.length;
    const keep = host.querySelector('button[aria-label="Keep the this device version of Week 6 notes"]') as HTMLButtonElement;
    expect(keep, 'no Keep button for this device').toBeTruthy();
    await act(async () => keep.click());

    expect(bodies()).toEqual(['on the bus']);
    expect(store.state.notes.find((n) => n.id === 'n1')!.updated).toBeGreaterThan(300);
    expect(store.review).toEqual([]);
    expect(localStorage.getItem(REVIEW_KEY)).toBeNull();
    expect(store.sync.status).not.toBe('review');

    await wait(3_000);
    expect(push.mock.calls.length).toBe(before + 1);
    const sent = push.mock.calls.at(-1)![1] as { notes: { id: string; body: string }[] };
    expect(sent.notes.find((n) => n.id === 'n1')!.body).toBe('on the bus');
  });

  it('only clears the question when the one in use is kept', async () => {
    devices(note('on the bus', 200), note('in the library', 300));
    await mount();
    await act(async () => store.resolve('notes/n1', 'theirs'));
    expect(bodies()).toEqual(['in the library']);
    expect(store.review).toEqual([]);
  });
});

describe('the control', () => {
  it('asks nothing when only the other device edited it', async () => {
    devices(agreed, note('in the library', 300));
    await mount();
    expect(bodies()).toEqual(['in the library']);
    expect(store.review).toEqual([]);
    expect(store.sync.status).toBe('synced');
  });
});

describe('the version both sides agreed on', () => {
  // What every later comparison is made against. Checked at both moments it
  // moves, separately, so losing either write fails here rather than as
  // conflicts that start appearing weeks later for edits nobody made twice.
  const agreedOn = (id: string) => (JSON.parse(localStorage.getItem(BASE_KEY)!) as Record<string, string>)[id];

  it("moves to the account's copy after a pull, and to what was sent after a push", async () => {
    devices(agreed, note('in the library', 300));
    await act(async () => {
      root.render(
        <StoreProvider>
          <Peek />
        </StoreProvider>,
      );
    });
    await wait(1_000); // pulled, not yet pushed
    expect(agreedOn('notes/n1')).toBe(fingerprint(note('in the library', 300)));

    await act(async () => {
      store.dispatch({ type: 'restoreRecord', field: 'notes', record: note('edited here', 400) });
    });
    await wait(4_000); // pushed
    const sent = (push.mock.calls.at(-1)![1] as { notes: unknown[] }).notes.find(
      (n) => (n as { id: string }).id === 'n1',
    );
    expect(agreedOn('notes/n1')).toBe(fingerprint(sent));
  });
});

describe('a setting', () => {
  /** This device's look, the account's, and the look both last agreed on. */
  function looks(mine: Record<string, unknown>, theirs: Record<string, unknown>, agreedLook: Record<string, unknown>) {
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, ...mine }),
    );
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: {} }));
    localStorage.setItem(BASE_KEY, JSON.stringify(baseOf(agreedLook)));
    pull.mockResolvedValue({ state: theirs, courses: [], updated: 0, seen: { state: 's1', courses: {} } });
  }

  it('changed on both devices is offered, and keeping this one puts it back and sends it up', async () => {
    looks({ ground: 'paper' }, { ground: 'fog' }, { ground: 'ink' });
    await mount();
    // The merge took the account's, as `theirs` always has.
    expect(store.state.ground).toBe('fog');
    expect(store.review.map((c) => c.key)).toEqual(['settings/ground']);
    expect(store.sync.status).toBe('review');

    const before = push.mock.calls.length;
    await act(async () => store.resolve('settings/ground', 'mine'));
    expect(store.state.ground).toBe('paper');
    expect(store.review).toEqual([]);
    await wait(3_000);
    expect(push.mock.calls.length).toBe(before + 1);
    expect((push.mock.calls.at(-1)![1] as { ground: string }).ground).toBe('paper');
  });

  it('changed only here survives a pull, rather than being put back to the account’s older value', async () => {
    // The bug `keptHere` fixes: this device changed the ground and had not
    // pushed yet; the account still holds the agreed one. A pull used to
    // take the account's, and the change was gone.
    looks({ ground: 'paper' }, { ground: 'ink' }, { ground: 'ink' });
    await mount();
    expect(store.state.ground).toBe('paper');
    expect(store.review).toEqual([]);
  });

  it('changed only there is taken, as before — the control', async () => {
    looks({ ground: 'ink' }, { ground: 'fog' }, { ground: 'ink' });
    await mount();
    expect(store.state.ground).toBe('fog');
    expect(store.review).toEqual([]);
  });
});

describe('a per-key map', () => {
  function grades(mine: Record<string, string>, theirs: Record<string, string>, agreedGrades: Record<string, string>) {
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, grades: mine }),
    );
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: {} }));
    localStorage.setItem(BASE_KEY, JSON.stringify(baseOf({ grades: agreedGrades })));
    pull.mockResolvedValue({ state: { grades: theirs }, courses: [], updated: 0, seen: { state: 's1', courses: {} } });
  }

  it('a grade entered differently on both devices is offered, and keeping this one sends it up', async () => {
    grades({ econ: 'B+' }, { econ: 'A-' }, { econ: 'B' });
    await mount();
    expect(store.state.grades.econ).toBe('A-');
    expect(store.review.map((c) => c.key)).toEqual(['ticks/grades/econ']);
    const before = push.mock.calls.length;
    await act(async () => store.resolve('ticks/grades/econ', 'mine'));
    expect(store.state.grades.econ).toBe('B+');
    expect(store.review).toEqual([]);
    await wait(3_000);
    expect(push.mock.calls.length).toBe(before + 1);
    expect((push.mock.calls.at(-1)![1] as { grades: Record<string, string> }).grades.econ).toBe('B+');
  });

  it('a grade changed only here survives a pull', async () => {
    grades({ econ: 'B+' }, { econ: 'B' }, { econ: 'B' });
    await mount();
    expect(store.state.grades.econ).toBe('B+');
    expect(store.review).toEqual([]);
  });

  it('a grade changed only there is taken — the control', async () => {
    grades({ econ: 'B' }, { econ: 'A-' }, { econ: 'B' });
    await mount();
    expect(store.state.grades.econ).toBe('A-');
    expect(store.review).toEqual([]);
  });
});

describe('a key removed on the other device', () => {
  function devicesWith(mine: Record<string, string>, theirs: Record<string, string>, agreedGrades: Record<string, string>) {
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, grades: mine }),
    );
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: {} }));
    localStorage.setItem(BASE_KEY, JSON.stringify(baseOf({ grades: agreedGrades })));
    pull.mockResolvedValue({ state: { grades: theirs }, courses: [], updated: 0, seen: { state: 's1', courses: {} } });
  }

  it('goes here too, and the push after it does not bring it back', async () => {
    devicesWith({ econ: 'B', psci: 'A' }, { psci: 'A' }, { econ: 'B', psci: 'A' });
    await mount();
    expect(store.state.grades).toEqual({ psci: 'A' });
    expect(store.review).toEqual([]);
    await wait(3_000);
    const sent = (push.mock.calls.at(-1)![1] as { grades: Record<string, string> }).grades;
    expect(sent).toEqual({ psci: 'A' });
  });

  it('a key added here and not yet pushed stays — the control', async () => {
    devicesWith({ econ: 'B', hist: 'C' }, { econ: 'B' }, { econ: 'B' });
    await mount();
    expect(store.state.grades).toEqual({ econ: 'B', hist: 'C' });
  });

  it('removed there and changed here is offered, and keeping theirs removes it', async () => {
    devicesWith({ econ: 'B+' }, {}, { econ: 'B' });
    await mount();
    expect(store.state.grades.econ).toBe('B+');
    expect(store.review.map((c) => c.key)).toEqual(['ticks/grades/econ']);
    await act(async () => store.resolve('ticks/grades/econ', 'theirs'));
    expect('econ' in store.state.grades).toBe(false);
  });
});
