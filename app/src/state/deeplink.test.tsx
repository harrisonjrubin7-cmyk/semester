// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from './store';
import { STORAGE_KEY } from './shape';
import { loadSeed } from '../data/seed';

/*
 * The sample, refusable on demand.
 *
 * `loadSeed` rejects for two honest reasons — no connection, or a deploy since
 * this copy opened — and the wait added to the settling effect has to end on
 * those too, or a student offline opens the app to a course screen drawing
 * nothing and no way out of it. Delegating to the real module by default keeps
 * every other test in this file testing the real fetch.
 */
const offline = vi.hoisted(() => ({ now: false }));
vi.mock('../data/seed', async (real) => {
  const actual = await real<typeof import('../data/seed')>();
  return {
    ...actual,
    loadSeed: () => (offline.now ? Promise.reject(new Error('offline')) : actual.loadSeed()),
  };
});
import type { CourseModule } from '../lib/types';

/**
 * A link to a course, opened cold.
 *
 * `#/course/bus` is BUS 1600's own address. Clicking into it from the Courses
 * list showed the course; opening that same URL in a new tab, or refreshing on
 * it, showed a different course entirely — an account's own, empty one, with
 * no error and nothing to say what had happened. Measured, twice out of twice,
 * against an account holding one hand-made course with the sample switched on.
 *
 * The race is between two things in `store.tsx` that both run on mount. The
 * sample semester is four dynamic imports and it is deliberately not awaited,
 * so for the first microtask `allModules` is the account's own courses alone.
 * The effect that keeps the open-course pointer inside the catalogue runs in
 * that window, does not find `bus` — it has not arrived yet — and rewrites the
 * pointer to the first course there is. The sample lands a moment later with
 * `bus` in it, and by then nothing is pointing at it.
 *
 * So the pointer is only settled once the answer is known. The control below
 * is the reason this is a wait rather than a removal: an id that names nothing
 * *after* the sample has landed must still settle, or a stale link would leave
 * the course screen drawing nothing at all.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One course of the student's own — the thing that makes the catalogue non-empty. */
const OWN: CourseModule = {
  course: {
    id: 'test',
    code: 'TEST 1010',
    name: 'A course added by hand',
    prof: '',
    email: '',
    meets: '',
    room: '',
    credits: '',
    source: '',
    grading: [],
  },
  items: [],
  schedule: [],
  guide: { code: 'TEST 1010', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
};

let host: HTMLDivElement;
let root: Root;

function Open() {
  const { state } = useStore();
  return <span data-course={state.courseId} data-guide={state.guideId} />;
}

/** Mount the app's store, and let the sample it starts fetching land. */
async function land() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Open />
      </StoreProvider>,
    );
  });
  // A second flush: the sample resolves in a microtask, and the re-render it
  // causes runs the effect that would settle the pointer.
  await act(async () => {});
}

const open = () => host.querySelector('span')?.getAttribute('data-course');
const studying = () => host.querySelector('span')?.getAttribute('data-guide');

/*
 * The sample, awaited once. `loadSeed` caches its promise, so the store's own
 * call is already resolved when it makes it — see `src/seedawait.test.ts`.
 */
beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  offline.now = false;
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    // `sample` explicitly: an account that has saved a course of its own would
    // otherwise be migrated to sample-off, and this bug needs both.
    JSON.stringify({ seenOnboarding: true, sample: true, courses: [OWN] }),
  );
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  history.replaceState(null, '', '/');
});

describe('a course opened by its own URL', () => {
  it('is the course the URL names, not the first one to hand', async () => {
    history.replaceState(null, '', '/#/course/bus');
    await land();
    expect(open()).toBe('bus');
    // And the address still says so: a pointer rewritten here is written back
    // into the hash, so a wrong answer changes the URL under the bookmark too.
    expect(window.location.hash).toBe('#/course/bus');
  });

  it('holds for a study link the same way', async () => {
    // `#/guide/<id>` names the course being studied rather than the one being
    // read, and it is the same pointer, settled by the same effect.
    history.replaceState(null, '', '/#/guide/psci');
    await land();
    expect(studying()).toBe('psci');
  });

  it('still settles an id that names nothing once the sample has landed', async () => {
    // The control. If the fix were "stop settling" rather than "settle when
    // the answer is known", this would come back pointing at a course that
    // does not exist and the course screen would draw nothing.
    history.replaceState(null, '', '/#/course/nosuchcourse');
    await land();
    expect(open()).not.toBe('nosuchcourse');
    expect(open()).toBeTruthy();
    expect(studying()).toBeTruthy();
  });

  it('settles rather than waits forever when the sample never arrives', async () => {
    // The other control. The wait is on an answer, not on an arrival: a
    // rejected fetch answers "never", and a pointer left aimed at a course
    // that is not coming draws an empty screen for the rest of the session.
    offline.now = true;
    history.replaceState(null, '', '/#/course/bus');
    await land();
    expect(open()).toBe('test');
    expect(studying()).toBe('test');
  });
});
