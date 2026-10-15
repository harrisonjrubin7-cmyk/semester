import React from 'react';
import { Icon } from '../core/Icon.jsx';
/** Mobile bottom navigation — the five canonical destinations, labelled. */
export function TabBar({ items = [], current, onNavigate }) {
  return (
    <nav className="tabbar" aria-label="Semester">
      {items.map((it) => (
        <button key={it.id} type="button" className="tab" aria-current={current === it.id ? 'page' : undefined} onClick={() => onNavigate && onNavigate(it.id)}>
          <Icon name={it.icon} size={21} /><span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
