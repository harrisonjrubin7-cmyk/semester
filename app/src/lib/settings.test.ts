import { beforeEach, describe, expect, it } from 'vitest';
import {
  SETTINGS,
  SETTINGS_SCREENS,
  findSetting,
  isSettingsPage,
  lights,
  markLooking,
  nothingFound,
  rowFor,
  sectionOf,
  takeLooking,
} from './settings';
import { ROOTS } from '../state/shape';
import { rootOf } from './nav';

beforeEach(() => {
  takeLooking();
});

describe('the index', () => {
  it('fits on a phone: four sections, ten rows', () => {
    // The whole point of the change. An index that scrolls is the screen it
    // was meant to replace with an extra tap in front of it.
    expect(SETTINGS).toHaveLength(4);
    expect(SETTINGS_SCREENS.length).toBeLessThanOrEqual(10);
  });

  it('names a screen exactly once', () => {
    expect(new Set(SETTINGS_SCREENS).size).toBe(SETTINGS_SCREENS.length);
  });

  it('says what each page holds, so the row is not a guess', () => {
    for (const section of SETTINGS) {
      expect(section.rows.length).toBeGreaterThan(0);
      for (const row of section.rows) {
        expect(row.holds.length).toBeGreaterThan(10);
        expect(row.keywords.split(/\s+/).length).toBeGreaterThan(5);
      }
    }
  });

  it('keeps the app’s voice: no exclamation marks anywhere', () => {
    const all = SETTINGS.flatMap((s) => [s.header, s.footer ?? '', ...s.rows.map((r) => r.holds)]);
    for (const line of all) expect(line).not.toContain('!');
  });
});

describe('where the pages sit', () => {
  it('is never a root, because a tab must not land on one', () => {
    for (const screen of SETTINGS_SCREENS) expect(ROOTS).not.toContain(screen);
  });

  it('keeps the tab bar on Me, two taps deep', () => {
    // The bar changing out from under somebody inside settings is how the
    // back stack stops making sense.
    for (const screen of SETTINGS_SCREENS) expect(rootOf(screen)).toBe('me');
  });

  it('knows its own pages and nothing else', () => {
    expect(isSettingsPage('setLook')).toBe(true);
    expect(isSettingsPage('home')).toBe(false);
    expect(isSettingsPage('settings')).toBe(false);
  });

  it('can say which section a page belongs to', () => {
    expect(sectionOf('setLook')).toBe('General');
    expect(sectionOf('setGrading')).toBe('Academic');
    expect(sectionOf('home')).toBe('');
    expect(rowFor('setAbout')?.label).toBe('About');
  });
});

describe('searching it', () => {
  it('finds the page by the word people actually use', () => {
    // Nobody searches "ground" for dark mode, and nobody searches "typeface"
    // for a font. Matching only the label is how a search box teaches people
    // it does not work.
    expect(findSetting('dark')[0].row.screen).toBe('setLook');
    expect(findSetting('font')[0].row.screen).toBe('setLook');
    expect(findSetting('notifications')[0].row.screen).toBe('setAlerts');
    expect(findSetting('backup')[0].row.screen).toBe('setStorage');
    expect(findSetting('gpa')[0].row.screen).toBe('setGrading');
  });

  it('puts an exact page name first', () => {
    const hits = findSetting('colour and type');
    expect(hits[0].row.label).toBe('Colour and type');
  });

  /*
   * "Appearance" stopped being a page name when the shape of the app — which
   * navigation, which layout — moved onto one page with the navigation, and
   * the colour page took the name that says what is on it. The word is still
   * what people type, so it stays a keyword, and this is the check that it
   * still lands somewhere sensible rather than nowhere.
   */
  it('still finds the page a retired name used to open', () => {
    expect(findSetting('appearance')[0].row.screen).toBe('setLook');
  });

  it('says which word it matched, so the page can light the right group', () => {
    expect(findSetting('dark')[0].matched).toBe('dark');
    expect(findSetting('colour and type')[0].matched).toBe('Colour and type');
  });

  it('says which section a hit lives in', () => {
    expect(findSetting('gpa')[0].section).toBe('Academic');
  });

  it('finds nothing on one letter, rather than everything', () => {
    // The index is already on the screen underneath; repeating it is not an
    // answer to anything.
    expect(findSetting('')).toEqual([]);
    expect(findSetting('d')).toEqual([]);
  });

  it('names the thing that was not found', () => {
    expect(nothingFound('  wifi ')).toContain('wifi');
    expect(nothingFound('wifi')).toContain('screen it belongs to');
  });
});

describe('the word that travels with the jump', () => {
  it('is read once and then gone', () => {
    markLooking('Dark');
    expect(takeLooking()).toBe('dark');
    expect(takeLooking()).toBe('');
  });

  it('lights the group that declares it, not the one whose heading says it', () => {
    expect(lights('accent ground colour dark light theme', 'dark')).toBe(true);
    expect(lights('accent ground colour dark light theme', 'font')).toBe(false);
  });

  it('matches a prefix, so "font" finds "fonts"', () => {
    expect(lights('font fonts typeface heading', 'font')).toBe(true);
  });

  it('lights nothing when nobody searched', () => {
    expect(lights('accent ground', '')).toBe(false);
  });
});
