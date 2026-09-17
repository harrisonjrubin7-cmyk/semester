import { describe, expect, it } from 'vitest';
import { FULLSCREEN, chromeFor, firstScreen, homeShape, navigationsDrawn, usesBar } from './chrome';
import { DEFAULT_NAV, NAVS, SHELLS, navOf } from './look';
import { DESTINATIONS } from './nav';
import { DEFAULT_PERSISTED } from '../state/shape';
import type { NavMode, Screen } from './types';

const MODES = NAVS.map((n) => n.id as NavMode);
/*
 * The navigations that carry their own way to move on the screen instead of
 * beside it. Named, never inferred: "draws no chrome" is indistinguishable
 * from the bug this file exists to catch — a navigation nothing draws —
 * unless the list of deliberate ones is written down.
 *
 * The feed and the springboard are home screens you tap through, so away from
 * home on a phone they have none. The guides go further and have none at
 * either width: the grid of courses and the grid of study modes are the
 * navigation, they wrap to whatever width they are given, and a rail beside a
 * screen whose own navigation is already visible is the doubling this file is
 * about. See the head of `chrome.ts`.
 */
const CARRIES_ITS_OWN: NavMode[] = ['feed', 'springboard', 'guides'];
/** Every screen the registry knows, plus the ones that keep the display. */
const SCREENS: Screen[] = [
  ...new Set<Screen>([...DESTINATIONS.map((d) => d.screen), ...FULLSCREEN, 'home']),
];

describe('the navigation rule', () => {
  /*
   * The whole reason this file exists.
   *
   * The app shipped with the soft layout drawing its own two rows of pills on
   * top of whichever navigation was already there — a tab bar on a phone, a
   * rail on a laptop. Two navigations, live at once, in one app. Nothing
   * could have caught it, because the rule was four conditions in four files
   * and no file could see the other three.
   */
  it('never draws two navigations, in any combination', () => {
    const doubled: string[] = [];
    for (const nav of MODES) {
      for (const screen of SCREENS) {
        for (const wide of [false, true]) {
          const chrome = chromeFor(nav, screen, wide);
          if (navigationsDrawn(chrome) > 1) {
            doubled.push(
              `${nav} on ${screen} (${wide ? 'wide' : 'phone'}): ${
                Object.entries(chrome)
                  .filter(([k, v]) => v && k !== 'sidebar')
                  .map(([k]) => k)
                  .join(' + ')
              }`,
            );
          }
        }
      }
    }
    expect(doubled).toEqual([]);
  });

  /*
   * The layout is the other axis and must stay silent on this one. It has no
   * parameter here — that is the assertion. If a layout ever needs to change
   * which navigation is drawn, it will have to be added to this signature,
   * and this comment is where somebody will read why they should not.
   */
  it('is decided by the navigation alone, never by the layout', () => {
    const args = chromeFor.length;
    expect(args, 'chromeFor takes nav, screen and width — and no layout').toBe(3);
    expect(SHELLS.map((s) => s.id)).toEqual(['plain', 'grouped', 'soft']);
  });

  // The exempt ones are `CARRIES_ITS_OWN` at the top of this file, with the
  // reason each is on it.
  it('gives every navigation a way to move, on both widths', () => {
    for (const nav of MODES) {
      if (CARRIES_ITS_OWN.includes(nav)) continue;
      expect(navigationsDrawn(chromeFor(nav, 'courses', false)), `${nav} on a phone`).toBe(1);
      expect(navigationsDrawn(chromeFor(nav, 'courses', true)), `${nav} on a laptop`).toBe(1);
    }
  });

  /*
   * And the ones that carry their own are held to actually having one.
   *
   * Without this the exemption above is a hole: adding a navigation to
   * `CARRIES_ITS_OWN` would silence the only test that checks it leads
   * anywhere. The feed and the springboard are their home screen, so that is
   * where they are asserted. The guides are asserted on a guide as well,
   * because that is the screen they hand the whole display to and the one
   * where "no chrome" would strand somebody if the mode grid were ever
   * folded away — `screens/Guide.tsx` holds it open for this reason.
   */
  it('leaves the ones that carry their own with a screen that does', () => {
    for (const nav of CARRIES_ITS_OWN) {
      for (const wide of [false, true]) {
        expect(navigationsDrawn(chromeFor(nav, 'home', wide)), `${nav} at home`).toBeLessThanOrEqual(1);
      }
    }
    // The guides' two screens are the whole of the guides: the courses, and
    // one course. Neither may pick up chrome, at either width.
    for (const screen of ['home', 'guide'] as Screen[]) {
      for (const wide of [false, true]) {
        expect(navigationsDrawn(chromeFor('guides', screen, wide)), `guides on ${screen}`).toBe(0);
      }
    }
  });

  it('gives the whole display to a drill, a lesson and a deck', () => {
    for (const nav of MODES) {
      for (const screen of FULLSCREEN) {
        for (const wide of [false, true]) {
          expect(navigationsDrawn(chromeFor(nav, screen, wide)), `${nav} on ${screen}`).toBe(0);
        }
      }
    }
  });

  /*
   * The workspace's sidebar is the wide half of one navigation, not a second
   * one — the same relationship the rail has to the tab bar. Asserted rather
   * than left to the count above, which would go on passing if `sidebar` were
   * ever drawn on a phone as well as the strip.
   */
  it('unrolls the workspace into a sidebar only where there is room', () => {
    expect(chromeFor('workspace', 'courses', false).sidebar).toBe(false);
    expect(chromeFor('workspace', 'courses', true).sidebar).toBe(true);
    expect(chromeFor('workspace', 'courses', true).rail).toBe(false);
    for (const nav of MODES.filter((n) => n !== 'workspace')) {
      expect(chromeFor(nav, 'courses', true).sidebar, nav).toBe(false);
    }
  });

  /*
   * There was a test here for the import button on the feed's home screen.
   *
   * The button is gone — it drew a `Plus` under a header that draws a `Plus`,
   * two of the same mark on one screen meaning different things, and the note
   * where `fab` used to be in `chrome.ts` has the argument. What replaces the
   * test is the opposite claim, held here because this is the file that knows
   * every combination: `Chrome` is now navigation and nothing else, so every
   * member of it is counted by the invariant rather than exempt from it.
   */
  it('has no member that is not a navigation', () => {
    /*
     * Every member, and every one of them counted by `navigationsDrawn` —
     * except `sidebar`, which is the wide expression of `desk` rather than a
     * navigation of its own, cannot be on without it, and is documented as
     * the exception in `chrome.ts`.
     *
     * Written as the key list rather than as a `fab` check so that it holds
     * the rule and not one member's absence. It has already earned that once:
     * `browser` arrived as a seventh navigation while this branch was open,
     * and this test is what said so. `browser` has since gone again —
     * `SIMPLIFY-AUDIT.md` E4 — which is the same rule read the other way, and
     * the list is still the thing being kept rather than either event.
     */
    const COUNTED = ['desk', 'rail', 'shelves', 'tabs'];
    for (const nav of MODES) {
      for (const wide of [true, false]) {
        const c = chromeFor(nav, 'home', wide);
        expect(Object.keys(c).sort(), `${nav} ${wide}`).toEqual([...COUNTED, 'sidebar'].sort());
        if (c.sidebar) expect(c.desk, `${nav} ${wide}`).toBe(true);
        // The list above is the invariant's list, not a second copy of it:
        // anything counted must be here, and anything here must be counted.
        const on = COUNTED.filter((k) => c[k as keyof typeof c]).length;
        expect(navigationsDrawn(c), `${nav} ${wide}`).toBe(on);
      }
    }
  });
});

