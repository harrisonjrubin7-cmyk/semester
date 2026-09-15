// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { AIProvider } from './store';
import { Assistant } from './Assistant';
/*
 * Imported to put the panel in the registry before the button asks for it,
 * and never referenced. Vitest will not settle an `import()` fired from a
 * `useEffect` inside `act()` — see `ENGINEERING-AUDIT.md` §7c, and the same
 * note in `components/softtop.test.tsx`. Without this the panel never mounts
 * and every assertion below passes for the wrong reason.
 */
import './Panel';
import { loadSeed } from '../data/seed';

/**
 * A dialog that takes focus has to give it back.
 *
 * It did not. Opening the assistant and pressing Escape put a keyboard reader
 * on `<body>`, with the whole document to tab through to get anywhere — and
 * the code said in its own docblock that it remembered what had focus and
 * restored it, which is the kind of comment that stops anybody checking.
 *
 * The cause was ordering. The panel captured `document.activeElement` when it
 * mounted, and child effects run before the parent's, so the composer inside
 * it had already focused itself: what the panel remembered was the box it was
 * about to unmount, and focusing a detached node lands on `<body>`.
 *
 * Two ways in, and they want different answers, which is why both are here.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function mount() {
  act(() => {
    root.render(
      <StoreProvider>
        <AIProvider>
          <button type="button" id="elsewhere">
            Elsewhere
          </button>
          <Assistant />
        </AIProvider>
      </StoreProvider>,
    );
  });
}

/** `loadSeed` for the reason `components/softtop.test.tsx` gives; then React. */
async function settle() {
  await loadSeed().catch(() => []);
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const focused = () =>
  document.activeElement === document.body || !document.activeElement
    ? 'BODY'
    : (document.activeElement.getAttribute('aria-label') ??
      document.activeElement.id ??
      document.activeElement.tagName);

const button = () =>
  host.querySelector<HTMLButtonElement>('button[aria-label^="Ask about"]');

const escape = async () => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await settle();
};

beforeEach(() => {
  localStorage.clear();
  /*
   * jsdom has no `matchMedia`, and the button asks for one to know whether it
   * is on a wide window. Narrow on both counts — a phone is what this app is
   * drawn as, and the corner the sheet opens from does not change what focus
   * does when it shuts. The same stub `components/tabs-follow.test.tsx` uses.
   */
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  /*
   * jsdom has no `elementsFromPoint` either, and the button measures what is
   * under it so as not to sit on a screen's primary action. Nothing is under
   * it here, which is the resting position and the one this test wants.
   *
   * Stubbed rather than ignored: it is called from a timer, so the throw comes
   * back as an uncaught exception after the test has passed — and vitest exits
   * non-zero on those, which is a green suite that fails anyway.
   */
  document.elementsFromPoint = (() => []) as unknown as typeof document.elementsFromPoint;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, shell: 'plain', nav: 'tabs' }),
  );
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

describe('closing the assistant gives focus back', () => {
  it('to the button, when the button is what opened it', async () => {
    mount();
    await settle();

    const fab = button();
    expect(fab, 'the assistant button should be on screen').not.toBeNull();
    fab!.focus();
    await act(async () => {
      fab!.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await settle();
    // The panel is up, and the button it was opened from is gone with it —
    // which is why "restore what had focus" cannot mean "focus that node".
    expect(host.querySelector('textarea'), 'the composer should be up').not.toBeNull();
    expect(button(), 'the button unmounts while the sheet is open').toBeNull();

    await escape();

    expect(host.querySelector('textarea')).toBeNull();
    expect(focused()).toMatch(/^Ask about/);
  });

  it('to wherever it was, when a shortcut opened it from somewhere else', async () => {
    mount();
    await settle();

    const elsewhere = host.querySelector<HTMLButtonElement>('#elsewhere')!;
    elsewhere.focus();
    expect(focused()).toBe('elsewhere');

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await settle();
    expect(host.querySelector('textarea'), 'Cmd+K should open the sheet').not.toBeNull();

    await escape();

    // Not the assistant button: that is where the fallback goes, and taking it
    // here would strand somebody who never touched the button.
    expect(focused()).toBe('elsewhere');
  });
});
