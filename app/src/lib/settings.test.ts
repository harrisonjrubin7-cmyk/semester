import { beforeEach, describe, expect, it } from 'vitest';
import { findSetting, isSettingsPage, lights, markLooking, nothingFound, SETTINGS, SETTINGS_SCREENS, settingsTitle, takeLooking } from './settings';
import { ROOTS } from '../state/shape';
import { rootOf } from './nav';

beforeEach(() => {
  takeLooking();
});

describe('the index', () => {
  it('fits on a phone: four sections, eleven rows', () => {
    // The whole point of the change. An index that scrolls is the screen it
    // was meant to replace with an extra tap in front of it.
    //
    // Eleven, not ten. Ten was the count on the day this was written rather
    // than a measurement, and the assistant's settings had to land somewhere
    // real when the Ask tab became the conversation. The arithmetic: a row is
    // ROW_HEIGHT (44px), a section header about 28, and the search box 40 —
    // so 11 × 44 + 4 × 28 + 40 comes to 636, against roughly 700px of body on
    // a 402 × 874 phone once the header and the tab bar are taken off. A
    // twelfth row is where this genuinely starts to scroll, and the next one
    // after that should merge two rows rather than raise this number again.
    expect(SETTINGS).toHaveLength(4);
    expect(SETTINGS_SCREENS.length).toBeLessThanOrEqual(11);
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
});

/*
 * A page's name was in three places — this registry, the `title` the page
 * hands `SettingsPage`, and a switch in `App.tsx` — and had already drifted:
 * the header bar said "Appearance" over a page calling itself "Colour and
 * type". This is the check that there is one name.
 */
describe('what a page is called', () => {
  it('names every settings page, from the registry', () => {
    for (const row of SETTINGS.flatMap((s) => s.rows)) {
      expect(settingsTitle(row.screen), row.screen).toBe(row.short ?? row.label);
      expect(settingsTitle(row.screen).length).toBeGreaterThan(0);
    }
  });

  it('says nothing about a screen that is not a settings page', () => {
    expect(settingsTitle('home')).toBe('');
    expect(settingsTitle('courses')).toBe('');
  });

  it('keeps the short name short enough for a bar with three icons in it', () => {
    for (const row of SETTINGS.flatMap((s) => s.rows)) {
      expect(settingsTitle(row.screen).length, row.screen).toBeLessThanOrEqual(20);
    }
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
    // "Backup" lands on the screen that measures the bytes and links the
    // copies, which is the Data screen since Settings stopped counting them
    // a second time.
    expect(findSetting('backup')[0].row.screen).toBe('data');
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

  /*
   * The keywords are written in phrases — "tab bar", "line height", "quiet
   * hours" — and were split on whitespace before being matched, so a query
   * with a space in it was compared against a list of single words and could
   * never hit. Every one of these was in the keywords, word for word, and
   * returned nothing.
   */
  it('finds a phrase, not just a single word', () => {
    expect(findSetting('tab bar')[0]?.row.screen).toBe('setNav');
    expect(findSetting('text size')[0]?.row.screen).toBe('setLook');
    expect(findSetting('line height')[0]?.row.screen).toBe('setLook');
    expect(findSetting('quiet hours')[0]?.row.screen).toBe('setAlerts');
  });

  /*
   * "soft" is one of the three layouts. It used to return Connected accounts
   * first, because that page's summary says "Microsoft" and a plain substring
   * test cannot tell the middle of a word from the start of one.
   */
  it('ranks a word ahead of the middle of a longer word', () => {
    expect(findSetting('soft')[0]?.row.screen).toBe('setNav');
    // Still found, just not first: a partial word is sometimes all somebody
    // can remember.
    expect(findSetting('soft').map((f) => f.row.screen)).toContain('connect');
  });

  it('finds each navigation and each layout by its own name', () => {
    for (const name of ['tabs', 'feed', 'springboard', 'shelves', 'drawn', 'grouped', 'soft']) {
      expect(findSetting(name)[0]?.row.screen, name).toBe('setNav');
    }
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
