// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { prefersLessMotion, usePrefersContrast, usePrefersDark } from './prefers';

/**
 * The three questions the app asks the operating system.
 *
 * None of them had a test, and the reason is worth writing down because it is
 * the reason the gap was invisible: jsdom has no `matchMedia`. Every one of
 * these falls back when it cannot ask, so under test the fallback was the only
 * branch ever taken — and nothing asserted what it should be. A flipped
 * fallback passed the whole suite. One of them was flipped, and shipped that
 * way until somebody read the paragraph beside it.
 *
 * So there are two halves here. The fallbacks, pinned by direction and by the
 * argument each makes for itself; and the live answer, which needs a
 * `matchMedia` that jsdom will not provide, so one is installed.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A `matchMedia` whose answer can be changed, and which reports its listeners. */
function fakeMedia(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<(e: MediaQueryListEvent) => void>>();
  const now = { ...matches };

  const mm = (q: string) => ({
    // A getter, because `MediaQueryList.matches` is live: the hook keeps the
    // object and reads it again when the change fires. A static value here
    // made the test fail against correct code.
    get matches() {
      return now[q] ?? false;
    },
    media: q,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      if (!listeners.has(q)) listeners.set(q, new Set());
      listeners.get(q)?.add(fn);
    },
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      listeners.get(q)?.delete(fn);
    },
  });

  vi.stubGlobal('matchMedia', mm as unknown as typeof matchMedia);

  return {
    /** The OS setting changes while the app is open. */
    flip(q: string, to: boolean) {
      now[q] = to;
      for (const fn of listeners.get(q) ?? []) fn({ matches: to } as MediaQueryListEvent);
    },
    counted: (q: string) => listeners.get(q)?.size ?? 0,
  };
}

function mount(hook: () => boolean): { root: Root; said: () => string | null; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const Probe = () => <span data-said={String(hook())} />;
  act(() => root.render(<Probe />));
  return { root, host, said: () => host.querySelector('span')?.getAttribute('data-said') ?? null };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('when the device cannot be asked', () => {
  // No `matchMedia` at all: an old browser, or a server render. Each of these
  // has an argued-for direction and this is the only place it is stated.
  it('assumes dark, which is the app default rather than a light theme nobody chose', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(mount(usePrefersDark).said()).toBe('true');
  });

  it('assumes no extra contrast, because lifting it unasked is its own harm', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(mount(usePrefersContrast).said()).toBe('false');
  });

  it('assumes reduced motion, where the wrong answer is a symptom and not a jump', () => {
    // The direction argued for in the docblock: a page sweeping its whole
    // length is the largest movement the app makes, and the people the
    // setting protects are the ones a browser this old belongs to.
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersLessMotion()).toBe(true);
  });

  it('says the same when the query itself throws', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('refused');
    });
    expect(prefersLessMotion()).toBe(true);
    expect(mount(usePrefersDark).said()).toBe('true');
  });
});

describe('when it can', () => {
  it('answers what the device actually says', () => {
    fakeMedia({ '(prefers-color-scheme: dark)': false, '(prefers-contrast: more)': true });
    expect(mount(usePrefersDark).said()).toBe('false');
    expect(mount(usePrefersContrast).said()).toBe('true');
  });

  it('follows a change made while the app is open', () => {
    /*
     * The whole reason these are hooks rather than a value read once. Somebody
     * with their phone on a schedule flips to dark at sunset, and a theme that
     * only follows on the next launch is not following.
     */
    const media = fakeMedia({ '(prefers-color-scheme: dark)': false });
    const probe = mount(usePrefersDark);
    expect(probe.said()).toBe('false');

    act(() => media.flip('(prefers-color-scheme: dark)', true));
    expect(probe.said()).toBe('true');
  });

  it('follows contrast the same way', () => {
    const media = fakeMedia({ '(prefers-contrast: more)': false });
    const probe = mount(usePrefersContrast);
    expect(probe.said()).toBe('false');

    act(() => media.flip('(prefers-contrast: more)', true));
    expect(probe.said()).toBe('true');
  });

  it('lets go of the listener when the screen goes', () => {
    // A hook that subscribes on every mount and never unsubscribes is a leak
    // that grows with navigation, and this app navigates a great deal.
    const media = fakeMedia({ '(prefers-color-scheme: dark)': false });
    const probe = mount(usePrefersDark);
    expect(media.counted('(prefers-color-scheme: dark)')).toBe(1);

    act(() => probe.root.unmount());
    expect(media.counted('(prefers-color-scheme: dark)')).toBe(0);
  });
});
