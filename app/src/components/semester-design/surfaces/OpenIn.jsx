import React from 'react';
/** "Open in" — the way from one thing to every place it matters. Words, never icons alone; wraps on a phone. */
export function OpenIn({ targets = [], about, onOpen }) {
  if (!targets.length) return null;
  return (
    <div className="open-in" role="group" aria-label={'Open ' + about + ' in'}>
      <span className="open-in-label" aria-hidden="true">Open in</span>
      {targets.map((t) => <button key={t} type="button" className="pill-soft" onClick={() => onOpen && onOpen(t)}>{t}</button>)}
    </div>
  );
}
