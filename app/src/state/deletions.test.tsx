// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import type { CourseModule } from '../lib/types';

/**
 * Deleting something, going offline, and coming back — end to end.
 *
 * The union merge cannot express a deletion, so a note deleted on one device
 * came back from the other every time, and a course deleted offline came back
 * if the app was closed first (`lib/resurrect.test.ts` set the fault out). The
 * base both sides last agreed on tells a deletion from a record never had
 * (`lib/deletions.ts`); these run the real store against a mocked account.
 *
 * Each scenario has a control: the same setup without the base, which is the
 * old behaviour, so a passing test cannot be a setup that never resurrected.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

const pull = vi.fn();
const push = vi.fn();

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) => (s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null),
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: () => false,
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));

// The connection, held by the test: airplane mode is a switch, not a timeout.
const net = { off: false, listeners: new Set<(online: boolean) => void>() };
vi.mock('../lib/offline', async (original) => ({
  ...(await original<typeof import('../lib/offline')>()),
  offline: () => net.off,
  watchConnection: (cb: (online: boolean) => void) => {
    net.listeners.add(cb);
    return () => net.listeners.delete(cb);
  },
}));
const airplane = async (on: boolean) => {
  net.off = on;
  await act(async () => net.listeners.forEach((cb) => cb(!on)));
};

const { StoreProvider, useStore } = await import('./store');
const { Review } = await import('../components/Review');
const { baseOf, BASE_KEY, REVIEW_KEY } = await import('../lib/conflicts');
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

const note = (id: string, body = id, updated = 100) => ({ id, title: `Note ${id}`, body, created: 1, updated, courseId: null, fileIds: [] });
const course = (id: string): CourseModule => ({
  course: { id, code: `${id.toUpperCase()} 1010`, name: `Course ${id}`, prof: '', email: '', meets: '', room: '', credits: '', source: '', grading: [] },
  items: [],
  schedule: [],
  guide: { code: `${id.toUpperCase()} 1010`, name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
});

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

/**
 * A device that last agreed with the account on `agreed`, holds `here` now,
 * and finds the account holding `there`. Courses are their own rows.
 */
function device(o: {
  agreed: { notes?: unknown[]; courses?: CourseModule[] };
  here: { notes?: unknown[]; courses?: CourseModule[] };
  there: { notes?: unknown[]; courses?: CourseModule[] };
  base?: boolean;
}) {
  localStorage.setItem(
    'semester.v1',
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, sample: false, notes: o.here.notes ?? [], courses: o.here.courses ?? [] }),
  );
  localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: Object.fromEntries((o.agreed.courses ?? []).map((c) => [c.course.id, 't0'])) }));
  if (o.base !== false) localStorage.setItem(BASE_KEY, JSON.stringify(baseOf({ notes: o.agreed.notes ?? [], courses: o.agreed.courses ?? [] })));
  pull.mockResolvedValue({
    state: { notes: o.there.notes ?? [] },
    courses: (o.there.courses ?? []).map((c) => ({ id: c.course.id, data: c })),
    updated: 0,
    seen: { state: 's1', courses: Object.fromEntries((o.there.courses ?? []).map((c) => [c.course.id, 't1'])) },
  });
}

const ids = () => store.state.notes.map((n) => n.id).sort();
const courseIds = () => store.state.courses.map((c) => c.course.id).sort();
const lastPush = () => push.mock.calls.at(-1) as [string, { notes: { id: string }[] }, { id: string }[], string[]];

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.clear();
  net.off = false;
  net.listeners.clear();
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

describe('a note deleted here', () => {
  const both = [note('n1'), note('n2')];

  it('stays deleted when the app is closed and opened again, and the account is told', async () => {
    // Deleted offline and saved; the account still holds both, unchanged.
    device({ agreed: { notes: both }, here: { notes: [note('n2')] }, there: { notes: both } });
    await mount();
    expect(ids()).toEqual(['n2']);
    expect(lastPush()[1].notes.map((n) => n.id)).toEqual(['n2']);
    expect(store.review).toEqual([]);
  });

  it('control: with no base it comes back, which is what happened before', async () => {
    device({ agreed: { notes: both }, here: { notes: [note('n2')] }, there: { notes: both }, base: false });
    await mount();
    expect(ids()).toEqual(['n1', 'n2']);
  });

  it('stays deleted through airplane mode: delete offline, reconnect, and it does not return', async () => {
    device({ agreed: { notes: both }, here: { notes: both }, there: { notes: both } });
    await mount();
    expect(ids()).toEqual(['n1', 'n2']);

    await airplane(true);
    await act(async () => store.dispatch({ type: 'deleteNote', id: 'n1' }));
    await wait(3_000);
    expect(ids()).toEqual(['n2']);
    expect(store.sync.status).toBe('queued'); // waiting, and says so
    const pushesOffline = push.mock.calls.length;

    await airplane(false);
    await wait(4_000);
    expect(ids()).toEqual(['n2']); // the account still held it; it did not come back
    expect(push.mock.calls.length).toBeGreaterThan(pushesOffline);
    expect(lastPush()[1].notes.map((n) => n.id)).toEqual(['n2']);
  });

  it('survives a connection that comes and goes', async () => {
    device({ agreed: { notes: both }, here: { notes: both }, there: { notes: both } });
    await mount();
    await act(async () => store.dispatch({ type: 'deleteNote', id: 'n1' }));
    for (let i = 0; i < 4; i++) {
      await airplane(true);
      await wait(500);
      await airplane(false);
      await wait(1_500);
      expect(ids(), `after flap ${i + 1}`).toEqual(['n2']);
    }
    await wait(4_000);
    expect(lastPush()[1].notes.map((n) => n.id)).toEqual(['n2']);
  });
});

