import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import {
  act as runAction,
  decideApproval,
  loadApprovals,
  loadDuties,
  loadOwnApprovalDecision,
  requestApproval,
  type ApprovalDecisionReceipt,
  type ApprovalRequest,
  type DutyRow,
} from '../../lib/console/client';
import { useOnline } from '../../lib/offline-mode';
import { approvalDecisionAvailable, approvalReviewState } from '../../lib/console/approval-review';
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
  approved: 'Approved — required decisions recorded',
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

type Decision = 'approve' | 'reject';

function storedDetail(detail: ApprovalRequest['detail']): ReactNode {
  return (
    <pre style={{ marginBlock: 0, maxWidth: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {JSON.stringify(detail, null, 2)}
    </pre>
  );
}

function decisionSummary(request: ApprovalRequest, duty: DutyRow | undefined): string {
  return `${request.approvals} approved of ${duty?.twoPerson ? 2 : 1} needed · ${request.rejections} rejected${request.decidedByMe ? ' · you have decided' : ''}`;
}

function reviewStateText(request: ApprovalRequest, duty: DutyRow | undefined, receipt: ApprovalDecisionReceipt | null, returnedStatus: ApprovalRequest['status'] | null): string | null {
  if (receipt?.decision === 'reject' || returnedStatus === 'rejected' || request.status === 'rejected') {
    return 'Rejected — the rejection is recorded. The requested change has not been executed.';
  }
  if (returnedStatus === 'approved' || request.status === 'approved') {
    return 'Approved — required decisions recorded. The requested change has not been executed.';
  }
  if (receipt?.decision === 'approve' && duty?.twoPerson) {
    return 'Your approval is recorded. Waiting for a second person’s decision.';
  }
  const state = approvalReviewState(request, duty);
  if (state === 'waiting-for-second-person') return 'Waiting for a second person’s decision.';
  if (state === 'executed') return 'The request is marked executed by the server.';
  if (state === 'expired') return 'This request has expired.';
  return null;
}

export function Approvals({
  env,
  scope,
  filter,
  onStatus,
  privileged,
  reviewRequestId = null,
  onExitReview,
  onReviewFound,
  readDuties = loadDuties,
  readRequests = loadApprovals,
  recordDecision = decideApproval,
  readReceipt = loadOwnApprovalDecision,
  onQueueRefresh,
}: ViewProps & {
  reviewRequestId?: string | null;
  onExitReview?: () => void;
  onReviewFound?: (request: ApprovalRequest) => void;
  readDuties?: () => Promise<DutyRow[]>;
  readRequests?: () => Promise<ApprovalRequest[]>;
  recordDecision?: (requestId: string, decision: Decision) => Promise<ApprovalRequest['status']>;
  readReceipt?: (requestId: string) => Promise<ApprovalDecisionReceipt>;
  onQueueRefresh?: () => void;
}) {
  const [duties, setDuties] = useState<DutyRow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ request: ApprovalRequest; decision: Decision } | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [attemptedRequestId, setAttemptedRequestId] = useState<string | null>(null);
  const [uncertainRequestId, setUncertainRequestId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApprovalDecisionReceipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [returnedStatus, setReturnedStatus] = useState<ApprovalRequest['status'] | null>(null);
  const reviewTarget = useRef<HTMLElement>(null);
  const requestListTarget = useRef<HTMLDivElement>(null);
  const previousReviewId = useRef(reviewRequestId);
  const loadGeneration = useRef(0);
  const decisionGeneration = useRef(0);
  const decisionClaimed = useRef<string | null>(null);
  const receiptReadFor = useRef<string | null>(null);
  const reviewIdRef = useRef(reviewRequestId);
  const online = useOnline();
  const onlineRef = useRef(online);
  useEffect(() => { onlineRef.current = online; }, [online]);
  const decisionIsCurrent = (generation: number, requestId: string) =>
    generation === decisionGeneration.current
    && (reviewIdRef.current === null || reviewIdRef.current === requestId);

  const refresh = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const [d, r] = await Promise.all([readDuties(), readRequests()]);
      if (generation !== loadGeneration.current) return null;
      setReadError(null);
      setDuties(d);
      setRequests(r);
      return r;
    } catch (e) {
      if (generation !== loadGeneration.current) return null;
      const message = said(e, 'Could not load the approvals.');
      setReadError(message);
      setDuties([]);
      setRequests([]);
      onStatus(message);
      return null;
    }
  }, [onStatus, readDuties, readRequests]);

  // Account-backed data, loaded when the view opens.
  useEffect(() => {
    // Account-backed I/O starts only after mount; the callback owns its loading states.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    return () => { loadGeneration.current += 1; };
  }, [refresh]);

  useEffect(() => {
    reviewIdRef.current = reviewRequestId;
    decisionGeneration.current += 1;
    // A new exact target cannot inherit a prior target's decision or receipt state.
    // oxlint-disable-next-line react/set-state-in-effect
    setAsking(null);
    setDecisionBusy(false);
    setAttemptedRequestId(null);
    setUncertainRequestId(null);
    setReceipt(null);
    setReceiptError(null);
    setReturnedStatus(null);
    decisionClaimed.current = null;
    receiptReadFor.current = null;
    return () => { decisionGeneration.current += 1; };
  }, [reviewRequestId]);

  useEffect(() => {
    if (previousReviewId.current && !reviewRequestId) requestListTarget.current?.focus();
    previousReviewId.current = reviewRequestId;
  }, [reviewRequestId]);

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

  const decide = (r: ApprovalRequest, decision: Decision) => {
    if (!online || decisionBusy || attemptedRequestId === r.id || !approvalDecisionAvailable(r)) return;
    setAsking({ request: r, decision });
  };

  const runDecision = (r: ApprovalRequest, decision: Decision) => {
    if (!online) {
      setAsking(null);
      onStatus('Decision unavailable while offline. Nothing was written or queued.');
      return;
    }
    if (decisionClaimed.current === r.id) return;
    decisionClaimed.current = r.id;
    const generation = decisionGeneration.current;
    setAsking(null);
    setDecisionBusy(true);
    setAttemptedRequestId(r.id);
    privileged(async () => {
      // A queued MFA callback is allowed to write only for the still-mounted,
      // still-selected review target that opened it.
      if (!decisionIsCurrent(generation, r.id)) return;
      if (!onlineRef.current) {
        decisionClaimed.current = null;
        setAttemptedRequestId(null);
        setDecisionBusy(false);
        onStatus('Decision unavailable while offline. Nothing was written or queued.');
        return;
      }
      try {
        const nextStatus = await recordDecision(r.id, decision);
        if (!decisionIsCurrent(generation, r.id)) return;
        setReturnedStatus(nextStatus);
        try {
          const ownReceipt = await readReceipt(r.id);
          if (!decisionIsCurrent(generation, r.id)) return;
          setReceipt(ownReceipt);
          setReceiptError(null);
          setUncertainRequestId(null);
          onStatus(`Decision recorded: the request is now ${nextStatus}. The immutable caller receipt was read from the server.`);
        } catch (e) {
          if (!decisionIsCurrent(generation, r.id)) return;
          const message = said(e, 'The decision returned a status, but its caller receipt is unavailable. Check decision status.');
          setReceiptError(message);
          onStatus(message);
        }
        await refresh();
        if (!decisionIsCurrent(generation, r.id)) return;
        onQueueRefresh?.();
      } catch (e) {
        if (!decisionIsCurrent(generation, r.id)) return;
        setUncertainRequestId(r.id);
        setReturnedStatus(null);
        onStatus(`${said(e, 'The decision request failed.')} The decision result is uncertain. Check decision status before doing anything else.`);
      } finally {
        if (decisionIsCurrent(generation, r.id)) setDecisionBusy(false);
      }
    }, () => {
      if (!decisionIsCurrent(generation, r.id)) return;
      decisionClaimed.current = null;
      setAttemptedRequestId(null);
      setDecisionBusy(false);
    });
  };

  const reconcile = async (r: ApprovalRequest) => {
    if (decisionBusy || !online) return;
    const generation = decisionGeneration.current;
    setDecisionBusy(true);
    try {
      const ownReceipt = await readReceipt(r.id);
      if (!decisionIsCurrent(generation, r.id)) return;
      const rows = await refresh();
      if (!decisionIsCurrent(generation, r.id)) return;
      const current = rows?.find((row) => row.id === r.id);
      if (!current) throw new Error('The exact approval is unavailable in the refreshed authorized result. No status was inferred.');
      setReceipt(ownReceipt);
      setReceiptError(null);
      setUncertainRequestId(null);
      setReturnedStatus(current.status);
      onStatus('Decision status reconciled from the caller receipt and current request.');
      onQueueRefresh?.();
    } catch (e) {
      if (!decisionIsCurrent(generation, r.id)) return;
      setUncertainRequestId(r.id);
      onStatus(said(e, 'Decision status is still unavailable. Try the status check again.'));
    } finally {
      if (decisionIsCurrent(generation, r.id)) setDecisionBusy(false);
    }
  };

  const act = (r: ApprovalRequest) =>
    privileged(async () => {
      const acted = await runAction(r.id, r.correlationId);
      onStatus(`The action ran, after its audit event${acted.auditSeq === null ? '' : ` #${acted.auditSeq}`} was written; the request is ${acted.status || 'executed'}.`);
      await refresh();
    });

  const reviewRequest = requests?.find((request) => request.id === reviewRequestId);
  useEffect(() => {
    if (!reviewRequest) return;
    onReviewFound?.(reviewRequest);
    reviewTarget.current?.focus();
  }, [onReviewFound, reviewRequest]);

  useEffect(() => {
    if (!reviewRequestId
        || !reviewRequest?.decidedByMe
        || receipt
        || receiptReadFor.current === reviewRequest.id) return;
    const generation = decisionGeneration.current;
    receiptReadFor.current = reviewRequest.id;
    readReceipt(reviewRequest.id).then(
      (ownReceipt) => {
        if (!decisionIsCurrent(generation, reviewRequest.id)) return;
        setReceipt(ownReceipt);
        setReceiptError(null);
      },
      (e: unknown) => {
        if (!decisionIsCurrent(generation, reviewRequest.id)) return;
        const message = said(e, 'The decision receipt is unavailable. Check decision status.');
        setReceiptError(message);
        onStatus(message);
      },
    );
  }, [onStatus, readReceipt, receipt, reviewRequest, reviewRequestId]);

  const shown = reviewRequestId
    ? (reviewRequest ? [reviewRequest] : [])
    : (requests ?? []).filter((r) => inScope(scope, r.tenantId) && matches(filter, r.dutyId, r.ticket, r.target, r.tenantId, r.status));

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

      {reviewRequestId ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>Approval review</SectionLabel>
          {onExitReview ? <button type="button" className="btn" onClick={onExitReview}>Back to all approvals</button> : null}
        </div>
      ) : null}
      <div ref={requestListTarget} tabIndex={-1} aria-label="Approval requests">
        <SectionLabel aside={`${shown.length}`}>Requests</SectionLabel>
      </div>
      {requests === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Loading requests…</p>}
      {reviewRequestId && requests !== null && readError && (
        <div role="alert" className="portal-panel">
          <strong>Approval review unavailable.</strong> {readError}{' '}
          <button type="button" className="btn" onClick={() => void refresh()}>Retry approval review</button>
        </div>
      )}
      {reviewRequestId && requests !== null && !readError && !reviewRequest && (
        <div role="alert" className="portal-panel">
          This approval is unavailable in the authorized result. The result may be capped, missing, or outside your current access; no status is inferred.{' '}
          <button type="button" className="btn" onClick={() => void refresh()}>Retry approval review</button>
        </div>
      )}
      {!reviewRequestId && requests !== null && shown.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No requests in this scope.</p>}
      {shown.map((r) => {
        const d = duties.find((x) => x.id === r.dutyId);
        const reviewed = r.id === reviewRequestId;
        const eligible = approvalDecisionAvailable(r) && attemptedRequestId !== r.id;
        const stateText = reviewed ? reviewStateText(r, d, receipt, returnedStatus) : null;
        return (
          <article
            key={r.id}
            ref={r.id === reviewRequestId ? reviewTarget : undefined}
            tabIndex={r.id === reviewRequestId ? -1 : undefined}
            data-approval-request={r.id}
            className="portal-panel"
            aria-label={`Request ${r.ticket}`}
            style={{ display: 'grid', gap: 'var(--sp-3)' }}
          >
            <strong>{d?.action ?? r.dutyId}</strong>
            <Fields
              label={`Request ${r.ticket} details`}
              items={[
                { field: 'Status', value: STATUS_TEXT[r.status] },
                { field: 'Duty', value: d?.action ?? r.dutyId },
                { field: 'Ticket', value: r.ticket },
                { field: 'Tenant', value: r.tenantId ? `${r.tenantId}${r.tenantName ? ` — ${r.tenantName}` : ''}${r.isDemo ? ' (demo)' : ''}` : 'Platform' },
                { field: 'Target', value: r.target ?? 'none' },
                { field: 'Stored detail', value: storedDetail(r.detail) },
                { field: 'Evidence', value: r.evidence },
                { field: 'Evidence required', value: d?.evidence ?? 'Unknown duty' },
                { field: 'Requester', value: r.mine ? `${r.requester} (you)` : r.requester },
                { field: 'Requested', value: when(r.createdAt) },
                { field: 'Expires', value: when(r.expiresAt) },
                { field: 'Correlation', value: r.correlationId ?? 'none' },
                {
                  field: 'Decisions',
                  value: decisionSummary(r, d),
                },
              ]}
            />
            {stateText && <p role="status" style={{ marginBlock: 0 }}><strong>{stateText}</strong></p>}
            {reviewed && receipt && (
              <Fields
                label="Your authoritative decision receipt"
                items={[
                  { field: 'Request id', value: receipt.requestId },
                  { field: 'Approver', value: receipt.approver },
                  { field: 'Decision', value: receipt.decision },
                  { field: 'As party', value: receipt.asParty },
                  { field: 'Decided at', value: when(receipt.decidedAt) },
                ]}
              />
            )}
            {reviewed && uncertainRequestId === r.id && (
              <div role="alert" className="portal-panel">
                The decision result is uncertain. Check decision status before doing anything else. No decision will be submitted again automatically.{' '}
                <button type="button" className="btn" disabled={decisionBusy || !online} onClick={() => void reconcile(r)}>
                  Check decision status
                </button>
              </div>
            )}
            {reviewed && receiptError && uncertainRequestId !== r.id && (
              <div role="alert" className="portal-panel">
                <strong>Decision receipt unavailable.</strong> {receiptError}{' '}
                <button type="button" className="btn" disabled={decisionBusy || !online} onClick={() => void reconcile(r)}>
                  Check decision status
                </button>
              </div>
            )}
            {r.status === 'pending' && eligible && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
                <button type="button" className="btn btn-primary" disabled={decisionBusy || !online} onClick={() => decide(r, 'approve')}>
                  Approve
                </button>
                <button type="button" className="btn" disabled={decisionBusy || !online} onClick={() => decide(r, 'reject')}>
                  Reject
                </button>
              </div>
            )}
            {r.status === 'pending' && eligible && !online && (
              <p role="alert" style={{ marginBlock: 0 }}>Decision unavailable while offline. Nothing is queued.</p>
            )}
            {r.status === 'pending' && !eligible && attemptedRequestId !== r.id && (
              <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
                {r.mine ? 'Yours to ask, not to decide: self-approval is refused.' : r.decidedByMe ? 'You have already decided this one.' : 'Not yours to decide: you hold none of this duty’s approver parties, or the request has expired.'}
              </p>
            )}
            {r.status === 'approved' && !reviewed && (r.mine || r.decidedByMe) && (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => act(r)}>
                  Act on this request
                </button>
              </div>
            )}
            {r.status === 'approved' && !reviewed && !(r.mine || r.decidedByMe) && (
              <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
                Not yours to act on: only the requester, or an approver who decided it, may.
              </p>
            )}
            {reviewed && r.status === 'approved' && (
              <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Execution is a separate operation and is not available from this approval review.</p>
            )}
            {(r.status === 'pending' || r.status === 'approved') && <WriteNotice env={env} />}
          </article>
        );
      })}
      <Notice>
        Self-approval is refused by the server, a two-person duty needs two distinct approvers, and every decision and action asks for a second factor verified in the last fifteen minutes.
      </Notice>
      {asking && (
        <ConfirmDialog
          title={`${asking.decision === 'approve' ? 'Approve' : 'Reject'} this request?`}
          confirmLabel={`Record ${asking.decision === 'approve' ? 'approval' : 'rejection'}`}
          onCancel={() => setAsking(null)}
          onConfirm={() => runDecision(asking.request, asking.decision)}
          preview={(
            <ActionPreview
              subject={`Request ${asking.request.ticket}`}
              says={`Records your ${asking.decision === 'approve' ? 'approval' : 'rejection'} on this stored request.`}
              exactly={(
                <Fields
                  label="Stored request consequences"
                  items={[
                    { field: 'Duty', value: duties.find((item) => item.id === asking.request.dutyId)?.action ?? asking.request.dutyId },
                    { field: 'Target', value: asking.request.target ?? 'none' },
                    { field: 'Tenant', value: asking.request.tenantId ? `${asking.request.tenantId}${asking.request.tenantName ? ` — ${asking.request.tenantName}` : ''}` : 'Platform' },
                    { field: 'Stored detail', value: storedDetail(asking.request.detail) },
                    { field: 'Evidence', value: asking.request.evidence },
                    { field: 'Expires', value: when(asking.request.expiresAt) },
                    { field: 'Decisions', value: decisionSummary(asking.request, duties.find((item) => item.id === asking.request.dutyId)) },
                  ]}
                />
              )}
              doesNotChange="This records only the decision. It does not execute the requested integration change or any other requested change."
              recovery={{ kind: 'none', how: 'The server decision receipt is immutable.' }}
            />
          )}
        />
      )}
    </div>
  );
}
