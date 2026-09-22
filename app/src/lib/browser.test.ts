// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GROUP_TONES,
  MAX_TABS,
  NEW_TAB,
  PLACE_ACTIONS,
  TABS_KEY,
  add,
  arrangeLanes,
  besideTab,
  blank,
  close,
  closeGroup,
  collapse,
  current,
  dissolve,
  dump,
  MAX_CLOSED,
  findTabs,
  forgetClosed,
  fresh,
  freeTone,
  joinGroup,
  justGo,
  laneId,
  laneOrder,
  lanes,
  leaveGroup,
  load,
  makeGroup,
  mute,
  mutedTab,
  openBeside,
  pin,
  pinnedCount,
  placeFor,
  read,
  rearrange,
  reopen,
  renameGroup,
  select,
  splitWith,
  tabAt,
  tidy,
  unsplit,
  visit,
  whatClosed,
  write,
  type Strip,
  type TabGroup,
  type Where,
} from './browser';
import { actionsFor } from './openhit';
import { dropped } from './arrange';
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
  closed: [],
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
    const s = load(dump({ tabs: [fresh('a')], at: 0, groups: [], closed: [] }), known);
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

/*
 * Dragging a tab, which on a strip with groups on it is two questions.
 *
 * Where it goes is `dropped` in `lib/arrange.ts` and is the same arithmetic
 * every ordered list in this app uses. What the new position *means* is here:
 * a tab dropped among a group's tabs has joined that group, and one dragged
 * out from among them has left it. Every case below is a gesture somebody
 * makes without thinking about it, and would notice immediately if it were
 * wrong.
 */
describe('dragging a tab', () => {
  /** The ids, in the order the strip draws them. */
  const ids = (s: Strip) => s.tabs.map((t) => t.id);
  /*
   * The order a drop produces, from the app's own arithmetic rather than from
   * a hand-written list. `dropped` is the one implementation of "it moved"
   * this app has, and it is what the strip is wired to — a test that spliced
   * its own array would be testing a second one.
   */
  const onto = (s: Strip, moved: string, target: string) => dropped(ids(s), moved, target);

  it('moves a loose tab along the strip and leaves it loose', () => {
    const was = strip(['home', 'calendar', 'study']);
    const s = rearrange(was, onto(was, 't2', 't0'), 't2');
    expect(names(s)).toEqual(['study', 'home', 'calendar']);
    expect(held(s)).toEqual(['—', '—', '—']);
  });

  it('keeps you on the tab you were on, wherever it has moved to', () => {
    const was = strip(['home', 'calendar', 'study'], 0);
    const s = rearrange(was, onto(was, 't0', 't2'), 't0');
    expect(current(s).screen).toBe('home');
    expect(names(s)).toEqual(['calendar', 'study', 'home']);
  });

  it('joins the group it is dropped inside', () => {
    // Between two of its tabs, which is the only place that can mean "in it".
    const was = grouped(['home', 'calendar', 'study', 'mine'], [1, 2]);
    const s = rearrange(was, ['t0', 't1', 't3', 't2'], 't3');
    expect(held(s)).toEqual(['—', 'g', 'g', 'g']);
    expect(names(s)).toEqual(['home', 'calendar', 'mine', 'study']);
  });

  it('stays out of a group it is only dropped beside', () => {
    // The edge of a run is where somebody drops a tab they want next to a
    // group rather than in it, so both sides have to agree before it joins.
    const was = grouped(['home', 'calendar', 'study'], [1, 2]);
    expect(held(rearrange(was, ['t1', 't2', 't0'], 't0'))).toEqual(['g', 'g', '—']);
  });

  it('leaves its group when it lands clear of every tab in it', () => {
    const was = grouped(['home', 'calendar', 'study', 'mine'], [0, 1], 0);
    const s = rearrange(was, ['t1', 't2', 't3', 't0'], 't0');
    expect(held(s)).toEqual(['g', '—', '—', '—']);
    expect(names(s)).toEqual(['calendar', 'study', 'mine', 'home']);
  });

  it('stays in its group when it is only moved about inside it', () => {
    // The case a rule reading both neighbours would get wrong: at the front
    // of its own run, the tab on its left is a stranger.
    const was = grouped(['home', 'calendar', 'study'], [0, 1, 2]);
    const s = rearrange(was, ['t2', 't0', 't1'], 't2');
    expect(held(s)).toEqual(['g', 'g', 'g']);
    expect(names(s)).toEqual(['study', 'home', 'calendar']);
  });

  it('does not pull a tab out of a group for passing its edge', () => {
    /*
     * Deliberate, and the one place this differs from a browser — which knows
     * the group as a rectangle on screen and can tell "just outside" from
     * "just inside" by a few pixels. A strip of tab ids cannot: the slot past
     * the last member of a run is also the slot beside it. Between silently
     * dropping a tab out of the work it belongs to and keeping it in, this
     * keeps it in, and "Remove from Midterm" in the tab's own menu is the way
     * out that never has to guess.
     */
    const was = grouped(['home', 'calendar', 'study'], [0, 1], 0);
    expect(held(rearrange(was, ['t1', 't0', 't2'], 't0'))).toEqual(['g', 'g', '—']);
  });

  it('moves from one group straight into another', () => {
    const two = strip(['home', 'calendar', 'study', 'mine', 'me'], 0, [
      { id: 'g', name: 'Midterm', tone: 0, collapsed: false },
      { id: 'h', name: 'Essay', tone: 1, collapsed: false },
    ]);
    two.tabs = two.tabs.map((t, i) =>
      i < 2 ? { ...t, group: 'g' } : i < 4 ? { ...t, group: 'h' } : t,
    );
    const s = rearrange(two, ['t1', 't2', 't0', 't3', 't4'], 't0');
    expect(held(s)).toEqual(['g', 'h', 'h', 'h', '—']);
  });

  it('is left alone by an order that names a tab twice or one that is gone', () => {
    const was = strip(['home', 'calendar', 'study']);
    const s = rearrange(was, ['t2', 't2', 'ghost'], 't2');
    // Everything the order did not name keeps its place behind what it did,
    // so a stale drop rearranges oddly at worst and never loses a tab.
    expect(names(s)).toEqual(['study', 'home', 'calendar']);
  });
});

