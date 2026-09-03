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
import type { Action, State } from '../shape';
import { push } from './navigate';

export function study(state: State, action: Action): State | null {
  switch (action.type) {
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
      return {
        ...state,
        revealed: false,
        drillIdx: state.drillIdx + 1,
        drillGot: state.drillGot + (action.got ? 1 : 0),
        reviews: {
          ...state.reviews,
          [action.key]: score(state.reviews[action.key], action.got, now),
        },
      };
    }

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
