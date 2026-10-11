import React from 'react';
const L = { ready: 'Not started', sending: 'Sending…', sent: 'Sent', received: 'Received by the office', waiting: 'Waiting on you', resolved: 'Resolved', failed: 'Didn’t send' };
/** Hands a question to the office that owns it; Semester tracks status only.
 * Hardened: what will be shared is listed before sending, double-send blocked while sending, failure keeps the draft and offers a retry, out-of-hours expectation, urgent route kept separate. */
export function SupportHandoff({ office, reason, channel, hours, status = 'ready', reference, onStart, onRetry, shares, expected, urgent, updated }) {
  const st = L[status] ? status : 'ready';
  return (
    <div className="support-handoff" aria-busy={st === 'sending' || undefined}>
      <div className="gov-sub">Owned by</div><b className="handoff-office">{office}</b>
      {reason && <p className="handoff-reason">{reason}</p>}
      <dl className="handoff-meta">{channel && <><dt>How</dt><dd>{channel}</dd></>}{hours && <><dt>Hours</dt><dd>{hours}</dd></>}{expected && <><dt>Reply</dt><dd>{expected}</dd></>}<dt>Status</dt><dd role="status">{L[st]}{reference ? ' · ' + reference : ''}{updated ? ' · ' + updated : ''}</dd></dl>
      {shares && shares.length > 0 && st === 'ready' && <div className="handoff-shares"><div className="gov-sub">{office} will see</div><ul>{shares.map((s) => <li key={s}>{s}</li>)}</ul></div>}
      {(st === 'ready' || st === 'sending') && onStart && <button type="button" className="btn btn-sm btn-primary" disabled={st === 'sending'} onClick={onStart}>{st === 'sending' ? 'Sending…' : 'Contact ' + office}</button>}
      {st === 'failed' && <p className="field-error" role="alert"><span aria-hidden="true">!</span>Your message didn’t reach {office}. Nothing was lost.{onRetry && <> <button type="button" className="btn-link" onClick={onRetry}>Try again</button></>}</p>}
      {urgent && <p className="gov-sub"><b>Urgent?</b> {urgent}</p>}
      <p className="gov-sub">The office decides in its own system. Semester shows the status and never edits it.</p>
    </div>
  );
}
