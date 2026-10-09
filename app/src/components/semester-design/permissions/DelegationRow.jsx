import React from 'react';
const L = { active: ['⇄', 'Active'], expiring: ['!', 'Expires soon'], expired: ['⊘', 'Expired'], revoked: ['⊘', 'Revoked'], pending: ['…', 'Waiting for them to accept'], declined: ['⊘', 'They declined'] };
/** Access someone has because the student granted it: who, exactly what, until when, revoke.
 * Hardened: an empty scope says "Nothing shared" (never implies everything), revoke confirms inline and says the effect is immediate, extend for expiring grants, last access shown, unknown states treated as revoked. */
export function DelegationRow({ who, role, scope = [], expires, state = 'active', onRevoke, onExtend, lastAccess, revoking = false }) {
  const st = L[state] ? state : 'revoked'; const [g, t] = L[st]; const [ask, setAsk] = React.useState(false);
  const live = st === 'active' || st === 'expiring' || st === 'pending';
  return (
    <div className="perm-row" data-state={st} aria-busy={revoking || undefined}>
      <div className="perm-row-main"><div className="perm-row-name">{who}{role && <span className="perm-row-role"> · {role}</span>}</div>
        {scope.length ? <ul className="perm-scope" aria-label={'What ' + who + ' can see'}>{scope.map((s) => <li key={s}>{s}</li>)}</ul> : <div className="perm-row-use">Nothing shared</div>}
        <div className="perm-row-detail"><span aria-hidden="true">{g}</span> {t}{expires && (st === 'active' || st === 'expiring') ? ' · until ' + expires : ''}{lastAccess ? ' · last viewed ' + lastAccess : ''}</div>
        {ask && <div className="perm-row-detail" role="status">{who} loses access right away. They’re told the share ended, not why.</div>}</div>
      <span style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        {st === 'expiring' && onExtend && !ask && <button type="button" className="btn btn-sm" onClick={onExtend}><span>Extend</span></button>}
        {onRevoke && live && (ask ? <><button type="button" className="btn btn-sm btn-danger" disabled={revoking} onClick={() => { onRevoke(); setAsk(false); }}><span>{revoking ? 'Revoking…' : 'Revoke now'}</span></button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsk(false)}><span>Keep</span></button></>
          : <button type="button" className="btn btn-sm btn-danger" onClick={() => setAsk(true)} aria-label={'Revoke access for ' + who}><span>Revoke</span></button>)}
      </span>
    </div>
  );
}
