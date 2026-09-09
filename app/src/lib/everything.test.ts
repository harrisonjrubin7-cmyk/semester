import { describe, expect, it } from 'vitest';
import { DESTINATIONS, TASKS, type TaskTag } from './nav';
import { SHORTCUTS } from './keys';
import { WHY, byTask, openedLabel, untried, STALE_DAYS } from './everything';

/**
 * The Everything directory, and the promise it makes.
 *
 * The promise is that it is not a list — that adding a screen to the registry
 * puts it here and removing one takes it away, with nothing else touched. A
 * directory that has to be maintained alongside the thing it describes is a
 * directory that is wrong by November, and every test here is a way of
 * checking that this one cannot be.
 */

const NOW = new Date(2026, 8, 7).getTime();
const DAY = 86_400_000;

describe('by area', () => {
  it('names every screen in the registry exactly once', () => {
    expect(new Set(DESTINATIONS.map((d) => d.screen)).size).toBe(DESTINATIONS.length);
  });

  it('files each under a shelf', () => {
    expect(DESTINATIONS.filter((d) => !d.group).map((d) => d.screen)).toEqual([]);
  });

  it('carries a blurb for each, in full', () => {
    // Acceptance criterion 1. The view renders `d.blurb` as it stands — a
    // directory of first halves is what this screen exists instead of.
    expect(DESTINATIONS.filter((d) => !d.blurb.trim()).map((d) => d.screen)).toEqual([]);
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
  it('renders the same array the ? sheet does, with a key and a description each', () => {
    // The keys view maps `SHORTCUTS` directly, so what this can still check is
    // that every row in it has something to draw.
    expect(SHORTCUTS.filter((s) => !s.key || !s.does).map((s) => s.key)).toEqual([]);
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
    // Acceptance criterion 7, as far as a unit test can carry it: every row in
    // the task view traces back to the registry it was built from.
    const known = new Set<string>(DESTINATIONS.map((d) => d.screen));
    for (const section of byTask(DESTINATIONS)) {
      for (const d of section.rows) expect(known.has(d.screen)).toBe(true);
    }
  });

  it('drops a screen the moment the registry does', () => {
    const short = DESTINATIONS.filter((d) => d.screen !== 'grades');
    const rows = byTask(short).flatMap((s) => s.rows);
    expect(rows.some((d) => d.screen === 'grades')).toBe(false);
    expect(untried(short, {}, {}, NOW).some((d) => d.screen === 'grades')).toBe(false);
  });

  it('picks up a screen the moment the registry has one', () => {
    const extra = {
      ...DESTINATIONS[0],
      screen: 'somethingNew' as (typeof DESTINATIONS)[number]['screen'],
      label: 'Something new',
      taskTags: ['study'] as TaskTag[],
    };
    const rows = byTask([...DESTINATIONS, extra]).flatMap((s) => s.rows);
    expect(rows.some((d) => (d.screen as string) === 'somethingNew')).toBe(true);
  });
});
