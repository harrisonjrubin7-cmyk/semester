import { describe, expect, it } from 'vitest';
import { sheets, withoutComments } from '../styles/rules';

/**
 * When you move by keyboard, something has to show you where you are.
 *
 * Found by tabbing through all eighty-one screens in a real browser rather
 * than by reading the source. 144 controls on 75 screens took focus with
 * nothing drawn at all: the assistant button on nearly every screen, every
 * search field, the study-mode tiles, the university portal's thirty-odd
 * doors, the Create tiles, the Pathway tabs.
 *
 * None of them was missing a rule. The rule was there and something was
 * beating it, because the ring was carried on `box-shadow` — the one property
 * an element is most likely to be using already:
 *
 *   - an inline `boxShadow` outranks any stylesheet rule, whatever its
 *     specificity. `styles/fields.test.ts` documents the identical trap on
 *     `font-size`, and it is the same fix in the other direction: there the
 *     inline value had to go, here the rule moves to a property nothing sets
 *     inline.
 *   - `box-shadow: none !important` on `.portal-search input` in
 *     `features.css`, which erased it on every search field in the app.
 *
 * So the ring is an `outline` now. Measured rather than assumed, in the same
 * browser: it follows `border-radius`, it is drawn outside the box so focusing
 * moves no geometry, `outline-offset` keeps it off a neighbour, and it
 * survives an `overflow: hidden` ancestor — which the box-shadow ring did not.
 *
 * What this test holds is the thing a browser sweep cannot be run often
 * enough to hold: that the ring is still on a property nothing else in the app
 * is fighting over.
 */

const CSS = sheets('src/styles').map((s) => ({ path: s.path, text: withoutComments(s.text) }));

/** Every rule in the app's stylesheets, as selector plus its declarations. */
function rules(): { file: string; selector: string; body: string }[] {
  const out: { file: string; selector: string; body: string }[] = [];
  for (const { path, text } of CSS) {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim().replace(/\s+/g, ' ');
      if (!selector || selector.startsWith('@')) continue;
      out.push({ file: path, selector, body: m[2] });
    }
  }
  return out;
}

const ALL = rules();

/*
 * The one rule that is allowed to switch the outline off on itself, because it
 * puts the same ring on the element it draws instead. A home-screen icon is a
 * transparent button wrapped around a tile, so a ring on the button sits a
 * long way outside the thing you can see.
 */
const DRAWS_IT_ELSEWHERE = /^\.appicon:focus-visible$/;

/*
 * `:focus:not(:focus-visible)` is the opposite claim, and reads as its own
 * negation if you only look for the substring: it matches a control focused by
 * a mouse and *not* by the keyboard. Switching the outline off there is the
 * idiom for "bare on a click, ringed on a Tab" — the composer uses it — so the
 * selector's real subject is whatever survives having every `:not(...)`
 * removed.
 */
const targets = (selector: string): boolean =>
  /:focus-visible/.test(selector.replace(/:not\([^()]*\)/g, ''));

describe('the focus ring', () => {
  it('is on a property nothing sets inline', () => {
    const ring = ALL.find((r) => r.selector === '.device :focus-visible');
    expect(ring, 'the app-wide :focus-visible rule').toBeDefined();
    expect(ring!.body, 'the ring must be an outline').toMatch(/outline:\s*\d/);
    expect(ring!.body, 'and must not switch the outline off').not.toMatch(/outline:\s*none/);
  });

  it('is offset, so it does not sit on the control it marks', () => {
    const ring = ALL.find((r) => r.selector === '.device :focus-visible')!;
    expect(ring.body).toMatch(/outline-offset:/);
  });

  /*
   * The regression this pass actually found, stated as a rule: a control may
   * style its own focus, but it may not leave the keyboard with nothing.
   */
  it('is not switched off by any other rule without being redrawn', () => {
    const offenders = ALL.filter((r) => targets(r.selector))
      .filter((r) => /outline:\s*none/.test(r.body))
      .filter((r) => !DRAWS_IT_ELSEWHERE.test(r.selector))
      .map((r) => `${r.file}: ${r.selector}`);
    expect(offenders, 'these take the ring away and put nothing back').toEqual([]);
  });

  it('is still drawn for the one rule that moves it to a child', () => {
    const moved = ALL.find((r) => DRAWS_IT_ELSEWHERE.test(r.selector));
    expect(moved, 'the allowance is for a rule that exists').toBeDefined();
    const child = ALL.find((r) => r.selector.startsWith('.appicon:focus-visible ') && /outline:\s*\d/.test(r.body));
    expect(child, '.appicon:focus-visible must draw the ring on its tile').toBeDefined();
  });

  /*
   * Guards the assertions above. `withoutComments` and the rule regex are
   * doing real work; were either to stop matching, every list above would be
   * empty and every test would pass on nothing.
   */
  it('is a stylesheet this test can still read', () => {
    expect(ALL.length).toBeGreaterThan(400);
    expect(ALL.filter((r) => targets(r.selector)).length).toBeGreaterThanOrEqual(6);
    // And that the `:not()` stripping has not quietly swallowed everything.
    expect(targets('.device :focus-visible')).toBe(true);
    expect(targets('.x:focus:not(:focus-visible)')).toBe(false);
  });
});
