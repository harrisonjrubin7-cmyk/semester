export type MetricState = 'green' | 'yellow' | 'red' | 'gray';

export interface TrustMetricDefinition {
  id: string;
  pillar: string;
  metric: string;
  owner: string;
  cadence: 'continuous' | 'monthly' | 'quarterly' | 'termly';
  critical: boolean;
  targetInstrumentationDate: string;
  target: string;
  knownLimitations: string;
  correctiveAction: string;
}

export interface TrustMeasurement {
  id: string;
  targetMet: boolean;
  evidenceCurrent: boolean;
  controlFailure?: boolean;
  trendWorsening?: boolean;
  materialLimitation?: boolean;
  value: string;
  evidenceAt: number;
  knownLimitations?: string;
  correctiveAction?: string;
}

export interface ScoredTrustMetric extends TrustMetricDefinition {
  state: MetricState;
  hasMeasurement: boolean;
  value: string;
  evidenceAt: number | null;
  reason: string;
}

const TRUST_METRIC_DEFINITIONS: readonly Omit<TrustMetricDefinition, 'targetInstrumentationDate' | 'target' | 'knownLimitations' | 'correctiveAction'>[] = [
  { id: 'source-coverage', pillar: 'Source trust', metric: 'Source-backed institutional and course claims', owner: 'Source operations', cadence: 'monthly', critical: true },
  { id: 'source-freshness', pillar: 'Source freshness', metric: 'Critical sources inside owner-defined freshness SLO', owner: 'Source operations', cadence: 'continuous', critical: true },
  { id: 'share-preview', pillar: 'Student control', metric: 'Optional shares preview scope, recipient, and expiry', owner: 'Product and privacy', cadence: 'quarterly', critical: true },
  { id: 'consent-revocation', pillar: 'Consent', metric: 'Revocation reaches AI, indexes, caches, and downstream use', owner: 'Privacy', cadence: 'quarterly', critical: true },
  { id: 'access-safety', pillar: 'Access safety', metric: 'Confirmed cross-tenant or unauthorized access', owner: 'Security', cadence: 'continuous', critical: true },
  { id: 'audit-coverage', pillar: 'Auditability', metric: 'Sensitive reads, AI/tool calls, decisions, and writes have a trace', owner: 'Security and platform', cadence: 'monthly', critical: true },
  { id: 'assessment-safety', pillar: 'Academic integrity', metric: 'Restricted-assessment block and reroute tests pass', owner: 'Academic affairs and AI governance', cadence: 'quarterly', critical: true },
  { id: 'human-control', pillar: 'Human control', metric: 'External communications and official writes are previewed and confirmed', owner: 'Product and integrations', cadence: 'monthly', critical: true },
  { id: 'ai-quality', pillar: 'AI quality', metric: 'Source correctness and policy-compliance evaluation', owner: 'AI governance', cadence: 'monthly', critical: false },
  { id: 'incident-response', pillar: 'Incident response', metric: 'Acknowledge, contain, recover, and close times meet approved targets', owner: 'Incident commander', cadence: 'quarterly', critical: true },
  { id: 'restore-tests', pillar: 'Recovery', metric: 'Scheduled restore tests meet approved RTO and RPO', owner: 'SRE', cadence: 'quarterly', critical: true },
  { id: 'accessibility', pillar: 'Accessibility', metric: 'Critical workflows pass assistive-technology testing', owner: 'Accessibility', cadence: 'quarterly', critical: true },
  { id: 'integration-health', pillar: 'Integration health', metric: 'LTI and SSO launches succeed with safe reconciliation', owner: 'Integrations', cadence: 'continuous', critical: false },
  { id: 'student-trust', pillar: 'Student trust', metric: 'Students understand what Semester uses and why', owner: 'Student experience', cadence: 'termly', critical: false },
  { id: 'assurance-retrieval', pillar: 'Institutional assurance', metric: 'Time to retrieve current control evidence', owner: 'Security and GRC', cadence: 'quarterly', critical: false },
];

const INSTRUMENTATION_TARGET_BY_CADENCE: Record<TrustMetricDefinition['cadence'], string> = {
  continuous: '2026-10-15',
  monthly: '2026-10-31',
  quarterly: '2026-12-15',
  termly: '2026-12-18',
};

