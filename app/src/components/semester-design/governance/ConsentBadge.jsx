import React from 'react';
const L = { private: ['○', 'Only you'], shared: ['⇄', 'Shared with'], expiring: ['⇄', 'Shared with'], expired: ['⊘', 'Share expired'], revoked: ['⊘', 'Share revoked'], required: ['?', 'Needs your consent'], declined: ['⊘', 'You declined'] };
/** Shows who can see something because the student shared it, until when, and for what purpose.
 * Hardened: unknown states fall back to private (never implies sharing), expiring-soon warning, purpose, scope, and the manage action is labelled with the recipient. */
export function ConsentBadge({ state = 'private', recipient, expires, purpose, scope, onManage, expiringSoon }) {
  const st = L[state] ? state : 'private';
  const [g, t] = L[st];
  const shared = st === 'shared' || st === 'expiring';
  const who = shared ? t + ' ' + (recipient || 'someone you chose') : t;
  return (
    <span className="gov-badge" data-kind="consent" data-state={st} role="note" aria-label={[who, scope && 'for ' + scope, purpose && 'purpose: ' + purpose, shared && expires && 'until ' + expires].filter(Boolean).join(', ')}>
      <span className="gov-glyph" aria-hidden="true">{g}</span><span aria-hidden="true">{who}</span>
      {scope && <span className="gov-sub" aria-hidden="true">· {scope}</span>}
      {shared && expires && <span className="gov-sub" aria-hidden="true">· until {expires}</span>}
      {(st === 'expiring' || (shared && expiringSoon)) && <span className="gov-state" aria-hidden="true">Ends soon</span>}
      {onManage && <button type="button" className="gov-link" onClick={onManage} aria-label={'Manage sharing' + (recipient ? ' with ' + recipient : '')}>Manage</button>}
    </span>
  );
}
