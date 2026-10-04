import { describe, expect, it } from 'vitest';
import type { Entry } from '../calendar';
import { fixedClock } from '../kernel';
import type { Task } from '../tasks';
import { buildToday } from './model';
import { SHADOW_FACTS, compareToday, factsOfView, signatureOf, type TodayFacts } from './index';

const entry = (id: string, day: string, over: Partial<Entry> = {}): Entry => ({
  id, kind: 'deadline', title: id, day, startMin: null, endMin: null, courseId: null, source: 'entered', ...over,
});
const task = (id: string, dueOn: string): Task => ({ id, title: id, state: 'open', dueOn, courseId: null, time: '', repeats: false });

const view = () => {
  const r = buildToday({
    clock: fixedClock('2026-09-09', 600),
    can: () => ({ allow: true, obligations: [] }),
    entries: [entry('deadline:a', '2026-09-09'), entry('deadline:b', '2026-09-09'), entry('deadline:c', '2026-09-12')],
    tasks: [task('t1', '2026-09-09')],
  });
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

const agree: TodayFacts = { deadlinesToday: ['a', 'b'], tasksToday: ['t1'], deadlinesComingUp: ['c'] };

describe('the shadow comparison', () => {
  it('reads the three facts off the domain view, without the entry prefix', () => {
    expect(factsOfView(view())).toEqual(agree);
    expect(SHADOW_FACTS).toHaveLength(3);
  });

  it('is silent when the two agree', () => {
    expect(compareToday(agree, view())).toEqual([]);
  });

  it('names what only the screen shows and what only the domain shows', () => {
    const found = compareToday({ ...agree, deadlinesToday: ['a', 'x'], tasksToday: [] }, view());
    expect(found).toEqual([
      { fact: 'deadlinesToday', onlyLegacy: ['x'], onlyDomain: ['b'], orderDiffers: false },
      { fact: 'tasksToday', onlyLegacy: [], onlyDomain: ['t1'], orderDiffers: false },
    ]);
  });

  it('reports a swap as an order difference, and only when nothing is missing', () => {
    expect(compareToday({ ...agree, deadlinesToday: ['b', 'a'] }, view())).toEqual([
      { fact: 'deadlinesToday', onlyLegacy: [], onlyDomain: [], orderDiffers: true },
    ]);
    const missing = compareToday({ ...agree, deadlinesToday: ['b', 'a', 'z'] }, view());
    expect(missing[0].orderDiffers).toBe(false);
  });

  it('gives one disagreement one signature, and a different one another', () => {
    const one = compareToday({ ...agree, tasksToday: [] }, view());
    const two = compareToday({ ...agree, deadlinesComingUp: [] }, view());
    expect(signatureOf('2026-09-09', one)).toBe(signatureOf('2026-09-09', one));
    expect(signatureOf('2026-09-09', one)).not.toBe(signatureOf('2026-09-09', two));
    expect(signatureOf('2026-09-09', one)).not.toBe(signatureOf('2026-09-10', one));
  });
});
