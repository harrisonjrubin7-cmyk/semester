import { useId } from 'react';
import { ACCESS_LOOK, WORKSPACE_MODES, workspaceModeOf, type WorkspaceMode } from '../../lib/look';
import { currentLook } from '../../state/shape';
import { useStore } from '../../state/store';
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
  const { dispatch } = useStore();
  const mode = useWorkspaceMode();
  if (mode !== 'focused') return null;
  return (
    <div className="focus-bar" role="region" aria-label="Focus mode">
      <span className="kicker">Focus mode</span>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() =>
          dispatch({ type: 'addTimer', label: 'Focus session', seconds: SESSION_MINUTES * 60, at: Date.now() })
        }
      >
        Start {SESSION_MINUTES}-minute timer
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'setLook', look: { workspaceMode: 'guided' } })}>
        Exit focus
      </button>
    </div>
  );
}
