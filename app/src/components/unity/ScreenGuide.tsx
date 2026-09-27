import { useId, useState } from 'react';
import { explain } from '../../lib/explain';
import type { Screen } from '../../lib/types';
import { useStore } from '../../state/store';

/**
 * "About this screen" — the same help, in the same place, on every screen.
 *
 * Drawn by `ShellBody`, which every screen passes through, so it cannot be
 * forgotten on one and it is always the last thing in the screen's content —
 * the "same relative order" WCAG 2.2's 3.2.6 asks help to keep.
 *
 * Closed by default and opened in place: progressive disclosure rather than a
 * dialog, so it never covers the thing it is explaining and never takes focus
 * anywhere unexpected. A real button with `aria-expanded`, a real region with
 * a name, and the four answers as a description list.
 */
export function ScreenGuide({ screen }: { screen: Screen }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const region = useId();
  const e = explain(screen);
  return (
    <aside className="screen-guide" aria-label="About this screen">
      <button
        type="button"
        className="bare link-quiet tap-y"
        aria-expanded={open}
        aria-controls={region}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="status-glyph" aria-hidden="true">
          ?{' '}
        </span>
        About this screen
      </button>
      {open && (
        <div id={region} className="screen-guide-body">
          <dl>
            <dt>What is this?</dt>
            <dd>{e.what}</dd>
            <dt>Why does it matter?</dt>
            <dd>{e.why}</dd>
            <dt>Where does this information come from?</dt>
            <dd>{e.from}</dd>
            <dt>What can I do next?</dt>
            <dd>{e.next}</dd>
          </dl>
          {screen !== 'help' && (
            <button type="button" className="bare link-quiet tap-y" onClick={() => dispatch({ type: 'go', screen: 'help' })}>
              Open the guidebook
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
