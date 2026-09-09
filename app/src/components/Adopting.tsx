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
import { ActionButton } from './ui';
import { DESKTOP, useMedia } from '../lib/media';

/**
 * How wide the question gets, the same measure the app's other two overlays
 * use. It never binds on a phone, where the app is narrower than this.
 */
const COLUMN = 620;

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
  const wide = useMedia(DESKTOP);
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
        /*
         * What a blocking question covers, which is not the same box on both
         * layouts.
         *
         * The portal below puts this inside `.device`, which is what makes it
         * look like the app — that part was already right. What was not: on a
         * wide window `.device` is the pane, a strip in the middle of the
         * screen, so `absolute` left the rail and the assistant's button
         * showing and clickable beside a dialog that says `aria-modal`. This
         * is the one question the app asks before it will do anything, and
         * "answer this first" is the whole of its meaning — a student who can
         * walk into Courses instead has been told something untrue.
         *
         * So the window on a desk, and the app's own column below 760px,
         * where `.device` is a column with ground either side and spilling
         * across the ground would be the only thing in the app that does.
         * Same rule and same breakpoint as the search and the capture box.
         */
        position: wide ? 'fixed' : 'absolute',
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
      <div style={{ width: '100%', maxWidth: COLUMN, margin: '0 auto' }}>
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
          fontSize: 'var(--type-base)',
          opacity: 0.75,
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {say} Nothing has been changed yet.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-7)' }}>
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
                  fontSize: 'var(--type-lg)',
                }}
              >
                {o.label}
                {o.id === SAFEST ? ' · nothing is lost' : ''}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-sm)',
                  opacity: 0.65,
                  marginTop: 3,
                  lineHeight: 'var(--leading-normal)',
                  textWrap: 'pretty',
                }}
              >
                {o.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <ActionButton
        onClick={go}
        tone="primary"
        style={{ marginTop: 'var(--sp-7)' }}
      >
        {picked === SAFEST ? 'Keep both' : 'Save a backup and go ahead'}
      </ActionButton>
      </div>
    </div>
  );

  // On the device frame, like the app's other overlays — see `TypeToConfirm`,
  // where putting one inside a scrolling screen let the page show through.
  // This decides where it is *drawn from*, and so what it looks like; what it
  // covers is decided by `position` above, which on a wide window is the
  // window rather than the frame.
  const frame = typeof document === 'undefined' ? null : document.querySelector('.device');
  return frame ? createPortal(sheet, frame) : sheet;
}
