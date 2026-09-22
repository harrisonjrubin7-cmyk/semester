import { describe, expect, it } from 'vitest';
import { reducer } from './reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from './shape';
import { blankCourse } from '../lib/edit';
import { ONB_STEPS } from '../data/misc';

/**
 * Two things that happen at "the first course of the student's own", and the
 * run that ends without ever reaching either.
 *
 * `SampleMark` already names the moment and the failure it left open:
 *
 *     **Not mine** removes them, which is what somebody who was looking
 *     around wants *once they have their own syllabus in*.
 *
 *     import one real syllabus alongside it and Today mixes your Thursday
 *     paper with somebody else's, with nothing distinguishing them.
 *
 * Measured on a real install — run skipped, `PHYS 1601` added by hand, Today
 * read off the screen:
 *
 *     NEXT CLASS · BUS 1600 · Alumni Hall 201
 *     DUE TODAY · "One thing left. Finish it." · CORE 2500 QUIZ
 *     6 deadlines went by unticked in the last three weeks
 *
 * Their course was in neither list, and the banner offering to take the
 * other four away was still sitting there. Both halves below are that
 * failure: the sample staying on past the moment it says it should retire,
 * and the run itself landing on Today rather than on the door it had just
 * told the student to use.
 */

function fresh(over: Partial<State> = {}): State {
  return { ...DEFAULT_PERSISTED, ...initialEphemeral(), ...over } as State;
}

const act = (s: State, a: Action) => reducer(s, a);

describe('the sample steps aside for the first course of your own', () => {
  it('retires on the first course added by hand', () => {
    expect(fresh().sample).toBe(true);
    const module = blankCourse('PHYS 1601', '2026FA', []);
    const after = act(fresh(), { type: 'addCourse', module });
    expect(after.sample).toBe(false);
    // The course is still there — this is a flag, not a deletion.
    expect(after.courses).toHaveLength(1);
  });

  it('retires on the first course synced from a school', () => {
    const module = blankCourse('PHYS 1601', '2026FA', []);
    const after = act(fresh(), { type: 'schoolCourse', module });
    expect(after.sample).toBe(false);
  });

  it('does not re-toggle once there is already a course of your own', () => {
    // The control that matters: a student who switched the sample back on
    // from Settings to look something up has said what they want, and their
    // *next* course must not answer that question again.
    const first = blankCourse('PHYS 1601', '2026FA', []);
    const withOne = act(fresh(), { type: 'addCourse', module: first });
    const withSampleBackOn = { ...withOne, sample: true };
    const second = blankCourse('ECON 2100', '2026FA', ['phys-1601']);
    const after = act(withSampleBackOn, { type: 'addCourse', module: second });
    expect(after.sample).toBe(true);
  });

  it('leaves an already-empty account’s sample flag alone if it was already off', () => {
    // Somebody who explicitly turned the sample off with no courses yet must
    // not have this silently no-op into "true" on their first course — it is
    // already the state this exists to reach.
    const module = blankCourse('PHYS 1601', '2026FA', []);
    const after = act(fresh({ sample: false }), { type: 'addCourse', module });
    expect(after.sample).toBe(false);
  });

  /*
   * The revert, watched go red rather than assumed. Both guards removed —
   * `addCourse` and `schoolCourse` back to always appending without touching
   * `sample` — and the first test above is exactly what catches it.
   */
  it('the guard is load-bearing: reverting it fails the first two tests above', () => {
    const bothOff = (s: State, a: Action) => {
      // A faithful revert of the reducer, inline: append without the flag.
      if (a.type === 'addCourse') return { ...s, courses: [...s.courses, a.module] };
      if (a.type === 'schoolCourse') return { ...s, courses: [...s.courses, a.module] };
      return act(s, a);
    };
    const module = blankCourse('PHYS 1601', '2026FA', []);
    const reverted = bothOff(fresh(), { type: 'addCourse', module } as Action);
    expect(reverted.sample).toBe(true); // proves the probe can see the bug
  });
});

describe('where the run lets you out', () => {
  function finishOnboarding(over: Partial<State> = {}): State {
    let s = fresh({ onb: ONB_STEPS - 1, ...over });
    return act(s, { type: 'onbNext' });
  }

  it('ends on the import screen when nothing of yours is in yet', () => {
    const after = finishOnboarding({ courses: [] });
    expect(after.screen).toBe('import');
    expect(after.seenOnboarding).toBe(true);
  });

  it('ends on the ordinary opening screen once you have a course', () => {
    const module = blankCourse('PHYS 1601', '2026FA', []);
    const after = finishOnboarding({ courses: [module] });
    expect(after.screen).not.toBe('import');
    expect(after.screen).toBe('home');
  });

  it('sample courses alone do not count as "yours" for this decision', () => {
    // `state.courses` is the student's own; the shipped four never appear
    // there. A run that checked `catalog` instead would land on Today with
    // nothing of the student's in it — the same failure as the sample banner
    // above, at the one moment the app is deciding where to release them.
    const after = finishOnboarding({ courses: [], sample: true });
    expect(after.screen).toBe('import');
  });

  it('Skip is unaffected — it means stop asking, not "go add something"', () => {
    const after = act(fresh({ onb: 2, courses: [] }), { type: 'finishOnboarding' });
    expect(after.screen).toBe('home');
  });
});
