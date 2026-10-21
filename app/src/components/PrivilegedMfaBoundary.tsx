import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from '../lib/cloud';
import { privilegedMfaRequired, watchMfaSession } from '../lib/mfa-status';
import { Trouble } from './Trouble';
import { ActionButton } from './ui';

const MfaStep = lazy(() => import('./MfaStep').then((module) => ({ default: module.MfaStep })));

type Status = 'checking' | 'required' | 'ready' | 'error';
type BoundaryState = { subject: string | null; status: Status; error: string };

/**
 * Privileged grants are dormant at aal1 in the database. Put their elevation
 * path above the whole signed-in app so a capability-backed tool outside the
 * console never disappears without telling its operator how to continue.
 * Ordinary and signed-out use does not call the privileged status RPC.
 */
export function PrivilegedMfaBoundary({
  subject,
  children,
  signOutAccount = signOut,
}: {
  subject: string | null;
  children: ReactNode;
  signOutAccount?: () => Promise<void>;
}) {
  const [state, setState] = useState<BoundaryState>({ subject: null, status: 'ready', error: '' });
  const [departure, setDeparture] = useState({ subject: null as string | null, busy: false, error: '' });
  const request = useRef(0);

  const read = useCallback(async (preserveOnError = false) => {
    if (!subject) return;
    const version = ++request.current;
    try {
      const required = await privilegedMfaRequired();
      if (request.current === version) setState({ subject, status: required ? 'required' : 'ready', error: '' });
    } catch (e) {
      if (request.current === version) {
        setState((current) => (
          preserveOnError && current.subject === subject && current.status !== 'checking'
            ? current
            : { subject, status: 'error', error: e instanceof Error ? e.message : 'Could not check whether this account needs a second factor.' }
        ));
      }
    }
  }, [subject]);

  useEffect(() => {
    // The external Auth/database status is account-backed, not render-derived.
    // oxlint-disable-next-line react/set-state-in-effect
    void read();
    let live = true;
    let stopAuth = () => {};
    void watchMfaSession(() => void read(true)).then((stop) => {
      if (live) stopAuth = stop;
      else stop();
    }).catch(() => {
      // A device-only build has no Auth client to subscribe to. The initial
      // status read owns the user-facing error, while a later focus still
      // provides recovery if the account service becomes available.
    });
    const recheck = () => void read(true);
    window.addEventListener('focus', recheck);
    return () => {
      live = false;
      request.current += 1;
      stopAuth();
      window.removeEventListener('focus', recheck);
    };
  }, [read]);

  const retry = () => {
    setState({ subject, status: 'checking', error: '' });
    void read();
  };

  const leave = async () => {
    setDeparture({ subject, busy: true, error: '' });
    try {
      await signOutAccount();
    } catch (e) {
      setDeparture({
        subject,
        busy: false,
        error: e instanceof Error ? e.message : 'Could not sign out of this account.',
      });
    }
  };

  if (!subject) return <>{children}</>;
  const leaving = departure.subject === subject && departure.busy;
  const leaveError = departure.subject === subject ? departure.error : '';
  const status: Status = state.subject === subject ? state.status : 'checking';
  if (status === 'ready') return <>{children}</>;
  if (status === 'checking') {
    return (
      <>
        <p role="status" style={{ maxWidth: 560, margin: 'var(--sp-3) auto', paddingInline: 'var(--sp-4)', color: 'var(--app-dim)' }}>
          Checking privileged access…
        </p>
        {children}
      </>
    );
  }
  if (status === 'error') {
    return (
      <>
        <aside style={{ maxWidth: 560, marginInline: 'auto', padding: 'var(--sp-4)' }}>
          <Trouble said={`${state.error} Privileged tools remain server-blocked, but the ordinary offline-first app stays available.`} onRetry={retry} label="Try the access check again" />
        </aside>
        {children}
      </>
    );
  }

  return (
    <div role="main" data-semester-root style={{ maxWidth: 560, marginInline: 'auto', padding: 'var(--sp-6)', display: 'grid', gap: 'var(--sp-4)' }}>
      <h2 style={{ margin: 0 }}>Verify this privileged session</h2>
      {status === 'required' && (
        <Suspense fallback={<p role="status">Loading second-factor options…</p>}>
          <MfaStep
            reason="This account holds a privileged platform role. Verify a second factor before Semester opens capability-backed tools."
            onVerified={retry}
          />
        </Suspense>
      )}
      <ActionButton tone="secondary" disabled={leaving} onClick={() => void leave()}>
        {leaving ? 'Signing out…' : 'Sign out and use another account'}
      </ActionButton>
      {leaveError && <Trouble said={leaveError} />}
    </div>
  );
}
