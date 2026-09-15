import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { minutesOn, missed, type Session } from '../../lib/sessions';

/**
 * The plan, once it is a thing that can be behind.
 *
 * `lib/sessions.ts` has the arithmetic and its own tests. This is about the
 * three things only the reducer can get wrong, and each of them would make the
 * feature quietly useless rather than visibly broken:
 *
 *  - a replan must keep what is *behind* it, because those are the sittings
 *    that were missed. Sweeping them up on every replan makes the plan
 *    unmissable again, which is the state the app was in before any of this;
 *  - moving what was missed must not touch what was not;
 *  - a press with nothing to do must return the same state object, not an
 *    equal one — every new object here is a re-render and a sync write.
 */

const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';

function base(): State {
  // Fresh mutable fields: `DEFAULT_PERSISTED` is one object and a shallow
  // spread shares every field that is itself one.
  return { ...DEFAULT_PERSISTED, ...initialEphemeral(), sessions: [] } as State;
}

function sitting(over: Partial<Session> = {}): Session {
  return {
    id: 'x',
    courseId: 'econ',
    index: 0,
    name: 'Monopoly',
    code: 'ECON 1020',
    minutes: 30,
    on: TUE,
    ...over,
  };
}

function run(state: State, action: Action): State {
  return reducer(state, action);
}

describe('committing a plan', () => {
  it('puts the sittings in', () => {
    const after = run(base(), {
      type: 'planSessions',
      from: TUE,
      sessions: [sitting({ id: 'a' }), sitting({ id: 'b', on: WED })],
    });
    expect(after.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('keeps what is behind the plan, because that is the evidence it was missed', () => {
    const state = base();
    state.sessions = [sitting({ id: 'old', on: MON })];
    const after = run(state, { type: 'planSessions', from: TUE, sessions: [sitting({ id: 'new' })] });
    expect(after.sessions.map((s) => s.id)).toEqual(['old', 'new']);
    expect(missed(after.sessions, TUE).map((s) => s.id)).toEqual(['old']);
  });

  it('replaces what was planned from today forward rather than adding to it', () => {
    // Two plans laid down on one day is one plan, not a doubled evening.
    const state = base();
    state.sessions = [sitting({ id: 'stale', on: TUE }), sitting({ id: 'stale2', on: WED })];
    const after = run(state, { type: 'planSessions', from: TUE, sessions: [sitting({ id: 'fresh' })] });
    expect(after.sessions.map((s) => s.id)).toEqual(['fresh']);
  });
});

describe('finishing a sitting', () => {
  it('stamps that one and no other', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a' }), sitting({ id: 'b' })];
    const after = run(state, { type: 'finishSession', id: 'a', at: 1_700_000 });
    expect(after.sessions.find((s) => s.id === 'a')?.doneAt).toBe(1_700_000);
    expect(after.sessions.find((s) => s.id === 'b')?.doneAt).toBeUndefined();
  });

  it('takes it out of what counts as missed tomorrow', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a', on: MON })];
    const after = run(state, { type: 'finishSession', id: 'a', at: 1 });
    expect(missed(after.sessions, TUE)).toEqual([]);
  });
});

describe('moving what was missed', () => {
  it('moves it forward in one action', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a', on: MON })];
    const after = run(state, { type: 'moveMissed', today: TUE });
    expect(after.sessions[0]).toMatchObject({ id: 'a', on: TUE, moved: 1 });
  });

  it('leaves a sitting that was not missed exactly where it was', () => {
    const state = base();
    const future = sitting({ id: 'future', on: WED });
    state.sessions = [sitting({ id: 'late', on: MON }), future];
    const after = run(state, { type: 'moveMissed', today: TUE });
    expect(after.sessions.find((s) => s.id === 'future')).toEqual(future);
  });

  it('honours a ceiling the screen passes rather than assuming one', () => {
    // The student's own daily budget, not this module's default.
    const state = base();
    state.sessions = [
      sitting({ id: 'a', on: MON, minutes: 30 }),
      sitting({ id: 'b', on: MON, minutes: 30 }),
    ];
    const after = run(state, { type: 'moveMissed', today: TUE, dayMinutes: 30 });
    expect(minutesOn(after.sessions, TUE)).toBe(30);
  });

  it('is a no-op, object identity included, when nothing was missed', () => {
    const state = base();
    state.sessions = [sitting({ on: WED })];
    expect(run(state, { type: 'moveMissed', today: TUE })).toBe(state);
  });

  it('leaves nothing behind to be offered again tomorrow', () => {
    // The dropped ones are removed, not left in the past. Left on Monday the
    // same button would offer to move the same sittings every day forever.
    const state = base();
    state.sessions = Array.from({ length: 12 }, (_, i) =>
      sitting({ id: `s${i}`, on: MON, minutes: 45 }),
    );
    const after = run(state, { type: 'moveMissed', today: TUE, dayMinutes: 45 });
    expect(missed(after.sessions, TUE)).toEqual([]);
  });
});

describe('throwing the plan away', () => {
  it('empties it', () => {
    const state = base();
    state.sessions = [sitting()];
    expect(run(state, { type: 'clearPlan' }).sessions).toEqual([]);
  });

  it('is a no-op on an empty plan, object identity included', () => {
    const state = base();
    expect(run(state, { type: 'clearPlan' })).toBe(state);
  });
});
