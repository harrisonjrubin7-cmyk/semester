import { useState } from 'react';
import { CONCEPTS, answerConcept } from '../../lib/flight-plan';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';

export function FlightPlanLearning() {
  const { workspace, updateWorkspace } = useFlightPlan();
  const [hints, setHints] = useState<Record<string, boolean>>({});
  if (workspace.role !== 'student') return null;

  return (
    <section aria-label="Sample learning evidence" style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel>Sample learning evidence</SectionLabel>
      <p style={{ color: 'var(--app-dim)' }}>
        Practice evidence explains what happened in this sample prompt. It is not a grade or certified mastery score.
      </p>
      <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
        {CONCEPTS.map((concept) => {
          const attempted = concept.id in workspace.attempts;
          const correct = workspace.attempts[concept.id];
          return (
            <Blueprint key={concept.id} plain style={{ padding: 'var(--sp-6)' }}>
              <strong>{concept.name}</strong>
              <div style={{ color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
                Prerequisite · {concept.prerequisite}
              </div>
              <p>{concept.question}</p>
              {!attempted && (
                <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  {concept.choices.map((choice, index) => (
                    <button
                      type="button"
                      className="bare tappable on-paper"
                      data-choice={index}
                      key={choice}
                      onClick={() =>
                        updateWorkspace((current) => answerConcept(current, concept.id, index === concept.correct))
                      }
                      style={{ textAlign: 'left', padding: 'var(--sp-3)' }}
                    >
                      {choice}
                    </button>
                  ))}
                  <ActionButton tone="ghost" onClick={() => setHints((current) => ({ ...current, [concept.id]: true }))}>
                    Show hint
                  </ActionButton>
                  {hints[concept.id] && <p role="status">{concept.hint}</p>}
                </div>
              )}
              {attempted && (
                <div data-evidence={concept.id}>
                  <strong>Sample practice evidence · {correct ? 'correct' : 'review needed'}</strong>
                  <p>{concept.explanation}</p>
                  <p style={{ color: 'var(--app-dim)' }}>Source · {concept.source}</p>
                </div>
              )}
            </Blueprint>
          );
        })}
      </div>
    </section>
  );
}
