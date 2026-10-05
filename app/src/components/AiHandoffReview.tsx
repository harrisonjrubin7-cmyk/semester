/**
 * The review before a question goes to an AI service Semester does not run.
 *
 * It lists what goes, piece by piece, as the same values that make the
 * prompt (`lib/aihandoff.ts`), then what does not go, then whose privacy
 * terms apply. The send button names the service, so the last thing read
 * before pressing it is where the text is going.
 *
 * Drawn on `.device` like `TypeToConfirm`, for the same reason: an overlay
 * inside the scroll box covers the scroll box, not the screen.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../a11y/modal';
import { EXTERNAL_AI, EXCERPT_WORDS, NEVER_SHARED, type ExternalAiId, type Prepared } from '../lib/aihandoff';

export function AiHandoffReview({
  to,
  prepared,
  onSend,
  onCancel,
}: {
  to: ExternalAiId;
  prepared: Prepared;
  onSend: () => void;
  onCancel: () => void;
}) {
  const ai = EXTERNAL_AI[to];
  const cancel = useRef<HTMLButtonElement>(null);
  // Focus starts on Cancel: the safe button is the one a stray Enter presses.
  const { ref: modalRef, onKeyDown } = useModal<HTMLDivElement>({ onClose: onCancel, initial: cancel });
  const frame =
    (typeof document === 'undefined' ? null : document.querySelector('.device')) ??
    (typeof document === 'undefined' ? null : document.body);

  const small = { fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' } as const;

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Send to ${ai.name}?`}
      ref={modalRef}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 85,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        paddingBlock: 'calc(22px * var(--density, 1))',
        paddingInline: 'calc(22px * var(--density, 1))',
      }}
    >
      <div className="kicker">Outside Semester</div>
      <h2 style={{ marginTop: 'calc(8px * var(--density, 1))', marginInline: 0, marginBottom: 0, fontSize: 'var(--type-display-sm)', textWrap: 'balance' }}>
        Send to {ai.name}?
      </h2>

      <h3 style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-3)', fontSize: 'var(--type-base)' }}>Semester will send</h3>
      <ul style={{ margin: 0, paddingLeft: '1.2em', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {prepared.shared.map((piece) => (
          <li key={piece.label} style={{ fontSize: 'var(--type-sm-plus)', lineHeight: 'var(--leading-normal)' }}>
            <strong>{piece.label}:</strong>{' '}
            <span style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
              {piece.label === 'Excerpt you pasted'
                ? `${piece.value.split(' ').length} words${prepared.cut ? `, cut to the first ${EXCERPT_WORDS}` : ''}: “${piece.value}”`
                : piece.value}
            </span>
          </li>
        ))}
      </ul>

      <h3 style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-3)', fontSize: 'var(--type-base)' }}>Semester will not send</h3>
      <ul style={{ margin: 0, paddingLeft: '1.2em', ...small }}>
        {NEVER_SHARED.map((line) => <li key={line}>{line}</li>)}
      </ul>

      <p style={{ ...small, marginTop: 'var(--sp-7)' }}>
        {ai.name} is an outside AI service. Its own privacy terms apply, and what it answers is not course guidance.
        Check your course’s AI policy before using it for graded work. {ai.note}
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-7)', flexWrap: 'wrap' }}>
        <button ref={cancel} type="button" className="btn btn-secondary" onClick={onCancel} style={{ flex: 1, minHeight: 44 }}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={onSend} style={{ flex: 1, minHeight: 44 }}>
          Open {ai.name}
        </button>
      </div>
    </div>
  );

  return frame ? createPortal(sheet, frame) : sheet;
}
