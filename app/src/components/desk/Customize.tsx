/**
 * Customize Semester: the few things somebody changes about the front door.
 *
 * It is a shortcut to settings, not a second settings. The one preference it
 * *writes* is its own — whether the search home draws its shortcuts, which
 * exists nowhere else — and everything else here is a door: the launcher, the
 * page that holds the rest of the look, and the way back to the tab bar. So
 * there is exactly one place each preference lives, and this is a faster route
 * to some of them rather than a copy of them.
 *
 * That distinction is the whole reason it is short. The temptation with a
 * panel like this is to grow it until it is the settings screen in a drawer,
 * at which point there are two settings screens that disagree.
 *
 * ## There was a Dark/Light pair here, and it was the disagreement
 *
 * It claimed to be safe: two buttons picking between the app's own default
 * dark and default light, showing which side of the line you were on, moving
 * you only when you pressed the other one. What it could not express is the
 * option `screens/settings/Look.tsx` puts *above* the ten grounds, because it
 * is the answer for most people — **Match my device**.
 *
 * The pair read the ground through `resolveGround`, which turns `device` into
 * whichever ground the device currently resolves to. So somebody following
 * their device was shown Dark, lit, as though they had chosen it. Pressing
 * Light then counted as a move and wrote a fixed `paper` over the
 * instruction — silently, one way, with no route back to Match my device from
 * this panel, and `paper` is not even the ground Match my device resolves
 * light to (`parchment`).
 *
 * A second control over one key, and the second one could not say what the
 * key held. That is the whole of why it is gone rather than corrected: a
 * faithful three-state version would still be a second writer, and the row
 * below already opens the page where all eleven states are one tap each.
 * What the row does now is *report* — it names the ground you are on, through
 * `groundName`, which is the function that does not erase `device`.
 */

import { useRef } from 'react';
import { useStore } from '../../state/store';
import { currentLook } from '../../state/shape';
import { useModal } from '../../a11y/modal';
import { groundName } from '../../lib/look';
import { secondLine } from '../../lib/dim';
import { Check } from '../Icons';

export function Customize({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const look = currentLook(state);
  const shut = useRef<HTMLButtonElement>(null);
  const modal = useModal<HTMLDivElement>({ onClose, initial: shut });

  return (
    <div
      className="desk-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Customize Semester"
      ref={modal.ref}
      tabIndex={-1}
      onKeyDown={modal.onKeyDown}
    >
      <div className="desk-sheet-head">
        <div className="desk-sheet-name chrome-text">Customize Semester</div>
        <button
          type="button"
          className="bare desk-sheet-shut"
          ref={shut}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <p className="desk-sheet-note" style={secondLine()}>
        Make a little room for your semester.
      </p>

      <button
        type="button"
        className="bare desk-sheet-toggle"
        role="switch"
        aria-checked={look.shortcuts !== 'off'}
        onClick={() =>
          dispatch({
            type: 'setLook',
            look: { shortcuts: look.shortcuts === 'off' ? 'on' : 'off' },
          })
        }
      >
        <span>Show shortcuts</span>
        <span className={look.shortcuts !== 'off' ? 'desk-tick is-on' : 'desk-tick'}>
          {look.shortcuts !== 'off' && <Check size={15} />}
        </span>
      </button>

      <button
        type="button"
        className="bare desk-sheet-row"
        onClick={() => {
          dispatch({ type: 'apps', open: true });
          onClose();
        }}
      >
        Choose favourite apps
      </button>
      {/*
        The row that replaced the pair, and it says what it is showing.

        `groundName` rather than `ground().label`: the second erases Match my
        device into whichever palette it happens to resolve to, which is the
        exact misreport the pair was built on. Reporting the setting and
        offering to change it are different jobs, and this row only does the
        first — the page it opens does the second, for all eleven.
      */}
      <button
        type="button"
        className="bare desk-sheet-row desk-sheet-said"
        onClick={() => {
          dispatch({ type: 'go', screen: 'setLook' });
          onClose();
        }}
      >
        <span>Colour and type</span>
        <span className="desk-sheet-value" style={secondLine()}>
          {groundName(look.ground)}
        </span>
      </button>

      {/*
        The way back to the app as it was.

        Not a reset and not a preview: it is the navigation setting, written
        from here, so somebody who tries the workspace and does not want it is
        one click from the bar they had — and one click from returning, on
        Layout and navigation, where every other navigation is chosen. A
        design that can only be entered is a design people refuse to try.
      */}
      <button
        type="button"
        className="bare desk-sheet-plain"
        onClick={() => {
          dispatch({ type: 'setNav', nav: 'tabs' });
          onClose();
        }}
      >
        Open the original layout
      </button>
    </div>
  );
}