/*
 * Pinned tabs: the four or five places somebody is in every day.
 *
 * They are not "open" in the sense the rest of the strip means it — they are
 * never finished with, and everything else is opened beside them. So the
 * strip holds a third invariant for them: everything pinned is before
 * everything that is not, and a pinned tab is in no group, because a group is
 * a piece of work with several tabs in it and this is the opposite of that.
 */
describe('a pinned tab', () => {
  const pinnedAt = (s: Strip) => s.tabs.map((t) => (t.pinned ? 'P' : '—'));

  it('goes to the front of the strip, before everything that is not pinned', () => {
    const s = pin(strip(['home', 'calendar', 'study']), 2);
    expect(names(s)).toEqual(['study', 'home', 'calendar']);
    expect(pinnedAt(s)).toEqual(['P', '—', '—']);
  });

  it('keeps you on the tab you were looking at when you pinned it', () => {
    const s = pin(strip(['home', 'calendar', 'study'], 2), 2);
    expect(current(s).screen).toBe('study');
  });

  it('holds the order they were pinned in', () => {
    let s = pin(strip(['home', 'calendar', 'study']), 2);
    s = pin(s, s.tabs.findIndex((t) => t.screen === 'calendar'));
    expect(names(s)).toEqual(['study', 'calendar', 'home']);
  });

  it('leaves its group on the way, and takes an empty group with it', () => {
    const s = pin(grouped(['home', 'calendar'], [1]), 1);
    expect(pinnedAt(s)).toEqual(['P', '—']);
    expect(s.tabs[0].group).toBeUndefined();
    expect(s.groups).toEqual([]);
  });

  it('is let go again, back into the working strip', () => {
    const s = pin(pin(strip(['home', 'calendar']), 1), 0, false);
    expect(pinnedAt(s)).toEqual(['—', '—']);
    // Unpinning is not a move: it stays where the pinned run left it, which
    // is the front of a strip with nothing else pinned.
    expect(names(s)).toEqual(['calendar', 'home']);
  });

  it('answers the same strip when it is already in the state asked for', () => {
    const was = pin(strip(['home', 'calendar']), 0);
    expect(pin(was, 0, true)).toBe(was);
    expect(pin(strip(['home']), 0, false)).toEqual(strip(['home']));
  });

  it('says how many there are, which is where the working strip begins', () => {
    expect(pinnedCount(pin(pin(strip(['home', 'calendar', 'study']), 0), 2))).toBe(2);
  });

  it('does not hand its pin to a tab opened beside it', () => {
    const s = add(pin(strip(['home', 'calendar']), 0), 'new');
    expect(s.tabs.find((t) => t.id === 'new')?.pinned).toBeUndefined();
    // And it lands at the head of the working strip rather than among the
    // pinned ones, which is where `tidy` puts anything that is not pinned.
    expect(s.tabs.findIndex((t) => t.id === 'new')).toBe(1);
  });

  it('stays pinned through a drag, and nothing is pinned by one', () => {
    const was = pin(strip(['home', 'calendar', 'study']), 0);
    // The whole order upended: the pinned tab is still first and still the
    // only pinned one.
    const s = rearrange(was, ['t1', 't2', 't0'], 't1');
    expect(pinnedAt(s)).toEqual(['P', '—', '—']);
    expect(names(s)).toEqual(['home', 'calendar', 'study']);
  });

  it('comes back pinned off the device', () => {
    const was = pin(grouped(['home', 'calendar', 'study'], [1, 2], 0), 0);
    write(was);
    expect(read(known)).toEqual(was);
  });

  it('is not pinned by a stored value that is not true', () => {
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'home', title: 'Today', pinned: 'yes' }],
      at: 0,
    });
    expect(load(saved, known).tabs[0].pinned).toBeUndefined();
  });
});

