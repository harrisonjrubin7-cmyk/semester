import React from 'react';
/** What went wrong in plain words, and the way out. A recovery action is required. */
export function ErrorState({ title, body, recoverLabel = 'Try again', onRecover, secondaryLabel, onSecondary, reference }) {
  return (
    <div className="state" data-kind="error" role="alert">
      <div className="state-title"><span className="status-glyph" aria-hidden="true">!</span>{title}</div>
      <p className="state-body">{body}</p>
      <div className="state-actions">
        <button type="button" className="btn btn-primary" onClick={onRecover}>{recoverLabel}</button>
        {secondaryLabel && <button type="button" className="btn btn-ghost" onClick={onSecondary}>{secondaryLabel}</button>}
      </div>
      {reference && <p className="state-ref nums">Reference: <span className="mono">{reference}</span></p>}
    </div>
  );
}
