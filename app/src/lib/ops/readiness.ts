import { addDays, daysBetween } from './evidence';

export const READINESS_LAYERS = [
  'repository', 'configuration', 'deployment', 'activation', 'observed-operation',
] as const;
export type ReadinessLayer = (typeof READINESS_LAYERS)[number];
export type ReadinessFreshness = 'current' | 'stale' | 'missing' | 'failed' | 'revoked' | 'invalid';

export interface ReadinessGate {
  layer: ReadinessLayer;
  label: string;
  source: string;
  owner: string;
  freshForDays: number;
  limitation: string;
  blockingScope: string;
}

export const READINESS_GATES: readonly ReadinessGate[] = [
  {
    layer: 'repository', label: 'Repository', source: 'Commit-bound repository verification', owner: 'Engineering', freshForDays: 30,
    limitation: 'Proves source and automated checks only; it does not prove configuration, deployment, approval, or use.', blockingScope: 'Release candidate',
  },
  {
    layer: 'configuration', label: 'Configuration', source: 'Tenant and provider configuration evidence', owner: 'Implementation', freshForDays: 30,
    limitation: 'Configured values do not prove that the release is deployed, approved, or operating.', blockingScope: 'Named tenant',
  },
  {
    layer: 'deployment', label: 'Deployment', source: 'Commit-bound deployment receipt and smoke check', owner: 'Engineering', freshForDays: 7,
    limitation: 'A reachable deployment does not prove institutional approval or successful operation.', blockingScope: 'Environment',
  },
  {
    layer: 'activation', label: 'Activation / approval', source: 'Named approval and activation record', owner: 'Accountable approver', freshForDays: 90,
    limitation: 'Approval permits bounded use; it does not prove the system operated successfully.', blockingScope: 'Named tenant and capability',
  },
  {
    layer: 'observed-operation', label: 'Observed operation', source: 'Dated production observation with accountable owner', owner: 'Operations', freshForDays: 30,
    limitation: 'One observation is point-in-time evidence, not a guarantee of future reliability.', blockingScope: 'Operational claim',
  },
];

export interface ReadinessObservation {
  subjectId: string;
  layer: ReadinessLayer;
  source: string;
  observedAt: string;
  outcome: 'current' | 'failed' | 'revoked';
}

export const OPERATIONS_CONSOLE_READINESS: readonly ReadinessObservation[] = [{
  subjectId: 'operations-console-foundation',
  layer: 'repository',
  source: 'repo:app/src/lib/ops/readiness.test.ts#five-layer-readiness',
  observedAt: '2026-10-03',
  outcome: 'current',
}];

export interface ReadinessLayerState extends ReadinessGate {
  freshness: ReadinessFreshness;
  observedSource: string | null;
  observedAt: string | null;
  expiresAt: string | null;
}

export interface ReadinessEvaluation {
  subjectId: string;
  achieved: ReadinessLayer | 'none';
  ready: boolean;
  layers: readonly ReadinessLayerState[];
}

function stateFor(gate: ReadinessGate, observations: readonly ReadinessObservation[], asOf: string): ReadinessLayerState {
  const observed = observations.filter((item) => item.layer === gate.layer)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  if (!observed) return { ...gate, freshness: 'missing', observedSource: null, observedAt: null, expiresAt: null };
  const expiresAt = addDays(observed.observedAt, gate.freshForDays);
  const future = daysBetween(asOf, observed.observedAt) > 0;
  const freshness: ReadinessFreshness = future ? 'invalid'
    : observed.outcome !== 'current' ? observed.outcome
      : daysBetween(asOf, expiresAt) <= 0 ? 'stale' : 'current';
  return { ...gate, freshness, observedSource: observed.source, observedAt: observed.observedAt, expiresAt };
}

export function evaluateReadiness(
  subjectId: string,
  evidence: readonly ReadinessObservation[],
  asOf: string,
): ReadinessEvaluation {
  const relevant = evidence.filter((item) => item.subjectId === subjectId);
  const layers = READINESS_GATES.map((gate) => stateFor(gate, relevant, asOf));
  let achieved: ReadinessEvaluation['achieved'] = 'none';
  for (const layer of layers) {
    if (layer.freshness !== 'current') break;
    achieved = layer.layer;
  }
  return { subjectId, achieved, ready: achieved === 'observed-operation', layers };
}