/*
 * Finding a tab by name.
 *
 * The strip holds a hundred now, which makes it a place to keep tabs rather
 * than a row anybody reads end to end. Every rule here is about the list
 * reading as *the strip, filtered* — same order, same groups, same pinned
 * ones first — rather than as a ranking of its own.
 */
describe('searching the open tabs', () => {
  const named = (s: Strip, titles: string[]): Strip => ({
    ...s,
    tabs: s.tabs.map((t, i) => ({ ...t, title: titles[i] ?? t.title })),
  });
  const titles = (found: ReturnType<typeof findTabs>) => found.map((f) => f.seat.tab.title);

  it('is every tab when nothing is typed, in the strip’s own order', () => {
    const s = named(strip(['home', 'calendar', 'study']), ['Today', 'Calendar', 'Study']);
    expect(titles(findTabs(s, ''))).toEqual(['Today', 'Calendar', 'Study']);
    expect(titles(findTabs(s, '   '))).toEqual(['Today', 'Calendar', 'Study']);
  });

  it('matches part of a name, however it is cased', () => {
    const s = named(strip(['home', 'calendar', 'study']), ['Today', 'Calendar', 'ECON 1020 · Quiz']);
    expect(titles(findTabs(s, 'econ'))).toEqual(['ECON 1020 · Quiz']);
    expect(titles(findTabs(s, 'CAL'))).toEqual(['Calendar']);
  });

  it('wants every word, in any order', () => {
    const s = named(strip(['home', 'calendar']), ['ECON 1020 · Quiz', 'PSCI 1104 · Quiz']);
    expect(titles(findTabs(s, 'quiz econ'))).toEqual(['ECON 1020 · Quiz']);
    expect(titles(findTabs(s, 'quiz'))).toEqual(['ECON 1020 · Quiz', 'PSCI 1104 · Quiz']);
  });

  it('finds a tab by the name of the group it is in', () => {
    const s = named(grouped(['home', 'calendar', 'study'], [1, 2]), ['Today', 'Reading', 'Cards']);
    // 'Essay' is the group's name, and belongs to two of the three tabs.
    expect(titles(findTabs(s, 'essay'))).toEqual(['Reading', 'Cards']);
  });

  it('forgives a typo, the same way the rest of the app’s search does', () => {
    const s = named(strip(['home', 'calendar']), ['Today', 'Calendar']);
    expect(titles(findTabs(s, 'calender'))).toEqual(['Calendar']);
  });

  it('puts what matches exactly before what only nearly does', () => {
    const s = named(strip(['home', 'calendar']), ['Calender Club', 'Calendar']);
    expect(titles(findTabs(s, 'calendar'))).toEqual(['Calendar', 'Calender Club']);
  });

  it('keeps the pinned ones first, because that is where they are', () => {
    const s = pin(named(strip(['home', 'calendar', 'study']), ['Quiz A', 'Quiz B', 'Quiz C']), 2);
    expect(titles(findTabs(s, 'quiz'))).toEqual(['Quiz C', 'Quiz A', 'Quiz B']);
  });

  it('says which seat each answer is, so picking one goes to the right tab', () => {
    const s = named(strip(['home', 'calendar', 'study']), ['Today', 'Calendar', 'Study']);
    expect(findTabs(s, 'study')[0].seat.at).toBe(2);
  });

  it('answers with nothing rather than everything when nothing matches', () => {
    const s = named(strip(['home', 'calendar']), ['Today', 'Calendar']);
    expect(findTabs(s, 'zzzzq')).toEqual([]);
  });
});

/*
 * What was closed lately.
 *
 * Closing a tab is one press and is the easiest thing in the strip to do by
 * accident — the cross sits eight pixels from the name, which on a phone is
 * inside a thumb. Before this, the cost of that slip was finding your way
 * back to a deadline three navigations deep: exactly the work tabs exist to
 * save. These rules are about it costing one press instead.
 */
