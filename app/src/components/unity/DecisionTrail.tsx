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
  return <details className="decision-trail">
    <summary>{workflow.name} · decision trail</summary>
    <p>{workflow.outcome}</p>
    <ol aria-label="Decision trail">
      {workflow.steps.map(step => {
        const status = states[step.screen] ?? (step.screen === current ? 'Current' : 'Needs review');
        return <li key={step.screen} aria-current={step.screen === current ? 'step' : undefined}>
          <button type="button" className="bare tap-y" disabled={status === 'Blocked'} onClick={() => onOpen(step.screen)}>{step.label}</button> · {status}
        </li>;
      })}
    </ol>
  </details>;
}
