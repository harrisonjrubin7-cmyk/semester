import { Suspense, lazy, useState } from 'react';
import {
  CLARITY_ANSWERS,
  CLARITY_PREFIX,
  CLARITY_TEXT,
  EMPTY_CLARITY,
  answer,
  notNow,
  readClarity,
  shouldAsk,
} from '../lib/clarity';
import { useDeviceLibrary } from '../lib/device-library';
import { useNow, useStore } from '../state/store';

/*
 * Loaded only when a student opens it. The feedback form reaches `lib/privacy`
 * and `lib/cloud`; imported eagerly it put both into Today's entry chunk
 * (+17.6 kB) for a panel most visits never open.
 */
const SaySomething = lazy(() => import('./SaySomething').then((m) => ({ default: m.SaySomething })));

/**
 * The pilot's one question, under the Action Center. Four buttons, keyboard
 * reachable, answer stored on this device. A "No" or "Somewhat" offers the
 * feedback form, which the student sees and sends themselves — nothing here
 * sends anything on its own.
 */
export function ClarityQuestion() {
  const { account } = useStore();
  const now = useNow().getTime();
  const library = useDeviceLibrary(`${CLARITY_PREFIX}:${account?.id || 'device'}`, readClarity, EMPTY_CLARITY);
  const [just, setJust] = useState<'yes' | 'somewhat' | 'no' | null>(null);

  if (just) {
    return (
      <div className="action-note" role="status">
        <p className="today-sync-status">Thank you. Your answer is saved on this device only.</p>
        {just !== 'yes' && (
          <details className="today-why">
            <summary>Tell us what was unclear</summary>
            <Suspense fallback={<p className="today-sync-status">Opening…</p>}>
        <SaySomething initialKind="confusing" />
      </Suspense>
          </details>
        )}
      </div>
    );
  }

  if (!shouldAsk(library.value, now)) return null;

  return (
    <fieldset className="clarity-question">
      <legend>Did this help you understand what to do next?</legend>
      <div className="today-action-tools">
        {CLARITY_ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            className="workspace-text-button"
            onClick={() => {
              if (library.update((s) => answer(s, a, now))) setJust(a);
            }}
          >
            {CLARITY_TEXT[a]}
          </button>
        ))}
        <button type="button" className="workspace-text-button" onClick={() => library.update((s) => notNow(s, now))}>
          Not now
        </button>
      </div>
    </fieldset>
  );
}
