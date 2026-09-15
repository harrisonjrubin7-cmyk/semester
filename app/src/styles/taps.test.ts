import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sources } from './rules';

/**
 * Small controls declare which way their target may grow.
 *
 * An audit of every screen at 390px found 104 tap targets under 30px: three
 * copies of the reorder arrows at 26×23, the sample-semester banner's two
 * answers at 112×20, ADD and EDIT at 30×17, the insight cards' one way out at
 * 108×17. A fingertip is about 44px and does not shrink to match a nine-pixel
 * caps label.
 *
 * The fix is `tap`, `tap-x` and `tap-y` in `app.css`: a transparent overlay
 * that grows the *target* to 44px while leaving the *drawing* exactly as it
 * was. The axis is named at each site rather than assumed, because an overlay
 * that reaches in every direction is worse than a small target — two controls
 * 6px apart would each claim the other's space and the later one in the DOM
 * would win.
 *
 * ## What this test can and cannot do
 *
 * It cannot measure pixels: that needs a browser, and the measuring was done
 * in one (an iPhone 14 profile against the deployed build, 104 → 0 targets
 * under 24×24, with an overlap check confirming no expanded target collides
 * with another). What it can do is hold the mechanism in place — that the
 * three classes still exist, still only grow, and are still used — so a
 * later edit cannot quietly delete the rule and leave the class names sitting
 * inertly in the markup.
 */
const css = readFileSync('src/styles/app.css', 'utf8');

/** The files this rule reads. `styles/rules.ts` walks; this names. */
const tsx = (dir: string): string[] => sources(dir, { tests: false }).map((s) => s.path);

