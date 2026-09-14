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
 * The browser shell's home overlay must not swallow the shell under it.
 *
 * The same shape of bug as the one above, and invisible in the same way. On
 * the browser shell's search home, the legacy home is mounted in
 * `.g-home-legacy` — `position: fixed`, `inset: 0`, `z-index: 50`, drawn
 * across the whole window *over* the shell's own wordmark, field, shortcuts
 * and footer. `pointer-events: none` on it is what makes that survivable:
 * the overlay is there to draw, not to catch.
 *
 * `.g-home-legacy .device > *` then puts pointer events back, so that what
 * the legacy home actually draws — a toast, the undo bar, a dialog — is still
 * clickable. Two of those direct children are `.deskwork-body` and, under it,
 * `.device-pane`: full-window layout containers that on this overlay draw
 * nothing at all, because `.g-home-legacy .scrollarea` is `display: none`.
 *
 * So the app had two invisible window-sized blocks catching every press at
 * z-index 50. Measured in a real browser: `document.elementFromPoint` over
 * the Customize Semester button returned `DIV.device-pane deskwork-pane`, and
 * the button — visible, hovering, the only control in the corner — could not
 * be clicked at all.
 *
 * jsdom has no layout and no hit-testing, so nothing about that is reachable
 * from a rendering test. The rule is held on the stylesheet instead: if the
 * blanket `> *` rule is there, the two containers have to be excused from it.
 */
describe('the browser shell home overlay', () => {
  const shell = readFileSync('src/components/google-shell.css', 'utf8');

  it('lets presses through to the shell it is drawn over', () => {
    expect(shell, 'the overlay itself still passes presses through').toMatch(
      /\.g-home-legacy\{[^}]*pointer-events:none/,
    );
  });

  it('excuses the full-window containers from the blanket rule', () => {
    // Only required while the blanket rule exists. If somebody removes it,
    // nothing re-enables hit-testing and this has nothing to guard.
    if (!shell.includes('.g-home-legacy .device>*{pointer-events:auto}')) return;
    expect(shell, '.deskwork-body and .device-pane still catch nothing').toMatch(
      /\.g-home-legacy \.deskwork-body,\.g-home-legacy \.device-pane\{pointer-events:none\}/,
    );
    // And what they contain has to stay clickable, or a toast on this screen
    // would be the thing that cannot be pressed instead.
    expect(shell, 'a toast inside the pane is still clickable').toMatch(
      /\.g-home-legacy \.device-pane>\*\{pointer-events:auto\}/,
    );
  });
});
