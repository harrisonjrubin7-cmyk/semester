import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { SaveState } from '../feedback/SaveState.jsx';
/** Persistent top bar: where you are, the term, global search (⌘K), sync state, and quiet tools. */
export function SystemContextBar({ location, term, sync = 'synced', onSearch, actions }) {
  return (
    <div className="syscontext">
      <div className="syscontext-group">
        {location && <span style={{ color: 'var(--text-primary)', fontSize: 'var(--type-sm)' }}>{location}</span>}
        {term && <span className="syscontext-term">{term}</span>}
      </div>
      <button type="button" className="syscontext-search" onClick={onSearch} aria-label="Search or run a command">
        <Icon name="search" size={15} /><span style={{ flex: 1, textAlign: 'left' }}>Search or ask…</span><span className="kbd">⌘K</span>
      </button>
      <div className="syscontext-group"><SaveState status={sync} />{actions}</div>
    </div>
  );
}
