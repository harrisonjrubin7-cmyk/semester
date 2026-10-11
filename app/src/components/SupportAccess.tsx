import { useCallback, useEffect, useRef, useState } from 'react';
import { record, yours } from '../lib/journal';
import type { Account } from '../lib/cloud';
import {
  createSupportAccess,
  loadSupportAccess,
  readSupportSignals,
  revokeSupportAccess,
  type SupportSignal,
  type SupportTicketChoice,
  type SupportWindow,
  type SupporterChoice,
} from '../lib/support-access';
import { ActionButton, Notice, SectionLabel } from './ui';
import { dateFormatter } from '../lib/locale';
import { ErrorState, PermissionNotice } from './unity/States';
import { ticketReference } from '../lib/supporttickets';
import { useNow } from '../state/store';

const date = (value: string) => dateFormatter({
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function SupportAccess({ account }: { account: Account | null }) {
  const now = useNow();
  const [supporters, setSupporters] = useState<SupporterChoice[]>([]);
  const [windows, setWindows] = useState<SupportWindow[]>([]);
  const [tickets, setTickets] = useState<SupportTicketChoice[]>([]);
  const [ticketLoadError, setTicketLoadError] = useState('');
  const [signals, setSignals] = useState<Record<string, SupportSignal[]>>({});
  const [supporterId, setSupporterId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  /** A failure to create, revoke or read. Loading has its own state below. */
  const [notice, setNotice] = useState('');
  /** Why the windows could not be loaded — a state with a way out, not a line. */
  const [loadError, setLoadError] = useState('');
  /** What the last grant or revoke changed, said as a permission change. */
  const [changed, setChanged] = useState<{ changed: string; why: string; control: boolean } | null>(null);
  const accountId = account?.id ?? null;
  const refreshRequest = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshRequest.current;
    if (!accountId) {
      setSupporters([]);
      setWindows([]);
      setTickets([]);
      setSignals({});
      setSupporterId('');
      setTicketId('');
      setTicketLoadError('');
      setNotice('');
      setLoadError('');
      setChanged(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const next = await loadSupportAccess();
      if (sequence !== refreshRequest.current) return;
      const nextTickets = next.tickets ?? [];
      setSupporters(next.supporters);
      setWindows(next.windows);
      setTickets(nextTickets);
      setTicketLoadError(next.ticketLoadError ?? '');
      setSupporterId((old) => next.supporters.some((supporter) => supporter.supporterId === old)
        ? old
        : next.supporters[0]?.supporterId ?? '');
      setTicketId((old) => nextTickets.some((ticket) => ticket.ticketId === old)
        ? old
        : nextTickets[0]?.ticketId ?? '');
      setNotice('');
      setLoadError('');
    } catch (error) {
      if (sequence !== refreshRequest.current) return;
      setChanged(null);
      setLoadError(error instanceof Error ? error.message : 'Could not load support access.');
    } finally {
      if (sequence === refreshRequest.current) setBusy(false);
    }
  }, [accountId]);

  // This is an external account-backed resource, not render-derived state.
  // oxlint-disable react/set-state-in-effect
  useEffect(() => {
    void refresh();
    return () => { refreshRequest.current += 1; };
  }, [refresh]);
  // oxlint-enable react/set-state-in-effect

  const active = windows.filter((window) => (
    !window.revokedAt
    && window.consentState === 'active'
    && new Date(window.expiresAt) > now
  ));
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
          {loadError && (
            <ErrorState
              title="Could not load support access"
              body={loadError}
              recover={{ label: 'Try again', run: () => void refresh() }}
              busy={busy}
            />
          )}
          {notice && <Notice alert>{notice}</Notice>}
          {ticketLoadError && (
            <Notice alert>
              Your existing support windows are still shown, but support questions could not be loaded. Creating a new window is disabled until they are available.
            </Notice>
          )}
          {changed && (
            <PermissionNotice
              changed={changed.changed}
              why={changed.why}
              control={
                changed.control && active.length > 0
                  ? {
                      label: 'Go to active windows',
                      run: () => document.getElementById('support-access-active')?.scrollIntoView?.({ block: 'start' }),
                    }
                  : undefined
              }
            />
          )}
          {supporters.length > 0 && tickets.length > 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                void createSupportAccess(supporterId, reason, days, ticketId)
                  .then(async () => {
                    record(account?.id ?? null, { kind: 'support-granted', detail: `for ${days} ${days === 1 ? 'day' : 'days'}`, provenance: yours(`Semester support, ${days} ${days === 1 ? 'day' : 'days'}`) });
                    setReason('');
                    await refresh();
                    setNotice('');
                    setChanged({ changed: 'Support access created', why: 'You can revoke it at any time.', control: true });
                  })
                  .catch((error: unknown) => {
                    setChanged(null);
                    setNotice(error instanceof Error ? error.message : 'Could not create access.');
                  })
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
                Support question
                <select className="input" required value={ticketId} onChange={(event) => setTicketId(event.target.value)}>
                  {tickets.map((ticket) => (
                    <option key={ticket.ticketId} value={ticket.ticketId}>
                      {ticketReference(ticket.ticketId)} · {ticket.subject}
                    </option>
                  ))}
                </select>
              </label>
              <p style={{ color: 'var(--app-dim)', margin: 0 }}>
                This access applies only to the selected support question and the learning-progress scope.
              </p>
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
              <button className="btn btn-primary btn-block" disabled={busy || !supporterId || !ticketId || !reason.trim()}>
                {busy ? 'Working…' : 'Grant support access'}
              </button>
            </form>
          )}
          {!busy && !loadError && supporters.length > 0 && tickets.length === 0 && (
            <p role="status" style={{ color: 'var(--app-dim)' }}>
              Open a support question in Help before granting access. A support window must be tied to one active case.
            </p>
          )}
          {!busy && !loadError && supporters.length === 0 && windows.every((window) => window.side !== 'supporter') && (
            <p role="status" style={{ color: 'var(--app-dim)' }}>
              Your university has not provisioned a verified support recipient yet. No access can be granted.
            </p>
          )}

          {active.length > 0 && (
            <div id="support-access-active">
              <SectionLabel aside={`${active.length}`}>Active windows</SectionLabel>
            </div>
          )}
          {active.map((window) => (
            <article key={window.grantId} className="portal-panel" style={{ marginBlock: 'var(--sp-4)' }}>
              <strong>{window.counterpartLabel}</strong>
              <p>{window.reason}</p>
              <p style={{ color: 'var(--app-dim)' }}>
                {window.side === 'student' ? 'You granted access' : 'A student granted you access'} · expires {date(window.expiresAt)}
              </p>
              <p style={{ color: 'var(--app-dim)' }}>
                {window.ticketId ? `${ticketReference(window.ticketId)} · ` : 'Legacy general window · '}
                {(window.scopes ?? []).join(', ') || 'No scope'} · consent {window.consentState ?? 'unknown'}
              </p>
              {window.side === 'student' ? (
                <ActionButton
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void revokeSupportAccess(window.grantId)
                      .then(async () => {
                        record(account?.id ?? null, { kind: 'support-revoked', detail: '', provenance: yours('Nobody', 'Revoked') });
                        await refresh();
                        setNotice('');
                        setChanged({
                          changed: 'Support access revoked',
                          why: 'The supporter can no longer open this summary.',
                          control: false,
                        });
                      })
                      .catch((error: unknown) => {
                        setChanged(null);
                        setNotice(error instanceof Error ? error.message : 'Could not revoke access.');
                      })
                      .finally(() => setBusy(false));
                  }}
                >Revoke now</ActionButton>
              ) : window.ticketId ? (
                <Notice>Case-bound support summaries require fresh MFA. Open this case in the Operations Console to view its aggregate signals.</Notice>
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