describe('the home screen', () => {
  it('is the one the navigation calls for', () => {
    expect(homeShape('springboard')).toBe('springboard');
    expect(homeShape('feed')).toBe('feed');
    expect(homeShape('tabs')).toBe('today');
    expect(homeShape('shelves')).toBe('today');
    // The workspace's home screen is Today, like the bar's. Where it differs
    // is where the app *lands*, which is the next test — and the two being
    // separate is what stops the Today row in its sidebar opening the search
    // page instead of Today.
    expect(homeShape('workspace')).toBe('today');
    // The one home that is not a reading of the day: the courses themselves.
    expect(homeShape('guides')).toBe('guides');
  });

  it('has an answer for every navigation there is', () => {
    for (const nav of MODES) expect(homeShape(nav)).toBeTruthy();
  });

  it('lands the top-chrome navigation on its search page and everything else on home', () => {
    // The workspace opens the way a browser opens on a new tab, rather than on
    // the last page you read. Every other navigation opens on the day.
    //
    // There were two of these until the seventh pass. `browser` was a second
    // shell of the same shape — see E4 in `SIMPLIFY-AUDIT.md` — and the list
    // is a list rather than an equality so that a third would read as an
    // addition here rather than as a rewrite.
    const onSearch: NavMode[] = ['workspace'];
    for (const nav of onSearch) expect(firstScreen(nav), nav).toBe('search');
    for (const nav of MODES.filter((n) => !onSearch.includes(n))) {
      expect(firstScreen(nav), nav).toBe('home');
    }
  });
});

