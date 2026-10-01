import type { Look } from '../../lib/look';
import { hasMode, toggleMode } from '../../lib/accessmode';

/** A keyboard-accessible disclosure over the same preferences used by Settings. */
export function AccessibilityTools({ look, onChange, onSettings }: {
  look: Look;
  onChange: (look: Look) => void;
  onSettings: () => void;
}) {
  return <details className="system-accessibility">
    <summary className="tap-y">Accessibility</summary>
    <div className="portal-panel" role="group" aria-label="Accessibility tools">
      <label>Text size <select className="input" aria-label="Text size" value={look.textSize ?? 'normal'} onChange={e => onChange({textSize: e.target.value})}>
        <option value="normal">Standard</option><option value="large">Large</option>
      </select></label>
      <label>Reading spacing <select className="input" aria-label="Reading spacing" value={look.lineHeight ?? 'normal'} onChange={e => onChange({lineHeight: e.target.value})}>
        <option value="normal">Standard</option><option value="airy">More space</option>
      </select></label>
      <button type="button" className="btn btn-ghost" aria-pressed={look.calm === 'calm'} onClick={() => onChange({calm: look.calm === 'calm' ? 'device' : 'calm'})}>Reduced motion</button>
      <button type="button" className="btn btn-ghost" aria-pressed={hasMode(look.access, 'plain')} onClick={() => onChange({access: toggleMode(look.access, 'plain')})}>Plain language</button>
      <button type="button" className="btn btn-ghost" aria-pressed={look.workspaceMode === 'focused'} onClick={() => onChange({workspaceMode: look.workspaceMode === 'focused' ? 'guided' : 'focused'})}>Focus View</button>
      <button type="button" className="btn btn-ghost" onClick={onSettings}>All accessibility settings</button>
    </div>
  </details>;
}
