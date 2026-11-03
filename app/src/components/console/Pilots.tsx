import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { loadPilots, type PilotPortfolioRow, type PilotStatus } from '../../lib/console/client';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

interface PilotsProps extends ViewProps {
  read?: (includeDemo?: boolean) => Promise<PilotPortfolioRow[]>;
  now?: Date;
}

/** The database's readiness codes (`gtm_pilot_problems`), in words. */
export const PILOT_PROBLEM_LABEL: Record<string, string> = {
  duration: 'Runs a length other than 26 weeks',
  no_workflow: 'No workflow named',
  no_cohort: 'No cohort recorded',
  no_baseline: 'No baseline recorded',
  no_sponsor: 'No executive sponsor',
  no_champion: 'No operational champion',
  data_plan: 'Data plan incomplete (minimum data, read-only first, source labels)',
  metric_count: 'Needs three to five success metrics',
  metric_baseline: 'A metric has no baseline',
  no_conversion_date: 'No conversion decision date',
  conversion_outside_window: 'Conversion date falls outside the decision window',
  no_price: 'Annual price not agreed',
  no_midpoint: 'No midpoint review date',
  not_found: 'Readiness could not be read for this pilot',
};

const STATUS_LABEL: Record<PilotStatus, string> = { proposed: 'Proposed', active: 'Active', decided: 'Decided' };
const FILTERS: readonly (PilotStatus | 'all')[] = ['all', 'active', 'proposed', 'decided'];
const DAY = 86_400_000;

const problemText = (code: string) => PILOT_PROBLEM_LABEL[code] ?? `Unrecognised readiness code: ${code}`;

function daysUntil(date: string | null, now: Date): number | null {
  if (!date) return null;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((t - today) / DAY);
}

function inDays(date: string | null, now: Date, none: string): string {
  const d = daysUntil(date, now);
  if (date === null || d === null) return none;
  if (d === 0) return `${date} (today)`;
  return d > 0 ? `${date} (in ${d} day${d === 1 ? '' : 's'})` : `${date} (${-d} day${d === -1 ? '' : 's'} ago)`;
}

/** The one next step the record supports, without claiming anything it does not hold. */
export function pilotNextStep(p: PilotPortfolioRow, now: Date): string {
  if (p.status === 'decided') {
    return p.outcomeDecision
      ? `Outcome signed: ${p.outcomeDecision}. Follow the account's next stage in the pipeline.`
      : 'Marked decided, but no signed outcome was returned. Check the outcome record.';
  }
  if (p.status === 'proposed') {
    return p.readinessProblems.length > 0
      ? `Close ${p.readinessProblems.length} readiness gap${p.readinessProblems.length === 1 ? '' : 's'} before this pilot can start. The database refuses the move to active until they are closed.`
      : 'The recorded plan passes readiness. Sales can move it to active in the pipeline.';
  }
  const midpoint = daysUntil(p.midpointReviewDate, now);
  const conversion = daysUntil(p.conversionDate, now);
  if (conversion !== null && conversion < 0) return `The conversion decision date passed ${-conversion} day(s) ago with no signed outcome. Record the decision.`;
  if (midpoint !== null && midpoint >= 0 && midpoint <= 14) return `Midpoint review is due in ${midpoint} day(s). Prepare the metric readout.`;
  if (conversion !== null && conversion <= 30) return `The conversion decision is due in ${conversion} day(s). Prepare the outcome record.`;
  return 'Running. No review is due within the next two weeks.';
}

/**
 * Semester's pilot pipeline, read-only. Status changes stay in the pipeline,
 * where the database checks readiness and requires a signed outcome.
 */
