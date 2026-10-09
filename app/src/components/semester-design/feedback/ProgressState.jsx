import React from 'react';
/** A determinate wait — an upload, an import. Real <progress>, percentage in words, Cancel/Retry. */
export function ProgressState({ label, done = 0, total = 100, note, failed, onCancel, onRetry }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="state">
      <div className="state-progress-head"><span>{label}</span><span className="nums">{failed ? 'Stopped' : pct + '%'}</span></div>
      {failed ? <p className="state-body" role="alert">{failed}</p> : <progress className="state-progress-bar" value={done} max={total} aria-label={label}></progress>}
      {note && <p className="state-note">{note}</p>}
      <div className="state-actions">
        {failed && onRetry && <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>Retry</button>}
        {!failed && onCancel && pct < 100 && <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