describe('a note another device deleted', () => {
  it('goes from here too, when nothing here changed it', async () => {
    const both = [note('n1'), note('n2')];
    device({ agreed: { notes: both }, here: { notes: both }, there: { notes: [note('n2')] } });
    await mount();
    expect(ids()).toEqual(['n2']);
    expect(store.review).toEqual([]);
  });
});

describe('a deletion against an edit', () => {
  const agreed = [note('n1', 'as synced', 100), note('n2')];

  it('deleted here, edited there: the edit is in use, nothing is lost, and the student is asked', async () => {
    device({ agreed: { notes: agreed }, here: { notes: [note('n2')] }, there: { notes: [note('n1', 'rewritten on the laptop', 300), note('n2')] } });
    await mount();
    expect(ids()).toEqual(['n1', 'n2']);
    expect(store.state.notes.find((n) => n.id === 'n1')!.body).toBe('rewritten on the laptop');
    expect(store.review).toHaveLength(1);
    expect(store.review[0]).toMatchObject({ key: 'notes/n1', mine: null, kept: 'theirs' });
    expect(store.sync.status).toBe('review');
    expect(localStorage.getItem(REVIEW_KEY)).not.toBeNull();
    expect(host.textContent).toMatch(/Deleted on this device, changed on the other\./);
    expect(host.querySelector('button[aria-label="Keep Note n1 deleted"]')).toBeTruthy();
  });

  it('keeping it deleted deletes it, and the push says so', async () => {
    device({ agreed: { notes: agreed }, here: { notes: [note('n2')] }, there: { notes: [note('n1', 'rewritten', 300), note('n2')] } });
    await mount();
    const keep = host.querySelector('button[aria-label="Keep Note n1 deleted"]') as HTMLButtonElement;
    await act(async () => keep.click());
    expect(ids()).toEqual(['n2']);
    expect(store.review).toEqual([]);
    await wait(3_000);
    expect(lastPush()[1].notes.map((n) => n.id)).toEqual(['n2']);
  });

  it('keeping the edit only clears the question, and the note stays', async () => {
    device({ agreed: { notes: agreed }, here: { notes: [note('n2')] }, there: { notes: [note('n1', 'rewritten', 300), note('n2')] } });
    await mount();
    expect(store.review).toHaveLength(1); // there was a question to clear
    await act(async () => store.resolve('notes/n1', 'theirs'));
    expect(ids()).toEqual(['n1', 'n2']);
    expect(store.review).toEqual([]);
  });

  it('deleted there, edited here: the edit is in use, and it is offered', async () => {
    device({ agreed: { notes: agreed }, here: { notes: [note('n1', 'my edit', 300), note('n2')] }, there: { notes: [note('n2')] } });
    await mount();
    expect(ids()).toEqual(['n1', 'n2']);
    expect(store.review[0]).toMatchObject({ key: 'notes/n1', theirs: null, kept: 'mine' });
    expect(host.textContent).toMatch(/Deleted on the other device, changed on this one\./);
    const keep = host.querySelector('button[aria-label="Keep Note n1 deleted"]') as HTMLButtonElement;
    await act(async () => keep.click());
    expect(ids()).toEqual(['n2']);
  });
});

describe('a course deleted offline', () => {
  const econ = course('econ');
  const rest = ['bus', 'law', 'art', 'cs', 'bio'].map(course);

  it('is still deleted after the app is closed, and the account is told to delete it', async () => {
    // What `removedCourses` lost when the app closed: only the base remembers.
    device({ agreed: { courses: [econ, ...rest] }, here: { courses: rest }, there: { courses: [econ, ...rest] } });
    await mount();
    expect(courseIds()).toEqual(['art', 'bio', 'bus', 'cs', 'law']);
    expect(lastPush()[3]).toEqual(['econ']);
  });

  it('control: with no base it comes back from the account', async () => {
    device({ agreed: { courses: [econ, ...rest] }, here: { courses: rest }, there: { courses: [econ, ...rest] }, base: false });
    await mount();
    expect(courseIds()).toContain('econ');
  });
});

describe('a removal too large to believe', () => {
  it('is not spread: the rows come back instead of being deleted from the account', async () => {
    const many = Array.from({ length: 8 }, (_, i) => note(`n${i}`));
    // What an app that dropped rows on load looks like from the outside.
    device({ agreed: { notes: many }, here: { notes: [] }, there: { notes: many } });
    await mount();
    expect(ids()).toHaveLength(8);
  });
});
