import { useCallback, useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { cardIdentity, type CardReview } from '../lib/review';
import {
  EMPTY_QUIZ_FEEDBACK,
  QUIZ_REASONS,
  REASON_TEXT,
  leftOut,
  quizFeedbackKey,
  readQuizFeedback,
  report,
  reportFor,
  withdraw,
} from '../lib/quiz-feedback';
import { useStore } from '../state/store';
import type { QuizQuestion } from '../state/store';

/**
 * The student's reports on quiz questions, and the filter they make.
 *
 * `leave` goes straight to `buildQuiz`. It is a function of the stored
 * reports, so every place that builds a quiz leaves out the same cards.
 */
export function useQuizFeedback(courseId: string) {
  const { account } = useStore();
  const lib = useDeviceLibrary(quizFeedbackKey(account?.id), readQuizFeedback, EMPTY_QUIZ_FEEDBACK);
  const out = leftOut(lib.value, courseId);
  const leave = useCallback((card: { id?: string; q: string }) => out.has(cardIdentity(courseId, card)), [out, courseId]);
  return { ...lib, leave, count: out.size };
}

const quiet = {
  fontSize: 'var(--type-sm)',
  color: 'var(--app-dim)',
  marginTop: 'var(--sp-3)',
  textWrap: 'pretty',
} as const;

/**
 * Under an answered question: put its card in review, or say something is
 * wrong with it.
 *
 * Both are the student's choice and both can be taken back. A quiz answer
 * does not reach the review schedule by itself — a guess that came off, or a
 * slip on a card you know, would move it the wrong way — so after a miss the
 * card is offered, not sent. A report is kept on this device only; nothing is
 * sent, and the one effect is that the card is left out of this student's
 * quizzes until they take the report back.
 */
export function QuizFeedback({ question, courseId, missed }: { question: QuizQuestion; courseId: string; missed: boolean }) {
  const { state, dispatch } = useStore();
  const feedback = useQuizFeedback(courseId);
  const [was, setWas] = useState<{ key: string; row: CardReview | null } | null>(null);

  // A match is made from key terms, not a card: there is nothing to review
  // or leave out by name.
  if (question.kind === 'match') return null;
  const key = cardIdentity(courseId, { id: question.cardId, q: question.q });
  const reported = reportFor(feedback.value, key);
  const queued = was?.key === key;

  return (
    <div style={{ marginTop: 'var(--sp-5)' }}>
      {missed &&
        (queued ? (
          <p role="status" style={quiet}>
            Added to your review — this card comes round again soon.{' '}
            <button
              type="button"
              className="bare"
              onClick={() => {
                dispatch({ type: 'restoreReview', key, was: was.row });
                setWas(null);
              }}
            >
              Undo
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setWas({ key, row: state.reviews[key] ?? null });
              dispatch({ type: 'recordCard', key, got: false });
            }}
          >
            Review this card soon
          </button>
        ))}

      {reported ? (
        <p role="status" style={quiet}>
          You said: {REASON_TEXT[reported.reason].toLowerCase()}. It is left out of your quizzes, as a question and as an
          option. Kept on this device only.{' '}
          <button type="button" className="bare" onClick={() => feedback.update((f) => withdraw(f, key))}>
            Undo
          </button>
        </p>
      ) : (
        <details style={{ marginTop: 'var(--sp-3)' }}>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
            Something wrong with this question?
          </summary>
          <p style={quiet}>
            Your answer leaves this card out of your quizzes. It is noted on this device and not sent anywhere.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            {QUIZ_REASONS.map(([reason, text]) => (
              <button
                key={reason}
                type="button"
                className="btn btn-ghost"
                onClick={() => feedback.update((f) => report(f, { key, courseId, q: question.q, reason, at: Date.now() }))}
              >
                {text}
              </button>
            ))}
          </div>
        </details>
      )}
      {feedback.error && <p role="alert" style={quiet}>{feedback.error}</p>}
    </div>
  );
}
