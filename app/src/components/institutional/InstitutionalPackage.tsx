import { INSTITUTIONAL_PACKAGE, ROLLOUT_PHASES } from '../../lib/institutional-package';
import { Notice, SectionLabel } from '../ui';

/** The offer and adoption path. It describes the package; it grants no access. */
export function InstitutionalPackage() {
  return (
    <section aria-label="Semester Institutional package">
      <SectionLabel>{INSTITUTIONAL_PACKAGE.name}</SectionLabel>
      <h2 style={{ marginBlock: 'var(--sp-3)' }}>Add a governed student operating layer without replacing systems of record</h2>
      <p>{INSTITUTIONAL_PACKAGE.promise}</p>
      <Notice>
        The package simplifies buying, not governance. Data access, write authority and the change of system of record
        remain tenant-approved, least-privilege, reversible and evidence-gated.
      </Notice>
      <h3>Included</h3>
      <ul className="portal-list">
        {INSTITUTIONAL_PACKAGE.includes.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <h3>Phased adoption</h3>
      <ol className="portal-list">
        {ROLLOUT_PHASES.map((phase) => (
          <li key={phase.id} className="portal-panel">
            <strong>{phase.name}</strong>
            <p>{phase.outcome}</p>
            <p className="portal-muted">Exit evidence: {phase.requiredEvidence.map((item) => item.replaceAll('_', ' ')).join(' · ')}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
