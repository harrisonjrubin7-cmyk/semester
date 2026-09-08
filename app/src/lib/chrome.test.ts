import { describe, expect, it } from 'vitest';
import { FULLSCREEN, chromeFor, homeShape, navigationsDrawn } from './chrome';
import { NAVS, SHELLS, navOf } from './look';
import { DESTINATIONS } from './nav';
import type { NavMode, Screen } from './types';

const MODES = NAVS.map((n) => n.id as NavMode);
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
                  .filter(([k, v]) => v && k !== 'fab')
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

  it('gives every navigation a way to move, on both widths', () => {
    for (const nav of MODES) {
      const phone = chromeFor(nav, 'courses', false);
      const wide = chromeFor(nav, 'courses', true);
      // The feed is the one that carries its navigation on the home screen
      // rather than beside it, so away from home on a phone it has none —
      // which is its design, and is why it is named here rather than assumed.
      if (nav !== 'feed' && nav !== 'springboard') {
        expect(navigationsDrawn(phone), `${nav} on a phone`).toBe(1);
      }
      expect(navigationsDrawn(wide), `${nav} on a laptop`).toBe(1);
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
  });

  it('has an answer for every navigation there is', () => {
    for (const nav of MODES) expect(homeShape(nav)).toBeTruthy();
  });
});

describe('reading a navigation back', () => {
  it('keeps the four the app has', () => {
    expect(MODES).toEqual(['tabs', 'feed', 'springboard', 'shelves']);
    for (const nav of MODES) expect(navOf(nav)).toBe(nav);
  });

  /*
   * A stored value nothing recognises used to reach `App.tsx` untouched,
   * where every branch tested for a name it did not match — so the app drew
   * no navigation at all, on a phone, with no way off the screen.
   */
  it('falls back to the bar rather than to nothing', () => {
    expect(navOf('soft')).toBe('tabs');
    expect(navOf(undefined)).toBe('tabs');
    expect(navOf('')).toBe('tabs');
    expect(navigationsDrawn(chromeFor(navOf('nonsense'), 'home', false))).toBe(1);
  });
});
