import { describe, expect, it } from 'vitest';
import {
  AGES,
  ageOf,
  anyPersonal,
  coursesOn,
  grouped,
  named,
  only,
  seenAt,
  sorted,
  stamp,
  type Filed,
} from './shelf';
import type { CourseId } from './types';

const DAY = 86_400_000;
/** A fixed afternoon, so "today" is a real local day rather than a boundary. */
const NOW = new Date(2026, 8, 11, 14, 30).getTime();

const file = (over: Partial<Filed> & { id: string }): Filed => ({
  title: '',
  courseId: null,
  created: NOW,
  updated: NOW,
  ...over,
});

describe('naming a file that has no name', () => {
  it('falls back rather than drawing an empty row', () => {
    expect(named(file({ id: 'a' }), 'Untitled sheet')).toBe('Untitled sheet');
  });

  it('treats a title of spaces as no title, because it reads as one', () => {
    expect(named(file({ id: 'a', title: '   ' }), 'Untitled')).toBe('Untitled');
  });

  it('trims a real one rather than drawing the space', () => {
    expect(named(file({ id: 'a', title: '  Memo ' }), 'Untitled')).toBe('Memo');
  });
});

describe('narrowing to one course', () => {
  const items = [
    file({ id: 'a', courseId: 'econ' as CourseId }),
    file({ id: 'b', courseId: null }),
    file({ id: 'c', courseId: 'psci' as CourseId }),
  ];

  it('gives everything back when nothing is asked', () => {
    expect(only(items, 'all')).toHaveLength(3);
  });

  it('gives one course', () => {
    expect(only(items, 'econ' as CourseId).map((i) => i.id)).toEqual(['a']);
  });

  it('gives what belongs to no course, which is not the same as everything', () => {
    expect(only(items, 'personal').map((i) => i.id)).toEqual(['b']);
  });
});

