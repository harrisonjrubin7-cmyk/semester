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
  const taskById = new Map(workspace.tasks.map((task) => [task.id, task]));
  const groups = plan.sessions.reduce<Array<{
    taskId: string;
    title: string;
    minutes: number;
    sessions: typeof plan.sessions;
  }>>((result, session) => {
    const current = result.at(-1);
    if (current?.taskId === session.taskId) {
      current.minutes += session.minutes;
      current.sessions.push(session);
    } else {
      result.push({
        taskId: session.taskId,
        title: session.title,
        minutes: session.minutes,
        sessions: [session],
      });
    }
    return result;
  }, []);
  const taskLabel = `${groups.length} task${groups.length === 1 ? '' : 's'}`;
  const sessionLabel = `${plan.sessions.length} session${plan.sessions.length === 1 ? '' : 's'}`;

  return (
    <section aria-label="Study plan" style={{ padding: 'var(--sp-6) var(--sp-6) 0' }}>
      <SectionLabel>Plan your week</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <details className="flight-plan-card">
          <summary>
            Study plan · {planned} of {capacity} min · {taskLabel} · {sessionLabel}
          </summary>
          <div className="flight-plan-body">
            <p className="flight-plan-intro">
              Confirmed work is grouped by task and split into focused sessions within your available week.
            </p>
            <div className="flight-plan-groups">
              {groups.map((group) => {
                const task = taskById.get(group.taskId);
                return (
                  <details className="flight-plan-task" key={group.taskId}>
                    <summary>
                      {group.title} · {group.sessions.length} session{group.sessions.length === 1 ? '' : 's'} · {group.minutes} min
                    </summary>
                    <div className="flight-plan-task-body">
                      {task && (
                        <div className="flight-plan-source">
                          {task.conflict ? 'Source date retained · ' : ''}due in {task.dueDay} days · {task.source}
                        </div>
                      )}
                      {group.sessions.map((session, index) => (
                        <div className="flight-plan-session" key={`${session.taskId}-${index}`}>
                          Plan day {session.day + 1} · {session.minutes} min
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
            {uncertain.length > 0 && (
              <details className="flight-plan-warning">
                <summary>
                  {uncertain.length} task{uncertain.length === 1 ? '' : 's'} needs a source-date check
                </summary>
                {uncertain.map((task) => (
                  <div className="flight-plan-warning-body" key={task.id}>
                    <strong>{task.title}</strong>
                    <p>Not scheduled yet · {task.conflict}</p>
                    <ActionButton onClick={() => updateWorkspace((current) => updateTask(current, task.id, 'confirm'))}>
                      Use syllabus date in sample plan
                    </ActionButton>
                  </div>
                ))}
              </details>
            )}
            {plan.unscheduledMinutes > 0 && (
              <p role="status" className="flight-plan-overflow">
                {plan.unscheduledMinutes} min remain visible as overflow.
              </p>
            )}
          </div>
        </details>
      </Blueprint>
    </section>
  );
}
