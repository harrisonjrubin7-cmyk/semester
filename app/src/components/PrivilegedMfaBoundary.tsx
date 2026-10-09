import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { privilegedMfaRequired } from '../lib/console/client';
import { MfaStep } from './MfaStep';
import { Trouble } from './Trouble';

type Status = 'checking' | 'required' | 'ready' | 'error';
type BoundaryState = { subject: string | null; status: Status; error: string };

/**
 * Privileged grants are dormant at aal1 in the database. Put their elevation
 * path above the whole signed-in app so a capability-backed tool outside the
 * console never disappears without telling its operator how to continue.
 * Ordinary and signed-out use does not call the privileged status RPC.
 */
export function PrivilegedMfaBoundary({ subject, children }: { subject: string | null; children: ReactNode }) {
  const [state, setState] = useState<BoundaryState>({ subject: null, status: 'ready', error: '' });
  const request = useRef(0);

  const read = useCallback(async () => {
    if (!subject) return;
    const version = ++request.current;
    try {
      const required = await privilegedMfaRequired();
      if (request.current === version) setState({ subject, status: required ? 'required' : 'ready', error: '' });
    } catch (e) {
      if (request.current === version) {
        setState({ subject, status: 'error', error: e instanceof Error ? e.message : 'Could not check whether this account needs a second factor.' });
      }
    }
  }, [subject]);

  useEffect(() => {
    // The external Auth/database status is account-backed, not render-derived.
    // oxlint-disable-next-line react/set-state-in-effect
    void read();
    return () => { request.current += 1; };
  }, [read]);

  const retry = () => {
    setState({ subject, status: 'checking', error: '' });
    void read();
  };

  if (!subject) return <>{children}</>;
  const status: Status = state.subject === subject ? state.status : 'checking';
  if (status === 'ready') return <>{children}</>;

  return (
    <div role="main" data-semester-root style={{ maxWidth: 560, marginInline: 'auto', padding: 'var(--sp-6)', display: 'grid', gap: 'var(--sp-4)' }}>
      <h2 style={{ margin: 0 }}>Verify this privileged session</h2>
      {status === 'checking' && <p role="status">Checking whether this account needs a second factor…</p>}
      {status === 'required' && (
        <MfaStep
          reason="This account holds a privileged platform role. Verify a second factor before Semester opens capability-backed tools."
          onVerified={retry}
        />
      )}
      {status === 'error' && <Trouble said={state.error} onRetry={retry} label="Try the access check again" />}
    </div>
  );
}
