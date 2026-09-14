import { describe, expect, it } from 'vitest';
import { FULLSCREEN, chromeFor, firstScreen, homeShape, navigationsDrawn } from './chrome';
import { NAVS, SHELLS, navOf } from './look';
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
                  .filter(([k, v]) => v && k !== 'fab' && k !== 'sidebar')
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

  it('puts the import button on the feed’s home screen and nowhere else', () => {
    expect(chromeFor('feed', 'home', false).fab).toBe(true);
    expect(chromeFor('feed', 'courses', false).fab).toBe(false);
    expect(chromeFor('feed', 'home', true).fab).toBe(false);
    for (const nav of MODES.filter((n) => n !== 'feed')) {
      expect(chromeFor(nav, 'home', false).fab, nav).toBe(false);
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

  it('lands the two top-chrome navigations on their search page and everything else on home', () => {
    // Both open the way a browser opens on a new tab, rather than on the last
    // page you read. Every other navigation opens on the day.
    const onSearch: NavMode[] = ['workspace', 'browser'];
    for (const nav of onSearch) expect(firstScreen(nav), nav).toBe('search');
    for (const nav of MODES.filter((n) => !onSearch.includes(n))) {
      expect(firstScreen(nav), nav).toBe('home');
    }
  });
});

describe('reading a navigation back', () => {
  it('keeps the seven the app has', () => {
    expect(MODES).toEqual([
      'tabs',
      'feed',
      'springboard',
      'shelves',
      'workspace',
      'browser',
      'guides',
    ]);
    for (const nav of MODES) expect(navOf(nav)).toBe(nav);
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
    expect(navOf('soft')).toBe('workspace');
    expect(navOf(undefined)).toBe('workspace');
    expect(navOf('')).toBe('workspace');
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
});
