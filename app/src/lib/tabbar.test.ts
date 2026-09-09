import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TABS,
  FEWEST,
  FEWEST_CHOSEN,
  MOST,
  MOST_CHOSEN,
  PINNED,
  choosable,
  hasRoom,
  litRailTab,
  litTab,
  moveTab,
  readTabs,
  tabLabel,
  toggleTab,
  whyNot,
} from './tabbar';
import { DESTINATIONS } from './nav';
import type { Screen } from './types';

describe('the bar as it ships', () => {
  it('fits the bar, and deliberately does not fill it', () => {
    // This used to assert the default was exactly `MOST`, which encoded "the
    // bar ships full". It ships with the four screens the app is for plus the
    // way to everything else; Map and Personal are a tick away in Settings.
    expect(DEFAULT_TABS.length).toBeLessThan(MOST);
    expect(DEFAULT_TABS.length).toBeGreaterThanOrEqual(FEWEST);
  });

  it('is the four the app is for, and the way to the rest', () => {
    expect(DEFAULT_TABS).toEqual(['home', 'courses', 'study', 'calendar', 'me']);
  });

  it('ends on Me, which is where the other thirty-odd screens live', () => {
    expect(DEFAULT_TABS.at(-1)).toBe(PINNED);
  });

  it('holds only screens the directory knows about', () => {
    const known = new Set(DESTINATIONS.map((d) => d.screen));
    for (const s of DEFAULT_TABS) expect(known.has(s)).toBe(true);
  });

  it('offers every other screen to choose from, and not the pinned one', () => {
    const list = choosable();
    expect(list).not.toContain(PINNED);
    expect(list.length).toBe(DESTINATIONS.length - 1);
  });
});

describe('reading back what was stored', () => {
  it('takes a good list as it is, with Me put back on the end', () => {
    expect(readTabs(['home', 'study', 'essay'])).toEqual(['home', 'study', 'essay', PINNED]);
  });

  it('falls back on a first run, and on anything that is not a list', () => {
    expect(readTabs(undefined)).toEqual(DEFAULT_TABS);
    expect(readTabs(null)).toEqual(DEFAULT_TABS);
    expect(readTabs('home,study')).toEqual(DEFAULT_TABS);
    expect(readTabs({ 0: 'home' })).toEqual(DEFAULT_TABS);
  });

  it('drops a screen that no longer exists rather than rendering a dead button', () => {
    expect(readTabs(['home', 'wormhole', 'study', 'calendar'])).toEqual([
      'home',
      'study',
      'calendar',
      PINNED,
    ]);
  });

  it('drops a screen that has since merged into another', () => {
    /*
     * A saved bar outlives the app that wrote it. Grades was a destination
     * anybody could put in their bar, and is the grades grain of Courses now
     * — see `screens/Grades.tsx`. The stored id must not survive as a button
     * that goes nowhere, which is the same rule as the line above and worth
     * asserting against a real removal rather than a made-up one.
     */
    expect(readTabs(['home', 'grades', 'courses'])).toEqual(['home', 'courses', PINNED]);
  });

  it('drops a repeat, which two devices syncing can produce', () => {
    expect(readTabs(['home', 'study', 'home', 'calendar'])).toEqual([
      'home',
      'study',
      'calendar',
      PINNED,
    ]);
  });

  it('never lets Me appear twice, however it was stored', () => {
    const out = readTabs(['home', PINNED, 'study', 'calendar']);
    expect(out.filter((s) => s === PINNED)).toHaveLength(1);
    expect(out.at(-1)).toBe(PINNED);
  });

  it('trims a list too long for the bar instead of overflowing it', () => {
    const many = choosable().slice(0, 20);
    expect(readTabs(many)).toHaveLength(MOST);
  });

  it('falls back rather than rendering a bar with one button in it', () => {
    expect(readTabs([])).toEqual(DEFAULT_TABS);
    expect(readTabs(['home'])).toEqual(DEFAULT_TABS);
  });
});

describe('adding and taking away', () => {
  const three: Screen[] = ['home', 'study', PINNED];

  it('adds to the end, where a new thing is easiest to find', () => {
    expect(toggleTab(three, 'essay')).toEqual(['home', 'study', 'essay', PINNED]);
  });

  it('takes one out and keeps Me last', () => {
    expect(toggleTab(['home', 'study', 'essay', PINNED], 'study')).toEqual([
      'home',
      'essay',
      PINNED,
    ]);
  });

  it('will not empty the bar out', () => {
    const floor: Screen[] = ['home', 'study', PINNED];
    expect(floor.length - 1).toBe(FEWEST_CHOSEN);
    expect(toggleTab(floor, 'home')).toEqual(floor);
    expect(whyNot(floor, 'home')).toMatch(/at least/);
  });

  it('will not overfill it', () => {
    const full = [...choosable().slice(0, MOST_CHOSEN), PINNED];
    expect(hasRoom(full)).toBe(false);
    const next = choosable()[MOST_CHOSEN];
    expect(toggleTab(full, next)).toEqual(full);
    expect(whyNot(full, next)).toMatch(/Take one out/);
  });

  it('says nothing when the tap would have worked', () => {
    expect(whyNot(three, 'essay')).toBe('');
    expect(whyNot(['home', 'study', 'essay', PINNED], 'essay')).toBe('');
  });

  it('refuses to remove Me, and says why', () => {
    expect(toggleTab(DEFAULT_TABS, PINNED)).toEqual(DEFAULT_TABS);
    expect(whyNot(DEFAULT_TABS, PINNED)).toMatch(/Me stays/);
  });
});

