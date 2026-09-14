// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it } from 'vitest';
import { AIProvider } from '../ai/store';
import { StoreProvider, useStore } from '../state/store';
import { loadSeed } from '../data/seed';
import { GoogleShell } from './GoogleShell';
import { TabsFollow } from './Tabs';
import { forgetStrip, here, strip } from '../lib/browser.hook';

/**
 * A tab opened from the browser shell's home remembers where it went.
 *
 * The shell draws its children in one of two places: inside `.g-home-legacy`
 * while the home screen is up, and inside `.g-legacy-mount` once it is not.
 * Those are different parents, so every navigation away from the home
 * unmounts the app's whole subtree and mounts it again — and `TabsFollow`
 * lives in that subtree.
 *
 * `TabsFollow` kept "have I looked before?" in a ref, which the remount
 * cleared. It then read the navigation that caused the remount as its first
 * look, and its first-look rule — *do not adopt the app into a blank tab that
 * somebody deliberately left blank, when there are other tabs open* — threw
 * that navigation away. So with two or more tabs open, nothing you did from
 * the home was ever recorded: the tab kept the name New tab, and coming back
 * to it landed on the search page rather than where you had been.
 *
 * `shell-overlap.test.tsx` covers this same strip and could not see it twice
 * over: it starts on `#/home`, where the shell is not on its home screen and
 * the subtree never moves, and it mounts `TabsFollow` outside the shell,
 * where a remount could not reach it. Here it is mounted where `BrowserShell`
 * mounts it — inside `.device`, inside the children — and the test starts
 * where somebody opening the app in this navigation starts.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

/** The app, mounted the way `BrowserShell` mounts it: inside the shell. */
function Screen() {
  const { state, dispatch } = useStore();
  return (
    <div className="device">
      <TabsFollow />
      <main data-work={state.screen}>
        <button onClick={() => dispatch({ type: 'go', screen: 'calendar' })}>Open calendar</button>
        <button onClick={() => dispatch({ type: 'go', screen: 'courses' })}>Open courses</button>
      </main>
    </div>
  );
}

function App() {
  const { state } = useStore();
  return (
    <GoogleShell title={state.screen}>
      <Screen />
    </GoogleShell>
  );
}

function button(name: string) {
  const el = [...host.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
  );
  if (!el) throw new Error('Missing button ' + name);
  return el;
}
const click = (name: string) => act(() => button(name).click());

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  forgetStrip();
  // Past onboarding, and on the shell's own home — which is where this
  // navigation opens, and the only place the subtree moves from.
  localStorage.setItem('semester.v1', JSON.stringify({ seenOnboarding: true }));
  window.history.replaceState(null, '', '#/search');
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <StoreProvider>
        <AIProvider>
          <App />
        </AIProvider>
      </StoreProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  forgetStrip();
});

it('records where a second tab goes from the home screen', () => {
  click('Add new tab');
  expect(strip().tabs).toHaveLength(2);
  expect(strip().at).toBe(1);

  click('Open calendar');
  expect(here().screen, 'the tab you are on followed the app to the calendar').toBe('calendar');
  expect(strip().tabs[1].place.length, 'and it kept the place, not just the screen').toBeGreaterThan(
    0,
  );
});

it('comes back to that tab still on its own screen', () => {
  click('Add new tab');
  click('Open calendar');
  // To the first tab and back, which is the whole point of a strip.
  act(() => host.querySelectorAll<HTMLButtonElement>('.g-tab-select')[0].click());
  expect(here().screen ?? 'search').toBe('search');
  act(() => host.querySelectorAll<HTMLButtonElement>('.g-tab-select')[1].click());
  expect(here().screen, 'the second tab is still the calendar tab').toBe('calendar');
});

it('still keeps the first tab on what it was showing', () => {
  // The one that worked before this was fixed, so that fixing the second tab
  // does not cost the first one.
  click('Open courses');
  expect(here().screen).toBe('courses');
  click('Add new tab');
  expect(strip().tabs[0].screen, 'the tab left behind kept its screen').toBe('courses');
});
