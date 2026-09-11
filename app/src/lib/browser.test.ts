// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_TABS,
  NEW_TAB,
  PLACE_ACTIONS,
  TABS_KEY,
  add,
  blank,
  close,
  current,
  dump,
  fresh,
  justGo,
  load,
  openBeside,
  placeFor,
  read,
  select,
  visit,
  write,
  type Strip,
  type Where,
} from './browser';
import { actionsFor } from './openhit';
import type { Hit } from './find';
import type { Screen } from './types';

/**
 * The rules of the strip, which are the rules of a browser.
 *
 * Every one of these is a thing people already expect because they have used
 * tabs somewhere else for twenty years, and every one of them is invisible
 * until it is wrong — a tab opening at the far end of the strip, an index
 * sliding under a close, the last tab leaving an empty bar with nothing in
 * it. Held here rather than noticed in use.
 */

/** Every screen this suite uses is a real one, so `known` can be honest. */
const known = (screen: string) =>
  ['home', 'calendar', 'courses', 'study', 'mine', 'me'].includes(screen);

const strip = (screens: (Screen | null)[], at = 0): Strip => ({
  tabs: screens.map((screen, i) => ({
    id: `t${i}`,
    screen,
    title: screen ?? NEW_TAB,
    place: screen ? justGo(screen) : [],
  })),
  at,
});

const names = (s: Strip) => s.tabs.map((t) => t.screen ?? NEW_TAB);

beforeEach(() => {
  localStorage.clear();
});

describe('the strip', () => {
  it('starts as one new tab', () => {
    const s = blank('t0');
    expect(s.tabs).toHaveLength(1);
    expect(current(s).screen).toBeNull();
    expect(current(s).title).toBe(NEW_TAB);
  });

  it('opens a new tab beside the one you are on, not at the end', () => {
    // Out of the second of three: the new one belongs third, because a strip
    // that appends is a strip with no order in it by the fourth tab.
    const s = add(strip(['home', 'calendar', 'courses'], 1), 'new');
    expect(names(s)).toEqual(['home', 'calendar', NEW_TAB, 'courses']);
    expect(s.at).toBe(2);
    expect(current(s).screen).toBeNull();
  });

  it('drops the oldest tab that is not in use once the strip is full', () => {
    const full = strip(Array.from({ length: MAX_TABS }, () => 'home' as Screen), 0);
    const s = add(full, 'new');
    expect(s.tabs).toHaveLength(MAX_TABS);
    // The one in use is kept, and the new one is the one you are on.
    expect(current(s).screen).toBeNull();
  });

  it('lands on the right-hand neighbour when the tab you are on closes', () => {
    const s = close(strip(['home', 'calendar', 'courses'], 1), 1);
    expect(names(s)).toEqual(['home', 'courses']);
    expect(current(s).screen).toBe('courses');
  });

  it('keeps you where you are when a tab to your left closes', () => {
    const s = close(strip(['home', 'calendar', 'courses'], 2), 0);
    expect(current(s).screen).toBe('courses');
  });

  it('keeps you where you are when a tab to your right closes', () => {
    const s = close(strip(['home', 'calendar', 'courses'], 0), 2);
    expect(current(s).screen).toBe('home');
  });

  it('leaves a new tab rather than an empty strip', () => {
    const s = close(strip(['home'], 0), 0);
    expect(s.tabs).toHaveLength(1);
    expect(current(s).screen).toBeNull();
  });

  it('records where the tab you are on has gone', () => {
    const s = visit(strip(['home', null], 1), 'calendar', 'Calendar', justGo('calendar'));
    expect(names(s)).toEqual(['home', 'calendar']);
    expect(current(s).title).toBe('Calendar');
  });

  it('is the same strip when the tab is already there', () => {
    // Reference equality, because this is called on every navigation and on
    // open: a new object each time is a re-render each time.
    const was = visit(strip([null], 0), 'calendar', 'Calendar', justGo('calendar'));
    expect(visit(was, 'calendar', 'Calendar', justGo('calendar'))).toBe(was);
  });

  it('opens beside without leaving the tab you were on', () => {
    const s = openBeside(strip(['home'], 0), 'study', 'Study', justGo('study'), 'new');
    expect(names(s)).toEqual(['home', 'study']);
    expect(s.tabs[0].screen).toBe('home');
    expect(s.at).toBe(1);
  });

  it('clamps a selection rather than throwing at a click', () => {
    expect(select(strip(['home', 'calendar'], 0), 9).at).toBe(1);
    expect(select(strip(['home', 'calendar'], 1), -3).at).toBe(0);
  });
});

