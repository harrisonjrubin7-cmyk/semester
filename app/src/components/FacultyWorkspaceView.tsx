import { useId } from 'react';
import { CourseStudioEntry } from './CourseStudio';
import { useStore } from '../state/store';

/**
 * The faculty teaching workspace on Account. It wraps the existing
 * CourseStudioEntry and adds no endpoint, roster, submission review, or
 * gradebook: those capabilities are separate work and are said so below.
 */
export function FacultyWorkspaceView() {
  const headingId = useId();
  const preparationHeadingId = useId();
  const connectedHeadingId = useId();
  const boundaryHeadingId = useId();

  const { account, school, state, dispatch } = useStore();

  // Remount connected teaching state when this visible context changes.
  // Server authorization is checked independently of this UI reset.
  const contextKey = JSON.stringify([account?.id ?? null, school.id, state.term]);

  return (
    <section aria-labelledby={headingId} className="faculty-workspace">
      <header>
        <h2 id={headingId}>Teaching workspace</h2>

        <p className="sharing-lead">
          Prepare your own course materials and manage the connected teaching work this account is authorized to perform.
        </p>

        <p className="sharing-meta">Term: {state.term || 'Not selected'}</p>

        <p className="sharing-meta">
          {account
            ? 'Signed in. Connected course access is checked below.'
            : 'Personal preparation is available. Sign in to check connected teaching access.'}
        </p>
      </header>

      <div style={{ display: 'grid', gap: 'var(--sp-5)', marginBlock: 'var(--sp-5)' }}>
        <section aria-labelledby={preparationHeadingId}>
          <h3 id={preparationHeadingId}>Personal preparation</h3>

          <p className="sharing-lead">
            Add your own syllabus or materials to prepare course work. Personal preparation does not publish to students or
            create an institutional course assignment.
          </p>

          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'go', screen: 'import' })}>
            Add course materials
          </button>
        </section>

        <section aria-labelledby={connectedHeadingId}>
          <h3 id={connectedHeadingId}>Connected Course Studio</h3>

          <p className="sharing-meta">The existing studio checks assigned courses and controls publication of AI rules, guidance and study packs.</p>

          <CourseStudioEntry key={contextKey} requested />
        </section>

        <section aria-labelledby={boundaryHeadingId}>
          <h3 id={boundaryHeadingId}>Access and authority</h3>

          <ul className="sharing-list">
            <li>Choosing a teaching presentation does not assign a course or grant access to student records.</li>
            <li>Publishing requires the existing connected-course checks and publication confirmation.</li>
            <li>This view does not add rosters, submission review, grading or grade-release capabilities.</li>
            <li>Published course guidance is separate from official academic records.</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
