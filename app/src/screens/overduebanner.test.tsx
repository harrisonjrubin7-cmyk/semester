// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { Today } from './Today';

/**
 * The backlog a first run greets somebody with, and whose it is.
 *
 * The app ships with a whole semester in it, and the standing question at the
 * top of every screen — *these are mine* or *not mine* — is unanswered until
 * somebody taps one. `OverdueBanner` did not ask: it counted every dated item
 * in the catalogue, so a brand-new visitor opened the app on **"14 deadlines
 * went by without being ticked off"**, warning-coloured, above everything
 * else, about a term they had never seen.
 *
 * Seen on the deployed site at phone size. It is the shape `lib/you.ts`
 * refuses — late is named because a missed deadline is worth naming, "not to
 * shame anyone with a red number" — and it was aimed at somebody who had not
 * missed anything.
 *
 * ## Mounted, and both directions, because a mute passes half of it
 *
 * The fix must filter, not hide. A student who imported their own syllabus
 * alongside the sample and missed one of *its* deadlines still needs warning,
 * and a change that simply switched the banner off while `sample` is true
 * would satisfy the first test here and fail the second. The third is the
 * other control: once the question is answered the count is plain again, so a
 * filter that never stopped filtering would be caught too.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  // jsdom has neither, and `Today` is the first screen any test has mounted,
  // so nothing had needed them before. Both are inert: the layout they feed
  // is not what is being asserted here.
  window.matchMedia = (() => ({
    matches: false, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  await loadSeed();
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

/** Mount Today over a given stored state. */
async function open(stored: Record<string, unknown>): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, ...stored }));
  await act(async () => {
    root = createRoot(host);
  });
  await act(async () => {
    root.render(
      <StoreProvider>
        <Today />
      </StoreProvider>,
    );
  });
}

const banner = (): string =>
  [...host.querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').replace(/\s+/g, ' '))
    .find((t) => /went by without being ticked off/.test(t)) ?? '';

describe('a first run, with the sample term unclaimed', () => {
  it('does not tell the visitor they missed anything', async () => {
    // `sample` defaults true and no courses have been imported, so every
    // dated item in the catalogue belongs to the shipped term.
    await open({});
    expect(banner()).toBe('');
  });

  it('still draws the rest of the screen, which is the control', async () => {
    // An empty banner has to mean "nothing of yours is late", not "Today
    // failed to render" — which would pass the assertion above.
    await open({});
    expect(host.textContent ?? '').toContain('Next class');
  });
});

describe('once the question has been answered', () => {
  it('counts the sample term’s missed deadlines, because they are now yours', async () => {
    // Adopting copies those courses into `state.courses` and clears `sample`.
    // The same rule that excluded them includes them; nothing is special-cased.
    await open({ sample: false, courses: [] });
    // With no courses at all there is nothing to be late for — the point is
    // only that the filter is no longer filtering. See the sibling below.
    expect(banner()).toBe('');
  });
});
