// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { Study } from './Study';
import { DESTINATIONS } from '../lib/nav';

/**
 * One filled action at the top of Study, and nothing lost to get it.
 *
 * The UI audit's complaint was a wall of equal-weight buttons, and the wall
 * was six hand-written pills directly beneath the screen's one filled action,
 * wrapping 3-2-1 at phone width. What made it a wall was not the ordering: it
 * was drawing six things at one weight immediately under the thing that is not
 * their equal.
 *
 * Every one of the six had another home, and five answered to a different name
 * there — `AI Tutor` was `Ask Claude`, `Practice exam` was `Practice paper`,
 * `Exam planner` was `Exam runway`, `Study groups` was `Group work`,
 * `Citations & evidence` was `Sources`. Three of those homes are the Tools tab
 * on this same screen, which is generated from `lib/nav.ts` and ranked by
 * `lib/toolnow.ts` against what is actually due.
 *
 * ## Why both halves are checked here
 *
 * Because a deletion is only right if nothing goes with it, and the two facts
 * fail independently. The row could come back without anything else changing,
 * and a destination could stop being registered while the row stays gone — and
 * either on its own reads as fine. So: the wall is absent, *and* every screen
 * it named is still somewhere a student can reach.
 *
 * The count is asserted rather than the absence of one class name, so that
 * re-adding the same six under a new wrapper fails too.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/**
 * Mounted and then let to settle, which is not optional here.
 *
 * The store hydrates from storage *after* mount and the sample term's courses
 * arrive with it, so a synchronous `act` renders the empty-catalogue branch —
 * `Study` returns `<FirstRun where="to study" />` when `catalog.empty`, which
 * has neither the filled action nor the row, and every assertion below passes
 * on a screen that is not the screen. The control at the end of the first
 * block is what caught that; this is the fix. `screens/grades.test.tsx` does
 * the same for the same reason.
 */
