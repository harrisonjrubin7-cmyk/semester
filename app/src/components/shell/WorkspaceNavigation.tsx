import { useStore } from '../../state/store';
import { forSchool, useCapabilityDiscovery } from '../../lib/capabilities';
import { holdsConsole } from '../../lib/console/capability';
import { secondLine } from '../../lib/dim';
import { journeyFor } from '../../lib/rolejourney';
import type { WorkspaceView } from '../../lib/route';
import type { Screen } from '../../lib/types';

type WorkspaceEntryProps = {
  placement?: 'directory' | 'navigation';
  onNavigate?: () => void;
};

type WorkspaceDestination = {
  key: string;
  label: string;
  description: string;
  current: boolean;
  open: () => void;
};

/** The generic destination whose current state is owned by this group. */
export function currentWorkspaceRoot(screen: Screen, view: WorkspaceView | null): Screen | null {
  if (screen === 'account' && view === 'course-studio') return 'account';
  if (screen === 'university') return 'university';
  return null;
}

/**
 * The one permission-aware list of workspaces Semester can actually open.
 *
 * Directory renders the explanatory cards; persistent shell chrome renders
 * the compact version. Both use the same capability discovery and the same
 * allowlisted reducer actions, so a presentation change cannot create access
 * or invent a route.
 */
export function WorkspaceEntry({
  placement = 'directory',
  onNavigate,
}: WorkspaceEntryProps = {}) {
  const { state, dispatch, school, account } = useStore();
  const access = useCapabilityDiscovery(account?.id ?? '');
  const schoolCapabilities = forSchool(access.grants, school.id);
  const operator = access.status === 'ready' && holdsConsole(access.grants);
  const listings = access.status === 'ready'
    && schoolCapabilities.some((capability) => capability === 'opportunity:publish' || capability === 'opportunity:moderate');

  const navigate = (action: Parameters<typeof dispatch>[0]) => {
    onNavigate?.();
    dispatch(action);
  };
  const destinations: WorkspaceDestination[] = [
    {
      key: 'teaching',
      label: 'Teaching',
      description: 'Open the existing Course Studio check for this account.',
      current: state.screen === 'account' && state.workspaceView === 'course-studio',
      open: () => navigate({ type: 'openWorkspace', screen: 'account', view: 'course-studio' }),
    },
    {
      key: 'university',
      label: 'University services',
      description: 'Plans, drafts and server-gated institution tools for this university.',
      // When drafts are not actually granted, this remains the honest
      // current umbrella instead of leaving the navigation with no current
      // destination for a denied or stale drafts deep link.
      current: state.screen === 'university' && (state.workspaceView !== 'drafts' || !listings),
      open: () => navigate({ type: 'openWorkspace', screen: 'university', view: 'overview' }),
    },
    ...(listings
      ? [{
          key: 'listings',
          label: 'External listings',
          description: 'Open the existing external listing drafts workspace.',
          current: state.screen === 'university' && state.workspaceView === 'drafts',
          open: () => navigate({ type: 'openWorkspace', screen: 'university', view: 'drafts' }),
        } satisfies WorkspaceDestination]
      : []),
    ...(operator
      ? [{
          key: 'operations',
          label: 'Semester Operations',
          description: 'Open the canonical capability-gated Console.',
          current: state.screen === 'console',
          open: () => navigate({ type: 'go', screen: 'console' }),
        } satisfies WorkspaceDestination]
      : []),
  ];

  const accessMessage = access.status === 'signed-out'
    ? 'Sign in to check connected access for this account.'
    : access.status === 'loading'
      ? 'Checking connected access for this account…'
      : access.status === 'ready' && !operator && !listings
        ? 'No additional connected workspace was found for this account and university.'
        : access.status === 'ready'
          ? 'Connected access shown above was reported by the server and is checked again at each destination.'
          : access.error;

  if (placement === 'navigation') {
    return (
      <div className="workspace-nav" role="group" aria-label="Workspaces">
        <div className="workspace-nav-label">Workspaces</div>
        {destinations.map((destination) => (
          <button
            key={destination.key}
            type="button"
            className={destination.current ? 'bare workspace-nav-item is-on' : 'bare workspace-nav-item'}
            onClick={destination.open}
            title={destination.description}
            aria-current={destination.current ? 'page' : undefined}
          >
            <span>{destination.label}</span>
            <span aria-hidden="true" className="workspace-nav-go">↗</span>
          </button>
        ))}
        <div
          className="workspace-nav-status"
          role={access.status === 'error' ? 'alert' : access.status === 'loading' ? 'status' : undefined}
        >
          {accessMessage}
        </div>
        {access.status === 'error' ? (
          <button type="button" className="bare workspace-nav-retry" onClick={access.retry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const local = journeyFor(state.role);
  return (
    <section className="jx-card" aria-labelledby="workspace-entry-heading" style={{ marginBlock: 'var(--sp-5)' }}>
      <h2 id="workspace-entry-heading" style={{ marginTop: 0 }}>Your workspaces</h2>
      <p style={secondLine()}>
        Keep this account and university while you move between work already implemented in Semester.
        A presentation choice never grants connected access.
      </p>

      <div className="deskdir-fav">
        {destinations.map((destination) => (
          <button
            key={destination.key}
            type="button"
            className="bare deskdir-favcard"
            onClick={destination.open}
          >
            <span className="deskdir-favsays">
              <strong>{destination.label}</strong>
              <span className="deskdir-favgroup" style={secondLine()}>{destination.description}</span>
            </span>
            <span aria-hidden="true" className="deskdir-favgo">↗</span>
          </button>
        ))}
      </div>

      <div
        role={access.status === 'error' ? 'alert' : access.status === 'loading' ? 'status' : undefined}
        style={{ ...secondLine(), marginTop: 'var(--sp-3)' }}
      >
        {accessMessage}
      </div>
      {access.status === 'error' ? <button type="button" className="bare tappable" onClick={access.retry}>Try again</button> : null}

      <div style={{ ...secondLine(), marginTop: 'var(--sp-3)' }}>
        <strong>Local preparation:</strong> {local.firstAction}{' '}
        {local.screen ? (
          <button
            type="button"
            className="bare inline-link"
            onClick={() => navigate({ type: 'go', screen: local.screen as Screen })}
          >
            Continue
          </button>
        ) : null}{' '}
        <button type="button" className="bare inline-link" onClick={() => navigate({ type: 'go', screen: 'setCourses' })}>
          Change presentation
        </button>
      </div>
      <p style={{ ...secondLine(), marginBottom: 0 }}>
        Company, investor and developer workflows are not implemented here yet.
      </p>
    </section>
  );
}
