import { describe, expect, it } from 'vitest';
import { DESTINATIONS, TASKS, type TaskTag } from './nav';
import { SHORTCUTS } from './keys';
import { WHY, allRows, byTask, matches, openedLabel, untried, STALE_DAYS } from './everything';

/**
 * The Everything directory, and the promise it makes.
 *
 * The promise is that it is not a list — that adding a screen to the registry
 * puts it here and removing one takes it away, with nothing else touched. A
 * directory that has to be maintained alongside the thing it describes is a
 * directory that is wrong by November, and every test here is a way of
 * checking that this one cannot be.
 */

const says = (d: (typeof DESTINATIONS)[number]) => ({ label: d.label, blurb: d.blurb });
const keywordsFor = (screen: string) => DESTINATIONS.find((d) => d.screen === screen)?.keywords ?? '';
const NOW = new Date(2026, 8, 7).getTime();
const DAY = 86_400_000;

describe('by area', () => {
  it('shows every screen in the registry exactly once', () => {
    const rows = allRows(DESTINATIONS, says, []).filter((r) => r.view === 'area');
    expect(rows).toHaveLength(DESTINATIONS.length);
    expect(new Set(rows.map((r) => r.screen)).size).toBe(DESTINATIONS.length);
  });

  it('files each under its own shelf, and invents no others', () => {
    const rows = allRows(DESTINATIONS, says, []).filter((r) => r.view === 'area');
    for (const r of rows) {
      expect(r.where).toBe(DESTINATIONS.find((d) => d.screen === r.screen)?.group);
    }
  });

  it('carries the blurb, in full', () => {
    // Acceptance criterion 1. Not "starts with" — a directory of first halves
    // is what this screen exists instead of.
    for (const r of allRows(DESTINATIONS, says, []).filter((x) => x.view === 'area')) {
      const d = DESTINATIONS.find((x) => x.screen === r.screen)!;
      expect(r.sub).toBe(d.blurb);
    }
  });
});

describe('by task', () => {
  it('gives every screen at least one thing somebody would be trying to do', () => {
    const orphans = DESTINATIONS.filter((d) => d.taskTags.length === 0).map((d) => d.screen);
    expect(orphans).toEqual([]);
  });

  it('uses no tag without a heading', () => {
    const known = new Set(TASKS.map(([id]) => id as string));
    const loose = DESTINATIONS.flatMap((d) => d.taskTags.filter((t) => !known.has(t)));
    expect([...new Set(loose)]).toEqual([]);
  });

  it('leaves no heading empty', () => {
    // A section with nothing under it reads as a bug rather than as a shelf
    // somebody has not filled.
    const used = new Set(DESTINATIONS.flatMap((d) => d.taskTags));
    const bare = TASKS.map(([id]) => id).filter((id) => !used.has(id as TaskTag));
    expect(bare).toEqual([]);
  });

  it('lets a screen answer more than one question', () => {
    // The point of tags over shelves. If this ever came out at zero the two
    // views would be the same view with different headings.
    expect(DESTINATIONS.filter((d) => d.taskTags.length > 1).length).toBeGreaterThan(10);
  });

  it('keeps the sections in the order the headings are written', () => {
    const order = byTask(DESTINATIONS).map((s) => s.tag);
    expect(order).toEqual(TASKS.map(([id]) => id).filter((id) => order.includes(id as TaskTag)));
  });
});

