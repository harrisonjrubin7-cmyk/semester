/**
 * The individual scores inside a grading category, and the syllabus's rule
 * about which of them count.
 *
 * A category like "Quizzes, 20%" is one row with one box, and that box is the
 * wrong shape for a course that holds eight quizzes and drops the lowest two.
 * A student entering their own average there is entering a number their course
 * does not use — and the error runs one way: it reads worse than the truth, so
 * every "to finish with, you need" figure below advises panic.
 *
 * ## A column, because that is how scores arrive
 *
 * Somebody reading off a gradebook has a column of numbers, not a mean. The
 * field takes the column, and each entry goes through the same reader the
 * single box uses — so "17/20" works here exactly as it does there.
 *
 * ## It shows what it struck out
 *
 * Not just how many. The commonest cause of a wrong average is a score typed
 * twice, and the only way to see that is to be shown which two went.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { dropHelped, dropLine, readScores } from '../lib/drop';

export function PiecesRow({ gradeKey, what }: { gradeKey: string; what: string }) {
  const { state, dispatch } = useStore();
  const text = state.pieces[gradeKey] ?? '';
  const drop = state.drops[gradeKey] ?? 0;
  const [open, setOpen] = useState(text.trim().length > 0);

  const scores = readScores(text);
  const gained = dropHelped(scores, drop);

  if (!open) {
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(true)}
        style={{
          width: 'auto',
          padding: '2px 0 8px',
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.5,
          textAlign: 'left',
        }}
      >
        Several pieces, with the lowest dropped?
      </button>
    );
  }

  return (
    <div style={{ padding: '2px 0 12px' }}>
      <textarea
        className="input"
        value={text}
        onChange={(e) => dispatch({ type: 'setPieces', key: gradeKey, text: e.target.value })}
        placeholder="88, 92, 76 — one per line or comma-separated. 17/20 works too."
        aria-label={`Individual scores for ${what}`}
        style={{
          width: '100%',
          minHeight: 60,
          resize: 'vertical',
          fontSize: 'calc(13px * var(--text-scale, 1))',
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 7, flexWrap: 'wrap' }}>
        <label
          style={{
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Lowest dropped
          <input
            className="input"
            inputMode="numeric"
            value={drop || ''}
            placeholder="0"
            onChange={(e) =>
              dispatch({ type: 'setDrop', key: gradeKey, drop: Number(e.target.value) || 0 })
            }
            style={{ width: 54, height: 32, textAlign: 'center', fontSize: 'calc(13px * var(--text-scale, 1))' }}
          />
        </label>
        <button
          type="button"
          className="bare"
          onClick={() => {
            dispatch({ type: 'setPieces', key: gradeKey, text: '' });
            dispatch({ type: 'setDrop', key: gradeKey, drop: 0 });
            setOpen(false);
          }}
          style={{ width: 'auto', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5 }}
        >
          Use one score instead
        </button>
      </div>

      {scores.length > 0 ? (
        <div
          style={{
            fontSize: 'calc(12px * var(--text-scale, 1))',
            opacity: 0.75,
            marginTop: 7,
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {dropLine(scores, drop)}
          {/* Said only when the rule actually moved the number. A syllabus
              that drops the lowest of eight identical scores is a real rule
              that changes nothing, and announcing it every time is noise. */}
          {gained > 0.05 ? ` The rule is worth ${Math.round(gained * 10) / 10} points here.` : ''}
        </div>
      ) : null}
    </div>
  );
}
