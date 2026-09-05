import { useState } from 'react';
import { useStore } from '../state/store';
import { replaced, replacedLine } from '../lib/merge';

/**
 * "Your theme was replaced by settings from another device."
 *
 * Most of what a sync does is additive and needs no announcement: a note from
 * the laptop arrives, both devices have it, nothing was lost. The exception is
 * the handful of fields merged by `theirs` — the ground, the accent, the day
 * budget, your rules, the sleep floor. There the other device's value simply
 * wins, and the value that was here is gone with no trace of it anywhere.
 *
 * That is defensible for a setting. What is not defensible is the silence:
 * the person it happened to is the only one who cannot tell, because from
 * their side the app just looks different this morning.
 *
 * ## Quiet on a device that had nothing to lose
 *
 * A fresh install has defaults, and a first sync replacing a default with a
 * real choice is the sync working. So a field is only named here if what it
 * replaced was not the shipped default — otherwise every new device would
 * open on a banner about its own setup.
 *
 * ## Telling, not undoing
 *
 * There is no undo here, deliberately. Reversing a sync means pushing the old
 * value back up, which is another sync, which the other device would then see
 * as its own value being replaced. Saying what happened is the whole scope;
 * the settings themselves are two taps away.
 */
export function Replaced() {
  const { state, dispatch } = useStore();
  const [shut, setShut] = useState(false);

  // `replaced` already drops anything whose local value was the shipped
  // default — that comparison has to happen at merge time, because by the time
  // it reaches here the old value is gone. See `lib/merge.ts`.
  const notes = state.lastSync?.told ? [] : replaced(state.lastSync?.notes ?? []);

  if (shut || notes.length === 0) return null;
  const said = replacedLine(notes);
  if (!said) return null;

  return (
    <div
      role="status"
      style={{
        margin: '0 14px 10px',
        padding: '11px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {said}
      </span>
      <button
        type="button"
        className="bare tappable"
        aria-label="Dismiss"
        onClick={() => {
          setShut(true);
          dispatch({ type: 'forgetSyncNote' });
        }}
        style={{
          width: 'auto',
          flex: 'none',
          padding: '4px 8px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--app-line)',
          fontSize: 'calc(11px * var(--text-scale, 1))',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        Got it
      </button>
    </div>
  );
}
