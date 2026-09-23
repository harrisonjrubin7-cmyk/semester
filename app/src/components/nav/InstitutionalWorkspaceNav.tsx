import { WORKSPACES, workspaceFor } from '../../lib/institutional-ia';
import type { Screen } from '../../lib/types';
import { useStore } from '../../state/store';

function WorkspaceButtons({ screen }: { screen: Screen }) {
  const { dispatch } = useStore();
  const current = workspaceFor(screen);

  return (
    <>
      {WORKSPACES.map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          className={`bare institutional-nav-button${workspace.id === current.id ? ' is-on' : ''}`}
          aria-current={workspace.id === current.id ? 'page' : undefined}
          onClick={() => dispatch({ type: 'go', screen: workspace.screen })}
        >
          {workspace.label}
        </button>
      ))}
    </>
  );
}

export function InstitutionalWorkspaceNav() {
  const { state } = useStore();
  const current = workspaceFor(state.screen);

  return (
    <div className="institutional-workspace-wrap">
      <nav className="institutional-workspace-desktop" aria-label="Workspace">
        <WorkspaceButtons screen={state.screen} />
      </nav>
      <details className="institutional-workspace-sheet">
        <summary>{current.label} workspace</summary>
        <nav aria-label="Workspace">
          <WorkspaceButtons screen={state.screen} />
        </nav>
      </details>
    </div>
  );
}
