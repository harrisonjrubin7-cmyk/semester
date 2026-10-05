import { describe, expect, it } from 'vitest';
import { group } from './deadline-groups';
import { fromItems } from './deadline-feed';
import type { DatedItem } from './types';

const item = (o: Partial<DatedItem>): DatedItem =>
  ({ id: 'a', c: 'econ', title: 'Problem set', date: new Date(2026, 9, 14), dueAt: 17 * 60, ...o } as unknown as DatedItem);
const code = () => 'ECON 101';
const now = new Date(2026, 9, 14, 9, 0).getTime();

describe('fromItems', () => {
  it('labels a cited syllabus date as imported, never institution verified', () => {
    const [d] = fromItems([item({ checked: { confirmed: true, page: 2 } })], {}, code);
    expect(d.label).toBe('imported');
    expect(d.title).toBe('ECON 101 · Problem set');
  });
  it('sends an uncited date to Needs confirmation', () => {
    const d = fromItems([item({})], {}, code);
    expect(group(d, now).confirm).toHaveLength(1);
    expect(group(d, now).today).toHaveLength(0);
  });
  it('puts a cited date due at 5 PM today in Today, and skips what is done', () => {
    const cited = { confirmed: true };
    const g = group(fromItems([item({ checked: cited }), item({ id: 'b', checked: cited })], { b: true }, code), now);
    expect(g.today.map((x) => x.id)).toEqual(['a']);
  });
  it('treats a missing time as end of day, not midnight', () => {
    const [d] = fromItems([item({ dueAt: undefined as unknown as number, checked: { confirmed: true } })], {}, code);
    expect(new Date(d.due as number).getHours()).toBe(23);
  });
});
