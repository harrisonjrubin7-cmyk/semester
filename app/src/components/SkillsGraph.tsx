import type { SkillClaim } from '../lib/skills-graph';

const verificationLabel: Record<SkillClaim['verification'], string> = {
  suggested: 'Suggested',
  'student-confirmed': 'Student confirmed',
  'institution-verified': 'Institution verified',
};

export function SkillsGraph({ claims }: { claims: SkillClaim[] }) {
  if (claims.length === 0) {
    return <p className="skills-empty">Add courses, projects, work or organizations to build evidence-backed skill suggestions.</p>;
  }
  return (
    <div className="skills-graph" aria-label="Skills and evidence">
      {claims.map((claim) => (
        <article className="skills-claim" key={claim.id}>
          <div className="skills-claim-head">
            <strong>{claim.skill}</strong>
            <span>{verificationLabel[claim.verification]}</span>
          </div>
          <div className="skills-evidence">
            {claim.evidence.map((evidence) => (
              <details
                className="bare"
                data-source-id={evidence.sourceId}
                key={`${evidence.sourceType}:${evidence.sourceId}`}
              >
                <summary>{evidence.label}</summary>
                <span>{evidence.sourceType} evidence · source {evidence.sourceId}</span>
              </details>
            ))}
          </div>
          {claim.freshness === 'stale' && <p>Evidence needs review.</p>}
        </article>
      ))}
    </div>
  );
}
