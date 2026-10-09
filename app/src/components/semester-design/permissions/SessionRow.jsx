import React from 'react';
/** A signed-in device or session, with remote sign-out.
 * Hardened: two-step sign-out inline (no modal), the current device can't sign itself out from here, unrecognised sessions are flagged with a next step, sign-out names the device. */
export function SessionRow({ device, place, lastActive, method, current = false, onSignOut, unrecognised = false, signingOut = false, onReport }) {
  const [ask, setAsk] = React.useState(false);
  return (
    <div className="perm-row" data-current={current || undefined} data-flag={unrecognised || undefined} aria-busy={signingOut || undefined}>
      <div className="perm-row-main"><div className="perm-row-name">{device}{current && <span className="perm-tag">This device</span>}{unrecognised && <span className="perm-tag" data-tone="danger">Not you?</span>}</div><div className="perm-row-use">{[place, lastActive, method].filter(Boolean).join(' · ')}</div>
        {unrecognised && <div className="perm-row-detail">Sign it out, then change your school password.{onReport && <> <button type="button" className="btn-link" onClick={onReport}>Report to IT</button></>}</div>}</div>
      {!current && onSignOut && (ask ? <span className="row" style={{ display: 'flex', gap: 'var(--sp-3)' }}><button type="button" className="btn btn-sm btn-danger" disabled={signingOut} onClick={() => { onSignOut(); setAsk(false); }}><span>{signingOut ? 'Signing out…' : 'Sign out ' + device.split(' · ')[0]}</span></button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsk(false)}><span>Cancel</span></button></span>
        : <button type="button" className="btn btn-sm" onClick={() => setAsk(true)} aria-label={'Sign out ' + device}><span>Sign out</span></button>)}
    </div>
  );
}
