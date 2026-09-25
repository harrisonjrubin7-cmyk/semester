import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../lib/cloud';
import {
  createSupportAccess,
  loadSupportAccess,
  readSupportSignals,
  revokeSupportAccess,
  type SupportSignal,
  type SupportWindow,
  type SupporterChoice,
} from '../lib/support-access';
import { ActionButton, Notice, SectionLabel } from './ui';

const date = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function SupportAccess({ account }: { account: Account | null }) {
  const [supporters, setSupporters] = useState<SupporterChoice[]>([]);
  const [windows, setWindows] = useState<SupportWindow[]>([]);
  const [signals, setSignals] = useState<Record<string, SupportSignal[]>>({});
  const [supporterId, setSupporterId] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!account) return;
    setBusy(true);
    try {
      const next = await loadSupportAccess();
      setSupporters(next.supporters);
      setWindows(next.windows);
      setSupporterId((old) => old || next.supporters[0]?.supporterId || '');
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load support access.');
    } finally {
      setBusy(false);
    }
  }, [account]);

  // This is an external account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const active = windows.filter((window) => !window.revokedAt && new Date(window.expiresAt) > new Date());
  const history = windows.filter((window) => !active.includes(window));

  return (
    <section aria-labelledby="support-access-heading" style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Academic support access</SectionLabel>
      <h2 id="support-access-heading" style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>
        You decide who can see a learning summary
      </h2>
      <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
        The default is no access. A window names one verified university supporter, lasts no more
        than seven days, and shows only course-level evidence counts, average score, mistake count
        and last observation time. It never exposes notes, source excerpts, recordings or mistake detail.
      </p>

      {!account ? (
        <Notice>Sign in with your university-linked Semester account to create or receive support access.</Notice>
      ) : (
        <>
          {notice && <Notice>{notice}</Notice>}
          {supporters.length > 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                void createSupportAccess(supporterId, reason, days)
                  .then(async () => {
                    setReason('');
                    await refresh();
                    setNotice('Support access created. You can revoke it at any time.');
                  })
                  .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not create access.'))
                  .finally(() => setBusy(false));
              }}
              style={{ display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-5)' }}
            >
              <label>
                Verified supporter
                <select className="input" value={supporterId} onChange={(event) => setSupporterId(event.target.value)}>
                  {supporters.map((supporter) => (
                    <option key={supporter.supporterId} value={supporter.supporterId}>{supporter.label}</option>
                  ))}
                </select>
              </label>
              <label>
                What help do you want?
                <textarea className="input" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label>
                Access window
                <select className="input" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'day' : 'days'}</option>)}
                </select>
              </label>
              <button className="btn btn-primary btn-block" disabled={busy || !supporterId || !reason.trim()}>
                {busy ? 'Working…' : 'Grant support access'}
              </button>
            </form>
          )}
          {!busy && supporters.length === 0 && windows.every((window) => window.side !== 'supporter') && (
            <p role="status" style={{ color: 'var(--app-dim)' }}>
              Your university has not provisioned a verified support recipient yet. No access can be granted.
            </p>
          )}

          {active.length > 0 && <SectionLabel aside={`${active.length}`}>Active windows</SectionLabel>}
          {active.map((window) => (
            <article key={window.grantId} className="portal-panel" style={{ marginBlock: 'var(--sp-4)' }}>
              <strong>{window.counterpartLabel}</strong>
              <p>{window.reason}</p>
              <p style={{ color: 'var(--app-dim)' }}>
                {window.side === 'student' ? 'You granted access' : 'A student granted you access'} · expires {date(window.expiresAt)}
              </p>
              {window.side === 'student' ? (
                <ActionButton
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void revokeSupportAccess(window.grantId)
                      .then(async () => {
                        await refresh();
                        setNotice('Support access revoked. The supporter can no longer open this summary.');
                      })
                      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not revoke access.'))
                      .finally(() => setBusy(false));
                  }}
                >Revoke now</ActionButton>
              ) : (
                <ActionButton
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void readSupportSignals(window.grantId)
                      .then((rows) => setSignals((old) => ({ ...old, [window.grantId]: rows })))
                      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not read signals.'))
                      .finally(() => setBusy(false));
                  }}
                >View aggregate signals</ActionButton>
              )}
              {signals[window.grantId] && (
                signals[window.grantId].length === 0 ? <p role="status">No learning evidence has been recorded yet.</p> : (
                  <ul aria-label={`Aggregate support signals for ${window.counterpartLabel}`}>
                    {signals[window.grantId].map((signal) => (
                      <li key={signal.courseId}>
                        <strong>{signal.courseId}</strong> · {signal.evidenceCount} evidence items · {signal.mistakeCount} mistakes · average {signal.averageScore == null ? 'not available' : `${Math.round(signal.averageScore * 100)}%`}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </article>
          ))}

          {history.length > 0 && (
            <details style={{ marginTop: 'var(--sp-5)' }}>
              <summary>Expired and revoked windows · {history.length}</summary>
              {history.map((window) => (
                <p key={window.grantId}>{window.counterpartLabel} · {window.revokedAt ? 'Revoked' : 'Expired'} · {date(window.expiresAt)}</p>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