describe('what survives being put away', () => {
  it('comes back as it was left', () => {
    const was = strip(['home', 'calendar'], 1);
    expect(load(dump(was), known)).toEqual(was);
  });

  it('drops a tab pointing at a screen this build has not got', () => {
    const saved = JSON.stringify({
      tabs: [
        { id: 'a', screen: 'home', title: 'Today', place: [{ type: 'go', screen: 'home' }] },
        { id: 'b', screen: 'somewhere-removed', title: 'Gone', place: [] },
      ],
      at: 1,
    });
    const s = load(saved, known);
    expect(names(s)).toEqual(['home']);
    // And the index comes back in range rather than pointing past the end.
    expect(current(s).screen).toBe('home');
  });

  it('answers with a blank strip rather than throwing on nonsense', () => {
    // The cost of a wrong answer here is a row of tabs. The cost of an
    // exception is a search box that will not open.
    expect(load('not json{', known).tabs).toHaveLength(1);
    expect(load(null, known).tabs).toHaveLength(1);
    expect(load('{"tabs":[]}', known).tabs).toHaveLength(1);
    expect(load('{"tabs":"nope"}', known).tabs).toHaveLength(1);
  });

  it('keeps a new tab, which has no screen to check', () => {
    const s = load(dump({ tabs: [fresh('a')], at: 0 }), known);
    expect(current(s).screen).toBeNull();
    expect(current(s).title).toBe(NEW_TAB);
  });

  it('goes through the store on the machine and back', () => {
    const was = strip(['home', 'study'], 1);
    write(was);
    expect(localStorage.getItem(TABS_KEY)).toBeTruthy();
    expect(read(known)).toEqual(was);
  });
});

/*
 * What a tab is allowed to carry, which is the part with teeth.
 *
 * A tab's place is dispatched when it is picked, and it comes off the device —
 * where an older build, a newer build or anybody with devtools open may have
 * written it. So the list of openers is a gate rather than documentation.
 */
describe('the place a tab carries', () => {
  const hit = (over: Partial<Hit>): Hit =>
    ({ kind: 'item', id: 'x', title: 't', sub: 's', tag: 'T', score: 1, ...over }) as Hit;
  const where: Where = {
    courseId: 'econ',
    itemId: 'econ-m1',
    eventId: 'e1',
    guideId: 'econ',
    noteId: 'n1',
    documentId: 'd1',
    sheetId: 's1',
    deckId: 'k1',
    mode: 'cards',
  };

  it('reopens the thing, not the kind of thing', () => {
    // The whole point of the strip: "Course" is not a place worth a tab.
    expect(placeFor('course', where)).toEqual([{ type: 'openCourse', id: 'econ' }]);
    expect(placeFor('item', where)).toEqual([{ type: 'openItem', id: 'econ-m1' }]);
    expect(placeFor('write', where)).toEqual([{ type: 'openDocument', id: 'd1' }]);
    expect(placeFor('deck', where)).toEqual([{ type: 'editDeck', id: 'k1' }]);
  });

  it('carries the mode a guide was being read in', () => {
    expect(placeFor('guide', where)).toEqual([{ type: 'openGuide', id: 'econ', mode: 'cards' }]);
  });

  it('takes two actions where one screen cannot say which of four it is', () => {
    expect(placeFor('quiz', where)).toEqual([
      { type: 'openGuide', id: 'econ', mode: 'cards' },
      { type: 'go', screen: 'quiz' },
    ]);
  });

  it('falls back to the screen when the app is holding no id', () => {
    const nothing: Where = {
      ...where,
      courseId: '' as Where['courseId'],
      itemId: '',
      documentId: null,
    };
    expect(placeFor('course', nothing)).toEqual([{ type: 'go', screen: 'course' }]);
    expect(placeFor('write', nothing)).toEqual([{ type: 'go', screen: 'write' }]);
  });

  it('says the same thing as a screen you are simply on', () => {
    expect(placeFor('calendar', where)).toEqual(justGo('calendar'));
  });

  it('refuses an action that is not one of the openers', () => {
    // The failure this list exists for: a strip edited by hand would
    // otherwise be a way to make the app do anything the reducer can do.
    const saved = JSON.stringify({
      tabs: [
        {
          id: 'a',
          screen: 'home',
          title: 'Today',
          place: [{ type: 'wipe' }, { type: 'go', screen: 'home' }],
        },
      ],
      at: 0,
    });
    const tab = current(load(saved, known));
    expect(tab.place).toEqual([{ type: 'go', screen: 'home' }]);
  });

  it('refuses an action carrying anything but flat data', () => {
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'home', title: 'Today', place: [{ type: 'go', screen: { x: 1 } }] }],
      at: 0,
    });
    // Nothing survived the check, so the tab keeps its screen and lands there
    // rather than becoming a click that does nothing.
    expect(current(load(saved, known)).place).toEqual([{ type: 'go', screen: 'home' }]);
  });

  it('allows every action the two makers of places can produce', () => {
    const kinds: Hit['kind'][] = [
      'item',
      'course',
      'unit',
      'note',
      'task',
      'appointment',
      'document',
      'sheet',
      'deck',
      'screen',
    ];
    const fromHits = kinds.flatMap((kind) =>
      actionsFor(hit({ kind, courseId: 'econ', unit: 0, mode: 'cards', screen: 'calendar' })),
    );
    const fromScreens = (
      ['course', 'item', 'event', 'guide', 'quiz', 'note', 'write', 'sheet', 'deck', 'home'] as Screen[]
    ).flatMap((screen) => placeFor(screen, where));
    for (const action of [...fromHits, ...fromScreens]) {
      expect(PLACE_ACTIONS as readonly string[], action.type).toContain(action.type);
    }
  });
});
