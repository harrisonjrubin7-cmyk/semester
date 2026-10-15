import { useState } from 'react';
import { ActionButton } from './ui';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import {
  EMPTY,
  FEEDBACK_KEY,
  clearFeedback,
  momentFeedbackOn,
  readFeedback,
  setMuted,
  youSaidWeChanged,
  CHANGES,
  type Change,
} from '../lib/momentfeedback';
import { useAccountId } from '../state/store';

/**
 * "You said, we changed", and the controls for the questions.
 *
 * The log is `CHANGES`, which is empty until something has been collected and
 * acted on, and says so. Below it: the switch for the short questions, how
 * many answers are on this device, and a way to delete them. It says plainly
 * that they are not sent anywhere, because that is true — see the header of
 * `lib/momentfeedback.ts`.
 */
export function FeedbackPanel({ storageKey, changes = CHANGES }: { storageKey: string; changes?: readonly Change[] }) {
  const lib = useDeviceLibrary(storageKey, readFeedback, EMPTY, 60_000);
  const [confirming, setConfirming] = useState(false);
  const held = lib.value.answers.length + lib.value.skips.length;
  const small = { fontSize: 'var(--type-sm)', ...secondLine() } as const;

  return (
    <section aria-labelledby="you-said-heading" style={{ marginBottom: 'var(--sp-7)' }}>
      <h2 id="you-said-heading" style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-heading)' }}>
        You said, we changed
      </h2>
      <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-7)', fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
        {youSaidWeChanged(changes).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {lib.error && (
        <p role="alert" style={{ ...small, marginTop: 'var(--sp-4)' }}>
          {lib.error}
        </p>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' }}>
        <input
          type="checkbox"
          checked={!lib.value.muted}
          disabled={lib.blocked}
          onChange={(e) => lib.update((s) => setMuted(s, !e.target.checked))}
          style={{ marginTop: 'var(--sp-2)' }}
        />
        <span>
          Ask me short questions after things happen
          <span style={{ display: 'block', ...small }}>At most one a day, each optional. Turn this off and none are asked.</span>
        </span>
      </label>

      <p style={{ ...small, marginTop: 'var(--sp-4)' }}>
        {held === 0
          ? 'No answers are saved on this device.'
          : `${lib.value.answers.length} ${lib.value.answers.length === 1 ? 'answer is' : 'answers are'} saved on this device. They are not sent anywhere, and nobody at your school can read them.`}
      </p>

      {held > 0 &&
        (confirming ? (
          <div role="group" aria-label="Delete your answers?" style={{ marginTop: 'var(--sp-4)' }}>
            <p style={{ fontSize: 'var(--type-base)', margin: '0 0 var(--sp-4)' }}>Delete what is saved here? This cannot be undone.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
              <ActionButton
                style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}
                onClick={() => {
                  lib.update((s) => clearFeedback(s));
                  setConfirming(false);
                }}
              >
                Yes, delete them
              </ActionButton>
              <ActionButton tone="ghost" style={{ width: 'auto', paddingInline: 'var(--sp-6)' }} onClick={() => setConfirming(false)}>
                Keep them
              </ActionButton>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <ActionButton disabled={lib.blocked} style={{ width: 'auto', paddingInline: 'var(--sp-6)' }} onClick={() => setConfirming(true)}>
              Delete my answers
            </ActionButton>
          </div>
        ))}
    </section>
  );
}

/** Off, it returns before it touches the store. */
export function FeedbackPanelSlot() {
  if (!momentFeedbackOn()) return null;
  return <OnThisDevice />;
}

function OnThisDevice() {
  const accountId = useAccountId();
  return <FeedbackPanel storageKey={`${FEEDBACK_KEY}:${accountId || 'device'}`} />;
}
