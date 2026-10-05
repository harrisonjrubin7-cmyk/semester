import { useEffect, useId, useRef, useState } from 'react';
import { FOCUS_BAR_INSET, useBottomChrome } from '../../lib/bottomchrome.hook';
import { ACCESS_LOOK, WORKSPACE_MODES, workspaceModeOf, type WorkspaceMode } from '../../lib/look';
import { currentLook } from '../../state/shape';
import { useNow, useStore } from '../../state/store';
import {
  BREAK_MINUTES,
  breakDue,
  cameBack,
  focusedFor,
  snooze,
  startClock,
  switchOff,
  takeBreak,
  type BreakClock,
} from '../../lib/breaks';
import { SESSION_MINUTES } from '../../lib/unity';

/** The attribute on `<html>` the stylesheet reads the mode from. */
export const MODE_ATTR = 'data-workspace';

/** The mode in force, read through the look like every other setting. */
export function useWorkspaceMode(): WorkspaceMode {
  const { state } = useStore();
  return workspaceModeOf(currentLook(state).workspaceMode);
}

/**
 * Choosing how much of each workspace is drawn.
 *
 * Radio buttons with their explanation beside them, not a dropdown: four
 * choices whose difference is the whole point are easier to choose between
 * when you can read all four. Accessibility also sets the app's own text,
 * spacing and motion settings (`ACCESS_LOOK`) — so its effect is visible in
 * those settings afterwards, and can be undone one by one there.
 */
export function WorkspaceModePicker() {
  const { dispatch } = useStore();
  const mode = useWorkspaceMode();
  const name = useId();
  const choose = (id: WorkspaceMode) => {
    dispatch({
      type: 'setLook',
      look: id === 'access' ? { workspaceMode: id, ...ACCESS_LOOK } : { workspaceMode: id },
    });
  };
  return (
    <fieldset className="mode-picker">
      <legend className="kicker">Workspace mode</legend>
      {WORKSPACE_MODES.map((m) => (
        <label key={m.id} className="visibility-choice">
          <input type="radio" name={name} value={m.id} checked={mode === m.id} onChange={() => choose(m.id)} />
          <span>
            {m.label}
            <span className="visibility-about">{m.blurb}</span>
          </span>
        </label>
      ))}
      <p className="visibility-about">Modes change what is shown first. They never change what you can do.</p>
    </fieldset>
  );
}

/**
 * The way out of Focused mode, always on screen while it is on.
 *
 * Focused hides the tab bar and the shelves; this is what stands in their
 * place, so leaving is one press and never a hunt. It also carries the
 * optional timer. It sits where the tab bar was, which is the edge the
 * scroll margins already keep a focused control clear of.
 */
export function FocusBar() {
  const mode = useWorkspaceMode();
  // Mounted only while Focused, so the stretch of focus starts when the mode
  // is entered and is forgotten when it is left.
  return mode === 'focused' ? <FocusedBar /> : null;
}

function FocusedBar() {
  const { dispatch } = useStore();
  const now = useNow().getTime();
  const [clock, setClock] = useState<BreakClock>(() => startClock(now));
  const due = breakDue(clock, now);
  const said = `${focusedFor(clock, now)} minutes of focus. Time for a short break?`;

  /*
   * The bar is fixed over the bottom of the window, and so is the assistant's
   * button. Nothing told the button the bar was there: at 320px the bar is
   * the gutters' full width, and the button sat on top of its "Start" and
   * "Exit focus" controls. Measured at 320x640 before this, bar 518–628 and
   * button 576–628 on the same right edge. The bar now reports its inset, the
   * button stands on it, and the pane reserves it — see `FOCUS_BAR_INSET`.
   */
  const bar = useRef<HTMLDivElement>(null);
  useBottomChrome(bar, FOCUS_BAR_INSET);

  // Time away counts as a break — see `cameBack`. Set from the event, not in
  // the effect body, so this is a subscription and not a render loop.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt) setClock((c) => cameBack(c, hiddenAt, Date.now()));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div ref={bar} className="focus-bar" role="region" aria-label="Focus mode">
      <span className="kicker">Focus mode</span>
      {/*
        The reminder. A polite live region that is always in the document, so
        a screen reader hears the sentence when it appears without focus being
        taken from the work — kept out of `display: none`, which some readers
        stop watching. The buttons follow it in reading order. Nothing
        moves, blinks or dims — `lib/breaks.ts` has the rules.
      */}
      <p className="sr-only" role="status">
        {due ? said : ''}
      </p>
      {due && (
        // The same sentence for the eye; the status line above is the one a
        // reader hears, so this one is not read twice.
        <span className="focus-break" aria-hidden="true">
          {said}
        </span>
      )}
      {due ? (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              dispatch({ type: 'addTimer', label: 'Break', seconds: BREAK_MINUTES * 60, at: now });
              setClock((c) => takeBreak(c, now));
            }}
          >
            Take a {BREAK_MINUTES}-minute break
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setClock((c) => snooze(c, now))}>
            Not now
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setClock(switchOff)}>
            No more reminders
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            dispatch({ type: 'addTimer', label: 'Focus session', seconds: SESSION_MINUTES * 60, at: now })
          }
        >
          Start {SESSION_MINUTES}-minute timer
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'setLook', look: { workspaceMode: 'guided' } })}>
        Exit focus
      </button>
    </div>
  );
}