describe('reading a navigation back', () => {
  it('keeps the six the app has', () => {
    expect(MODES).toEqual([
      'tabs',
      'feed',
      'springboard',
      'shelves',
      'workspace',
      'guides',
    ]);
    for (const nav of MODES) expect(navOf(nav)).toBe(nav);
  });

  it('lands a saved navigation that no longer exists on the workspace', () => {
    /*
     * The migration this removal did not need.
     *
     * `browser` was a seventh navigation until the seventh pass — a second
     * browser-shaped shell beside `workspace`, 1213 lines against 708 (E4 in
     * `SIMPLIFY-AUDIT.md`). Somebody using it has `nav: 'browser'` in their
     * saved copy, and the survivor is the one they should land on rather than
     * the tab bar, because it is the same shape: chrome at the top, a tab
     * strip, a search field that owns the window.
     *
     * `navOf` did that by its fallback being the workspace, so no migration
     * step was written — and this test warned that it "would be an easy line
     * to simplify to `'tabs'` one day". Moving the default to the tab bar was
     * that day, and it arrived as a default rather than as a simplification,
     * which is worse: nobody was editing this line at all.
     *
     * So the two questions are separated now. `RETIRED` in `lib/look.ts`
     * answers "what was this closest to" and the default answers "this cannot
     * be read at all". The first two lines below are the halves that used to
     * be one line, and they no longer give the same answer.
     */
    expect(navOf('browser'), 'a retired navigation lands on its own shape').toBe('workspace');
    expect(navOf('a navigation that never existed'), 'an unreadable one lands on the default').toBe(
      DEFAULT_NAV,
    );
    expect(navOf(undefined)).toBe(DEFAULT_NAV);
  });

  /*
   * A stored value nothing recognises used to reach `App.tsx` untouched,
   * where every branch tested for a name it did not match — so the app drew
   * no navigation at all, on a phone, with no way off the screen.
   *
   * The name it falls back to is the app's default, which is the workspace;
   * what this holds is the invariant under it, which is that *something* is
   * drawn. The last line is the one that matters and the one that would have
   * caught the original bug.
   */
  it('falls back to the default rather than to nothing', () => {
    /*
     * Against `DEFAULT_NAV` rather than the default's name. This block has
     * now been rewritten three times by a default moving under it — to the
     * guides, back to the workspace, and on to the tab bar — every time
     * because it wrote the name down. It is the same fault `navOf` itself
     * had, one file over, and the same fix.
     */
    expect(navOf('soft')).toBe(DEFAULT_NAV);
    expect(navOf(undefined)).toBe(DEFAULT_NAV);
    expect(navOf('')).toBe(DEFAULT_NAV);
    // A name every branch matches, and a home screen the app knows how to
    // draw. The line under this one is what "rather than to nothing" means
    // now that the default draws no chrome of its own.
    expect(MODES).toContain(navOf('nonsense'));
    expect(homeShape(navOf('nonsense'))).toBeTruthy();
  });

  /*
   * The fallback lands somebody somewhere with a way on. Written so it stays
   * true whichever navigation the default is next.
   *
   * This assertion has now been rewritten twice by a default moving under it,
   * which is the argument for its present shape. It began as
   * `navigationsDrawn(...) === 1`, correct while every default drew a bar or
   * a strip and wrong the moment the default became the guides, which draw
   * none. It was then pinned to the guides — and the default moved back to
   * the workspace, breaking it again in the other direction.
   *
   * So it asserts neither shape. A navigation is a way on if it draws chrome
   * *or* its home screen is itself the navigation, the way the guides' course
   * grid and the springboard's icons are. Exactly one of those must hold —
   * `or` rather than `>= 0`, which would assert nothing, and exclusive
   * because drawing chrome beside a screen that is already a navigation is
   * the doubling `chrome.ts` exists to stop. The bug being guarded against is
   * landing somebody nowhere, on a phone, with no way off the screen.
   */
  it('falls back somewhere with a way on, whatever the default is', () => {
    const fallback = navOf('nonsense');
    const drawn = navigationsDrawn(chromeFor(fallback, 'home', false)) > 0;
    const carriesItsOwn = CARRIES_ITS_OWN.includes(fallback);
    expect(drawn || carriesItsOwn, `${fallback} offers no way on`).toBe(true);
    expect(drawn && carriesItsOwn, `${fallback} draws a navigation twice`).toBe(false);
    expect(homeShape(fallback)).toBeTruthy();
  });

  /*
   * And the fallback is the default, rather than the two drifting apart.
   *
   * They were the same value for a reason and then were not: the default
   * moved to the workspace while the fallback stayed on the bar, so a corrupt
   * key put somebody on a navigation the app no longer opens as. Asserted
   * against `DEFAULT_PERSISTED` rather than against the literal, so the next
   * change to the default cannot leave this behind again.
   */
  it('falls back to whatever the app actually defaults to', () => {
    expect(navOf('nonsense')).toBe(DEFAULT_PERSISTED.nav);
  });

  /*
   * And whoever offers to arrange the bar offers it wherever there is one.
   *
   * Settings asked `nav === 'tabs'`, which is the navigation named after the
   * bar rather than the set of navigations that draw one. The feed and the
   * springboard draw the same list as the rail on a wide window, so those two
   * had a rail built out of a list they were given no way to arrange — and a
   * control that would plainly have worked was simply missing. Asked of
   * `chromeFor` here, so it cannot drift from the rule again.
   */
  it('offers the bar\u2019s own list to every navigation that draws one', () => {
    for (const nav of MODES) {
      const draws = chromeFor(nav, 'home', false).tabs || chromeFor(nav, 'home', true).rail;
      expect(usesBar(nav), `${nav} disagrees about whether it has a bar`).toBe(draws);
    }
    expect(MODES.filter(usesBar)).toEqual(['tabs', 'feed', 'springboard']);
  });
});
