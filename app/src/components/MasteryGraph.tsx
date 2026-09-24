import type { ConceptState } from '../lib/learning-loop';

const LABELS: Record<ConceptState['state'], string> = {
  unseen: 'Unseen',
  introduced: 'Introduced',
  practising: 'Practising',
  retained: 'Retained',
  'needs-review': 'Needs review',
};

export function MasteryGraph({ concepts }: { concepts: ConceptState[] }) {
  return (
    <div className="mastery-graph" aria-label="Concept mastery evidence">
      {concepts.map((concept) => (
        <div className="mastery-concept" key={concept.id}>
          <div className="mastery-concept-head">
            <strong>{concept.name}</strong>
            <span>{LABELS[concept.state]}</span>
          </div>
          <div
            className="mastery-track"
            role="img"
            aria-label={
              concept.confidence === null
                ? `${concept.name}: confidence not measured`
                : `${concept.name}: ${Math.round(concept.confidence * 100)} percent evidence confidence`
            }
          >
            <span style={{ width: `${Math.round((concept.confidence ?? 0) * 100)}%` }} />
          </div>
          <div className="mastery-concept-meta">
            <span>
              {concept.evidence.length} evidence {concept.evidence.length === 1 ? 'record' : 'records'}
            </span>
            <span>{concept.nextReview ? `Next review ${concept.nextReview}` : 'No review scheduled'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
