// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GROUP_TONES,
  MAX_TABS,
  NEW_TAB,
  PLACE_ACTIONS,
  TABS_KEY,
  add,
  blank,
  close,
  closeGroup,
  collapse,
  current,
  dissolve,
  dump,
  fresh,
  freeTone,
  joinGroup,
  justGo,
  lanes,
  leaveGroup,
  load,
  makeGroup,
  openBeside,
  placeFor,
  read,
  renameGroup,
  select,
  tidy,
  visit,
  write,
  type Strip,
  type TabGroup,
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

const strip = (screens: (Screen | null)[], at = 0, groups: TabGroup[] = []): Strip => ({
  tabs: screens.map((screen, i) => ({
    id: `t${i}`,
    screen,
    title: screen ?? NEW_TAB,
    place: screen ? justGo(screen) : [],
  })),
  at,
  groups,
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

  it('preserves every open tab when the strip is full', () => {
    const full = strip(Array.from({ length: MAX_TABS }, () => 'home' as Screen), 0);
    expect(add(full,'new')).toBe(full);
    expect(openBeside(full,'study','Study',justGo('study'))).toBe(full);
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
    const s = load(dump({ tabs: [fresh('a')], at: 0, groups: [] }), known);
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
    expect(placeFor('edit', where)).toEqual([{ type: 'openCourse', id: 'econ' }, { type: 'go', screen: 'edit' }]);
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

/*
 * Groups, which are the strip's second rule rather than a decoration on it.
 *
 * Two things must hold however they are reached, and neither is visible until
 * it is broken: a group is *one run* of tabs, and a group *has members*. Every
 * change below is checked against both, because the ways of breaking them are
 * ordinary — adding the seventh tab to a group whose others are at the front,
 * closing the last tab of one, reading back a strip the tab cap cut in half.
 */

/** A strip with a named group holding the tabs at the given seats. */
const grouped = (screens: (Screen | null)[], seats: number[], at = 0): Strip => {
  const s = strip(screens, at, [{ id: 'g', name: 'Essay', tone: 0, collapsed: false }]);
  return { ...s, tabs: s.tabs.map((t, i) => (seats.includes(i) ? { ...t, group: 'g' } : t)) };
};

const held = (s: Strip) => s.tabs.map((t) => t.group ?? '—');

describe('a group', () => {
  it('is made from one tab and keeps every other tab where it was', () => {
    const s = makeGroup(strip(['home', 'calendar', 'study'], 1), 1, 'Essay', 3, 'g');
    expect(names(s)).toEqual(['home', 'calendar', 'study']);
    expect(held(s)).toEqual(['—', 'g', '—']);
    expect(s.groups).toEqual([{ id: 'g', name: 'Essay', tone: 3, collapsed: false }]);
    // The tab you were on is still the tab you are on.
    expect(current(s).screen).toBe('calendar');
  });

  it('closes up when a tab joins it from further along the strip', () => {
    // The one rule a group cannot bend: its tabs sit together, or the colour
    // is drawn twice with somebody else's tab in the middle of it.
    const s = joinGroup(grouped(['home', 'calendar', 'study', 'mine'], [0, 1], 3), 3, 'g');
    expect(names(s)).toEqual(['home', 'calendar', 'mine', 'study']);
    expect(held(s)).toEqual(['g', 'g', 'g', '—']);
    // And it joins the end of the run rather than the front, so the order
    // people put things in is the order they stay in.
    expect(current(s).screen).toBe('mine');
  });

  it('goes when its last tab leaves, so no name is kept for an empty row', () => {
    const s = leaveGroup(grouped(['home', 'calendar'], [0]), 0);
    expect(s.groups).toEqual([]);
    expect(held(s)).toEqual(['—', '—']);
  });

  it('goes when its last tab is closed', () => {
    expect(close(grouped(['home', 'calendar'], [1]), 1).groups).toEqual([]);
  });

  it('survives a tab leaving while another stays in it', () => {
    const s = leaveGroup(grouped(['home', 'calendar', 'study'], [0, 1]), 0);
    expect(s.groups).toHaveLength(1);
    expect(held(s)).toEqual(['—', 'g', '—']);
  });

  it('takes the tabs opened out of it, which is where the strip has room', () => {
    // Beside a grouped tab is inside that group: an ungrouped tab inserted
    // there would split the run in two, and there is nowhere else "beside"
    // can mean.
    const s = add(grouped(['home', 'calendar'], [0, 1], 0), 'new');
    expect(held(s)).toEqual(['g', 'g', 'g']);
    expect(current(s).id).toBe('new');
  });

  it('does not take a tab opened out of one that is not in it', () => {
    expect(held(add(grouped(['home', 'calendar'], [1], 0), 'new'))).toEqual(['—', '—', 'g']);
  });

  it('is dissolved without closing anything', () => {
    const s = dissolve(grouped(['home', 'calendar', 'study'], [0, 1]), 'g');
    expect(names(s)).toEqual(['home', 'calendar', 'study']);
    expect(s.groups).toEqual([]);
  });

  it('closes all of its tabs at once, landing after the run', () => {
    const s = closeGroup(grouped(['home', 'calendar', 'study'], [0, 1], 1), 'g');
    expect(names(s)).toEqual(['study']);
    expect(current(s).screen).toBe('study');
    expect(s.groups).toEqual([]);
  });

  it('leaves a new tab rather than an empty strip when it was the whole strip', () => {
    const s = closeGroup(grouped(['home', 'calendar'], [0, 1], 0), 'g');
    expect(s.tabs).toHaveLength(1);
    expect(current(s).screen).toBeNull();
  });

  it('leaves the tab you were on alone when you were not in it', () => {
    const s = closeGroup(grouped(['home', 'calendar', 'study'], [0], 2), 'g');
    expect(current(s).screen).toBe('study');
  });

  it('keeps its name to something a strip can draw', () => {
    const long = 'Everything I have to do before the exam on the fourteenth';
    expect(renameGroup(grouped(['home'], [0]), 'g', long).groups[0].name.length).toBeLessThan(
      long.length,
    );
  });

  it('is a colour nothing else is wearing, until the twelve run out', () => {
    let s = strip(['home', 'calendar', 'study'], 0);
    s = makeGroup(s, 0, '', freeTone(s), 'a');
    s = makeGroup(s, 1, '', freeTone(s), 'b');
    expect(s.groups[0].tone).not.toBe(s.groups[1].tone);
    expect(freeTone(s)).toBeLessThan(GROUP_TONES);
  });
});

describe('collapsing a group', () => {
  it('moves you out of it first, because its page is the window', () => {
    const s = collapse(grouped(['home', 'calendar', 'study'], [0, 1], 1), 'g', true);
    expect(current(s).screen).toBe('study');
    expect(s.groups[0].collapsed).toBe(true);
  });

  it('moves you left when there is nothing to its right', () => {
    const s = collapse(grouped(['home', 'calendar', 'study'], [1, 2], 2), 'g', true);
    expect(current(s).screen).toBe('home');
  });

  it('opens a new tab when the group is the whole strip', () => {
    // The same answer `close` gives to the same question: the app always has a
    // page, and the page it invents is the search page.
    const s = collapse(grouped(['home', 'calendar'], [0, 1], 0), 'g', true);
    expect(s.tabs).toHaveLength(3);
    expect(current(s).screen).toBeNull();
  });

  it('leaves you where you are when you were not inside it', () => {
    const s = collapse(grouped(['home', 'calendar', 'study'], [0, 1], 2), 'g', true);
    expect(current(s).screen).toBe('study');
    expect(s.tabs).toHaveLength(3);
  });

  it('opens again when a tab inside it is picked', () => {
    const shut = collapse(grouped(['home', 'calendar', 'study'], [0, 1], 2), 'g', true);
    expect(select(shut, 0).groups[0].collapsed).toBe(false);
  });

  it('refuses rather than dropping somebody\u2019s tab to stand on', () => {
    // The group is the whole strip and the strip is full, so there is nowhere
    // to move to and no room for the new tab that would be invented. It used
    // to take the leftmost tab to pay for one, which is deletion wearing the
    // word "fold". See `collapse`.
    const screens = Array.from({ length: MAX_TABS }, () => 'home' as Screen);
    const whole = grouped(screens, screens.map((_, i) => i), 0);
    const s = collapse(whole, 'g', true);
    expect(s).toBe(whole);
    expect(s.groups[0].collapsed).toBe(false);
  });
});

/**
 * The third invariant: the tab you are on is never folded away.
 *
 * Every one of these is a way into the same broken strip — a run drawn as a
 * name and a count, where the thing being counted is the page filling the
 * window. It was held in one of the two components that draw the strip and in
 * neither of the four operations that can cause it. See `reveal`.
 */
describe('the tab you are on', () => {
  it('opens the group it is put into, when that group was folded', () => {
    const shut = collapse(grouped(['home', 'calendar', 'study'], [0], 2), 'g', true);
    const s = joinGroup(shut, shut.at, 'g');
    expect(current(s).screen).toBe('study');
    expect(s.groups[0].collapsed).toBe(false);
  });

  it('is not folded away by a tab closing beside it', () => {
    const shut = collapse(grouped(['home', 'calendar', 'study', 'mine'], [1, 2], 0), 'g', true);
    const s = close(shut, 0);
    expect(s.groups[0].collapsed).toBe(false);
  });

  it('comes back visible from a store that folded it away', () => {
    const raw = JSON.stringify({
      tabs: [
        { id: 'a', screen: 'home', title: 'home', place: justGo('home'), group: 'g' },
        { id: 'b', screen: 'study', title: 'study', place: justGo('study') },
      ],
      at: 0,
      groups: [{ id: 'g', name: 'Essay', tone: 0, collapsed: true }],
    });
    const s = load(raw, known);
    expect(current(s).screen).toBe('home');
    expect(s.groups[0].collapsed).toBe(false);
  });

  it('leaves a folded group you are not standing in folded', () => {
    const shut = collapse(grouped(['home', 'calendar', 'study'], [0, 1], 2), 'g', true);
    expect(tidy(shut).groups[0].collapsed).toBe(true);
    expect(tidy(shut)).toBe(shut);
  });
});

describe('the strip as it is drawn', () => {
  it('is a run per group and a run per loose tab', () => {
    const rows = lanes(grouped(['home', 'calendar', 'study'], [0, 1]));
    expect(rows).toHaveLength(2);
    expect(rows[0].group?.name).toBe('Essay');
    expect(rows[0].seats.map((x) => x.at)).toEqual([0, 1]);
    expect(rows[1].group).toBeNull();
    expect(rows[1].seats.map((x) => x.tab.screen)).toEqual(['study']);
  });

  it('keeps the tabs of a collapsed group in its run, so it can say how many', () => {
    const shut = collapse(grouped(['home', 'calendar'], [0, 1], 0), 'g', true);
    expect(lanes(shut)[0].seats).toHaveLength(2);
  });
});

describe('putting a strip back in order', () => {
  it('drops a group id no group answers to', () => {
    const s = tidy({ ...grouped(['home', 'calendar'], [0]), groups: [] });
    expect(held(s)).toEqual(['—', '—']);
  });

  it('returns the strip untouched when nothing was wrong', () => {
    const was = grouped(['home', 'calendar', 'study'], [0, 1]);
    expect(tidy(was)).toBe(was);
  });

  it('keeps you on the tab you were on after a run has moved', () => {
    const was = grouped(['home', 'calendar', 'study', 'mine'], [0, 3], 2);
    const s = tidy(was);
    expect(names(s)).toEqual(['home', 'mine', 'calendar', 'study']);
    expect(current(s).screen).toBe('study');
  });
});

describe('a strip with groups, through the store and back', () => {
  it('comes back with its groups and its memberships', () => {
    const was = grouped(['home', 'calendar', 'study'], [0, 1], 1);
    write(was);
    expect(read(known)).toEqual(was);
  });

  it('drops a group whose tabs did not survive the screen check', () => {
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'gone', title: 'Gone', place: [], group: 'g' }],
      at: 0,
      groups: [{ id: 'g', name: 'Essay', tone: 0, collapsed: false }],
    });
    expect(load(saved, known).groups).toEqual([]);
  });

  it('reads a strip written before groups existed', () => {
    const saved = JSON.stringify({ tabs: [{ id: 'a', screen: 'home', title: 'Today' }], at: 0 });
    expect(load(saved, known).groups).toEqual([]);
  });

  it('refuses a group that is not one', () => {
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'home', title: 'Today', group: 'g' }],
      at: 0,
      groups: ['nope', { name: 'no id' }, { id: 'g', tone: 99.5, collapsed: 'yes' }],
    });
    const s = load(saved, known);
    expect(s.groups).toHaveLength(1);
    expect(s.groups[0]).toEqual({ id: 'g', name: '', tone: 99 % GROUP_TONES, collapsed: false });
  });
});
