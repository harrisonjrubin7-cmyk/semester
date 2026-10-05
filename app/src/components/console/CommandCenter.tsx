import { useEffect, useMemo, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { loadCommandCenter, type CommandItem, type CommandSeverity } from '../../lib/console/client';
import { inScope, matches, said, when, type ViewProps } from './Fields';

const ORDER: Record<CommandSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

/**
 * The live exception queue. It is deliberately not a wall of reassuring
 * cards: an empty queue is the only green state, and every non-green item
 * names the database source, limitation and safe next step that produced it.
 */
export function CommandCenter({ env, scope, filter, onStatus }: ViewProps) {
  const [items, setItems] = useState<CommandItem[] | null>(null);

  useEffect(() => {
    let live = true;
    loadCommandCenter(false).then(
      (rows) => { if (live) setItems(rows); },
      (e: unknown) => {
        if (!live) return;
        setItems([]);
        onStatus(said(e, 'Could not read the command center.'));
      },
    );
    return () => { live = false; };
  }, [onStatus]);

  const shown = useMemo(
    () => (items ?? [])
      .filter((item) => inScope(scope, item.tenantId))
      .filter((item) => matches(filter, item.title, item.category, item.owner, item.status, item.tenantName, item.tenantId))
      .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.title.localeCompare(b.title)),
    [items, scope, filter],
  );
  const counts = shown.reduce<Record<CommandSeverity, number>>(
    (out, item) => ({ ...out, [item.severity]: out[item.severity] + 1 }),
    { critical: 0, high: 0, medium: 0, info: 0 },
  );

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        {env} truth only. Green means this live exception queue is empty; it does not mean a document, demo, pull request or verbal approval exists somewhere else.
      </Notice>
      <SectionLabel aside={`${shown.length} open`}>Command center</SectionLabel>
      {items === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Reading live operational sources…</p>}
      {items !== null && shown.length === 0 && (
        <p role="status" className="portal-panel" style={{ marginBlock: 0 }}>
          <strong>GREEN</strong> — no open exception was returned for this scope.
        </p>
      )}
      {shown.length > 0 && (
        <p role="status" style={{ marginBlock: 0 }}>
          <strong>NOT GO:</strong> {counts.critical} critical · {counts.high} high · {counts.medium} medium · {counts.info} informational
        </p>
      )}
      {shown.map((item) => (
        <article key={item.id} className="portal-panel" aria-label={`${item.severity} ${item.title}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <strong>{item.severity.toUpperCase()} · {item.title}</strong>
          <div style={{ color: 'var(--app-dim)' }}>
            {item.category} · {item.status} · owner {item.owner || 'unassigned'} · due {when(item.dueAt, 'not recorded')}
          </div>
          {item.tenantId && <div>Tenant {item.tenantId}{item.tenantName ? ` — ${item.tenantName}` : ''}</div>}
          <div><strong>Next safe step:</strong> {item.nextStep}</div>
          <div><strong>Route:</strong> {item.route || 'No route recorded'}</div>
          <div><strong>Source:</strong> {item.source}</div>
          <div><strong>Evidence:</strong> {item.evidence || 'No evidence recorded'}</div>
          <div><strong>Known limitation:</strong> {item.limitation}</div>
          <small>Observed {when(item.observedAt)}</small>
        </article>
      ))}
    </div>
  );
}
