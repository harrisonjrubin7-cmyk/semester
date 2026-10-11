import React from 'react';
/** "About this screen" — a quiet disclosure at the foot of every screen: what it's for, where the data comes from, who to ask. */
export function ScreenGuide({ items = [], open = false }) {
  return (
    <details className="screen-guide" open={open}>
      <summary><span aria-hidden="true">ⓘ</span>About this screen</summary>
      <dl>{items.map((it) => <React.Fragment key={it.q}><dt>{it.q}</dt><dd>{it.a}</dd></React.Fragment>)}</dl>
    </details>
  );
}
