// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { AIProvider } from './ai/store';
import { loadSeed } from './data/seed';
import { StoreProvider } from './state/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let originalMatchMedia: typeof window.matchMedia;
let originalResizeObserver: typeof ResizeObserver | undefined;
let originalElementsFromPoint: typeof document.elementsFromPoint | undefined;

beforeAll(async () => {
  await loadSeed();
  originalMatchMedia = window.matchMedia;
  originalResizeObserver = globalThis.ResizeObserver;
  originalElementsFromPoint = document.elementsFromPoint;
  window.matchMedia = ((query: string) => ({
    matches: /min-width:\s*(\d+)px/.test(query)
      ? 1280 >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1])
      : query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
  if (originalResizeObserver) globalThis.ResizeObserver = originalResizeObserver;
  else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  if (originalElementsFromPoint) document.elementsFromPoint = originalElementsFromPoint;
  else delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('style');
});

async function mount(nav: 'tabs' | 'workspace', saved: Record<string, unknown> = {}) {
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, nav, seenOnboarding: true, ...saved }));
  history.replaceState(null, '', '/#/calendar');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <AIProvider>
          <App />
        </AIProvider>
      </StoreProvider>,
    );
  });
}

function expectWorkspaceGroup(container: Element | null) {
  const group = container?.querySelector('[role="group"][aria-label="Workspaces"]');
  expect(group).not.toBeNull();
  expect(group?.textContent).toContain('Teaching');
  expect(group?.textContent).toContain('University services');
  expect(group?.textContent).not.toMatch(/Company|Investor|Developer/);
}

describe('persistent workspace navigation', () => {
  it('keeps the allowlisted workspace group in the wide rail', async () => {
    await mount('tabs');
    expectWorkspaceGroup(host.querySelector('nav.rail'));

    const teaching = [...host.querySelectorAll<HTMLButtonElement>('nav.rail button')]
      .find((button) => button.textContent?.includes('Teaching'))!;
    await act(async () => teaching.click());

    const current = [...host.querySelectorAll<HTMLElement>('nav.rail [aria-current="page"]')];
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Teaching');
  });

  it('keeps the same workspace group in the desktop workspace sidebar', async () => {
    await mount('workspace');
    expectWorkspaceGroup(host.querySelector('nav.desk-side'));
    expect((host.querySelector('.desk-side-label') as HTMLElement | null)?.style.color).toBe('');
    expect((host.querySelector('.desk-side-foot') as HTMLElement | null)?.style.color).toBe('');
  });

  it('lets specific workspace items own current state when their generic screens are favourites', async () => {
    await mount('workspace', { favourites: 'account,university' });
    const sidebar = host.querySelector('nav.desk-side')!;

    const teaching = [...sidebar.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Teaching'))!;
    await act(async () => teaching.click());
    expect([...sidebar.querySelectorAll('[aria-current="page"]')].map((item) => item.textContent?.trim()))
      .toEqual(['Teaching↗']);

    const university = [...sidebar.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('University services'))!;
    await act(async () => university.click());
    expect([...sidebar.querySelectorAll('[aria-current="page"]')].map((item) => item.textContent?.trim()))
      .toEqual(['University services↗']);
  });
});