export function Pilots({ env, scope, filter, onStatus, read = loadPilots, now: fixedNow }: PilotsProps) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [pilots, setPilots] = useState<PilotPortfolioRow[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<PilotStatus | 'all'>('all');
  const [now] = useState(() => fixedNow ?? new Date());
  const refreshRequest = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshRequest.current;
    try {
      const rows = await read(env === 'Production' ? false : includeDemo);
      if (sequence !== refreshRequest.current) return;
      setPilots(rows);
      setError('');
    } catch (caught) {
      if (sequence !== refreshRequest.current) return;
      const detail = said(caught, 'Could not read the pilot portfolio.');
      setError(detail);
      onStatus(detail);
    }
  }, [env, includeDemo, onStatus, read]);

  // Loaded only after the capability-gated workspace opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const inView = useMemo(
    () => (pilots ?? []).filter((p) => (p.tenantId === null ? scope === 'All' : inScope(scope, p.tenantId)) && matches(
      filter, p.pilotId, p.accountName, p.accountPublicId, p.tenantId, p.tenantName, p.workflow, p.status, p.segment,
    )),
    [pilots, filter, scope],
  );
  const shown = useMemo(() => inView.filter((p) => status === 'all' || p.status === status), [inView, status]);
  const count = (s: PilotStatus) => inView.filter((p) => p.status === s).length;

  const denied = /required|permission|denied|not authorized/i.test(error);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Pipeline records as sales entered them. Cohorts, baselines, stakeholder names and metric text are not returned to this workspace. Status changes stay in the pipeline, where the database checks readiness.
      </Notice>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          Show
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as PilotStatus | 'all')}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>{f === 'all' ? 'All pilots' : STATUS_LABEL[f]}</option>
            ))}
          </select>
        </label>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(event) => setIncludeDemo(event.target.checked)} />
            Include demo schools explicitly
          </label>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void refresh(); }}>
          Refresh pilots
        </button>
      </div>

      <SectionLabel aside={pilots === null ? 'reading' : `${count('active')} active · ${count('proposed')} proposed · ${count('decided')} decided`}>
        Pilot portfolio
      </SectionLabel>
      {pilots === null && !error && <p role="status">Reading the pilot portfolio…</p>}
      {error && (
        <Notice alert>
          {denied
            ? 'Access denied. The pilot portfolio requires the platform console shell and account:manage at platform scope.'
            : pilots === null
              ? 'The pilot portfolio is unavailable. No records are shown, and no count is implied.'
              : 'The pilot portfolio could not be refreshed; the last-known list remains visible.'}
        </Notice>
      )}
      {pilots !== null && !error && shown.length === 0 && (
        <Notice>
          {inView.length === 0
            ? 'No pilots are recorded in this scope. No example records are shown.'
            : `No ${status === 'all' ? '' : `${STATUS_LABEL[status].toLowerCase()} `}pilots match. Change the filter to see the others.`}
        </Notice>
      )}

      {shown.map((p) => (
        <article
          key={p.pilotId}
          className="portal-panel"
          aria-label={`${p.accountName} pilot: ${p.workflow}`}
          style={{ display: 'grid', gap: 'var(--sp-4)', alignContent: 'start' }}
        >
          <div>
            <strong>{p.accountName}</strong> · {p.workflow} · {STATUS_LABEL[p.status]}
            <div style={{ color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>
              {p.tenantName || p.tenantId || 'No Semester school yet'}{p.isDemo ? ' (demo)' : ''} · {p.segment} · account {p.accountStatus}
            </div>
          </div>

          <p style={{ margin: 0 }}><strong>Next step:</strong> {pilotNextStep(p, now)}</p>

          {p.status !== 'decided' && (
            p.readinessProblems.length > 0 ? (
              <div>
                <SectionLabel aside={`${p.readinessProblems.length}`}>Readiness gaps</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                  {p.readinessProblems.map((code) => <li key={code}>{problemText(code)}</li>)}
                </ul>
              </div>
            ) : (
              <p style={{ margin: 0 }}>Readiness: ✓ the recorded plan passes every check.</p>
            )
          )}

          <Fields
            label={`Pilot record for ${p.accountName}`}
            items={[
              { field: 'Pilot', value: p.pilotId },
              { field: 'Account', value: `${p.accountName} (${p.accountPublicId})` },
              { field: 'School', value: p.tenantId ? `${p.tenantName || p.tenantId} (${p.tenantId})` : 'Not yet a Semester school' },
              { field: 'Runs', value: `${p.startDate} to ${inDays(p.endDate, now, p.endDate)}` },
              { field: 'Midpoint review', value: inDays(p.midpointReviewDate, now, 'not set') },
              { field: 'Conversion decision', value: inDays(p.conversionDate, now, 'not set') },
              { field: 'Sponsor and champion', value: `Sponsor ${p.hasSponsor ? 'named' : 'missing'}; champion ${p.hasChampion ? 'named' : 'missing'}` },
              { field: 'Annual price', value: p.annualPriceAgreed ? 'Agreed' : 'Not agreed' },
              { field: 'Data mode', value: p.productionDataApproved ? 'Production data approved' : 'Sandbox (production data not approved)' },
              { field: 'Success metrics', value: `${p.metricCount} recorded` },
              { field: 'Outcome', value: p.outcomeDecision ? `${p.outcomeDecision}, signed ${p.outcomeSignedAt ?? 'date missing'}; ${p.unresolvedHighSeverity ?? '?'} unresolved high-severity issue(s)` : 'Not signed' },
              { field: 'Last updated', value: when(p.updatedAt, 'missing') },
              { field: 'Provenance', value: p.provenance || 'missing' },
              { field: 'Limitation', value: p.limitation || 'missing' },
            ]}
          />
        </article>
      ))}
    </div>
  );
}
