import { describe, expect, it } from 'vitest';
import { readProposal, undoFor, type Known, type Lists } from './tools';
import { reducer } from '../state/reducer';
import { currentLook, DEFAULT_PERSISTED, type State } from '../state/shape';
import type { ToolCall } from './claude';
import type { Attended } from './attend';
import type { CourseId } from './types';

/**
 * Every write, run through the real reducer and taken back again.
 *
 * `tools.test.ts` checks that a proposal *carries* an undo. That is not the
 * claim being made to the student — the claim is that pressing Undo leaves
 * the app as it was, and the only way to check that is to run the write and
 * the undo through the reducer that will actually run them and compare.
 *
 * A shape assertion would pass for an undo that dispatches the right action
 * type at the wrong row, which is precisely the mistake worth catching.
 */

const ATTENDANCE = [
  { id: 'econ:2026-09-10', courseId: 'econ' as CourseId, date: '2026-09-10', mark: 'present', at: 0 },
] as Attended[];

const call = (name: string, input: Record<string, unknown>): ToolCall => ({ id: 'x', name, input });

/** A state carrying a row of its own in each list a write can add to. */
const start = (): State =>
  ({
    ...DEFAULT_PERSISTED,
    tasks: [
      {
        id: 't1',
        title: 'Email Dr Stromme',
        date: '2026-09-14',
        time: '',
        note: '',
        done: false,
        created: 1,
        courseId: null,
      },
    ],
    attendance: ATTENDANCE,
    done: {},
  }) as State;

/**
 * What the app holds, read off the state rather than written out beside it.
 *
 * Written out by hand first, and it disagreed with the state on one field —
 * the accent — so `set_look` "restored" a colour that had never been set. In
 * the app `Known` is derived (`currentLook(state)` in `Ask.tsx`), and a
 * fixture that is derived the same way is the only one that tests the thing
 * that ships. A hand-written one tests a second app.
 */
const knownFrom = (s: State): Known => ({
  deadlines: [{ id: 'econ-ps4', title: 'Problem Set 4' }],
  tasks: s.tasks.map((t) => ({ id: t.id, title: t.title, date: t.date })),
  courses: [{ id: 'econ' as CourseId, code: 'ECON 1020' }],
  attendance: s.attendance,
  look: currentLook(s),
});

const known = knownFrom(start());

const lists = (s: State): Lists => ({
  tasks: s.tasks,
  notes: s.notes,
  sources: s.sources,
  applications: s.applications,
  timers: s.timers,
});

/** What the app holds after a write, and after taking it back. */
function roundTrip(name: string, input: Record<string, unknown>) {
  const before = start();
  const p = readProposal(call(name, input), known);
  if (!p?.undo) throw new Error(`${name} produced no undoable proposal`);
  const after = reducer(before, p.action);
  const back = undoFor(p.undo, lists(before), lists(after));
  if (!back) throw new Error(`${name} produced no undo action`);
  return { before, after, restored: reducer(after, back) };
}

/**
 * The fields a write can touch. Compared whole rather than one at a time,
 * because an undo that restores the row and leaves a stray flag behind is
 * still an undo that did not work.
 */
const TOUCHED = [
  'tasks',
  'notes',
  'sources',
  'applications',
  'timers',
  'attendance',
  'done',
  'accent',
  'textSize',
  'ground',
  'density',
] as const;

const shot = (s: State) =>
  JSON.stringify(
    Object.fromEntries(
      TOUCHED.map((f) => {
        // `done` keeps a `false` where a box was ticked and unticked. Not a
        // difference: the deadline is not done either way, and every screen
        // reads it as falsy.
        if (f === 'done') return [f, Object.keys(s.done).filter((k) => s.done[k])];
        /*
         * `at` is meant to move. It is the sync merge's tiebreaker — see
         * `Attended` — so a mark restored on this device has to look newer
         * than the same row on another one, or undoing here would lose to a
         * stale copy there. Restoring the old `at` would be the bug.
         */
        if (f === 'attendance') {
          return [f, s.attendance.map(({ at: _at, ...rest }) => rest)];
        }
        return [f, s[f]];
      }),
    ),
  );

describe('every write, done and taken back', () => {
  const CASES: [string, Record<string, unknown>][] = [
    ['tick_deadline', { id: 'econ-ps4', title: 'x' }],
    ['add_task', { title: 'Read chapter 3', date: '2026-09-20' }],
    ['move_task', { id: 't1', date: '2026-09-20' }],
    ['mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'absent' }],
    ['mark_attendance', { courseId: 'econ', date: '2026-09-10', mark: 'absent' }],
    ['start_timer', { minutes: 25, label: 'ECON reading' }],
    ['add_note', { title: 'Elasticity', body: 'The share of a change borne by buyers.', courseId: 'econ' }],
    ['add_source', { raw: 'Porter, M. (1980). Competitive Strategy.', courseId: 'econ' }],
    ['add_application', { org: 'Deloitte', role: 'Summer analyst', due: '2026-11-01' }],
    ['set_look', { field: 'accent', value: 'jade' }],
    ['set_look', { field: 'textSize', value: 'large' }],
  ];

  for (const [name, input] of CASES) {
    it(`${name} ${JSON.stringify(input)} changes something, and undoes to exactly what was there`, () => {
      const { before, after, restored } = roundTrip(name, input);
      // It has to actually do something, or the round trip is trivially true.
      expect(shot(after), 'the write changed nothing').not.toBe(shot(before));
      expect(shot(restored)).toBe(shot(before));
    });
  }
});

describe('undoing the right row', () => {
  it('removes the task that was added, not the one with the same title', () => {
    /*
     * The mistake a shape assertion would miss. Ids are minted in the reducer,
     * so an undo that matched on the title would delete whichever it found
     * first — and "Read chapter 3" is exactly the kind of task somebody adds
     * twice.
     */
    const before = { ...start(), tasks: [{ ...start().tasks[0], title: 'Read chapter 3' }] };
    const p = readProposal(call('add_task', { title: 'Read chapter 3', date: '' }), known)!;
    const after = reducer(before, p.action);
    expect(after.tasks).toHaveLength(2);
    const restored = reducer(after, undoFor(p.undo!, lists(before), lists(after))!);
    expect(restored.tasks).toHaveLength(1);
    // The original, kept: it has the date and the created time the new one
    // does not.
    expect(restored.tasks[0].id).toBe('t1');
  });
});

describe('an attendance mark that was already there', () => {
  it('goes back to what it was, not to nothing', () => {
    // The failure this catches: an undo that clears the mark would silently
    // turn a recorded present into an unrecorded meeting, and the absence
    // budget on the Courses screen would move without anyone touching it.
    const { before, restored } = roundTrip('mark_attendance', {
      courseId: 'econ',
      date: '2026-09-10',
      mark: 'absent',
    });
    const was = before.attendance.find((a) => a.id === 'econ:2026-09-10');
    const now = restored.attendance.find((a) => a.id === 'econ:2026-09-10');
    expect(was?.mark).toBe('present');
    expect(now?.mark).toBe('present');
  });
});
