import React from 'react';
const L = { on: ['✓', 'On'], off: ['○', 'Off'], ask: ['?', 'Ask each time'], blocked: ['⊘', 'Blocked on device'], limited: ['◐', 'Limited'], managed: ['⊘', 'Managed'], unsupported: ['–', 'Not available on this device'] };
/** One device capability in Privacy › Device: current state, what it's used for, and how to change it.
 * Hardened: the action button names the capability, managed and unsupported states have no misleading toggle, last-used time, busy while changing. */
export function PermissionRow({ capability, use, state = 'off', detail, onChange, lastUsed, managedBy, busy = false }) {
  const st = L[state] ? state : 'off'; const [g, t] = L[st];
  const label = st === 'blocked' ? 'How to change' : st === 'on' || st === 'limited' ? 'Turn off' : 'Turn on';
  const actionable = onChange && st !== 'managed' && st !== 'unsupported';
  return (
    <div className="perm-row" data-state={st} aria-busy={busy || undefined}>
      <div className="perm-row-main"><div className="perm-row-name">{capability}</div><div className="perm-row-use">{use}</div>{(detail || lastUsed || (st === 'managed' && managedBy)) && <div className="perm-row-detail">{[detail, lastUsed && 'Last used ' + lastUsed, st === 'managed' && managedBy && 'Set by ' + managedBy].filter(Boolean).join(' · ')}</div>}</div>
      <span className="perm-state"><span aria-hidden="true">{g}</span> {t}</span>
      {actionable && <button type="button" className="btn btn-sm" disabled={busy} onClick={onChange} aria-label={label + ': ' + capability}><span>{busy ? 'Updating…' : label}</span></button>}
    </div>
  );
}