describe('reopening a closed tab', () => {
  const shut = (s: Strip, screen: Screen) =>
    close(s, s.tabs.findIndex((t) => t.screen === screen));

  it('keeps what was closed, newest first', () => {
    let s = strip(['home', 'calendar', 'study']);
    s = shut(s, 'calendar');
    s = shut(s, 'home');
    expect(s.closed.map((c) => c.tab.screen)).toEqual(['home', 'calendar']);
  });

  it('keeps a new tab for the undo, and keeps it out of the list', () => {
    /*
     * Two answers, and both are right. The shell's one-press undo gives back
     * whatever was just closed, a blank included — `browser-recovery.test.ts`
     * holds that a blank must not consume an older pending tab. The list is
     * places to go back to, and a page nobody went to is not one.
     */
    const s = close(strip([null, 'home']), 0);
    expect(s.closed).toHaveLength(1);
    expect(whatClosed(s, '')).toEqual([]);
  });

  it('keeps it even when it was the last tab on the strip', () => {
    const s = close(strip(['home']), 0);
    expect(current(s).screen).toBeNull();
    expect(s.closed.map((c) => c.tab.screen)).toEqual(['home']);
  });

  it('puts one back on the end, and goes to it', () => {
    const was = shut(strip(['home', 'calendar', 'study']), 'calendar');
    const s = reopen(was, was.closed[0].tab.id);
    // Back in the seat it was closed from, which is what makes an undo feel
    // like one rather than like opening the thing again.
    expect(names(s)).toEqual(['home', 'calendar', 'study']);
    expect(current(s).screen).toBe('calendar');
    // And it is no longer something to reopen.
    expect(s.closed).toEqual([]);
  });

  it('brings its group back with it, when the group is still there', () => {
    const was = close(grouped(['home', 'calendar', 'study'], [1, 2]), 1);
    const s = reopen(was, was.closed[0].tab.id);
    expect(held(s)).toEqual(['—', 'g', 'g']);
  });

  it('drops a group that has gone in the meantime', () => {
    // Closing the last tab of a group takes the group with it, so what comes
    // back cannot rejoin a name nobody can see.
    const was = close(grouped(['home', 'calendar'], [1]), 1);
    expect(was.groups).toEqual([]);
    expect(reopen(was, was.closed[0].tab.id).tabs.every((t) => !t.group)).toBe(true);
  });

  it('comes back pinned if it was pinned', () => {
    const was = close(pin(strip(['home', 'calendar']), 0), 0);
    const s = reopen(was, was.closed[0].tab.id);
    expect(s.tabs[0].pinned).toBe(true);
  });

  it('keeps every tab of a group closed whole, oldest last', () => {
    const s = closeGroup(grouped(['home', 'calendar', 'study'], [1, 2]), 'g');
    expect(s.closed.map((c) => c.tab.screen)).toEqual(['study', 'calendar']);
  });

  it('holds only the last few, because this is not a history', () => {
    let s = strip(['home']);
    for (let i = 0; i < MAX_CLOSED + 5; i += 1) {
      s = openBeside(s, 'calendar', `Tab ${i}`, justGo('calendar'), `x${i}`);
      s = close(s, s.at);
    }
    expect(s.closed).toHaveLength(MAX_CLOSED);
    expect(s.closed[0].tab.title).toBe(`Tab ${MAX_CLOSED + 4}`);
  });

  it('answers the same strip for an id that is not there', () => {
    const was = shut(strip(['home', 'calendar']), 'calendar');
    expect(reopen(was, 'ghost')).toBe(was);
  });

  it('is forgotten on request, which is the one control over it', () => {
    const was = shut(strip(['home', 'calendar']), 'calendar');
    expect(forgetClosed(was).closed).toEqual([]);
    expect(forgetClosed(strip(['home']))).toEqual(strip(['home']));
  });

  it('is searched the same way the open ones are, typos and all', () => {
    let s = strip(['home', 'calendar', 'study']);
    s = shut(s, 'calendar');
    s.closed[0].tab.title = 'Calendar';
    expect(whatClosed(s, 'calender').map((c) => c.tab.title)).toEqual(['Calendar']);
    expect(whatClosed(s, 'zzz')).toEqual([]);
    expect(whatClosed(s, '')).toHaveLength(1);
  });

  it('survives the device, and is read back under the same rules as a tab', () => {
    const was = shut(strip(['home', 'calendar'], 0), 'calendar');
    write(was);
    expect(read(known)).toEqual(was);
    // A closed tab whose place is not an opening action is dropped, exactly
    // as an open one would be: reopening dispatches it.
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'home', title: 'Today', place: [{ type: 'go', screen: 'home' }] }],
      at: 0,
      closed: [
        { at: 0, tab: { id: 'b', screen: 'home', title: 'Gone', place: [{ type: 'eraseEverything' }] } },
      ],
    });
    expect(load(saved, known).closed[0].tab.place).toEqual([{ type: 'go', screen: 'home' }]);
  });
});

