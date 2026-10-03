import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  loadReleaseIncidents,
  requestApproval,
  type ApprovalInput,
  type ReleaseIncident,
} from '../../lib/console/client';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

interface Props extends ViewProps {
  read?: (includeDemo?: boolean) => Promise<ReleaseIncident[]>;
  requestReleaseApproval?: (input: ApprovalInput) => Promise<string>;
}

const EMPTY = { change: '', verification: '', rollback: '', ticket: '' };
const SAFE_REFERENCE = /^[A-Za-z0-9._:/-]{3,200}$/;
const SAFE_TICKET = /^[A-Za-z0-9._:-]{3,80}$/;
const LABEL: Record<ReleaseIncident['state'], string> = {
  blocked: 'Blocked', release_candidate: 'Release candidate', deployed_unverified: 'Deployed — needs confirmation',
  verified: 'Verified evidence', incident: 'Incident', rollback: 'Rollback', recovered: 'Recovered',
};

/** Read-only operational evidence plus request-only release and rollback approvals. */
export function ReleaseIncidents({
  env, scope, filter, onStatus, read = loadReleaseIncidents, requestReleaseApproval = requestApproval,
}: Props) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [items, setItems] = useState<ReleaseIncident[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refs, setRefs] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const refreshRequest = useRef(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    const sequence = ++refreshRequest.current;
    try {
      const rows = await read(env === 'Production' ? false : includeDemo);
      if (sequence !== refreshRequest.current) return false;
      setItems(rows);
      setError('');
      return true;
    } catch (caught) {
      if (sequence !== refreshRequest.current) return false;
      const detail = said(caught, 'Could not read release and incident operations.');
      setError(detail);
      onStatus(detail);
      return false;
    }
  }, [env, includeDemo, onStatus, read]);

  // Loaded only after the capability-gated workspace opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(() => (items ?? []).filter((item) => inScope(scope, item.tenantId) && matches(
    filter, item.itemId, item.itemKind, item.tenantId, item.tenantName, item.state, item.title,
    item.severity, item.owner, item.customerImpact, item.communicationStatus,
  )), [filter, items, scope]);

  const open = (id: string | null) => { setOpenId(id); setRefs(EMPTY); };

  const ask = async (item: ReleaseIncident) => {
    setBusy(true);
    const rollback = item.itemKind === 'incident';
    try {
      const id = await requestReleaseApproval({
        dutyId: 'release',
        tenantId: rollback ? item.tenantId : null,
        target: rollback ? item.itemId : 'platform',
        detail: rollback
          ? { action: 'rollback', incident_ref: item.itemId, release_commit: item.releaseCommit }
          : { action: 'release', release_commit: item.releaseCommit },
        evidence: rollback
          ? `change_evidence=${refs.change.trim()}; verification_plan=${refs.verification.trim()}; rollback_procedure=${refs.rollback.trim()}`
          : `ci=${refs.change.trim()}; golden_path=${refs.verification.trim()}; rollback=${refs.rollback.trim()}`,
        ticket: refs.ticket.trim(),
      });
      onStatus(`${rollback ? 'Rollback' : 'Release'} approval ${id} was requested; execution and verification remain separate.`);
      open(null);
      await refresh();
    } catch (caught) {
      onStatus(said(caught, 'Could not request approval.'));
    } finally {
      setBusy(false);
    }
  };

  const denied = /required|permission|denied|not authorized/i.test(error);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Evidence-derived operations only. No row is a GO decision by itself, and “Verified evidence” is neither institutional activation nor proof of every production workflow.
      </Notice>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
            Include demo incidents explicitly
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void refresh(); }}>Refresh release and incidents</button>
      </div>

      <SectionLabel aside={items === null ? 'reading' : `${shown.length} records`}>Release and incident operations</SectionLabel>
      {items === null && !error && <p role="status">Reading release and incident operations…</p>}
      {error && <Notice alert>{denied
        ? 'Access denied. This workspace requires the platform console shell and incident:communicate at platform scope.'
        : items === null ? 'Release and incident operations are unavailable. No records are shown.' : 'The refresh failed; the last-known summary remains visible.'}</Notice>}
      {items !== null && !error && shown.length === 0 && <Notice>No release or incident records are available in this grant scope.</Notice>}

      {shown.map((item) => {
        const expanded = openId === item.itemId;
        const approvalOpen = item.approvalStatus === 'pending' || item.approvalStatus === 'approved';
        const hasBoundCommit = /^[0-9a-f]{40}$/.test(item.releaseCommit ?? '');
        const canRequest = item.canRequest && hasBoundCommit && (item.itemKind === 'incident'
          ? item.state === 'incident' || item.state === 'rollback'
          : item.state === 'release_candidate');
        const ready = [refs.change, refs.verification, refs.rollback].every((value) => SAFE_REFERENCE.test(value.trim()))
          && SAFE_TICKET.test(refs.ticket.trim());
        const rollback = item.itemKind === 'incident';
        return (
          <article key={item.itemId} className="portal-panel" aria-label={`${item.title} release or incident record`} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            <div><strong>{item.title}</strong> · {LABEL[item.state]}<div style={{ color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>{item.tenantName ?? 'Platform'}{item.isDemo ? ' (demo)' : ''} · {item.severity}</div></div>
            <Fields label={`Evidence for ${item.title}`} items={[
              { field: 'Record', value: `${item.itemKind} · ${item.itemId}` },
              { field: 'State', value: LABEL[item.state] },
              { field: 'Tenant', value: item.tenantId ? `${item.tenantName ?? item.tenantId} (${item.tenantId})` : 'Platform' },
              { field: 'Owner', value: item.owner || 'Unassigned' },
              { field: 'Affected workflows', value: item.affectedWorkflows.join(', ') || 'missing' },
              { field: 'Customer impact', value: item.customerImpact || 'missing' },
              { field: 'Communications', value: `${item.communicationStatus || 'missing'}; last ${when(item.lastNoticeAt, 'never')}; next ${when(item.nextUpdateAt, 'not scheduled')}` },
              { field: 'Rollback', value: item.rollbackStatus || 'missing' },
              { field: 'Release commit', value: item.releaseCommit ?? 'not established' },
              { field: 'Deployment evidence', value: `${item.deploymentSource ?? 'source missing'} · ${item.deploymentId ?? 'deployment id missing'}` },
              { field: 'Evidence window', value: `${when(item.observedAt, 'not observed')} → ${when(item.expiresAt, 'no expiry recorded')}` },
              { field: 'Approval', value: item.approvalStatus ? `${item.approvalStatus} · ${item.approvalId ?? 'id unavailable'}` : 'not requested' },
              { field: 'Evidence', value: item.evidence || 'missing' },
              { field: 'Next safe action', value: item.nextSafeAction || 'missing' },
              { field: 'Classification', value: item.classification || 'missing' },
              { field: 'Provenance', value: item.provenance || 'missing' },
              { field: 'Limitation', value: item.limitation || 'missing' },
            ]} />

            {approvalOpen && <Notice>Keep the release unchanged while approval {item.approvalId ?? ''} is {item.approvalStatus}.</Notice>}
            {canRequest && !approvalOpen && <button type="button" className="btn btn-secondary" onClick={() => open(expanded ? null : item.itemId)}>{expanded ? 'Cancel approval request' : `Request ${rollback ? 'rollback' : 'release'} approval`}</button>}
            {expanded && canRequest && !approvalOpen && (
              <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                <Notice alert>Use opaque evidence references only. This request does not deploy or roll back anything.</Notice>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>{rollback ? 'Change evidence reference' : 'CI result reference'}<input className="input" value={refs.change} onChange={(event) => setRefs({ ...refs, change: event.target.value })} maxLength={200} /></label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>{rollback ? 'Verification plan reference' : 'Golden path reference'}<input className="input" value={refs.verification} onChange={(event) => setRefs({ ...refs, verification: event.target.value })} maxLength={200} /></label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>{rollback ? 'Rollback procedure reference' : 'Rollback rehearsal reference'}<input className="input" value={refs.rollback} onChange={(event) => setRefs({ ...refs, rollback: event.target.value })} maxLength={200} /></label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>Change ticket<input className="input" value={refs.ticket} onChange={(event) => setRefs({ ...refs, ticket: event.target.value })} pattern="[A-Za-z0-9._:-]{3,80}" maxLength={80} /></label>
                <button type="button" className="btn" disabled={!ready || busy} onClick={() => { void ask(item); }}>{busy ? 'Requesting…' : `Request ${rollback ? 'rollback' : 'release'} approval`}</button>
                <WriteNotice env={env} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
