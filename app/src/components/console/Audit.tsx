import { useEffect, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { auditStatus, loadAudit, type AuditEvent, type AuditStatus } from '../../lib/console/client';
import { Fields, inScope, matches, said, short, when, type ViewProps } from './Fields';

/**
 * The audit chain, read through `console_audit_read` — which writes an
 * `audit.read` event with the reader's identity, the window and the limit
 * *before* it returns a row. Opening this view is therefore itself in the
 * chain, and the notice says so. The status comes from
 * `console_audit_status`, which is not a read of the rows and is not logged.
 */
const DAYS = 30;
const LIMIT = 200;

export function Audit({ scope, filter, onStatus }: ViewProps) {
  const [status, setStatus] = useState<AuditStatus | null | string>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);

  // Account-backed data, loaded when the view opens; the read is logged server-side.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    let live = true;
    auditStatus().then(
      (s) => { if (live) setStatus(s); },
      (e: unknown) => { if (live) setStatus(said(e, 'Could not read the chain status.')); },
    );
    const since = new Date(Date.now() - DAYS * 86_400_000);
    loadAudit(since, LIMIT).then(
      (rows) => { if (live) setEvents(rows); },
      (e: unknown) => {
        if (!live) return;
        setEvents([]);
        onStatus(said(e, 'Could not read the audit.'));
      },
    );
    return () => { live = false; };
  }, [onStatus]);

  const shown = (events ?? []).filter((e) => inScope(scope, e.tenantId) && matches(filter, e.action, e.target, e.tenantId, e.actor, e.correlationId));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Reading the audit is itself audited: opening this view wrote an <code>audit.read</code> event with your identity, the last {DAYS} days as the window and {LIMIT} as the limit. It stays in the chain.
      </Notice>
      <SectionLabel>Chain status</SectionLabel>
      {status === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Reading the chain status…</p>}
      {typeof status === 'string' && <Notice alert>{status}</Notice>}
      {status !== null && typeof status !== 'string' && (
        <Fields
          label="Audit chain status"
          items={[
            { field: 'Rows', value: String(status.rows) },
            { field: 'Head', value: status.lastSeq === null ? 'empty' : `seq ${status.lastSeq} · ${short(status.headHash)}` },
            { field: 'Last sealed day', value: status.lastSealed ?? 'never' },
            {
              field: 'Last verified',
              value: status.lastVerifiedAt ? `${when(status.lastVerifiedAt)} — ${status.lastVerifiedOk ? 'chain intact' : 'chain BROKEN: a hash or manifest did not verify'}` : 'never',
            },
          ]}
        />
      )}
      <SectionLabel aside={`${shown.length}`}>Events, newest first</SectionLabel>
      {events === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Reading events…</p>}
      {events !== null && shown.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No events in this scope and window.</p>}
      {shown.length > 0 && (
        <ul style={{ marginBlock: 0, paddingInlineStart: 0, listStyle: 'none', display: 'grid', gap: 'var(--sp-3)' }}>
          {shown.map((e) => (
            <li key={e.seq} className="portal-panel">
              <strong>
                #{e.seq} · {e.action}
              </strong>
              <div style={{ color: 'var(--app-dim)' }}>
                {when(e.occurredAt)} · {e.actorKind}
                {e.actor ? ` ${e.actor}` : ''} · tenant {e.tenantId ?? 'platform'} · target {e.target ?? 'none'} · correlation {e.correlationId ?? 'none'} · hash {short(e.hash)}
              </div>
              {Object.keys(e.detail).length > 0 && <code style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(e.detail)}</code>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