/*
 * One list, not two.
 *
 * The strip grew a closed-tab list here while the hook kept its own module
 * array with the same job — so closing pushed onto both, and reopening from
 * one left the other holding a tab that was already back. The rules below are
 * what the one list has to do for both of the things that read it: the tab
 * list's **Recently closed**, and the browser shell's one-press undo.
 */
describe('the one closed-tab list', () => {
  it('puts a tab back in the seat it was closed from', () => {
    const was = close(strip(['home', 'calendar', 'study']), 1);
    expect(names(was)).toEqual(['home', 'study']);
    expect(reopen(was, was.closed[0].tab.id).tabs.map((t) => t.screen)).toEqual([
      'home',
      'calendar',
      'study',
    ]);
  });

  it('lands at the end when the strip has shrunk under that seat since', () => {
    let s = close(strip(['home', 'calendar', 'study']), 2);
    s = close(s, 1);
    // `study` was seat 2; the strip is one tab long now.
    const study = s.closed.find((c) => c.tab.screen === 'study');
    expect(names(reopen(s, study!.tab.id))).toEqual(['home', 'study']);
  });

  it('is what the shell’s undo reads, newest first', () => {
    let s = close(strip(['home', 'calendar', 'study']), 1);
    s = close(s, 1);
    expect(s.closed.map((c) => c.tab.screen)).toEqual(['study', 'calendar']);
    // `lastClosed` in the hook is `closed[0].tab`; reopening it empties one
    // entry and one only.
    const back = reopen(s, s.closed[0].tab.id);
    expect(back.closed.map((c) => c.tab.screen)).toEqual(['calendar']);
  });
});

describe('muting a tab', () => {
  it('silences it and lets it speak again', () => {
    const one = mute(strip(['home', 'study'], 0), 1);
    expect(one.tabs[1].muted).toBe(true);
    expect(mute(one, 1, false).tabs[1].muted).toBeUndefined();
  });

  it('removes the key rather than setting it false, like pinned', () => {
    // `dump` writes whole tabs, so `muted: false` would be a field written to
    // every device for a setting nobody chose.
    const back = mute(mute(strip(['home'], 0), 0), 0, false);
    expect('muted' in back.tabs[0]).toBe(false);
  });

  it('is the same strip back when it would change nothing', () => {
    const s = strip(['home', 'study'], 0);
    expect(mute(s, 1, false)).toBe(s);
    expect(mute(mute(s, 1), 1)).toEqual(mute(s, 1));
    expect(mute(s, 99)).toBe(s);
  });

  it('moves nothing — not the order, not the tab you are on', () => {
    const s = strip(['home', 'study', 'calendar'], 2);
    const m = mute(s, 0);
    expect(names(m)).toEqual(names(s));
    expect(m.at).toBe(2);
  });

  it('is orthogonal to pinning and grouping — a tab may be any of them', () => {
    // By id, because pinning reorders: `tidy` moves the pinned tab to the
    // front, so the index that named it a moment ago names its neighbour.
    const pinned = pin(strip(['home', 'study'], 0), 1);
    const both = mute(pinned, pinned.tabs.findIndex((t) => t.id === 't1'));
    const kept = both.tabs.find((t) => t.id === 't1');
    expect(kept?.pinned).toBe(true);
    expect(kept?.muted).toBe(true);

    const grouped = makeGroup(strip(['home', 'study'], 1), 1, 'Midterm');
    const g = mute(grouped, grouped.tabs.findIndex((t) => t.group));
    expect(g.tabs.find((t) => t.muted)?.group).toBeTruthy();
  });

  it('answers by id, for a player that knows one', () => {
    const s = mute(strip(['home', 'study'], 0), 1);
    expect(mutedTab(s, 't1')).toBe(true);
    expect(mutedTab(s, 't0')).toBe(false);
    expect(mutedTab(s, 'gone')).toBe(false);
  });

  it('survives a reload, because a mute is a setting rather than a session', () => {
    write(mute(strip(['home', 'study'], 0), 1));
    expect(read(known).tabs[1].muted).toBe(true);
  });

  it('is only ever exactly true off the device', () => {
    // The stored reader builds each tab field by field so that a hand-edited
    // store cannot smuggle anything in. A truthy test would give that up.
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({
        tabs: [{ id: 'a', screen: 'home', title: 'Home', place: justGo('home'), muted: 'yes' }],
        at: 0,
        groups: [],
        closed: [],
      }),
    );
    expect(read(known).tabs[0].muted).toBeUndefined();
  });
});

