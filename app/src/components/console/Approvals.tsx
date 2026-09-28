import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  act as runAction,
  decideApproval,
  loadApprovals,
  loadDuties,
  requestApproval,
  type ApprovalRequest,
  type DutyRow,
} from '../../lib/console/client';
import { PARTY_MEANING } from '../../lib/ops/console';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

/**
 * Approvals: ask, decide, act.
 *
 * The duty rows come from `public.console_duty`, which migration A seeds from
 * `DUTIES` in `lib/ops/console.ts` and a test holds equal. The server checks
 * that the requester holds the duty's requester party, that an approver holds
 * an approver party and is not the requester, and that two distinct approvers
 * have said yes where the duty is two-person. `console_act` is the fail-closed
 * write: its audit event is written first, and if that fails nothing happens.
 */

const STATUS_TEXT: Record<ApprovalRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved — ready to act',
  rejected: 'Rejected',
  executed: 'Executed',
  expired: 'Expired',
};

function partySaid(party: string): string {
  if (party === 'student') return `student — ${PARTY_MEANING.student}`;
  if (party.startsWith('role:')) return `${party.slice(5)} role`;
  return `${party} seat`;
}

const EMPTY = { dutyId: '', tenantId: '', target: '', detail: '{}', evidence: '', ticket: '', correlation: '' };

