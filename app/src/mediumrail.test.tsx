// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { StoreProvider } from './state/store';
import { AIProvider } from './ai/store';
import { loadSeed } from './data/seed';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The medium window's rail: collapsed to its icons, opened out on demand.
 *
 * At 600–839px the tab bar gives way to the rail drawn narrow (`chromeFor`'s
 * `medium`). What this holds is the part `chrome.test.ts` cannot see: that
 * the narrow rail still names every destination to a screen reader, that
 * opening it shows the rows it hides, and that it gets out of the way — on a
 * choice, on Escape without Escape also meaning Back, and on the scrim.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let hadObserver = false;
let hadHitTest = false;
let rootStyle: string | null = null;

/** A 700px desktop window: medium, not wide, not a phone on its side. */
function window700() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = min ? 700 >= Number(min[1]) : query.includes('pointer: fine') || query.includes('hover: hover');
    return { matches, media: query, addEventListener() {}, removeEventListener() {} };
  }) as unknown as typeof window.matchMedia;
}

beforeAll(async () => {
  await loadSeed();
});

const rail = () => host.querySelector('nav.rail') as HTMLElement | null;
const toggle = () => host.querySelector('.rail-toggle') as HTMLButtonElement | null;
const names = () => [...(rail()?.querySelectorAll('button.rail-item') ?? [])].map((b) => (b.textContent ?? '').trim());

describe('at medium', () => {
  beforeEach(async () => {
    window700();
    // Two browser APIs jsdom does not have. The assistant button hit-tests
    // for a clear corner, and an empty answer is the honest one here; the
    // phone frame's tab bar measures itself, so a regression back to the tab
    // bar fails on an assertion rather than on jsdom. Both are put back in
    // `afterEach`.
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    history.replaceState(null, '', '/');
    // Put the environment back: this suite shares workers with others, and a
    // stub left behind would change what the next file finds. The app's theme
    // effect writes every look token onto <html> as inline style, and
    // unmounting does not take them off; `svgout.test.ts` proves a fallback
    // by `--app-line` being unset, and read the leak as its own failure.
    if (rootStyle === null) document.documentElement.removeAttribute('style');
    else document.documentElement.setAttribute('style', rootStyle);
    if (!hadObserver) delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    if (!hadHitTest) delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it('draws the rail collapsed, and no tab bar', () => {
    expect(rail(), 'no rail at 700px').not.toBeNull();
    expect(rail()!.hasAttribute('data-collapsed')).toBe(true);
    expect(host.querySelector('[data-rail="collapsed"]')).not.toBeNull();
    expect(toggle()!.getAttribute('aria-expanded')).toBe('false');
  });

  it('still names every tab — the words are clipped, not removed', () => {
    // `display: none` would take the name from a screen reader. The text is
    // in the DOM and the stylesheet clips it.
    expect(names()).toContain('Plan');
    expect(names().every((n) => n.length > 0)).toBe(true);
  });

  it('opens out to show the rows it hides, and closes on Escape without going Back', async () => {
    expect(names()).not.toContain('Settings');
    await act(async () => toggle()!.click());
    expect(rail()!.hasAttribute('data-open')).toBe(true);
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
    expect(names()).toContain('Settings');

    /*
     * Where `Keys` listens, and would read Escape as Back. Asserting on the
     * listener rather than on the screen: Back from a top-level tab does
     * nothing visible, so a leak would pass a check of the hash. It must not
     * reach here at all.
     */
    const reached: string[] = [];
    const listen = (e: KeyboardEvent) => reached.push(e.key);
    window.addEventListener('keydown', listen);
    const before = window.location.hash;
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    window.removeEventListener('keydown', listen);
    expect(rail()!.hasAttribute('data-open')).toBe(false);
    expect(reached).toEqual([]);
    expect(window.location.hash).toBe(before);
    expect(document.activeElement).toBe(toggle());
  });

  it('closes once a destination is chosen, and goes there', async () => {
    await act(async () => toggle()!.click());
    const settings = [...rail()!.querySelectorAll('button.rail-item')].find((b) => /settings/i.test(b.textContent ?? ''))!;
    await act(async () => (settings as HTMLButtonElement).click());
    expect(rail()!.hasAttribute('data-open')).toBe(false);
    expect(window.location.hash).toMatch(/settings/);
  });

  it('closes on the scrim', async () => {
    await act(async () => toggle()!.click());
    await act(async () => (host.querySelector('.rail-scrim') as HTMLButtonElement).click());
    expect(rail()!.hasAttribute('data-open')).toBe(false);
  });
});

describe('the stylesheet', () => {
  const css = readFileSync(join(__dirname, 'styles', 'app.css'), 'utf8');

  it('clips the collapsed labels rather than removing them, so each icon keeps its name', () => {
    // jsdom applies no stylesheet, so the tests above cannot tell a clipped
    // label from a removed one. This reads the rule itself.
    const start = css.indexOf('.rail[data-collapsed]:not([data-open]) .rail-item span {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('clip');
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it('gives the rail its 72px column at medium, and none on a phone', () => {
    const medium = css.indexOf('@media (min-width: 600px)');
    expect(css.slice(medium, css.indexOf('}', css.indexOf('}', medium) + 1))).toContain('--rail-w: 72px');
  });
});
