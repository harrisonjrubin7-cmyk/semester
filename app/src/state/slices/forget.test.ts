import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { cardKey, score } from '../../lib/review';
import { forgetting, knowingOf } from '../../lib/knowing';

/**
 * The reset behind a unit's standing.
 *
 * `lib/knowing.ts` replaced the mastery percentage with a state read off the
 * review rows, and the argument for doing that was partly that a state with
 * its counts under it can be disagreed with. This is the disagreeing: the
 * student says the app has it wrong, and the evidence for that unit goes.
 *
 * Two things are easy to get wrong here and both are tested below. The rows
 * have to be **deleted** rather than zeroed, because a zeroed row is not the
 * same as no row anywhere else in the app; and `lastAnswer` has to go with
 * them, because undo restores one row and would otherwise put a card back
 * into a set the student had just cleared.
 */

const NOW = Date.parse('2026-09-15T09:00:00Z');
const DAY = 86_400_000;

/**
 * A state nobody else is holding.
 *
 * `DEFAULT_PERSISTED` is one object, and a shallow spread of it shares every
 * field that is itself an object — so a test that writes a card into
 * `state.reviews` writes it into the default, and the next test in the file
 * starts with it. That is the shape of fault `npm run test:shuffle` exists to
 * catch, and it is cheaper to not create it.
 */
function base(): State {
  return { ...DEFAULT_PERSISTED, ...initialEphemeral(), reviews: {}, answers: [] } as State;
}

/** A course's cards, answered right twice each, a day apart. */
function studied(courseId: string, questions: string[]): State {
  const state = base();
  for (const q of questions) {
    const key = cardKey(courseId, q);
    state.reviews[key] = score(score(undefined, true, NOW), true, NOW + DAY);
  }
  return state;
}

const QS = ['What is opportunity cost?', 'Define marginal utility', 'What shifts a demand curve?'];
const KEYS = QS.map((q) => cardKey('econ', q));

function run(state: State, action: Action): State {
  return reducer(state, action);
}

describe('forgetCards', () => {
  it('takes a studied unit back to unseen', () => {
    const state = studied('econ', QS);
    expect(knowingOf(KEYS, state.reviews, NOW + DAY).state).toBe('retained');

    const after = run(state, { type: 'forgetCards', keys: forgetting(KEYS, state.reviews) });
    expect(knowingOf(KEYS, after.reviews, NOW + DAY).state).toBe('unseen');
  });

  it('removes the rows rather than emptying them', () => {
    // A row left behind with `seen: 0` reads as unseen to `lib/knowing.ts` and
    // as *met* to `neverMet` and `dueFirst` in `lib/review.ts` — so the unit
    // would say "Unseen" and then deal the cards as though they had been.
    const state = studied('econ', QS);
    const after = run(state, { type: 'forgetCards', keys: KEYS });
    for (const key of KEYS) expect(key in after.reviews).toBe(false);
  });

  it('leaves every other card alone', () => {
    const state = studied('econ', QS);
    const other = cardKey('psci', 'What is sovereignty?');
    state.reviews[other] = score(undefined, true, NOW);

    const after = run(state, { type: 'forgetCards', keys: KEYS });
    expect(after.reviews[other]).toEqual(state.reviews[other]);
  });

  it('drops the confidence answers for those cards too', () => {
    // `answers` is the second record of the same events — `lib/sure.ts` reads
    // it for what the student said about how sure they were. Clearing one and
    // not the other leaves the app able to report confidence for a card it
    // says nobody has answered.
    const state = studied('econ', QS);
    state.answers = [
      { key: KEYS[0], courseId: 'econ', got: true, sure: 'know', at: NOW },
      { key: cardKey('psci', 'What is sovereignty?'), courseId: 'psci', got: false, sure: 'guess', at: NOW },
    ];
    const after = run(state, { type: 'forgetCards', keys: KEYS });
    expect(after.answers.map((a) => a.courseId)).toEqual(['psci']);
  });

  it('stops undo reaching back into a set that has just been cleared', () => {
    const state = studied('econ', QS);
    state.lastAnswer = { key: KEYS[0], was: null, got: true };

    const after = run(state, { type: 'forgetCards', keys: KEYS });
    expect(after.lastAnswer).toBeNull();

    // And the undo that would have restored it now does nothing.
    const undone = run(after, { type: 'undoCard' });
    expect(KEYS[0] in undone.reviews).toBe(false);
  });

  it('keeps an undo that points at a card the reset did not touch', () => {
    const state = studied('econ', QS);
    const other = cardKey('psci', 'What is sovereignty?');
    state.lastAnswer = { key: other, was: null, got: true };
    state.reviews[other] = score(undefined, true, NOW);

    const after = run(state, { type: 'forgetCards', keys: KEYS });
    expect(after.lastAnswer).toEqual({ key: other, was: null, got: true });
  });

  it('is a no-op for an empty list, object identity included', () => {
    // `forgetting` returns [] for a unit with nothing recorded, and the button
    // that calls this is allowed to be pressed anyway. A new state object for
    // a change that did not happen is a re-render and a sync write for
    // nothing.
    const state = studied('econ', QS);
    expect(run(state, { type: 'forgetCards', keys: [] })).toBe(state);
  });

  it('ignores a key that was never there', () => {
    const state = studied('econ', QS);
    const after = run(state, { type: 'forgetCards', keys: ['nothing-of-the-sort'] });
    expect(Object.keys(after.reviews).sort()).toEqual([...KEYS].sort());
  });
});
