/**
 * Speech to text, into whatever you are writing.
 *
 * This lived inside the note editor, which is where it was first needed and
 * is not the only place it belongs. Typing a paragraph of assignment
 * instructions on a phone, or the wording of a problem, or the brief for a
 * cover letter, is the slowest thing in the app — and every one of those is a
 * long field somebody would rather talk at.
 *
 * ## It appends, it never replaces
 *
 * Dictated words go after what is already written, with a blank line between.
 * Losing a paragraph to a misfired button is unforgivable, and a component
 * that overwrote the field would do it silently and often.
 *
 * ## Where the audio goes is the browser's business, and it says so
 *
 * The app uploads nothing. Which server recognises the speech differs between
 * browsers and is not something this can promise about, so it does not — see
 * `lib/mic.ts`. Firefox has no speech recognition at all, and that is stated
 * rather than left as a button that does nothing.
 */

import { useEffect, useRef, useState } from 'react';
import { dictate, dictationSupported } from '../lib/mic';

export function Dictate({
  onText,
  current,
  label = 'Dictate',
  compact = false,
}: {
  onText: (text: string) => void;
  /** What is already written. Dictated words are appended after it. */
  current: string;
  label?: string;
  /** Sized to sit under a field rather than span the screen. */
  compact?: boolean;
}) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const base = useRef('');

  useEffect(() => () => stop.current?.(), []);

  if (!dictationSupported()) {
    return (
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
        This browser has no speech recognition, so dictation is off. Chrome and Safari have it.
      </div>
    );
  }

  const begin = () => {
    setError('');
    base.current = current ? `${current.replace(/\s+$/, '')}\n\n` : '';
    stop.current = dictate(
      (text) => onText(base.current + text),
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

  return (
    <>
      <button
        type="button"
        className={
          compact
            ? on
              ? 'btn btn-primary'
              : 'btn btn-secondary'
            : on
              ? 'btn btn-primary btn-block'
              : 'btn btn-secondary btn-block'
        }
        onClick={() => (on ? end() : begin())}
        style={{
          height: compact ? 34 : 42,
          paddingInline: compact ? 14 : undefined,
          width: compact ? 'auto' : undefined,
          marginTop: compact ? 8 : 10,
          fontSize: 'calc(11px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: on ? 'var(--chrome-ink)' : 'var(--app-accent)',
            flex: 'none',
          }}
        />
        {on ? 'Stop dictating' : label}
      </button>
      {on && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.45 }}>
          Listening. Words appear as you say them, after whatever was already written.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', color: 'var(--app-accent)', marginTop: 8, lineHeight: 1.45 }}>
          {error}
        </div>
      )}
    </>
  );
}