describe('sorting', () => {
  const items = [
    file({ id: 'a', title: 'Problem set 10', updated: NOW - DAY, created: NOW - 9 * DAY }),
    file({ id: 'b', title: 'Problem set 2', updated: NOW, created: NOW - 20 * DAY }),
    file({ id: 'c', title: 'Apology', updated: NOW - 40 * DAY, created: NOW }),
  ];

  it('puts the last one you touched first', () => {
    expect(sorted(items, 'opened').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts 2 before 10, which is what somebody numbering files meant', () => {
    expect(sorted(items, 'name').map((i) => i.title)).toEqual([
      'Apology',
      'Problem set 2',
      'Problem set 10',
    ]);
  });

  it('sorts by when it was made, which is a different order from when it was touched', () => {
    expect(sorted(items, 'made').map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('leaves the caller’s array alone', () => {
    const before = items.map((i) => i.id);
    sorted(items, 'name');
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe('how old something is', () => {
  it('calls this afternoon today', () => {
    expect(ageOf(NOW - 60_000, NOW)).toBe('today');
  });

  it('calls four minutes before midnight yesterday, rather than today', () => {
    const lastNight = new Date(2026, 8, 10, 23, 56).getTime();
    expect(ageOf(lastNight, NOW)).toBe('week');
  });

  it('keeps a week a week and a day past it a month', () => {
    expect(ageOf(NOW - 7 * DAY, NOW)).toBe('week');
    expect(ageOf(NOW - 8 * DAY, NOW)).toBe('month');
  });

  it('keeps thirty days a month and a day past it earlier', () => {
    expect(ageOf(NOW - 30 * DAY, NOW)).toBe('month');
    expect(ageOf(NOW - 31 * DAY, NOW)).toBe('earlier');
  });

  it('does not file a clock that ran ahead under Earlier', () => {
    expect(ageOf(NOW + 3 * DAY, NOW)).toBe('today');
  });
});

describe('the shelf as it is drawn', () => {
  const items = [
    file({ id: 'today', updated: NOW - 60_000 }),
    file({ id: 'week', updated: NOW - 3 * DAY }),
    file({ id: 'old', updated: NOW - 400 * DAY }),
  ];

  it('cuts the list into Google’s four headings, newest first', () => {
    expect(grouped(items, 'opened', NOW).map((g) => g.label)).toEqual([
      'Today',
      'Previous 7 days',
      'Earlier',
    ]);
  });

  it('never returns a heading with nothing under it', () => {
    const groups = grouped(items, 'opened', NOW);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.map((g) => g.label)).not.toContain('Previous 30 days');
  });

  it('drops the headings when the sort is alphabetical, because they stop meaning anything', () => {
    const groups = grouped(items, 'name', NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('');
  });

  it('groups a date-made sort by when things were made', () => {
    const made = [
      file({ id: 'a', updated: NOW, created: NOW - 400 * DAY }),
      file({ id: 'b', updated: NOW - 400 * DAY, created: NOW }),
    ];
    expect(grouped(made, 'made', NOW)).toEqual([
      { label: 'Today', items: [made[1]] },
      { label: 'Earlier', items: [made[0]] },
    ]);
  });

  it('has nothing to draw for an empty shelf', () => {
    expect(grouped([], 'opened', NOW)).toEqual([]);
    expect(grouped([], 'name', NOW)).toEqual([]);
  });

  it('names all four ages, so nothing can fall through them', () => {
    expect(AGES.map((a) => a.id)).toEqual(['today', 'week', 'month', 'earlier']);
  });
});

describe('the date beside a row', () => {
  it('says a time for something from today', () => {
    expect(stamp(new Date(2026, 8, 11, 9, 5).getTime(), NOW)).toMatch(/9[:.]05/);
  });

  it('says a date without the year inside this year', () => {
    const said = stamp(new Date(2026, 2, 31, 9, 0).getTime(), NOW);
    expect(said).toContain('31');
    expect(said).not.toContain('2026');
  });

  it('says the year for another one, because that is the fact that matters', () => {
    expect(stamp(new Date(2025, 2, 31, 9, 0).getTime(), NOW)).toContain('2025');
  });
});

describe('when something was last in front of somebody', () => {
  it('falls back to when it was edited, for everything made before this was kept', () => {
    expect(seenAt(file({ id: 'a', updated: NOW - DAY }))).toBe(NOW - DAY);
  });

  it('takes the later of the two, because editing is being in front of it', () => {
    expect(seenAt(file({ id: 'a', updated: NOW, opened: NOW - 40 * DAY }))).toBe(NOW);
  });

  it('moves a file you only read, which is the whole point of the field', () => {
    expect(seenAt(file({ id: 'a', updated: NOW - 40 * DAY, opened: NOW }))).toBe(NOW);
  });
});

describe('reading something without changing it', () => {
  /*
   * The bug this holds shut: the default order is called "Last opened" and
   * sorted by `updated`, so a document read this morning and not typed into
   * stayed where it was — under a heading saying it had not been touched in a
   * month, in a list whose label said otherwise.
   */
  const read = file({ id: 'read', created: NOW - 50 * DAY, updated: NOW - 40 * DAY, opened: NOW });
  const typed = file({ id: 'typed', created: NOW - DAY, updated: NOW - DAY });

  it('comes first in the order that claims to track it', () => {
    expect(sorted([typed, read], 'opened').map((i) => i.id)).toEqual(['read', 'typed']);
  });

  it('is filed under today rather than under Earlier', () => {
    expect(grouped([typed, read], 'opened', NOW)).toEqual([
      { label: 'Today', items: [read] },
      { label: 'Previous 7 days', items: [typed] },
    ]);
  });

  it('does not move in the order that is about something else', () => {
    // Newest made first, and being opened this morning does not make a file
    // from fifty days ago a new one.
    expect(sorted([read, typed], 'made').map((i) => i.id)).toEqual(['typed', 'read']);
    expect(grouped([read], 'made', NOW)[0].label).toBe('Earlier');
  });
});

describe('what the course filter may offer', () => {
  const econ = file({ id: 'a', courseId: 'econ' as CourseId });
  const psci = file({ id: 'b', courseId: 'psci' as CourseId });
  const mine = file({ id: 'c', courseId: null });

  it('names each course once, in the order it is first met', () => {
    expect(coursesOn([psci, econ, psci])).toEqual(['psci', 'econ']);
  });

  it('offers nothing for a shelf of files that belong to no course', () => {
    expect(coursesOn([mine, mine])).toEqual([]);
  });

  /*
   * The bug: the options were read off this term's catalogue, so a memo
   * written for a course taken last spring — still on the shelf, still
   * carrying that course's id — was the one file you could not narrow to.
   */
  it('offers a course the app no longer holds, because the file still names it', () => {
    expect(coursesOn([file({ id: 'old', courseId: 'hist1010' as CourseId })])).toEqual(['hist1010']);
  });

  it('offers “not for a course” only where there is one', () => {
    expect(anyPersonal([econ, mine])).toBe(true);
    expect(anyPersonal([econ, psci])).toBe(false);
    expect(anyPersonal([])).toBe(false);
  });
});
