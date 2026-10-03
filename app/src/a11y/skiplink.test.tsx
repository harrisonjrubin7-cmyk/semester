// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';
import { StoreProvider } from '../state/store';

/**
 * The app routes in the hash, so the skip link cannot use ordinary fragment
 * navigation: changing `#/calendar` to `#main` makes the router show Today.
 * These cases exercise the real shell at both routes where that regression
 * was observed, rather than a copy of the link or a mocked router.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let hadObserver = false;
let hadHitTest = false;
let rootStyle: string | null = null;

function desktop() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min
      ? 1180 >= Number(min[1])
      : max
        ? 1180 <= Number(max[1])
        : query.includes('pointer: fine') || query.includes('hover: hover');
    return { matches, media: query, addEventListener() {}, removeEventListener() {} };
  }) as unknown as typeof window.matchMedia;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  desktop();
  hadObserver = 'ResizeObserver' in globalThis;
  hadHitTest = typeof document.elementsFromPoint === 'function';
  rootStyle = document.documentElement.getAttribute('style');
  if (!hadObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!hadHitTest) document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, nav: 'tabs', seenOnboarding: true }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  history.replaceState(null, '', '/');
  if (rootStyle === null) document.documentElement.removeAttribute('style');
  else document.documentElement.setAttribute('style', rootStyle);
  if (!hadObserver) delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  if (!hadHitTest) delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
});

async function show(hash: '#/calendar' | '#/me') {
  history.replaceState(null, '', `/${hash}`);
  await act(async () => {
    root.render(
      <StoreProvider>
        <AIProvider>
          <App />
        </AIProvider>
      </StoreProvider>,
    );
  });
  for (let waited = 0; waited < 15_000; waited += 50) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    if (!host.querySelector('[aria-busy="true"]')) break;
  }
  expect(host.querySelector('[aria-busy="true"]'), `${hash} never finished loading`).toBeNull();
}

describe('the app skip link', () => {
  it.each([
    ['Calendar', '#/calendar', 'Calendar'],
    ['Me', '#/me', 'Progress'],
  ] as const)('focuses the current main without routing away from %s', async (_screen, hash, heading) => {
    await show(hash);
    const skip = host.querySelector('a.skip-link') as HTMLAnchorElement;
    const main = host.querySelector('main#main') as HTMLElement;

    expect(skip.getAttribute('href')).toBe('#main');
    expect(host.querySelector('h1')?.textContent).toBe(heading);
    await act(async () => skip.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(window.location.hash).toBe(hash);
    expect(host.querySelector('h1')?.textContent).toBe(heading);
    expect(document.activeElement).toBe(main);
  });
});