describe('reordering', () => {
  const bar: Screen[] = ['home', 'study', 'calendar', PINNED];

  it('moves one along', () => {
    expect(moveTab(bar, 'calendar', -1)).toEqual(['home', 'calendar', 'study', PINNED]);
    expect(moveTab(bar, 'home', 1)).toEqual(['study', 'home', 'calendar', PINNED]);
  });

  it('does nothing at either end', () => {
    expect(moveTab(bar, 'home', -1)).toEqual(bar);
    expect(moveTab(bar, 'calendar', 1)).toEqual(bar);
  });

  it('leaves Me where it is', () => {
    expect(moveTab(bar, PINNED, -1)).toEqual(bar);
    expect(moveTab(bar, 'nothere' as Screen, 1)).toEqual(bar);
  });
});

describe('which tab lights up', () => {
  it('lights the screen itself, not the tab it files under', () => {
    // The bug this function exists for. Essay files under Study in the
    // directory, so `rootOf('essay')` is 'study' — and a student who put
    // Essay in the bar and then opened it would watch Study light up
    // instead, next to the unlit tab they had just pressed.
    expect(litTab('essay', ['home', 'study', 'essay', PINNED])).toBe('essay');
  });

  it('lights the tab a nested screen sits under', () => {
    // A flashcard three levels down still shows you are inside Study.
    expect(litTab('drill', DEFAULT_TABS)).toBe('study');
  });

  it('lights nothing rather than something arbitrary', () => {
    // Nothing in the bar covers the calendar, so the bar says so by going
    // dark rather than leaving Today lit on a screen that is not Today.
    expect(litTab('calendar', ['home', 'study', PINNED])).toBeNull();
  });
});

describe('which tab the rail lights', () => {
  // What the rail draws below the bar, and so what it must not file under a
  // tab. Same list App.tsx builds, minus anything already in the bar.
  const LISTED: Screen[] = ['ask', 'import', 'account', 'connect', 'settings'];

  it('lights no tab for a screen the rail lists itself', () => {
    // The bug this exists for. `rootOf('settings')` is 'me', which the rail
    // labels Progress — so standing on Settings lit Progress, gave it the
    // current-page pill and told a screen reader Progress was the page you
    // were on, while the Settings row you had just pressed took a colour
    // shift and nothing else.
    expect(litTab('settings', DEFAULT_TABS)).toBe(PINNED);
    expect(litRailTab('settings', DEFAULT_TABS, LISTED)).toBeNull();
  });

  it('does the same for the others that were pointing at the wrong row', () => {
    // Ask Claude filed under Study, Account under Me. Both were checked in a
    // browser against the deployed build before this was written.
    expect(litRailTab('ask', DEFAULT_TABS, LISTED)).toBeNull();
    expect(litRailTab('account', DEFAULT_TABS, LISTED)).toBeNull();
  });

  it('still lights the tab a genuinely nested screen sits under', () => {
    // Drill is not a rail entry, so nothing changes for it: the rail has no
    // row of its own to point at, and Study is the honest answer.
    expect(litRailTab('drill', DEFAULT_TABS, LISTED)).toBe('study');
  });

  it('leaves a screen that is in the bar alone', () => {
    // A student who puts Ask Claude in the bar has it filtered out of the
    // rail's extras, so it is a tab like any other and lights itself.
    expect(litRailTab('ask', ['home', 'study', 'ask', PINNED], [])).toBe('ask');
  });

  it('agrees with litTab wherever the rail lists nothing', () => {
    // The tab bar's behaviour is the fallback, not a separate rule.
    for (const screen of ['home', 'drill', 'calendar', 'settings'] as Screen[]) {
      expect(litRailTab(screen, DEFAULT_TABS, [])).toBe(litTab(screen, DEFAULT_TABS));
    }
  });
});

describe('what the bar says', () => {
  it('takes the label from the one list of places', () => {
    expect(tabLabel('home')).toBe('Today');
    expect(tabLabel('maps')).toBe('Map');
  });

  it('every screen that can go in the bar has a name that fits it', () => {
    // Seven across 402px is about 57px each, and at the bar's 9px uppercase
    // with 0.06em tracking that runs out around nine characters — "CALENDAR",
    // at eight, was already the one that nearly wrapped. This is the guard
    // that stops a new screen being added to the directory with a sentence
    // for a label and quietly making the bar two rows tall.
    const tooLong = choosable().filter((s) => tabLabel(s).length > 9);
    expect(tooLong.map((s) => `${s}: ${tabLabel(s)}`)).toEqual([]);
  });
});

/**
 * A bar saved before a screen was deleted.
 *
 * `readTabs` has always dropped screens it does not recognise, and `lately`
 * has always skipped a recent entry with no registry row. Neither was written
 * for a particular removal, which is why neither needed changing when
 * `everything` was folded into Progress — but "it happens to work" and "it is
 * checked" are different states, and the second is the one that survives
 * somebody optimising the loop.
 *
 * `everything` is used here as the name of a screen that no longer exists.
 * The point is not that screen: it is that a phone which last synced before
 * any deletion still gets a bar it can use.
 */
describe('a bar saved before a screen was removed', () => {
  const GONE = 'everything' as never;

  it('drops the screen that is no longer in the registry', () => {
    expect(readTabs(['home', GONE, 'courses', 'calendar'])).toEqual([
      'home',
      'courses',
      'calendar',
      PINNED,
    ]);
  });

  it('falls back to the default bar rather than rendering a stub', () => {
    // Below FEWEST_CHOSEN once the dead one is dropped, which is the case that
    // would otherwise leave somebody with a one-button navigation.
    expect(readTabs([GONE, 'home'])).toEqual(DEFAULT_TABS);
  });

  it('keeps the pinned tab whatever the saved list held', () => {
    expect(readTabs([GONE])).toEqual(DEFAULT_TABS);
    expect(readTabs(['home', 'courses', 'study', GONE])).toContain(PINNED);
  });
});
