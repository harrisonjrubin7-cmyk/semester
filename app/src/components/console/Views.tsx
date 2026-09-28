import { useState } from 'react';
import { Notice, SectionLabel } from '../ui';

/**
 * Saved views: a name, the tab, and the filter that was typed. Kept in
 * `operator_preference` on the server under the operator's own subject, so
 * they follow the person between machines and never sit in a browser's
 * storage where a shared workstation would keep them.
 */
export interface SavedView {
  name: string;
  tab: string;
  filter: string;
}

export function readViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    .filter((v) => typeof v.name === 'string' && typeof v.tab === 'string' && typeof v.filter === 'string')
    .map((v) => ({ name: v.name as string, tab: v.tab as string, filter: v.filter as string }));
}

export function Views({
  views,
  currentTab,
  currentFilter,
  onSave,
  onApply,
  onDelete,
}: {
  views: SavedView[];
  currentTab: string;
  currentFilter: string;
  onSave: (view: SavedView) => void;
  onApply: (view: SavedView) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>Saved views and the last-open tab are kept in your operator preferences on the server, never in this browser.</Notice>
      <SectionLabel>Save the current view</SectionLabel>
      <form
        aria-label="Save a view"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), tab: currentTab, filter: currentFilter });
          setName('');
        }}
        style={{ display: 'grid', gap: 'var(--sp-3)' }}
      >
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Name for this view
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
          Keeps the {currentTab} tab{currentFilter ? ` filtered by “${currentFilter}”` : ' with no filter'}.
        </p>
        <button type="submit" className="btn btn-primary btn-block" disabled={name.trim().length === 0}>
          Save view
        </button>
      </form>
      <SectionLabel aside={`${views.length}`}>Saved views</SectionLabel>
      {views.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No saved views yet.</p>}
      {views.map((v) => (
        <div key={v.name} className="portal-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            <strong>{v.name}</strong> · {v.tab}
            {v.filter ? ` · “${v.filter}”` : ''}
          </span>
          <button type="button" className="btn" onClick={() => onApply(v)}>
            Open {v.name}
          </button>
          <button type="button" className="btn" onClick={() => onDelete(v.name)}>
            Delete {v.name}
          </button>
        </div>
      ))}
    </div>
  );
}
