import { Group as Panel, NavRow } from './shell/Rows';
import { CONTROLS } from '../lib/mecontrols';
import { useStore } from '../state/store';

/**
 * The one control surface under Me: every row `lib/mecontrols.ts` names, in
 * its order, each opening the screen that already holds the thing.
 *
 * Drawn with the same rows as the rest of Me and Settings, because a control
 * surface that looks different from the app it controls is one more thing to
 * learn. Nothing here has state of its own: the rows are the data, and the
 * screens keep their own.
 */
export function MeControls() {
  const { dispatch } = useStore();
  return (
    <section aria-labelledby="me-controls" style={{ marginBottom: 'var(--sp-7)' }}>
      <h2
        id="me-controls"
        style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-heading)' }}
      >
        What Semester knows, and who can see it
      </h2>
      <Panel>
        {CONTROLS.map((c) => (
          <NavRow key={c.id} label={c.label} sub={c.sub} onClick={() => dispatch({ type: 'go', screen: c.screen })} />
        ))}
      </Panel>
    </section>
  );
}
