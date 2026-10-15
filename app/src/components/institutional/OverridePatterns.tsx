import { useEffect, useState } from 'react';
import {
  MAX_OVERRIDE_PATTERNS,
  OVERRIDE_DOMAINS,
  loadOverridePatterns,
  type OverrideDomain,
  type OverridePattern,
} from '../../lib/governance/override-review';
import { formatDateTime } from '../../lib/locale';
import { EmptyState, SectionLabel, Segmented } from '../ui';
import { ErrorState, LoadingState } from '../unity/States';

const DOMAIN_LABELS: Record<OverrideDomain, string> = {
  academic_record: 'Academic record',
  moderation: 'Moderation',
  credential: 'Credential',
  notification: 'Notification',
  permission: 'Permission',
  integration: 'Integration',
  migration: 'Migration',
  ai_output: 'AI output',
};

type RecurrenceFilter = 'all' | 'recurring' | 'not_recurring';
type Load = (tenantId: string) => Promise<OverridePattern[]>;
type State =
  | { tenantId: string; status: 'loading' }
  | { tenantId: string; status: 'ready'; rows: OverridePattern[] }
  | { tenantId: string; status: 'error' };

const ruleLabel = (ruleRef: string) => {
  const words = ruleRef.replace(/[_.:-]+/g, ' ');
  return words ? words[0].toUpperCase() + words.slice(1) : 'Unknown rule';
};

const when = (value: number | null) => value === null
  ? 'Date unavailable'
  : formatDateTime(value, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Aggregate review only: no case, person, reason, outcome or source reference
 * is queried or accepted by this component's display type.
 */
export function OverridePatterns({
  tenantId,
  canReview,
  load = loadOverridePatterns,
}: {
  tenantId: string;
  canReview: boolean;
  load?: Load;
}) {
  const [round, setRound] = useState(0);
  const [state, setState] = useState<State>({ tenantId, status: 'loading' });
  const [domain, setDomain] = useState<'all' | OverrideDomain>('all');
  const [recurrence, setRecurrence] = useState<RecurrenceFilter>('all');

  useEffect(() => {
    if (!canReview) return;
    let live = true;
    // Prop changes are a new authorization and tenant boundary, not a refresh
    // of the old result. Keep the old response off screen while it resolves.
    // oxlint-disable-next-line react/set-state-in-effect -- an external read starts at this boundary
    setState({ tenantId, status: 'loading' });
    setDomain('all');
    setRecurrence('all');
    load(tenantId).then(
      (rows) => { if (live) setState({ tenantId, status: 'ready', rows }); },
      () => { if (live) setState({ tenantId, status: 'error' }); },
    );
    return () => { live = false; };
  }, [canReview, load, round, tenantId]);

  if (!canReview) return null;
  const current: State = state.tenantId === tenantId ? state : { tenantId, status: 'loading' };

  return (
    <section className="override-review" aria-label="Override patterns">
      <SectionLabel>Override patterns</SectionLabel>
      <p className="control-plane-note">
        Read-only counts from the school’s shared override log. Up to {MAX_OVERRIDE_PATTERNS} recently active rule
        patterns are shown; this is not the case log. Academic-record corrections and break-glass access are the only
        automatic producers currently connected.
      </p>

      {current.status === 'loading' ? <LoadingState what="override patterns" /> : null}
      {current.status === 'error' ? (
        <ErrorState
          title="Override patterns are unavailable"
          body="The aggregate could not be read. No case data was requested."
          recover={{ label: 'Try again', run: () => setRound((value) => value + 1) }}
        />
      ) : null}
      {current.status === 'ready' && current.rows.length === 0 ? (
        <EmptyState
          inline
          title="No readable patterns are available"
          body="No aggregate rows are available in this view. This does not show overrides from domains that do not write to the shared log."
        />
      ) : null}
      {current.status === 'ready' && current.rows.length > 0 ? (
        <PatternList
          rows={current.rows}
          domain={domain}
          recurrence={recurrence}
          onDomain={setDomain}
          onRecurrence={setRecurrence}
        />
      ) : null}
    </section>
  );
}

function PatternList({
  rows,
  domain,
  recurrence,
  onDomain,
  onRecurrence,
}: {
  rows: readonly OverridePattern[];
  domain: 'all' | OverrideDomain;
  recurrence: RecurrenceFilter;
  onDomain: (value: 'all' | OverrideDomain) => void;
  onRecurrence: (value: RecurrenceFilter) => void;
}) {
  const domains = OVERRIDE_DOMAINS.filter((candidate) => rows.some((row) => row.domain === candidate));
  const shown = rows.filter((row) =>
    (domain === 'all' || row.domain === domain)
    && (recurrence === 'all' || row.recurring === (recurrence === 'recurring')));

  return (
    <>
      <div className="override-review-filters">
        <label className="override-review-field">
          <span>Domain</span>
          <select aria-label="Domain" value={domain} onChange={(event) => onDomain(event.target.value as 'all' | OverrideDomain)}>
            <option value="all">All domains</option>
            {domains.map((candidate) => <option key={candidate} value={candidate}>{DOMAIN_LABELS[candidate]}</option>)}
          </select>
        </label>
        <fieldset className="override-review-recurrence">
          <legend>Recurrence</legend>
          <Segmented
            options={[
              { id: 'all', label: 'All' },
              { id: 'recurring', label: 'Recurring' },
              { id: 'not_recurring', label: 'Not recurring' },
            ]}
            value={recurrence}
            onChange={onRecurrence}
          />
        </fieldset>
      </div>
      <p className="control-plane-note">Showing {shown.length} of {rows.length} patterns.</p>
      {shown.length === 0 ? (
        <EmptyState inline title="No patterns match these filters" body="Change a filter to return to the available aggregate rows." />
      ) : (
        <ul className="override-review-list">
          {shown.map((row) => <PatternRow key={`${row.domain}:${row.ruleRef}`} row={row} />)}
        </ul>
      )}
    </>
  );
}

function PatternRow({ row }: { row: OverridePattern }) {
  return (
    <li className="override-review-row">
      <details>
        <summary>
          <span>
            <strong>{ruleLabel(row.ruleRef)}</strong>
            <small>{DOMAIN_LABELS[row.domain]}</small>
          </span>
          <span>{row.recurring ? 'Recurring — review the rule' : 'Not currently recurring'}</span>
        </summary>
        <dl className="override-review-facts">
          <div><dt>Logged overrides</dt><dd>{row.overrides}</dd></div>
          <div><dt>Last 90 days</dt><dd>{row.last90Days}</dd></div>
          <div><dt>People</dt><dd>{row.people === 0 ? 'Person count unavailable' : row.people}</dd></div>
          <div><dt>First recorded</dt><dd>{when(row.firstAt)}</dd></div>
          <div><dt>Most recent</dt><dd>{when(row.lastAt)}</dd></div>
        </dl>
        <p className="control-plane-note">
          “Recurring” means at least three logged overrides under this rule in the last 90 days. It is a signal to
          review the rule, not a conclusion about any person or case.
        </p>
      </details>
    </li>
  );
}
