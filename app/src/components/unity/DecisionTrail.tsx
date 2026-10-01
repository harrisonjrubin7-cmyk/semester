import type { StudentWorkflow } from '../../lib/student-workflows';
import type { Screen } from '../../lib/types';

type StepState = 'Completed' | 'Current' | 'Optional' | 'Blocked' | 'Needs review';

/** Completion is evidence supplied by a workflow, never inferred from a visit. */
export function DecisionTrail({workflow, current, states = {}, onOpen}: {
  workflow: StudentWorkflow;
  current: Screen;
  states?: Partial<Record<Screen, StepState>>;
  onOpen: (screen: Screen) => void;
}) {
  const currentIndex = Math.max(0, workflow.steps.findIndex(step => step.screen === current));
  return <details className="decision-trail">
    <summary aria-label={`${workflow.name} decision trail`}><span>{workflow.name}</span><span className="decision-trail-meta nums">{currentIndex + 1}/{workflow.steps.length}</span></summary>
    <div className="decision-trail-panel">
    <span className="kicker">Decision trail</span>
    <p>{workflow.outcome}</p>
    <ol aria-label={`${workflow.name} steps`}>
      {workflow.steps.map(step => {
        const status = states[step.screen] ?? (step.screen === current ? 'Current' : 'Needs review');
        return <li key={step.screen} aria-current={step.screen === current ? 'step' : undefined}>
          <button type="button" className="bare tap-y" disabled={status === 'Blocked'} onClick={() => onOpen(step.screen)}>{step.label}</button> · {status}
        </li>;
      })}
    </ol>
    </div>
  </details>;
}
