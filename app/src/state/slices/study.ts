/**
 * Drilling, quizzing, and what the answers are worth.
 *
 * `markCard` is the one that matters: an answer is recorded against the card
 * through `score`, not merely counted for this run, which is the difference
 * between a score and a study system.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { score } from '../../lib/review';
import { handle, remember } from '../../lib/sure';
import { unitKey } from '../../lib/pretest';
import type { Action, State } from '../shape';
import { push } from './navigate';

export function study(state: State, action: Action): State | null {
  switch (action.type) {
    /*
     * Mix the courses in this run, or keep them one at a time.
     *
     * Resets the position: the deck is rebuilt in a different order, so
     * staying at card 14 would land somewhere unrelated to where you were.
     */
    case 'guessFirst':
      return {
        ...state,
        screen: 'guess',
        guideId: action.courseId as State['guideId'],
        guessUnit: action.unit,
        guessIdx: 0,
        guessRight: 0,
        guessSaid: false,
      };

    case 'guessShow':
      return state.guessSaid ? state : { ...state, guessSaid: true };

    case 'guessNext':
      // Counted for the sentence at the end and nowhere else: this goes
      // nowhere near `reviews` or `answers`, because being wrong is the
      // mechanism here and nothing may punish it. See `lib/pretest.ts`.
      return {
        ...state,
        guessIdx: state.guessIdx + 1,
        guessSaid: false,
        guessRight: state.guessRight + (action.right ? 1 : 0),
      };

    case 'guessDone':
      return {
        ...state,
        screen: 'guide',
        pretested: { ...state.pretested, [unitKey(action.courseId, action.unit)]: action.at },
      };

    case 'mixCourses':
      return state.drillMix === action.on ? state : { ...state, drillMix: action.on, drillIdx: 0 };

    case 'setMode':
      return { ...state, mode: action.mode };

    case 'setEpisode':
      return { ...state, episodeId: action.id };

    case 'toggleWays':
      return { ...state, waysOpen: !state.waysOpen };

    case 'toggleUnit':
      return { ...state, openUnit: state.openUnit === action.index ? -1 : action.index };

    case 'startDrill':
      return push(
        { ...state, drillUnit: action.unit, drillIdx: 0, drillGot: 0, revealed: false },
        'drill',
      );

    case 'flip':
      return { ...state, revealed: true };

    case 'markCard': {
      // The answer is recorded against the card, not just counted for this
      // run — which is the difference between a score and a study system.
      const now = Date.now();
      // How sure the student said they were, where they said. `lib/sure.ts`
      // decides what that means for the schedule; this only carries it.
      const h = action.sure ? handle({ got: action.got, sure: action.sure }) : null;
      return {
        ...state,
        revealed: false,
        drillIdx: state.drillIdx + 1,
        drillGot: state.drillGot + (action.got ? 1 : 0),
        reviews: {
          ...state.reviews,
          [action.key]: score(state.reviews[action.key], action.got, now, h?.soon ?? false),
        },
        answers: action.sure
          ? remember(state.answers, {
              key: action.key,
              courseId: action.courseId ?? '',
              got: action.got,
              sure: action.sure,
              at: now,
            })
          : state.answers,
      };
    }

    // The same record, without the run around it. `markCard` also advances
    // the drill's position and score, which the between-classes mode does not
    // have and must not move: a gap run would otherwise skip you forward
    // through a sitting-down drill you had left half finished.
    case 'recordCard':
      return {
        ...state,
        reviews: {
          ...state.reviews,
          [action.key]: score(state.reviews[action.key], action.got, Date.now()),
        },
      };

    case 'redrill':
      return { ...state, drillIdx: 0, drillGot: 0, revealed: false };

    case 'startQuiz':
      return push(
        {
          ...state,
          quiz: action.quiz,
          quizIdx: 0,
          quizPicked: null,
          quizScore: 0,
          quizSeed: state.quizSeed + 7,
        },
        'quiz',
      );

    case 'pickAnswer': {
      if (state.quizPicked !== null) return state;
      const ok = state.quiz[state.quizIdx]?.opts[action.index]?.ok ?? false;
      return {
        ...state,
        quizPicked: action.index,
        quizScore: state.quizScore + (ok ? 1 : 0),
      };
    }

    case 'nextQuestion':
      return { ...state, quizIdx: state.quizIdx + 1, quizPicked: null };

    default:
      return null;
  }
}
