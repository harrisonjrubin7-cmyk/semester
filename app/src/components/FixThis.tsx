import { useState } from 'react';
import { FIXES, type Fix } from '../lib/fixthis';
import { noteOrigin } from '../lib/tickethandoff';
import { useStore } from '../state/store';
import { SaySomething } from './SaySomething';

/**
 * The seven correction paths, as a short list under "About this screen".
 *
 * A report opens in place, on the kind and with the first words the row
 * names, so the student adds only what is wrong. The two rows that are not
 * reports go to the screen where the thing is done. Nothing here is a
 * dialog: it opens where it is and closes where it is.
 */
export function FixThis() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState<Fix | null>(null);

  if (open?.report) {
    return (
      <div className="fix-this">
        <p className="fix-this-head">
          <span>{open.label}</span>{' '}
          <button type="button" className="bare link-quiet" onClick={() => setOpen(null)}>
            Back
          </button>
        </p>
        <SaySomething key={open.id} initialKind={open.report.kind} initialNote={open.report.note} />
      </div>
    );
  }

  return (
    <nav className="fix-this" aria-label="Fix this">
      <p className="fix-this-head">Something wrong here?</p>
      <ul className="fix-this-list">
        {FIXES.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="bare link-quiet tap-y"
              onClick={() => {
                if (!f.screen) return setOpen(f);
                // Help's ticket form reads where this was pressed, and why.
                if (f.screen === 'help') noteOrigin({ hash: window.location.hash, action: f.label, reference: null });
                dispatch({ type: 'go', screen: f.screen });
              }}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
