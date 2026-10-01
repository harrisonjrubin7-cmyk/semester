export type MetricState = 'green' | 'yellow' | 'red' | 'gray';

export interface TrustMetricDefinition {
  id: string;
  pillar: string;
  metric: string;
  owner: string;
  cadence: 'continuous' | 'monthly' | 'quarterly' | 'termly';
  critical: boolean;
  targetInstrumentationDate: string;
}

export interface TrustMeasurement {
  id: string;
  targetMet: boolean;
  evidenceCurrent: boolean;
  controlFailure?: boolean;
  trendWorsening?: boolean;
  value: string;
  evidenceAt: number;
}

export interface ScoredTrustMetric extends TrustMetricDefinition {
  state: MetricState;
  value: string;
  evidenceAt: number | null;
  reason: string;
}

const TRUST_METRIC_DEFINITIONS: readonly Omit<TrustMetricDefinition, 'targetInstrumentationDate'>[] = [
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

export const TRUST_METRICS: readonly TrustMetricDefinition[] = TRUST_METRIC_DEFINITIONS.map((metric) => ({
  ...metric,
  targetInstrumentationDate: INSTRUMENTATION_TARGET_BY_CADENCE[metric.cadence],
}));

export function metricState(measurement: TrustMeasurement | undefined): Pick<ScoredTrustMetric, 'state' | 'reason'> {
  if (!measurement) return { state: 'gray', reason: 'Not yet instrumented; the owner must record a baseline and evidence date.' };
  if (measurement.controlFailure) return { state: 'red', reason: 'A control failed; evidence and remediation are required.' };
  if (!measurement.targetMet || !measurement.evidenceCurrent || measurement.trendWorsening) return { state: 'yellow', reason: 'The target, evidence freshness, or trend needs attention.' };
  return { state: 'green', reason: 'Target met with current evidence.' };
}

export function trustScorecard(measurements: readonly TrustMeasurement[]): ScoredTrustMetric[] {
  const byId = new Map(measurements.map((measurement) => [measurement.id, measurement]));
  return TRUST_METRICS.map((definition) => {
    const measurement = byId.get(definition.id);
    const evaluation = metricState(measurement);
    return { ...definition, ...evaluation, value: measurement?.value ?? 'Baseline not recorded', evidenceAt: measurement?.evidenceAt ?? null };
  });
}
