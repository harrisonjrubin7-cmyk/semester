import { useOfficeActions } from '../lib/office-actions.hook';
import { useNow, useStore } from '../state/store';
import { dueLine } from './OfficeActionFeed';
import { SourceBadge } from './SourceBadge';

/**
 * The first three open office actions on Today (`office_action_feed`, Phase
 * J), for the briefing Today. With the Action Center on, they are ranked in
 * it instead and this does not render. Renders nothing signed out, while
 * loading, or when there are none: Today does not announce an empty feed.
 */
export function OfficeActionsToday({ accountId }: { accountId?: string | null } = {}) {
  const { dispatch } = useStore();
  const { state } = useOfficeActions(true, accountId);
  const now = useNow().getTime();
  if (state.kind === 'error') {
    return (
      <p className="portal-muted office-today" role="status">
        Campus office actions could not load. They are on Key dates.
      </p>
    );
  }
  if (state.kind !== 'ready') return null;
  const open = state.actions.filter((a) => a.doneAt === null);
  if (!open.length) return null;
  return (
    <section className="portal-panel office-today" aria-label="From campus offices">
      <h3>From campus offices</h3>
      <ul className="office-list">
        {open.slice(0, 3).map((a) => (
          <li key={a.id} className="office-card">
            <p className="office-from">{a.officeLabel}</p>
            <p className="office-title">
              <strong>{a.title}</strong>
            </p>
            {a.dueAt !== null ? <p>{dueLine(a.dueAt)}</p> : null}
            <SourceBadge label="institution_verified" at={a.updatedAt} now={now} />
          </li>
        ))}
      </ul>
      <button type="button" className="workspace-text-button" onClick={() => dispatch({ type: 'go', screen: 'registrar' })}>
        {open.length > 3 ? `All ${open.length} from campus offices` : 'Details and official links'}
      </button>
    </section>
  );
}
