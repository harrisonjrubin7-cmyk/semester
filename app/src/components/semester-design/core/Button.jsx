import React from 'react';
import { Icon } from './Icon.jsx';
/** One visually dominant (primary) action per decision region.
 * Hardened: loading keeps the label for screen readers (no layout jump), disabled can carry a visible reason, icon-only use requires aria-label, href renders a real link, danger never doubles as primary, double activation blocked while loading. */
export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, block = false, loading = false, loadingLabel = 'Working…', disabled, disabledReason, children, type = 'button', href, onClick, ...rest }) {
  const cls = ['btn', variant === 'primary' && 'btn-primary', variant === 'ghost' && 'btn-ghost', variant === 'danger' && 'btn-danger', size === 'sm' && 'btn-sm', block && 'btn-block'].filter(Boolean).join(' ');
  const rid = React.useId(); const isz = size === 'sm' ? 15 : 17;
  const inner = <>{icon && <Icon name={icon} size={isz} />}<span>{loading ? loadingLabel : children}</span>{loading && <span className="sr-only">{children}</span>}{iconAfter && <Icon name={iconAfter} size={isz} />}</>;
  const desc = disabled && disabledReason ? rid : undefined;
  const el = href && !disabled && !loading
    ? <a className={cls} href={href} onClick={onClick} {...rest}>{inner}</a>
    : <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} aria-describedby={desc} onClick={(e) => { if (loading) return; if (onClick) onClick(e); }} {...rest}>{inner}</button>;
  if (!desc) return el;
  return <span className="btn-wrap" style={{ display: block ? 'grid' : 'inline-grid', gap: 'var(--sp-2)' }}>{el}<span id={rid} className="btn-reason">{disabledReason}</span></span>;
}
