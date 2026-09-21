// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useScrolling } from './scrolling.hook';
import { tokensFor, GROUNDS } from './look';
import { PASSING } from './dim';

/**
 * The button fades while the page moves, and only then.
 *
 * `ai/Assistant.tsx`'s button is fixed to the viewport, so content passes
 * under an opaque 52px circle. The part of that which is a bug is already
 * settled by `bottomchrome.hook.ts` — the reservation guarantees the last
 * thing on a screen clears the button — and what is left is the moment of
 * passing. This is the hook that notices it.
 *
 * ## What each test is for
 *
 * Two are regression guards: the capturing listener, and the reduced-motion
 * opt-out. Both fail against a faithful revert, which was run rather than
 * assumed. The rest describe the timing so that a later change to it has to
 * be deliberate.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: boolean[];
let mounted = false;

/** Whatever `matchMedia` should answer for `prefers-reduced-motion`. */
let lessMotion = false;

function Probe() {
  seen.push(useScrolling());
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  seen = [];
  lessMotion = false;
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: /prefers-reduced-motion/.test(q) ? lessMotion : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  mounted = true;
});

afterEach(() => {
  if (mounted) act(() => root.unmount());
  mounted = false;
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const draw = () => act(() => root.render(<Probe />));
const now = () => seen[seen.length - 1];

/** A scroll on a child element — which is where they really happen, and which
 *  only reaches the document if the listener captures. */
function scrollSomething() {
  const inner = document.createElement('div');
  host.append(inner);
  act(() => {
    inner.dispatchEvent(new Event('scroll', { bubbles: false }));
  });
}

describe('while the page is moving', () => {
  it('starts settled', () => {
    draw();
    expect(now()).toBe(false);
  });

  /*
   * The first guard. Scroll events do not bubble, so a listener added without
   * `capture` hears nothing from the real scroller — `.scrollarea`, a child.
   * Drop `capture: true` from the hook and this is the test that goes red,
   * while every other one in the file still passes.
   */
  it('notices a scroll on a child element, not just on the document', () => {
    draw();
    scrollSomething();
    expect(now()).toBe(true);
  });

  it('settles again once the scrolling stops', () => {
    draw();
    scrollSomething();
    expect(now()).toBe(true);

    act(() => void vi.advanceTimersByTime(419));
    expect(now(), 'still moving a frame before the quiet period ends').toBe(true);

    act(() => void vi.advanceTimersByTime(2));
    expect(now()).toBe(false);
  });

  it('keeps the quiet period rolling while scrolling continues', () => {
    draw();
    scrollSomething();
    act(() => void vi.advanceTimersByTime(300));
    scrollSomething();
    act(() => void vi.advanceTimersByTime(300));
    expect(now(), 'a second scroll should have restarted the countdown').toBe(true);
  });

  /*
   * The second guard, and the one worth having. `prefers-reduced-motion`
   * collapses every transition in `app.css` to 0.001ms, so leaving the fade
   * on would blink the button on every scroll and again on every stop. Remove
   * the `prefersLessMotion()` early return and this goes red.
   */
  it('does nothing at all when less motion was asked for', () => {
    lessMotion = true;
    draw();
    scrollSomething();
    act(() => void vi.advanceTimersByTime(50));
    expect(now()).toBe(false);
  });

  /*
   * The control. Every assertion above turns on a scroll event having been
   * dispatched, and a hook that returned `true` from the moment it mounted
   * would satisfy several of them — so this is the one that says the value
   * comes from the event.
   */
  it('CONTROL: stays settled when time passes and nothing scrolls', () => {
    draw();
    act(() => void vi.advanceTimersByTime(5000));
    expect(now()).toBe(false);
  });
});

/**
 * The fade level itself, which is a token rather than a number so that the
 * contrast setting can reach it — the fault `lib/dim.ts` was written about.
 */
describe('how far it fades', () => {
  it('is named, not written into the component', () => {
    // `styles/rules.ts` counts a hand-written alpha against the file that
    // writes it, and that ledger may shrink and not grow. This is also the
    // only reason the value can respond to anything at all.
    expect(PASSING).toBe('var(--app-passing)');
  });

  it('fades by default', () => {
    expect(Number(tokensFor({})['--app-passing'])).toBeGreaterThan(0);
    expect(Number(tokensFor({})['--app-passing'])).toBeLessThan(0.5);
  });

  /*
   * The one worth having. A hand-written opacity is the thing `lib/dim.ts`
   * was written about: the contrast setting cannot reach it. This one it can,
   * and it takes the fade off completely.
   */
  it('does not fade at all when more contrast is asked for', () => {
    expect(tokensFor({}, true)['--app-passing']).toBe('1');
  });

  /*
   * Why it is its own token rather than `DIMMED_ROW`. Not because the two move
   * in opposite directions — they are both opacities and both rise under more
   * contrast — but because they are thresholds for different things, and only
   * one of them is a property of the ground.
   */
  it('is one number across every ground, unlike a dimmed row', () => {
    const passing = new Set(GROUNDS.map((g) => tokensFor({ ground: g.id })['--app-passing']));
    expect(passing.size, 'seeing through a circle does not change with the panel').toBe(1);

    const rowDim = new Set(GROUNDS.map((g) => tokensFor({ ground: g.id })['--app-row-dim']));
    expect(rowDim.size, 'CONTROL: the row token really is per-ground').toBeGreaterThan(1);
  });

  it('goes further than a dimmed row can, because it has nothing to say', () => {
    const loud = tokensFor({}, true);
    expect(loud['--app-passing']).toBe('1');
    expect(Number(loud['--app-row-dim']), 'a row still has to read as dimmed').toBeLessThan(1);
  });
});
