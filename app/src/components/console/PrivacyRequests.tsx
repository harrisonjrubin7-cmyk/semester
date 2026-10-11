import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  claimPrivacyRequest,
  loadPrivacyRequests,
  readPrivacyRequestDetail,
  requestApproval,
  resolvePrivacyRequest,
  verifyPrivacyRequest,
  type ApprovalInput,
  type PrivacyRequest,
  type PrivacyRequestDetail,
  type PrivacyRequestOutcome,
  type PrivacyResolution,
} from '../../lib/console/client';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

const KIND_LABEL: Record<PrivacyRequest['kind'], string> = {
  export: 'Export',
  erasure: 'Erasure',
  correction: 'Correction',
  restriction: 'Restriction',
};

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  verifying: 'Verification in progress',
  in_progress: 'In progress',
  completed: 'Completed',
  refused: 'Refused',
};

interface PrivacyRequestsProps extends ViewProps {
  read?: (includeDemo?: boolean) => Promise<PrivacyRequest[]>;
  claim?: (requestId: string) => Promise<string>;
  readDetail?: (requestId: string) => Promise<PrivacyRequestDetail>;
  verify?: (requestId: string, basis: string, evidence: string) => Promise<string>;
  resolve?: (
    requestId: string,
    outcome: PrivacyRequestOutcome,
    resolution: string,
    evidence: string,
    approvalId?: string | null,
  ) => Promise<PrivacyResolution>;
  requestDeletionApproval?: (input: ApprovalInput) => Promise<string>;
}

const EMPTY_VERIFY = { basis: '', evidence: '' };
const EMPTY_RESOLUTION = { outcome: 'completed' as PrivacyRequestOutcome, resolution: '', evidence: '' };
const EMPTY_APPROVAL = { evidence: '', ticket: '' };
const SAFE_TICKET = /^[A-Za-z0-9._:-]{3,80}$/;
const authorizationDenied = (message: string) => /required|permission|denied|not authorized/i.test(message);

/**
 * Data-rights operations with an identity-minimized queue and an explicit
 * audited boundary around request detail. Nothing sensitive is fetched merely
 * because a row is visible or expanded.
 */
