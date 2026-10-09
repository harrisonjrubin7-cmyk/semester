import { useEffect, useId, useMemo, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState, PermissionNotice } from '../unity/States';
import {
  loadTenantOperations,
  loadTenantProjection,
  type TenantOperationFact,
  type TenantProjectionEnvelope,
} from '../../lib/console/client';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

type Freshness = 'current' | 'stale' | 'missing';
const RESPONSIVE_COLUMNS = 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))';

/** Missing and invalid timestamps fail closed; an exact boundary timestamp is still current. */
export function freshnessOf(fact: TenantOperationFact, now = new Date()): Freshness {
  if (!fact.observedAt || fact.staleAfterDays < 1) return 'missing';
  const observed = new Date(fact.observedAt);
  if (Number.isNaN(observed.getTime()) || observed.getTime() > now.getTime()) return 'missing';
  const age = now.getTime() - observed.getTime();
  return age > fact.staleAfterDays * 86_400_000 ? 'stale' : 'current';
}

interface TenantOperationsProps extends ViewProps {
  now?: Date;
  read?: (includeDemo?: boolean) => Promise<TenantOperationFact[]>;
  readProjection?: (tenantId: string, afterCapability?: string | null, limit?: number) => Promise<TenantProjectionEnvelope>;
}

interface TenantProjectionProps {
  tenantId: string;
  tenantName: string;
  onStatus: (said: string) => void;
  read: NonNullable<TenantOperationsProps['readProjection']>;
}

