import { useCallback, useEffect, useId, useState } from 'react';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import type { Account } from '../lib/cloud';
import {
  FEEDBACK_KINDS,
  FEEDBACK_LABELS,
  cohortLabel,
  joinBeta,
  leaveBeta,
  loadBeta,
  sendBetaFeedback,
  type BetaInvitation,
  type BetaMembership,
  type FeedbackKind,
  type KnownIssue,
} from '../lib/beta';
import { ActionButton, Notice, SectionLabel } from './ui';

/**
 * The invite-only private beta, as its member sees it.
 *
 * It draws nothing for an account with no invitation and no membership. A
 * beta nobody was invited to is not advertised, and "you are not in a beta"
 * is noise on a help screen. The rules a member is agreeing to are stated
 * before they join, in the words `docs/PRIVATE-BETA-PROGRAM.md` uses: invite
 * only, nothing official sent, feedback read without their name, leave any
 * time.
 */
export function BetaPanel({
  account,
  offerInvitations = EXPERIENCE_FLAGS.privateBeta !== 'off',
}: {
  account: Account | null;
  /**
   * Whether an invitation is offered. `VITE_PRIVATE_BETA` off is the
   * documented rollback, and it stops new people joining — it does not take
   * away a member's export and way out, which they were promised before they
   * joined. So the panel always mounts, and this is all the flag decides.
   */
  offerInvitations?: boolean;
}) {
  // Everything below belongs to one account. Keyed by it, a change of account
  // under a mounted Help screen starts from nothing, and an answer still in
  // flight for the old account lands on a panel that no longer exists.
  return account ? <AccountBeta key={account.id} offerInvitations={offerInvitations} /> : null;
}

