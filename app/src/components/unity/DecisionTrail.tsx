import type { StudentWorkflow } from '../../lib/student-workflows';
import type { Screen } from '../../lib/types';
import { ToolDisclosure } from './ToolDisclosure';

type StepState = 'Completed' | 'Current' | 'Optional' | 'Blocked' | 'Needs review';

/** Completion is evidence supplied by a workflow, never inferred from a visit. */
export function DecisionTrail({workflow, current, states = {}, onOpen}: {
  workflow: StudentWorkflow;
  current: Screen;
  states?: Partial<Record<Screen, StepState>>;
  onOpen: (screen: Screen) => void;
}) {
  const currentIndex = Math.max(0, workflow.steps.findIndex(step => step.screen === current));
  return <ToolDisclosure className="decision-trail" label={`${workflow.name} decision trail`} width={416} trigger={<><span>Steps</span><span className="decision-trail-meta nums">{currentIndex + 1}/{workflow.steps.length}</span></>}>
    {close => <div className="decision-trail-panel">
    <h2>{workflow.name}</h2>
    <p>{workflow.outcome}</p>
    <ol aria-label={`${workflow.name} steps`}>
      {workflow.steps.map(step => {
        const status = states[step.screen] ?? (step.screen === current ? 'Current' : 'Needs review');
        return <li key={step.screen} aria-current={step.screen === current ? 'step' : undefined}>
          <button type="button" className="bare tap-y" disabled={status === 'Blocked'} onClick={() => { close(); onOpen(step.screen); }}>{step.label}</button> <span className="decision-trail-meta">{status}</span>
        </li>;
      })}
    </ol>
    </div>}
  </ToolDisclosure>;
}
