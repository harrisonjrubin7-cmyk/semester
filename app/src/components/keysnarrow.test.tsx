// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../state/store';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';
import { Keys } from './Keys';

/**
 * The shortcuts follow the keyboard, not the width of the window.
 *
 * `Keys` used to listen only where the window was wide, so a laptop browser
 * dragged to half its screen — or an iPad in Split View with a trackpad
 * keyboard — pressed `?` and got nothing, because it was being drawn as a
 * phone. A narrow window is a layout; it says nothing about what is plugged
 * in. The control case is the phone itself: narrow and no fine pointer, which
 * must still cost nothing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/** Answer the two questions `Keys` asks: how wide, and is there a fine pointer. */
function device({ wide, fine }: { wide: boolean; fine: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('any-pointer: fine') ? fine : query.includes('min-width') ? wide : false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

async function pressQuestionMark(): Promise<boolean> {
  await act(async () => {
    root.render(
      <StoreProvider>
        <AIProvider>
          <Keys />
        </AIProvider>
      </StoreProvider>,
    );
  });
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
  });
  return host.querySelector('[aria-label="Keyboard shortcuts"]') !== null;
}

describe('where the shortcuts listen', () => {
  it('a narrow window with a trackpad or mouse has them', async () => {
    device({ wide: false, fine: true });
    expect(await pressQuestionMark()).toBe(true);
  });

  it('a wide window has them, as it always did', async () => {
    device({ wide: true, fine: false });
    expect(await pressQuestionMark()).toBe(true);
  });

  it('a phone — narrow, a finger and nothing else — does not', async () => {
    device({ wide: false, fine: false });
    expect(await pressQuestionMark()).toBe(false);
  });
});
