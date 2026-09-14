// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it } from 'vitest';
import { AIProvider } from '../ai/store';
import { StoreProvider, useStore } from '../state/store';
import { loadSeed } from '../data/seed';
import { GoogleShell } from './GoogleShell';
import { forgetStrip } from '../lib/browser.hook';

/**
 * The shell mounts the app once and keeps it mounted.
 *
 * It draws several arrangements — the search home, a screen beside the
 * sidebar, the directory of all apps, the search results — and the app it is
 * given has to live through all of them. It used to be given twice: once
 * inside `.g-home-legacy` for the home screen and once inside
 * `.g-legacy-mount` for everything else. Those are two positions in the
 * element tree, so React tore the app down and built it again on every
 * crossing, and in the directory's case did not build it at all.
 *
 * What that costs is everything a component holds that the store does not:
 * where a list was scrolled, a half-typed reply, an open disclosure, a
 * running timer — and, the way it was found, the strip's own record of where
 * each tab had been (`browser-home-tabs.test.tsx`). None of it is visible in
 * a screenshot, and all of it is a bug the next person would have had to
 * re-diagnose from a different symptom.
 *
 * So the arrangements are drawn with classes and `hidden` now, which is the
 * idiom the shell already used for the search results, and the app has one
 * position that every arrangement shares. A mount counter is the whole test:
 * it is the one thing that cannot be argued with.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let mounts = 0;

/** The app, as far as this test is concerned: something that can be counted. */
function Screen() {
  const { state, dispatch } = useStore();
  /* State of its own, held nowhere else — the thing a remount destroys. */
  const [kept, setKept] = useState('');
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <div className="device">
      <main data-work={state.screen}>
        <button onClick={() => dispatch({ type: 'go', screen: 'calendar' })}>Open calendar</button>
        <button onClick={() => dispatch({ type: 'go', screen: 'search' })}>Open home</button>
        <input aria-label="Keep my draft" value={kept} onChange={(e) => setKept(e.target.value)} />
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
const draft = () => host.querySelector<HTMLInputElement>('[aria-label="Keep my draft"]');

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  forgetStrip();
  mounts = 0;
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

it('mounts the app once across the home and a screen, and back', () => {
  expect(mounts, 'mounted once to begin with').toBe(1);
  click('Open calendar');
  expect(mounts, 'leaving the home did not remount the app').toBe(1);
  click('Open home');
  expect(mounts, 'returning to the home did not remount it either').toBe(1);
});

it('keeps it mounted through the directory of all apps', () => {
  click('Open calendar');
  act(() => button('Open all apps').click());
  // The launcher is a panel; the directory is the screen behind "Browse all".
  const browse = [...host.querySelectorAll('button')].find((b) =>
    b.textContent?.startsWith('Browse all'),
  );
  if (browse) act(() => browse.click());
  expect(mounts, 'the directory did not take the app down with it').toBe(1);
});

it('keeps what the app was holding when you cross between them', () => {
  const field = draft()!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      field,
      'half a sentence',
    );
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(draft()!.value).toBe('half a sentence');
  click('Open calendar');
  // The same element, still carrying what was typed into it — which is the
  // whole of what a remount costs, said in the smallest way there is.
  expect(draft(), 'the app is the same instance it was').toBe(field);
  expect(draft()!.value, 'and it kept what was typed').toBe('half a sentence');
});
