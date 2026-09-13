/**
 * Customize Semester: the four things somebody changes about the front door.
 *
 * It is a shortcut to settings, not a second settings. Every control here
 * writes the same look key the full page writes, through the same `setLook`
 * action, and the two rows at the bottom go to the pages that hold the rest —
 * so there is exactly one place each preference actually lives, and this is a
 * faster door into four of them rather than a copy of them.
 *
 * That distinction is the whole reason it is short. The temptation with a
 * panel like this is to grow it until it is the settings screen in a drawer,
 * at which point there are two settings screens that disagree.
 *
 * ## Light and dark
 *
 * The two buttons pick a ground, and the grounds are the app's own — Indigo
 * and Paper, the default dark and the default light — rather than a `theme`
 * of this panel's invention. Somebody who has chosen Oxide or Fog keeps it:
 * the panel shows which side of the line their ground is on and switching
 * only ever moves them to the other side's default. Everything else about the
 * look is Colour and type, one row down.
 */

import { useRef } from 'react';
import { useStore } from '../../state/store';
import { currentLook } from '../../state/shape';
import { useModal } from '../../a11y/modal';
import { ground, resolveGround } from '../../lib/look';
import { usePrefersDark } from '../../lib/prefers';
import { secondLine } from '../../lib/dim';
import { Check } from '../Icons';

/** The ground each side of the switch lands on, when a move is needed. */
const DARK = 'ink';
const LIGHT = 'paper';

export function Customize({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const look = currentLook(state);
  const prefersDark = usePrefersDark();
  // Resolved, because "Match my device" is an instruction rather than a
  // palette and this panel has to show which one it currently resolves to.
  const light = ground(resolveGround(look.ground, prefersDark)).light;
  const shut = useRef<HTMLButtonElement>(null);
  const modal = useModal<HTMLDivElement>({ onClose, initial: shut });

  const setGround = (id: string) => dispatch({ type: 'setLook', look: { ground: id } });

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

      <div className="desk-sheet-label">Appearance</div>
      <div className="desk-sheet-pair">
        {[
          { id: DARK, label: 'Dark', on: !light },
          { id: LIGHT, label: 'Light', on: light },
        ].map((side) => (
          <button
            key={side.id}
            type="button"
            className={side.on ? 'bare desk-swatch is-on' : 'bare desk-swatch'}
            aria-pressed={side.on}
            // Only when it is a move. Pressing the side you are already on
            // must not overwrite somebody's Oxide with plain Indigo.
            onClick={() => {
              if (!side.on) setGround(side.id);
            }}
          >
            <span className={side.id === DARK ? 'desk-swatch-chip is-dark' : 'desk-swatch-chip'}>
              Aa
            </span>
            <span className="desk-swatch-name">{side.label}</span>
          </button>
        ))}
      </div>

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
      <button
        type="button"
        className="bare desk-sheet-row"
        onClick={() => {
          dispatch({ type: 'go', screen: 'setLook' });
          onClose();
        }}
      >
        Colour and type
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