export function Approvals({ env, scope, filter, onStatus, privileged }: ViewProps) {
  const [duties, setDuties] = useState<DutyRow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([loadDuties(), loadApprovals()]);
      setDuties(d);
      setRequests(r);
    } catch (e) {
      setRequests([]);
      onStatus(said(e, 'Could not load the approvals.'));
    }
  }, [onStatus]);

  // Account-backed data, loaded when the view opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const duty = duties.find((d) => d.id === form.dutyId);
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    let detail: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(form.detail || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Detail must be a JSON object.');
      detail = parsed as Record<string, unknown>;
    } catch (e) {
      onStatus(said(e, 'Detail must be a JSON object.'));
      return;
    }
    setBusy(true);
    try {
      const id = await requestApproval({
        dutyId: form.dutyId,
        tenantId: form.tenantId.trim() || null,
        target: form.target.trim() || null,
        detail,
        evidence: form.evidence.trim(),
        ticket: form.ticket.trim(),
        correlationId: form.correlation.trim() || null,
      });
      onStatus(`Request ${id} recorded; its audit event was written first.`);
      setForm(EMPTY);
      await refresh();
    } catch (e) {
      onStatus(said(e, 'The request was not recorded.'));
    } finally {
      setBusy(false);
    }
  };

  const decide = (r: ApprovalRequest, decision: 'approve' | 'reject') =>
    privileged(async () => {
      const status = await decideApproval(r.id, decision);
      onStatus(`Decision recorded: the request is now ${status}.`);
      await refresh();
    });

  const act = (r: ApprovalRequest) =>
    privileged(async () => {
      const acted = await runAction(r.id, r.correlationId);
      onStatus(`The action ran, after its audit event${acted.auditSeq === null ? '' : ` #${acted.auditSeq}`} was written; the request is ${acted.status || 'executed'}.`);
      await refresh();
    });

  const shown = (requests ?? []).filter((r) => inScope(scope, r.tenantId) && matches(filter, r.dutyId, r.ticket, r.target, r.tenantId, r.status));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <SectionLabel>Ask for an approval</SectionLabel>
      <form
        aria-label="Approval request"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'grid', gap: 'var(--sp-3)' }}
      >
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Duty
          <select className="input" required value={form.dutyId} onChange={(e) => set('dutyId')(e.target.value)}>
            <option value="">Choose the high-risk action</option>
            {duties.map((d) => (
              <option key={d.id} value={d.id}>
                {d.action}
              </option>
            ))}
          </select>
        </label>
        {duty && (
          <Fields
            label="What this duty needs"
            items={[
              { field: 'Requester', value: partySaid(duty.requester) },
              { field: duty.twoPerson ? 'Approvers — two distinct, neither the requester' : 'Approver — any one of', value: duty.approvers.map(partySaid).join(' · ') },
              { field: 'Evidence required', value: duty.evidence },
            ]}
          />
        )}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Tenant (school id, or blank for the platform)
          <input className="input" value={form.tenantId} onChange={(e) => set('tenantId')(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Target (the person, connector or object)
          <input className="input" value={form.target} onChange={(e) => set('target')(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Detail (JSON the action will run from)
          <textarea className="input" rows={3} value={form.detail} onChange={(e) => set('detail')(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Evidence attached
          <textarea className="input" rows={3} required value={form.evidence} onChange={(e) => set('evidence')(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Ticket
          <input className="input" required minLength={3} maxLength={80} value={form.ticket} onChange={(e) => set('ticket')(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Correlation id (optional)
          <input className="input" value={form.correlation} onChange={(e) => set('correlation')(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !form.dutyId || form.evidence.trim().length === 0 || form.ticket.trim().length < 3}>
          Record the request
        </button>
        <WriteNotice env={env} />
      </form>

      <SectionLabel aside={`${shown.length}`}>Requests</SectionLabel>
      {requests === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Loading requests…</p>}
      {requests !== null && shown.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No requests in this scope.</p>}
      {shown.map((r) => {
        const d = duties.find((x) => x.id === r.dutyId);
        return (
          <article key={r.id} className="portal-panel" aria-label={`Request ${r.ticket}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
            <strong>{d?.action ?? r.dutyId}</strong>
            <Fields
              label={`Request ${r.ticket} details`}
              items={[
                { field: 'Status', value: STATUS_TEXT[r.status] },
                { field: 'Ticket', value: r.ticket },
                { field: 'Tenant', value: r.tenantId ? `${r.tenantId}${r.tenantName ? ` — ${r.tenantName}` : ''}${r.isDemo ? ' (demo)' : ''}` : 'Platform' },
                { field: 'Target', value: r.target ?? 'none' },
                { field: 'Evidence', value: r.evidence },
                { field: 'Evidence required', value: d?.evidence ?? 'Unknown duty' },
                { field: 'Requester', value: r.mine ? `${r.requester} (you)` : r.requester },
                { field: 'Requested', value: when(r.createdAt) },
                { field: 'Expires', value: when(r.expiresAt) },
                { field: 'Correlation', value: r.correlationId ?? 'none' },
                {
                  field: 'Decisions',
                  value: `${r.approvals} approved of ${d?.twoPerson ? 2 : 1} needed · ${r.rejections} rejected${r.decidedByMe ? ' · you have decided' : ''}`,
                },
              ]}
            />
            {r.status === 'pending' && r.canDecide && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
                <button type="button" className="btn btn-primary" onClick={() => decide(r, 'approve')}>
                  Approve
                </button>
                <button type="button" className="btn" onClick={() => decide(r, 'reject')}>
                  Reject
                </button>
              </div>
            )}
            {r.status === 'pending' && !r.canDecide && (
              <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
                {r.mine ? 'Yours to ask, not to decide: self-approval is refused.' : r.decidedByMe ? 'You have already decided this one.' : 'Not yours to decide: you hold none of this duty’s approver parties, or the request has expired.'}
              </p>
            )}
            {r.status === 'approved' && (r.mine || r.decidedByMe) && (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => act(r)}>
                  Act on this request
                </button>
              </div>
            )}
            {r.status === 'approved' && !(r.mine || r.decidedByMe) && (
              <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
                Not yours to act on: only the requester, or an approver who decided it, may.
              </p>
            )}
            {(r.status === 'pending' || r.status === 'approved') && <WriteNotice env={env} />}
          </article>
        );
      })}
      <Notice>
        Self-approval is refused by the server, a two-person duty needs two distinct approvers, and every decision and action asks for a second factor verified in the last fifteen minutes.
      </Notice>
    </div>
  );
}
