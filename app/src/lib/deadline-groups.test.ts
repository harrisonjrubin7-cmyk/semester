import { describe, expect, it } from 'vitest';
import { group, type Deadline } from './deadline-groups';

const now = new Date(2026, 9, 14, 9, 0).getTime(); // Wed 9:00
const h = (n: number) => now + n * 3_600_000;
const d = (id: string, due: number | null, label: Deadline['label'] = 'institution_verified'): Deadline => ({
  id,
  title: id,
  due,
  label,
});

describe('group', () => {
  it('sorts confirmed deadlines by horizon', () => {
    const g = group([d('a', h(5)), d('b', h(30)), d('c', h(24 * 5)), d('d', h(24 * 20))], now);
    expect(g.today.map((x) => x.id)).toEqual(['a']);
    expect(g.next48.map((x) => x.id)).toEqual(['b']);
    expect(g.week.map((x) => x.id)).toEqual(['c']);
    expect(g.later.map((x) => x.id)).toEqual(['d']);
  });

  it('sends undated, estimated and needs-review items to Needs confirmation whatever their date', () => {
    const g = group([d('u', null), d('e', h(2), 'estimated'), d('r', h(2), 'needs_review')], now);
    expect(g.confirm.map((x) => x.id).sort()).toEqual(['e', 'r', 'u']);
    expect(g.today).toHaveLength(0);
  });

  it('keeps a passed deadline in Today, recoverable rather than red', () => {
    const [p] = group([d('p', h(-3))], now).today;
    expect(p.passed).toBe(true);
    expect(p.status).toBe('Passed, still recoverable');
    expect(p.recovery).toContain('Reschedule');
  });

  it('does not call an imported date institution verified', () => {
    const [i] = group([d('i', h(5), 'imported')], now).today;
    expect(i.confidence).toBe('Imported, not checked');
  });

  it('drops finished work and orders each group by date', () => {
    const g = group([d('late', h(8)), { ...d('x', h(1)), done: true }, d('soon', h(2))], now);
    expect(g.today.map((x) => x.id)).toEqual(['soon', 'late']);
  });
});
