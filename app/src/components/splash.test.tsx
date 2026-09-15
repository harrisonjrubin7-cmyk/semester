// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { Splash } from './Splash';
import { forgetSplash } from '../lib/splash';
import { loadSeed } from '../data/seed';

/**
 * The opening screen, and the one thing it must never do: stay.
 *
 * A curtain that does not lift is worse than no curtain at all — the app is
 * behind it, running, and unreachable. This is not hypothetical: the first
 * version of `Splash.tsx` did exactly that, and every check passed. It
 * typechecked, it linted, the suite was green, and a screenshot of the first
 * second looked right. What was wrong only showed up in the second second,
 * because the effect that lifts the curtain read the module flag it sets, so
 * setting it changed the effect's own dependency, the effect re-ran, took its
 * early return, and cleared the two timers it had just scheduled.
 *
 * So the timers are what is tested here, with the clock driven by hand. The
 * three cases are the three ways this can be wrong: it never leaves, it plays
 * twice in one launch, or it covers the one screen it must not.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/** Render the tree — again, on a second call, exactly as the app re-renders. */
function mount() {
  act(() => {
    root.render(
      <StoreProvider>
        <Splash />
      </StoreProvider>,
    );
  });
}

const curtain = () => host.querySelector('.splash');

/*
 * The sample semester, fetched before anything renders.
 *
 * `StoreProvider` pulls the four shipped courses in with a dynamic import and
 * does not await it — right in an app, where the screen fills in when they
 * land. In a test it is a promise still in flight when the file ends, and
 * Vitest tears the environment down underneath it: every assertion passes and
 * the run still exits non-zero on `EnvironmentTeardownError`, attributed to
 * whichever file happened to be running when it landed rather than to this
 * one. Intermittently, which is the worst version of it.
 *
 * `loadSeed` caches its promise, so awaiting it once here means the store's
 * own call is already resolved by the time it makes it, and there is nothing
 * outstanding to tear down. The same call `screens/deadends.test.tsx` makes,
 * for the same reason; `src/seedawait.test.ts` is why neither can be dropped.
 */
beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  /*
   * And the address, which is the third thing a launch depends on.
   *
   * `store.tsx` reads `screenFromUrl() ?? firstScreen(nav)`, and the URL wins —
   * deliberately, because that is how a deep link and a notification tap open
   * the screen they name. It also writes the current screen back into the hash.
   * So the test below that mounts on onboarding leaves `#/onboarding` in the
   * address bar, and the next test's store reads it and starts there however
   * clean its storage is. The splash then correctly declines to cover
   * onboarding and draws nothing, and a test about the curtain fails with no
   * curtain and nothing wrong.
   *
   * It passed on the order the tests happened to run in and failed under
   * `--sequence.shuffle`, which is the only reason it was ever visible.
   * `replaceState` rather than `location.hash = ''`, which leaves a bare `#`
   * behind and fires a `hashchange` at a store that is listening for one.
   */
  history.replaceState(null, '', '/');
  // A new launch: what the module flag means is "this page load", and each
  // test is a page load. See `lib/splash.ts`.
  forgetSplash();
  // Past onboarding, which is the state every launch after the first is in.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenOnboarding: true }));
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('the opening screen', () => {
  it('says the name and then gets out of the way on its own', () => {
    mount();

    expect(curtain()).not.toBeNull();
    expect(host.textContent).toContain('Semester');

    /*
     * A re-render, while the curtain is still up.
     *
     * This is the line that catches the bug in the note at the top, and it is
     * here because nothing else in this file did: the app re-renders
     * constantly during its first second — the store finishes loading, a sync
     * lands, the clock ticks — and the broken version only stuck once
     * something re-rendered it after its effect had recorded the launch.
     * Mounted once and left alone, it lifted perfectly.
     */
    act(() => {
      vi.advanceTimersByTime(100);
    });
    mount();

    // Long enough for the hold and the fade both, and then some: whatever the
    // two timings are, by here the app must be reachable.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(curtain()).toBeNull();
  });

  it('plays once a launch, not once a render', () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(curtain()).toBeNull();

    // Mounted again inside the same launch — a re-render, a hot reload, a
    // StrictMode second mount. Any of those replaying the welcome would be the
    // app stuttering rather than opening.
    mount();
    expect(curtain()).toBeNull();
  });

  it('does not cover onboarding, which opens on the same name', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenOnboarding: false }));
    mount();
    expect(curtain()).toBeNull();
  });
});
