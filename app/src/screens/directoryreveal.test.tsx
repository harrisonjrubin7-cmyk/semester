// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { DESTINATIONS } from '../lib/nav';
import { Directory } from './Directory';

/**
 * A brand-new account is not shown the whole app.
 *
 * `lib/reveal.ts` is the gate: twelve screens do something before there is a
 * course, and the rest are earned by importing a syllabus, entering a grade,
 * putting an exam in the calendar. `screens/Directory.tsx` is the app's one
 * directory and the surface the gate is for — `components/nav/ShelfNav.tsx`
 * says so in as many words when it argues for *not* gating the chrome:
 * "Reveal still governs Everything, and search still finds everything."
 *
 * It governed nothing. `4eb1044` merged `Progress → Everything` into this
 * screen; the tab that went was the only caller of `nav.ts`'s `listed()`, the
 * three gates composed, and the survivor had always used `offered`, which is
 * two of the three. Driven in a browser on a fresh profile with no courses,
 * Settings said *46 screens appear once there is something for them to work
 * on* and this screen drew all 58, with the switch making no difference
 * either way.
 *
 * ## Four cases, because one is not evidence
 *
 * The count alone would pass against a screen that had simply been cut short.
 * So: the gate bites, the switch lifts it, search reaches past it, and the
 * panel underneath offers from the same set the list draws — which is the
 * half of the fix that only appears once the other half works.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * The sample, awaited once. `seedawait.test.ts` holds every store-mounting
 * file to this: `StoreProvider` starts the fetch and does not await it, so a
 * promise still in flight at teardown fails against whichever file happens to
 * be running next. `loadSeed` caches, so this costs one resolve.
 */
beforeAll(async () => {
  await loadSeed();
});

let host: HTMLDivElement;
let root: Root;

/** No courses, nothing earned — the account the gate is written for. */
function seed(extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [], ...extra }),
  );
}

beforeEach(() => {
  /* The store reads the address on mount once onboarding is behind you, and
   * jsdom keeps one `location` for the whole file. */
  window.location.hash = '';
  seed();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

function show() {
  act(() => {
    root.render(
      <StoreProvider>
        <Directory />
      </StoreProvider>,
    );
  });
}

/**
 * The registry list, and nothing else on the screen.
 *
 * By container, not by text. The first version of this counted every
 * `<button>` carrying a destination's blurb, which is four different panels:
 * the list, the favourites, Lately, and the "Not opened yet" suggestions —
 * all four draw `saysFor(d).blurb`. It reported **64** rows on a screen whose
 * registry list held 58, and the case that was meant to prove the gate bites
 * was reading its own fixture.
 *
 * `.deskdir-row` is the list and `.deskdir-card` is the grid; the screen draws
 * one or the other and nothing else uses either class.
 */
function rows(): string[] {
  return [...host.querySelectorAll('.deskdir-row, .deskdir-card')].map((el) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** The screen's own count of what it drew — "12 apps, one semester". */
function counted(): string {
  return (host.querySelector('.deskdir-count')?.textContent ?? '').trim();
}

/**
 * The "Not opened yet" suggestions, and not the favourites beside them.
 *
 * Both draw a destination and its sentence, and the first version of the last
 * case below asked whether a held-back screen appeared *anywhere* on the
 * screen. It failed, naming `study` — which is held back with no courses and
 * is also one of the five shipped favourites, the same five the tab bar
 * draws.
 *
 * That is not the fault. `components/nav/ShelfNav.tsx` settled it already:
 * the chrome you navigate by is not gated, because a row that changes length
 * as the term goes on is a row whose positions cannot be learned, and Study
 * is a tab on a first morning whatever the directory says. A suggestion
 * panel is the opposite — it exists to name things you have *not* been to,
 * so naming one the app is holding back is the app arguing with itself.
 *
 * Favourites and Lately live in `.deskdir-fav`; the suggestions are the
 * sibling with no container of their own.
 */
function suggested(): string {
  return [...host.querySelectorAll('button')]
    .filter((b) => !b.closest('.deskdir-fav, .deskdir-row, .deskdir-card, .deskdir-bar'))
    .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim())
    .join(' ');
}

function type(text: string) {
  const box = host.querySelector('input');
  if (!box) throw new Error('no search box on the directory');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('the directory on a brand-new account', () => {
  it('draws the twelve that are any use yet, not the whole registry', () => {
    show();
    const drawn = rows();
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(DESTINATIONS.length);
    // Named, so a gate that happened to cut to the right *number* still fails.
    expect(drawn.join(' ')).toContain('Upload a syllabus');
    expect(drawn.join(' ')).not.toContain('counted backwards from it');
    // And the screen's own sentence agrees with what it drew, which is the
    // disagreement this whole pass is about: Settings counted 46 held back
    // while this line said 58.
    expect(counted()).toBe(`${drawn.length} apps, one semester`);
  });

  it('draws all of it once the switch under the sentence is on', () => {
    // The control the browser run found first: before the fix these two cases
    // returned byte-identical lists, which is what a dead setting looks like.
    seed({ showAll: true });
    show();
    expect(rows().join(' ')).toContain('counted backwards from it');
  });

  it('still finds a held-back screen when you search for it', () => {
    // `lib/reveal.ts` is explicit: hiding something from a directory is a
    // claim about what is useful yet, and hiding it from search would be a
    // claim about what somebody is allowed to want.
    show();
    expect(rows().join(' ')).not.toContain('counted backwards from it');
    type('runway');
    expect(rows().join(' ')).toContain('counted backwards from it');
  });

  it('does not offer, underneath, the screens it is holding back', () => {
    // "Not opened yet" read the registry before any gate, so the fix above
    // made this screen contradict itself in two panels: twelve rows, and
    // three suggestions drawn by name from the forty-six that were not among
    // them. Measured on a fresh profile it offered Pathway, Career and
    // Family, none of which the list above it was drawing.
    show();
    const drawn = rows().join(' ');
    const held = DESTINATIONS.filter((d) => !drawn.includes(d.blurb.slice(0, 40)));
    // Not vacuous: with no gate nothing is held back, `held` is empty, and
    // "none of the held-back screens is offered" is true of a broken app.
    expect(held.length).toBeGreaterThan(0);
    const panel = suggested();
    const offered = held.filter((d) => panel.includes(d.blurb.slice(0, 40)));
    expect(offered.map((d) => d.screen)).toEqual([]);
    /*
     * And the panel is drawing something, so the empty list above is a
     * statement about what it chose rather than about it being absent.
     *
     * **Not by name, and that is the whole of this comment.** This read
     * `toContain('Upload a syllabus')` and was green for a day at a time:
     * `offer` in `lib/unseen.ts` rotates the three by the calendar day —
     * `dayIndex % left.length`, a window of three sliding one position every
     * midnight — so naming a screen asserts that today is one of about three
     * days in forty-six. It was written on one of them. It went red on
     * 22 September with nothing in the app having changed, and the commit it
     * broke under was a dependency bump, which is exactly the wrong place to
     * go looking.
     *
     * So the liveness check is liveness: the panel drew rows, and what it
     * drew is real destinations rather than chrome. Both survive the rotation
     * and survive a screen being added to or taken out of the pool, which is
     * the other thing that moves `left.length` underneath a named assertion.
     */
    const shown = DESTINATIONS.filter((d) => panel.includes(d.blurb.slice(0, 40)));
    expect(shown.length).toBeGreaterThan(0);
  });
});
