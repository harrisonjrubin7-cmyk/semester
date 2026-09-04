/**
 * The one question asked on a first sign-in, and only when it is a real one.
 *
 * Two of the three cases are not questions. An empty account and a full device
 * means upload; an empty device and a full account means pull. Both happen
 * without a dialogue, because asking somebody to authorise the obvious is how
 * a dialogue becomes something people click through.
 *
 * This is the third case: coursework on both sides. The app merges by default
 * and the merge is a union — nothing either side has is dropped — but there are
 * real reasons to want one side instead, and replacing somebody's semester is
 * not a decision to make silently on their behalf.
 *
 * ## The two that can lose something write a file first
 *
 * Before either overwrite runs, what is on this device is saved to the
 * student's downloads. It costs a moment and it is the difference between a
 * mistake and a disaster. The safe option is first and pre-selected, because a
 * dialogue whose safe choice is second is one that gets clicked past.
 *
 * ## It cannot be dismissed by accident
 *
 * No backdrop tap, no Escape. Everything behind it is still there and still
 * works; what is waiting is a decision about which copy of a term to keep, and
 * a stray tap is not an answer to that.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SAFEST, backupName, destructive, options, type Choice, type Sides } from '../lib/adopt';

export function Adopting({
  sides,
  say,
  onChoose,
}: {
  sides: Sides;
  /** The line from `decide`, stating both sides. */
  say: string;
  onChoose: (choice: Choice, backup: string | null) => void;
}) {
  const [picked, setPicked] = useState<Choice>(SAFEST);
  const list = options(sides);

  const go = () => {
    // The filename is handed back rather than made by the caller, so the
    // decision to take a backup and the name it is taken under stay together.
    onChoose(picked, destructive(picked) ? backupName(Date.now()) : null);
  };

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Which copy to keep"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 88,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 22,
        overflowY: 'auto',
      }}
    >
      <div className="kicker">Signed in</div>
      <h2
        style={{
          margin: '8px 0 0',
          fontSize: 'calc(19px * var(--text-scale, 1))',
          textWrap: 'balance',
        }}
      >
        There is a semester in both places
      </h2>
      <div
        style={{
          fontSize: 'calc(13px * var(--text-scale, 1))',
          opacity: 0.75,
          marginTop: 10,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {say} Nothing has been changed yet.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {list.map((o) => {
          const on = picked === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(o.id)}
              className="bare"
              style={{
                textAlign: 'left',
                padding: '12px 13px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-panel)' : 'transparent',
                width: '100%',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(15px * var(--text-scale, 1))',
                }}
              >
                {o.label}
                {o.id === SAFEST ? ' · nothing is lost' : ''}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  opacity: 0.65,
                  marginTop: 3,
                  lineHeight: 1.45,
                  textWrap: 'pretty',
                }}
              >
                {o.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={go}
        style={{ marginTop: 16, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {picked === SAFEST ? 'Keep both' : 'Save a backup and go ahead'}
      </button>
    </div>
  );

  // On the device frame, like the app's other overlays — see `TypeToConfirm`,
  // where putting one inside a scrolling screen let the page show through.
  const frame = typeof document === 'undefined' ? null : document.querySelector('.device');
  return frame ? createPortal(sheet, frame) : sheet;
}
