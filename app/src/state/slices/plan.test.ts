import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { minutesOn, missed, progressOf, type Session } from '../../lib/sessions';

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

/**
 * Opening a sitting, and finishing one, which were the same event for a
 * release.
 *
 * `Study.tsx` dispatched `finishSession` one line above the drill on the
 * argument that a sitting you open is a sitting you did some of. The argument
 * is about a student; the record could not tell it apart from tapping a row
 * and pressing back, so the plan's only measurement was which rows had been
 * tapped and every one of these tests would have passed vacuously — every
 * sitting was done the moment it was seen.
 *
 * So the cases below are written as the difference between the two events.
 * Each one was run against a faithful revert of the fix — `startDrill`
 * stamping `doneAt` — and each one fails there.
 */
describe('opening a sitting', () => {
  const open = (id: string): Action => ({ type: 'startDrill', unit: 0, session: id });

  it('does not finish it', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    const after = run(state, open('a'));
    expect(after.sessions[0].doneAt).toBeUndefined();
  });

  it('stamps it started, so the row can say it was opened', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    const after = run(state, open('a'));
    expect(after.sessions[0].startedAt).toBeGreaterThan(0);
    expect(progressOf(after.sessions[0])).toBe('started');
  });

  it('leaves it outstanding, so tomorrow still calls last night missed', () => {
    // The whole point, stated as the number the student sees. Opening and
    // backing out of Monday's sitting used to clear Monday.
    const state = base();
    state.sessions = [sitting({ id: 'a', on: MON, cards: 12 })];
    const after = run(state, open('a'));
    expect(missed(after.sessions, TUE).map((s) => s.id)).toEqual(['a']);
  });

  it('does not move a second opening of the same sitting', () => {
    // Resuming is not restarting. A `startedAt` rewritten on every open would
    // make "opened at" mean "last opened at", which is a different fact.
    const state = base();
    state.sessions = [sitting({ id: 'a', cards: 12, startedAt: 1_000 })];
    const after = run(state, open('a'));
    expect(after.sessions[0].startedAt).toBe(1_000);
  });

  it('touches no other sitting', () => {
    const state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 }), sitting({ id: 'b', cards: 12 })];
    const after = run(state, open('a'));
    expect(after.sessions.find((s) => s.id === 'b')?.startedAt).toBeUndefined();
  });
});

describe('finishing a sitting', () => {
  const open = (id: string): Action => ({ type: 'startDrill', unit: 0, session: id });
  const answer = (key: string): Action => ({ type: 'markCard', got: true, key });

  it('takes the cards it was sized for, and not one fewer', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 3 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    state = run(state, answer('c2'));
    expect(state.sessions[0].doneAt).toBeUndefined();
    expect(progressOf(state.sessions[0])).toBe('partly');
    state = run(state, answer('c3'));
    expect(state.sessions[0].doneAt).toBeGreaterThan(0);
    expect(progressOf(state.sessions[0])).toBe('done');
  });

  it('counts the real work on the way, so a half-done evening reads as half done', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    state = run(state, answer('c2'));
    expect(state.sessions[0].answered).toBe(2);
  });

  it('takes it out of what counts as missed tomorrow, once it is actually done', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', on: MON, cards: 1 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    expect(missed(state.sessions, TUE)).toEqual([]);
  });

  it('credits nothing when the run was not opened from the plan', () => {
    // A drill started from the ranking below the plan is real study and it is
    // not this sitting. Crediting it because the two name one unit would be
    // the same bug with a longer fuse.
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 1 })];
    state = run(state, { type: 'startDrill', unit: 0 });
    state = run(state, answer('c1'));
    expect(state.sessions[0].answered).toBeUndefined();
    expect(state.sessions[0].doneAt).toBeUndefined();
  });

  it('credits the open sitting and no other', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 4 }), sitting({ id: 'b', cards: 4 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    expect(state.sessions.find((s) => s.id === 'b')?.answered).toBeUndefined();
  });

  it('stops counting once it is done, so going again cannot overrun it', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 1 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    const at = state.sessions[0].doneAt;
    state = run(state, answer('c2'));
    expect(state.sessions[0].answered).toBe(1);
    expect(state.sessions[0].doneAt).toBe(at);
  });

  it('finishes it when the deck runs out first', () => {
    // A unit can have fewer cards than the sitting was sized for a fortnight
    // ago. Without this it would sit at eleven of twelve for ever and the plan
    // would report a missed evening on the night the deck was emptied.
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    state = run(state, { type: 'sessionSpent', at: 1_700_000 });
    expect(state.sessions[0].doneAt).toBe(1_700_000);
  });

  it('finishes nothing when a spent deck was not opened from the plan', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, { type: 'startDrill', unit: 0 });
    const after = run(state, { type: 'sessionSpent', at: 1_700_000 });
    expect(after.sessions[0].doneAt).toBeUndefined();
    // And returns the state it was given, so a screen may dispatch it on
    // every render of its last frame without causing a write.
    expect(after).toBe(state);
  });

  it('gives a sitting with no card count a way to finish at all', () => {
    // Laid down before `cards` existed. It cannot be finished by counting to a
    // number it never had, and inventing one would be the retrospective
    // history this change exists to avoid — so the spent deck is its only
    // route, and it has to work.
    let state = base();
    state.sessions = [sitting({ id: 'a' })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    expect(state.sessions[0].doneAt).toBeUndefined();
    state = run(state, { type: 'sessionSpent', at: 1_700_000 });
    expect(state.sessions[0].doneAt).toBe(1_700_000);
  });
});

describe('taking an answer back', () => {
  const open = (id: string): Action => ({ type: 'startDrill', unit: 0, session: id });
  const answer = (key: string): Action => ({ type: 'markCard', got: true, key, sure: 'know' });

  it('takes it off the sitting too', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    state = run(state, answer('c2'));
    state = run(state, { type: 'undoCard' });
    expect(state.sessions[0].answered).toBe(1);
  });

  it('unfinishes a sitting the undone answer had finished', () => {
    // Otherwise the last card of a sitting could be answered, taken back, and
    // still have finished it — the same bug, one card wide.
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 1 })];
    state = run(state, open('a'));
    state = run(state, answer('c1'));
    expect(state.sessions[0].doneAt).toBeGreaterThan(0);
    state = run(state, { type: 'undoCard' });
    expect(state.sessions[0].doneAt).toBeUndefined();
    expect(progressOf(state.sessions[0])).toBe('started');
  });
});

describe('the sitting a run is being done for', () => {
  it('is forgotten when the plan is laid down again', () => {
    // The pointer would otherwise reach into a sitting that no longer exists,
    // or into a new one that reused its id.
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, { type: 'startDrill', unit: 0, session: 'a' });
    expect(state.liveSession).toBe('a');
    state = run(state, { type: 'planSessions', from: TUE, sessions: [sitting({ id: 'a' })] });
    expect(state.liveSession).toBeNull();
  });

  it('is forgotten when the plan is dropped', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, { type: 'startDrill', unit: 0, session: 'a' });
    state = run(state, { type: 'clearPlan' });
    expect(state.liveSession).toBeNull();
  });

  it('is forgotten when a drill is started anywhere else', () => {
    let state = base();
    state.sessions = [sitting({ id: 'a', cards: 12 })];
    state = run(state, { type: 'startDrill', unit: 0, session: 'a' });
    state = run(state, { type: 'startDrill', unit: 3 });
    expect(state.liveSession).toBeNull();
  });

  // Surviving a reload is `state/storage.test.ts`'s, where the round trip
  // through storage is already set up.
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
