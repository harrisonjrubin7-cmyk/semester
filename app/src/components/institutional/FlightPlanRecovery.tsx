import { updateTask, type TaskAction } from '../../lib/flight-plan';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';

const ACTIONS: { action: TaskAction; label: string }[] = [
  { action: 'reschedule', label: 'Reschedule my plan' },
  { action: 'reduce', label: 'Reduce my estimate' },
  { action: 'help', label: 'Prepare help request' },
  { action: 'office', label: 'Prepare office-hours note' },
];

export function FlightPlanRecovery() {
  const { workspace, updateWorkspace } = useFlightPlan();
  if (workspace.role !== 'student') return null;
  const task = workspace.tasks.find((candidate) => candidate.id.endsWith('-reading'));
  if (!task) return null;
  const latest = workspace.audit.at(-1);

  return (
    <section aria-label="Sample Flight Plan recovery" style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel>Sample Flight Plan recovery</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <strong>{task.title}</strong>
        <p style={{ color: 'var(--app-dim)' }}>
          Source deadline unchanged · due in {task.dueDay} day. Recovery changes only your personal sample plan.
        </p>
        {task.status === 'missed' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--sp-3)' }}>
            {ACTIONS.map(({ action, label }) => (
              <ActionButton key={action} tone="secondary" onClick={() => updateWorkspace((current) => updateTask(current, task.id, action))}>
                {label}
              </ActionButton>
            ))}
          </div>
        )}
        {latest && <p role="status">{latest.action}</p>}
        <p style={{ color: 'var(--app-dim)', marginBottom: 0 }}>
          Nothing was sent or booked. Prepared notes appear as local, unsent Inbox drafts.
        </p>
      </Blueprint>
    </section>
  );
}
