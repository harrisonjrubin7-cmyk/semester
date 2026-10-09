import React from 'react';
/** Acknowledge, then point at what is next. Respectful, never celebratory. */
export function SuccessState({ title, body, nextLabel, onNext }) {
  return (
    <div className="state" data-kind="success" role="status">
      <div className="state-title"><span className="status-glyph" aria-hidden="true">✓</span>{title}</div>
      {body && <p className="state-body">{body}</p>}
      {nextLabel && <p className="state-body">Next: <button type="button" className="link-quiet" style={{ fontSize: 'inherit' }} onClick={onNext}>{nextLabel}</button></p>}
    </div>
  );
}
