import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

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
    // The eight the audit named, plus Today's grip, plus the two screens that
    // were built after it. Fewer than this means one was reverted without the
    // measurement being redone.
    expect(used.length, `only ${used.length} files use a tap class`).toBeGreaterThanOrEqual(12);
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
      // 17×16, one per section of Today, and the reason the measuring is
      // written down twice: the first version of this grip was the size of
      // the glyph, and on the first section its widened target came back
      // clipped to 18×45 by the card frame painted over it. Re-measured at
      // 390×844 against the running app: 32×45 for all five, stealing no
      // other control's taps. Half the target is off the left edge of the
      // screen, which is what the page's own margin leaves room for.
      'src/screens/Today.tsx',
      // 38×17, and it survived the audit that took 104 targets under 30px
      // down to none — because a walk of the screens never sees it. It is
      // drawn only inside a running gap session, behind a start button and
      // behind a browser that can speak. `tap-y` rather than `tap`, for the
      // reason the audit itself gives: the card counter shares its row, and
      // a target that grew sideways would reach across the gap towards it.
      'src/screens/Gap.tsx',
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
