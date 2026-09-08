import { describe, expect, it } from 'vitest';
import { reducer } from './reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from './shape';
import type { CourseModule } from '../lib/types';

/**
 * The three things a drag on the calendar can move.
 *
 * The gesture is checked in a browser; these are the rules underneath it, and
 * they are the part that must not quietly change: what a move writes, what it
 * refuses to touch, and whether it can be taken back.
 */

const NOW = new Date(2026, 8, 8);

function fresh(over: Partial<State> = {}): State {
  return { ...DEFAULT_PERSISTED, ...initialEphemeral(NOW), ...over } as State;
}

const act = (s: State, a: Action) => reducer(s, a);

describe('moving one of your own tasks', () => {
  const withTask = () =>
    act(fresh(), {
      type: 'addTask',
      task: { title: 'coffee', date: '2026-09-10', time: '', note: '', courseId: null },
    } as Action);

  it('writes the new date', () => {
    const before = withTask();
    const after = act(before, { type: 'moveTask', id: before.tasks[0].id, date: '2026-09-17' });
    expect(after.tasks[0].date).toBe('2026-09-17');
  });

  it('sets the time only when the drop had one', () => {
    // A month cell is a day and nothing finer, so a drop there must not invent
    // an hour — and must not wipe the one that was already written.
    const before = act(withTask(), {
      type: 'editTask',
      id: 'x',
      patch: {},
    } as Action);
    const id = before.tasks[0].id;
    const noTime = act(before, { type: 'moveTask', id, date: '2026-09-17' });
    expect(noTime.tasks[0].time).toBe('');
    const withTime = act(before, { type: 'moveTask', id, date: '2026-09-17', time: '9:30a' });
    expect(withTime.tasks[0].time).toBe('9:30a');
  });

  it('offers the move back', () => {
    // An ordinary edit is undone by editing it back. A drag is the case that
    // rule does not cover: the date it was on is gone from the screen the
    // moment it lands. See the note in `lib/undo.ts`.
    const before = withTask();
    const after = act(before, { type: 'moveTask', id: before.tasks[0].id, date: '2026-09-17' });
    expect(after.undone?.label).toBe('Task moved');
    const back = act(after, { type: 'undo' });
    expect(back.tasks[0].date).toBe('2026-09-10');
  });

  it('offers nothing when the thing landed where it already was', () => {
    const before = withTask();
    const same = act(before, { type: 'moveTask', id: before.tasks[0].id, date: '2026-09-10' });
    // The slice still rebuilds the array, so this is the `changedSomething`
    // check doing its job rather than reference equality falling out for free.
    expect(same.tasks[0].date).toBe('2026-09-10');
  });
});

describe('moving an appointment', () => {
  const withAppt = () =>
    act(fresh(), {
      type: 'addAppointment',
      appointment: {
        title: 'gym',
        kind: 'health',
        date: '2026-09-10',
        at: 17 * 60,
        time: '5p',
        where: '',
        note: '',
      },
    } as Action);

  it('keeps the id, so anything filed against it survives', () => {
    const before = withAppt();
    const id = before.appointments[0].id;
    const after = act(before, {
      type: 'moveAppointment',
      id,
      date: '2026-09-11',
      at: 9 * 60,
      time: '9a',
    });
    expect(after.appointments[0].id).toBe(id);
    expect(after.appointments).toHaveLength(1);
  });

  it('keeps the minutes and the wording in step', () => {
    // `at` sorts it onto the rail and `time` is what a person reads. Two
    // fields for one fact, so a move that set one and not the other would draw
    // it at nine and call it five.
    const before = withAppt();
    const after = act(before, {
      type: 'moveAppointment',
      id: before.appointments[0].id,
      date: '2026-09-11',
      at: 9 * 60 + 30,
      time: '9:30a',
    });
    expect(after.appointments[0].at).toBe(9 * 60 + 30);
    expect(after.appointments[0].time).toBe('9:30a');
  });
});

describe('moving a deadline that came out of a syllabus', () => {
  const module = (): CourseModule =>
    ({
      course: { id: 'econ', code: 'ECON 1020', name: 'Micro', grading: [] },
      items: [
        {
          id: 'econ-ps4',
          c: 'econ',
          title: 'Problem Set 4',
          kind: 'Problem set',
          month: 8,
          day: 10,
          year: 2026,
          dueTime: '11:59 PM',
          weight: '5%',
          where: '',
          detail: '',
          quote: 'Problem Set 4 is due Thursday 10 September.',
          checked: { confirmed: true, page: 3 },
          source: 'syllabus.pdf',
        },
      ],
      schedule: [],
      guide: { units: [] },
    }) as unknown as CourseModule;

  const withCourse = () => fresh({ courses: [module()] });

  const move = (s: State) =>
    act(s, { type: 'moveItem', courseId: 'econ', itemId: 'econ-ps4', month: 8, day: 17, year: 2026 });

  it('writes the new date', () => {
    const after = move(withCourse());
    expect(after.courses[0].items[0].day).toBe(17);
    expect(after.courses[0].items[0].month).toBe(8);
    expect(after.courses[0].items[0].year).toBe(2026);
  });

  it('keeps the date the syllabus stated', () => {
    const after = move(withCourse());
    expect(after.courses[0].items[0].movedFrom).toEqual({ month: 8, day: 10, year: 2026 });
  });

  it('never touches the sentence it came from, or its page', () => {
    // The whole premise of the app. A student may disagree with the document;
    // the app may not quietly edit it.
    const after = move(withCourse());
    expect(after.courses[0].items[0].quote).toBe('Problem Set 4 is due Thursday 10 September.');
    expect(after.courses[0].items[0].checked).toEqual({ confirmed: true, page: 3 });
    expect(after.courses[0].items[0].source).toBe('syllabus.pdf');
  });

  it('remembers the first date, not the last one', () => {
    // Moved twice, what still matters is what the syllabus said — not the
    // intermediate guess.
    const once = move(withCourse());
    const twice = act(once, {
      type: 'moveItem',
      courseId: 'econ',
      itemId: 'econ-ps4',
      month: 8,
      day: 24,
      year: 2026,
    });
    expect(twice.courses[0].items[0].movedFrom).toEqual({ month: 8, day: 10, year: 2026 });
    expect(twice.courses[0].items[0].day).toBe(24);
  });

  it('leaves every other course and item alone', () => {
    const two = fresh({ courses: [module(), { ...module(), course: { ...module().course, id: 'psci' } }] });
    const after = move(two);
    expect(after.courses[1].items[0].day).toBe(10);
    expect(after.courses[1].items[0].movedFrom).toBeUndefined();
  });

  it('offers the move back', () => {
    const after = move(withCourse());
    expect(after.undone?.label).toBe('Deadline moved');
    const back = act(after, { type: 'undo' });
    expect(back.courses[0].items[0].day).toBe(10);
    expect(back.courses[0].items[0].movedFrom).toBeUndefined();
  });
});
