import { PRIMARY_DESTINATIONS, primaryFor } from '../../lib/institutional-ia';
import { INSTITUTIONAL_PREVIEW } from '../../lib/institutional-preview';
import { useStore } from '../../state/store';
import { InstitutionalWorkspaceNav } from './InstitutionalWorkspaceNav';

export function InstitutionalPrimaryNav() {
  const { state, dispatch } = useStore();
  const current = primaryFor(state.screen);

  return (
    <nav className="institutional-primary-nav" aria-label="Primary">
      {PRIMARY_DESTINATIONS.map((destination) => (
        <button
          key={destination.id}
          type="button"
          className={`bare institutional-nav-button${destination.id === current?.id ? ' is-on' : ''}`}
          aria-current={destination.id === current?.id ? 'page' : undefined}
          onClick={() => dispatch({ type: 'go', screen: destination.screen })}
        >
          {destination.label}
        </button>
      ))}
    </nav>
  );
}

export function InstitutionalNavigation({ enabled = INSTITUTIONAL_PREVIEW }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <div className="institutional-navigation pane-strip">
      <InstitutionalPrimaryNav />
      <InstitutionalWorkspaceNav />
    </div>
  );
}
