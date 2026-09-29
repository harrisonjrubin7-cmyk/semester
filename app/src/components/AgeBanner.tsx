import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { currentSession, myAgeStatus, onAuthChange, type AgeStatus } from '../lib/cloud';

/**
 * One line under the header, on every screen, while a signed-in account has
 * not said its age.
 *
 * Accounts made through Google, Microsoft, Apple, institution SSO or LTI never
 * saw the sign-up form's date of birth, and neither did accounts made before
 * it was asked. The owner chose to ask, then gate (D-139): until the account
 * answers, the database keeps it out of everything that involves other people,
 * so this says why and takes it to Account, where `AgeStatement` asks once.
 * Account already asks, so the line is not drawn there.
 *
 * The two reads are props so the test can hand it fakes.
 */
// At module scope, so the effect below sees the same functions every render.
const hasSession = async () => (await currentSession()) !== null;

export function AgeBanner({
  signedIn = hasSession,
  status = myAgeStatus,
  watch = onAuthChange,
}: {
  signedIn?: () => Promise<boolean>;
  status?: () => Promise<AgeStatus>;
  watch?: (fn: () => void) => () => void;
} = {}) {
  const { state, dispatch } = useStore();
  const [unknown, setUnknown] = useState(false);
  const onAccount = state.screen === 'account';

  useEffect(() => {
    let live = true;
    const read = () => {
      signedIn()
        .then((yes) => (yes ? status() : null))
        .then((s) => live && setUnknown(s === 'unknown'))
        // A read that fails asks nothing rather than a question it cannot record.
        .catch(() => live && setUnknown(false));
    };
    read();
    const stop = watch(read);
    return () => {
      live = false;
      stop();
    };
    // Read again on leaving Account, so an answer given there clears the line.
  }, [signedIn, status, watch, onAccount]);

  if (!unknown || onAccount) return null;
  return (
    <div role="status" data-age-banner className="sync-strip">
      <span className="sync-strip-text">
        <strong>Your date of birth.</strong> Classmates, community and mentoring stay off until this account says it. It
        is asked once and the date is not kept.
      </span>
      <button type="button" className="bare tappable sync-strip-btn" onClick={() => dispatch({ type: 'go', screen: 'account' })}>
        Add it
      </button>
    </div>
  );
}
