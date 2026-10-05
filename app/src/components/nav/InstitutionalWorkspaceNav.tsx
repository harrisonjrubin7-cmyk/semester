import { WORKSPACES, workspaceFor } from '../../lib/institutional-ia';
import { journeyPositionFor, journeysFor } from '../../lib/journeys';
import { offered, screenName } from '../../lib/nav';
import type { Screen } from '../../lib/types';
import { useStore } from '../../state/store';
import { useAI } from '../../ai/store';

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
  const { state, dispatch, school } = useStore();
  const ai = useAI();
  const current = workspaceFor(state.screen);
  const availableJourneys = journeysFor(offered(school.capabilities, state.role));
  // Search and the full directory are shell routes rather than registered
  // destinations, so the role-filtered list cannot contain them. They still
  // belong to Start my semester and use the complete journey as a fallback.
  const position = journeyPositionFor(state.screen, availableJourneys) ?? journeyPositionFor(state.screen);

  return (
    <div className="institutional-workspace-wrap">
      <details className="institutional-workspace-disclosure">
        <summary>{current.label} workspace</summary>
        <nav aria-label="Workspace">
          <WorkspaceButtons screen={state.screen} />
        </nav>
        {position && (
          <section className="institutional-journey-context" aria-label="Current journey">
            <div className="institutional-journey-copy">
              <span className="kicker">Current journey</span>
              <strong>{position.journey.label}</strong>
              <span>{position.position} of {position.total} · {screenName(position.current)}</span>
            </div>
            <div className="institutional-journey-actions">
              {position.previous && (
                <button
                  type="button"
                  className="bare institutional-journey-button"
                  onClick={() => dispatch({ type: 'go', screen: position.previous! })}
                >
                  ← {screenName(position.previous)}
                </button>
              )}
              {position.next && (
                <button
                  type="button"
                  className="bare institutional-journey-button"
                  onClick={() => dispatch({ type: 'go', screen: position.next! })}
                >
                  {screenName(position.next)} →
                </button>
              )}
              <button
                type="button"
                className="bare institutional-journey-button institutional-journey-ai"
                onClick={() => ai.show(`Help me decide the next best step in ${position.journey.label}.`)}
              >
                ✦ Ask Semester
              </button>
            </div>
          </section>
        )}
      </details>
    </div>
  );
}
