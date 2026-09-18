// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { Study } from './Study';
import { DESTINATIONS, destinationsIn } from '../lib/nav';

/**
 * The tool the fortnight asked for, drawn rather than dropped.
 *
 * `lib/toolnow.ts` reads the deadlines in front of the student and names the
 * two or three tools those deadlines ask for, each with the row it came from.
 * Study drew the cards by looking each suggestion up in the list the *grid*
 * below them is built from — `destinationsIn('Study')` and
 * `destinationsIn('Make')` — and a suggestion it could not find there hit
 * `if (!d) return null` and disappeared without a trace.
 *
 * Two of the ten screens that file can suggest are not on either shelf.
 * `work` is on Semester and `sources` on Courses, both put there deliberately
 * when those shelves were last balanced, and `lib/nav.ts` carries the argument
 * for each. Neither decision was wrong; the screen was asking the wrong
 * question of them.
 *
 * ## What it cost, measured
 *
 * One evening per day for 120 days of the sample semester: **341 suggestions
 * produced, 122 thrown away.** `work` on 112 of those days, `sources` on 10.
 * `work` scores `3 + soon * 1.5`, the joint-highest rule in the file, so the
 * card being dropped was usually the strongest one. And because `suggest`
 * takes the top `AT_MOST` *before* the screen filtered it, nothing moved up to
 * fill the hole — on four of the 120 days every card was dropped and "Because
 * of this fortnight" drew as a heading with nothing under it.
 *
 * ## Both halves, because they fail independently
 *
 * The structural half asks whether every screen `toolnow` can name is a
 * registered destination at all, which is what makes it drawable and gives it
 * a label. It cannot be fooled by a render that happened not to suggest the
 * broken one tonight.
 *
 * The mounted half asks whether the card is really on the screen, because a
 * registry that agrees with itself proves nothing about the JSX — that was
 * exactly the shape of this bug.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (p: string) => readFileSync(join(process.cwd(), '..', p), 'utf8');

/**
 * Every screen `lib/toolnow.ts` can suggest, read out of its source.
 *
 * Comments are stripped first. This repository has now been bitten three
 * separate times by a probe counting a word that was in a comment — most
 * recently `rollback.test.ts`, which says so in its own header — and this file
 * quotes screen names in prose above.
 */
