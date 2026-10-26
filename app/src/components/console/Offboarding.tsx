import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState, PermissionNotice } from '../unity/States';
import {
  loadOffboardingCases,
  previewSchoolPurge,
  type OffboardingCase,
  type PurgePreviewEnvelope,
} from '../../lib/console/client';
import { Fields, inScope, matches, said, short, when, type ViewProps } from './Fields';

const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const denied = (message: string) => /required|permission|denied|not authorized/i.test(message);

interface OffboardingProps extends ViewProps {
  read?: () => Promise<OffboardingCase[]>;
  preview?: (caseId: string, idempotencyKey: string) => Promise<PurgePreviewEnvelope>;
}

/**
 * Synthetic-only evidence workspace. There is intentionally no purge,
 * authorize, confirm, or delete control in this component.
 */
export function Offboarding({
  scope,
  filter,
  onStatus,
  read = loadOffboardingCases,
  preview = previewSchoolPurge,
}: OffboardingProps) {
  const [cases, setCases] = useState<OffboardingCase[] | null>(null);
  const [queueError, setQueueError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [result, setResult] = useState<PurgePreviewEnvelope | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await read();
      setCases(next);
      setQueueError('');
    } catch (caught) {
      const message = said(caught, 'Could not read synthetic offboarding cases.');
      setCases(null);
      setSelected(null);
      setResult(null);
      setQueueError(message);
      onStatus(message);
    }
  }, [onStatus, read]);

  // Account-backed queue state, loaded only when the capability-gated view opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(
    () => (cases ?? []).filter((entry) => inScope(scope, entry.tenantId) && matches(
      filter,
      entry.tenantId,
      entry.tenantName,
      entry.caseId,
      entry.status,
    )),
    [cases, filter, scope],
  );

  const choose = (caseId: string | null) => {
    setSelected(caseId);
    setIdempotencyKey('');
    setResult(null);
    setPreviewError('');
  };

  const runPreview = async (entry: OffboardingCase) => {
    if (!KEY.test(idempotencyKey)) {
      setPreviewError('Use 8–120 letters, numbers, dots, colons, underscores, or hyphens.');
      return;
    }
    setBusy(true);
    setPreviewError('');
    setResult(null);
    try {
      const next = await preview(entry.caseId, idempotencyKey);
      setResult(next);
      onStatus(next.replayed
        ? `Replayed dry-run receipt ${next.receiptId}. No records changed.`
        : `Created dry-run receipt ${next.receiptId}. No records changed.`);
      await refresh();
    } catch (caught) {
      const message = said(caught, 'Could not create the purge preview.');
      setPreviewError(message);
      onStatus(message);
    } finally {
      setBusy(false);
    }
  };

  if (cases === null && !queueError) return <LoadingState what="synthetic offboarding cases" />;

  if (queueError && denied(queueError)) {
    return (
      <PermissionNotice
        changed="Offboarding preview is unavailable"
        why="Platform console and configuration authority are both required. No case metadata is shown."
        control={{ label: 'Check access again', run: () => { void refresh(); } }}
      />
    );
  }

  if (queueError) {
    return (
      <ErrorState
        title="Offboarding cases could not be loaded"
        body="No cached case metadata is shown."
        recover={{ label: 'Try again', run: () => { void refresh(); } }}
      />
    );
  }

  return (
    <section aria-label="Synthetic offboarding purge preview" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <Notice>
        Synthetic demo tenants only. This workspace creates an audited read-only dry run. It cannot authorize,
        enable, or execute deletion of any record.
      </Notice>

      {shown.length === 0 ? (
        <EmptyState
          inline
          title="No synthetic offboarding cases"
          body="Only archived or export-stage cases for tenants marked as demo can appear here."
          action={{ label: 'Read again', onClick: () => { void refresh(); } }}
        />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={`${shown.length} synthetic ${shown.length === 1 ? 'case' : 'cases'}`}>Offboarding cases</SectionLabel>
          {shown.map((entry) => {
            const open = selected === entry.caseId;
            const regionId = `offboarding-${entry.caseId}`;
            return (
              <article key={entry.caseId} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                <div>
                  <strong>{entry.tenantName || entry.tenantId}</strong>
                  <p style={{ marginBlock: 'var(--sp-1) 0', color: 'var(--app-dim)' }}>
                    Synthetic tenant · {entry.status}
                  </p>
                </div>
                <Fields
                  label={`Offboarding evidence for ${entry.tenantName || entry.tenantId}`}
                  items={[
                    { field: 'Tenant', value: entry.tenantId },
                    { field: 'Case', value: entry.caseId },
                    { field: 'Retention ends', value: when(entry.retainUntil, 'not recorded') },
                    { field: 'Live legal holds', value: entry.liveLegalHolds },
                    { field: 'Export verified', value: when(entry.exportVerifiedAt, 'not verified') },
                    { field: 'Manifest', value: short(entry.manifestSha256) },
                    { field: 'Package', value: short(entry.packageSha256) },
                    { field: 'Purge authorization', value: when(entry.purgeAuthorizedAt, 'not authorized') },
                    { field: 'Latest preview', value: when(entry.latestPreviewAt, 'none') },
                    { field: 'Access basis', value: entry.accessBasis },
                  ]}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={open}
                  aria-controls={regionId}
                  onClick={() => choose(open ? null : entry.caseId)}
                >
                  {open ? 'Close dry run' : 'Open dry run'}
                </button>

                {open && (
                  <section id={regionId} aria-label={`Purge dry run for ${entry.tenantName || entry.tenantId}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                    {entry.status !== 'archived' ? (
                      <Notice alert>
                        This case is {entry.status}, not archived. Preview is unavailable and no records changed.
                      </Notice>
                    ) : (
                      <>
                        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                          Reviewed idempotency key
                          <input
                            className="input"
                            value={idempotencyKey}
                            minLength={8}
                            maxLength={120}
                            pattern="[A-Za-z0-9][A-Za-z0-9._:-]{7,119}"
                            autoComplete="off"
                            aria-describedby={`${regionId}-key-help`}
                            onChange={(event) => {
                              setIdempotencyKey(event.target.value);
                              setPreviewError('');
                              setResult(null);
                            }}
                          />
                        </label>
                        <p id={`${regionId}-key-help`} style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
                          Reuse the same key only to replay the same operator-bound snapshot. If evidence changes, use a new reviewed key.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy || !KEY.test(idempotencyKey)}
                          onClick={() => { void runPreview(entry); }}
                        >
                          {busy ? 'Creating read-only preview…' : 'Create read-only preview'}
                        </button>
                      </>
                    )}

                    {previewError && (
                      <ErrorState
                        title="Preview was not created"
                        body={`${previewError} No records changed.`}
                        recover={{ label: 'Try preview again', run: () => { void runPreview(entry); } }}
                        secondary={{ label: 'Read case again', run: () => { void refresh(); } }}
                        busy={busy}
                      />
                    )}

                    {result && <PreviewResult result={result} />}
                  </section>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PreviewResult({ result }: { result: PurgePreviewEnvelope }) {
  const p = result.preview;
  const tables = Object.entries(p.affectedRecords.tables).sort(([a], [b]) => a.localeCompare(b));
  return (
    <section aria-label="Purge preview result" aria-live="polite" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <Notice alert>
        Destructive action unavailable. {p.destructiveAction.reason}
      </Notice>
      <Fields
        label="Preview receipt"
        items={[
          { field: 'Receipt', value: result.receiptId },
          { field: 'Generated', value: when(result.generatedAt) },
          { field: 'Replay', value: result.replayed ? 'yes — identical stored receipt' : 'no — new receipt' },
          { field: 'Snapshot', value: short(result.snapshotSha256) },
          { field: 'Synthetic only', value: p.syntheticOnly ? 'yes' : 'no' },
          { field: 'Legal hold', value: `${p.legalHold.status} · ${p.legalHold.liveCount} live` },
          { field: 'Retention', value: `${p.retention.status} · ${when(p.retention.retainUntil, 'not recorded')}` },
          { field: 'Export manifest', value: `${p.exportManifest.integrity} · counts ${p.exportManifest.currentCountsMatch ? 'match' : 'do not match'}` },
          { field: 'Separation recorded', value: p.approval.separationRecorded ? 'yes' : 'no' },
          { field: 'Purge authorization', value: when(p.approval.purgeAuthorizedAt, 'not authorized') },
          { field: 'Future review conditions', value: p.conditionsSatisfiedForFutureReview ? 'satisfied for review only' : 'blocked' },
          { field: 'Blockers', value: p.blockers.length ? p.blockers.join(', ') : 'none' },
        ]}
      />
      <section aria-label="Exact affected-record summary" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        <SectionLabel aside={`${p.affectedRecords.totalRecords} total`}>Affected records</SectionLabel>
        {tables.length === 0 ? (
          <p role="status">No tenant-scoped records were counted.</p>
        ) : (
          <ul style={{ marginBlock: 0 }}>
            {tables.map(([table, count]) => <li key={table}><span className="nums">{count}</span> · {table}</li>)}
          </ul>
        )}
      </section>
      <p role="status">{p.fallback}</p>
    </section>
  );
}
