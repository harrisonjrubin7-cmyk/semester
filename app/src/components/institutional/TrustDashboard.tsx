import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { EXPERIENCE_FLAGS, MODULE_FLAGS } from '../../lib/experience-flags';
import { configured } from '../../lib/assistant';
import { governs } from '../../ai/converse';
import { readIncidents, type Incident } from '../../lib/statusnotice';
import { trustDashboard, type Integration, type TrustRow } from '../../lib/trustdashboard';
import { NOTES, visible } from '../../lib/whatsnew';
import { useNow, useStore } from '../../state/store';
import { SectionLabel } from '../ui';
import { evidenceDateLabel, trustScorecard, type MetricState, type ScoredTrustMetric, type TrustMeasurement } from '../../lib/institutional-trust-scorecard';

const StandardsAudit = lazy(() => import('./StandardsAudit').then((module) => ({ default: module.StandardsAudit })));

/**
 * The customer trust dashboard, as a tab on the institution screen. The rows
 * are `lib/trustdashboard.ts`; this gathers the inputs — build stamp, flags,
 * the student's connections, the status file, the notes under Me — and draws
 * them as one list, with an absence said in words rather than left blank.
 */
export function TrustDashboard({ incidents: given, measurements = [] }: { incidents?: Incident[]; measurements?: TrustMeasurement[] } = {}) {
  const { state } = useStore();
  const now = useNow();
  const [fetched, setFetched] = useState<Incident[]>([]);

  useEffect(() => {
    if (given || typeof fetch !== 'function') return;
    let stale = false;
    fetch(`${import.meta.env.BASE_URL}status-incidents.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!stale && data) setFetched(readIncidents(data));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [given]);

  const integrations: Integration[] = useMemo(
    () => state.feeds.map((f) => ({ name: f.name, lastSync: f.synced > 0 ? f.synced : null, scope: f.kind === 'canvas' ? 'Dates and submission state, read-only' : 'Dates, read-only', owner: 'The student who added it' })),
    [state.feeds],
  );

  const rows = trustDashboard({
    build: (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '',
    modules: MODULE_FLAGS,
    experience: EXPERIENCE_FLAGS,
    integrations,
    openIssues: null,
    incidents: given ?? fetched,
    notes: visible(MODULE_FLAGS, NOTES),
    governedAI: governs(EXPERIENCE_FLAGS.semesterIntelligence, configured()),
    usage: [],
    now: now.getTime(),
  });
  const scorecard = trustScorecard(measurements);

  return (
    <section className="trust-dashboard" aria-label="Customer trust dashboard">
      <SectionLabel>What your institution can see</SectionLabel>
      <p className="control-plane-note">
        Version, modules, connections, issues, limitations, documents, accessibility, maintenance, retention, AI policy, changes and usage — each read from the product itself. A row with nothing behind it says so.
      </p>
      <dl className="trust-dashboard-dl">
        {rows.map((r) => (
          <Row key={r.id} row={r} />
        ))}
      </dl>
      <section className="trust-scorecard" aria-label="Institutional trust scorecard">
        <SectionLabel>Trust scorecard</SectionLabel>
        <p className="control-plane-note">
          No combined score. Each control keeps its own state and evidence date: green means current evidence meets the target; yellow needs attention; red is a control failure; gray is not yet instrumented. Repository tests are not counted as pilot measurements.
        </p>
        <ul className="trust-scorecard-list">
          {scorecard.map((metric) => <ScorecardRow key={metric.id} metric={metric} />)}
        </ul>
      </section>
      <Suspense fallback={<p role="status">Loading standards audit…</p>}><StandardsAudit /></Suspense>
    </section>
  );
}

/** Written out so the dead-CSS guard can see each name. */
const KIND_CLASS: Record<TrustRow['kind'], string> = {
  fact: 'trust-dashboard-row is-fact',
  live: 'trust-dashboard-row is-live',
  none: 'trust-dashboard-row is-none',
};

function Row({ row }: { row: TrustRow }) {
  return (
    <div className={KIND_CLASS[row.kind]}>
      <dt>{row.title}</dt>
      <dd>
        <p>{row.value}</p>
        {row.lines.length > 0 && (
          <ul>
            {row.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

/** Written out so the dead-CSS guard sees every scorecard state. */
const SCORECARD_CLASS: Record<MetricState, string> = {
  green: 'trust-scorecard-row is-green',
  yellow: 'trust-scorecard-row is-yellow',
  red: 'trust-scorecard-row is-red',
  gray: 'trust-scorecard-row is-gray',
};

function ScorecardRow({ metric }: { metric: ScoredTrustMetric }) {
  const evidenceDate = evidenceDateLabel(metric.evidenceAt);
  return (
    <li className={SCORECARD_CLASS[metric.state]}>
      <div>
        <strong>{metric.pillar}</strong>
        <span className="trust-scorecard-state">{metric.state}</span>
      </div>
      <p>{metric.metric}</p>
      <p>{metric.value} · {metric.reason}</p>
      <p><strong>Target:</strong> {metric.target}</p>
      <p><strong>Known limitations:</strong> {metric.knownLimitations}</p>
      <p><strong>Corrective action:</strong> {metric.correctiveAction}</p>
      <small>{metric.owner} · {metric.cadence}{!metric.hasMeasurement ? ` · target instrumentation ${metric.targetInstrumentationDate}` : evidenceDate ? ` · evidence ${evidenceDate}` : ' · evidence date missing or invalid'}</small>
    </li>
  );
}
