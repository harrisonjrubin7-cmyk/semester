import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { closeBreakGlass, loadBreakGlass, reviewBreakGlass, type BreakGlassGrant } from '../../lib/console/client';
import { DUTIES } from '../../lib/ops/console';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

/**
 * Break-glass grants: opened only by `console_act` on the `break-glass` duty
 * (two seats approve, fresh MFA, a ticket, an expiry within four hours), so
 * this view opens nothing — it closes, and it reviews. A subject with an
 * unreviewed grant past its review date cannot have another approved.
 */
const DUTY = DUTIES.find((d) => d.id === 'break-glass');

function state(g: BreakGlassGrant): string {
  if (g.closedAt) return `Closed ${when(g.closedAt)}`;
  if (!g.active) return `Expired ${when(g.expiresAt)}`;
  return `Open until ${when(g.expiresAt)}`;
}

export function BreakGlass({ env, scope, filter, onStatus }: ViewProps) {
  const [grants, setGrants] = useState<BreakGlassGrant[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    try {
      setGrants(await loadBreakGlass());
    } catch (e) {
      setGrants([]);
      onStatus(said(e, 'Could not load the break-glass grants.'));
    }
  }, [onStatus]);

  // Account-backed data, loaded when the view opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (id: string, work: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await work();
      onStatus(done);
      await refresh();
    } catch (e) {
      onStatus(said(e, 'The change was not recorded.'));
    } finally {
      setBusy('');
    }
  };

  const shown = (grants ?? []).filter((g) => inScope(scope, g.tenantId) && matches(filter, g.tenantId, g.tenantName, g.ticket, g.scope, g.subject));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        {DUTY ? `${DUTY.action}: requested by the ${DUTY.requester} seat, approved by the ${DUTY.approvers.join(' and ')} seats. ${DUTY.note ?? ''}` : 'Break-glass is a duty of the approvals matrix.'}{' '}
        Ask for one under Approvals with the break-glass duty; it opens when the approved request is acted on.
      </Notice>
      <SectionLabel aside={`${shown.length}`}>Grants</SectionLabel>
      {grants === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Loading grants…</p>}
      {grants !== null && shown.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No break-glass grants in this scope.</p>}
      {shown.map((g) => {
        const open = g.active;
        return (
          <article key={g.id} className="portal-panel" aria-label={`Break-glass ${g.ticket}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
            <strong>
              {g.tenantName ?? g.tenantId} · {g.ticket}
              {g.isDemo ? ' (demo)' : ''}
            </strong>
            <Fields
              label={`Break-glass ${g.ticket} details`}
              items={[
                { field: 'State', value: state(g) },
                { field: 'Tenant', value: g.tenantId },
                { field: 'Subject', value: g.subject },
                { field: 'Scope', value: g.scope },
                { field: 'Opened', value: when(g.openedAt) },
                { field: 'Expires', value: when(g.expiresAt) },
                { field: 'Review due', value: `${when(g.reviewDue)}${g.reviewOverdue ? ' — OVERDUE: no new break-glass for this subject until reviewed' : ''}` },
                { field: 'Reviewed', value: g.reviewedAt ? `${when(g.reviewedAt)} by ${g.reviewedBy ?? 'unknown'} — ${g.reviewNote ?? ''}` : 'Not yet' },
              ]}
            />
            {open && (
              <div>
                <button type="button" className="btn" disabled={busy === g.id} onClick={() => void run(g.id, () => closeBreakGlass(g.id), 'The grant is closed.')}>
                  Close this grant now
                </button>
              </div>
            )}
            {!g.reviewedAt && (
              <form
                aria-label={`Review of ${g.ticket}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(g.id, () => reviewBreakGlass(g.id, (notes[g.id] ?? '').trim()), 'The review is recorded.');
                }}
                style={{ display: 'grid', gap: 'var(--sp-2)' }}
              >
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Post-use review — what was done, and whether it stayed inside the incident
                  <textarea className="input" rows={2} required value={notes[g.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [g.id]: e.target.value }))} />
                </label>
                <button type="submit" className="btn" disabled={busy === g.id || (notes[g.id] ?? '').trim().length === 0}>
                  Record the review
                </button>
              </form>
            )}
            {(open || !g.reviewedAt) && <WriteNotice env={env} />}
          </article>
        );
      })}
    </div>
  );
}
