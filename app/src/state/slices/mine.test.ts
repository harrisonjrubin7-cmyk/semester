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
