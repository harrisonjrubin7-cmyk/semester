import React from 'react';
/** What changed about access, why, who controls it, and where to change it. */
export function PermissionNotice({ changed, why, controlLabel, onControl }) {
  return (
    <div className="state" data-kind="permission" role="status">
      <div className="state-title"><span className="status-glyph" aria-hidden="true">⊙</span>{changed}</div>
      <p className="state-body">{why}</p>
      {controlLabel && <button type="button" className="link-quiet" style={{ alignSelf: 'flex-start' }} onClick={onControl}>{controlLabel}</button>}
    </div>
  );
}
