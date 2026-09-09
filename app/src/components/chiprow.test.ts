import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A row that scrolls sideways says so.
 *
 * `.chiprow` hides its scrollbar, which is right for a row of pills and left
 * it with no way at all to say there was more beyond the edge. On Exam runway
 * — one chip per exam, so the row in the app most likely to overflow — the
 * fourth chip was cut through the middle of a course code at the screen edge,
 * which reads as a clipping fault rather than as an invitation. The exam
 * nobody could see was the one furthest out, and it gets worse with every
 * course added: four fit, six do not.
 *
 * The shelves had already answered it with a `mask-image` fade and a comment
 * saying why. This is that fade, told which end needs it — a `ChipRow`'s
 * first chip is usually the selected one, and a permanent fade across a
 * chrome-filled chip looks like a rendering bug rather than an edge.
 *
 * ## What this test can and cannot do
 *
 * It cannot see the fade: that needs a browser, and the three states were
 * checked in one (at rest `end`, mid-scroll `both`, at the far end `start`,
 * and `none` on Calendar where the row fits). What it can do is hold the
 * mechanism, the same job `taps.test.ts` and `gutter.test.ts` do for theirs.
 */
const css = readFileSync('src/styles/app.css', 'utf8');
const ui = readFileSync('src/components/ui.tsx', 'utf8');

describe('a chip row that overflows', () => {
  it('fades whichever ends have more past them', () => {
    for (const at of ['start', 'end', 'both']) {
      const rule = css.slice(css.indexOf(`.chiprow[data-more='${at}']`));
      expect(rule.slice(0, rule.indexOf('}')), `${at} should fade`).toContain('mask-image');
    }
    // Not `none`, and that is the point of naming the states rather than
    // masking always: a row whose chips all fit is the row it has always
    // been, unmasked, with the selected chip's own edge intact.
    expect(css).not.toContain(".chiprow[data-more='none']");
  });

  it('is the row itself that reports which, not the caller', () => {
    expect(ui, 'ChipRow should set data-more from its own measurement').toMatch(
      /className="chiprow" data-more=/,
    );
    expect(ui, 'and measure on resize as well as on scroll').toContain('new ResizeObserver');
  });

  /**
   * And there is one chip row, not one per screen.
   *
   * Exam runway drew its own: the same `.btn`, the same chrome fill when
   * chosen, the same `flex: none`, at 6px 11px instead of 5px 12px — the
   * shape the note on `PickChips` describes, where the fastest way to write a
   * chip is to copy the nearest one. Being a copy is what kept it out of
   * `.chiprow`, so the one row that actually overflowed was the one row with
   * neither the hidden scrollbar nor the fade.
   */
  it('is the component, on the screen that used to draw its own', () => {
    const runway = readFileSync('src/screens/Runway.tsx', 'utf8');
    expect(runway).toContain('<ChipRow');
    expect(runway, 'and no hand-rolled scroller left behind').not.toContain("overflowX: 'auto'");
  });
});
