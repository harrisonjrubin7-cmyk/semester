import React from 'react';
/** Names the policy that governs what is shown, with its owner, version and effective date.
 * Hardened: always a single accessible name; draft/superseded policies say so in words; never a status colour. */
export function PolicyBadge({ name, version, owner, effective, status = 'active', onOpen, href }) {
  const ST = { active: '', draft: 'Draft', superseded: 'Superseded', expired: 'Expired' };
  const word = ST[status] || '';
  const label = 'Policy: ' + name + (version ? ' version ' + version : '') + (word ? ', ' + word.toLowerCase() : '') + (owner ? ', owned by ' + owner : '') + (effective ? ', effective ' + effective : '');
  const text = <><span className="gov-glyph" aria-hidden="true">§</span><span>{name}{version ? ' v' + version : ''}</span>{word && <span className="gov-state">{word}</span>}{owner && <span className="gov-sub">· {owner}</span>}{effective && <span className="gov-sub">· from {effective}</span>}</>;
  if (href) return <a className="gov-badge" data-kind="policy" data-status={status} href={href} aria-label={label}>{text}</a>;
  return onOpen ? <button type="button" className="gov-badge" data-kind="policy" data-status={status} onClick={onOpen} aria-label={label}>{text}</button> : <span className="gov-badge" data-kind="policy" data-status={status} aria-label={label} role="note">{text}</span>;
}
