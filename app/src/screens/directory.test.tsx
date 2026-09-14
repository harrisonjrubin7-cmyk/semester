// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { fromHash } from '../lib/route';
import { Directory } from './Directory';

/**
 * One directory, and the three lists that only it draws.
 *
 * `SIMPLIFY-AUDIT.md` D7. The fifth pass merged the `everything` *screen* into
 * Progress so that two screens would not both draw the registry; the
 * workspace shell then arrived with this one and they both did again, gated
 * the same way through the same `lib/nav.ts`. This screen is the survivor and
 * Progress → Everything is gone.
 *
 * A merge is only honest if nothing goes missing in it. Progress' tab had two
 * things this screen did not — the four places you were **Lately**, and the
 * three you have **not opened yet** — and nothing else in the app drew
 * either, so losing them was the real risk and this is the test that says
 * they came across.
 *
 * ## Why it mounts the screen instead of grepping it
 *
 * Both lists are conditional: Lately needs somewhere to have been, and
 * `NotYetOpened` returns `null` once somebody has seen most of the app. A
 * static check for the word `lately` would pass on a screen that imported it
 * and never rendered it, which is exactly the failure a merge introduces.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => {
    root.render(<StoreProvider>{<Directory />}</StoreProvider>);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const text = () => host.textContent ?? '';

describe('the one directory', () => {
  it('draws every app with the sentence saying what it is for', () => {
    // The thing it was always for, checked so the rest of this file is not
    // testing a screen that failed to render at all.
    expect(text()).toContain('All applications');
    expect(host.querySelectorAll('button').length).toBeGreaterThan(20);
  });

  it('carries the Not-opened-yet list that came from Progress', () => {
    // A fresh seed has visited almost nothing, so the three are offered.
    // `lib/unseen.ts` is what decides; this only asks that it is on screen.
    expect(text()).toContain('Not opened yet');
  });

  it('has one way to filter, and the standing lists step aside for it', () => {
    // Favourites, Lately and Not-opened-yet answer "where was that". Once
    // somebody types, they are asking "where is the thing called this", and
    // three lists ignoring the filter above one obeying it reads as a bug.
    const box = host.querySelector('[aria-label="Filter these apps"]') as HTMLInputElement;
    expect(box).toBeTruthy();

    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      set.call(box, 'calendar');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(text()).not.toContain('Not opened yet');
    expect(text()).not.toContain('Your favourites');
    expect(text()).toContain('All applications');
  });
});

describe('the tab it replaced', () => {
  it('leaves Progress with no Everything tab', () => {
    const me = readFileSync(join(process.cwd(), 'src', 'screens', 'Me.tsx'), 'utf8');
    // The tab, its shelves, and the launcher that was its other half. Checked
    // as imports and JSX rather than as bare words: the comments explain what
    // moved and where, and a rule that failed its own documentation is a rule
    // people delete rather than satisfy.
    expect(me).not.toContain("tab === 'all'");
    expect(me).not.toContain("from '../components/NotYetOpened'");
    expect(me).not.toContain('<NotYetOpened');
    expect(me).not.toContain("from '../components/nav/Launcher'");
    expect(me).not.toContain('<Launcher');
    // …and keeps the row that opens the survivor, which is the rule this
    // screen's own note states for the Settings tab it dropped before.
    expect(me).toContain("screen: 'directory'");
  });

  it('narrows the saved tab so the old one cannot come back by name', () => {
    const shape = readFileSync(join(process.cwd(), 'src', 'state', 'shape.ts'), 'utf8');
    expect(shape).toContain("meTab: 'you' | 'task';");
    expect(shape).not.toContain("meTab: 'you' | 'all' | 'task';");
  });

  it('lands a link written when Everything was a screen on the screen it is again', () => {
    // Retired twice: first onto the Progress tab that had duplicated it, now
    // onto the directory that tab duplicated.
    expect(fromHash('#/everything')?.screen).toBe('directory');
    // Nothing left to disambiguate — the survivor has no part to open.
    expect(fromHash('#/everything')?.opens).toBeUndefined();
  });
});