describe('the tab already at a place', () => {
  it('finds it, so a result can offer to switch rather than open a second one', () => {
    const s = strip(['home', 'study', 'calendar'], 0);
    expect(tabAt(s, justGo('calendar'))?.id).toBe('t2');
  });

  it('is nobody when nothing is open there', () => {
    expect(tabAt(strip(['home', 'study'], 0), justGo('calendar'))).toBeUndefined();
  });

  it('never answers with a blank tab, whatever it is asked', () => {
    // A new tab has no screen and an empty place. An empty place matching
    // would send somebody to a blank page instead of what they searched for.
    const s = strip([null, 'home'], 0);
    expect(tabAt(s, [])).toBeUndefined();
    expect(tabAt(s, justGo('home'))?.id).toBe('t1');
  });

  it('tells two places on the same screen apart', () => {
    // The whole point of matching the place rather than the screen: two
    // courses are both `course`, and switching to the wrong one is worse
    // than opening a new tab.
    const econ: Strip = {
      ...strip(['home'], 0),
      tabs: [
        { id: 'a', screen: 'home', title: 'Today', place: justGo('home') },
        { id: 'b', screen: 'courses', title: 'ECON 1020', place: [{ type: 'openCourse', id: 'econ' } as never] },
      ],
    };
    expect(tabAt(econ, [{ type: 'openCourse', id: 'econ' } as never])?.id).toBe('b');
    expect(tabAt(econ, [{ type: 'openCourse', id: 'psci' } as never])).toBeUndefined();
  });

  it('matches a lesson result against the lesson tab already open on it', () => {
    /*
     * The fact everything about lessons in the overlay rests on: what
     * `actionsFor` builds for a lesson hit and what `placeFor` records for a
     * lesson tab have to be the *same actions*, or a result can never notice
     * the tab. They are written in two files and only this compares them.
     */
    const fromResult = actionsFor({
      kind: 'lesson',
      courseId: 'econ' as never,
      unit: 3,
      title: 'Optimisation',
      sub: '',
      tag: 'ECON 1020',
      score: 1,
    } as Hit);
    const fromTab = placeFor('lesson', {
      courseId: 'econ' as never,
      itemId: '',
      eventId: '',
      guideId: 'econ' as never,
      noteId: null,
      documentId: null,
      sheetId: null,
      deckId: null,
      mode: 'cards',
      lessonUnit: 3,
    });
    expect(fromResult).toEqual(fromTab);

    const open: Strip = {
      ...strip(['home'], 0),
      tabs: [{ id: 'L', screen: 'lesson', title: 'Optimisation', place: fromTab }],
    };
    expect(tabAt(open, fromResult)?.id).toBe('L');
  });

  it('is a different place for a different unit of the same course', () => {
    // Two lessons of one course used to be one place — the tab recorded only
    // "the lesson screen of this guide" — so reopening either landed on
    // whichever unit the app happened to be holding.
    const at = (lessonUnit: number) =>
      placeFor('lesson', {
        courseId: 'econ' as never,
        itemId: '',
        eventId: '',
        guideId: 'econ' as never,
        noteId: null,
        documentId: null,
        sheetId: null,
        deckId: null,
        mode: 'cards',
        lessonUnit,
      });
    expect(at(3)).not.toEqual(at(4));
  });

  it('does not depend on how you arrived — the guide\u2019s own scroll is not part of it', () => {
    // Reaching unit 3's lesson from a guide open at unit 7 in `read` is the
    // same place as reaching it from a search result. If it were not, the two
    // routes would make two tabs that look identical and are not.
    const base = {
      courseId: 'econ' as never,
      itemId: '',
      eventId: '',
      guideId: 'econ' as never,
      noteId: null,
      documentId: null,
      sheetId: null,
      deckId: null,
      lessonUnit: 3,
    };
    expect(placeFor('lesson', { ...base, mode: 'read', openUnit: 7 })).toEqual(
      placeFor('lesson', { ...base, mode: 'cards' }),
    );
  });

  it('will not match a guide in one mode against the same guide in another', () => {
    // The reason a search result carries no speaker: a unit result always
    // opens the guide in `cards` (`find.ts`), and the mode that plays is
    // `listen`. Two modes of one guide are two places, and this is what says
    // so — if it ever stops being true, the mark on the row becomes buildable.
    const listening: Strip = {
      ...strip(['home'], 0),
      tabs: [
        {
          id: 'g',
          screen: 'study',
          title: 'ECON 1020 · Study guide',
          place: [{ type: 'openGuide', id: 'econ', mode: 'listen', unit: 0 } as never],
        },
      ],
    };
    expect(tabAt(listening, [{ type: 'openGuide', id: 'econ', mode: 'cards', unit: 0 } as never])).toBeUndefined();
    expect(tabAt(listening, [{ type: 'openGuide', id: 'econ', mode: 'listen', unit: 0 } as never])?.id).toBe('g');
  });

  it('answers with the one nearest the front when a place is open twice', () => {
    const twice: Strip = {
      ...strip(['home'], 0),
      tabs: [
        { id: 'a', screen: 'calendar', title: 'Calendar', place: justGo('calendar') },
        { id: 'b', screen: 'calendar', title: 'Calendar', place: justGo('calendar') },
      ],
    };
    expect(tabAt(twice, justGo('calendar'))?.id).toBe('a');
  });
});

