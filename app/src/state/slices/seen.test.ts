import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../shape';
import { seenOf } from '../../lib/whatchanged';
import type { Item } from '../../lib/types';

const row = (id: string, day: number) =>
  seenOf({ id, c: 'econ', title: 'Midterm', kind: 'Exam', month: 9, day, dueTime: '', weight: '', where: '', detail: '', quote: '', source: '' } as Item);

describe('seenDeadlines', () => {
  const start = reducer({ ...DEFAULT_PERSISTED, ...initialEphemeral() } as State, { type: 'seenDeadlines', seen: { econ: [row('m', 8)] }, onlyNew: true });

  it('seeds a course that has no reading', () => {
    expect(start.deadlineSeen.econ).toHaveLength(1);
  });

  it('leaves an existing reading alone when only seeding', () => {
    const again = reducer(start, { type: 'seenDeadlines', seen: { econ: [row('m', 9)] }, onlyNew: true });
    expect(again.deadlineSeen.econ[0].day).toBe(8);
  });

  it('replaces the reading on acknowledgement, and only that course', () => {
    const two = reducer(start, { type: 'seenDeadlines', seen: { hist: [row('p', 3)] }, onlyNew: true });
    const acked = reducer(two, { type: 'seenDeadlines', seen: { econ: [row('m', 9)] }, onlyNew: false });
    expect(acked.deadlineSeen.econ[0].day).toBe(9);
    expect(acked.deadlineSeen.hist[0].day).toBe(3);
  });
});
