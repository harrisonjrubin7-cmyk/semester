import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The button's place and the room reserved for it are the same two numbers.
 *
 * `app.css` reserves `--assistant-strip` under every screen so nothing ends
 * up behind the assistant's button, and `Assistant.tsx` decides where the
 * button goes. Those agree only while both are written from the button's
 * footprint — 12px of gap, 52px of button, 12px more.
 *
 * They stopped agreeing. The button fell back to a bar's own height when
 * `--bottom-chrome` was unset, which is right for a window that has a bar and
 * wrong for one that has none: in the workspace shell it put the button 140px
 * above the bottom while the reservation went on being 76. The 64px between
 * them was the last card on Today, under an opaque circle, with no scroll
 * left to bring the words clear.
 *
 * A fallback of zero is what makes the two agree in all three shells, so it
 * is pinned here rather than trusted: the failure is a number that looks
 * plausible, and it shows up as covered words on one shell only.
 */
const BUTTON = readFileSync(new URL('./Assistant.tsx', import.meta.url), 'utf8');
const SHEET = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');

describe('the assistant button', () => {
  it('sits on the bottom chrome where there is some and on the edge where there is not', () => {
    const at = BUTTON.match(/bottom: wide \? [^\n]*var\(--bottom-chrome, ([^)]*)\)/);
    expect(at, 'the button is placed some other way now; re-point this test').toBeTruthy();
    expect(at![1].trim()).toBe('0px');
  });

  it('is reserved for by a strip that covers its whole footprint', () => {
    const strip = SHEET.match(/--assistant-strip: (\d+)px/);
    expect(strip).toBeTruthy();
    // 12 above the button, the 52px button, 12 below it.
    expect(Number(strip![1])).toBeGreaterThanOrEqual(12 + 52 + 12);
  });

  /*
   * And spends it somewhere it is actually counted.
   *
   * This asserted `padding-bottom` on `.scrollarea` and passed while the
   * reservation did nothing at all. `.pane-body` takes `height: 100%` to keep
   * the percentage-height chain intact, so a screen taller than the window
   * overflows it rather than sitting in the scroller's flow — and a scroll
   * container's end padding is not applied below content that overflows a
   * descendant. The rule was there, it computed 76px, and the space was
   * absent: at the bottom of Study the last line sat under the button with no
   * scroll left to bring it clear.
   *
   * Deleting the padding changed no measurement on any screen, which is what
   * proved it dead. So both halves are pinned here: the reservation is a box
   * after the content, and it is not padding on the scroller.
   */
  it('spends that strip under every screen that ends, where it is counted', () => {
    expect(SHEET).toMatch(/\.pane-body::after \{[^}]*height: var\(--assistant-strip\)/s);
  });

  it('and not as padding on the scroller, which the overflow walks straight past', () => {
    expect(SHEET).not.toMatch(/\.scrollarea \{[^}]*padding-bottom: var\(--assistant-strip\)/s);
  });
});

/**
 * And the strip reaches the bottom of a screen that is taller than one.
 *
 * `.pane-body` is `height: 100%` on purpose — it is what lets the chat's
 * column, the springboard and the slide frame resolve their own percentage
 * heights — so on any screen with more than a screenful in it the content
 * overflows that box rather than being laid out inside it. A scroll
 * container's end padding sits after its *in-flow* content, and the in-flow
 * content there ends at one screenful; the overflowing part runs past it.
 *
 * So the padding on `.scrollarea` was reserving nothing at all on exactly
 * the screens that need it. Measured on Today at 390x844 before the fix:
 * `.pane-body` 552px, the feed inside it 1,288px and overflowing, and the
 * last line of the last card under the button with no scroll left to bring
 * it clear.
 *
 * The pseudo-element is a child of `.pane-body` rather than a sibling, so it
 * follows the overflowing content in the same flow and carries the
 * reservation out to wherever that content really ends.
 */
describe('a screen taller than the window', () => {
  it('carries the reservation past what overflows the pane', () => {
    expect(SHEET).toMatch(/\.pane-body::after \{[^}]*height: var\(--assistant-strip\)/s);
    expect(SHEET).toMatch(/\.pane-body::after \{[^}]*content: ''/s);
  });

  it('does not reserve it on a screen that is the whole box', () => {
    // The button is not drawn on those — see `fills()` in `shell/exempt.ts` —
    // and 76px of nothing under a composer meant to sit on the bottom edge is
    // the fault `.is-filled` exists to avoid.
    expect(SHEET).toMatch(/\.scrollarea\.is-filled \.pane-body::after \{[^}]*content: none/s);
  });

  it('leaves the height that the percentage chain hangs off', () => {
    // `min-height` here instead would be the tempting fix and the wrong one:
    // a percentage height resolves against a definite parent, and this is
    // what makes it definite.
    expect(SHEET).toMatch(/\.pane-body \{[^}]*height: 100%/s);
  });
});
