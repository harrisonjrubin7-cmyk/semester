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
import { moveOn } from '../../lib/sessions';
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
      return state.drillMix === action.on
        ? state
        : { ...state, drillMix: action.on, drillIdx: 0, lastAnswer: null };

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
        {
          ...state,
          // Named course or the open guide. The drill reads its deck from
          // `guideId`, so a run started from a screen that ranks every course
          // has to say which one it meant.
          guideId: action.courseId ?? state.guideId,
          // The unit the drill is about is also the unit the guide should be
          // open at when you come back out of it.
          openUnit: action.unit ?? state.openUnit,
          drillUnit: action.unit,
          drillIdx: 0,
          lastAnswer: null,
          drillGot: 0,
          revealed: false,
          // A run on one named unit is not a mixed run. Leaving this on would
          // silently ignore both the course and the unit just chosen.
          drillMix: action.courseId ? false : state.drillMix,
        },
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
        /*
         * What this answer replaced, kept so it can be put back.
         *
         * `null` where the card had no record: a first answer creates the row
         * and undoing it has to take the row away again, not leave a blank
         * one behind that would stop the card counting as never met.
         */
        lastAnswer: { key: action.key, was: state.reviews[action.key] ?? null, got: action.got },
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

    /*
     * The last answer, taken back — the schedule with it.
     *
     * A mis-tap on a card you knew is not a small thing once answers are
     * recorded: "Again" halves the ease, zeroes the interval and puts the
     * card back in ten minutes, and there was no way to say it had not
     * happened. Every other list in this app can be corrected; the one screen
     * that writes to a scheduler could not be.
     *
     * One step and only within the run, because that is the whole of the
     * mistake it exists for. `lib/undo.ts` says why a stack is the wrong
     * shape for something that also syncs.
     */
    case 'undoCard': {
      const last = state.lastAnswer;
      if (!last) return state;
      const reviews = { ...state.reviews };
      if (last.was) reviews[last.key] = last.was;
      else delete reviews[last.key];
      return {
        ...state,
        reviews,
        // Back to the card, face down: an undo that left the answer showing
        // would be asking somebody to re-grade a card they can already see.
        revealed: false,
        drillIdx: Math.max(0, state.drillIdx - 1),
        drillGot: Math.max(0, state.drillGot - (last.got ? 1 : 0)),
        lastAnswer: null,
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

    /*
     * Clear the evidence for a set of cards.
     *
     * The "that's not right" behind a unit's standing. `lib/knowing.ts` reads
     * five named states off the review rows, and a state read off evidence is
     * only honest if the person it is about can throw the evidence away — the
     * percentage it replaced could not be argued with at all.
     *
     * The rows are **deleted**, not zeroed. A row with `seen: 0` left behind
     * would keep the card out of `neverMet` and out of `dueFirst`'s unseen
     * band, so the unit would read Unseen and drill as if already met. That is
     * the same distinction `undoCard` makes two cases up, for the same reason.
     *
     * `lastAnswer` goes with them: an undo that reached back past a reset
     * would restore one card of an evidence set the student had just cleared.
     */
    case 'forgetCards': {
      if (action.keys.length === 0) return state;
      const reviews = { ...state.reviews };
      for (const key of action.keys) delete reviews[key];
      return {
        ...state,
        reviews,
        answers: state.answers.filter((a) => !action.keys.includes(a.key)),
        lastAnswer:
          state.lastAnswer && action.keys.includes(state.lastAnswer.key) ? null : state.lastAnswer,
      };
    }

    /*
     * A plan, committed to days.
     *
     * Replaces everything from `from` forward and keeps what is behind it.
     * Keeping the past is the point: those are the sittings that were missed,
     * and a replan that swept them up would make the plan unmissable again —
     * which is the state the app was in before `lib/sessions.ts`.
     */
    case 'planSessions':
      return {
        ...state,
        sessions: [...state.sessions.filter((s) => s.on < action.from), ...action.sessions],
      };

    case 'finishSession':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.id ? { ...s, doneAt: action.at } : s,
        ),
      };

    /*
     * Every missed sitting moved forward, in one press.
     *
     * The arithmetic is `moveOn`'s, not repeated here — the screen shows a
     * preview from `willMove`, which calls the same function, so the sentence
     * on the button and the thing the button does cannot come apart.
     *
     * Returns `state` itself when nothing moved, so a press with nothing
     * missed is not a re-render and a sync write for nothing.
     */
    case 'moveMissed': {
      const out = moveOn(state.sessions, {
        today: action.today,
        ...(action.dayMinutes === undefined ? {} : { dayMinutes: action.dayMinutes }),
      });
      if (out.count === 0 && out.dropped.length === 0) return state;
      return { ...state, sessions: out.sessions };
    }

    case 'clearPlan':
      return state.sessions.length === 0 ? state : { ...state, sessions: [] };

    case 'redrill':
      // `lastAnswer` with it: a new run must not be able to undo into the
      // one before it.
      return { ...state, drillIdx: 0, drillGot: 0, revealed: false, lastAnswer: null };

    case 'startQuiz':
      return push(
        {
          ...state,
          quiz: action.quiz,
          quizIdx: 0,
          quizPicked: null,
          quizScore: 0,
          quizSeed: state.quizSeed + 7,
          quizRungs: 0,
          quizHelped: 0,
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

    /*
     * One more rung, and the question is marked as helped from the first one.
     *
     * Marked here rather than at `nextQuestion`, so a question you take a hint
     * on and then leave still counted. The alternative records help only for
     * the questions somebody stayed on, which flatters the run in exactly the
     * cases it should not.
     */
    case 'takeHint':
      return { ...state, quizRungs: state.quizRungs + 1 };

    case 'nextQuestion':
      return {
        ...state,
        quizIdx: state.quizIdx + 1,
        quizPicked: null,
        quizRungs: 0,
        quizHelped: state.quizHelped + (state.quizRungs > 0 ? 1 : 0),
      };

    default:
      return null;
  }
}
