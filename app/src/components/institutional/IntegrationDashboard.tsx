/**
 * The Integration Dashboard: architecture map, connections, mappings, sync
 * history and conflicts, for the staff who hold `integration:view` at their
 * school.
 *
 * What it will not do is part of the design. It never selects a credential,
 * a payload or a student's record (see `lib/integration/dashboard.ts`); an
 * account without the capability sees every domain as "Not connected", which
 * is what RLS returns to it. The map has an equivalent table, every status is
 * a word and a glyph as well as a position, and the only actions are the safe
 * ones — pause, resume, request a replay, export counts — each needing a
 * reason and a second press, and each audited by the database.
 */
import { useEffect, useMemo, useState } from 'react';
import { cloud } from '../../lib/cloud';
import { download } from '../../lib/deliver';
import { syncClassFor } from '../../lib/integration/catalog';
import {
  DIRECTION_TEXT, EMPTY_DASHBOARD, STATUS_TEXT, buildMap, conflicts, connectionFreshness, healthSummary,
  loadDashboard, requestReplay, setPaused, type ConnectionRow, type DashboardData, type MapNode,
} from '../../lib/integration/dashboard';
import { FRESHNESS_TEXT } from '../../lib/integration/freshness';
import { ActionButton, EmptyState, Notice, Segmented, SectionLabel, TabList } from '../ui';
import { ErrorState, LoadingState } from '../unity/States';

type View = 'map' | 'connections' | 'mappings' | 'runs' | 'conflicts';

const VIEWS: readonly { id: View; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'connections', label: 'Connections' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'runs', label: 'Sync history' },
  { id: 'conflicts', label: 'Conflicts' },
];

export interface IntegrationDashboardProps {
  /** Injected in tests; defaults to reading Supabase under the viewer's RLS. */
  load?: () => Promise<DashboardData>;
  pause?: (connection: string, paused: boolean, reason: string) => Promise<string>;
  replay?: (deadLetter: string, reason: string) => Promise<void>;
  now?: Date;
}

const when = (iso: string | null) => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};
const arrow = (n: MapNode) =>
  n.direction === 'bidirectional' ? '⇅' : n.direction === 'approved_write' ? '↑' : n.direction === 'read' ? '↓' : '·';

function Status({ status }: { status: MapNode['status'] }) {
  const s = STATUS_TEXT[status];
  return (
    <span className={status === 'error' || status === 'degraded' ? 'integration-status is-warn' : 'integration-status'}>
      <span aria-hidden="true">{s.glyph}</span> {s.word}
    </span>
  );
}