async function show(node: ReactNode) {
  await act(async () => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

/**
 * Filled buttons that compete to be *the* action on the screen.
 *
 * A form's own submit is not one of them, and the journal has one — "Save
 * journal entry", filled, inside `.study-journal`. That is a different kind of
 * primary: it commits the text in the box above it and means nothing without
 * it, where "Create study guide" is an offer the screen makes on arrival.
 * Counting it would have made this assertion false about a screen that reads
 * correctly, which is how a test starts being edited to fit the code.
 */
function filled(): string[] {
  /*
   * Both spellings of filled, and the second was added because this file
   * missed four buttons for a month.
   *
   * `portal-primary` is the class on the studio entry at the top. `ActionButton
   * tone="primary"` renders `btn btn-primary`, and that is what every course
   * card used to draw its recommendation with — so "offers one action on
   * arrival, not seven" was asserted against a screen that offered five, and
   * passed, because it could only see one of the two tiers. A term of four
   * courses drew **Create study guide** and then **Start reading** four times,
   * all filled, all identical below the first.
   *
   * A guard scoped to one class name is a guard about that class name. The
   * question it is meant to ask is what the screen looks like it wants you to
   * do, and there is more than one way to say that in this stylesheet.
   */
  return [...host.querySelectorAll('button')]
    .filter((b) => /\b(portal-primary|btn-primary)\b/.test(b.className.toString()))
    .filter((b) => !b.closest('.study-journal'))
    .map((b) => (b.textContent ?? '').trim());
}

/** Everything pressable, by the words on it. */
function pressable(): string[] {
  return [...host.querySelectorAll('button')].map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
}

// See `screens/deadends.test.tsx` — the store pulls the shipped courses in
// with a dynamic import it does not await, and a promise still in flight when
// the file ends fails the run on teardown rather than on an assertion.
beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

// No root outlives the test that made it. See `src/rootunmount.test.ts`.
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('the top of the study screen', () => {
  it('offers one action on arrival, not seven', async () => {
    await show(<Study />);
    expect(filled()).toEqual(['Create study guide']);
  });

  it('and one per screen rather than one per card, with four courses on it', async () => {
    /*
     * The half the first version of this could not see, kept separate because
     * it fails for its own reason and names it.
     *
     * Each course card ranks its own recommendation above its own
     * alternatives, which is right — `lib/nextstep.ts` computes it and the
     * card is where it belongs. What it cannot also be is *the* action, and
     * with four courses the screen said so four times. `nextstep` gives a
     * course with nothing started the same answer as the next one, so the four
     * were not even four different offers: they were the words **Start
     * reading** drawn four times in filled white down one phone screen, under
     * a fifth filled button that says something else.
     *
     * They are `btn-secondary` now — still first in the card, still full width
     * at 44px, still above the small uppercase alternatives. The ranking is
     * intact; it stopped competing with the screen.
     */
    await show(<Study />);
    const courses = [...host.querySelectorAll('.blueprint')].length;
    expect(courses, 'no course cards rendered, so this asserts nothing').toBeGreaterThan(1);
    expect(filled().length, `${courses} cards drew ${filled().length} filled actions`).toBe(1);
  });

  it('while each card still ranks its own recommendation above its own ways', async () => {
    /*
     * The control on the test above, and the reason it is not satisfied by
     * deleting the button.
     *
     * "One filled action" is trivially true of a screen whose cards offer
     * nothing. What the change actually did was move a rung down, so the rung
     * has to still be there: a `btn-secondary` inside the card, above the
     * plain `.btn` alternatives that sit under it.
     */
    await show(<Study />);
    const card = [...host.querySelectorAll('.blueprint')].find((el) =>
      [...el.querySelectorAll('button')].some((b) => /\bbtn-secondary\b/.test(b.className.toString())),
    );
    expect(card, 'no course card ranks anything any more').toBeTruthy();
    const tiers = [...card!.querySelectorAll('button')].map((b) => b.className.toString());
    expect(tiers.some((c) => /\bbtn-secondary\b/.test(c)), 'the recommendation is gone').toBe(true);
    expect(
      tiers.filter((c) => /\bbtn\b/.test(c) && !/btn-(primary|secondary|ghost|icon)/.test(c)).length,
      'the alternatives under it are gone too',
    ).toBeGreaterThan(1);
  });

  it('no longer draws the six-pill row under it', async () => {
    await show(<Study />);
    const said = pressable();
    /*
     * By the words that were on them. The class name is gone too, but a test
     * that only asked about `.study-next-actions` would pass the day somebody
     * pastes the same six buttons back under a different wrapper — which is
     * how the row arrived in the first place.
     */
    for (const gone of [
      'AI Tutor',
      'Practice exam',
      'Exam planner',
      'New course note',
      'Study groups',
      'Citations & evidence',
    ]) {
      expect(said, `"${gone}" is back on the study screen`).not.toContain(gone);
    }
  });

  it('is the real study screen, which is the control', async () => {
    /*
     * The control, and it has already earned its place: the first version of
     * this file mounted synchronously, got the empty-catalogue branch, and the
     * two assertions above passed on `FirstRun` — a screen with no filled
     * action and no row, where "the wall is gone" is true and means nothing.
     *
     * So this asserts the screen is the one with courses on it.
     */
    await show(<Study />);
    expect(host.textContent).toContain('Create study guide');
    expect(host.textContent, 'mounted the empty-catalogue branch').not.toContain(
      'Start with a syllabus',
    );
    expect(pressable().length).toBeGreaterThan(5);
  });
});

describe('nothing the row named became unreachable', () => {
  const registered = new Set(DESTINATIONS.map((d) => d.screen));

  /*
   * The three that were aliases for tools on this screen's own Tools tab.
   *
   * That tab is built from `destinationsIn('Study')` and
   * `destinationsIn('Make')`, so being in the Study group is what puts them in
   * the grid — and the grid is what `lib/toolnow.ts` ranks. Asserting the
   * group rather than the grid's markup keeps this about reachability rather
   * than about how the tab happens to draw today.
   */
  it.each([
    ['ask', 'Ask Claude'],
    ['exam', 'Practice paper'],
    ['runway', 'Exam runway'],
  ])('%s is still a Study tool, under its own name (%s)', (screen, label) => {
    const d = DESTINATIONS.find((x) => x.screen === screen);
    expect(d, `${screen} is no longer a destination`).toBeTruthy();
    expect(d!.group).toBe('Study');
    expect(d!.label).toBe(label);
  });

  /*
   * The two that were pulled onto Study from other groups. They keep their own
   * homes; what they lost is a shortcut that called them something else.
   */
  it.each([
    ['groupwork', 'Campus', 'Group work'],
    ['sources', 'Courses', 'Sources'],
  ])('%s is still reachable in %s, as "%s"', (screen, group, label) => {
    const d = DESTINATIONS.find((x) => x.screen === screen);
    expect(d, `${screen} is no longer a destination`).toBeTruthy();
    expect(d!.group).toBe(group);
    expect(d!.label).toBe(label);
  });

  it('and the probe can tell a registered screen from an unregistered one', () => {
    /*
     * The control for the five above: a `DESTINATIONS` lookup that matched
     * anything — or a `find` that never returned undefined — would pass every
     * one of them. The cast is the point rather than a workaround: `Screen` is
     * a closed union, so an unregistered name cannot be written without one,
     * and that is itself worth seeing here.
     */
    expect(registered.has('ask')).toBe(true);
    expect(registered.has('no-such-screen' as (typeof DESTINATIONS)[number]['screen'])).toBe(false);
    expect(registered.size).toBeGreaterThan(20);
  });
});
