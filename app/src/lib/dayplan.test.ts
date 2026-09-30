import { describe, expect, it } from 'vitest';
import { dayPlan, itemsFromRail, sharedView, type PlanItem } from './dayplan';

const h = (hr: number, m = 0) => hr * 60 + m;
const item = (id: string, start: number | null, minutes: number, over: Partial<PlanItem> = {}): PlanItem => ({
  id, title: id.toUpperCase(), category: 'personal', start, minutes, required: true, flexible: false, energy: null, commute: 0, place: '', source: 'You', privacy: 'private', ...over,
});
const state = (p: ReturnType<typeof dayPlan>, id: string) => p.slots.find((s) => s.item.id === id)!.state;

describe('the day plan', () => {
  it('finds nothing wrong with a day that fits', () => {
    const p = dayPlan([item('a', h(9), 60), item('b', h(11), 60)]);
    expect(p.slots.map((s) => s.state)).toEqual(['clear', 'clear']);
    expect(p.recovery).toEqual([]);
  });

  it('marks two overlapping fixed items as overlapping each other', () => {
    const p = dayPlan([item('a', h(9), 90), item('b', h(10), 60)]);
    expect(state(p, 'a')).toBe('overlaps');
    expect(p.slots.find((s) => s.item.id === 'b')!.with).toEqual(['a']);
  });

  it('marks an item tight when the commute does not fit in the gap, and clear when it does', () => {
    const tight = dayPlan([item('a', h(9), 60), item('b', h(10, 10), 60, { commute: 20 })]);
    expect(state(tight, 'b')).toBe('tight');
    const ok = dayPlan([item('a', h(9), 60), item('b', h(10, 30), 60, { commute: 20 })]);
    expect(state(ok, 'b')).toBe('clear');
  });

  it('treats a missing commute as zero, not a guess', () => {
    expect(state(dayPlan([item('a', h(9), 60), item('b', h(10), 60)]), 'b')).toBe('clear');
  });

  it('finds free windows, shortened by the commute into the next item', () => {
    const p = dayPlan([item('a', h(9), 60), item('b', h(12), 60, { commute: 30 })]);
    expect(p.free).toEqual([{ from: h(8), to: h(9) }, { from: h(10), to: h(11, 30) }, { from: h(13), to: h(22) }]);
  });

  it('fits a floating item into the first window that holds it and reports one that fits nowhere', () => {
    const p = dayPlan([item('a', h(9), 60), item('read', null, 90, { flexible: true }), item('huge', null, 15 * 60)]);
    expect(p.placed).toEqual([{ item: expect.objectContaining({ id: 'read' }), at: h(10) }]);
    expect(p.unplaced.map((i) => i.id)).toEqual(['huge']);
    expect(state(p, 'read')).toBe('floating');
  });

  it('suggests skipping only what the student marked optional', () => {
    const p = dayPlan([item('a', h(9), 60), item('b', h(9, 30), 60, { required: false })]);
    expect(p.recovery).toEqual([{ itemId: 'b', kind: 'skip', text: 'Skip "B" — you marked it optional.' }]);
  });

  it('suggests moving only what the student marked flexible, to a window that exists', () => {
    const p = dayPlan([item('a', h(9), 60), item('b', h(9, 30), 60, { flexible: true })]);
    expect(p.recovery[0]).toMatchObject({ itemId: 'b', kind: 'move' });
    expect(p.recovery[0].text).toContain('8:00a');
  });

  it('says plainly when two required, fixed things cannot be rescheduled away', () => {
    const p = dayPlan([item('a', h(9), 60), item('b', h(9, 30), 60)]);
    expect(p.recovery).toHaveLength(1);
    expect(p.recovery[0].kind).toBe('ask');
    expect(p.recovery[0].text).toContain('rescheduling cannot fix this');
  });

  it('shows private items to nobody and busy-only items as Busy with no title or place', () => {
    const v = sharedView([item('secret', h(9), 60), item('shift', h(13), 120, { privacy: 'busy-only', title: 'Counseling', place: 'Health center' })]);
    expect(v).toEqual([{ start: h(13), minutes: 120, title: 'Busy' }]);
    expect(JSON.stringify(v)).not.toMatch(/Counseling|Health center|SECRET/);
  });
});

describe('items from a rail', () => {
  const rail = [
    { at: h(9), title: 'ECON', c: 'econ', minutes: 60 },
    { at: h(9, 30), title: 'Shift', c: null, minutes: 120, from: { kind: 'appointment', id: 'ap1' } },
    { at: h(10), title: 'Problem set', c: 'econ', from: { kind: 'item', id: 'i1' } },
    { at: h(11), title: 'Task', c: null, from: { kind: 'task', id: 't1' } },
    { at: h(12), title: 'Cancelled', c: 'econ', canceled: true },
    { at: h(14), title: 'Office hours', c: 'econ', optional: true },
  ];

  it('keeps places to be and drops deadlines, tasks and cancelled classes', () => {
    const items = itemsFromRail(rail, () => 50);
    expect(items.map((i) => i.title)).toEqual(['ECON', 'Shift', 'Office hours']);
    expect(items.map((i) => i.required)).toEqual([true, true, false]);
    expect(items[2].minutes).toBe(50);
  });

  it('finds the class-and-shift overlap the rail alone does not name', () => {
    const p = dayPlan(itemsFromRail(rail, () => 50));
    expect(p.slots.filter((s) => s.state === 'overlaps').map((s) => s.item.title)).toEqual(['ECON', 'Shift']);
    expect(p.recovery[0].kind).toBe('ask');
  });
});
