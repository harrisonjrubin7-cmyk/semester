import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import type { Grant } from '../../lib/capabilities';
import {
  loadApprovals,
  loadCommandCenter,
  loadIntegrationHealth,
  type ApprovalRequest,
  type CommandItem,
  type IntegrationHealth,
} from '../../lib/console/client';
import { CONSOLE_WORKSPACES, canDiscoverWorkspace, type ConsoleWorkspaceId } from '../../lib/console/workspaces';
import {
  PRIORITY_LABEL,
  WORK_SOURCES,
  fromApproval,
  fromCommand,
  fromIntegration,
  overview,
  sortWork,
  type SourceRead,
  type WorkItem,
  type WorkSort,
  type WorkSource,
} from '../../lib/console/workqueue';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

export interface MyWorkReaders {
  command: () => Promise<CommandItem[]>;
  approvals: () => Promise<ApprovalRequest[]>;
  integrations: () => Promise<IntegrationHealth[]>;
}

const LIVE: MyWorkReaders = {
  command: () => loadCommandCenter(false),
  approvals: () => loadApprovals(false),
  integrations: () => loadIntegrationHealth(false),
};

interface MyWorkProps extends ViewProps {
  grants: readonly Grant[];
  /** Switches the console to the workspace that owns a record. */
  onOpen: (workspace: ConsoleWorkspaceId) => void;
  readers?: MyWorkReaders;
  now?: () => Date;
}

const SORTS: readonly { id: WorkSort; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'source', label: 'Source' },
];

function granted(source: WorkSource, grants: readonly Grant[]): boolean {
  const workspace = CONSOLE_WORKSPACES.find((w) => w.id === WORK_SOURCES.find((s) => s.id === source)?.workspace);
  return workspace ? canDiscoverWorkspace(workspace, grants) : false;
}

function sourceSaid(read: SourceRead, count: number): string {
  switch (read.state) {
    case 'not-granted': return 'Not in your grants — not read';
    case 'loading': return 'Reading…';
    case 'unavailable': return `Unavailable — ${read.error}`;
    case 'read': return `${count} open · read ${when(read.readAt)}`;
  }
}

/**
 * My work: the operator's queue across the console's existing readers.
 *
 * It reads only what the operator's grants already allow, through the same
 * server readers the owning workspaces use, and takes no action of its own:
 * each record opens in the workspace that owns its permitted actions, where
 * the second-factor step and the server's own checks still apply.
 */
