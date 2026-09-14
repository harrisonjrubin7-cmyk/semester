// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it } from 'vitest';
import { StoreProvider, useStore } from '../state/store';
import { loadSeed } from '../data/seed';
import { TabsFollow } from './Tabs';
import { forgetStrip, here, openTab, pickTab, strip } from '../lib/browser.hook';

/**
 * A tab records where it went, and goes on recording it after a remount.
 *
 * `TabsFollow` is what makes a tab remember its place: the strip is right
 * about the screens search sent you to on its own, and right about every
 * other screen only because this watches the app and writes it down.
 *
 * It ignores exactly one navigation — the session's first look, when the tab
 * it is on is blank and other tabs are open, because a tab somebody opened
 * and left empty should not adopt whatever the app was already showing. That
 * rule turns on "has the strip looked yet this visit?", which is a fact about
 * the visit and is kept beside the strip in `lib/browser.hook.ts`.
 *
 * It was a ref in this component instead, and the browser shell that has
 * since been removed used to remount the component on every navigation away
 * from its home screen. The ref came back null, the navigation that caused
 * the remount looked like the first look, and the rule threw it away: two
 * tabs open, and nothing you did was recorded.
 *
 * That shell is gone, and the workspace's strip — which shares this
 * component — does not remount it today. So the first test below is the
 * behaviour and the second is the guard, and only the second fails if the
 * state moves back into a ref. It has to navigate *through* the remount to
 * do it: a ref loses only the one navigation it is torn down by, so a test
 * that remounts and then navigates passes on the bug. Measured, both ways,
 * before this file was trusted.
 *
 * (The test that used to hold this mounted the deleted shell and went with
 * it. This one mounts nothing but the follower.)
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

/** The follower, and a way to send the app somewhere — nothing else. */
function Harness({ remounting = false }: { remounting?: boolean }) {
  const { state, dispatch } = useStore();
  /*
   * Keyed on the screen when `remounting`, which is the shape that mattered:
   * the shell that had this bug drew its children in one parent while its
   * home was up and another once it was not, so *the navigation itself*
   * rebuilt everything under it. Remounting and navigating as two separate
   * events does not reproduce it — a ref loses only the one navigation it is
   * torn down by, and a separate remount tears it down on a place it has
   * already recorded. Measured: with the state back in a ref, a harness that
   * remounts on a button and then navigates passes.
   */
  return (
    <div className="device">
      <TabsFollow key={remounting ? state.screen : 'one'} />
      <button onClick={() => dispatch({ type: 'go', screen: 'calendar' })}>Open calendar</button>
      <button onClick={() => dispatch({ type: 'go', screen: 'courses' })}>Open courses</button>
    </div>
  );
}

function button(name: string) {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error('Missing button ' + name);
  return el;
}
const click = (name: string) => act(() => button(name).click());

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  forgetStrip();
  localStorage.setItem('semester.v1', JSON.stringify({ seenOnboarding: true }));
  window.history.replaceState(null, '', '#/home');
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/** Mount, either with a follower that survives navigation or one that does not. */
async function mount(remounting = false) {
  await act(async () =>
    root.render(
      <StoreProvider>
        <Harness remounting={remounting} />
      </StoreProvider>,
    ),
  );
}
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  forgetStrip();
});

it('writes down where each tab goes, and keeps them apart', async () => {
  await mount();
  click('Open courses');
  expect(here().screen).toBe('courses');

  act(() => {
    openTab();
  });
  click('Open calendar');
  expect(strip().tabs).toHaveLength(2);
  expect(strip().tabs[1].screen, 'the new tab took the calendar').toBe('calendar');
  expect(strip().tabs[0].screen, 'and the one left behind kept the courses').toBe('courses');

  act(() => {
    pickTab(0);
  });
  expect(here().screen, 'each tab is still its own place').toBe('courses');
});

it('records the navigation that remounts it', async () => {
  // The shape the bug needed, and the only shape that reproduces it: a second
  // tab, blank, with the navigation itself rebuilding the follower. Held in a
  // ref, the rebuilt follower calls this the session's first look and — a
  // blank tab with others open — throws the navigation away.
  await mount(true);
  click('Open courses');
  act(() => {
    openTab();
  });
  expect(here().screen, 'the second tab starts blank').toBeNull();

  click('Open calendar');

  expect(here().screen, 'the navigation that caused the remount was recorded').toBe('calendar');
  expect(strip().tabs[0].screen, 'and the first tab was not disturbed').toBe('courses');
});
