import type { StudentWorkflow } from '../../lib/student-workflows';
import type { Screen } from '../../lib/types';
import { ToolDisclosure } from './ToolDisclosure';

type StepState = 'Completed' | 'Current' | 'Optional' | 'Blocked' | 'Needs review';

/** Completion is evidence supplied by a workflow, never inferred from a visit. */
export function DecisionTrail({workflow, current, states = {}, onOpen, level = 2}: {
  workflow: StudentWorkflow;
  current: Screen;
  states?: Partial<Record<Screen, StepState>>;
  onOpen: (screen: Screen) => void;
  level?: 2 | 3 | 4;
}) {
  const currentIndex = Math.max(0, workflow.steps.findIndex(step => step.screen === current));
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  return <ToolDisclosure className="decision-trail" label={`${workflow.name} decision trail`} triggerLabel={`Steps ${currentIndex + 1}/${workflow.steps.length} — ${workflow.name} decision trail`} width={416} trigger={<><span>Steps</span><span className="decision-trail-meta nums">{currentIndex + 1}/{workflow.steps.length}</span></>}>
    {close => <div className="decision-trail-panel">
    <Heading>{workflow.name}</Heading>
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
