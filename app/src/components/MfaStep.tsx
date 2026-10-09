import { useEffect, useState } from 'react';
import { ActionButton } from './ui';
import { Trouble } from './Trouble';
import { challengeMfa, enrollTotp, mfaFactors, verifyMfa, type MfaFactor, type TotpEnrolment } from '../lib/console/client';

/**
 * The second factor a privileged action asks for.
 *
 * The console shows this in front of a decision, an action or a break-glass
 * request whenever the session is not at `aal2` — and the database asks again
 * on its own (`private.assert_fresh_mfa`), so passing here is what lets the
 * call *through*, not what authorizes it. An operator with no authenticator
 * yet enrols one here: the QR code and the secret come from the auth service,
 * and the first code verifies the factor and raises the session in one step.
 * An operator who has a verified TOTP or phone factor is challenged for its
 * code. WebAuthn is not offered by this flow and is not treated as a fresh
 * code-factor verification by `mfaLevel`.
 *
 * Nothing about the factor is kept in this component past its verification,
 * and nothing is written to browser storage.
 */
export function MfaStep({
  onVerified,
  onCancel,
  reason = 'A privileged action needs a second factor verified in this session.',
}: {
  onVerified: () => void;
  onCancel?: () => void;
  reason?: string;
}) {
  const [stage, setStage] = useState<'loading' | 'enrol' | 'challenge'>('loading');
  const [factorId, setFactorId] = useState('');
  const [factorType, setFactorType] = useState<MfaFactor['type']>('totp');
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const factors = await mfaFactors();
        if (!live) return;
        if (factors.length > 0) {
          setFactorId(factors[0].id);
          setFactorType(factors[0].type);
          setStage('challenge');
          return;
        }
        const started = await enrollTotp();
        if (!live) return;
        setEnrolment(started);
        setFactorId(started.factorId);
        setFactorType('totp');
        setStage('enrol');
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not start the second factor.');
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  const retryStart = () => {
    setError('');
    setCode('');
    setFactorId('');
    setEnrolment(null);
    setStage('loading');
    setAttempt((n) => n + 1);
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const challengeId = await challengeMfa(factorId);
      await verifyMfa(factorId, challengeId, code);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Second factor" className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <p style={{ marginBlock: 0 }}>
        <strong>{reason}</strong>
      </p>
      {stage === 'loading' && !error && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Checking your authenticators…</p>}
      {stage === 'enrol' && enrolment && (
        <>
          <p style={{ marginBlock: 0 }}>
            No authenticator is enrolled for this account yet. Scan the code with an authenticator app, or enter the secret by hand, then type the six-digit code it shows.
          </p>
          <img src={enrolment.qrCode} alt="QR code to scan into an authenticator app" width={160} height={160} />
          <p style={{ marginBlock: 0 }}>
            Secret: <code>{enrolment.secret}</code>
          </p>
        </>
      )}
      {stage === 'challenge' && (
        <p style={{ marginBlock: 0 }}>
          {factorType === 'phone' ? 'Type the verification code sent to your phone.' : 'Type the six-digit code from your authenticator app.'}
        </p>
      )}
      {stage !== 'loading' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          style={{ display: 'grid', gap: 'var(--sp-3)' }}
        >
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {factorType === 'phone' ? 'Code sent to your phone' : 'Code from your authenticator'}
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.replace(/\s+/g, '').length < 6} style={{ flex: 1 }}>
              {stage === 'enrol' ? 'Enrol and verify' : 'Verify'}
            </button>
            {onCancel && (
              <ActionButton tone="secondary" onClick={onCancel} style={{ flex: 1 }}>
                Cancel
              </ActionButton>
            )}
          </div>
        </form>
      )}
      {error && stage === 'loading' && <Trouble said={error} onRetry={retryStart} label="Try MFA setup again" />}
      {error && stage !== 'loading' && <Trouble said={error} />}
    </section>
  );
}