describe('not tried yet', () => {
  const rows = DESTINATIONS.slice(0, 4);

  it('lists a screen nobody has opened', () => {
    expect(untried(rows, {}, {}, NOW).map((d) => d.screen)).toEqual(rows.map((d) => d.screen));
  });

  it('drops one opened recently', () => {
    const visited = Object.fromEntries(rows.map((d) => [d.screen, true]));
    const last = { [rows[0].screen]: NOW - 3 * DAY };
    expect(untried(rows, visited, last, NOW).map((d) => d.screen)).not.toContain(rows[0].screen);
  });

  it('brings back one abandoned two months ago', () => {
    const visited = { [rows[0].screen]: true };
    const last = { [rows[0].screen]: NOW - (STALE_DAYS + 1) * DAY };
    expect(untried([rows[0]], visited, last, NOW).map((d) => d.screen)).toEqual([rows[0].screen]);
  });

  it('does not call a screen untried just because it has no date', () => {
    // Anybody who used the app before `lastOpened` existed has `visited` and
    // no times. Treating that as never-opened would tell somebody who has
    // used the app all term that they have tried none of it.
    expect(untried([rows[0]], { [rows[0].screen]: true }, {}, NOW)).toEqual([]);
  });

  it('has a reason for every screen it can show', () => {
    // The "why this exists" lines. A screen with none falls back to its blurb,
    // which is allowed — but the fallback should be the exception, so this
    // guards the proportion rather than demanding fifty-four lines.
    const withWhy = DESTINATIONS.filter((d) => WHY[d.screen]).length;
    expect(withWhy).toBeGreaterThan(DESTINATIONS.length * 0.75);
  });

  it('never repeats the blurb as the reason', () => {
    for (const d of DESTINATIONS) {
      if (WHY[d.screen]) expect(WHY[d.screen]).not.toBe(d.blurb);
    }
  });
});

describe('shortcuts', () => {
  it('renders the same array the ? sheet does', () => {
    const rows = allRows(DESTINATIONS, says, []).filter((r) => r.view === 'keys');
    expect(rows.map((r) => r.title)).toEqual(SHORTCUTS.map((s) => s.does));
  });
});

describe('searching', () => {
  const universe = allRows(DESTINATIONS, says, DESTINATIONS);
  const find = (q: string) =>
    universe.filter((f) => matches(f, q, keywordsFor)).map((f) => f.title);

  it('finds Meal plan from "swipes"', () => {
    expect(find('swipes')).toContain('Meal plan');
  });

  it('finds Housing from "dorm"', () => {
    expect(find('dorm')).toContain('Housing');
  });

  it('finds a screen by a task heading nobody wrote as a keyword', () => {
    expect(find('plan my week').length).toBeGreaterThan(0);
  });

  it('finds a shortcut by what it does', () => {
    expect(find('filter this screen').length).toBeGreaterThan(0);
  });

  it('says which view each hit came from', () => {
    for (const f of universe.filter((x) => matches(x, 'grades', keywordsFor))) {
      expect(['area', 'task', 'untried', 'keys']).toContain(f.view);
      expect(f.where.length).toBeGreaterThan(0);
    }
  });
});

describe('when a screen was last opened', () => {
  it('says so plainly, and says nothing it does not know', () => {
    expect(openedLabel(undefined, NOW)).toBe('Never opened');
    expect(openedLabel(NOW, NOW)).toBe('Opened today');
    expect(openedLabel(NOW - DAY, NOW)).toBe('Opened yesterday');
    expect(openedLabel(NOW - 3 * DAY, NOW)).toBe('Opened 3 days ago');
    expect(openedLabel(NOW - 9 * DAY, NOW)).toBe('Opened last week');
    expect(openedLabel(NOW - 40 * DAY, NOW)).toBe('Opened 6 weeks ago');
    expect(openedLabel(NOW - 400 * DAY, NOW)).toBe('Opened over a year ago');
  });
});

describe('the promise', () => {
  it('writes down no screen of its own', () => {
    // Acceptance criterion 7, as far as a unit test can carry it: every row
    // in every view traces back to the registry or to the shortcut array.
    const known = new Set<string>(DESTINATIONS.map((d) => d.screen));
    for (const r of allRows(DESTINATIONS, says, DESTINATIONS)) {
      if (r.view === 'keys') continue;
      expect(known.has(r.screen as string)).toBe(true);
    }
  });

  it('drops a screen the moment the registry does', () => {
    const short = DESTINATIONS.filter((d) => d.screen !== 'grades');
    const rows = allRows(short, says, short);
    expect(rows.some((r) => r.screen === 'grades')).toBe(false);
  });

  it('picks up a screen the moment the registry has one', () => {
    const extra = {
      ...DESTINATIONS[0],
      screen: 'somethingNew' as (typeof DESTINATIONS)[number]['screen'],
      label: 'Something new',
      taskTags: ['study'] as TaskTag[],
    };
    const rows = allRows([...DESTINATIONS, extra], says, []);
    expect(rows.filter((r) => r.screen === 'somethingNew').length).toBeGreaterThanOrEqual(2);
  });
});
