/**
 * The Migration Center: a school's migrations out of the systems it is
 * retiring, stage by stage, on the tables in `20260929200000_migration_center.sql`.
 *
 * What it shows is what the database will do. Each stage's list of what is
 * owed is `gateFailures` from `lib/migration/center.ts`, which mirrors the
 * trigger that refuses a move; Move on is offered only when that list is
 * empty, and if the two ever disagreed the database's refusal is shown in
 * the same sentences.
 *
 * A sample file is read here, in the browser, and nowhere else. The preview,
 * validation and reconciliation run on it locally; what is recorded is the
 * counts and the file's SHA-256. The screen says so beside the file picker,
 * because a migration lead holding a registrar export should not have to
 * guess where its rows go.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cloud } from '../../lib/cloud';
import { secondLine } from '../../lib/dim';
import { formatDateTime } from '../../lib/locale';
import { migrationApi, type MigrationApi, type ProjectPatch } from '../../lib/migration/api';
import {
  APPROVAL_AREAS, APPROVAL_LABEL, CLASSIFICATIONS, DOMAINS, DOMAIN_LABEL, DUPLICATE_LABEL, DUPLICATE_RULES, GATE_TEXT, SLASH_ORDER_LABEL, STAGES,
  STAGE_DOES, STAGE_LABEL, STAGE_RUN, TRANSFORMS, TRANSFORM_LABEL,
  canGoBack, gateFailures, mapsEditable, nextStage, parseTable, preview, reconcile, sha256,
  type ApprovalArea, type DuplicateRule, type FieldMap, type MigrationApproval, type MigrationDomain, type MigrationProject,
  type MigrationRun, type Preview, type Reconciliation, type RunKind, type SlashOrder, type Stage, type Transform,
} from '../../lib/migration/center';
import { ActionButton, EmptyState, FilePick, Notice, SectionLabel } from '../ui';

export interface MigrationCenterProps {
  tenantId: string;
  /** The signed-in account: the creator of a migration does not approve it. */
  viewerId: string | null;
  /** Holds `migration:manage` at this school. */
  manage: boolean;
  /** Holds `migration:approve` at this school. */
  approve: boolean;
  /** Injected in tests; defaults to Supabase under the viewer's RLS. */
  api?: MigrationApi;
}

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const inline = { display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontSize: 'var(--type-sm)' } as const;
const cellStyle = { textAlign: 'left', padding: 'var(--sp-2)', borderTop: '1px solid var(--app-line)', fontSize: 'var(--type-sm)' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const when = (iso: string) => formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' });

export function MigrationCenter({ tenantId, viewerId, manage, approve, api }: MigrationCenterProps) {
  const [client, setClient] = useState<MigrationApi | null>(api ?? null);
  const [rows, setRows] = useState<MigrationProject[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(migrationApi(db));
    }, () => {
      if (live) {
        setMessage('The Migration Center needs a connection to your school’s Semester project.');
        setState('error');
      }
    });
    return () => {
      live = false;
    };
  }, [api]);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      setRows(await client.list(tenantId));
      setState('ready');
    } catch (e) {
      setMessage(errorText(e, 'Could not load migrations.'));
      setState('error');
    }
  }, [client, tenantId]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.list(tenantId).then((r) => {
      if (!live) return;
      setRows(r);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setMessage(errorText(e, 'Could not load migrations.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [client, tenantId]);

  if (state === 'loading') return <p role="status" style={body}>Loading migrations…</p>;
  if (state === 'error' || !client) return <Notice alert>{message || 'Could not load migrations.'}</Notice>;

  const row = rows.find((r) => r.id === picked) ?? null;
  if (row) {
    return (
      <MigrationDetail
        key={`${row.id}:${row.stage}:${row.stage_entered_at}`}
        row={row}
        api={client}
        viewerId={viewerId}
        manage={manage}
        approve={approve}
        onBack={() => setPicked(null)}
        onChanged={refresh}
      />
    );
  }

  return (
    <section aria-label="Migration Center">
      <SectionLabel>Migration Center</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        Move a domain out of a system your school is retiring, one stage at a time: inventory, classification,
        mapping, cleaning, preview, sample import, validation, reconciliation, a parallel run beside the old system,
        cutover, archive and monitoring. Each stage opens only when the one before has its evidence.
      </p>

      {manage && (creating ? (
        <NewMigrationForm
          tenantId={tenantId}
          api={client}
          onCancel={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await refresh();
            setPicked(id);
          }}
        />
      ) : (
        <ActionButton tone="primary" onClick={() => setCreating(true)} style={{ marginBottom: 'var(--sp-5)' }}>
          New migration
        </ActionButton>
      ))}

      {rows.length === 0 ? (
        <EmptyState
          inline
          title="No migrations yet"
          body="Nothing here is visible to your account yet. Migrations appear here for staff with migration rights at your school."
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderTop: '1px solid var(--app-line)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ justifyContent: 'space-between', textAlign: 'left', paddingBlock: 'var(--sp-4)' }}
                onClick={() => setPicked(r.id)}
              >
                <span>
                  <span style={{ display: 'block', ...body }}>{r.name}</span>
                  <span style={quiet}>
                    {DOMAIN_LABEL[r.domain]}
                    {r.source_platform ? ` · from ${r.source_platform}` : ''}
                  </span>
                </span>
                <span style={quiet}>
                  {STAGES.indexOf(r.stage) + 1} of {STAGES.length}: {STAGE_LABEL[r.stage]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewMigrationForm({
  tenantId, api, onCancel, onCreated,
}: {
  tenantId: string;
  api: MigrationApi;
  onCancel: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState<MigrationDomain>('lms');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label="New migration"
      style={{ ...grid, marginBottom: 'var(--sp-6)' }}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setNote('');
        api
          .create(tenantId, name.trim(), domain)
          .then(onCreated, (err: unknown) => setNote(errorText(err, 'Could not open the migration.')))
          .finally(() => setBusy(false));
      }}
    >
      <label style={label}>
        Name
        <input className="input" required value={name} placeholder="Retire the legacy gradebook" onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={label}>
        Domain
        <select className="input" value={domain} onChange={(e) => setDomain(e.target.value as MigrationDomain)}>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>
          ))}
        </select>
      </label>
      {note && <Notice alert>{note}</Notice>}
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
          {busy ? 'Opening…' : 'Open migration'}
        </button>
        <ActionButton onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  );
}

// ── One migration ───────────────────────────────────────────────────────────

function MigrationDetail({
  row, api, viewerId, manage, approve, onBack, onChanged,
}: {
  row: MigrationProject;
  api: MigrationApi;
  viewerId: string | null;
  manage: boolean;
  approve: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [maps, setMaps] = useState<FieldMap[]>([]);
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [approvals, setApprovals] = useState<MigrationApproval[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(() => Promise.all([api.maps(row.id), api.runs(row.id), api.approvals(row.id)]), [api, row.id]);
  const apply = ([m, r, a]: Awaited<ReturnType<typeof fetchAll>>) => {
    setMaps(m);
    setRuns(r);
    setApprovals(a);
  };
  const load = useCallback(() => fetchAll().then(apply), [fetchAll]);

  useEffect(() => {
    let live = true;
    fetchAll().then((all) => {
      if (live) apply(all);
    }, (e: unknown) => {
      if (live) setNote(errorText(e, 'Could not load this migration.'));
    });
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const act = (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setNote('');
    work()
      .then(() => Promise.all([load(), onChanged()]))
      .catch((e: unknown) => setNote(errorText(e, fallback)))
      .finally(() => setBusy(false));
  };

  const owed = gateFailures(row, maps, runs, approvals);
  const next = nextStage(row.stage);
  const earlier = STAGES.slice(0, STAGES.indexOf(row.stage));

  return (
    <section aria-label={row.name}>
      <ActionButton tone="ghost" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        All migrations
      </ActionButton>
      <SectionLabel>{row.name}</SectionLabel>
      <p style={quiet}>
        {DOMAIN_LABEL[row.domain]}
        {row.source_platform ? ` · from ${row.source_platform}${row.source_version ? ` ${row.source_version}` : ''}` : ''}
      </p>

      <ol aria-label="Stages" style={{ paddingLeft: 'var(--sp-6)', marginBlock: 'var(--sp-4)', ...quiet }}>
        {STAGES.map((s, i) => {
          const here = s === row.stage;
          const done = i < STAGES.indexOf(row.stage);
          return (
            <li key={s} aria-current={here ? 'step' : undefined} style={here ? { ...body, fontWeight: 600 } : undefined}>
              {STAGE_LABEL[s]}
              {done ? ' — done' : here ? ' — now' : ''}
            </li>
          );
        })}
      </ol>

      <h3 style={{ ...body, fontWeight: 600, marginTop: 'var(--sp-5)' }}>Now: {STAGE_LABEL[row.stage]}</h3>
      <p style={body}>{STAGE_DOES[row.stage]}</p>
      {next && (owed.length > 0 ? (
        <div role="status">
          <p style={quiet}>Before it can move to {STAGE_LABEL[next].toLowerCase()}:</p>
          <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>
            {owed.map((c) => <li key={c}>{GATE_TEXT[c] ?? c}</li>)}
          </ul>
        </div>
      ) : (
        <p role="status" style={quiet}>Everything this stage needs is recorded.</p>
      ))}
      {note && <Notice alert>{note}</Notice>}
      {manage && next && (
        <ActionButton
          tone="primary"
          disabled={busy || owed.length > 0}
          onClick={() => act(() => api.move(row.id, next), 'Could not move the migration.')}
          style={{ marginBlock: 'var(--sp-4)' }}
        >
          Move to {STAGE_LABEL[next].toLowerCase()}
        </ActionButton>
      )}
      {manage && canGoBack(row.stage) && (
        <GoBack stages={earlier} busy={busy} onGo={(s) => act(() => api.move(row.id, s), 'Could not move the migration back.')} />
      )}

      <RecordForm row={row} editable={manage} busy={busy} onSave={(patch) => act(() => api.save(row.id, patch), 'Could not save.')} />

      <FieldMaps
        maps={maps}
        editable={manage && mapsEditable(row.stage)}
        busy={busy}
        onAdd={(m) => act(() => api.addMap(row, m), 'Could not add the field.')}
        onRemove={(id) => act(() => api.removeMap(id), 'Could not remove the field.')}
      />

      {manage && STAGE_RUN[row.stage] && (
        <Evidence
          key={row.stage}
          kind={STAGE_RUN[row.stage]!}
          row={row}
          maps={maps}
          busy={busy}
          onRecord={(kind, p, sha, period) => act(() => api.recordRun(row, kind, p, sha, period), 'Could not record the counts.')}
        />
      )}

      <Runs runs={runs} />

      <Approvals
        row={row}
        approvals={approvals}
        canDecide={approve && row.stage === 'cutover'}
        isCreator={viewerId !== null && viewerId === row.created_by}
        busy={busy}
        onDecide={(area, decision, text) => act(() => api.decide(row, area, decision, text), 'Could not record the decision.')}
      />
    </section>
  );
}

function GoBack({ stages, busy, onGo }: { stages: readonly Stage[]; busy: boolean; onGo: (s: Stage) => void }) {
  const [to, setTo] = useState<Stage>(stages[stages.length - 1]);
  return (
    <div style={grid}>
      <label style={label}>
        Go back to an earlier stage (its evidence is then recorded again)
        <select className="input" value={to} onChange={(e) => setTo(e.target.value as Stage)}>
          {stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </label>
      <ActionButton disabled={busy} onClick={() => onGo(to)}>
        Go back to {STAGE_LABEL[to].toLowerCase()}
      </ActionButton>
    </div>
  );
}

// ── The record the brief says each migration keeps ──────────────────────────

function RecordForm({ row, editable, busy, onSave }: { row: MigrationProject; editable: boolean; busy: boolean; onSave: (p: ProjectPatch) => void }) {
  const [d, setD] = useState<MigrationProject>(row);
  const set = <K extends keyof MigrationProject>(k: K, v: MigrationProject[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (k: 'source_platform' | 'source_version' | 'data_owner' | 'retention' | 'rollback_plan' | 'archive_location', title: string, long = false) => (
    <label style={label}>
      {title}
      {long ? (
        <textarea className="input" rows={3} readOnly={!editable} value={d[k]} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="input" readOnly={!editable} value={d[k]} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );
  return (
    <form
      aria-label="Migration record"
      style={grid}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          source_platform: d.source_platform, source_version: d.source_version, data_owner: d.data_owner,
          classifications: d.classifications, retention: d.retention, historical_cutoff: d.historical_cutoff || null,
          duplicate_rule: d.duplicate_rule, cutover_date: d.cutover_date || null, rollback_plan: d.rollback_plan,
          archive_location: d.archive_location, required_approvals: d.required_approvals, parallel_runs_required: d.parallel_runs_required,
        });
      }}
    >
      <h3 style={{ ...body, fontWeight: 600, marginTop: 'var(--sp-5)' }}>The record</h3>
      {text('source_platform', 'System being retired')}
      {text('source_version', 'Its version')}
      {text('data_owner', 'Data owner')}
      <Checks
        legend="Data classification"
        options={CLASSIFICATIONS}
        name={(c) => c[0].toUpperCase() + c.slice(1)}
        value={d.classifications}
        disabled={!editable}
        onChange={(v) => set('classifications', v)}
      />
      {text('retention', 'Retention obligation', true)}
      <label style={label}>
        Historical-data cutoff
        <input className="input" type="date" readOnly={!editable} value={d.historical_cutoff ?? ''} onChange={(e) => set('historical_cutoff', e.target.value || null)} />
      </label>
      <label style={label}>
        Duplicates
        <select className="input" disabled={!editable} value={d.duplicate_rule ?? ''} onChange={(e) => set('duplicate_rule', (e.target.value || null) as DuplicateRule | null)}>
          <option value="">Not chosen yet</option>
          {DUPLICATE_RULES.map((r) => <option key={r} value={r}>{DUPLICATE_LABEL[r]}</option>)}
        </select>
      </label>
      <label style={label}>
        Parallel-run periods required
        <input className="input" type="number" min={1} max={52} readOnly={!editable} value={d.parallel_runs_required} onChange={(e) => set('parallel_runs_required', Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
      </label>
      <label style={label}>
        Cutover date
        <input className="input" type="date" readOnly={!editable} value={d.cutover_date ?? ''} onChange={(e) => set('cutover_date', e.target.value || null)} />
      </label>
      {text('rollback_plan', 'Rollback plan', true)}
      <Checks
        legend="Approvals required at cutover (at least two)"
        options={APPROVAL_AREAS}
        name={(a) => APPROVAL_LABEL[a]}
        value={d.required_approvals}
        disabled={!editable}
        onChange={(v) => set('required_approvals', v)}
      />
      {text('archive_location', 'Legacy archive and export location')}
      {editable && (
        <button type="submit" className="btn btn-secondary btn-block" disabled={busy || d.required_approvals.length < 2}>
          Save the record
        </button>
      )}
    </form>
  );
}

function Checks<T extends string>({
  legend, options, name, value, disabled, onChange,
}: {
  legend: string;
  options: readonly T[];
  name: (t: T) => string;
  value: readonly T[];
  disabled: boolean;
  onChange: (v: T[]) => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0 }}>
      <legend style={{ fontSize: 'var(--type-sm)' }}>{legend}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        {options.map((o) => (
          <label key={o} style={inline}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))}
            />
            {name(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ── Field mapping ───────────────────────────────────────────────────────────

function FieldMaps({
  maps, editable, busy, onAdd, onRemove,
}: {
  maps: readonly FieldMap[];
  editable: boolean;
  busy: boolean;
  onAdd: (m: FieldMap) => void;
  onRemove: (id: string) => void;
}) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [rule, setRule] = useState<Transform>('trim');
  const [required, setRequired] = useState(false);
  const [key, setKey] = useState(false);
  const targetOk = /^[a-z][a-z0-9_]{0,62}$/.test(target);
  return (
    <section aria-label="Field mapping" style={{ marginTop: 'var(--sp-5)' }}>
      <h3 style={{ ...body, fontWeight: 600 }}>Field mapping</h3>
      {maps.length === 0 ? (
        <p style={quiet}>No fields mapped yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cellStyle}>Source field</th>
              <th style={cellStyle}>Semester field</th>
              <th style={cellStyle}>Cleaning rule</th>
              <th style={cellStyle}>Rules</th>
              {editable && <th style={cellStyle}><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m.id ?? m.target_field}>
                <td style={cellStyle}>{m.source_field}</td>
                <td style={cellStyle}><code>{m.target_field}</code></td>
                <td style={cellStyle}>{TRANSFORM_LABEL[m.transform]}</td>
                <td style={cellStyle}>{[m.is_key && 'identifies a record', m.required && 'required'].filter(Boolean).join(', ') || '—'}</td>
                {editable && (
                  <td style={cellStyle}>
                    <button type="button" className="bare tappable" disabled={busy || !m.id} onClick={() => m.id && onRemove(m.id)}>
                      Remove {m.target_field}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!editable && maps.length > 0 && <p style={quiet}>The mapping is fixed once a migration is past cleaning; go back to change it.</p>}
      {editable && (
        <form
          aria-label="Add a field"
          style={grid}
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({ source_field: source.trim(), target_field: target, transform: rule, required, is_key: key });
            setSource('');
            setTarget('');
            setRequired(false);
            setKey(false);
          }}
        >
          <label style={label}>
            Source field, as the export names it
            <input className="input" required value={source} placeholder="Student ID" onChange={(e) => setSource(e.target.value)} />
          </label>
          <label style={label}>
            Semester field (lowercase, underscores)
            <input className="input" required value={target} placeholder="student_ref" onChange={(e) => setTarget(e.target.value.toLowerCase())} />
          </label>
          <label style={label}>
            Cleaning rule
            <select className="input" value={rule} onChange={(e) => setRule(e.target.value as Transform)}>
              {TRANSFORMS.map((t) => <option key={t} value={t}>{TRANSFORM_LABEL[t]}</option>)}
            </select>
          </label>
          <label style={inline}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required
          </label>
          <label style={inline}>
            <input type="checkbox" checked={key} onChange={(e) => setKey(e.target.checked)} />
            Identifies a record
          </label>
          <button type="submit" className="btn btn-secondary btn-block" disabled={busy || !source.trim() || !targetOk}>
            Add field
          </button>
        </form>
      )}
    </section>
  );
}

// ── Evidence: read here, counted here, only the counts leave ────────────────

const RUN_TITLE: Record<RunKind, string> = {
  preview: 'Preview a sample',
  sample_import: 'Sample import',
  validation: 'Validate the full export',
  reconciliation: 'Reconcile with Semester',
  parallel_run: 'Record a parallel-run period',
  monitoring: 'Record a monitoring check',
};
const compares = (k: RunKind) => k === 'reconciliation' || k === 'parallel_run' || k === 'monitoring';

function Evidence({
  kind, row, maps, busy, onRecord,
}: {
  kind: RunKind;
  row: MigrationProject;
  maps: readonly FieldMap[];
  busy: boolean;
  onRecord: (kind: RunKind, counts: Preview['counts'], sha: string, period: string) => void;
}) {
  const [legacy, setLegacy] = useState<{ name: string; text: string } | null>(null);
  const [semester, setSemester] = useState<{ name: string; text: string } | null>(null);
  const [period, setPeriod] = useState('');
  const [note, setNote] = useState('');
  const [order, setOrder] = useState<SlashOrder | undefined>(undefined);

  const read = (files: File[], put: (f: { name: string; text: string }) => void) => {
    const f = files[0];
    if (!f) return;
    f.text().then((text) => put({ name: f.name, text }), () => setNote(`Could not read ${f.name}.`));
  };

  const mapped: Preview | null = legacy ? preview(parseTable(legacy.text), maps, row.duplicate_rule, order) : null;
  const compared: Reconciliation | null = mapped && semester && compares(kind) ? reconcile(mapped.rows, parseTable(semester.text), maps) : null;
  const counts = compares(kind) ? compared?.counts : mapped?.counts;
  const ready = counts && (kind !== 'parallel_run' || period.trim() !== '');

  return (
    <section aria-label="Evidence" style={{ marginTop: 'var(--sp-5)' }}>
      <h3 style={{ ...body, fontWeight: 600 }}>{RUN_TITLE[kind]}</h3>
      <p style={quiet}>
        The file is read in this browser and goes no further. What is recorded is the counts below and the file’s
        fingerprint (its SHA-256), attributed to you. No row, name or identifier from it is sent anywhere.
      </p>
      {maps.length === 0 ? (
        <p style={quiet}>Map at least one field first.</p>
      ) : (
        <>
          <FilePick accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" multiple={false} onPick={(f) => read(f, setLegacy)}>
            {legacy ? `Export from the retiring system: ${legacy.name}` : 'Choose the export from the retiring system'}
          </FilePick>
          {compares(kind) && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <FilePick accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" multiple={false} onPick={(f) => read(f, setSemester)}>
                {semester ? `Export from Semester: ${semester.name}` : 'Choose the matching export from Semester'}
              </FilePick>
            </div>
          )}
        </>
      )}
      {maps.some((m) => m.transform === 'date_iso') && (
        <label style={{ ...label, marginTop: 'var(--sp-3)' }}>
          Dates written like 3/7/2026
          <select className="input" value={order ?? ''} onChange={(e) => setOrder((e.target.value || undefined) as SlashOrder | undefined)}>
            <option value="">Not chosen: refuse the ones that could be either</option>
            {(Object.keys(SLASH_ORDER_LABEL) as SlashOrder[]).map((o) => <option key={o} value={o}>{SLASH_ORDER_LABEL[o]}</option>)}
          </select>
        </label>
      )}
      {note && <Notice alert>{note}</Notice>}

      {mapped && (
        <div role="status" style={{ marginTop: 'var(--sp-4)' }}>
          {mapped.missingColumns.length > 0 && (
            <Notice alert>The file has no column named {mapped.missingColumns.map((c) => `“${c}”`).join(', ')}.</Notice>
          )}
          <p style={body}>
            {mapped.counts.rows_in} rows read: {mapped.counts.rows_ok} mapped cleanly, {mapped.counts.rows_failed} failed
            {mapped.duplicates > 0 ? `, ${mapped.duplicates} duplicate${mapped.duplicates === 1 ? '' : 's'}` : ''}.
          </p>
          {mapped.issues.length > 0 && (
            <Listing title={`Problems (first ${Math.min(10, mapped.issues.length)} of ${mapped.issues.length})`}>
              {mapped.issues.slice(0, 10).map((i) => <li key={`${i.row}:${i.field}:${i.problem}`}>Row {i.row}, {i.field}: {i.problem}</li>)}
            </Listing>
          )}
          {kind === 'preview' && mapped.rows.length > 0 && <SampleTable p={mapped} />}
        </div>
      )}

      {compared && (
        <div role="status" style={{ marginTop: 'var(--sp-4)' }}>
          <p style={body}>
            {compared.matched} of {compared.counts.rows_in} records found in Semester; {compared.counts.rows_missing} missing,{' '}
            {compared.counts.rows_extra} only in Semester, {compared.counts.rows_differing} with a different value.
          </p>
          {compared.missing.length > 0 && (
            <Listing title={`Missing from Semester (first ${Math.min(10, compared.missing.length)} of ${compared.missing.length})`}>
              {compared.missing.slice(0, 10).map((k) => <li key={k}>{k}</li>)}
            </Listing>
          )}
          {compared.extra.length > 0 && (
            <Listing title={`Only in Semester (first ${Math.min(10, compared.extra.length)} of ${compared.extra.length})`}>
              {compared.extra.slice(0, 10).map((k) => <li key={k}>{k}</li>)}
            </Listing>
          )}
          {compared.differences.length > 0 && (
            <Listing title={`Differences (first ${Math.min(10, compared.differences.length)} of ${compared.differences.length})`}>
              {compared.differences.slice(0, 10).map((d) => (
                <li key={`${d.key}:${d.field}`}>{d.key}, {d.field}: “{d.legacy}” in the old system, “{d.semester}” in Semester</li>
              ))}
            </Listing>
          )}
        </div>
      )}

      {kind === 'parallel_run' && (
        <label style={{ ...label, marginTop: 'var(--sp-4)' }}>
          Period (for example “Week 3 grade sync”)
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
      )}
      {counts && legacy && (
        <ActionButton
          tone="primary"
          disabled={busy || !ready}
          style={{ marginTop: 'var(--sp-4)' }}
          onClick={() => {
            // The fingerprint covers both files when two were compared.
            const input = semester && compares(kind) ? `${legacy.text}\u0000${semester.text}` : legacy.text;
            void sha256(input).then((sha) => onRecord(kind, counts, sha, period.trim()));
          }}
        >
          Record these counts
        </ActionButton>
      )}
    </section>
  );
}

function Listing({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p style={quiet}>{title}</p>
      <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>{children}</ul>
    </>
  );
}

function SampleTable({ p }: { p: Preview }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--sp-3)' }} aria-label="First mapped rows">
      <thead>
        <tr>{p.headers.map((h) => <th key={h} style={cellStyle}><code>{h}</code></th>)}</tr>
      </thead>
      <tbody>
        {p.rows.slice(0, 5).map((r, i) => (
          <tr key={i}>{p.headers.map((h) => <td key={h} style={cellStyle}>{r[h]}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

// ── History and approvals ───────────────────────────────────────────────────

function Runs({ runs }: { runs: readonly MigrationRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section aria-label="Recorded evidence" style={{ marginTop: 'var(--sp-5)' }}>
      <h3 style={{ ...body, fontWeight: 600 }}>Recorded evidence</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {runs.map((r) => (
          <li key={r.id ?? r.recorded_at} style={{ ...quiet, borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-2)' }}>
            <span style={{ ...body, display: 'block' }}>
              {STAGE_LABEL[r.stage]}{r.period_label ? ` · ${r.period_label}` : ''}: {r.passed ? 'passed' : 'did not pass'}
            </span>
            {r.rows_in} in, {r.rows_ok} clean, {r.rows_failed} failed
            {r.rows_missing + r.rows_extra + r.rows_differing > 0 || r.kind === 'reconciliation' || r.kind === 'parallel_run'
              ? `, ${r.rows_missing} missing, ${r.rows_extra} extra, ${r.rows_differing} different`
              : ''}
            {' · '}{when(r.recorded_at)} · file {r.sample_sha256.slice(0, 12)}…
          </li>
        ))}
      </ul>
    </section>
  );
}

function Approvals({
  row, approvals, canDecide, isCreator, busy, onDecide,
}: {
  row: MigrationProject;
  approvals: readonly MigrationApproval[];
  canDecide: boolean;
  isCreator: boolean;
  busy: boolean;
  onDecide: (area: ApprovalArea, decision: MigrationApproval['decision'], note: string) => void;
}) {
  const [area, setArea] = useState<ApprovalArea>(row.required_approvals[0] ?? 'data_owner');
  const [text, setText] = useState('');
  const current = approvals.filter((a) => a.recorded_at >= row.stage_entered_at || row.stage !== 'cutover');
  return (
    <section aria-label="Cutover approvals" style={{ marginTop: 'var(--sp-5)' }}>
      <h3 style={{ ...body, fontWeight: 600 }}>Cutover approvals</h3>
      <p style={quiet}>
        Required: {row.required_approvals.map((a) => APPROVAL_LABEL[a]).join(', ')}. Each is recorded at cutover by someone
        other than the person who opened the migration; the latest decision in each area is the one that counts.
      </p>
      {current.length > 0 && (
        <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>
          {current.map((a) => (
            <li key={a.id ?? a.recorded_at}>
              {APPROVAL_LABEL[a.area]}: {a.decision === 'approved' ? 'approved' : 'rejected'}, {when(a.recorded_at)}
              {a.note ? ` — ${a.note}` : ''}
            </li>
          ))}
        </ul>
      )}
      {canDecide && (isCreator ? (
        <p style={quiet}>You opened this migration, so its cutover is approved by someone else.</p>
      ) : (
        <form aria-label="Record a decision" style={grid} onSubmit={(e) => e.preventDefault()}>
          <label style={label}>
            Area
            <select className="input" value={area} onChange={(e) => setArea(e.target.value as ApprovalArea)}>
              {row.required_approvals.map((a) => <option key={a} value={a}>{APPROVAL_LABEL[a]}</option>)}
            </select>
          </label>
          <label style={label}>
            Note
            <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <ActionButton tone="primary" disabled={busy} onClick={() => onDecide(area, 'approved', text.trim())}>Approve</ActionButton>
            <ActionButton disabled={busy} onClick={() => onDecide(area, 'rejected', text.trim())}>Reject</ActionButton>
          </div>
        </form>
      ))}
    </section>
  );
}