describe('tap targets', () => {
  it('defines the three, and each grows one way or both', () => {
    for (const c of ['.tap::after', '.tap-x::after', '.tap-y::after']) {
      expect(css, `${c} is missing`).toContain(c);
    }
    // `max(100%, 44px)` and never a bare 44px: a control already big enough
    // keeps its own size, so this can never shrink one.
    // From the first tap rule to the next selector after it. Not
    // `indexOf('.tappable {')` from the start of the file: `.device
    // .tappable {` appears 90 lines earlier and contains that substring, so
    // the slice came back empty and the assertions inside it all passed on
    // nothing — a test that cannot fail, which is worse than no test.
    const from = css.indexOf('.tap::after');
    const grows = css.slice(from, css.indexOf('.tappable {', from));
    expect(grows.length, 'the tap rules should sit together, above .tappable').toBeGreaterThan(200);
    expect(grows).toContain('max(100%, 44px)');
    expect(grows, 'tap-y must not grow sideways').toMatch(/\.tap-y::after \{[^}]*width: 100%/);
    expect(grows, 'tap-x must not grow up and down').toMatch(/\.tap-x::after \{[^}]*height: 100%/);
  });

  it('is actually worn by the controls that were measured too small', () => {
    // `className="… tap …"` or a `className:` on a props object — the grip on
    // Today is spread onto its button rather than written as an attribute,
    // and a regex that only knew the attribute form reported it as bare.
    const used = tsx('src').filter((f) =>
      /className[=:]\s*["'`][^"'`]*\btap(-[xy])?\b/.test(readFileSync(f, 'utf8')),
    );
    // The eight the audit named, plus the two screens that were built after
    // it. Fewer than this means one was reverted without the measurement
    // being redone.
    //
    // Two are deliberately not among them any more — Today's grip and Gap's
    // Aloud button — because both stopped borrowing a target and took a real
    // one. An overlay is invisible to a checker, which reads the element and
    // is right to; see the test below.
    expect(used.length, `only ${used.length} files use a tap class`).toBeGreaterThanOrEqual(10);
    for (const must of [
      'src/components/SampleMark.tsx',   // 112×20, on 65 screens
      'src/components/Reorder.tsx',      // 26×23, three lists
      'src/components/TabChooser.tsx',   // 28×23
      'src/components/InsightCards.tsx', // 108×17 and 193×17
      'src/components/Insights.tsx',     // 24×17
      'src/screens/Links.tsx',           // 30×17
      // 102×19 — the sign-in links, which moved off the account screen into
      // the form both it and the first run now render.
      'src/components/Credentials.tsx',
      'src/App.tsx',                     // 115×23, the way up to a course
      /*
       * Two screens the audit could not have seen, because neither existed
       * when it ran, and both went straight back under the floor it cleared.
       *
       * The map's three controls — where you are, everything at once, bigger
       * — measured 68×17, 43×17 and 42×17, and the "GO →" beside every stop
       * 29×17. The chat's whole chrome — back, the history, a new thread, the
       * key — is four more at 17px tall, and one of them, SET A KEY, is the
       * control that makes the assistant work at all.
       *
       * Growing the map's row is also why it now sits at `--sp-7` rather than
       * `--sp-4` below the map: Leaflet's attribution link is three pixels
       * above the map's bottom edge, and a 44px target centred on a 17px
       * label reached two pixels over it.
       */
      'src/screens/Maps.tsx',
      'src/ai/Chat.tsx',
    ]) {
      expect(used, `${must} lost its tap class`).toContain(must);
    }
  });

  /*
   * The one place an overlay could not do the job, and what it cost to find
   * out.
   *
   * Today's grip was 17×16 with `tap` around it. That overlay is 44×44
   * centred on the glyph, so it reaches 22px below the middle — and half of
   * Today's sections fold, which makes their heading a button 296×25 across
   * the whole column, five pixels under the grip or touching it. Probed with
   * `document.elementFromPoint` at 420×900: the top 14px of "Due today" and
   * the top 8px of "Office hours worth going to" answered as the grip, so
   * tapping a heading to fold its section started a drag hold instead.
   *
   * `tap-x` stopped the theft and left the glyph 17×16, under the 24 WCAG 2.2
   * asks for — and the twenty-pixel gap the handle hung in has room for
   * neither 24×24 nor 24px of clearance, so no overlay of any axis could have
   * finished it. It is in the flow now, at a real 24×24, where it can overlap
   * nothing above or below by construction.
   *
   * This cannot measure pixels — that needs a browser, and it was done in one
   * — but it can hold the shape: a box rather than an overlay, and the
   * heading's own margin out of the way so the handle's room is the air above
   * the heading rather than air on top of air.
   */
  it('gives Today’s grip a real target instead of an overlay', () => {
    const today = readFileSync('src/screens/Today.tsx', 'utf8');
    const grip = today.slice(today.indexOf('feed.grip('), today.indexOf('aria-label={`Move '));
    expect(grip, 'an overlay cannot reach 24px out of a 20px gap').not.toMatch(
      /className: '(tap|tap-x|tap-y)'/,
    );
    expect(grip, 'the handle should not be placed by arithmetic any more').not.toMatch(
      /position: 'absolute'/,
    );
    expect(css, 'the grip needs a box, not a glyph').toMatch(
      /\.grip \{[^}]*width: 24px;[^}]*height: 24px;/,
    );
    expect(css, 'the heading follows the handle, so its own margin goes').toMatch(
      /section\[data-drop\] > \.grip \+ \* \{[^}]*margin-top: 0/,
    );
  });

  /*
   * The navigation is the one control that changes shape with the layout, and
   * so the one that can be the right size on a phone and the wrong size on a
   * tablet without anybody touching it.
   *
   * The five destinations are 51px tall each in the tab bar under a phone's
   * thumb. Unrolled into the rail on an iPad they were 41, with the five
   * quiet rows below them — Ask Claude, Account, Settings — at 35, measured
   * in a browser at 820×1180 and 1194×834. Same hand, same finger, two thirds
   * of the target, on the one piece of chrome that is on screen the whole
   * time.
   *
   * The floor is on `pointer: coarse` rather than on a width, because it is
   * the input that decides it: an iPad at 1194 is in the desktop layout and
   * still has a finger on it, and a laptop window dragged to 820 is in the
   * tablet layout and does not.
   */
  it('gives the rail a finger-sized row wherever there is a finger', () => {
    // There is more than one coarse-pointer block in the sheet — the other
    // one is the 16px floor on fields, which is what stops iOS zooming when
    // one is focused — so this finds the block the rail is in rather than
    // the first one it meets.
    const blocks = [...css.matchAll(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/g)].map(
      (m) => m[1],
    );
    const rail = blocks.find((b) => b.includes('.rail .rail-item'));
    expect(rail, 'the rail is not sized for touch anywhere').toBeDefined();
    // A floor, not a height: the text-size setting still grows the row.
    expect(rail).toMatch(/\.rail \.rail-item \{[^}]*min-height: 44px/);
    expect(rail).not.toMatch(/\.rail \.rail-item \{[^}]*[^-]height: 44px/);
  });

  /*
   * The chips are the deliberate exception, and it is worth a test because it
   * looks like an omission. `ChipRow` and `Segmented` are 25–29px tall, which
   * clears the 24×24 WCAG 2.2 AA asks for, and screens stack them: Calendar
   * puts a `Segmented` directly above a `ChipRow`. Growing both to 44px made
   * their targets overlap by 4px, and in that band the lower row won a tap
   * meant for the upper one. Measured, reverted, and written down here.
   */
  it('leaves the chip rows alone, on purpose', () => {
    const ui = readFileSync('src/components/ui.tsx', 'utf8');
    expect(ui).not.toMatch(/className="btn tap/);
    expect(ui, 'the reason should stay beside the decision').toMatch(/24×24|24x24/);
  });
});
