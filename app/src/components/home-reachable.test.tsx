// @vitest-environment jsdom
/*
 * The browser navigation's home has to be clickable.
 *
 * On `nav: 'browser'` the app opens on the search home, and there the shell
 * draws its own wordmark, search field, shortcuts and footer while the
 * screen behind it is mounted inside `.g-home-legacy` — a fixed, full-window
 * overlay at `z-index: 50` whose scroller is `display: none`. It is there so
 * the screen's ambient pieces keep running and its toasts and dialogs can
 * still be reached; it draws nothing itself.
 *
 * Which means every wrapper between that overlay and the hidden scroller is
 * an invisible box the size of the window sitting over the whole home. If
 * one of them takes pointer events, every click on the home lands in it and
 * nothing on the screen responds — the app looks like it has stopped rather
 * than like it has a stacking bug, so it is worth a test that fails loudly.
 * `.g-home-legacy .device>*{pointer-events:auto}` did exactly that to
 * `BrowserShell`'s `.deskwork-body`.
 *
 * The assertion walks the real tree rather than naming the wrappers, so it
 * holds whatever `App.tsx` nests inside the shell next.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { AIProvider } from '../ai/store';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import App from '../App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let sheet: HTMLStyleElement;

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  /*
   * Past onboarding, on the browser navigation, on the screen it opens on.
   * `schemaVersion` because the migration that gathered the navigations sets
   * `nav` itself — without it this seed is walked forward to `workspace` and
   * the test would quietly pass by never drawing the shell under test.
   */
  localStorage.setItem(
    'semester.v1',
    JSON.stringify({ schemaVersion: 6, nav: 'browser', seenOnboarding: true }),
  );
  window.history.replaceState(null, '', '#/search');
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  /*
   * Vitest stubs the component's own `import './google-shell.css'`, and this
   * test is about what that file says, so it is loaded here by hand. From the
   * project root, the way `chiprow.test.ts` reads `app.css`: under jsdom
   * `import.meta.url` is an http address and `readFileSync` will not take it.
   */
  sheet = document.createElement('style');
  sheet.textContent = readFileSync('src/components/google-shell.css', 'utf8');
  document.head.append(sheet);
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
  sheet.remove();
  localStorage.clear();
});

it('lets clicks through the home overlay to the shell behind it', () => {
  const overlay = host.querySelector<HTMLElement>('.g-home-legacy');
  // The shell's own home, and the overlay over it: without both there is
  // nothing here to be covered and the rest of this test means nothing.
  expect(host.querySelector('.g-search-home')).not.toBeNull();
  expect(overlay).not.toBeNull();

  const scroller = overlay!.querySelector('.scrollarea');
  expect(scroller).not.toBeNull();

  const blocking: string[] = [];
  for (let el = scroller!.parentElement; el && el !== overlay; el = el.parentElement) {
    if (getComputedStyle(el).pointerEvents !== 'none') blocking.push(el.className || el.tagName);
  }
  expect(blocking).toEqual([]);
  expect(getComputedStyle(overlay!).pointerEvents).toBe('none');
});

it('still hands clicks to the toasts the overlay is mounted for', () => {
  // `Said`, `Replaced` and `Undone` mount here and draw nothing until there
  // is something to say; the undo toast carries a button. Whatever the
  // wrappers do, a child of the pane has to keep its clicks.
  const pane = host.querySelector('.g-home-legacy .device-pane');
  expect(pane).not.toBeNull();
  const toast = document.createElement('div');
  pane!.append(toast);
  expect(getComputedStyle(toast).pointerEvents).toBe('auto');
  toast.remove();
});
