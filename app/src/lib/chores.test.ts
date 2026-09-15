import { describe, expect, it } from 'vitest';
import { newStep, stepsAllDone, stepsDone, tick, tickSays } from './chores';
import type { PersonalTask } from './types';

const task = (over: Partial<PersonalTask> = {}): PersonalTask => ({
  id: 't1',
  title: 'Laundry',
  date: '2026-09-14',
  time: '',
  note: '',
  done: false,
  created: 0,
  courseId: null,
  ...over,
});

const weekly = { every: 'weekly' as const, until: '2026-12-11' };

describe('ticking a task', () => {
  it('is the plain flag on something that happens once', () => {
    expect(tick(task(), true)).toEqual({ done: true });
    expect(tick(task({ done: true }), false)).toEqual({ done: false });
  });

  it('moves a repeating one forward instead of finishing it', () => {
    // The laundry you just did comes back a fortnight from now, which is what
    // both clients look like they are doing.
    expect(tick(task({ repeat: weekly }), true)).toMatchObject({
      done: false,
      date: '2026-09-21',
    });
  });

  it('unticking a repeating one is still just unticking', () => {
    // Nothing to roll: the date has not moved and undoing a tick must not
    // walk the series backwards.
    expect(tick(task({ repeat: weekly }), false)).toEqual({ done: false });
  });

  it('finishes for good once the rule runs out', () => {
    /*
     * Without this an expired repeat is a task that can never be ticked off:
     * every press rolls it to nowhere and leaves it where it was, which reads
     * as a broken checkbox rather than as a finished series.
     */
    const last = task({ date: '2026-12-07', repeat: weekly });
    expect(tick(last, true)).toEqual({ done: true });
  });

  it('skips a date the rule already excludes', () => {
    const skipping = task({ repeat: { ...weekly, except: ['2026-09-21'] } });
    expect(tick(skipping, true)).toMatchObject({ date: '2026-09-28' });
  });

  it('clears the steps on the way forward', () => {
    // A weekly task that breaks into the same three pieces every week is the
    // whole point of steps on a repeating task; leaving them ticked would
    // mean clearing them by hand every time.
    const chore = task({
      repeat: weekly,
      steps: [newStep('s1', 'Wash'), { ...newStep('s2', 'Dry'), done: true }],
    });
    expect(tick(chore, true).steps).toEqual([
      { id: 's1', text: 'Wash', done: false },
      { id: 's2', text: 'Dry', done: false },
    ]);
  });

  it('leaves a repeating task with no date alone', () => {
    // A rule needs a first day to count from. Someday plus weekly is not a
    // series, it is a task somebody has not dated yet.
    expect(tick(task({ date: null, repeat: weekly }), true)).toEqual({ done: true });
  });

  it('says when it will be back, before it is pressed', () => {
    expect(tickSays(task({ repeat: weekly }))).toBe('Comes back 2026-09-21');
    expect(tickSays(task({ date: '2026-12-07', repeat: weekly }))).toBe('Last one');
    expect(tickSays(task())).toBe('');
  });
});

describe('steps', () => {
  it('counts how far through it is', () => {
    const t = task({ steps: [{ ...newStep('a', 'One'), done: true }, newStep('b', 'Two')] });
    expect(stepsDone(t)).toEqual({ done: 1, of: 2 });
  });

  it('is zero of zero when there are none', () => {
    expect(stepsDone(task())).toEqual({ done: 0, of: 0 });
    expect(stepsDone(task({ steps: [] }))).toEqual({ done: 0, of: 0 });
  });

  it('notices every step is done while the task is not', () => {
    const all = task({ steps: [{ ...newStep('a', 'One'), done: true }] });
    expect(stepsAllDone(all)).toBe(true);
  });

  it('says nothing once the task itself is ticked', () => {
    // The row's prompt is "you might be finished"; after the tick it would be
    // telling somebody what they just did.
    expect(stepsAllDone({ ...task({ steps: [{ ...newStep('a', 'One'), done: true }] }), done: true })).toBe(false);
  });

  it('never prompts a task with no steps', () => {
    expect(stepsAllDone(task())).toBe(false);
  });

  it('trims what it is given, so a stray space is not a step', () => {
    expect(newStep('s', '  Wash  ')).toEqual({ id: 's', text: 'Wash', done: false });
  });
});
