// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SlideDeck } from '../screens/Slides';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';

/**
 * Moving to the next unit from the end of a longer deck.
 *
 * Two clicks in the app's own chrome, and it took the whole screen down. The
 * reset that starts a new unit's deck at slide one is a `setAt(0)` *during
 * render*, which schedules another render and does not stop this one — so the
 * pass continues with the old index, and if the unit being moved to has a
 * shorter deck, `slides[at]` is `undefined` and `slide.kind` throws.
 *
 * Found by driving the app rather than by reading it, and reproduced on
 * `origin/main` before any of this change was in the tree: ECON's first unit
 * is fifteen slides and its second is eleven. It is not the new slide kinds —
 * `compare`, `bullet` and `quote` each replace exactly one slide that was
 * there before, so no deck changed length.
 *
 * Asserted here rather than left to the clamp's own comment, because the next
 * person to touch that line will read `Math.min` as tidiness.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const said = () => (host.textContent ?? '').replace(/\s+/g, ' ');

async function settle(ready: () => boolean, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    if (ready()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const press = (name: RegExp) => {
  const button = [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
  if (!button) throw new Error(`no button matching ${name}`);
  act(() => button.click());
};

describe('the deck, moved between units', () => {
  it('survives the next unit having fewer slides than this one', async () => {
    await act(async () => {
      root.render(
        <StoreProvider>
          <SlideDeck />
        </StoreProvider>,
      );
    });
    await loadSeed().catch(() => []);
    await settle(() => /slide 1 of/i.test(said()));

    const total = Number(/slide 1 of (\d+)/i.exec(said())?.[1] ?? 0);
    expect(total, 'the first unit needs a deck for this to mean anything').toBeGreaterThan(1);

    // To the last slide of this unit, then on to the next one.
    for (let i = 1; i < total; i += 1) press(/^next$/i);
    await settle(() => new RegExp(`slide ${total} of ${total}`, 'i').test(said()));
    press(/next unit/i);
    await settle(() => /slide 1 of/i.test(said()));

    expect(said()).toMatch(/slide 1 of \d+/);
    expect(said(), 'the screen must still be a deck').not.toMatch(/went wrong|stopped/i);
  });
});
