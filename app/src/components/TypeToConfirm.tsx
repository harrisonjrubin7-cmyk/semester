/**
 * The one question the app still asks, and why it makes you type.
 *
 * Everything else that removes something is undoable — see `lib/undo.ts` and
 * the toast in `Undone.tsx`. This is for the case an undo cannot fix: removing
 * a course takes its guide, its units, its cards and every answer recorded
 * against them, and while a restore could put the rows back it could not put
 * back somebody's confidence in an app that lost their term.
 *
 * ## Typing, not a second button
 *
 * A yes/no dialogue works exactly once. By the twentieth time it is muscle
 * memory, which is another way of saying it stops being a question and becomes
 * a slightly slower Remove button. Typing the course code cannot be done by
 * reflex — you have to look at which course this is, which is the thing the
 * dialogue was pretending to ask.
 *
 * Case and surrounding space are forgiven (`typedRight`): the point is that
 * somebody read the sentence, not that they can transcribe.
 *
 * ## What it says it will take
 *
 * The counts are passed in and rendered as given. A confirmation that says
 * "this cannot be undone" and nothing else is asking somebody to agree to an
 * amount they have not been told.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { typedRight } from '../lib/undo';

export function TypeToConfirm({
  title,
  what,
  want,
  describe,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  /** The heading, e.g. "Remove ECON 1020". */
  title: string;
  /** Lines naming what goes with it. Rendered as given. */
  what: string[];
  /** The literal string that has to be typed. */
  want: string;
  /** What to call it in the sentence, e.g. "the course code". */
  describe: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const ok = typedRight(typed, want);

  useEffect(() => {
    box.current?.focus();
  }, []);

  /*
   * Drawn on the device, not where it was asked for.
   *
   * The first drive of this put it inside the course row, which sits inside
   * `main.scrollarea` — and that element is positioned, so `inset: 0` covered
   * the scroll box rather than the screen. What that looked like was a
   * confirmation with the settings list still showing under it, which is
   * exactly the impression a question about losing a term should not give.
   *
   * `.device` is where the app's other overlays live (`Ringing`, `QuickAdd`),
   * so this joins them rather than inventing a second convention. Falling back
   * to `body` keeps it rendering if that class is ever renamed.
   */
  const frame =
    (typeof document === 'undefined' ? null : document.querySelector('.device')) ??
    (typeof document === 'undefined' ? null : document.body);

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 85,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 22,
      }}
    >
      <div className="kicker">This one cannot be undone</div>
      <h2
        style={{
          margin: '8px 0 0',
          fontSize: 'calc(19px * var(--text-scale, 1))',
          textWrap: 'balance',
        }}
      >
        {title}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
        {what.map((line) => (
          <div
            key={line}
            style={{
              fontSize: 'calc(12.5px * var(--text-scale, 1))',
              opacity: 0.75,
              lineHeight: 1.45,
              textWrap: 'pretty',
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <label
        htmlFor="type-to-confirm"
        style={{
          display: 'block',
          marginTop: 18,
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        Type {describe} — <strong>{want}</strong> — to go ahead.
      </label>
      <input
        id="type-to-confirm"
        ref={box}
        className="input"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ok) onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{ width: '100%', height: 46, marginTop: 8, fontSize: 'calc(15px * var(--text-scale, 1))' }}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" className="btn" onClick={onCancel} style={{ flex: 1, height: 44 }}>
          Keep it
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={!ok}
          style={{ flex: 1, height: 44, opacity: ok ? 1 : 0.4 }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );

  return frame ? createPortal(sheet, frame) : sheet;
}
