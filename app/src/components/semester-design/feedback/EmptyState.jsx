import React from 'react';
const KIND = { first: 'Nothing here yet', filtered: 'No matches', cleared: 'All done', restricted: 'Nothing you can see', error: 'Couldn’t load' };
/** Say why it is empty, and offer one relevant next action.
 * Hardened: kind distinguishes first-use, filtered, all-done, restricted and error (each gets a sensible default title), filtered empties offer to clear filters, heading level configurable, announced politely when it replaces a list. */
export function EmptyState({ title, body, action, kind = 'first', onClearFilters, level, live = false, icon }) {
  const t = title || KIND[kind] || KIND.first;
  const Title = level ? 'h' + Math.min(6, Math.max(2, level)) : 'div';
  return (
    <div className="state" data-kind={kind === 'error' ? 'error' : 'empty'} data-empty={kind} role={live ? 'status' : undefined}>
      {icon}
      <Title className="state-title">{t}</Title>
      {body && <p className="state-body">{body}</p>}
      {(action || (kind === 'filtered' && onClearFilters)) && <div className="state-actions">{action}{kind === 'filtered' && onClearFilters && <button type="button" className="btn btn-sm" onClick={onClearFilters}>Clear filters</button>}</div>}
    </div>
  );
}
