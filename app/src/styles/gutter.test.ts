import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Everything that spans the pane keeps its words on the column.
 *
 * The app has one content column — `.pane-body`, capped at `--measure` and
 * centred — and a set of bands that deliberately do not: the header, the
 * sample-semester banner, the shelves. Their backgrounds and hairlines have
 * to reach both edges, because an edge that stops short of the window reads
 * as a rendering fault. Their *words* have to line up with the column
 * underneath, because otherwise they line up with nothing.
 *
 * The header had that rule and was the only thing that had it. Measured in
 * Chromium at 1600px with the rail, where the column runs 456–1416:
 *
 *     header      486 – 1386     the column's own gutter
 *     banner      288 – 1584     168px outside it, both sides
 *     shelves      14 – …        at the window edge
 *     collapse all   – 1398      12px out, from a literal 18
 *
 * — so a ten-point caps sentence was set on a 1,124px line with its two
 * answers stranded a hundred and sixty-eight pixels past the content they
 * are about. It is not a matter of taste at that size; they were the only
 * things on the screen not aligned with anything.
 *
 * `.pane-strip` is the header's rule with a name, and the four now measure
 * 486–1386 together at 1600, 216–814 at 834 and 27–393 at 420.
 *
 * ## What this test can and cannot do
 *
 * It cannot measure any of that: the numbers above came from a browser, and
 * jsdom has neither media queries nor a cascade worth trusting. What it can
 * do — the same job `taps.test.ts` and `fields.test.ts` do for their own
 * fixes — is hold the mechanism, so the parts this depends on cannot be
 * edited away without a failure saying what they were for.
 */
const css = readFileSync('src/styles/app.css', 'utf8');

function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

/** The declarations inside the desktop rule that carries the gutter. */
function desktopGutter(): string {
  const at = css.indexOf('.device-pane .app-header,');
  expect(at, 'the header and the strip should share one rule').toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('the pane-spanning strips', () => {
  it('share the header\'s gutter rather than each having their own', () => {
    const rule = desktopGutter();
    expect(rule, '`.pane-strip` should be a selector on the header\'s own rule').toContain(
      '.device-pane .pane-strip',
    );
    // The expression, not just the class: a `.pane-strip` that resolved to a
    // fixed padding would line up at exactly one window width.
    expect(rule).toContain('calc((100% - var(--measure)) / 2 + var(--page-pad))');
    // And the canvas screens — the month grid, the map — run wider, so their
    // strips have to as well or the banner sits inside the calendar's left
    // edge instead of on it.
    const wide = css.slice(css.indexOf('.device-pane.has-canvas .app-header,'));
    expect(wide.slice(0, wide.indexOf('}'))).toContain('.device-pane.has-canvas .pane-strip');
  });

  it('is worn by the two strips that were measured out of line', () => {
    const files = tsx('src');
    const wearing = files.filter((f) => /className="[^"]*\bpane-strip\b/.test(readFileSync(f, 'utf8')));
    const names = wearing.map((f) => f.replace(/^src\//, ''));
    expect(names).toContain('components/SampleMark.tsx');
    expect(names).toContain('components/nav/ShelfNav.tsx');
  });

  /**
   * The gutter is a token everywhere it is set, because it is three numbers.
   *
   * `--page-pad` and `--chrome-pad` are 18 on a phone, 20 on a tablet and 30
   * on a desktop. Every literal 18 written where one of them belongs is a
   * rule that is right on a phone and wrong on the other two — which is how
   * the header came to sit two pixels left of its own screen on an iPad, and
   * "Collapse all" twelve pixels right of the column on a laptop. Both read
   * correctly in the source, which is why neither was ever found by reading.
   */
  it('sets no gutter as a literal where the token exists', () => {
    const header = css.slice(css.indexOf('.app-header {'), css.indexOf('}', css.indexOf('.app-header {')));
    expect(header, '.app-header should take --chrome-pad').toContain(
      'padding-inline: var(--chrome-pad)',
    );

    const shell = readFileSync('src/components/shell/ShellBody.tsx', 'utf8');
    expect(shell, 'the collapse-all row should take --page-pad').toContain('var(--page-pad)');
    expect(shell, 'and not the 18 it was written as').not.toMatch(/padding(Left|Right): '18px'/);
  });
});
