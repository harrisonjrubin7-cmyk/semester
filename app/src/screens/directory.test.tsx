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
    root.render(<StoreProvider>{<Directory journeyNavigation />}</StoreProvider>);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const text = () => host.textContent ?? '';

describe('the one directory', () => {
  it('restores the existing catalog-first layout when journey navigation is off', () => {
    act(() => root.render(<StoreProvider><Directory journeyNavigation={false} /></StoreProvider>));
    expect(host.querySelectorAll('[data-journey-id]')).toHaveLength(0);
    expect(text()).toContain('All applications');
    expect(host.querySelector('[aria-label="Search tools"]')).toBeTruthy();
  });
  it('starts with six journeys and keeps the unchanged catalog behind All tools', () => {
    expect(host.querySelectorAll('[data-journey-id]')).toHaveLength(6);
    const all = [...host.querySelectorAll('button')].find((button) =>
      /^All tools \(\d+\)$/.test(button.textContent?.trim() ?? ''),
    );
    expect(all, 'the complete catalog has no visible way in').toBeTruthy();
    const promised = Number(all!.textContent!.match(/\d+/)![0]);

    act(() => all!.click());
    expect(text()).toContain('All applications');
    expect(host.querySelectorAll('.deskdir-rowopen, .deskdir-cardsays')).toHaveLength(promised);
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
    const box = host.querySelector('[aria-label="Search journeys and tools"]') as HTMLInputElement;
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

/**
 * What the screen says while you are narrowing it, which was nothing.
 *
 * An outside review of the app filtered the directory and could not tell how
 * much of it was left, then emptied the list to nothing and was told "Nothing
 * here matches that" over a filter it would have to find and clear itself.
 * Both are the same omission: the screen narrows well and does not report the
 * narrowing.
 *
 * Mounted rather than grepped, and driven through the real input, because
 * both are conditional on somebody having typed — a static check would pass
 * on a screen that computed the count and never drew it.
 */
describe('narrowing the directory', () => {
  const type = (into: string) => {
    const box = host.querySelector('[aria-label="Search journeys and tools"]') as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      set.call(box, into);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('says nothing about counts until something is narrowed', () => {
    // "58 of 58 apps" over the whole directory answers a question nobody has
    // asked yet, and it is the state the screen is in most of the time.
    expect(text()).not.toMatch(/\d+ of \d+ apps/);
  });

  it('says how many are left, out of how many there are', () => {
    type('calendar');
    const said = text().match(/(\d+) of (\d+) apps/);
    expect(said, 'the count is not on screen while filtering').toBeTruthy();
    const [, left, all] = said!.map(Number);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(all);
  });

  it('counts what is actually drawn, not what was asked for', () => {
    // Two numbers for one row is how this repository has produced most of its
    // wrong ones. The count has to be the length of the list under it.
    type('calendar');
    const left = Number(text().match(/(\d+) of \d+ apps/)![1]);
    // Every row and every card opens its screen through the same `deskdir`
    // name button, in either view.
    const rows = host.querySelectorAll('.deskdir-rowopen, .deskdir-cardsays').length;
    expect(rows).toBe(left);
  });

  it('puts a way back on the screen, and on the dead end too', () => {
    type('zzzzzzz');
    expect(text()).toContain('Nothing here matches that');
    const out = [...host.querySelectorAll('button')].find((b) => /show them all/i.test(b.textContent ?? ''));
    expect(out, 'nothing on screen empties the filter').toBeTruthy();

    act(() => out!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(text()).not.toContain('Nothing here matches that');
    // And the standing lists and journey-first home are back.
    expect(text()).toContain('What do you want to do?');
    expect(host.querySelectorAll('[data-journey-id]')).toHaveLength(6);
    expect(text()).not.toMatch(/\d+ of \d+ apps/);
  });

  it('announces the count rather than only drawing it', () => {
    // The list below changes under a screen reader with nothing said about
    // it otherwise.
    type('calendar');
    expect(host.querySelector('[role="status"]')?.textContent ?? '').toMatch(/\d+ of \d+ apps/);
  });
});

describe('what a favourite card says about itself', () => {
  it('carries the registry\u2019s own sentence, not the shelf it sits on', () => {
    /*
     * The line was `d.group`, so a row of favourites read "Study", "Study",
     * "Courses" — the least distinguishing thing about three screens, under
     * names the chips below already group. The sentence was in hand the whole
     * time: `saysFor` returns it, and this card was passing it to `title`,
     * which is a tooltip, which is nothing at all on a phone.
     */
    const cards = [...host.querySelectorAll('.deskdir-favcard')];
    expect(cards.length, 'no favourites are drawn, so this proves nothing').toBeGreaterThan(0);
    const blurbs = cards.map((c) => c.querySelector('.deskdir-favgroup')?.textContent?.trim() ?? '');
    // A category is one or two words. Every one of these is a sentence about
    // what the screen does.
    for (const said of blurbs) expect(said.split(/\s+/).length).toBeGreaterThan(2);
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
