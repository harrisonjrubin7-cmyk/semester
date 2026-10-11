import React from 'react';
/** Still structural placeholders + a spoken sentence. No spinner, no shimmer. */
export function LoadingState({ what = 'this screen', bars = [24, 14, 72, 72] }) {
  return (
    <div className="state-loading" aria-busy="true">
      <p className="sr-only" role="status">Loading {what}…</p>
      {bars.map((h, i) => <div key={i} className="state-loading-bar" style={{ height: h, width: i === 1 ? '40%' : i === 0 ? '62%' : '100%' }} aria-hidden="true"></div>)}
    </div>
  );
}
