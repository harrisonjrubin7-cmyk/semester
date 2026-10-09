import React from 'react';
/** Floating bar during a focus session — what you're working on, time left, and the way out. Only frosted surface besides the tab bar.
 * Hardened: paused state with Resume, End asks once inline (no modal) when work is unsaved, timer announced only on state changes (not every tick), break prompt is a sentence. */
export function FocusBar({ task, remaining = '24:10', onPause, onResume, onEnd, breakDue, paused = false, unsaved = false }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="focus-bar" role="region" aria-label="Focus session" data-paused={paused || undefined}>
      <span className="focus-timer" role="timer" aria-live="off" aria-label={(paused ? 'Paused, ' : '') + remaining + ' left'}>{remaining}</span>
      <span style={{ color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task}</span>
      <span className="sr-only" aria-live="polite">{paused ? 'Focus session paused' : ''}</span>
      {breakDue && !paused && <span style={{ color: 'var(--text-primary)' }}>{breakDue}</span>}
      {confirm ? <><span>Unsaved changes stay in your draft.</span><button type="button" className="btn btn-sm" onClick={() => { setConfirm(false); if (onEnd) onEnd(); }}>End anyway</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(false)}>Keep going</button></>
        : <>{paused ? <button type="button" className="btn btn-sm" onClick={onResume}>Resume</button> : <button type="button" className="btn btn-sm" onClick={onPause}>Pause</button>}<button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (unsaved) setConfirm(true); else if (onEnd) onEnd(); }}>End session</button></>}
    </div>
  );
}
