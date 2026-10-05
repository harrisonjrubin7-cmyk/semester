import { useStore } from '../state/store';
import { ACCESS_MODES, PRESETS, hasMode, toggleMode, withPreset } from '../lib/accessmode';

/**
 * Presets over the look keys that already exist, and the four modes that did
 * not. See `lib/accessmode.ts` — nothing here is ever switched on for somebody.
 */
export function AccessModes() {
  const { state, dispatch } = useStore();
  return (
    <div className="jx-access">
      <div className="jx-chips" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="jx-chip"
            title={p.blurb}
            onClick={() => dispatch({ type: 'setLook', look: { ...p.look, access: withPreset(state.access, p.id) } })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="jx-muted">A preset sets the options below and on this page. Change any one of them afterwards and the rest stay.</p>
      {ACCESS_MODES.map((m) => (
        <label key={m.id} className="jx-check">
          <input
            type="checkbox"
            checked={hasMode(state.access, m.id)}
            onChange={() => dispatch({ type: 'setLook', look: { access: toggleMode(state.access, m.id) } })}
            aria-label={m.label}
          />
          <span className="jx-check-body">
            <span className="jx-check-title">{m.label}</span>
            <span className="jx-check-detail">{m.blurb}</span>
          </span>
        </label>
      ))}
      <p className="jx-muted">These follow you to your other devices. The app never turns one on because of how you use it.</p>
    </div>
  );
}
