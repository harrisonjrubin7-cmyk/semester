import React, { useId } from 'react';
const L = { required: ['?', 'Needs approval'], pending: ['…', 'Waiting for approval'], approved: ['✓', 'Approved'], rejected: ['⊘', 'Not approved'], expired: ['⊘', 'Approval expired'], changed: ['!', 'Changed after approval'] };
/** Shows where a consequential change is in its approval path.
 * Hardened: requester can never approve their own request (selfRequested hides Approve), multi-step count, approval bound to a version, expired/changed states force re-approval, reject needs a reason, buttons disable while busy. */
export function ApprovalBanner({ state = 'required', what, approver, requestedBy, onRequest, onApprove, onReject, step, of, version, reason, selfRequested = false, busy = false, expires }) {
  const st = L[state] ? state : 'required';
  const [g, t] = L[st];
  const wid = useId(); const [rejecting, setRejecting] = React.useState(false); const [why, setWhy] = React.useState('');
  const sub = st === 'pending' ? [approver && 'With ' + approver, step && of && 'step ' + step + ' of ' + of, expires && 'expires ' + expires].filter(Boolean).join(' · ')
    : st === 'required' ? 'A second person must approve before this applies.'
    : st === 'changed' ? 'The request changed after approval, so it needs approving again.'
    : st === 'expired' ? 'The approval window closed. Request it again.'
    : st === 'rejected' ? [reason, requestedBy && 'Requested by ' + requestedBy].filter(Boolean).join(' · ')
    : [approver && 'By ' + approver, requestedBy && 'requested by ' + requestedBy].filter(Boolean).join(', ');
  return (
    <div className="approval-banner" data-state={st} role="status" aria-busy={busy || undefined}>
      <span className="gov-glyph" aria-hidden="true">{g}</span>
      <div className="approval-body"><b>{t}: {what}</b>{version && <span className="gov-sub">Applies to version {version} only</span>}<span className="gov-sub">{sub}</span>
        {rejecting && <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}><label className="field-label" htmlFor={wid}>Reason for rejecting · Required</label><textarea id={wid} className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></div>}
      </div>
      <div className="approval-actions">
        {(st === 'required' || st === 'expired' || st === 'changed') && onRequest && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onRequest}>{st === 'required' ? 'Request approval' : 'Request again'}</button>}
        {st === 'pending' && onApprove && !selfRequested && !rejecting && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onApprove}>Approve</button>}
        {st === 'pending' && onReject && !selfRequested && (rejecting ? <><button type="button" className="btn btn-sm" disabled={busy || !why.trim()} onClick={() => { onReject(why.trim()); setRejecting(false); setWhy(''); }}>Confirm rejection</button><button type="button" className="btn btn-sm" onClick={() => setRejecting(false)}>Cancel</button></> : <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>)}
        {st === 'pending' && selfRequested && <span className="gov-sub">You requested this, so someone else must approve.</span>}
      </div>
    </div>
  );
}
