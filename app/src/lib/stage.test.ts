import { describe, expect, it } from 'vitest';
import {
  ITEM_STAGES,
  STATUSES,
  countByStatus,
  finishedNotHandedIn,
  gradedIds,
  plannedIds,
  progressFrom,
  readStage,
  statusLabel,
  statusOf,
  toggleStage,
  type ItemStatus,
  type Progress,
} from './stage';
import { standingOf } from './standing';
import type { DatedItem } from './types';

const NOW = 1_788_000_000_000;
const DAY = 86_400_000;

const item = (id: string, over: Partial<DatedItem> = {}): DatedItem =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'paper',
    date: new Date(NOW + 5 * DAY),
    isPast: false,
    daysAway: 5,
    dueShort: 'Fri',
    weight: '20%',
    ...over,
  }) as unknown as DatedItem;

const gone = (id: string) => item(id, { isPast: true, daysAway: -3 });

/** Nothing recorded. Every case below is this plus exactly one more fact. */
const nothing = (): Progress =>
  progressFrom({ ready: {}, submitted: {}, started: {}, done: {}, tasks: [], returned: [] });

const at = (over: Partial<Parameters<typeof progressFrom>[0]>): Progress =>
  progressFrom({ ready: {}, submitted: {}, started: {}, done: {}, tasks: [], returned: [], ...over });

/*
 * The control, and the reason to believe anything below it.
 *
 * A ladder of seven `if`s has a failure mode nothing else in this file would
 * catch: a line placed above another it should sit below makes one of the seven
 * unreachable, and every assertion about the other six still passes. So the
 * first thing checked is that all seven can be produced at all.
 */
describe('all seven of §91 are reachable', () => {
  const cases: [ItemStatus, DatedItem, Progress][] = [
    ['NOT_STARTED', item('a'), nothing()],
    ['PLANNED', item('a'), at({ tasks: [{ from: 'a' }] })],
    ['IN_PROGRESS', item('a'), at({ started: { a: NOW } })],
    ['READY_TO_SUBMIT', item('a'), at({ ready: { a: NOW } })],
    ['SUBMITTED', item('a'), at({ submitted: { a: NOW } })],
    ['GRADED', item('a'), at({ returned: [{ id: 'a' }] })],
    ['MISSED', gone('a'), nothing()],
  ];

  it('produces each one, and covers the vocabulary exactly', () => {
    const reached = cases.map(([, i, p]) => statusOf(i, p));
    expect(reached).toEqual(cases.map(([want]) => want));
    // And nothing in the vocabulary is missing from the cases, which is what
    // would happen to the eighth status somebody adds.
    expect([...reached].sort()).toEqual([...STATUSES].sort());
  });

  it('gives every one a sentence somebody would say', () => {
    for (const [, i, p] of cases) {
      const label = statusLabel(i, p);
      expect(label, `${statusOf(i, p)} has no label`).not.toBe('');
      expect(label).not.toMatch(/_/);
    }
  });
});

describe('the two facts that are stored', () => {
  it('is exactly the two, so a third has to be argued for', () => {
    // `PLANNED` is `task.from` and `GRADED` is `state.returned`. A third entry
    // here means somebody stored a fact the store already had, which is the
    // failure this file was written around.
    expect(ITEM_STAGES).toEqual(['ready', 'submitted']);
  });

  it('reads a mark the way the store reads every other one', () => {
    expect(readStage({ a: NOW, b: 0, c: -1, d: 'yes', e: null })).toEqual({ a: NOW });
    expect(readStage(null)).toEqual({});
    expect(readStage([1, 2])).toEqual({});
  });

  it('marks and unmarks without touching the map it was given', () => {
    const before = { a: NOW };
    expect(toggleStage('b', before, NOW + 1)).toEqual({ a: NOW, b: NOW + 1 });
    expect(toggleStage('a', before, NOW + 1)).toEqual({});
    expect(before).toEqual({ a: NOW });
  });
});