/** A reason, then a second press. Nothing irreversible and nothing without a reason. */
function Confirmed({ label, onConfirm }: { label: string; onConfirm: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <ActionButton onClick={() => setOpen(true)}>{label}</ActionButton>;
  return (
    <div className="integration-confirm">
      <label>
        Reason (recorded in the audit log)
        <input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </label>
      <ActionButton
        tone="primary"
        disabled={busy || reason.trim().length === 0}
        onClick={() => {
          setBusy(true);
          void onConfirm(reason.trim()).finally(() => { setBusy(false); setOpen(false); setReason(''); });
        }}
      >
        Confirm {label.toLowerCase()}
      </ActionButton>
      <ActionButton tone="ghost" onClick={() => setOpen(false)}>Cancel</ActionButton>
    </div>
  );
}

function ConnectionDetail({ c, data, now, onPause }: {
  c: ConnectionRow; data: DashboardData; now: Date;
  onPause?: (paused: boolean, reason: string) => Promise<void>;
}) {
  const scopes = data.scopes.filter((s) => s.connection_id === c.id);
  const versions = [...new Set(data.mappings.filter((m) => m.connection_id === c.id).map((m) => m.mapping_version))];
  const errors = data.errors.filter((e) => e.connection_id === c.id);
  const fresh = connectionFreshness(c, now);
  return (
    <article className="integration-detail" aria-label={`${c.connection_name} details`}>
      <h4>{c.connection_name}</h4>
      <dl>
        <dt>Status</dt><dd><Status status={c.status} />{c.paused_reason ? ` — ${c.paused_reason}` : ''}</dd>
        <dt>Provider</dt><dd>{c.provider_name}{c.provider_product ? ` · ${c.provider_product}` : ''}</dd>
        <dt>Approval</dt><dd>{c.approved_at ? `Approved ${when(c.approved_at)}` : 'Not approved'}</dd>
        <dt>Owner</dt><dd>{c.owner_account_id ? 'Assigned' : 'Unassigned'}</dd>
        <dt>Direction</dt><dd>{DIRECTION_TEXT[c.sync_direction]} · {c.sync_mode.replace('_', ' ')}</dd>
        <dt>Cadence</dt><dd>{syncClassFor(c.provider_domain).target}</dd>
        <dt>Last successful sync</dt><dd>{when(c.last_successful_sync_at)}</dd>
        <dt>Freshness</dt><dd>{FRESHNESS_TEXT[fresh]}</dd>
        <dt>Classification ceiling</dt><dd>{c.data_classification_ceiling}</dd>
        <dt>Scopes</dt>
        <dd>{scopes.length ? scopes.map((s) => `${s.scope_key} (${s.approved ? 'approved' : 'proposed'})`).join(', ') : 'None'}</dd>
        <dt>Mapping version</dt><dd>{versions.length ? versions.join(', ') : 'No mappings'}</dd>
        <dt>Feature flag</dt><dd>{c.feature_flag_key ?? 'None'}</dd>
        <dt>Open errors</dt><dd>{errors.length}</dd>
      </dl>
      {onPause && c.status !== 'disconnected' && (
        c.status === 'paused'
          ? <Confirmed label="Resume sync" onConfirm={(r) => onPause(false, r)} />
          : <Confirmed label="Pause sync" onConfirm={(r) => onPause(true, r)} />
      )}
    </article>
  );
}

export function IntegrationDashboard({ load, pause, replay, now = new Date() }: IntegrationDashboardProps) {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('map');
  const [shape, setShape] = useState<'diagram' | 'table'>('diagram');
  const [picked, setPicked] = useState<string | null>(null);
  const [errorConnection, setErrorConnection] = useState('all');
  const [errorCategory, setErrorCategory] = useState('all');
  const [errorSeverity, setErrorSeverity] = useState('all');
  const [errorRetry, setErrorRetry] = useState<'all' | 'retryable' | 'not-retryable'>('all');

  const reader = useMemo(() => load ?? (async () => loadDashboard(await cloud())), [load]);
  const refresh = () => {
    setState('loading');
    setLoadError('');
    reader().then((d) => {
      setData(d);
      setErrorConnection('all');
      setErrorCategory('all');
      setErrorSeverity('all');
      setErrorRetry('all');
      setState('ready');
    }, (e: unknown) => {
      setLoadError(e instanceof Error ? e.message : 'Could not load integration status.');
      setState('error');
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [reader]);

  const map = useMemo(() => buildMap(data, now), [data, now]);
  const mappingGroups = useMemo(() => conflicts({ ...EMPTY_DASHBOARD, mappings: data.mappings }), [data.mappings]);
  const node = map.find((n) => n.domain === picked) ?? null;
  const connectionsById = new Map(data.connections.map((connection) => [connection.id, connection]));
  const connectionName = (id: string) => connectionsById.get(id)?.connection_name ?? 'Unknown';
  const errorConnectionOptions = (() => {
    const idsWithErrors = new Set(data.errors.map((error) => error.connection_id));
    const names = data.connections
      .filter((connection) => idsWithErrors.has(connection.id))
      .map((connection) => connection.connection_name);
    const totals = new Map(names.map((name) => [name, names.filter((candidate) => candidate === name).length]));
    const seen = new Map<string, number>();
    const known = data.connections
      .filter((connection) => idsWithErrors.has(connection.id))
      .map((connection, index) => {
        const ordinal = (seen.get(connection.connection_name) ?? 0) + 1;
        seen.set(connection.connection_name, ordinal);
        const total = totals.get(connection.connection_name) ?? 1;
        return {
          token: `connection-${index + 1}`,
          label: total > 1 ? `${connection.connection_name} · ${ordinal} of ${total}` : connection.connection_name,
          connectionId: connection.id,
        };
      });
    return data.errors.some((error) => !connectionsById.has(error.connection_id))
      ? [...known, { token: 'unknown', label: 'Unknown', connectionId: null }]
      : known;
  })();
  const errorCategories = [...new Set(data.errors.map((error) => error.error_category))].sort();
  const errorSeverities = [...new Set(data.errors.map((error) => error.severity))].sort();
  const selectedErrorConnection = errorConnectionOptions.find((option) => option.token === errorConnection);
  const shownErrors = data.errors.filter((error) => (
    (errorConnection === 'all'
      || (selectedErrorConnection?.connectionId === null
        ? !connectionsById.has(error.connection_id)
        : error.connection_id === selectedErrorConnection?.connectionId))
    && (errorCategory === 'all' || error.error_category === errorCategory)
    && (errorSeverity === 'all' || error.severity === errorSeverity)
    && (errorRetry === 'all' || error.retryable === (errorRetry === 'retryable'))
  ));
  const engaged = data.killSwitches.filter((k) => k.engaged);

  const doPause = async (c: ConnectionRow, paused: boolean, reason: string) => {
    try {
      const next = await (pause ?? (async (id, p, r) => setPaused(await cloud(), id, p, r)))(c.public_id, paused, reason);
      setMessage(`${c.connection_name} is now ${next}.`);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The change was refused.');
    }
  };
  const doReplay = async (id: string, reason: string) => {
    try {
      await (replay ?? (async (d, r) => requestReplay(await cloud(), d, r)))(id, reason);
      setMessage('Replay requested. A worker will run it and record the outcome.');
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The replay request was refused.');
    }
  };

  return (
    <section className="integration-dashboard" aria-label="Integration dashboard">
      <div className="control-plane-heading">
        <div>
          <span className="kicker">Integration gateway</span>
          <h2>Connected systems</h2>
          <p>
            Each system stays the source of truth for its own records. Semester shows what it has
            been approved to read, how fresh it is, and what went wrong. You will not find
            credentials or individual students here.
          </p>
        </div>
        <ActionButton
          disabled={state !== 'ready'}
          onClick={() => download({
            name: 'Semester integration health.json',
            mime: 'application/json',
            body: JSON.stringify(healthSummary(data, now), null, 2),
          })}
          style={{ flex: 'none', width: 'auto' }}
        >
          Export health summary
        </ActionButton>
      </div>

      {engaged.length > 0 && (
        <Notice alert>
          Stopped by a kill switch: {engaged.map((k) => `${k.switch_key}${k.tenant_id === null ? ' (every school)' : ''}`).join(', ')}.
        </Notice>
      )}
      {message && <p role="status" className="control-plane-message">{message}</p>}

      {state === 'loading' ? (
        <LoadingState what="integration status" />
      ) : state === 'error' ? (
        <ErrorState
          title="Integration status could not be loaded"
          body={loadError}
          recover={{ label: 'Retry', run: refresh }}
        />
      ) : (
        <>
          <TabList label="Integration views" tabs={VIEWS} value={view} onChange={setView} className="integration-tabs"
            tabClassName={(on) => `integration-tab${on ? ' is-on' : ''}`} />

          <div role="tabpanel" aria-label={VIEWS.find((v) => v.id === view)!.label}>
        {view === 'map' && (
          <>
            <Segmented
              options={[{ id: 'diagram', label: 'Diagram' }, { id: 'table', label: 'Table' }]}
              value={shape}
              onChange={setShape}
              style={{ marginBlock: 'var(--sp-4)' }}
            />
            {shape === 'diagram' ? (
              <div className="integration-map">
                <div className="integration-layer">
                  <strong>Semester</strong>
                  <span>Student: Home · Courses · Study · Calendar · Me — Staff: University</span>
                </div>
                <div className="integration-layer integration-layer-gateway">
                  <strong>Shared integration gateway</strong>
                  <span>Scopes · mapping · sync · retries · freshness · consent · audit · kill switches</span>
                </div>
                <ul className="integration-nodes" aria-label="Connected domains">
                  {map.map((n) => (
                    <li key={n.domain}>
                      <button
                        type="button"
                        className={`integration-node${picked === n.domain ? ' is-on' : ''}`}
                        aria-pressed={picked === n.domain}
                        aria-describedby={`integration-node-${n.domain}`}
                        onClick={() => setPicked(picked === n.domain ? null : n.domain)}
                      >
                        <span className="integration-node-label">{n.label}</span>
                        <Status status={n.status} />
                        <span className="integration-node-meta">
                          <span aria-hidden="true">{arrow(n)}</span> {n.connections.length ? n.connections.map((c) => c.provider_name).join(', ') : 'No provider'}
                          {n.openErrors > 0 ? ` · ${n.openErrors} error${n.openErrors === 1 ? '' : 's'}` : ''}
                        </span>
                      </button>
                      <span id={`integration-node-${n.domain}`} className="sr-only">{n.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="integration-table-wrap">
                <table className="integration-table">
                  <caption className="sr-only">Connected domains, one row per domain</caption>
                  <thead><tr><th scope="col">Domain</th><th scope="col">Status</th><th scope="col">Providers</th>
                    <th scope="col">Direction</th><th scope="col">Ceiling</th><th scope="col">Source of truth</th>
                    <th scope="col">Last sync</th><th scope="col">Freshness</th><th scope="col">Errors</th></tr></thead>
                  <tbody>
                    {map.map((n) => (
                      <tr key={n.domain} data-domain={n.domain}>
                        <th scope="row">{n.label}</th>
                        <td><Status status={n.status} /></td>
                        <td>{n.connections.map((c) => c.provider_name).join(', ') || 'None'}</td>
                        <td>{n.direction ? DIRECTION_TEXT[n.direction] : '—'}</td>
                        <td>{n.ceiling}</td>
                        <td>{n.sourceOfTruth}</td>
                        <td>{when(n.lastSync)}</td>
                        <td>{FRESHNESS_TEXT[n.freshness]}</td>
                        <td>{n.openErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {node && (
              <div className="integration-panel" aria-live="polite">
                <SectionLabel>{node.label}</SectionLabel>
                <p>{node.description}</p>
                {node.flags.length > 0 && <p>Controlled by {node.flags.join(', ')}.</p>}
                {node.connections.map((c) => (
                  <ConnectionDetail key={c.id} c={c} data={data} now={now}
                    onPause={(p, r) => doPause(c, p, r)} />
                ))}
              </div>
            )}
          </>
        )}

        {view === 'connections' && (
          data.connections.length === 0
            ? <EmptyState inline title="No connections visible" body="Either this school has not connected a system yet, or your account does not hold integration:view here." />
            : (
              <div className="integration-table-wrap">
                <table className="integration-table">
                  <caption className="sr-only">Connections</caption>
                  <thead><tr><th scope="col">Connection</th><th scope="col">Provider</th><th scope="col">Domain</th>
                    <th scope="col">Status</th><th scope="col">Mode</th><th scope="col">Direction</th>
                    <th scope="col">Last successful sync</th><th scope="col">Freshness target</th><th scope="col">Ceiling</th>
                    <th scope="col">Scopes</th><th scope="col">Errors</th><th scope="col">Owner</th>
                    <th scope="col">Approval</th><th scope="col">Flag</th></tr></thead>
                  <tbody>
                    {data.connections.map((c) => (
                      <tr key={c.id}>
                        <th scope="row">{c.connection_name}</th>
                        <td>{c.provider_name}</td>
                        <td>{c.provider_domain}</td>
                        <td><Status status={c.status} /></td>
                        <td>{c.sync_mode}</td>
                        <td>{DIRECTION_TEXT[c.sync_direction]}</td>
                        <td>{when(c.last_successful_sync_at)}</td>
                        <td>{c.freshness_target ?? syncClassFor(c.provider_domain).target}</td>
                        <td>{c.data_classification_ceiling}</td>
                        <td>{data.scopes.filter((s) => s.connection_id === c.id && s.approved).length}</td>
                        <td>{data.errors.filter((e) => e.connection_id === c.id).length}</td>
                        <td>{c.owner_account_id ? 'Assigned' : 'Unassigned'}</td>
                        <td>{c.approved_at ? 'Approved' : 'Not approved'}</td>
                        <td>{c.feature_flag_key ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {view === 'mappings' && (
          data.mappings.length === 0
            ? <EmptyState inline title="No field mappings" body="Mappings appear once a connection declares how its records become Semester's canonical entities." />
            : (
              <div className="integration-table-wrap">
                <table className="integration-table">
                  <caption className="sr-only">Entity and field mappings</caption>
                  <thead><tr><th scope="col">Connection</th><th scope="col">External</th><th scope="col">Canonical</th>
                    <th scope="col">Transform</th><th scope="col">Required</th><th scope="col">Version</th>
                    <th scope="col">Validation</th><th scope="col">Conflict</th></tr></thead>
                  <tbody>
                    {data.mappings.map((m, i) => (
                      <tr key={`${m.connection_id}:${m.external_entity_type}:${m.external_field}:${m.mapping_version}:${i}`}>
                        <td>{connectionName(m.connection_id)}</td>
                        <th scope="row">{m.external_entity_type}.{m.external_field}</th>
                        <td>{m.canonical_entity_type}.{m.canonical_field}</td>
                        <td>{String(m.transform_config?.kind ?? 'none')}</td>
                        <td>{m.required ? 'Required' : 'Optional'}</td>
                        <td>{m.mapping_version}{m.active ? '' : ' (inactive)'}</td>
                        <td>{m.validation_state}</td>
                        <td>{m.conflict_kind ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {view === 'runs' && (
          data.runs.length === 0
            ? <EmptyState inline title="No sync runs in this window" body="No sync runs are available in this loaded window. That does not prove no prior sync occurred." />
            : (
              <div className="integration-table-wrap">
                <table className="integration-table">
                  <caption className="sr-only">Sync run history, newest first</caption>
                  <thead><tr><th scope="col">Run</th><th scope="col">Connection</th><th scope="col">Trigger</th>
                    <th scope="col">Status</th><th scope="col">Started</th><th scope="col">Ended</th>
                    <th scope="col">Received / accepted / rejected / changed</th><th scope="col">Errors</th>
                    <th scope="col">Retries</th><th scope="col">Reconciliation</th></tr></thead>
                  <tbody>
                    {data.runs.map((r) => (
                      <tr key={r.public_id}>
                        <th scope="row">{r.public_id}</th>
                        <td>{connectionName(r.connection_id)}</td>
                        <td>{r.trigger_type}</td>
                        <td>{r.status}</td>
                        <td>{when(r.started_at)}</td>
                        <td>{when(r.completed_at)}</td>
                        <td>{r.records_received} / {r.records_created + r.records_updated + r.records_unchanged} / {r.records_rejected} / {r.records_created + r.records_updated}</td>
                        <td>{r.errors_count}</td>
                        <td>{r.retry_count}</td>
                        <td>{r.reconciliation_state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {view === 'conflicts' && (
          <>
            <div className="integration-error-nav" role="group" aria-label="Error investigation">
              <ActionButton tone="ghost" onClick={() => setView('runs')}>Sync history</ActionButton>
              {data.deadLetters.length > 0 && <a className="btn btn-ghost" href="#integration-dead-letters">Dead letters</a>}
            </div>
            <p className="integration-conflict-note">
              Sync errors and mapping conflicts are separate. Their counts can differ, and this view is not a complete history.
            </p>
            <SectionLabel>Sync errors</SectionLabel>
            {data.errors.length === 0 ? (
              <EmptyState
                inline
                title="No sync error rows in this window"
                body="No unresolved sync error rows are available in this loaded window. That does not prove prior syncs succeeded."
              />
            ) : (
              <>
                <p className="integration-error-window" role="status">
                  {data.errors.length === 200
                    ? `Showing ${shownErrors.length} of the newest 200 unresolved sync errors available to your account. Earlier unresolved errors may exist.`
                    : `Showing ${shownErrors.length} of ${data.errors.length} unresolved sync errors in the loaded window. Up to 200 newest rows are loaded; earlier unresolved errors may exist.`}
                </p>
                <fieldset className="integration-error-filters">
                  <legend>Filter sync errors</legend>
                  <label>
                    <span>Connection</span>
                    <select value={errorConnection} onChange={(event) => setErrorConnection(event.target.value)}>
                      <option value="all">All connections</option>
                      {errorConnectionOptions.map((option) => (
                        <option key={option.token} value={option.token}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Category</span>
                    <select value={errorCategory} onChange={(event) => setErrorCategory(event.target.value)}>
                      <option value="all">All categories</option>
                      {errorCategories.map((category) => (
                        <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Severity</span>
                    <select value={errorSeverity} onChange={(event) => setErrorSeverity(event.target.value)}>
                      <option value="all">All severities</option>
                      {errorSeverities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Retry status</span>
                    <select value={errorRetry} onChange={(event) => setErrorRetry(event.target.value as typeof errorRetry)}>
                      <option value="all">All retry states</option>
                      <option value="retryable">Retryable</option>
                      <option value="not-retryable">Not retryable</option>
                    </select>
                  </label>
                </fieldset>
                {shownErrors.length === 0 ? (
                  <EmptyState inline title="No matching sync errors" body="No loaded sync error matches all four filters. Clear or change a filter to see the loaded window." />
                ) : (
                  <ul className="integration-error-list" aria-label="Unresolved sync errors">
                    {shownErrors.map((error) => (
                      <li key={error.id}>
                        <details>
                          <summary>{connectionName(error.connection_id)} · {error.error_category.replace(/_/g, ' ')}</summary>
                          <dl>
                            <dt>Category</dt><dd>{error.error_category.replace(/_/g, ' ')}</dd>
                            <dt>Severity</dt><dd>{error.severity}</dd>
                            <dt>Retry status</dt>
                            <dd>
                              {error.retryable ? 'Retryable' : 'Not retryable'} · {error.retry_count} {error.retry_count === 1 ? 'retry' : 'retries'}
                            </dd>
                            <dt>Recorded</dt><dd>{when(error.created_at)}</dd>
                          </dl>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <SectionLabel>Mapping conflicts</SectionLabel>
            {mappingGroups.length === 0 ? (
              <EmptyState inline title="No mapping conflicts" body="No loaded field mapping currently reports a conflict." />
            ) : (
              <div className="integration-table-wrap">
                <table className="integration-table" aria-label="Mapping conflicts">
                  <caption className="sr-only">Mapping conflicts by kind</caption>
                  <thead><tr><th scope="col">Kind</th><th scope="col">Count</th><th scope="col">Connections</th><th scope="col">Latest</th></tr></thead>
                  <tbody>
                    {mappingGroups.map((g) => (
                      <tr key={g.kind}><th scope="row">{g.kind.replace(/_/g, ' ')}</th><td>{g.count}</td><td>{g.connections}</td><td>{when(g.latest || null)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <section id="integration-dead-letters">
              <SectionLabel>Dead letters</SectionLabel>
              {data.deadLetters.length === 0 ? (
                <EmptyState
                  inline
                  title="No dead letters in this loaded window"
                  body="No unresolved dead-letter rows are available here. That does not establish a complete sync history."
                />
              ) : (
                <ul className="integration-dead-letters">
                  {data.deadLetters.map((d) => (
                    <li key={d.id}>
                      <span>{connectionName(d.connection_id)} — {d.attempts} attempts, recorded {when(d.created_at)}</span>
                      {d.replay_requested_at
                        ? <span>Replay requested {when(d.replay_requested_at)}</span>
                        : <Confirmed label="Request replay" onConfirm={(r) => doReplay(d.id, r)} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
          </div>
        </>
      )}
    </section>
  );
}
