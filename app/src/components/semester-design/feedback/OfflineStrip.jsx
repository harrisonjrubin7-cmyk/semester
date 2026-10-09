import React from 'react';
/** Says what still works and that work is queued. */
export function OfflineStrip({ queued = 0, syncs = true }) {
  const tail = !syncs ? '; everything is kept on this device.' : queued > 0 ? ` — ${queued} change${queued === 1 ? '' : 's'} will sync when you are back.` : '; changes sync when you are back.';
  return <div className="state" data-kind="offline" role="status"><span className="status-glyph" aria-hidden="true">⊘</span><span>You are offline. You can keep working{tail}</span></div>;
}
