import { CRISIS_NOTICE } from '../../community/crisis';
import { CATEGORY_TEXT } from './ReportSheet';

/** Help for the controls Community already provides; opening it reads no account data. */
export function CommunityGuidelines() {
  return (
    <details className="portal-panel" style={{ marginBlock: 'var(--sp-4)' }}>
      <summary style={{ minHeight: 44, paddingBlock: 'var(--sp-3)', cursor: 'pointer' }}>Community guidelines</summary>
      <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        <p style={{ margin: 0 }}>
          Keep posts relevant to the community’s purpose. Read the course policy shown in a course space before sharing
          coursework or answers. Ask permission before sharing another person’s information or images.
        </p>
        <section aria-label="What you can report">
          <h3>What you can report</h3>
          <p>Choose Report on the post, then the reason that fits:</p>
          <ul>
            {CATEGORY_TEXT.map(([category, label]) => <li key={category}>{label}</li>)}
          </ul>
          <p>The author is not told who reported the post. Sending a report does not guarantee removal or a response time.</p>
        </section>
        <section aria-label="Control what you see">
          <h3>Control what you see</h3>
          <p>
            Use Mute to hide an author’s posts from your feed. Use Block for the account behind a post, or leave a
            community from its own page. These choices are separate from sending a report.
          </p>
        </section>
        <section aria-label="Review and appeals">
          <h3>Review and appeals</h3>
          <p>
            A reviewer decides what happens to a reported post. Decisions about your posts appear in About your posts,
            with a reason. When Appeal this decision is offered, use it there; the appeal goes to a different reviewer.
            A pending appeal does not promise that the decision will be reversed.
          </p>
        </section>
        <p style={{ margin: 0 }}>{CRISIS_NOTICE}</p>
      </div>
    </details>
  );
}