function AccountBeta({ offerInvitations }: { offerInvitations: boolean }) {
  const [invitation, setInvitation] = useState<BetaInvitation | null>(null);
  const [membership, setMembership] = useState<BetaMembership | null>(null);
  const [issues, setIssues] = useState<KnownIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [body, setBody] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [reason, setReason] = useState('');
  const [keepAccount, setKeepAccount] = useState(true);
  const [left, setLeft] = useState<null | { keptAccount: boolean }>(null);
  const heading = useId();

  const refresh = useCallback(async () => {
    try {
      const next = await loadBeta();
      setInvitation(next.invitation);
      setMembership(next.membership);
      setIssues(next.issues);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load the beta.');
    }
  }, []);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const run = (work: () => Promise<void>, done: string) => {
    setBusy(true);
    void work()
      .then(async () => {
        await refresh();
        setNotice(done);
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  if (left) {
    return (
      <section aria-labelledby={heading} style={{ marginBottom: 'var(--sp-7)' }}>
        <SectionLabel>Private beta</SectionLabel>
        <h2 id={heading} style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>You have left the beta</h2>
        <p style={{ color: 'var(--app-dim)' }}>
          Your semester is unchanged and stays on this device.
          {left.keptAccount
            ? ' Your account stays as it is.'
            : ' To delete your account as well, use Delete everything on the Privacy screen.'}
        </p>
        {!left.keptAccount && <a className="btn btn-secondary btn-block" href="#/privacy">Open Privacy</a>}
      </section>
    );
  }
  // With the flag off, only a member is shown anything: not an invitation,
  // and not a load error, which is what every account would see before the
  // migration is applied.
  const offered = offerInvitations ? invitation : null;
  if (!offered && !membership) return notice && offerInvitations ? <Notice>{notice}</Notice> : null;

  return (
    <section aria-labelledby={heading} style={{ marginBottom: 'var(--sp-7)' }}>
      <SectionLabel aside={membership ? cohortLabel(membership.cohortKind) : undefined}>Private beta</SectionLabel>
      {notice && <Notice>{notice}</Notice>}

      {!membership && offered && (
        <>
          <h2 id={heading} style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>
            You are invited to {offered.programName}
          </h2>
          <p style={{ color: 'var(--app-dim)' }}>As one of the {cohortLabel(offered.cohortKind).toLowerCase()}. If you join:</p>
          <ul style={{ lineHeight: 'var(--leading-relaxed-plus)' }}>
            <li>Some features may change or be switched off while the beta runs.</li>
            <li>Nothing official is sent anywhere. No registration, no grade, no form goes to your university.</li>
            <li>Beta feedback is read by Semester’s support staff without your name or address.</li>
            <li>You can leave at any time, and take your data with you first.</li>
          </ul>
          <p style={{ color: 'var(--app-dim)' }}>A person to contact: {offered.supportContact}</p>
          <ActionButton tone="primary" disabled={busy} onClick={() => run(() => joinBeta(offered.invitationId), 'You have joined the beta.')}>
            Join the beta
          </ActionButton>
        </>
      )}

      {membership && (
        <>
          <h2 id={heading} style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>{membership.programName}</h2>
          <p role="status" style={{ color: 'var(--app-dim)' }}>
            {membership.live
              ? 'The beta is running.'
              : 'The beta is paused. Everything you have stays; beta features may be off until it resumes.'}
            {' '}A person to contact: {membership.supportContact}
          </p>

          {membership.flags.length > 0 && (
            <details style={{ marginBlock: 'var(--sp-4)' }}>
              <summary>What this beta turns on · {membership.flags.length}</summary>
              <ul>{membership.flags.map((f) => <li key={f.key}>{f.about || f.key}</li>)}</ul>
            </details>
          )}

          <h3 style={{ fontSize: 'var(--type-lg)', marginTop: 'var(--sp-5)' }}>Known issues</h3>
          {issues.length === 0 ? (
            <p style={{ color: 'var(--app-dim)' }}>None published right now.</p>
          ) : (
            <ul aria-label="Known issues" style={{ paddingLeft: 0, listStyle: 'none' }}>
              {issues.map((issue) => (
                <li key={issue.id} className="portal-panel" style={{ marginBlock: 'var(--sp-3)' }}>
                  <strong>{issue.title}</strong>
                  {' · '}{issue.status === 'open' ? 'Open' : issue.status === 'fixed' ? 'Fixed' : 'Will not be fixed'}
                  {issue.detail && <p>{issue.detail}</p>}
                  {issue.workaround && <p><em>Until then:</em> {issue.workaround}</p>}
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ fontSize: 'var(--type-lg)', marginTop: 'var(--sp-5)' }}>Tell the beta team</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await sendBetaFeedback(kind, body);
                setBody('');
              }, 'Sent. Thank you.');
            }}
            style={{ display: 'grid', gap: 'var(--sp-4)' }}
          >
            <label>
              What kind of thing
              <select className="input" value={kind} onChange={(event) => setKind(event.target.value as FeedbackKind)}>
                {FEEDBACK_KINDS.map((k) => <option key={k} value={k}>{FEEDBACK_LABELS[k]}</option>)}
              </select>
            </label>
            <label>
              What happened
              <textarea className="input" required maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy || !body.trim()}>
              {busy ? 'Working…' : 'Send feedback'}
            </button>
          </form>

          <h3 style={{ fontSize: 'var(--type-lg)', marginTop: 'var(--sp-5)' }}>Leave the beta</h3>
          {!leaving ? (
            <ActionButton tone="ghost" disabled={busy} onClick={() => setLeaving(true)}>Leave the beta…</ActionButton>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                void leaveBeta(reason, keepAccount)
                  .then(() => setLeft({ keptAccount: keepAccount }))
                  .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not leave the beta.'))
                  .finally(() => setBusy(false));
              }}
              style={{ display: 'grid', gap: 'var(--sp-4)' }}
            >
              <p>
                Leaving takes effect at once. Your semester stays on this device.
                {' '}<a href="#/export">Take your data with you</a> first if you want a copy.
              </p>
              <label>
                Why, if you want to say (optional)
                <textarea className="input" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <fieldset style={{ border: 0, padding: 0 }}>
                <legend>Your account</legend>
                <label><input type="radio" name="keep" checked={keepAccount} onChange={() => setKeepAccount(true)} /> Keep my account</label>
                <label><input type="radio" name="keep" checked={!keepAccount} onChange={() => setKeepAccount(false)} /> I also want to delete my account</label>
              </fieldset>
              <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Working…' : 'Leave the beta now'}</button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setLeaving(false)}>Stay in the beta</button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
