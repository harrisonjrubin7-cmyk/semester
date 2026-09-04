import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TABS,
  FEWEST_CHOSEN,
  MOST,
  MOST_CHOSEN,
  PINNED,
  choosable,
  hasRoom,
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
  it('is the length the layout was built for', () => {
    expect(DEFAULT_TABS).toHaveLength(MOST);
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
