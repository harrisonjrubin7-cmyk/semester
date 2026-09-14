// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MARKS_KEY,
  MARK_NAME,
  MAX_MARKS,
  dump,
  forget,
  keep,
  load,
  read,
  rename,
  savable,
  savedAt,
  shift,
  toggle,
  write,
  type Bookmark,
} from './bookmarks';
import { fresh, justGo } from './browser';
import type { Screen } from './types';

/**
 * The rules of a bookmark, which are nearly the rules of a tab and differ in
 * the two places that matter.
 *
 * A tab is where you are and a bookmark is where you keep going back to, so a
 * bookmark is identified by its place rather than by its name, and a bookmark
 * whose place did not survive the store is dropped rather than landed on the
 * nearest screen. Both of those are invisible until somebody has forty of
 * them and one of them quietly opens the wrong thing.
 */

/** Every screen this suite uses is a real one, so `known` can be honest. */
const known = (screen: string) => ['home', 'calendar', 'courses', 'guide'].includes(screen);

const guide = { screen: 'guide' as Screen, title: 'ECON 1020', place: [{ type: 'openGuide' as const, id: 'econ', mode: 'read' as const }] };
const today = { screen: 'home' as Screen, title: 'Today', place: justGo('home') };

const names = (list: Bookmark[]) => list.map((m) => m.title);

beforeEach(() => {
  localStorage.clear();
});

describe('saving a place', () => {
  it('keeps the name of the thing, not the name of the screen', () => {
    expect(names(keep([], guide))).toEqual(['ECON 1020']);
  });

  it('puts a new one on the end, where it will not move the chip under the pointer', () => {
    expect(names(keep(keep([], today), guide))).toEqual(['Today', 'ECON 1020']);
  });

  it('refuses to save the same place twice', () => {
    const once = keep([], guide);
    expect(keep(once, { ...guide, title: 'The study guide' })).toBe(once);
  });

  it('tells two places on the same screen apart', () => {
    const two = keep(keep([], guide), {
      ...guide,
      title: 'PSCI 1100',
      place: [{ type: 'openGuide', id: 'psci', mode: 'read' }],
    });
    expect(names(two)).toEqual(['ECON 1020', 'PSCI 1100']);
  });

  it('has nothing to save on a new tab', () => {
    expect(savable(fresh('a'))).toBe(false);
    expect(savable({ ...fresh('a'), screen: 'home', place: justGo('home') })).toBe(true);
    expect(keep([], { ...today, place: [] })).toEqual([]);
  });

  it('answers whether the page in front of you is saved, by place', () => {
    const list = keep([], guide);
    expect(savedAt(list, 'guide', guide.place)).not.toBeNull();
    expect(savedAt(list, 'guide', [{ type: 'openGuide', id: 'psci', mode: 'read' }])).toBeNull();
    expect(savedAt(list, 'home', guide.place)).toBeNull();
  });

  it('is a star: saved, then not, then saved again', () => {
    const on = toggle([], guide);
    expect(on).toHaveLength(1);
    expect(toggle(on, guide)).toHaveLength(0);
    expect(toggle(toggle(on, guide), guide)).toHaveLength(1);
  });
});

describe('a bookmark that is already there', () => {
  it('is renamed without becoming a different bookmark', () => {
    const was = keep([], guide);
    const list = rename(was, was[0].id, 'Econ guide');
    expect(names(list)).toEqual(['Econ guide']);
    expect(savedAt(list, 'guide', guide.place)).not.toBeNull();
  });

  it('keeps its name when the new one is nothing but space', () => {
    const was = keep([], guide);
    expect(rename(was, was[0].id, '   ')).toBe(was);
  });

  it('is cut to a length a chip can hold', () => {
    const was = keep([], { ...guide, title: 'x'.repeat(MARK_NAME + 40) });
    expect(was[0].title).toHaveLength(MARK_NAME);
  });

  it('is forgotten, and an id that is not there changes nothing', () => {
    const was = keep([], guide);
    expect(forget(was, was[0].id)).toEqual([]);
    expect(forget(was, 'nope')).toBe(was);
  });

  it('moves one place along the bar and stops at the ends', () => {
    const list = keep(keep(keep([], today), guide), { ...today, title: 'Calendar', place: justGo('calendar'), screen: 'calendar' });
    const [first, , last] = list;
    expect(names(shift(list, last.id, -1))).toEqual(['Today', 'Calendar', 'ECON 1020']);
    expect(shift(list, first.id, -1)).toBe(list);
    expect(shift(list, last.id, 1)).toBe(list);
  });
});

describe('the bar, through the store and back', () => {
  it('goes to the device and comes back the same', () => {
    const was = keep(keep([], today), guide);
    write(was);
    expect(localStorage.getItem(MARKS_KEY)).toBeTruthy();
    expect(read(known)).toEqual(was);
  });

  it('answers with an empty bar rather than throwing on nonsense', () => {
    expect(load('not json{', known)).toEqual([]);
    expect(load(null, known)).toEqual([]);
    expect(load('{"marks":"nope"}', known)).toEqual([]);
  });

  it('drops a bookmark of a screen this build no longer has', () => {
    const saved = JSON.stringify({
      marks: [{ id: 'a', screen: 'gone', title: 'Gone', place: [{ type: 'go', screen: 'gone' }] }],
    });
    expect(load(saved, known)).toEqual([]);
  });

  it('drops a bookmark whose place did not survive the check', () => {
    // Where this differs from a tab on purpose: a tab that loses its place
    // still knows its screen and can land you there. A chip that says ECON
    // 1020 and opens the courses list is worse than no chip.
    const saved = JSON.stringify({
      marks: [
        { id: 'a', screen: 'home', title: 'Today', place: [{ type: 'eraseEverything' }] },
        { id: 'b', screen: 'home', title: 'Today', place: [] },
      ],
    });
    expect(load(saved, known)).toEqual([]);
  });

  it('refuses an action carrying anything but flat data', () => {
    const saved = JSON.stringify({
      marks: [{ id: 'a', screen: 'home', title: 'Today', place: [{ type: 'go', screen: { x: 1 } }] }],
    });
    expect(load(saved, known)).toEqual([]);
  });

  it('will not read back more than a bar could ever hold', () => {
    const many = Array.from({ length: MAX_MARKS + 20 }, (_, i) => ({
      id: `m${i}`,
      screen: 'home',
      title: `Mark ${i}`,
      place: [{ type: 'go', screen: 'home' }],
    }));
    expect(load(JSON.stringify({ marks: many }), known)).toHaveLength(MAX_MARKS);
  });

  it('names a bookmark after its screen when the stored name is empty', () => {
    const saved = dump([{ id: 'a', screen: 'home', title: '', place: justGo('home') }]);
    expect(load(saved, known)[0].title).toBe('home');
  });
});
