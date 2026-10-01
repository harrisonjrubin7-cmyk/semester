import { useEffect, useRef, useState } from 'react';
import { hasMode, toggleMode } from '../../lib/accessmode';
import { canSpeak, speakThen } from '../../lib/speak';
import type { AccessibilityToolsProps } from './AccessibilityTools';
export default function AccessibilityPanel({ look, onChange, onSettings, context }: AccessibilityToolsProps) {
  const reducedMotion = look.calm === 'calm' || look.calm === 'still';
  const stop = useRef<(() => void) | null>(null);
  const [audio, setAudio] = useState<{context?: string; message: string}>({message: ''});
  const audioStatus = audio.context === context ? audio.message : '';
  const setAudioStatus = (message: string) => setAudio({context, message});
  useEffect(() => {
    return () => { stop.current?.(); stop.current = null; };
  }, [context]);
  const read = () => {
    stop.current?.();
    if (!canSpeak()) { setAudioStatus('Read aloud is unavailable in this browser.'); return; }
    const text = window.getSelection()?.toString().trim() || document.getElementById('main')?.innerText?.trim();
    if (!text) { setAudioStatus('Select text to read, or open a workspace with visible text.'); return; }
    setAudioStatus('Reading aloud.');
    stop.current = speakThen(text, 1, spoke => setAudioStatus(spoke ? 'Reading finished.' : 'No audio played. Check your browser voice and sound settings.'));
  };
  return <div className="accessibility-panel" role="group" aria-label="Accessibility preferences">
      <div className="accessibility-panel-head">
        <div><h2>Make Semester easier to use</h2></div>
        <span className="accessibility-panel-note">Changes apply everywhere.</span>
      </div>
      <div className="accessibility-selects">
      <label>Text size <select className="input" aria-label="Text size" value={look.textSize ?? 'normal'} onChange={e => onChange({textSize: e.target.value})}>
        <option value="normal">Standard</option><option value="large">Large</option>
      </select></label>
      <label>Reading spacing <select className="input" aria-label="Reading spacing" value={look.lineHeight ?? 'normal'} onChange={e => onChange({lineHeight: e.target.value})}>
        <option value="normal">Standard</option><option value="airy">More space</option>
      </select></label>
      </div>
      <div className="accessibility-actions">
      <button type="button" className="btn btn-ghost" aria-pressed={reducedMotion} onClick={() => onChange({calm: reducedMotion ? 'device' : 'calm'})}>Reduced motion</button>
      <button type="button" className="btn btn-ghost" aria-pressed={hasMode(look.access, 'contrast')} onClick={() => onChange({access: toggleMode(look.access, 'contrast')})}>Increase contrast</button>
      <button type="button" className="btn btn-ghost" aria-pressed={hasMode(look.access, 'plain')} onClick={() => onChange({access: toggleMode(look.access, 'plain')})}>Plain language</button>
      <button type="button" className="btn btn-ghost" aria-pressed={look.workspaceMode === 'focused'} onClick={() => onChange({workspaceMode: look.workspaceMode === 'focused' ? 'guided' : 'focused'})}>Focus View</button>
      </div>
      <div className="accessibility-audio" role="group" aria-label="Read aloud controls">
        <button type="button" className="btn btn-secondary" onClick={read}>Read aloud</button>
        <button type="button" className="btn btn-ghost" disabled={audioStatus !== 'Reading aloud.'} onClick={() => { stop.current?.(); stop.current = null; setAudioStatus('Audio stopped.'); }}>Stop audio</button>
      </div>
      {audioStatus && <p className="accessibility-status" role="status">{audioStatus}</p>}
      <button type="button" className="bare link-quiet accessibility-settings-link" onClick={onSettings}>All accessibility settings</button>
    </div>;
}
