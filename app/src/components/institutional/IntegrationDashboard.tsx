import { RecordTable, tableText, type TableRecord } from '../HumanTable';
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
  DIRECTION_TEXT, EMPTY_DASHBOARD, MAP_DOMAINS, STATUS_TEXT, buildMap, conflicts, connectionFreshness, healthSummary,
  loadDashboard, requestReplay, setPaused, type ConnectionRow, type DashboardData, type MapNode,
} from '../../lib/integration/dashboard';
import { FRESHNESS_TEXT } from '../../lib/integration/freshness';
import { ActionButton, EmptyState, Notice, Segmented, SectionLabel, TabList } from '../ui';

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

const when = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '—');
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
  const [view, setView] = useState<View>('map');
  const [shape, setShape] = useState<'diagram' | 'table'>('diagram');
  const [picked, setPicked] = useState<string | null>(null);

  const reader = useMemo(() => load ?? (async () => loadDashboard(await cloud())), [load]);
  const refresh = () => {
    setState('loading');
    reader().then((d) => { setData(d); setState('ready'); }, (e: unknown) => {
      setMessage(e instanceof Error ? e.message : 'Could not load integration status.');
      setState('error');
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [reader]);

  const map = useMemo(() => buildMap(data, now), [data, now]);
  const groups = useMemo(() => conflicts(data), [data]);
  const node = map.find((n) => n.domain === picked) ?? null;
  const connectionName = (id: string) => data.connections.find((c) => c.id === id)?.connection_name ?? 'Unknown';
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
      {state === 'error' && <Notice alert>{message}</Notice>}
      {state !== 'error' && message && <p role="status" className="control-plane-message">{message}</p>}

      <TabList label="Integration views" tabs={VIEWS} value={view} onChange={setView} className="integration-tabs"
        tabClassName={(on) => `integration-tab${on ? ' is-on' : ''}`} />

      <div role="tabpanel" aria-label={VIEWS.find((v) => v.id === view)!.label} aria-busy={state === 'loading'}>
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
                <RecordTable
                  exportAllowed={false}
                  exportReason="Use Export health summary for the approved counts and states. Detailed working downloads are unavailable."
                  id="integration-domains"
                  label={'Connected domains, one row per domain'}
                  tableProps={{ className: 'integration-table' }}
                  caption={<> Connected domains, one row per domain</>}
                  columns={[
                    { id: 'column-0', label: 'Domain', persistFilterValues: MAP_DOMAINS.map((d) => d.label) },
                    { id: 'column-1', label: 'Status', persistFilterValues: Object.values(STATUS_TEXT).map((s) => s.word) },
                    { id: 'column-2', label: 'Providers' },
                    { id: 'column-3', label: 'Direction' },
                    { id: 'column-4', label: 'Ceiling' },
                    { id: 'column-5', label: 'Source of truth' },
                    { id: 'column-6', label: 'Last sync' },
                    { id: 'column-7', label: 'Freshness' },
                    { id: 'column-8', label: 'Errors' },
                  ]}
                  rows={[
                    ...map.map(
                      (n) =>
                        ({
                          id: String(n.domain),
                          props: { 'data-domain': n.domain },
                          cells: [
                            { value: tableText(n.label), content: <>{n.label}</>, header: true },
                            {
                              value: STATUS_TEXT[n.status].word,
                              content: (
                                <>
                                  <Status status={n.status} />
                                </>
                              ),
                            },
                            {
                              value: tableText(n.connections.map((c) => c.provider_name).join(', ') || 'None'),
                              content: <>{n.connections.map((c) => c.provider_name).join(', ') || 'None'}</>,
                            },
                            {
                              value: tableText(n.direction ? DIRECTION_TEXT[n.direction] : '—'),
                              content: <>{n.direction ? DIRECTION_TEXT[n.direction] : '—'}</>,
                            },
                            { value: tableText(n.ceiling), content: <>{n.ceiling}</> },
                            { value: tableText(n.sourceOfTruth), content: <>{n.sourceOfTruth}</> },
                            { value: tableText(when(n.lastSync)), content: <>{when(n.lastSync)}</> },
                            { value: tableText(FRESHNESS_TEXT[n.freshness]), content: <>{FRESHNESS_TEXT[n.freshness]}</> },
                            { value: tableText(n.openErrors), content: <>{n.openErrors}</> },
                          ],
                        }) satisfies TableRecord,
                    ),
                  ]}
                />
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
                <RecordTable
                exportAllowed={false}
                exportReason="Use Export health summary for the approved counts and states. Detailed working downloads are unavailable."
                id="integration-connections"
                label={'Connections'}
                tableProps={{ className: 'integration-table' }}
                caption={<> Connections</>}
                columns={[
                  { id: 'column-0', label: 'Connection' },
                  { id: 'column-1', label: 'Provider' },
                  { id: 'column-2', label: 'Domain' },
                  { id: 'column-3', label: 'Status', persistFilterValues: Object.values(STATUS_TEXT).map((s) => s.word) },
                  { id: 'column-4', label: 'Mode' },
                  { id: 'column-5', label: 'Direction' },
                  { id: 'column-6', label: 'Last successful sync' },
                  { id: 'column-7', label: 'Freshness target' },
                  { id: 'column-8', label: 'Ceiling' },
                  { id: 'column-9', label: 'Scopes' },
                  { id: 'column-10', label: 'Errors' },
                  { id: 'column-11', label: 'Owner' },
                  { id: 'column-12', label: 'Approval' },
                  { id: 'column-13', label: 'Flag' },
                ]}
                rows={[
                  ...data.connections.map(
                    (c) =>
                      ({
                        id: String(c.id),
                        cells: [
                          { value: tableText(c.connection_name), content: <>{c.connection_name}</>, header: true },
                          { value: tableText(c.provider_name), content: <>{c.provider_name}</> },
                          { value: tableText(c.provider_domain), content: <>{c.provider_domain}</> },
                          {
                            value: STATUS_TEXT[c.status].word,
                            content: (
                              <>
                                <Status status={c.status} />
                              </>
                            ),
                          },
                          { value: tableText(c.sync_mode), content: <>{c.sync_mode}</> },
                          { value: tableText(DIRECTION_TEXT[c.sync_direction]), content: <>{DIRECTION_TEXT[c.sync_direction]}</> },
                          { value: tableText(when(c.last_successful_sync_at)), content: <>{when(c.last_successful_sync_at)}</> },
                          {
                            value: tableText(c.freshness_target ?? syncClassFor(c.provider_domain).target),
                            content: <>{c.freshness_target ?? syncClassFor(c.provider_domain).target}</>,
                          },
                          { value: tableText(c.data_classification_ceiling), content: <>{c.data_classification_ceiling}</> },
                          {
                            value: tableText(data.scopes.filter((s) => s.connection_id === c.id && s.approved).length),
                            content: <>{data.scopes.filter((s) => s.connection_id === c.id && s.approved).length}</>,
                          },
                          {
                            value: tableText(data.errors.filter((e) => e.connection_id === c.id).length),
                            content: <>{data.errors.filter((e) => e.connection_id === c.id).length}</>,
                          },
                          {
                            value: tableText(c.owner_account_id ? 'Assigned' : 'Unassigned'),
                            content: <>{c.owner_account_id ? 'Assigned' : 'Unassigned'}</>,
                          },
                          {
                            value: tableText(c.approved_at ? 'Approved' : 'Not approved'),
                            content: <>{c.approved_at ? 'Approved' : 'Not approved'}</>,
                          },
                          { value: tableText(c.feature_flag_key ?? '—'), content: <>{c.feature_flag_key ?? '—'}</> },
                        ],
                      }) satisfies TableRecord,
                  ),
                ]}
              />
              </div>
            )
        )}

        {view === 'mappings' && (
          data.mappings.length === 0
            ? <EmptyState inline title="No field mappings" body="Mappings appear once a connection declares how its records become Semester's canonical entities." />
            : (
              <div className="integration-table-wrap">
                <RecordTable
                exportAllowed={false}
                exportReason="Use Export health summary for the approved counts and states. Detailed working downloads are unavailable."
                id="integration-mappings"
                label={'Entity and field mappings'}
                tableProps={{ className: 'integration-table' }}
                caption={<> Entity and field mappings</>}
                columns={[
                  { id: 'column-0', label: 'Connection' },
                  { id: 'column-1', label: 'External' },
                  { id: 'column-2', label: 'Canonical' },
                  { id: 'column-3', label: 'Transform' },
                  { id: 'column-4', label: 'Required' },
                  { id: 'column-5', label: 'Version' },
                  { id: 'column-6', label: 'Validation' },
                  { id: 'column-7', label: 'Conflict' },
                ]}
                rows={[
                  ...data.mappings.map(
                    (m, i) =>
                      ({
                        id: String(`${m.connection_id}:${m.external_entity_type}:${m.external_field}:${m.mapping_version}:${i}`),
                        cells: [
                          { value: tableText(connectionName(m.connection_id)), content: <>{connectionName(m.connection_id)}</> },
                          {
                            value: tableText([m.external_entity_type, '.', m.external_field]),
                            content: (
                              <>
                                {m.external_entity_type}.{m.external_field}
                              </>
                            ),
                            header: true,
                          },
                          {
                            value: tableText([m.canonical_entity_type, '.', m.canonical_field]),
                            content: (
                              <>
                                {m.canonical_entity_type}.{m.canonical_field}
                              </>
                            ),
                          },
                          {
                            value: tableText(String(m.transform_config?.kind ?? 'none')),
                            content: <>{String(m.transform_config?.kind ?? 'none')}</>,
                          },
                          { value: tableText(m.required ? 'Required' : 'Optional'), content: <>{m.required ? 'Required' : 'Optional'}</> },
                          {
                            value: tableText([m.mapping_version, m.active ? '' : ' (inactive)']),
                            content: (
                              <>
                                {m.mapping_version}
                                {m.active ? '' : ' (inactive)'}
                              </>
                            ),
                          },
                          { value: tableText(m.validation_state), content: <>{m.validation_state}</> },
                          { value: tableText(m.conflict_kind ?? '—'), content: <>{m.conflict_kind ?? '—'}</> },
                        ],
                      }) satisfies TableRecord,
                  ),
                ]}
              />
              </div>
            )
        )}

        {view === 'runs' && (
          data.runs.length === 0
            ? <EmptyState inline title="No sync runs" body="Nothing has synced. A run appears here the first time an approved connection is read." />
            : (
              <div className="integration-table-wrap">
                <RecordTable
                exportAllowed={false}
                exportReason="Use Export health summary for the approved counts and states. Detailed working downloads are unavailable."
                id="integration-runs"
                label={'Sync run history, newest first'}
                tableProps={{ className: 'integration-table' }}
                caption={<> Sync run history, newest first</>}
                columns={[
                  { id: 'column-0', label: 'Run' },
                  { id: 'column-1', label: 'Connection' },
                  { id: 'column-2', label: 'Trigger' },
                  { id: 'column-3', label: 'Status' },
                  { id: 'column-4', label: 'Started' },
                  { id: 'column-5', label: 'Ended' },
                  { id: 'column-6', label: 'Received / accepted / rejected / changed' },
                  { id: 'column-7', label: 'Errors' },
                  { id: 'column-8', label: 'Retries' },
                  { id: 'column-9', label: 'Reconciliation' },
                ]}
                rows={[
                  ...data.runs.map(
                    (r) =>
                      ({
                        id: String(r.public_id),
                        cells: [
                          { value: tableText(r.public_id), content: <>{r.public_id}</>, header: true },
                          { value: tableText(connectionName(r.connection_id)), content: <>{connectionName(r.connection_id)}</> },
                          { value: tableText(r.trigger_type), content: <>{r.trigger_type}</> },
                          { value: tableText(r.status), content: <>{r.status}</> },
                          { value: tableText(when(r.started_at)), content: <>{when(r.started_at)}</> },
                          { value: tableText(when(r.completed_at)), content: <>{when(r.completed_at)}</> },
                          {
                            value: tableText([
                              r.records_received,
                              '/',
                              r.records_created + r.records_updated + r.records_unchanged,
                              '/',
                              r.records_rejected,
                              '/',
                              r.records_created + r.records_updated,
                            ]),
                            content: (
                              <>
                                {r.records_received} / {r.records_created + r.records_updated + r.records_unchanged} / {r.records_rejected}{' '}
                                / {r.records_created + r.records_updated}
                              </>
                            ),
                          },
                          { value: tableText(r.errors_count), content: <>{r.errors_count}</> },
                          { value: tableText(r.retry_count), content: <>{r.retry_count}</> },
                          { value: tableText(r.reconciliation_state), content: <>{r.reconciliation_state}</> },
                        ],
                      }) satisfies TableRecord,
                  ),
                ]}
              />
              </div>
            )
        )}

        {view === 'conflicts' && (
          <>
            {groups.length === 0 && data.deadLetters.length === 0 ? (
              <EmptyState inline title="No open conflicts" body="Type, enum, missing-field, duplicate, timestamp, transform, scope, classification, consent, rate-limit and deletion conflicts appear here." />
            ) : (
              <div className="integration-table-wrap">
                <RecordTable
                  exportAllowed={false}
                  exportReason="Use Export health summary for the approved counts and states. Detailed working downloads are unavailable."
                  id="integration-conflicts"
                  label={'Open conflicts by kind'}
                  tableProps={{ className: 'integration-table' }}
                  caption={<> Open conflicts by kind</>}
                  columns={[
                    { id: 'column-0', label: 'Kind' },
                    { id: 'column-1', label: 'Count' },
                    { id: 'column-2', label: 'Connections' },
                    { id: 'column-3', label: 'Latest' },
                  ]}
                  rows={[
                    ...groups.map(
                      (g) =>
                        ({
                          id: String(g.kind),
                          cells: [
                            { value: tableText(g.kind.replace(/_/g, ' ')), content: <>{g.kind.replace(/_/g, ' ')}</>, header: true },
                            { value: tableText(g.count), content: <>{g.count}</> },
                            { value: tableText(g.connections), content: <>{g.connections}</> },
                            { value: tableText(when(g.latest || null)), content: <>{when(g.latest || null)}</> },
                          ],
                        }) satisfies TableRecord,
                    ),
                  ]}
                />
              </div>
            )}
            {data.deadLetters.length > 0 && (
              <>
                <SectionLabel>Dead letters</SectionLabel>
                <ul className="integration-dead-letters">
                  {data.deadLetters.map((d) => (
                    <li key={d.id}>
                      <span>{connectionName(d.connection_id)} — {d.reason} ({d.attempts} attempts, {when(d.created_at)})</span>
                      {d.replay_requested_at
                        ? <span>Replay requested {when(d.replay_requested_at)}</span>
                        : <Confirmed label="Request replay" onConfirm={(r) => doReplay(d.id, r)} />}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
