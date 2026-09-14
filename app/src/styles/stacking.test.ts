import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The workspace's window-covering overlays cannot be mounted inside the pane.
 *
 * The workspace is the one layout with chrome painted *over* the body:
 * `.deskwork > .deskstrip` sits at 21 and `.desktop-bar` at 20, so the bar's
 * suggestions are not covered by the pane the moment they open. `.device > *`
 * puts every direct child — the body among them — at 1, and `isolation:
 * isolate` on `.device` closes the context around all of it.
 *
 * So an overlay mounted in the pane is inside that 1. Its own `z-index: 80`
 * is spent against its siblings inside the pane and cannot lift its parent,
 * which is the whole of the bug this file exists to stop: the capture box
 * opened under the tab strip and the search bar, the explanation showed with
 * no field above it, and a click where the field should be landed in the
 * bar's search box instead. The palette opened the same way, with two search
 * fields on screen at once and its Close button behind the strip.
 *
 * Nothing about that is visible to jsdom — there is no layout and no
 * painting — and it is invisible in the other two layouts, which have no
 * chrome over the body to lose to. So the rule is held on the source: in
 * `Workspace`, the three overlays are siblings of the strips, not
 * grandchildren of the body.
 *
 * Moving one back inside the pane is the easy mistake, because that is
 * exactly where it belongs on both other layouts — there the pane *is*
 * `.device`, and an overlay outside it would be drawn in none of the app's
 * own materials. Here the root is `.device`, so the scoping is satisfied
 * wherever in this subtree the overlay sits and only the stacking is not.
 */

const app = readFileSync('src/App.tsx', 'utf8');

/** The `Workspace` function's body, which is the only layout this is about. */
function workspace(): string {
  const from = app.indexOf('function Workspace(');
  expect(from, 'the workspace layout is still called `Workspace`').toBeGreaterThan(-1);
  const to = app.indexOf('\nfunction ', from + 1);
  return app.slice(from, to === -1 ? undefined : to);
}

/**
 * Where the pane's element starts and ends, by counting its `div`s.
 *
 * Every other element in there is a component, which closes with its own
 * name or with `/>`; `div` is the only tag this has to balance, so counting
 * the two spellings of it is enough to find the `</div>` that is the pane's
 * own rather than the first one after it.
 */
function pane(src: string): [number, number] {
  const start = src.indexOf('deskwork-pane');
  expect(start, 'the pane still carries `deskwork-pane`').toBeGreaterThan(-1);
  let depth = 1;
  for (const m of src.slice(start).matchAll(/<div\b|<\/div>/g)) {
    depth += m[0] === '<div' ? 1 : -1;
    if (depth === 0) return [start, start + (m.index ?? 0)];
  }
  throw new Error('the pane element is never closed');
}

/** The `zIndex: n` an overlay writes on the box that covers the window. */
function tops(file: string): number[] {
  return [...readFileSync(file, 'utf8').matchAll(/zIndex:\s*(\d+)/g)].map((m) => Number(m[1]));
}

/** A `z-index` from a rule in the sheet, by the selector that carries it. */
function layer(selector: string): number {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const at = css.indexOf(`${selector} {`);
  expect(at, `\`${selector}\` is still a rule in app.css`).toBeGreaterThan(-1);
  const said = /z-index:\s*(\d+)/.exec(css.slice(at, css.indexOf('}', at)));
  expect(said, `\`${selector}\` still sets a z-index`).not.toBeNull();
  return Number(said?.[1]);
}

describe('the workspace overlays', () => {
  const src = workspace();
  const [start, end] = pane(src);

  for (const tag of ['<Assistant', '<Command', '<QuickAdd']) {
    it(`mounts ${tag} beside the body rather than in the pane`, () => {
      const at = src.indexOf(tag);
      expect(at, `${tag} is still mounted in the workspace`).toBeGreaterThan(-1);
      expect(src.indexOf(tag, at + 1), `${tag} is mounted once`).toBe(-1);
      expect(at > start && at < end, `${tag} is inside .deskwork-pane`).toBe(false);
    });
  }

  it('draws them over the chrome that covers the body', () => {
    // The strips are above the body on purpose — the bar's suggestions were
    // painted over by the pane before they were raised — so this is the pair
    // the overlays have to clear, and clearing it is the point of the mount.
    const chrome = Math.max(layer('.deskwork > .deskstrip'), layer('.deskwork > .desktop-bar'));
    for (const file of ['src/components/QuickAdd.tsx', 'src/components/Command.tsx']) {
      expect(Math.max(...tops(file)), `${file} draws over the workspace chrome`).toBeGreaterThan(
        chrome,
      );
    }
  });
});

/**
 * The skip link has to win against the chrome it is drawn over.
 *
 * `.skip-link` declares `z-index: 100`, and `.device > *` — the blanket that
 * gives every direct child `position: relative` and `z-index: 1` — comes
 * later in `app.css` and weighs the same, so it takes both. The `position`
 * half of that was found and fixed once already; the note above
 * `.device > .skip-link` tells the story of the 42px band of empty black it
 * left above the header.
 *
 * The `z-index` half outlived it, because it has no wrong pixel to notice.
 * Unfocused the link is translated off the top of the window and paints
 * nothing, so the only state that shows the fault is the focused one — and
 * there it showed plainly: pressing Tab on the workspace put the focus ring
 * around a rectangle with the header and the tab strip painted over it, so
 * the words "Skip to content" were behind them. `document.elementFromPoint`
 * over the focused link returned `SPAN` and `BUTTON.btn` in five of the six
 * layout-and-width combinations measured at the time — one of those layouts
 * was the browser shell, which `SIMPLIFY-AUDIT.md` E4 has since removed. The
 * rule below is unchanged by that: it is held on `app.css`, which every
 * surviving layout wears.
 *
 * That is exactly the failure the comment over `.skip-link` names: a link a
 * sighted keyboard user cannot see is worse than no link, because they cannot
 * tell where their focus went. jsdom computes no stacking, so the rule is
 * held on the stylesheet.
 */
describe('the skip link', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');

  /*
   * Comments stripped first. The explanation inside `.device > .skip-link`
   * quotes the `z-index: 1` it exists to beat, and a rule that reads its own
   * documentation as a declaration would have passed while the bug was live.
   */
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, `\`${selector}\` is still in the sheet`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
  };

  it('is lifted above the siblings that draw the chrome', () => {
    const blanket = /z-index:\s*(\d+)/.exec(rule('.device > *'));
    const link = /z-index:\s*(\d+)/.exec(rule('.device > .skip-link'));
    expect(blanket, 'the blanket still sets a z-index to beat').not.toBeNull();
    expect(link, 'the skip link sets its own, rather than trusting .skip-link').not.toBeNull();
    expect(Number(link?.[1]), 'the focused link draws over the chrome').toBeGreaterThan(
      Number(blanket?.[1]),
    );
  });

  it('keeps the position the same rule took from it', () => {
    expect(rule('.device > .skip-link'), 'absolute, not in the flow').toMatch(/position:\s*absolute/);
  });
});
