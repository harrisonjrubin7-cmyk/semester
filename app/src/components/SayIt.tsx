/**
 * Answering a card out loud, before you turn it over.
 *
 * Tapping to reveal and thinking "yes, I knew that" is the oldest failure in
 * flashcards. You did not know it; you recognised it. The fix that actually
 * works is committing to an answer before you see the real one — and typing a
 * sentence on a phone is enough friction that nobody does it twice.
 *
 * So: say it. The words appear as you speak, and when you turn the card over
 * they are still there, next to the answer, to compare against.
 *
 * ## The app does not mark it
 *
 * Nothing here scores what you said against what the card says. Comparing two
 * pieces of free text is a thing that can be done badly and cannot be done
 * well, and a drill that calls a right answer wrong is one you stop trusting
 * within a session — the same reason `screens/Exam.tsx` leaves written answers
 * to the student. The three buttons that were always there do the marking, and
 * they are honest because you are the one pressing them.
 *
 * The value is the commitment, not the score. Having your own words on screen
 * beside the answer is what makes "I knew that" checkable.
 */

import { useEffect, useRef, useState } from 'react';
import { dictate, dictationSupported } from '../lib/mic';

export function SayIt({
  said,
  onSaid,
  revealed,
}: {
  said: string;
  onSaid: (text: string) => void;
  /** Once the card is turned over there is nothing left to commit to. */
  revealed: boolean;
}) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState('');
  const stop = useRef<(() => void) | null>(null);

  // Stopped whenever the card turns over or the screen goes, so a live
  // microphone cannot outlive the thing it was opened for.
  useEffect(() => {
    if (revealed && stop.current) {
      stop.current();
      stop.current = null;
      setOn(false);
    }
  }, [revealed]);

  useEffect(() => () => stop.current?.(), []);

  if (!dictationSupported()) return null;

  const begin = () => {
    setError('');
    onSaid('');
    stop.current = dictate(
      (text) => onSaid(text),
      (message) => {
        setError(message);
        setOn(false);
      },
    );
    setOn(true);
  };

  const end = () => {
    stop.current?.();
    stop.current = null;
    setOn(false);
  };

  if (revealed) {
    if (!said) return null;
    return (
      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--app-line)',
        }}
      >
        <div className="kicker" style={{ fontSize: 10 }}>
          What you said
        </div>
        <div style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.5, textWrap: 'pretty' }}>
          {said}
        </div>
        {/* No verdict. The three buttons below are the marking, and they are
            honest because the student is the one pressing them. */}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className={on ? 'btn btn-primary' : 'btn btn-secondary'}
        onClick={() => (on ? end() : begin())}
        style={{
          height: 36,
          fontSize: 12,
          paddingInline: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginInline: 'auto',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 8,
            background: on ? 'var(--chrome-ink)' : 'var(--app-accent)',
          }}
        />
        {on ? 'Stop' : 'Answer out loud'}
      </button>

      {said ? (
        <div
          style={{
            fontSize: 13,
            opacity: 0.75,
            marginTop: 10,
            lineHeight: 1.5,
            textAlign: 'center',
            textWrap: 'pretty',
          }}
        >
          “{said}”
        </div>
      ) : null}

      {error ? (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8, textAlign: 'center' }}>{error}</div>
      ) : null}
    </div>
  );
}
