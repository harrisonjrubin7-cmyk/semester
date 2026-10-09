import React from 'react';
import { Icon } from '../core/Icon.jsx';
/** A row of 2–5 labelled starting actions ("Add a syllabus", "Connect a calendar"). Never icon-only. */
export function QuickActions({ actions = [] }) {
  return <div className="quick-actions">{actions.map((a) => <button key={a.label} type="button" className="quick-action" onClick={a.onClick}>{a.icon && <Icon name={a.icon} size={18} style={{ color: 'var(--text-secondary)' }} />}{a.label}</button>)}</div>;
}
