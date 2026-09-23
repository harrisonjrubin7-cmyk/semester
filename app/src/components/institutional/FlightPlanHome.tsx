import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { buildPlan, nextFlightAction } from '../../lib/flight-plan';
import type { Screen } from '../../lib/types';
import { useFlightPlan } from './FlightPlanContext';

export function FlightPlanHome({
  enabled,
  onNavigate,
}: {
  enabled: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const { workspace, storageStatus } = useFlightPlan();
  if (!enabled || workspace.role !== 'student') return null;

  const plan = buildPlan(workspace);
  const next = nextFlightAction(workspace);
  const task = workspace.tasks.find((candidate) => candidate.id === next.taskId);
  const plannedMinutes = plan.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const uncertain = workspace.tasks.filter((candidate) => !candidate.confirmed && candidate.status === 'open').length;
  const recovery = workspace.tasks.filter((candidate) => candidate.status === 'missed').length;
  const destination: Screen =
    next.kind === 'recover'
      ? 'behind'
      : next.kind === 'confirm-source'
        ? 'calendar'
        : next.kind === 'study'
          ? 'study'
          : 'university';
  const actionLabel =
    next.kind === 'recover'
      ? 'Review recovery'
      : next.kind === 'confirm-source'
        ? 'Verify source'
        : next.kind === 'study'
          ? 'Start studying'
          : 'Explore campus';
  const nextLine =
    next.kind === 'recover'
      ? `Recover ${task?.title ?? 'missed work'}`
      : next.kind === 'confirm-source'
        ? `Verify ${task?.title ?? 'a source'}`
        : next.kind === 'study'
          ? `Study ${task?.title ?? 'the next task'}`
          : 'Your sample plan is clear';

  return (
    <section aria-label="Synthetic Flight Plan" style={{ marginBottom: 'var(--sp-6)' }}>
      <SectionLabel>Synthetic Flight Plan</SectionLabel>
      <Blueprint
        style={{
          padding: 'var(--sp-7)',
          background: 'var(--app-hero)',
          borderLeft: '3px solid var(--app-accent)',
        }}
      >
        <div className="kicker">Your next decision</div>
        <div
          className="chrome-text"
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--type-xl)',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {nextLine}
        </div>
        <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
          {plannedMinutes} min planned · {uncertain} {uncertain === 1 ? 'source' : 'sources'} to verify ·{' '}
          {recovery} recovery {recovery === 1 ? 'choice' : 'choices'}
        </p>
        {plan.unscheduledMinutes > 0 && (
          <p style={{ color: 'var(--app-dim)' }}>
            {plan.unscheduledMinutes} min remain visible outside your stated weekly capacity.
          </p>
        )}
        {storageStatus === 'unavailable' && (
          <p role="status">Changes work for this visit, but browser storage is unavailable.</p>
        )}
        <ActionButton onClick={() => onNavigate(destination)}>{actionLabel}</ActionButton>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <button type="button" className="bare" onClick={() => onNavigate('calendar')}>
            Open Calendar
          </button>
          <button type="button" className="bare" onClick={() => onNavigate('study')}>
            Open Study
          </button>
          <button type="button" className="bare" onClick={() => onNavigate('university')}>
            University services
          </button>
        </div>
      </Blueprint>
    </section>
  );
}