function suggestible(): string[] {
  const src = read('app/src/lib/toolnow.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  return [...new Set([...src.matchAll(/screen: '([a-z]+)'/g)].map((m) => m[1]))].sort();
}

describe('every tool the fortnight can ask for', () => {
  const registered = new Map(DESTINATIONS.map((d) => [d.screen as string, d]));

  it('is found in the source at all, which is the probe control', () => {
    /*
     * A regex that stopped matching — a rename, a helper, an object spread —
     * would return nothing and make every assertion below vacuously true. Ten
     * today; the floor is well under that so an honest change does not trip
     * it, and zero or one cannot pass.
     */
    const all = suggestible();
    expect(all.length, 'no suggestion rules found — has toolnow.ts moved?').toBeGreaterThan(5);
    expect(all).toContain('exam');
  });

  it.each(suggestible())('%s is a destination, so the card has a name to draw', (screen) => {
    // Being registered is what `Study.tsx` needs of it: the label and the
    // blurb come from the registry, and an unregistered screen is a card with
    // no words on it — which is why it returned null instead.
    expect(registered.has(screen), `${screen} is suggested but not a destination`).toBe(true);
  });

  it('and can tell a registered screen from one that is not', () => {
    // The control for the block above: a lookup that matched anything would
    // pass every row of it.
    expect(registered.has('no-such-screen')).toBe(false);
    expect(registered.size).toBeGreaterThan(20);
  });

  it('includes the two that the shelves could not reach', () => {
    /*
     * Named rather than left implicit, because they are the whole reason the
     * cards stopped being resolved against the grid's two shelves.
     *
     * Asserted as *registered and suggestible*, not as "not on Study or
     * Make". Which shelf each sits on is a navigation decision with an
     * argument written into `lib/nav.ts`, and a guard that went red when
     * somebody re-shelved one would be this file objecting to a change it has
     * no business objecting to.
     */
    for (const screen of ['work', 'sources']) {
      expect(suggestible()).toContain(screen);
      expect(registered.has(screen)).toBe(true);
    }
  });

  it('is not all reachable from the grid, which is why the grid is not the list', () => {
    /*
     * Not an assertion about shelves — an assertion about the *method*. If
     * every suggestible screen were on Study or Make, resolving against those
     * two would be harmless and this file would be guarding nothing. Today it
     * is not, and the day it becomes so this test says so out loud rather
     * than leaving a dead guard behind.
     */
    const shelves = new Set(
      [...destinationsIn('Study'), ...destinationsIn('Make')].map((d) => d.screen as string),
    );
    const outside = suggestible().filter((s) => !shelves.has(s));
    expect(
      outside.length,
      'every suggestible screen now sits on Study or Make — re-read this file before deleting it',
    ).toBeGreaterThan(0);
  });
});

describe('the card on the screen', () => {
  let host: HTMLDivElement;
  let root: Root;

  // See `screens/deadends.test.tsx` — the store pulls the shipped courses in
  // with a dynamic import it does not await, and a promise still in flight
  // when the file ends fails the run on teardown rather than on an assertion.
  beforeAll(async () => {
    await loadSeed();
  });

  beforeEach(async () => {
    /*
     * 5 November 2026, nine in the evening, in the sample semester.
     *
     * Chosen off the measurement rather than by feel: on that evening `work`
     * is the *top* suggestion at 4.5 — "Reflection #9 — Care, accepting,
     * embracing" is due that day — with `exam` at 4.29 behind it. So the card
     * this asserts is the strongest one the app had to offer that night, and
     * it was the one being thrown away.
     *
     * A fixed clock rather than the real one because the sample's dates are
     * fixed: `new Date()` passes today and stops meaning anything in January.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 5, 21, 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => {
      root = createRoot(host);
    });
    // Mounted and let to settle: the store hydrates from storage after mount
    // and the sample's courses arrive with it, so a synchronous render gets
    // `FirstRun` and every assertion below passes on a screen that is not the
    // screen. `screens/studyhierarchy.test.tsx` has the long version.
    await act(async () => {
      root.render(
        <StoreProvider>
          <Study />
        </StoreProvider>,
      );
    });
    // The cards live under the Tools tab, which is `studyTab: 'ask'`. Clicked
    // rather than seeded, so the route a student takes is the route tested.
    const tools = [...host.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Tools',
    );
    expect(tools, 'no Tools tab on the study screen').toBeTruthy();
    await act(async () => {
      tools!.click();
    });
  });

  // No root outlives the test that made it. See `src/rootunmount.test.ts`.
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('is the real tools tab, which is the control', () => {
    // Without this the two below could both pass on an empty tab, on
    // `FirstRun`, or on a tab that never opened.
    expect(host.textContent).toContain('Because of this fortnight');
    expect(host.textContent).toContain('Everything the app can do with a course');
  });

  it('draws the strongest suggestion of the evening, which used to vanish', () => {
    // "Work on it" is `work`'s label in the registry. Against a revert — the
    // cards resolved out of the grid's two shelves again — this goes red and
    // the control above stays green, which is the pair that says the card was
    // dropped rather than never suggested.
    expect(host.textContent).toContain('Work on it');
  });

  it('quotes the deadline that asked for it, not the blurb', () => {
    /*
     * The card's second line is `why`, which names the row it came from, and
     * that is the discipline the whole file is written to — "a recommendation
     * with no reason is an instruction". A card drawn with the registry blurb
     * instead would still say "Work on it" and pass the test above.
     */
    expect(host.textContent).toContain('the brief broken into a rubric, a plan and dates');
    expect(host.textContent).toContain('Reflection #9');
  });
});
