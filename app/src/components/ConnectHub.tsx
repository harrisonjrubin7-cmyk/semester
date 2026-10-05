import { Group as Panel, NavRow } from './shell/Rows';
import { QUESTIONS, hubRows } from '../community/connect';
import { useStore } from '../state/store';

/**
 * Semester Connect, drawn where it is contextual: the rows
 * `community/connect.ts` names, each opening the screen that already holds
 * the thing — classmates, study groups, clubs and events, project teams,
 * mentors, opportunities, letters, the map.
 *
 * Not a destination of its own, by the brief's own rule and DO-NOT-BUILD
 * rule 1; and not a recommendation, so nothing here needs a reason beside it.
 * A section with no screen yet is not drawn (`hubRows`), because a row that
 * opens nothing is a dead end with a label on it. The same rows as Me's
 * control surface, for the reason given there: a hub that looks different
 * from the app it opens is one more thing to learn.
 */
export function ConnectHub() {
  const { dispatch } = useStore();
  return (
    <section aria-labelledby="connect-hub" style={{ marginBottom: 'var(--sp-7)' }}>
      <h2
        id="connect-hub"
        style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-2)', fontFamily: 'var(--font-heading)' }}
      >
        Find people, groups and opportunities
      </h2>
      <p style={{ margin: '0 0 var(--sp-4)', color: 'var(--app-dim)' }}>{QUESTIONS[1]}</p>
      <Panel>
        {hubRows().map((r) => (
          <NavRow key={r.id} label={r.title} sub={r.sub} onClick={() => dispatch({ type: 'go', screen: r.screen })} />
        ))}
      </Panel>
    </section>
  );
}
