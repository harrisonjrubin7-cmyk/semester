import { useId } from 'react';
import { EmptyState } from './ui';
import { ErrorState, LoadingState, PermissionNotice } from './unity/States';
import { formatDateTime } from '../lib/locale';

/**
 * "Your semester" for a student: the controlled view of an already-authorized
 * projection. The parent supplies the data and the navigation callbacks; this
 * component makes no API calls and claims no database authority. Every item
 * says where it came from and how fresh it is, and missing evidence stays
 * unknown rather than reading as complete.
 */

export type Source = {
  label: string;
  observedAt: string | null;
  freshness: 'current' | 'stale' | 'unknown';
};

export type Action = {
  id: string;
  title: string;
  explanation: string;
  dueLabel: string | null;
  source: Source;
  canOpen: boolean;
  blockedReason: string | null;
};

export type Course = {
  id: string;
  label: string;
  relationship: 'planned' | 'enrolled' | 'archived';
  source: Source;
};

export type ReadyData = {
  contextKey: string;
  termLabel: string;
  contextLabel: string;
  actions: Action[];
  courses: Course[];
  connectionMessage: string;
};

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'forbidden'; message: string }
  | { status: 'ready'; data: ReadyData };

type Props = {
  activeContextKey: string;
  state: WorkspaceState;
  onRetry: () => void;
  onCreatePlan: () => void;
  onOpenAction: (id: string) => void;
  onOpenCourse: (id: string) => void;
};

const RELATIONSHIP_LABEL: Record<Course['relationship'], string> = {
  planned: 'Planned',
  enrolled: 'Enrolled',
  archived: 'Archived',
};

function SourceLine({ source }: { source: Source }) {
  return (
    <p className="sharing-meta">
      Source: {source.label}
      {' · '}Freshness: {source.freshness}
      {source.observedAt ? (
        <>
          {' · '}Checked: <time dateTime={source.observedAt}>{formatDateTime(source.observedAt)}</time>
        </>
      ) : (
        ' · Check time unavailable'
      )}
    </p>
  );
}

export function LearnerWorkspaceView({ activeContextKey, state, onRetry, onCreatePlan, onOpenAction, onOpenCourse }: Props) {
  const headingId = useId();
  const actionsId = useId();
  const coursesId = useId();

  // Data from another context is never shown, even while the new one loads.
  if (state.status === 'loading' || (state.status === 'ready' && state.data.contextKey !== activeContextKey)) {
    return <LoadingState what="this workspace" />;
  }

  if (state.status === 'forbidden') {
    return (
      <section aria-label="Workspace access">
        <PermissionNotice changed={state.message} why="No restricted workspace content is shown." />
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section aria-label="Workspace recovery">
        <ErrorState
          title="Your semester could not load"
          body={state.message}
          recover={{ label: 'Try again', run: onRetry }}
        />
      </section>
    );
  }

  const { data } = state;

  return (
    <section aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>Your semester</h2>
        <p className="sharing-meta">
          {data.contextLabel} · {data.termLabel}
        </p>
        <p className="sharing-lead">{data.connectionMessage}</p>

        <button type="button" className="btn btn-secondary" onClick={onCreatePlan}>
          Create a personal plan
        </button>
      </header>

      <section aria-labelledby={actionsId} style={{ marginBlock: 'var(--sp-5)' }}>
        <h3 id={actionsId}>Next actions</h3>

        {data.actions.length === 0 ? (
          <EmptyState title="No actions" body="No actions were returned for this workspace." />
        ) : (
          <ul className="sharing-list">
            {data.actions.map((action) => (
              <li key={action.id}>
                <h4>{action.title}</h4>
                <p>{action.explanation}</p>

                {action.dueLabel ? <p>Due: {action.dueLabel}</p> : null}

                <SourceLine source={action.source} />

                {action.blockedReason ? <p>Blocked: {action.blockedReason}</p> : null}

                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!action.canOpen}
                  onClick={() => {
                    if (action.canOpen) onOpenAction(action.id);
                  }}
                >
                  Review {action.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={coursesId}>
        <h3 id={coursesId}>Courses</h3>

        {data.courses.length === 0 ? (
          <EmptyState
            title="No courses"
            body="No courses were returned. You can still create a personal plan."
          />
        ) : (
          <ul className="sharing-list">
            {data.courses.map((course) => (
              <li key={course.id}>
                <h4>{course.label}</h4>
                <p>Relationship: {RELATIONSHIP_LABEL[course.relationship]}</p>
                <SourceLine source={course.source} />

                <button type="button" className="btn btn-ghost" onClick={() => onOpenCourse(course.id)}>
                  Open {course.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