/*
 * Dragging a run rather than a tab.
 *
 * `rearrange` above answers "where does this tab go, and whose work is it
 * now". This is the other question the strip can be asked — where does this
 * whole group go — and the thing that must never happen is a group coming
 * apart because somebody moved it.
 */
describe('moving a whole run', () => {
  /** Home, then a group of two, then calendar. */
  const banded = () => {
    const s = makeGroup(strip(['home', 'study', 'mine', 'calendar'], 1), 1, 'Midterm');
    const id = s.groups[0].id;
    return { s: joinGroup(s, 2, id), id };
  };

  it('names each run by its group, or by the tab when it is alone', () => {
    const { s, id } = banded();
    expect(laneOrder(s)).toEqual(['t0', id, 't3']);
    expect(laneId(lanes(s)[1])).toBe(id);
  });

  it('takes the group\u2019s tabs with it', () => {
    const { s, id } = banded();
    const moved = arrangeLanes(s, ['t0', 't3', id]);
    expect(names(moved)).toEqual(['home', 'calendar', 'study', 'mine']);
    // Still one run, which is the thing a move must not break.
    expect(moved.tabs[2].group).toBe(id);
    expect(moved.tabs[3].group).toBe(id);
  });

  it('keeps you on the tab you were on, wherever it went', () => {
    const { s, id } = banded();
    // On the second tab of the group.
    const on = { ...s, at: 2 };
    const moved = arrangeLanes(on, [id, 't0', 't3']);
    expect(moved.tabs[moved.at].id).toBe(on.tabs[2].id);
  });

  it('is the same strip back when the order is the order it already had', () => {
    const { s } = banded();
    expect(arrangeLanes(s, laneOrder(s))).toBe(s);
  });

  it('refuses an order that has lost a run, or invented one', () => {
    const { s, id } = banded();
    // Both of these can arrive: the strip is rewritten by a navigation in
    // another tab while a finger is still down, and half-applying a stale
    // order would lose tabs rather than merely misplace them.
    expect(arrangeLanes(s, ['t0', id])).toBe(s);
    expect(arrangeLanes(s, ['t0', id, 't3', 'ghost'])).toBe(s);
    expect(arrangeLanes(s, ['t0', 'ghost', 't3'])).toBe(s);
  });

  it('cannot drag a run in front of the pinned tabs', () => {
    // `tidy` holds it, as it holds every other route into the strip.
    const { s, id } = banded();
    const pinned = pin(s, s.tabs.findIndex((t) => t.screen === 'calendar'));
    const moved = arrangeLanes(pinned, [id, ...laneOrder(pinned).filter((x) => x !== id)]);
    expect(moved.tabs[0].pinned).toBe(true);
  });
});

/*
 * The second pane.
 *
 * Two panes is the whole feature and the hard part is that the split names a
 * tab the strip is free to move, close and re-order underneath it. So most of
 * what is here is the strip changing around a split rather than the split
 * being made: the two refusals, then a close, a select, a drag and a pin.
 */
describe('a second pane', () => {
  it('has none until one is asked for', () => {
    const s = strip(['home', 'calendar']);
    expect(s.split).toBeUndefined();
    expect(besideTab(s)).toBeNull();
  });

  it('shows the tab named, on the side asked for', () => {
    const s = splitWith(strip(['home', 'calendar', 'study']), 't2', 'down');
    expect(s.split).toEqual({ id: 't2', side: 'down' });
    expect(besideTab(s)?.screen).toBe('study');
    // The tab is in a pane, not moved into one: it is still in the strip, in
    // its seat, and the one you are on has not changed.
    expect(names(s)).toEqual(['home', 'calendar', 'study']);
    expect(current(s).screen).toBe('home');
  });

  /*
   * One tab in two panes is the same page drawn twice with one of them
   * impossible to close without guessing which was meant. `openBeside` is
   * what "this place twice" is for, and the second of those two tabs can
   * then go in the pane.
   */
  it('refuses to put the tab you are on beside itself', () => {
    const was = strip(['home', 'calendar'], 1);
    expect(splitWith(was, 't1', 'right')).toBe(was);
  });

  it('refuses an id the strip has not got', () => {
    const was = strip(['home', 'calendar']);
    expect(splitWith(was, 'nobody', 'right')).toBe(was);
  });

  /*
   * Two is the limit, so a second Split Right has only one thing it could
   * mean. Refusing would leave somebody pressing Close Split before every
   * split for no reason they could see.
   */
  it('replaces the pane rather than making a third', () => {
    const s = splitWith(splitWith(strip(['home', 'calendar', 'study']), 't1', 'right'), 't2', 'left');
    expect(s.split).toEqual({ id: 't2', side: 'left' });
  });

  it('goes back to one pane without closing the tab', () => {
    const s = unsplit(splitWith(strip(['home', 'calendar']), 't1', 'right'));
    expect(s.split).toBeUndefined();
    expect(names(s)).toEqual(['home', 'calendar']);
  });

  it('is unchanged by closing a pane there is not one of', () => {
    const was = strip(['home', 'calendar']);
    expect(unsplit(was)).toBe(was);
  });
});

