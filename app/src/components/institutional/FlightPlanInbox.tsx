import { Blueprint } from '../Blueprint';
import { SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';

export function FlightPlanInbox() {
  const { workspace } = useFlightPlan();
  if (workspace.role !== 'student') return null;
  const drafts = workspace.messages.filter((message) => message.draft);
  if (drafts.length === 0) return null;

  return (
    <section aria-label="Prepared Flight Plan drafts" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
      <SectionLabel>Prepared Flight Plan drafts</SectionLabel>
      <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        {drafts.map((draft) => (
          <Blueprint key={draft.id} plain style={{ padding: 'var(--sp-4)' }}>
            <strong>{draft.subject}</strong>
            <div style={{ color: 'var(--app-dim)', marginBlock: 'var(--sp-1) var(--sp-2)' }}>
              Prepared locally · unsent
            </div>
            <div>{draft.body}</div>
          </Blueprint>
        ))}
      </div>
      <p style={{ color: 'var(--app-dim)', marginBottom: 0 }}>
        Nothing leaves Semester until you review it and send it through your own mail provider.
      </p>
    </section>
  );
}
