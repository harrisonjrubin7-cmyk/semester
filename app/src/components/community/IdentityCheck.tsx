import { useState } from 'react';
import { CATEGORY_TEXT } from './ReportSheet';
import { ReasonHint, REASON_MIN } from './Escalation';
import { JIT_HOURS } from '../../community/identity';
import {
  decideIdentity,
  requestIdentity,
  revealIdentity,
  type IdentityGrant,
  type RevealedIdentity,
} from '../../community/client';
import { Trouble } from '../Trouble';
import { formatDateTime } from '../../lib/locale';

const CATEGORY = Object.fromEntries(CATEGORY_TEXT);
const when = (iso: string) =>
  formatDateTime(new Date(iso), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** A grant that is this reviewer's, approved, and not yet run out. */
export function liveGrant(grants: IdentityGrant[], me: string, now: Date): IdentityGrant | undefined {
  return grants.find((g) => g.grantee === me && g.status === 'approved' && g.expiresAt !== null && new Date(g.expiresAt) > now);
}

/**
 * Who is behind an alias, for one case, just in time.
 *
 * Shown only on a case about a post made under an alias. The reviewer who
 * needs to know asks with a reason; somebody else decides; the one who asked
 * then looks, as often as they need, for JIT_HOURS — and the server writes
 * every look into the case history. This card never offers a button the
 * server would refuse: the asker is told to wait, and the decider cannot
 * look.
 */
export function IdentityCheck({
  caseId,
  grants,
  me,
  now,
  onDone,
}: {
  caseId: string;
  grants: IdentityGrant[];
  me: string;
  now: Date;
  onDone: (said: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState<RevealedIdentity | null>(null);

  const mine = grants.filter((g) => g.grantee === me);
  const live = liveGrant(grants, me, now);
  const waiting = mine.find((g) => g.status === 'requested');
  const theirs = grants.filter((g) => g.grantee !== me && g.status === 'requested');
  const last = mine[0];

  const act = (work: Promise<unknown>, said: string) => {
    setBusy(true);
    setError('');
    void work
      .then(() => onDone(said))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  return (
    <details>
      <summary>Who posted this (alias)</summary>
      <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        <p style={{ margin: 0, color: 'var(--app-dim)' }}>
          Only when the investigation needs it. You ask, another reviewer decides, and then you can look for{' '}
          {JIT_HOURS} hours. Every look is kept in the case history. You see the account’s handle and its other cases —
          never an email or a legal name.
        </p>

        {live ? (
          shown ? (
            <div role="status" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              <p style={{ margin: 0 }}>
                Posted by <strong>{shown.handle}</strong>.
              </p>
              <p style={{ margin: 0, color: 'var(--app-dim)' }}>
                Account reference {shown.vaultRef.slice(0, 12)}… — the same on every case about this account.
              </p>
              {shown.otherCases.length === 0 ? (
                <p style={{ margin: 0 }}>No other cases about this account.</p>
              ) : (
                <ul style={{ margin: 0 }}>
                  {shown.otherCases.map((o) => (
                    <li key={o.caseId}>
                      {o.severity} · {CATEGORY[o.category] ?? o.category} · {o.status}
                      {o.asAlias ? ' · under an alias' : ' · under their own name'}
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: 0, color: 'var(--app-dim)' }}>
                This look is recorded in the case history. Your grant runs out {when(shown.expiresAt)}.
              </p>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void revealIdentity(live.id)
                    .then(setShown)
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not show it.'))
                    .finally(() => setBusy(false));
                }}
              >
                Show who posted this
              </button>
              <p style={{ margin: 0, color: 'var(--app-dim)' }}>Approved for you until {when(live.expiresAt ?? "")}. Looking is recorded.</p>
            </div>
          )
        ) : waiting ? (
          <p style={{ margin: 0 }}>You asked {when(waiting.requestedAt)}. A different reviewer has to approve it.</p>
        ) : (
          <>
            {last?.status === 'refused' && (
              <p style={{ margin: 0 }}>Your last request was refused{last.decidedReason ? `: “${last.decidedReason}”` : '.'}</p>
            )}
            {last?.status === 'approved' && <p style={{ margin: 0 }}>Your last grant has run out.</p>}
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              Why the investigation needs to know
              <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <ReasonHint reason={reason} />
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || reason.trim().length < REASON_MIN}
                onClick={() => act(requestIdentity(caseId, reason.trim()), 'Asked. A different reviewer has to approve it.')}
              >
                Ask to see who posted this
              </button>
            </div>
          </>
        )}

        {theirs.map((g) => (
          <Decision key={g.id} grant={g} onDone={onDone} />
        ))}
        {error && <Trouble said={error} />}
      </div>
    </details>
  );
}

/** Somebody else's request, which this reviewer may decide. */
function Decision({ grant, onDone }: { grant: IdentityGrant; onDone: (said: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = (approve: boolean) => {
    setBusy(true);
    setError('');
    void decideIdentity(grant.id, approve, reason.trim())
      .then(() => onDone(approve ? `Approved for ${JIT_HOURS} hours, for that reviewer only.` : 'Refused.'))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The decision was not recorded.'))
      .finally(() => setBusy(false));
  };
  return (
    <div aria-label="A request to see who posted this" style={{ display: 'grid', gap: 'var(--sp-2)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--app-line)' }}>
      <p style={{ margin: 0 }}>
        Another reviewer asked {when(grant.requestedAt)}: “{grant.requestedReason}”
      </p>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Your reason
        <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <ReasonHint reason={reason} />
      <p style={{ margin: 0, color: 'var(--app-dim)' }}>Approving lets them look; it does not show you anything.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < REASON_MIN} onClick={() => decide(true)}>
          Approve
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy || reason.trim().length < REASON_MIN} onClick={() => decide(false)}>
          Refuse
        </button>
      </div>
      {error && <Trouble said={error} />}
    </div>
  );
}
