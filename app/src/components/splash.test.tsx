// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { Splash } from './Splash';
import { forgetSplash } from '../lib/splash';

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

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
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
