import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  loadDelivery,
  type DeliveryAccountRow,
  type DeliveryProject,
  type DeliveryRenewal,
  type HealthStatus,
  type ImplementationStage,
  type ImplementationStatus,
  type RenewalStage,
} from '../../lib/console/client';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

interface DeliveryProps extends ViewProps {
  read?: (includeDemo?: boolean) => Promise<DeliveryAccountRow[]>;
  now?: Date;
}

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  implementation_blocked: 'Implementation blocked',
  at_risk_commercial: 'Commercial risk',
  compliance_action: 'Compliance action needed',
  needs_attention: 'Needs attention',
  renewal_planning: 'Renewal planning',
  expansion: 'Expansion opportunity',
  healthy: 'Healthy',
};

const STAGE_LABEL: Record<ImplementationStage, string> = {
  discover: 'Discover', configure: 'Configure', integrate: 'Integrate', validate: 'Validate', train: 'Train',
  launch: 'Launch', hypercare: 'Hypercare', measure: 'Measure', expand: 'Expand',
};
const STATUS_LABEL: Record<ImplementationStatus, string> = {
  on_track: 'on track', at_risk: 'at risk', blocked: 'blocked', done: 'done',
};
const RENEWAL_STAGE_LABEL: Record<RenewalStage, string> = {
  review_120: '120-day review', exec_90: '90-day executive review', proposal_60: '60-day proposal',
  signature_30: '30-day signature', decided: 'Decided',
};
const ATTENTION: readonly HealthStatus[] = ['implementation_blocked', 'at_risk_commercial', 'compliance_action', 'needs_attention'];

type Filter = 'all' | 'attention' | 'no-health';
const FILTER_LABEL: Record<Filter, string> = {
  all: 'All accounts', attention: 'Needing attention', 'no-health': 'No health snapshot',
};
const DAY = 86_400_000;