describe('the two derived from what the store already holds', () => {
  it('reads PLANNED off the tasks a deadline produced', () => {
    // `components/BreakItUp.tsx` is the only writer of `from`, and it writes
    // the deadline's id. A task with none is somebody's own errand.
    expect([...plannedIds([{ from: 'a' }, {}, { from: 'b' }, { from: 'a' }])].sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('reads GRADED off the work that has come back', () => {
    expect([...gradedIds([{ id: 'a' }, { id: 'b' }])].sort()).toEqual(['a', 'b']);
  });

  it('does not call a deadline planned because somebody wrote a task', () => {
    expect(statusOf(item('a'), at({ tasks: [{}, { from: 'other' }] }))).toBe('NOT_STARTED');
  });
});

describe('the orderings that are decisions rather than arithmetic', () => {
  it('lets the tick beat the date, the way every list already does', () => {
    const i = gone('a');
    const p = at({ done: { a: true } });
    expect(statusOf(i, p)).toBe('READY_TO_SUBMIT');
    // The point of the assertion: this page and the list it was opened from
    // have to agree about the same paper.
    expect(standingOf(i, { a: true })).toBe('done');
  });

  it('lets the date beat ready, which is the whole reason for the file', () => {
    // Finished on Thursday, never uploaded, and Friday has gone. Reporting
    // this as READY_TO_SUBMIT is the app looking at the one thing it could
    // warn about and calling it fine.
    expect(statusOf(gone('a'), at({ ready: { a: NOW } }))).toBe('MISSED');
    // And before the date, the same fact is not a problem.
    expect(statusOf(item('a'), at({ ready: { a: NOW } }))).toBe('READY_TO_SUBMIT');
  });

  it('holds a mark that arrived without a submission being recorded', () => {
    // An in-class quiz is marked and was never handed in. Reading `graded` off
    // `submitted` — or refusing it because `submitted` is empty — would lose
    // the more certain of the two facts.
    expect(statusOf(item('a'), at({ returned: [{ id: 'a' }] }))).toBe('GRADED');
  });

  it('keeps the mark when the submission is retracted', () => {
    const p = at({ returned: [{ id: 'a' }], submitted: {} });
    expect(statusOf(item('a'), p)).toBe('GRADED');
  });

  it('reads SUBMITTED for the pair the reducer actually produces', () => {
    /*
     * This case was missing and a revert found it. Marking something handed in
     * ticks it off — see the `markStage` case in `state/slices/settings.ts` — so
     * `submitted` never occurs in the store without `done` beside it, and the
     * only test for SUBMITTED set one without the other. Moving the `done` line
     * above the `submitted` line in `statusOf` therefore made SUBMITTED
     * unreachable *in the app* while every assertion here still passed: the
     * ladder was being tested against a state the reducer cannot reach.
     */
    const p = at({ submitted: { a: NOW }, done: { a: true } });
    expect(statusOf(item('a'), p)).toBe('SUBMITTED');
    expect(statusLabel(item('a'), p)).toBe('Handed in');
    // And the same pair on a deadline that has gone by: handed in late is
    // handed in, not missed.
    expect(statusOf(gone('a'), p)).toBe('SUBMITTED');
  });

  it('keeps that something was started after it is handed in', () => {
    // The `state.started` lesson, applied twice over: four facts about one
    // paper, none of them lost by recording a later one.
    const p = at({ started: { a: NOW }, ready: { a: NOW }, submitted: { a: NOW } });
    expect(statusOf(item('a'), p)).toBe('SUBMITTED');
    expect(p.started.a).toBe(NOW);
    expect(p.ready.a).toBe(NOW);
  });
});

describe('the sentence on the panel', () => {
  it('says finished for a tick and ready to hand in for the button', () => {
    // Two ways to reach one status, and they do not mean the same thing to the
    // person reading the row: a reading is finished, an essay is waiting.
    expect(statusLabel(item('a'), at({ ready: { a: NOW } }))).toBe('Ready to hand in');
    expect(statusLabel(item('a'), at({ done: { a: true } }))).toBe('Finished');
  });

  it('says finished once the ticked thing is also marked ready', () => {
    const p = at({ ready: { a: NOW }, done: { a: true } });
    expect(statusLabel(item('a'), p)).toBe('Finished');
  });
});

describe('finished and never handed in', () => {
  const items = [gone('stranded'), gone('never'), gone('uploaded'), gone('ticked'), item('soon')];
  const p = at({
    ready: { stranded: NOW, uploaded: NOW, ticked: NOW, soon: NOW },
    submitted: { uploaded: NOW },
    done: { ticked: true },
  });

  it('finds the one, and only the one', () => {
    expect(finishedNotHandedIn(items, p).map((i) => i.id)).toEqual(['stranded']);
  });

  it('says nothing when there is nothing to say', () => {
    // The control. A probe that convicts four suspects out of four is also
    // what a broken probe looks like, so the empty reading is asserted too.
    expect(finishedNotHandedIn(items, nothing())).toEqual([]);
    expect(finishedNotHandedIn([], p)).toEqual([]);
  });

  it('leaves out one that has come back', () => {
    const back = at({ ready: { stranded: NOW }, returned: [{ id: 'stranded' }] });
    expect(finishedNotHandedIn(items, back)).toEqual([]);
  });
});

describe('the summary count', () => {
  it('puts every deadline in exactly one of the seven', () => {
    const items = [item('a'), item('b'), gone('c'), gone('d')];
    const p = at({ started: { a: NOW }, submitted: { b: NOW }, done: { c: true } });
    const counts = countByStatus(items, p);
    expect(Object.values(counts).reduce((n, v) => n + v, 0)).toBe(items.length);
    expect(counts.IN_PROGRESS).toBe(1);
    expect(counts.SUBMITTED).toBe(1);
    expect(counts.READY_TO_SUBMIT).toBe(1);
    expect(counts.MISSED).toBe(1);
    expect(counts.NOT_STARTED).toBe(0);
  });

  it('starts every status at zero rather than leaving it undefined', () => {
    const counts = countByStatus([], nothing());
    for (const s of STATUSES) expect(counts[s]).toBe(0);
  });
});
