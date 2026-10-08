import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  loadIntegrationHealth,
  requestApproval,
  type ApprovalInput,
  type IntegrationHealth as IntegrationHealthRow,
} from '../../lib/console/client';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

interface IntegrationHealthProps extends ViewProps {
  read?: (includeDemo?: boolean) => Promise<IntegrationHealthRow[]>;
  requestConfigurationApproval?: (input: ApprovalInput) => Promise<string>;
}

type ChangeKind = 'configure' | 'rotate-credential-reference' | 'disable';

const EMPTY_APPROVAL = {
  change: 'configure' as ChangeKind,
  institutionApproval: '',
  rollback: '',
  credentialExpiry: '',
  ticket: '',
};

const SAFE_REFERENCE = /^[A-Za-z0-9._:/-]{3,200}$/;
const SAFE_TICKET = /^[A-Za-z0-9._:-]{3,80}$/;
const HEALTH_LABEL: Record<IntegrationHealthRow['healthState'], string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  stale: 'Stale',
  failed: 'Failed',
  unconfigured: 'Unconfigured',
};

/**
 * A credential-free connector workspace. The only write it offers is a
 * structured integration-config approval request; execution remains separate.
 */
export function IntegrationHealth({
  env,
  scope,
  filter,
  onStatus,
  read = loadIntegrationHealth,
  requestConfigurationApproval = requestApproval,
}: IntegrationHealthProps) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [connections, setConnections] = useState<IntegrationHealthRow[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [approval, setApproval] = useState(EMPTY_APPROVAL);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const refreshRequest = useRef(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    const sequence = ++refreshRequest.current;
    try {
      const rows = await read(env === 'Production' ? false : includeDemo);
      if (sequence !== refreshRequest.current) return false;
      setConnections(rows);
      setError('');
      return true;
    } catch (caught) {
      if (sequence !== refreshRequest.current) return false;
      const detail = said(caught, 'Could not read integration health.');
      setError(detail);
      onStatus(detail);
      return false;
    }
  }, [env, includeDemo, onStatus, read]);

  // Loaded only after the capability-gated workspace opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(
    () => (connections ?? []).filter((connection) => inScope(scope, connection.tenantId) && matches(
      filter,
      connection.connectionId,
      connection.tenantId,
      connection.tenantName,
      connection.connectionName,
      connection.providerDomain,
      connection.providerName,
      connection.configurationState,
      connection.healthState,
      connection.ownerName,
    )),
    [connections, filter, scope],
  );

  const open = (connectionId: string | null) => {
    setOpenId(connectionId);
    setApproval(EMPTY_APPROVAL);
  };

  const ask = async (connection: IntegrationHealthRow) => {
    setBusy(true);
    try {
      const id = await requestConfigurationApproval({
        dutyId: 'integration-config',
        tenantId: connection.tenantId,
        target: connection.connectionId,
        detail: {
          requested_change: approval.change,
          connection_name: connection.connectionName,
          provider_domain: connection.providerDomain,
          credential_expiry: approval.credentialExpiry,
        },
        evidence: [
          `institution_approval=${approval.institutionApproval.trim()}`,
          `data_scope=${connection.providerDomain}`,
          `fallback=${approval.rollback.trim()}`,
          `credential_expiry=${approval.credentialExpiry}`,
        ].join('; '),
        ticket: approval.ticket.trim(),
      });
      onStatus(`Integration configuration approval ${id} was requested for ${connection.connectionName}; execution remains separate.`);
      open(null);
      await refresh();
    } catch (caught) {
      onStatus(said(caught, 'Could not request integration configuration approval.'));
    } finally {
      setBusy(false);
    }
  };

  const denied = /required|permission|denied|not authorized/i.test(error);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Operational metadata only. Credentials, tokens, cursors, payload references, external record references and provider messages are never returned to this workspace.
      </Notice>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
            Include demo tenants explicitly
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void refresh(); }}>
          Refresh integration health
        </button>
      </div>

      <SectionLabel aside={connections === null ? 'reading' : `${shown.length} connections`}>Integration health</SectionLabel>
      {connections === null && !error && <p role="status">Reading integration health…</p>}
      {error && (
        <Notice alert>
          {denied
            ? 'Access denied. Integration health requires the platform console shell and a live integration:view grant for an exact school.'
            : connections === null
              ? 'Integration health is unavailable. No records are shown.'
              : 'Integration health could not be refreshed; the last-known summary remains visible.'}
        </Notice>
      )}
      {connections !== null && !error && shown.length === 0 && (
        <Notice>No integrations are available in this grant scope. No example or cross-tenant records are shown.</Notice>
      )}

      {shown.map((connection) => {
        const expanded = openId === connection.connectionId;
        const approvalOpen = connection.configurationApprovalStatus === 'pending'
          || connection.configurationApprovalStatus === 'approved';
        const ready = SAFE_REFERENCE.test(approval.institutionApproval.trim())
          && SAFE_REFERENCE.test(approval.rollback.trim())
          && (approval.change === 'disable' || (
            /^\d{4}-\d{2}-\d{2}$/.test(approval.credentialExpiry)
            && approval.credentialExpiry > today
          ))
          && SAFE_TICKET.test(approval.ticket.trim());
        return (
          <article
            key={connection.connectionId}
            className="portal-panel"
            aria-label={`${connection.connectionName} integration health`}
            style={{ display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}
          >
            <div>
              <strong>{connection.connectionName}</strong> · {HEALTH_LABEL[connection.healthState]}
              <div style={{ color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>
                {connection.tenantName || connection.tenantId}{connection.isDemo ? ' (demo)' : ''} · {connection.providerName} / {connection.providerDomain}
              </div>
            </div>

            <Fields
              label={`Health evidence for ${connection.connectionName}`}
              items={[
                { field: 'Connection', value: connection.connectionId },
                { field: 'Tenant', value: `${connection.tenantName || connection.tenantId} (${connection.tenantId})` },
                { field: 'Configuration', value: connection.configurationState || 'missing' },
                { field: 'Health', value: HEALTH_LABEL[connection.healthState] },
                { field: 'Feature state', value: connection.featureState || 'not configured' },
                { field: 'Last success', value: `${when(connection.lastSuccessfulSyncAt, 'never')}; ${connection.minutesSinceSuccess ?? '?'} minute(s) ago; target ${connection.freshnessTargetMinutes ?? '?'} minute(s)` },
                { field: 'Latest run', value: `${connection.latestRunStatus ?? 'none'} at ${when(connection.latestRunAt, 'never')}; reconciliation ${connection.reconciliationState ?? 'none'}; ${connection.recordsReceived} received / ${connection.recordsRejected} rejected` },
                { field: 'Exceptions', value: `${connection.openErrors} open error(s); ${connection.criticalErrors} critical; ${connection.openDeadLetters} dead letter(s)` },
                { field: 'Owner', value: `${connection.ownerName || 'Unassigned'}; backup ${connection.backupOwnerName || 'Unassigned'}` },
                { field: 'Customer impact', value: connection.customerImpact || 'missing' },
                { field: 'Next safe action', value: connection.nextSafeAction || 'missing' },
                { field: 'Configuration approval', value: connection.configurationApprovalStatus ? `${connection.configurationApprovalStatus} · ${connection.configurationApprovalId ?? 'id unavailable'}` : 'not requested' },
                { field: 'Classification', value: connection.classification || 'missing' },
                { field: 'Provenance', value: connection.provenance || 'missing' },
                { field: 'Limitation', value: connection.limitation || 'missing' },
              ]}
            />

            {approvalOpen ? (
              <Notice>Keep this connector unchanged while approval {connection.configurationApprovalId ?? ''} is {connection.configurationApprovalStatus}.</Notice>
            ) : connection.canRequest ? (
              <button type="button" className="btn btn-secondary" onClick={() => open(expanded ? null : connection.connectionId)}>
                {expanded ? 'Cancel approval request' : 'Request configuration approval'}
              </button>
            ) : (
              <Notice>This view is read-only for your current duty assignment.</Notice>
            )}

            {expanded && connection.canRequest && !approvalOpen && (
              <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                <Notice alert>Never paste credentials, secrets or tokens. Use opaque approval, rollback and ticket references only. This request does not change the connector.</Notice>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Requested change
                  <select className="input" value={approval.change} onChange={(event) => setApproval({ ...approval, change: event.target.value as ChangeKind })}>
                    <option value="configure">Configure connection</option>
                    <option value="rotate-credential-reference">Rotate credential reference</option>
                    <option value="disable">Disable connection</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Institution approval reference
                  <input className="input" value={approval.institutionApproval} onChange={(event) => setApproval({ ...approval, institutionApproval: event.target.value })} pattern="[A-Za-z0-9._:/-]{3,200}" maxLength={200} />
                </label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Fallback or rollback reference
                  <input className="input" value={approval.rollback} onChange={(event) => setApproval({ ...approval, rollback: event.target.value })} pattern="[A-Za-z0-9._:/-]{3,200}" maxLength={200} />
                </label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Credential expiry date
                  <input className="input" type="date" value={approval.credentialExpiry} onChange={(event) => setApproval({ ...approval, credentialExpiry: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  Change ticket
                  <input className="input" value={approval.ticket} onChange={(event) => setApproval({ ...approval, ticket: event.target.value })} pattern="[A-Za-z0-9._:/-]{3,200}" maxLength={200} />
                </label>
                <button type="button" className="btn" disabled={!ready || busy} onClick={() => { void ask(connection); }}>
                  {busy ? 'Requesting…' : 'Request two-person approval'}
                </button>
                <WriteNotice env={env} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