export function PrivacyRequests({
  env,
  scope,
  filter,
  onStatus,
  privileged,
  read = loadPrivacyRequests,
  claim = claimPrivacyRequest,
  readDetail = readPrivacyRequestDetail,
  verify = verifyPrivacyRequest,
  resolve = resolvePrivacyRequest,
  requestDeletionApproval = requestApproval,
}: PrivacyRequestsProps) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [requests, setRequests] = useState<PrivacyRequest[] | null>(null);
  const [queueError, setQueueError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrivacyRequestDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const openRequest = useRef<string | null>(null);
  const detailRequest = useRef(0);
  const queueRequest = useRef(0);
  const [verification, setVerification] = useState(EMPTY_VERIFY);
  const [resolution, setResolution] = useState(EMPTY_RESOLUTION);
  const [approval, setApproval] = useState(EMPTY_APPROVAL);

  const refresh = useCallback(async (): Promise<boolean> => {
    const sequence = ++queueRequest.current;
    try {
      const rows = await read(env === 'Production' ? false : includeDemo);
      if (sequence !== queueRequest.current) return false;
      setRequests(rows);
      setQueueError('');
      return true;
    } catch (error) {
      if (sequence !== queueRequest.current) return false;
      const message = said(error, 'Could not read privacy requests.');
      if (authorizationDenied(message)) {
        detailRequest.current += 1;
        openRequest.current = null;
        setRequests(null);
        setOpenId(null);
        setDetail(null);
        setDetailFailed(false);
        setVerification(EMPTY_VERIFY);
        setResolution(EMPTY_RESOLUTION);
        setApproval(EMPTY_APPROVAL);
      }
      setQueueError(message);
      onStatus(message);
      return false;
    }
  }, [env, includeDemo, onStatus, read]);

  // Account-backed queue state, loaded only when the capability-gated view opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(
    () => (requests ?? []).filter((request) => inScope(scope, request.tenantId) && matches(
      filter,
      request.requestRef,
      request.tenantId,
      request.tenantName,
      request.kind,
      request.status,
      request.identityState,
      request.holdState,
      request.deletionApprovalStatus,
    )),
    [filter, requests, scope],
  );

  const open = (requestId: string | null) => {
    openRequest.current = requestId;
    detailRequest.current += 1;
    setOpenId(requestId);
    setDetail(null);
    setDetailFailed(false);
    setVerification(EMPTY_VERIFY);
    setResolution(EMPTY_RESOLUTION);
    setApproval(EMPTY_APPROVAL);
  };

  const claimOne = (request: PrivacyRequest) => privileged(async () => {
    setBusy('claim');
    try {
      const status = await claim(request.requestId);
      onStatus(`${request.requestRef} is assigned to you and is now ${STATUS_LABEL[status]?.toLowerCase() ?? status}.`);
      await refresh();
    } catch (error) {
      onStatus(said(error, 'Could not claim the privacy request.'));
    } finally {
      setBusy('');
    }
  });

  const readSensitive = (request: PrivacyRequest) => privileged(async () => {
    const sequence = ++detailRequest.current;
    setBusy('detail');
    setDetailFailed(false);
    try {
      const next = await readDetail(request.requestId);
      if (sequence !== detailRequest.current || openRequest.current !== request.requestId) return;
      setDetail(next);
      onStatus(`${request.requestRef} detail was read and the read was audited.`);
    } catch (error) {
      if (sequence !== detailRequest.current || openRequest.current !== request.requestId) return;
      setDetail(null);
      setDetailFailed(true);
      onStatus(said(error, 'Could not read the privacy request detail.'));
    } finally {
      if (sequence === detailRequest.current) setBusy('');
    }
  });

  const verifyIdentity = (request: PrivacyRequest) => privileged(async () => {
    setBusy('verify');
    try {
      await verify(request.requestId, verification.basis.trim(), verification.evidence.trim());
      onStatus(`${request.requestRef} identity or authority was verified; the audit event was written first.`);
      setVerification(EMPTY_VERIFY);
      await refresh();
    } catch (error) {
      onStatus(said(error, 'Could not verify identity or authority.'));
    } finally {
      setBusy('');
    }
  });

  const askForDeletionApproval = async (request: PrivacyRequest) => {
    setBusy('approval');
    try {
      const id = await requestDeletionApproval({
        dutyId: 'data-deletion',
        tenantId: request.tenantId,
        target: request.requestId,
        detail: { request_ref: request.requestRef, affected_stores: request.affectedStores },
        evidence: approval.evidence.trim(),
        ticket: approval.ticket.trim(),
      });
      onStatus(`Deletion approval ${id} was requested for ${request.requestRef}; execution remains separate.`);
      setApproval(EMPTY_APPROVAL);
      await refresh();
    } catch (error) {
      onStatus(said(error, 'Could not request deletion approval.'));
    } finally {
      setBusy('');
    }
  };

  const resolveOne = (request: PrivacyRequest) => privileged(async () => {
    setBusy('resolve');
    try {
      const approvalId = request.kind === 'erasure' && resolution.outcome === 'completed'
        ? request.deletionApprovalId
        : null;
      const result = await resolve(
        request.requestId,
        resolution.outcome,
        resolution.resolution.trim(),
        resolution.evidence.trim(),
        approvalId,
      );
      onStatus(
        result.certificateId
          ? `${request.requestRef} was completed; immutable certificate ${result.certificateId} was issued.`
          : `${request.requestRef} was ${result.status}.`,
      );
      setResolution(EMPTY_RESOLUTION);
      setDetail(null);
      await refresh();
    } catch (error) {
      onStatus(said(error, 'Could not resolve the privacy request.'));
    } finally {
      setBusy('');
    }
  });

  const denied = authorizationDenied(queueError);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Metadata first. The queue contains no subject identifier or request detail. Claiming, opening detail, verifying identity and resolving a case are separate server-authorized steps; sensitive reads and lifecycle writes require fresh MFA and are audited.
      </Notice>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
            Include demo tenants explicitly
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void refresh(); }}>
          Refresh privacy requests
        </button>
      </div>

      <SectionLabel aside={requests === null ? 'reading' : `${shown.length} requests`}>Privacy requests</SectionLabel>
      {requests === null && !queueError && <p role="status">Reading the privacy request queue…</p>}
      {queueError && (
        <Notice alert>
          {denied
            ? 'Access denied. Privacy requests require the platform console shell and a live data-rights grant for an exact school.'
            : requests === null
              ? 'Privacy requests are unavailable. No records are shown.'
              : 'Privacy requests could not be refreshed; the last-known queue remains visible.'}
        </Notice>
      )}
      {requests !== null && !queueError && shown.length === 0 && (
        <Notice>No privacy requests are available in this grant scope. No example or cross-tenant records are shown.</Notice>
      )}

      {shown.map((request) => {
        const expanded = openId === request.requestId;
        const unresolved = request.status !== 'completed' && request.status !== 'refused';
        const owner = request.assignedToMe ? 'You' : request.assignedTo ? 'Another data steward' : 'Unassigned';
        const approvalStatus = request.deletionApprovalStatus ?? 'not requested';
        const canRequestDeletionApproval = request.deletionApprovalStatus === null
          || request.deletionApprovalStatus === 'rejected'
          || request.deletionApprovalStatus === 'expired';
        const completedErasureBlocked = request.kind === 'erasure'
          && resolution.outcome === 'completed'
          && (request.holdState === 'live_hold' || request.deletionApprovalStatus !== 'executed');
        const verificationReady = verification.basis.trim().length >= 3
          && /^[A-Za-z0-9._:/-]{3,200}$/.test(verification.evidence.trim());
        const resolutionReady = resolution.resolution.trim().length >= 3
          && /^[A-Za-z0-9._:/-]{3,200}$/.test(resolution.evidence.trim())
          && !completedErasureBlocked;

        return (
          <article key={request.requestId} className="portal-panel" aria-label={`Privacy request ${request.requestRef}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
            <strong>{request.requestRef} · {KIND_LABEL[request.kind]}</strong>
            <Fields
              label={`Metadata for ${request.requestRef}`}
              items={[
                { field: 'Tenant', value: request.tenantId
                  ? `${request.tenantName || request.tenantId} · ${request.tenantId}${request.isDemo ? ' (demo)' : ''}`
                  : 'Platform / unassigned' },
                { field: 'Status', value: STATUS_LABEL[request.status] ?? request.status },
                { field: 'Received', value: when(request.receivedAt) },
                { field: 'Due', value: `${when(request.dueAt)}${request.overdue ? ' · OVERDUE' : ''}` },
                { field: 'Identity', value: request.identityState },
                { field: 'Owner', value: `${owner}${request.assignedAt ? ` · since ${when(request.assignedAt)}` : ''}` },
                { field: 'Legal hold', value: request.holdState === 'live_hold' ? 'LIVE — destructive completion blocked' : 'Clear at last read' },
                { field: 'Affected stores', value: request.affectedStores.join(' · ') || 'Not recorded' },
                { field: 'Deletion approval', value: `${approvalStatus}${request.deletionApprovalId ? ` · ${request.deletionApprovalId}` : ''}` },
                { field: 'Classification', value: request.classification || 'missing' },
                { field: 'Provenance', value: request.provenance || 'missing' },
                { field: 'Limitation', value: request.limitation || 'missing' },
              ]}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <button type="button" className="btn btn-secondary" aria-expanded={expanded} onClick={() => open(expanded ? null : request.requestId)}>
                {expanded ? 'Close case' : 'Open case'}
              </button>
              {unresolved && !request.assignedTo && (
                <button type="button" className="btn btn-primary" disabled={busy === 'claim'} onClick={() => claimOne(request)}>
                  {busy === 'claim' && expanded ? 'Claiming…' : 'Claim request'}
                </button>
              )}
            </div>

            {expanded && (
              <section aria-label={`Case actions ${request.requestRef}`} style={{ display: 'grid', gap: 'var(--sp-4)', borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
                {!request.assignedToMe && (
                  <Notice>
                    {request.assignedTo
                      ? 'Another data steward owns this case. Its sensitive detail and actions remain unavailable.'
                      : 'Claim this request before opening its sensitive detail.'}
                  </Notice>
                )}

                {request.assignedToMe && (
                  <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                    <button type="button" className="btn btn-secondary" disabled={busy === 'detail'} onClick={() => readSensitive(request)}>
                      {busy === 'detail' ? 'Reading audited detail…' : detail ? 'Refresh audited detail' : 'View request detail'}
                    </button>
                    {detailFailed && <Notice>Request detail remains closed. No cached sensitive result is shown.</Notice>}
                    {detail && (
                      <Fields
                        label={`Sensitive detail for ${request.requestRef}`}
                        items={[
                          { field: 'Subject reference', value: detail.subjectReference },
                          { field: 'Requested by', value: detail.requestedBy },
                          { field: 'Request', value: detail.detail },
                          { field: 'Verified', value: when(detail.verifiedAt, 'not yet') },
                          { field: 'Resolution', value: detail.resolution || 'none' },
                          { field: 'Resolution evidence', value: detail.resolutionEvidence ?? 'none' },
                          { field: 'Certificate', value: detail.completionCertificateId ?? 'none' },
                        ]}
                      />
                    )}
                  </div>
                )}

                {request.assignedToMe && unresolved && request.identityState === 'unverified' && detail && (
                  <form
                    aria-label={`Verify ${request.requestRef}`}
                    onSubmit={(event) => { event.preventDefault(); verifyIdentity(request); }}
                    style={{ display: 'grid', gap: 'var(--sp-3)' }}
                  >
                    <SectionLabel>Verify identity or authority</SectionLabel>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Verification basis
                      <input className="input" required minLength={3} maxLength={200} value={verification.basis} onChange={(event) => setVerification((value) => ({ ...value, basis: event.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Verification evidence reference
                      <input className="input" required pattern="[A-Za-z0-9._:/-]{3,200}" maxLength={200} value={verification.evidence} onChange={(event) => setVerification((value) => ({ ...value, evidence: event.target.value }))} />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy === 'verify' || !verificationReady}>
                      Record verification
                    </button>
                    <WriteNotice env={env} />
                  </form>
                )}

                {request.assignedToMe && unresolved && request.kind === 'erasure' && request.identityState === 'verified' && canRequestDeletionApproval && (
                  <form
                    aria-label={`Deletion approval ${request.requestRef}`}
                    onSubmit={(event) => { event.preventDefault(); void askForDeletionApproval(request); }}
                    style={{ display: 'grid', gap: 'var(--sp-3)' }}
                  >
                    <SectionLabel>Request deletion approval</SectionLabel>
                    {request.deletionApprovalStatus && <Notice>The latest deletion approval is {request.deletionApprovalStatus}. A completed erasure remains blocked until an approval is executed.</Notice>}
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Deletion evidence
                      <textarea className="input" required rows={3} value={approval.evidence} onChange={(event) => setApproval((value) => ({ ...value, evidence: event.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Change or case ticket
                      <input className="input" required minLength={3} maxLength={80} pattern="[A-Za-z0-9._:-]{3,80}" value={approval.ticket} onChange={(event) => setApproval((value) => ({ ...value, ticket: event.target.value }))} />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy === 'approval' || approval.evidence.trim().length === 0 || !SAFE_TICKET.test(approval.ticket.trim())}>
                      Record approval request
                    </button>
                    <WriteNotice env={env} />
                  </form>
                )}

                {request.assignedToMe && unresolved && request.identityState === 'verified' && detail && (
                  <form
                    aria-label={`Resolve ${request.requestRef}`}
                    onSubmit={(event) => { event.preventDefault(); resolveOne(request); }}
                    style={{ display: 'grid', gap: 'var(--sp-3)' }}
                  >
                    <SectionLabel>Resolve request</SectionLabel>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Outcome
                      <select className="input" value={resolution.outcome} onChange={(event) => setResolution((value) => ({ ...value, outcome: event.target.value as PrivacyRequestOutcome }))}>
                        <option value="completed">Completed</option>
                        <option value="refused">Refused</option>
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Resolution
                      <textarea className="input" required minLength={3} maxLength={1000} rows={3} value={resolution.resolution} onChange={(event) => setResolution((value) => ({ ...value, resolution: event.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                      Evidence reference
                      <input className="input" required pattern="[A-Za-z0-9._:/-]{3,200}" value={resolution.evidence} onChange={(event) => setResolution((value) => ({ ...value, evidence: event.target.value }))} />
                    </label>
                    {request.kind === 'erasure' && resolution.outcome === 'completed' && request.holdState === 'live_hold' && (
                      <Notice alert>A live legal hold blocks destructive completion. The request may still be refused with a recorded reason.</Notice>
                    )}
                    {request.kind === 'erasure' && resolution.outcome === 'completed' && request.deletionApprovalStatus !== 'executed' && (
                      <Notice>Completed erasure requires the exact deletion approval to be executed first in Approvals.</Notice>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={busy === 'resolve' || !resolutionReady}>
                      {resolution.outcome === 'completed' ? 'Complete and issue certificate' : 'Record refusal'}
                    </button>
                    <WriteNotice env={env} />
                  </form>
                )}
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}