export function MyWork({ scope, filter, onStatus, grants, onOpen, readers = LIVE, now = () => new Date() }: MyWorkProps) {
  const initial = useCallback((): Record<WorkSource, SourceRead> => ({
    command: granted('command', grants) ? { state: 'loading' } : { state: 'not-granted' },
    approvals: granted('approvals', grants) ? { state: 'loading' } : { state: 'not-granted' },
    'integration-health': granted('integration-health', grants) ? { state: 'loading' } : { state: 'not-granted' },
  }), [grants]);

  const [reads, setReads] = useState<Record<WorkSource, SourceRead>>(initial);
  const [items, setItems] = useState<Record<WorkSource, WorkItem[]>>({ command: [], approvals: [], 'integration-health': [] });
  const [sort, setSort] = useState<WorkSort>('priority');
  const [selected, setSelected] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  // Stable for a mount; a refresh bumps `round` instead.
  const io = useRef({ readers, now });

  useEffect(() => {
    let live = true;
    const { readers: read, now: clock } = io.current;
    const start = initial();
    const run = <T,>(source: WorkSource, read: () => Promise<T[]>, map: (rows: T[]) => WorkItem[]) => {
      if (start[source].state === 'not-granted') return;
      read().then(
        (rows) => {
          if (!live) return;
          setItems((prev) => ({ ...prev, [source]: map(rows) }));
          setReads((prev) => ({ ...prev, [source]: { state: 'read', readAt: clock().toISOString() } }));
        },
        (e: unknown) => {
          if (!live) return;
          const error = said(e, 'The reader did not answer.');
          setItems((prev) => ({ ...prev, [source]: [] }));
          setReads((prev) => ({ ...prev, [source]: { state: 'unavailable', error } }));
          onStatus(`My work: ${error}`);
        },
      );
    };
    run('command', read.command, (rows) => rows.map(fromCommand));
    run('approvals', read.approvals, (rows) => {
      const at = clock();
      return rows.map((r) => fromApproval(r, at)).filter((w): w is WorkItem => w !== null);
    });
    run('integration-health', read.integrations, (rows) => rows.map(fromIntegration).filter((w): w is WorkItem => w !== null));
    return () => { live = false; };
  }, [initial, onStatus, round]);

  const scoped = useMemo(
    () => (Object.values(items).flat()).filter((w) => inScope(scope, w.tenantId)),
    [items, scope],
  );
  const shown = useMemo(
    () => sortWork(
      scoped.filter((w) => matches(filter, w.title, w.status, w.owner, w.tenantName, w.tenantId, w.reason)),
      sort,
    ),
    [scoped, filter, sort],
  );
  const summary = overview(scoped, reads);
  const countFor = (source: WorkSource) => scoped.filter((w) => w.source === source).length;
  const current = shown.find((w) => w.key === selected) ?? null;
  const loading = Object.values(reads).some((r) => r.state === 'loading');

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Your queue across the console readers your grants allow. It takes no action itself: each record opens in the workspace that owns it, where the server checks again.
      </Notice>

      <section aria-labelledby="mywork-overview" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <SectionLabel aside={loading ? 'reading' : summary.complete ? 'complete' : 'incomplete'}>
          <span id="mywork-overview">What needs you</span>
        </SectionLabel>
        <p role="status" style={{ marginBlock: 0 }}>
          {summary.granted === 0 && 'None of the queue sources is in your grants, so there is nothing to count.'}
          {summary.granted > 0 && summary.complete && (
            <>
              <strong>{summary.counted}</strong> open: {summary.byPriority.critical} critical · {summary.byPriority.high} high · {summary.byPriority.medium} medium · {summary.byPriority.low} low.
            </>
          )}
          {summary.granted > 0 && !summary.complete && (
            <>
              <strong>At least {summary.counted}</strong> open. {summary.read} of {summary.granted} sources read; the rest are {loading ? 'still loading' : 'unavailable'}, so this is a floor, not a count.
            </>
          )}
        </p>
        <Fields
          label="Queue sources"
          items={WORK_SOURCES.map((s) => ({ field: s.label, value: <>{sourceSaid(reads[s.id], countFor(s.id))} <small>({s.reader})</small></> }))}
        />
        <div>
          <button type="button" className="btn btn-secondary" onClick={() => { setReads(initial()); setRound((n) => n + 1); }} disabled={loading}>
            {loading ? 'Reading…' : 'Refresh my work'}
          </button>
        </div>
      </section>

      <section aria-labelledby="mywork-queue" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <SectionLabel aside={`${shown.length} shown`}><span id="mywork-queue">Queue</span></SectionLabel>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Sort by
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as WorkSort)}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {!loading && scoped.length === 0 && summary.complete && (
          <p role="status" className="portal-panel" style={{ marginBlock: 0 }}>Nothing open for you in this scope across the sources that were read.</p>
        )}
        {scoped.length > 0 && shown.length === 0 && (
          <p role="status" className="portal-panel" style={{ marginBlock: 0 }}>No matching work. Clear the filter to see everything open in this scope.</p>
        )}
        {shown.length > 0 && (
          <ul aria-label="My work queue" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-2)' }}>
            {shown.map((w) => (
              <li key={w.key}>
                <button
                  type="button"
                  className="portal-panel"
                  aria-pressed={w.key === selected}
                  onClick={() => setSelected(w.key === selected ? null : w.key)}
                  style={{ inlineSize: '100%', textAlign: 'start', display: 'grid', gap: 'var(--sp-1)', cursor: 'pointer' }}
                >
                  <strong>{PRIORITY_LABEL[w.priority]} · {w.title}</strong>
                  <span style={{ color: 'var(--app-dim)' }}>
                    {WORK_SOURCES.find((s) => s.id === w.source)?.label} · {w.status} · owner {w.owner || 'unassigned'} · due {when(w.dueAt, 'not recorded')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current && (
        <section aria-label={`Record details: ${current.title}`} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={PRIORITY_LABEL[current.priority]}>Record details</SectionLabel>
          <Fields
            label="Record"
            items={[
              { field: 'Title', value: current.title },
              { field: 'Why it is yours', value: current.reason },
              { field: 'Status', value: current.status },
              { field: 'Owner', value: current.owner || 'unassigned' },
              { field: 'Tenant', value: current.tenantId ? `${current.tenantId}${current.tenantName ? ` — ${current.tenantName}` : ''}` : 'Platform' },
              { field: 'Due', value: when(current.dueAt, 'not recorded') },
              { field: 'Next safe step', value: current.nextStep || 'None recorded' },
              { field: 'Evidence', value: current.evidence || 'None recorded' },
              { field: 'Known limitation', value: current.limitation || 'None recorded' },
              { field: 'Source', value: WORK_SOURCES.find((s) => s.id === current.source)?.reader },
              { field: 'Observed', value: when(current.observedAt, 'not recorded') },
            ]}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button type="button" className="btn" onClick={() => onOpen(current.openIn)}>
              Open in {CONSOLE_WORKSPACES.find((x) => x.id === current.openIn)?.label}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Close details</button>
          </div>
        </section>
      )}
    </div>
  );
}
