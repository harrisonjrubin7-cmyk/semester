import React from 'react';
/** Page head: kicker, one H1, what the page helps you do, source line, primary action.
 * Hardened: heading level configurable for embedded use (still one h1 per page), breadcrumb trail, status slot, actions wrap under the title on narrow widths, long titles wrap without overflow. */
export function PageHeader({ kicker, title, purpose, source, actions, level = 1, breadcrumbs, status, id }) {
  const H = 'h' + Math.min(6, Math.max(1, level));
  return (
    <header className="page-header" aria-labelledby={id}>
      <div className="page-header-text">
        {breadcrumbs && breadcrumbs.length > 0 && <nav aria-label="Breadcrumb" className="page-crumbs"><ol>{breadcrumbs.map((b, i) => <li key={b.label + i}>{b.href && i < breadcrumbs.length - 1 ? <a href={b.href}>{b.label}</a> : <span aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}>{b.label}</span>}</li>)}</ol></nav>}
        {kicker && <div className="kicker">{kicker}</div>}
        {React.createElement(H, { id, style: { overflowWrap: 'anywhere' } }, title)}
        {status && <div className="page-header-status">{status}</div>}
        {purpose && <p className="page-header-purpose">{purpose}</p>}
        {source && <div className="page-header-source">{source}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
