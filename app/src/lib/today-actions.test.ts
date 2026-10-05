import { describe, expect, it } from 'vitest';
import { rank } from './actions';
import { DEADLINE_HORIZON_DAYS, todayActions } from './today-actions';
import { nextTodayDecision, pathSnapshot, type PathSnapshot } from './today-decision';
import type { DatedItem } from './types';

const NOW = new Date(2026, 8, 27, 12).getTime();

/** Only the fields Today reads; the rest of `DatedItem` is never touched here. */
const item = (id: string, daysAway: number, confirmed = false): DatedItem =>
  ({
    id,
    c: 'econ',
    title: `Problem set ${id}`,
    kind: 'assignment',
    date: new Date(NOW + daysAway * 86_400_000),
    dueShort: `in ${daysAway} days`,
    daysAway,
    dueAt: 23 * 60 + 59,
    checked: { confirmed },
  }) as unknown as DatedItem;

const moving: PathSnapshot = { ...pathSnapshot([], []), state: 'moving' };
const base = { path: moving, upcoming: [] as DatedItem[], done: {}, reviewDue: 0, catalogEmpty: false };

describe('what Today proposes', () => {
  it('proposes every unfinished deadline inside the horizon, and nothing past it', () => {
    const ids = todayActions({
      ...base,
      upcoming: [item('a', 1), item('b', DEADLINE_HORIZON_DAYS), item('c', DEADLINE_HORIZON_DAYS + 1), item('d', 2)],
      done: { d: true },
    }).map((a) => a.id);
    expect(ids).toEqual(['deadline:a', 'deadline:b']);
  });

  it('labels a checked date imported and an unchecked one needs review', () => {
    const [yes, no] = todayActions({ ...base, upcoming: [item('y', 1, true), item('n', 1, false)] });
    expect(yes.source.label).toBe('imported');
    expect(no.source.label).toBe('needs_review');
    expect(no.explanation.limitations.join(' ')).toMatch(/may be wrong/);
  });

  it('labels the path an estimate, never official', () => {
    const [path] = todayActions({ ...base, path: pathSnapshot([], []) });
    expect(path.id).toBe('path:complete');
    expect(path.source.label).toBe('estimated');
    expect(path.explanation.limitations.join(' ')).toMatch(/never a degree audit/);
  });

  it('gives every action the whole explanation sheet', () => {
    const all = todayActions({
      ...base,
      path: pathSnapshot([], []),
      upcoming: [item('a', 1)],
      reviewDue: 4,
      catalogEmpty: true,
    });
    expect(all.map((a) => a.type).sort()).toEqual(['deadline', 'path', 'setup', 'study']);
    for (const a of all) {
      expect(a.explanation.trigger, a.id).not.toBe('');
      expect(a.explanation.expectedImpact, a.id).not.toBe('');
      expect(a.explanation.limitations.length, a.id).toBeGreaterThan(0);
      expect(a.explanation.alternatives.length, a.id).toBeGreaterThan(0);
      expect(a.primary.target, a.id).toMatch(/^#\//);
    }
  });

  it('keeps ids stable from one day to the next, so a snooze is not forgotten', () => {
    const today = todayActions({ ...base, upcoming: [item('a', 3)] });
    const tomorrow = todayActions({ ...base, upcoming: [item('a', 2)] });
    expect(today.map((a) => a.id)).toEqual(tomorrow.map((a) => a.id));
  });
});

describe('agreement with the single decision it replaces', () => {
  it('puts first what nextTodayDecision would have chosen', () => {
    const cases = [
      { ...base, upcoming: [item('soon', 2), item('later', 9)], path: pathSnapshot([], []) },
      { ...base, path: pathSnapshot([], []), reviewDue: 3 },
      { ...base, reviewDue: 3 },
    ];
    for (const input of cases) {
      const expected = nextTodayDecision(input).id;
      const top = rank(todayActions(input), {}, NOW).mostImportant?.action.id;
      expect(top, expected).toBe(expected);
    }
  });
});