function TenantProjection({ tenantId, tenantName, onStatus, read }: TenantProjectionProps) {
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<TenantProjectionEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (cursor: string | null = null) => {
    setLoading(true);
    setError('');
    try {
      const next = await read(tenantId, cursor, 50);
      setSnapshot((current) => cursor && current
        ? {
            ...next,
            data: {
              ...next.data,
              entitlements: [...current.data.entitlements, ...next.data.entitlements],
            },
          }
        : next);
    } catch (caught) {
      const detail = said(caught, 'Could not read the tenant projection.');
      setError(detail);
      onStatus(detail);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !snapshot && !loading) void load();
  };

  const denied = /required|permission|denied|not authorized/i.test(error);
  const empty = snapshot && snapshot.data.entitlements.length === 0 && snapshot.data.rollout === null;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={toggle}
      >
        {open ? 'Close projected state' : 'View projected state'}
      </button>

      {open && (
        <section
          id={regionId}
          aria-label={`Projected state for ${tenantName || tenantId}`}
          className="portal-panel"
          style={{ display: 'grid', gap: 'var(--sp-4)' }}
        >
          <div>
            <strong>Projected state · read only</strong>
            <p style={{ marginBottom: 0, color: 'var(--app-dim)' }}>
              This is an operational projection, not the authoritative tenant policy or rollout record. It cannot be exported or changed here.
            </p>
          </div>

          {loading && !snapshot && <LoadingState what={`projected state for ${tenantName || tenantId}`} />}

          {error && denied && (
            <PermissionNotice
              changed="Projected state is unavailable"
              why="The database did not confirm permission for this exact tenant. No projected records are shown."
              control={{ label: 'Check access again', run: () => { void load(); } }}
            />
          )}

          {error && !denied && (
            <ErrorState
              title="Projected state could not be loaded"
              body="No cached projection is shown. The authoritative tenant records are unchanged."
              recover={{ label: 'Try again', run: () => { void load(); } }}
              busy={loading}
            />
          )}

          {!error && snapshot && snapshot.meta.freshness !== 'fresh' && (
            <Notice alert={snapshot.meta.freshness === 'failed'}>
              Projection freshness is {snapshot.meta.freshness}. Verify the source records before any consequential action.
            </Notice>
          )}

          {!error && snapshot && snapshot.warnings.map((warning) => <Notice key={warning}>{warning}</Notice>)}

          {!error && empty && (
            <EmptyState
              inline
              title="No projected state"
              body={snapshot.meta.freshness === 'unknown'
                ? 'No rollout or entitlement rows have been materialized for this tenant. This is unknown, not fresh or active.'
                : `No rollout or entitlement rows are present. The projection reports ${snapshot.meta.freshness}; verify the authoritative records before inferring tenant state.`}
              action={{ label: 'Read again', onClick: () => { void load(); } }}
            />
          )}

          {!error && snapshot && !empty && (
            <>
              <Fields
                label={`Projection evidence for ${tenantName || tenantId}`}
                items={[
                  { field: 'Authority', value: 'Projection · read only · no export' },
                  { field: 'Overall freshness', value: snapshot.meta.freshness },
                  { field: 'Source updated', value: when(snapshot.meta.sourceUpdatedAt, 'unknown') },
                  { field: 'Computed', value: when(snapshot.meta.computedAt, 'unknown') },
                  { field: 'Entitlement model', value: `v${snapshot.meta.coverage.entitlements.modelVersion} · ${snapshot.meta.coverage.entitlements.freshness} · worker ${snapshot.meta.coverage.entitlements.workerStatus}` },
                  { field: 'Rollout model', value: `v${snapshot.meta.coverage.rollout.modelVersion} · ${snapshot.meta.coverage.rollout.freshness} · worker ${snapshot.meta.coverage.rollout.workerStatus}` },
                  { field: 'Correlation', value: snapshot.meta.correlationId },
                ]}
              />

              <section aria-label={`Rollout projection for ${tenantName || tenantId}`} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                <SectionLabel>Rollout projection</SectionLabel>
                {snapshot.data.rollout ? (
                  <Fields
                    label={`Rollout fields for ${tenantName || tenantId}`}
                    items={[
                      { field: 'State', value: snapshot.data.rollout.state },
                      { field: 'Resume state', value: snapshot.data.rollout.resumeState ?? 'none' },
                      { field: 'Revision', value: snapshot.data.rollout.revision },
                      { field: 'Source occurred', value: when(snapshot.data.rollout.sourceOccurredAt, 'unknown') },
                      { field: 'Projected', value: when(snapshot.data.rollout.projectedAt, 'unknown') },
                    ]}
                  />
                ) : <p role="status">No rollout projection is present.</p>}
              </section>

              <section aria-label={`Entitlement projections for ${tenantName || tenantId}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                <SectionLabel aside={`${snapshot.data.entitlements.length} loaded`}>Entitlement projections</SectionLabel>
                {snapshot.data.entitlements.length === 0
                  ? <p role="status">No entitlement projections are present.</p>
                  : (
                      <div style={{ display: 'grid', gridTemplateColumns: RESPONSIVE_COLUMNS, gap: 'var(--sp-3)' }}>
                        {snapshot.data.entitlements.map((entitlement) => (
                          <article key={entitlement.capability} style={{ paddingTop: 'var(--sp-3)' }}>
                            <strong>{entitlement.capability}</strong>
                            <Fields
                              label={`Projection for ${entitlement.capability}`}
                              items={[
                                { field: 'State', value: entitlement.deleted ? 'deleted' : entitlement.state },
                                { field: 'Revision', value: entitlement.revision },
                                { field: 'Source occurred', value: when(entitlement.sourceOccurredAt, 'unknown') },
                                { field: 'Projected', value: when(entitlement.projectedAt, 'unknown') },
                              ]}
                            />
                          </article>
                        ))}
                      </div>
                    )}
                {snapshot.meta.coverage.entitlements.hasMore && snapshot.meta.coverage.entitlements.nextCursor && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={loading}
                    onClick={() => { void load(snapshot.meta.coverage.entitlements.nextCursor); }}
                  >
                    {loading ? 'Loading more…' : 'Load more entitlements'}
                  </button>
                )}
              </section>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * A metadata-only tenant and pilot operations workspace.
 *
 * The server derives every tenant from live exact-school grants. This view has
 * no tenant-id input and renders the server's access basis beside every fact.
 */
export function TenantOperations({
  env,
  scope,
  filter,
  onStatus,
  now,
  read = loadTenantOperations,
  readProjection = loadTenantProjection,
}: TenantOperationsProps) {
  const [openedAt] = useState(() => new Date());
  const [includeDemo, setIncludeDemo] = useState(false);
  const [facts, setFacts] = useState<TenantOperationFact[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    read(env === 'Production' ? false : includeDemo).then(
      (rows) => {
        if (!live) return;
        setFacts(rows);
        setError('');
      },
      (caught: unknown) => {
        if (!live) return;
        const detail = said(caught, 'Could not read tenant operations.');
        setFacts([]);
        setError(detail);
        onStatus(detail);
      },
    );
    return () => { live = false; };
  }, [env, includeDemo, onStatus, read, reload]);

  const refresh = () => {
    setFacts(null);
    setError('');
    setReload((value) => value + 1);
  };

  const tenants = useMemo(() => {
    const grouped = new Map<string, { name: string; demo: boolean; facts: TenantOperationFact[] }>();
    for (const fact of facts ?? []) {
      if (!inScope(scope, fact.tenantId)) continue;
      if (!matches(filter, fact.tenantId, fact.tenantName, fact.label, fact.value, fact.owner, fact.category)) continue;
      const group = grouped.get(fact.tenantId) ?? { name: fact.tenantName, demo: fact.isDemo, facts: [] };
      group.facts.push(fact);
      grouped.set(fact.tenantId, group);
    }
    return [...grouped.entries()];
  }, [facts, filter, scope]);

  if (facts === null) return <p role="status">Loading tenant operations…</p>;

  const denied = /required|permission|denied|not authorized/i.test(error);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(event) => setIncludeDemo(event.target.checked)}
            />
            Include demo tenants explicitly
          </label>
        )}
        <button
          type="button"
          className="btn"
          style={{ color: 'var(--app-fg)', borderColor: 'var(--app-line)' }}
          onClick={refresh}
        >
          Refresh tenant operations
        </button>
      </div>

      {error && (
        <Notice alert>
          {denied
            ? 'Access denied. Tenant operations requires both the platform console shell and a live implementation grant for an exact school.'
            : 'Tenant operations could not be loaded. No records are shown.'}
        </Notice>
      )}

      {!error && tenants.length === 0 && (
        <Notice>No tenant operations are available in this grant scope. No example or cross-tenant records are shown.</Notice>
      )}

      {tenants.map(([tenantId, tenant]) => (
        <section key={tenantId} aria-label={`Tenant operations ${tenant.name || tenantId}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={`${tenant.facts.length} facts`}>
            {tenant.name || tenantId}{tenant.demo ? ' (demo)' : ''}
          </SectionLabel>
          <div style={{ color: 'var(--app-dim)' }}>Tenant {tenantId}</div>

          <TenantProjection
            tenantId={tenantId}
            tenantName={tenant.name}
            onStatus={onStatus}
            read={readProjection}
          />

          <div style={{ display: 'grid', gridTemplateColumns: RESPONSIVE_COLUMNS, gap: 'var(--sp-3)' }}>
            {tenant.facts.map((fact) => {
              const freshness = freshnessOf(fact, now ?? openedAt);
              return (
                <article
                  key={fact.factKey}
                  className="portal-panel"
                  aria-label={`${fact.label} for ${tenant.name || tenantId}`}
                  style={{ display: 'grid', gap: 'var(--sp-3)', alignContent: 'start' }}
                >
                  <div>
                    <strong>{fact.label}</strong>
                    <div style={{ marginTop: 'var(--sp-2)' }}>{fact.value}</div>
                  </div>
                  <Fields
                    label={`Evidence for ${fact.label}`}
                    items={[
                      { field: 'Classification', value: fact.classification || 'missing' },
                      { field: 'Provenance', value: fact.provenance || 'missing' },
                      { field: 'Owner', value: fact.owner || 'missing' },
                      { field: 'Freshness', value: `${freshness} — observed ${when(fact.observedAt, 'never')}; stale after ${fact.staleAfterDays || '?'} day(s)` },
                      { field: 'Why visible', value: fact.visibilityReason || 'missing' },
                      { field: 'Limitation', value: fact.limitation || 'missing' },
                    ]}
                  />
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