const MAX_EVIDENCE_AGE_MS: Record<TrustMetricDefinition['cadence'], number> = {
  continuous: 24 * 60 * 60 * 1000,
  monthly: 31 * 24 * 60 * 60 * 1000,
  quarterly: 92 * 24 * 60 * 60 * 1000,
  termly: 140 * 24 * 60 * 60 * 1000,
};

const METRIC_GUIDANCE: Record<string, Pick<TrustMetricDefinition, 'target' | 'knownLimitations' | 'correctiveAction'>> = {
  'source-coverage': { target: 'Every institutional and course claim is source-backed or visibly needs confirmation.', knownLimitations: 'Coverage is not a correctness or freshness measure.', correctiveAction: 'Quarantine unsupported claims, restore citations, and re-run source review.' },
  'source-freshness': { target: 'Every critical source is inside its owner-approved freshness SLO.', knownLimitations: 'Owner-approved freshness SLOs are not yet configured for every tenant.', correctiveAction: 'Mark affected claims stale, route to the official source, and refresh or escalate ownership.' },
  'share-preview': { target: 'Every optional share previews scope, recipient, and expiry before confirmation.', knownLimitations: 'A preview cannot eliminate coercion outside the product.', correctiveAction: 'Disable the affected share route until preview, confirmation, expiry, and revocation pass.' },
  'consent-revocation': { target: 'Every revocation reaches AI, indexes, caches, and downstream use.', knownLimitations: 'Provider-side deletion timing depends on approved integration contracts.', correctiveAction: 'Stop downstream use, reconcile every copy, and retain tenant-bound evidence of completion.' },
  'access-safety': { target: 'Zero confirmed cross-tenant or unauthorized access.', knownLimitations: 'Absence of an alert is not proof of isolation.', correctiveAction: 'Disable the path, contain scope, rotate access where required, and verify tenant boundaries.' },
  'audit-coverage': { target: 'Every sensitive read, AI/tool call, decision, and write has a tenant-bound trace.', knownLimitations: 'Routine incident views intentionally exclude private student content.', correctiveAction: 'Block untraceable sensitive operations and restore the required audit event before re-enabling.' },
  'assessment-safety': { target: 'Every restricted-assessment attempt is blocked or rerouted by approved policy.', knownLimitations: 'Institutions must supply current assessment policy and scope.', correctiveAction: 'Disable the affected AI route and revalidate policy, classification, and reroute behavior.' },
  'human-control': { target: 'Every external communication and official write is previewed and explicitly confirmed.', knownLimitations: 'Confirmation does not prove the receiving system completed the action.', correctiveAction: 'Block ambiguous retries, reconcile the system of record, and restore confirmation evidence.' },
  'ai-quality': { target: 'Meet the institution-approved source-correctness and policy-compliance target.', knownLimitations: 'No universal numerical target is approved; pilot baselines remain required.', correctiveAction: 'Limit the workflow, review failures, and obtain a tenant-approved target before green status.' },
  'incident-response': { target: 'Meet institution-approved acknowledge, contain, recover, and close targets.', knownLimitations: 'No numerical target is approved until a timed exercise and business-impact review.', correctiveAction: 'Keep the metric non-green, run the required exercise, and close owned remediation.' },
  'restore-tests': { target: 'Meet institution-approved RTO and RPO in a verified restore exercise.', knownLimitations: 'Repository backup checks are not production restore evidence.', correctiveAction: 'Keep recovery claims unapproved, remediate the restore path, and repeat the timed exercise.' },
  accessibility: { target: 'Every critical workflow passes approved assistive-technology testing.', knownLimitations: 'Automated accessibility checks do not replace human assistive-technology review.', correctiveAction: 'Provide the prior accessible route, remediate the regression, and repeat human verification.' },
  'integration-health': { target: 'LTI and SSO launches succeed and ambiguous writes reconcile safely.', knownLimitations: 'Provider availability and tenant configuration remain external dependencies.', correctiveAction: 'Fail closed, use the official system, and reconcile identity and write outcomes before recovery.' },
  'student-trust': { target: 'Meet the institution-approved comprehension and trust target for the pilot cohort.', knownLimitations: 'No pilot baseline or institution-approved threshold is recorded yet.', correctiveAction: 'Run accessible student research, publish findings, and revise unclear data-use explanations.' },
  'assurance-retrieval': { target: 'Retrieve current tenant-bound control evidence within the institution-approved window.', knownLimitations: 'No institution-approved retrieval window is recorded yet.', correctiveAction: 'Assign missing evidence, remove stale claims, and repeat the timed retrieval exercise.' },
};

