import { describe, expect, it } from 'vitest';
import { whatChanged } from './whatchanged';
import type { Item } from './types';

const NOW = new Date(2026, 8, 18, 20, 0);

const item = (patch: Partial<Item> & { id: string }): Item => ({
  c: 'econ',
  title: 'Midterm',
  kind: 'Exam',
  month: 9,
  day: 8,
  dueTime: '11:59 PM',
  weight: '20%',
  where: '',
  detail: '',
  quote: '',
  source: 'Syllabus',
  ...patch,
});

describe('whatChanged', () => {
  it('reports nothing when the two readings agree', () => {
    const a = [item({ id: 'm' })];
    expect(whatChanged(a, [{ ...a[0] }], NOW)).toEqual([]);
  });

  it('reports a moved date with previous, new, source, effective date and days away', () => {
    const [c] = whatChanged(
      [item({ id: 'm', day: 8 })],
      [item({ id: 'm', day: 15, quote: 'Midterm is Oct 15', checked: { confirmed: true, page: 4 } })],
      NOW,
    );
    expect(c).toMatchObject({ kind: 'moved', previous: 'Oct 8', next: 'Oct 15', daysAway: 27 });
    expect(c.source).toBe('Syllabus, p. 4: "Midterm is Oct 15"');
    expect(c.impact).toContain('7 days later');
    expect(c.effective).toEqual(new Date(2026, 9, 15));
  });

  it('says earlier, singular, when a date moves up one day', () => {
    const [c] = whatChanged([item({ id: 'm', day: 9 })], [item({ id: 'm', day: 8 })], NOW);
    expect(c.impact).toContain('1 day earlier');
  });

  it('reports a new time on the same day as retimed, not moved', () => {
    const out = whatChanged([item({ id: 'm' })], [item({ id: 'm', dueTime: '5:00 PM' })], NOW);
    expect(out.map((c) => c.kind)).toEqual(['retimed']);
    expect(out[0]).toMatchObject({ previous: '11:59 PM', next: '5:00 PM' });
  });

  it('reports a moved date and a weight change as two changes', () => {
    const out = whatChanged([item({ id: 'm' })], [item({ id: 'm', day: 10, weight: '30%' })], NOW);
    expect(out.map((c) => c.kind).sort()).toEqual(['moved', 'reweighted']);
  });

  it('reports additions and calls a removal "no longer listed", never cancelled', () => {
    const out = whatChanged([item({ id: 'old', title: 'Quiz' })], [item({ id: 'new', title: 'Paper', day: 20 })], NOW);
    const added = out.find((c) => c.kind === 'added')!;
    const removed = out.find((c) => c.kind === 'removed')!;
    expect(added).toMatchObject({ previous: null, title: 'Paper' });
    expect(removed).toMatchObject({ next: null, title: 'Quiz' });
    expect(removed.impact).toMatch(/not the same as cancelled/);
    expect(JSON.stringify(removed)).not.toMatch(/"cancelled"/);
  });

  it('marks a change to a date already past instead of implying it is upcoming', () => {
    const [c] = whatChanged([], [item({ id: 'p', month: 8, day: 1 })], NOW);
    expect(c.daysAway).toBeLessThan(0);
    expect(c.impact).toContain('already passed');
  });

  it('orders the soonest effective change first, stably', () => {
    const out = whatChanged(
      [],
      [item({ id: 'b', title: 'B', day: 20 }), item({ id: 'a', title: 'A', day: 5 }), item({ id: 'c', title: 'C', day: 5 })],
      NOW,
    );
    expect(out.map((c) => c.title)).toEqual(['A', 'C', 'B']);
  });

  it('uses the item year over the current year across a year boundary', () => {
    const [c] = whatChanged([], [item({ id: 'j', month: 0, day: 12, year: 2027 })], NOW);
    expect(c.effective).toEqual(new Date(2027, 0, 12));
    expect(c.daysAway).toBe(116);
  });
});
