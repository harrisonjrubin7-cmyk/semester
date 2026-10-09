import React from 'react';
/** Reversible work gets an undo, not a confirmation. One sentence + Undo; polite live region.
 * Hardened: auto-dismiss is clamped to at least 6 s, pauses while hovered or focused, Undo runs once (double clicks ignored), explicit Dismiss, onExpire tells the caller to commit. */
export function UndoToast({ message, onUndo, undoLabel = 'Undo', duration, onExpire, onDismiss }) {
  const [gone, setGone] = React.useState(false); const [held, setHeld] = React.useState(false); const used = React.useRef(false);
  const ms = duration ? Math.max(6000, duration) : null;
  React.useEffect(() => { if (!ms || held || gone) return; const id = setTimeout(() => { setGone(true); if (onExpire) onExpire(); }, ms); return () => clearTimeout(id); }, [ms, held, gone, onExpire]);
  if (gone) return null;
  const undo = () => { if (used.current) return; used.current = true; setGone(true); if (onUndo) onUndo(); };
  return <div className="toast" role="status" aria-live="polite" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}><span>{message}</span>{onUndo && <button type="button" className="btn btn-sm" onClick={undo}>{undoLabel}</button>}{onDismiss && <button type="button" className="btn btn-sm btn-ghost" aria-label="Dismiss" onClick={() => { setGone(true); onDismiss(); }}>Dismiss</button>}</div>;
}
