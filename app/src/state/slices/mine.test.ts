import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';

/**
 * An appointment you wrote, and the one thing you could not do to it.
 *
 * `moveAppointment` changed when it is, `deleteAppointment` took it away, and
 * between them was everything: a typo in the title, the wrong room or the
 * wrong kind meant deleting it and writing it out again. The calendar has
 * said for longer than that was true that tapping your own appointment
 * "opens the list it lives in, which is where it can be edited"
 * (`screens/Calendar.tsx`), and `editAppointment` is what makes the sentence
 * true.
 *
 * It is a patch, like `editTask`: the form sends the fields it holds, and an
 * appointment written before a field existed keeps its own rather than having
 * `undefined` written over it. That is the half a test can see and a screen
 * cannot — a form that always sends all five fields would pass a test that
 * only ever changed one.
 */
const start = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date(2026, 8, 15)) });

const run = (state: State, ...actions: Action[]): State =>
  actions.reduce((s, a) => reducer(s, a), state);

const written = {
  title: 'Advising',
  date: '2026-09-16',
  at: 15 * 60,
  time: '3:00p',
  where: 'Calhoun 201',
  note: '',
  kind: 'admin',
};

describe('an appointment of your own', () => {
  it('can be edited after it is written', () => {
    const after = run(start(), { type: 'addAppointment', appointment: written });
    const id = after.appointments[0].id;

    const fixed = run(after, {
      type: 'editAppointment',
      id,
      patch: { title: 'Advising meeting', where: 'Calhoun 305' },
    });

    expect(fixed.appointments).toHaveLength(1);
    expect(fixed.appointments[0].title).toBe('Advising meeting');
    expect(fixed.appointments[0].where).toBe('Calhoun 305');
  });

  it('keeps every field the patch does not name', () => {
    const after = run(start(), { type: 'addAppointment', appointment: written });
    const a = after.appointments[0];
    const fixed = run(after, { type: 'editAppointment', id: a.id, patch: { where: 'Buttrick 101' } });
    const b = fixed.appointments[0];

    // Including the two nobody sends from the form.
    expect({ ...b, where: written.where }).toEqual(a);
    expect(b.id).toBe(a.id);
    expect(b.created).toBe(a.created);
  });

  it('changes the kind, which nothing else in the app could', () => {
    const after = run(start(), { type: 'addAppointment', appointment: { ...written, kind: 'social' } });
    const fixed = run(after, {
      type: 'editAppointment',
      id: after.appointments[0].id,
      patch: { kind: 'health' },
    });
    expect(fixed.appointments[0].kind).toBe('health');
  });

  it('leaves the others alone', () => {
    const two = run(
      start(),
      { type: 'addAppointment', appointment: written },
      { type: 'addAppointment', appointment: { ...written, title: 'Dentist', where: 'Elliston' } },
    );
    const fixed = run(two, {
      type: 'editAppointment',
      id: two.appointments[0].id,
      patch: { title: 'Advising meeting' },
    });
    expect(fixed.appointments.map((a) => a.title)).toEqual(['Advising meeting', 'Dentist']);
  });

  it('does nothing to an id that is not there', () => {
    const after = run(start(), { type: 'addAppointment', appointment: written });
    const fixed = run(after, { type: 'editAppointment', id: 'gone', patch: { title: 'Nothing' } });
    expect(fixed.appointments).toEqual(after.appointments);
  });
});

/**
 * The hours you keep for yourself, which for a long time you could not keep.
 *
 * `addRest` and `dropRest` were in the reducer and nothing dispatched either,
 * so `state.rest` was empty on every device and the whole of `lib/rest.ts`'s
 * protected-block arithmetic ran on an empty list. `components/Capacity.tsx`
 * has the control now, and it edits in place the way `WorkWindows` does —
 * which is why `patchRest` had to exist too. Without it, changing the hour of
 * a standing dinner meant deleting the block and writing it out again.
 */
describe('a block of time you keep', () => {
  const dinner = { label: 'Dinner', days: [1, 2, 3], from: 18 * 60, to: 19 * 60 };

  it('can be added, edited and removed', () => {
    const added = run(start(), { type: 'addRest', patch: dinner });
    expect(added.rest).toHaveLength(1);
    const id = added.rest[0].id;

    const moved = run(added, { type: 'patchRest', id, patch: { from: 19 * 60, to: 20 * 60 } });
    expect(moved.rest[0].from).toBe(19 * 60);
    expect(moved.rest[0].to).toBe(20 * 60);
    // The fields the patch did not name survive it.
    expect(moved.rest[0].label).toBe('Dinner');
    expect(moved.rest[0].days).toEqual([1, 2, 3]);
    // And the block stays the same block, so the list does not jump.
    expect(moved.rest[0].id).toBe(id);

    expect(run(moved, { type: 'dropRest', id }).rest).toEqual([]);
  });

  it('cleans a patch on the way in, the way the floor does', () => {
    const added = run(start(), { type: 'addRest', patch: dinner });
    const id = added.rest[0].id;
    // Out-of-range minutes and a duplicated, unsorted day list — the two
    // things a time field and a row of day toggles can actually send.
    const odd = run(added, { type: 'patchRest', id, patch: { days: [3, 1, 1], to: 99 * 60 } });
    expect(odd.rest[0].days).toEqual([1, 3]);
    expect(odd.rest[0].to).toBe(24 * 60);
  });

  it('leaves the other blocks alone', () => {
    const two = run(
      start(),
      { type: 'addRest', patch: dinner },
      { type: 'addRest', patch: { label: 'The gym', days: [5], from: 17 * 60, to: 18 * 60 } },
    );
    const gym = two.rest[1];
    const after = run(two, { type: 'patchRest', id: two.rest[0].id, patch: { label: 'Supper' } });
    expect(after.rest[1]).toEqual(gym);
  });
});
