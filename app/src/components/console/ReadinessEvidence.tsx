import {
  OPERATIONS_CONSOLE_READINESS,
  evaluateReadiness,
  type ReadinessObservation,
} from '../../lib/ops/readiness';
import { Notice, SectionLabel } from '../ui';
import { Fields } from './Fields';

interface ReadinessEvidenceProps {
  today: string;
  subjectId?: string;
  evidence?: readonly ReadinessObservation[];
}

export function ReadinessEvidence({
  today,
  subjectId = 'operations-console-foundation',
  evidence = OPERATIONS_CONSOLE_READINESS,
}: ReadinessEvidenceProps) {
  const result = evaluateReadiness(subjectId, evidence, today);
  const achieved = result.achieved === 'none' ? 'none' : result.achieved;

  return (
    <section aria-label="Operational readiness evidence" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <SectionLabel aside={result.ready ? 'Ready' : 'Blocked'}>Five-layer readiness</SectionLabel>
      <Notice>
        Highest continuous evidence: {achieved}. Every earlier layer must be current; a repository test, deployment,
        or approval never substitutes for observed operation.
      </Notice>
      {result.layers.map((layer) => (
        <article key={layer.layer} className="portal-panel" aria-label={`Readiness ${layer.label}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <strong>{layer.label} — {layer.freshness}</strong>
          <Fields
            label={`${layer.label} readiness details`}
            items={[
              { field: 'Expected source', value: layer.source },
              { field: 'Observed source', value: layer.observedSource ?? 'Missing' },
              { field: 'Observed', value: layer.observedAt ?? 'Missing' },
              { field: 'Fresh for', value: `${layer.freshForDays} days` },
              { field: 'Expires', value: layer.expiresAt ?? 'Missing' },
              { field: 'Owner', value: layer.owner },
              { field: 'Blocking scope', value: layer.blockingScope },
              { field: 'Limitation', value: layer.limitation },
            ]}
          />
        </article>
      ))}
    </section>
  );
}