/*
 * And the rule that makes the rest of the strip safe to leave alone: a pane
 * always holds a tab, and never the one beside it. Every one of these is a
 * function that has no idea panes exist — which is the point of holding it in
 * `tidy` rather than in the four places that could break it.
 */
describe('a second pane, as the strip moves under it', () => {
  const split = (at = 0) => splitWith(strip(['home', 'calendar', 'study'], at), 't2', 'right');

  it('closes when the tab in it is closed', () => {
    const s = close(split(), 2);
    expect(s.split).toBeUndefined();
    expect(names(s)).toEqual(['home', 'calendar']);
  });

  it('closes when you go to the tab that was in it', () => {
    const s = select(split(), 2);
    expect(s.split).toBeUndefined();
    expect(current(s).screen).toBe('study');
  });

  it('survives a tab closing in front of it, which an index would not', () => {
    const s = close(split(), 1);
    expect(besideTab(s)?.screen).toBe('study');
    // The seat moved from 2 to 1. A split by index would now be pointing past
    // the end, and a clamped one would be showing `home`.
    expect(s.tabs.findIndex((t) => t.id === 't2')).toBe(1);
  });

  it('survives the tab in it being dragged somewhere else', () => {
    const s = rearrange(split(), ['t2', 't0', 't1'], 't2');
    expect(besideTab(s)?.screen).toBe('study');
    expect(names(s)).toEqual(['study', 'home', 'calendar']);
  });

  it('survives the tab in it being pinned', () => {
    const s = pin(split(), 2);
    expect(besideTab(s)?.screen).toBe('study');
  });

  it('closes when the group the tab in it was in is closed', () => {
    const grouped = makeGroup(split(), 2, 'Reading', 0, 'g');
    const s = closeGroup(grouped, 'g');
    expect(s.split).toBeUndefined();
  });
});

describe('a second pane, through the store and back', () => {
  it('comes back naming the same tab, on the same side', () => {
    const was = splitWith(strip(['home', 'calendar'], 0), 't1', 'down');
    expect(load(dump(was), known)).toEqual(was);
  });

  it('is absent rather than empty on a strip that had no pane', () => {
    const was = strip(['home', 'calendar']);
    const back = load(dump(was), known);
    expect(back.split).toBeUndefined();
    expect('split' in back).toBe(false);
  });

  /*
   * Read field by field like everything else off the device, and then left to
   * `tidy`, which is what drops a pane naming a tab the tab reader dropped.
   * A second check here would be a second opinion to keep in step.
   */
  it('drops a stored pane naming a tab that did not survive the read', () => {
    const saved = JSON.stringify({
      tabs: [{ id: 'a', screen: 'home', title: 'Today', place: [] }],
      at: 0,
      split: { id: 'b', side: 'right' },
    });
    expect(load(saved, known).split).toBeUndefined();
  });

  it('drops a stored pane that is not a pane', () => {
    const tabs = [
      { id: 'a', screen: 'home', title: 'Today', place: [] },
      { id: 'b', screen: 'study', title: 'Study', place: [] },
    ];
    const withSplit = (split: unknown) => load(JSON.stringify({ tabs, at: 0, split }), known).split;
    expect(withSplit({ id: 'b', side: 'sideways' })).toBeUndefined();
    expect(withSplit({ id: 'b' })).toBeUndefined();
    expect(withSplit({ side: 'right' })).toBeUndefined();
    expect(withSplit({ id: '', side: 'right' })).toBeUndefined();
    expect(withSplit('right')).toBeUndefined();
    expect(withSplit(null)).toBeUndefined();
    // And the one that is.
    expect(withSplit({ id: 'b', side: 'right' })).toEqual({ id: 'b', side: 'right' });
  });

  /*
   * The stored strip says you are on the tab the stored pane names, which is
   * the state `select` cannot produce but a hand-edited store can.
   */
  it('drops a stored pane naming the tab the stored strip is on', () => {
    const saved = JSON.stringify({
      tabs: [
        { id: 'a', screen: 'home', title: 'Today', place: [] },
        { id: 'b', screen: 'study', title: 'Study', place: [] },
      ],
      at: 1,
      split: { id: 'b', side: 'right' },
    });
    expect(load(saved, known).split).toBeUndefined();
  });
});
