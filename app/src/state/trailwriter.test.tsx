// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from './store';
import { STORAGE_KEY } from './shape';
import { loadSeed } from '../data/seed';
import { forgetTrail, trail } from '../lib/trail.hook';
import type { Visit } from '../lib/trail';
import type { Screen, StudyMode } from '../lib/types';

/**
 * That the record is actually written when the app moves.
 *
 * `lib/trail.test.ts` holds what the record does with a visit and
 * `lib/trail.hook.test.ts` holds it reaching the device. Neither of them would
 * notice the thing most likely to go wrong: a correct record that nothing ever
 * calls. The writer is a single effect in `store.tsx`, beside the one that puts
 * the address in the bar, and it is one deleted line away from a history that
 * is permanently empty and passes two hundred tests.
 *
 * So this navigates the real store and reads the real trail.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let go: (screen: Screen) => Promise<void>;
let open: (id: string) => Promise<void>;
let study: (id: string, mode: StudyMode) => Promise<void>;

/*
 * The three navigations, handed out in an effect rather than during render.
 *
 * Writing to a module variable while rendering is a side effect in render, and
 * the lint rule that says so is right: it would run again on every re-render
 * this store causes, which on mount is several. An effect runs once the store
 * is up, which is also the only moment these are wanted.
 */
function Drive() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    go = async (screen) => {
      await act(async () => dispatch({ type: 'go', screen }));
    };
    open = async (id) => {
      await act(async () => dispatch({ type: 'openCourse', id }));
    };
    study = async (id, mode) => {
      await act(async () => dispatch({ type: 'openGuide', id }));
      await act(async () => dispatch({ type: 'setMode', mode }));
    };
  }, [dispatch]);
  return <span data-screen={state.screen} />;
}

const places = (list: Visit[]) => list.map((v) => `${v.screen}${v.id ? `/${v.id}` : ''}`);

const mount = async () => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Drive />
      </StoreProvider>,
    );
  });
  await act(async () => {});
};

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  forgetTrail();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenOnboarding: true, sample: true }));
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  forgetTrail();
  history.replaceState(null, '', '/');
});

describe('the app moving, and the record of it', () => {
  it('records where the app landed on the way in', async () => {
    await mount();
    expect(places(trail()).length).toBeGreaterThan(0);
  });

  it('records each screen navigated to, newest first', async () => {
    await mount();
    await go('calendar');
    await go('courses');
    expect(places(trail()).slice(0, 2)).toEqual(['courses', 'calendar']);
  });

  /*
   * The half `state.recent` cannot do. It keeps twelve screen ids and no
   * entity ids, so every course anybody ever opened is one row called
   * "course" — which is the reason this record exists rather than a bigger cap
   * on that one.
   */
  it('records which course, not merely that a course was opened', async () => {
    await mount();
    await open('econ');
    const top = trail()[0];
    expect(top.screen).toBe('course');
    expect(top.id).toBe('econ');
  });

  it('gives two courses two rows', async () => {
    await mount();
    await open('econ');
    await open('bus');
    expect(places(trail()).slice(0, 2)).toEqual(['course/bus', 'course/econ']);
  });

  it('moves a screen you come back to rather than repeating it', async () => {
    await mount();
    await go('calendar');
    await go('courses');
    await go('calendar');
    const drawn = places(trail());
    expect(drawn[0]).toBe('calendar');
    expect(drawn.filter((p) => p === 'calendar')).toHaveLength(1);
  });

  it('stamps a time that is a time', async () => {
    const before = Date.now();
    await mount();
    await go('calendar');
    const top = trail()[0];
    expect(top.at).toBeGreaterThanOrEqual(before);
    expect(top.at).toBeLessThanOrEqual(Date.now());
  });

  /*
   * The claim the store's comment makes beside the writer, which nothing else
   * holds: reading a guide as slides is the same place read differently — the
   * reason `replaces` exists in `lib/route.ts` — so the mode is not part of
   * what is recorded. Without this, one course guide is four rows.
   */
  it('gives one guide one row however it is being read', async () => {
    await mount();
    await study('econ', 'read');
    await study('econ', 'slides');
    await study('econ', 'quiz');
    expect(places(trail()).filter((p) => p.startsWith('guide/'))).toEqual(['guide/econ']);
  });

  /*
   * Master spec 162, from the outside. Whatever the app knows about a course —
   * its code, its name, its readings — none of it is in the record; only the
   * id the address already carries.
   */
  it('writes nothing but the place and the time', async () => {
    await mount();
    await open('econ');
    expect(Object.keys(trail()[0]).sort()).toEqual(['at', 'id', 'screen']);
  });
});
