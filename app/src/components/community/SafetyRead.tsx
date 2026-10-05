import { useState } from 'react';
import { readAuthorSafety } from '../../community/client';
import { SEVERITY_DELTA } from '../../community/safety-state';
import { Trouble } from '../Trouble';
import { REASON_MIN, ReasonHint } from './Escalation';

/**
 * A reviewer's look at one case author's private safety state.
 *
 * Closed until opened, and asked for with a written reason every time, because
 * the server writes each read into the case history. The number stays in this
 * card; it is not kept, and closing the case forgets it.
 */
export function SafetyRead({ caseId }: { caseId: string }) {
  const [reason, setReason] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <details>
      <summary>Author’s safety state</summary>
      <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        <p style={{ margin: 0, color: 'var(--app-dim)' }}>
          Starts at 100. Each decision in the last year that enforced something lowers it — P0 by{' '}
          {-SEVERITY_DELTA.P0}, P1 by {-SEVERITY_DELTA.P1}, P2 by {-SEVERITY_DELTA.P2} — and a granted appeal takes
          the deduction back. It is for your judgement on this case only.
        </p>
        {value === null ? (
          <>
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              Why you need it (kept in the case history)
              <input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <ReasonHint reason={reason} />
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || reason.trim().length < REASON_MIN}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void readAuthorSafety(caseId, reason.trim())
                    .then(setValue)
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not read it.'))
                    .finally(() => setBusy(false));
                }}
              >
                Read it
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0 }} role="status">
            <strong>{value} out of 100.</strong> This read is recorded in the case history with your reason.
          </p>
        )}
        {error && <Trouble said={error} />}
      </div>
    </details>
  );
}
