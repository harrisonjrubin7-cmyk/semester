import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { buildPlan, updateTask } from '../../lib/flight-plan';
import { useFlightPlan } from './FlightPlanContext';

export function FlightPlanCalendar() {
  const { workspace, updateWorkspace } = useFlightPlan();
  if (workspace.role !== 'student') return null;

  const plan = buildPlan(workspace);
  const capacity = workspace.availableHours * 60;
  const planned = plan.sessions.reduce((total, session) => total + session.minutes, 0);
  const uncertain = workspace.tasks.filter((task) => task.status === 'open' && !task.confirmed);

  return (
    <section aria-label="Sample Flight Plan capacity" style={{ padding: 'var(--sp-6) var(--sp-6) 0' }}>
      <SectionLabel>Sample Flight Plan capacity</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <strong>{planned} of {capacity} min planned</strong>
        <p style={{ color: 'var(--app-dim)', marginBlock: 'var(--sp-2) var(--sp-4)' }}>
          Confirmed sample work is split into focused sessions without exceeding your stated week.
        </p>
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          {plan.sessions.map((session, index) => (
            <div key={`${session.taskId}-${index}`} style={{ borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
              Session · {session.title} · {session.minutes} min
            </div>
          ))}
          {uncertain.map((task) => (
            <div key={task.id} style={{ borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
              <strong>{task.title}</strong>
              <div style={{ color: 'var(--app-dim)', marginBlock: 'var(--sp-1) var(--sp-3)' }}>
                Unscheduled until source is confirmed · {task.conflict}
              </div>
              <ActionButton onClick={() => updateWorkspace((current) => updateTask(current, task.id, 'confirm'))}>
                Confirm sample source date
              </ActionButton>
            </div>
          ))}
          {workspace.tasks
            .filter((task) => task.status === 'open' && task.confirmed)
            .map((task) => (
              <div key={`${task.id}-source`} style={{ color: 'var(--app-dim)' }}>
                {task.title} · Source date retained · due in {task.dueDay} days
              </div>
            ))}
        </div>
        {plan.unscheduledMinutes > 0 && (
          <p role="status" style={{ marginTop: 'var(--sp-4)' }}>
            {plan.unscheduledMinutes} min remain visible as overflow.
          </p>
        )}
      </Blueprint>
    </section>
  );
}