export const TRUST_METRICS: readonly TrustMetricDefinition[] = TRUST_METRIC_DEFINITIONS.map((metric) => ({
  ...metric,
  ...METRIC_GUIDANCE[metric.id],
  targetInstrumentationDate: INSTRUMENTATION_TARGET_BY_CADENCE[metric.cadence],
}));

export function metricState(definition: TrustMetricDefinition, measurement: TrustMeasurement | undefined, now = Date.now()): Pick<ScoredTrustMetric, 'state' | 'reason'> {
  if (!measurement) return { state: 'gray', reason: 'Not yet instrumented; the owner must record a baseline and evidence date.' };
  if (measurement.controlFailure !== undefined && typeof measurement.controlFailure !== 'boolean') return { state: 'yellow', reason: 'The control-failure flag must be a boolean when recorded.' };
  if (measurement.controlFailure === true) return { state: 'red', reason: 'A required control or authorization gate failed; evidence and remediation are required.' };
  if (typeof measurement.targetMet !== 'boolean' || typeof measurement.evidenceCurrent !== 'boolean') return { state: 'yellow', reason: 'The measurement state is invalid; target and freshness flags must be recorded explicitly.' };
  if ([measurement.trendWorsening, measurement.materialLimitation].some((flag) => flag !== undefined && typeof flag !== 'boolean')) return { state: 'yellow', reason: 'Optional trend and limitation flags must be booleans when recorded.' };
  if (!evidenceDateLabel(measurement.evidenceAt) || measurement.evidenceAt > now) return { state: 'yellow', reason: 'The evidence date is invalid or in the future; current evidence must be recorded before this metric can be green.' };
  if (typeof measurement.value !== 'string' || measurement.value.trim().length === 0) return { state: 'yellow', reason: 'A measured value is required before this metric can be green.' };
  if (now - measurement.evidenceAt > MAX_EVIDENCE_AGE_MS[definition.cadence]) return { state: 'yellow', reason: `The evidence is older than the ${definition.cadence} review cadence.` };
  if (!measurement.targetMet || !measurement.evidenceCurrent || measurement.trendWorsening || measurement.materialLimitation) return { state: 'yellow', reason: 'The target, evidence freshness, trend, or a material limitation needs attention.' };
  return { state: 'green', reason: 'Target met with current evidence.' };
}

export function evidenceDateLabel(evidenceAt: number | null): string | null {
  if (evidenceAt === null || !Number.isFinite(evidenceAt)) return null;
  const date = new Date(evidenceAt);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function trustScorecard(measurements: readonly TrustMeasurement[]): ScoredTrustMetric[] {
  const byId = new Map<string, TrustMeasurement>();
  for (const measurement of measurements) {
    if (measurement && typeof measurement === 'object' && typeof measurement.id === 'string') {
      byId.set(measurement.id, measurement);
    }
  }
  return TRUST_METRICS.map((definition) => {
    const measurement = byId.get(definition.id);
    const evaluation = metricState(definition, measurement);
    return {
      ...definition,
      ...evaluation,
      hasMeasurement: measurement !== undefined,
      value: typeof measurement?.value === 'string' && measurement.value.trim().length > 0
        ? measurement.value
        : measurement ? 'Invalid measurement value' : 'Baseline not recorded',
      evidenceAt: measurement?.evidenceAt ?? null,
      knownLimitations: typeof measurement?.knownLimitations === 'string' && measurement.knownLimitations.trim().length > 0
        ? measurement.knownLimitations.trim()
        : definition.knownLimitations,
      correctiveAction: typeof measurement?.correctiveAction === 'string' && measurement.correctiveAction.trim().length > 0
        ? measurement.correctiveAction.trim()
        : definition.correctiveAction,
    };
  });
}
