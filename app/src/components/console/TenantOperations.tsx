import { useEffect, useMemo, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { loadTenantOperations, type TenantOperationFact } from '../../lib/console/client';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

type Freshness = 'current' | 'stale' | 'missing';

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))', gap: 'var(--sp-3)' }}>
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