function inDays(date: string | null, now: Date, none: string): string {
  if (!date) return none;
  const t = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return date;
  const d = Math.round((t - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY);
  if (d === 0) return `${date.slice(0, 10)} (today)`;
  return d > 0 ? `${date.slice(0, 10)} (in ${d} day${d === 1 ? '' : 's'})` : `${date.slice(0, 10)} (${-d} day${d === -1 ? '' : 's'} ago)`;
}

/** An account needs attention when its latest snapshot says so or a project is blocked or late. */
export function needsAttention(a: DeliveryAccountRow): boolean {
  return (a.healthStatus !== null && ATTENTION.includes(a.healthStatus))
    || a.projects.some((p) => p.status === 'blocked' || p.milestonesOverdue > 0);
}

function projectLine(p: DeliveryProject, now: Date): string {
  const next = p.nextMilestone
    ? `next: ${p.nextMilestone.name} (${p.nextMilestone.ownerRole}), due ${inDays(p.nextMilestone.dueAt, now, 'with no date')}`
    : p.milestonesTotal === 0 ? 'no milestones recorded' : 'no open milestone';
  return `${STAGE_LABEL[p.stage]}, ${STATUS_LABEL[p.status]} · ${p.milestonesDone} of ${p.milestonesTotal} milestones done`
    + `${p.milestonesOverdue > 0 ? `, ${p.milestonesOverdue} overdue` : ''} · ${next} · owner ${p.hasOwner ? 'assigned' : 'not assigned'}`;
}

function renewalLine(r: DeliveryRenewal, now: Date): string {
  return `${r.contractKind} renews ${inDays(r.renewalDate, now, 'with no date')} · ${RENEWAL_STAGE_LABEL[r.stage]} · outcome ${r.outcome}`
    + `${r.decisionOn ? `, decided ${r.decisionOn}` : ''} · owner ${r.hasOwner ? 'assigned' : 'not assigned'}`;
}

/**
 * Semester's delivery portfolio, read-only: implementation, success plans,
 * renewals and the latest account health snapshot. Changes stay in the
 * records' own workflows.
 */
export function Delivery({ env, scope, filter, onStatus, read = loadDelivery, now: fixedNow }: DeliveryProps) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [accounts, setAccounts] = useState<DeliveryAccountRow[] | null>(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState<Filter>('all');
  const [now] = useState(() => fixedNow ?? new Date());
  const refreshRequest = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshRequest.current;
    try {
      const rows = await read(env === 'Production' ? false : includeDemo);
      if (sequence !== refreshRequest.current) return;
      setAccounts(rows);
      setError('');
    } catch (caught) {
      if (sequence !== refreshRequest.current) return;
      const detail = said(caught, 'Could not read the delivery portfolio.');
      setError(detail);
      onStatus(detail);
    }
  }, [env, includeDemo, onStatus, read]);

  // Loaded only after the capability-gated workspace opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const inView = useMemo(
    () => (accounts ?? []).filter((a) => (a.tenantIds.length === 0 ? scope === 'All' : a.tenantIds.some((t) => inScope(scope, t))) && matches(
      filter, a.billingAccountId, a.accountName, ...a.tenantIds, ...a.tenantNames, a.healthStatus ?? '',
    )),
    [accounts, filter, scope],
  );
  const shown = useMemo(() => inView.filter((a) => (
    show === 'all' || (show === 'attention' ? needsAttention(a) : a.healthStatus === null)
  )), [inView, show]);
  const attention = inView.filter(needsAttention).length;
  const unknown = inView.filter((a) => a.healthStatus === null).length;

  const denied = /required|permission|denied|not authorized/i.test(error);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Delivery records as Semester staff entered them. Milestone progress is recorded dates, not observed use. Plan goals, risks, QBR summaries, health signals and owner names are not returned to this workspace.
      </Notice>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          Show
          <select className="input" value={show} onChange={(event) => setShow(event.target.value as Filter)}>
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => <option key={f} value={f}>{FILTER_LABEL[f]}</option>)}
          </select>
        </label>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
            Include demo schools explicitly
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void refresh(); }}>
          Refresh delivery
        </button>
      </div>

      <SectionLabel aside={accounts === null ? 'reading' : `${inView.length} accounts · ${attention} needing attention · ${unknown} with no health snapshot`}>
        Delivery portfolio
      </SectionLabel>
      {accounts === null && !error && <p role="status">Reading the delivery portfolio…</p>}
      {error && (
        <Notice alert>
          {denied
            ? 'Access denied. The delivery portfolio requires the platform console shell and success:manage at platform scope.'
            : accounts === null
              ? 'The delivery portfolio is unavailable. No records are shown, and no count is implied.'
              : 'The delivery portfolio could not be refreshed; the last-known list remains visible.'}
        </Notice>
      )}
      {accounts !== null && !error && shown.length === 0 && (
        <Notice>
          {inView.length === 0
            ? 'No institution accounts are recorded in this scope. No example records are shown.'
            : `No accounts match "${FILTER_LABEL[show]}". Change the filter to see the others.`}
        </Notice>
      )}

      {shown.map((a) => (
        <article
          key={a.billingAccountId}
          className="portal-panel"
          aria-label={`${a.accountName} delivery`}
          style={{ display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}
        >
          <div>
            <strong>{a.accountName}</strong> · {a.healthStatus ? HEALTH_LABEL[a.healthStatus] : 'Health not recorded'}
            <div style={{ color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>
              {a.tenantNames.length > 0 ? a.tenantNames.join(', ') : 'No Semester school linked'}{a.isDemo ? ' (demo)' : ''}
            </div>
          </div>

          {a.healthStatus && (
            <p style={{ margin: 0 }}>
              <strong>Health:</strong> {a.healthReason || 'no reason recorded'}
              {' '}<strong>Next action:</strong> {a.healthNextAction || 'none recorded'} (owner {a.healthHasOwner ? 'assigned' : 'not assigned'})
            </p>
          )}

          <div>
            <SectionLabel aside={`${a.projects.length}`}>Implementation</SectionLabel>
            {a.projects.length === 0
              ? <p style={{ margin: 0 }}>No implementation project recorded.</p>
              : <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>{a.projects.map((p) => <li key={p.id}>{projectLine(p, now)}</li>)}</ul>}
          </div>

          <div>
            <SectionLabel aside={`${a.renewals.length}`}>Renewals</SectionLabel>
            {a.renewals.length === 0
              ? <p style={{ margin: 0 }}>No renewal recorded.</p>
              : <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>{a.renewals.map((r) => <li key={r.contractId}>{renewalLine(r, now)}</li>)}</ul>}
          </div>

          <Fields
            label={`Delivery record for ${a.accountName}`}
            items={[
              { field: 'Billing account', value: a.billingAccountId },
              { field: 'Schools', value: a.tenantIds.length > 0 ? a.tenantIds.join(', ') : 'none linked' },
              { field: 'Success plan', value: a.hasSuccessPlan ? `Recorded; owner ${a.successPlanHasOwner ? 'assigned' : 'not assigned'}` : 'Not recorded' },
              { field: 'Next QBR', value: a.hasSuccessPlan ? inDays(a.nextQbrAt, now, 'not scheduled') : 'no success plan' },
              { field: 'Last QBR', value: a.hasSuccessPlan ? (a.lastQbrOn ? `${inDays(a.lastQbrOn, now, a.lastQbrOn)}; ${a.qbrCount} held` : 'none held') : 'no success plan' },
              { field: 'Health snapshot', value: a.healthTakenAt ? when(a.healthTakenAt, 'missing') : 'none taken' },
              { field: 'Provenance', value: a.provenance || 'missing' },
              { field: 'Limitation', value: a.limitation || 'missing' },
            ]}
          />
        </article>
      ))}
    </div>
  );
}
