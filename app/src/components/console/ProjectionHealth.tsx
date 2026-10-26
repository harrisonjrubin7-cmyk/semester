import { useEffect, useState } from 'react';
import { SectionLabel } from '../ui';
import { loadProjectionDashboard, type ProjectionDashboard, type ProjectionHealth as Health } from '../../lib/console/client';
import { said, when } from './Fields';

/** "3 min", "2 h": a duration a person can read. `null` is unknown, never zero. */
export function span(seconds: number | null): string {
  if (seconds === null) return 'not reported';
  if (seconds < 90) return `${seconds} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

const figure = (n: number | null): string => (n === null ? 'not reported' : String(n));

/**
 * How each read model is doing, from `ops_projection_dashboard`. `unknown`
 * (never run) and a model with no event source mapped are said in words and
 * never shown as healthy; a stale model with nothing behind it is idle, not
 * broken, and the row says which it is.
 */
export function ProjectionHealth() {
  const [dash, setDash] = useState<ProjectionDashboard | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadProjectionDashboard().then(
      (d) => { if (live) { setReadError(null); setDash(d); } },
      (e: unknown) => { if (live) setReadError(said(e, 'Could not read projection health.')); },
    );
    return () => { live = false; };
  }, []);

  return (
    <section aria-label="Projection health" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <SectionLabel aside={dash ? `${dash.freshness} · ${dash.activeModels} models` : readError ? 'unavailable' : undefined}>Projection health</SectionLabel>
      {dash === null && !readError && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Reading projection health…</p>}
      {readError && (
        <p role="alert" className="portal-panel" style={{ marginBlock: 0 }}>
          <strong>UNKNOWN:</strong> {readError} Projection health is unavailable, so it is not shown as healthy.
        </p>
      )}
      {dash && dash.projections.length === 0 && (
        <p role="status" className="portal-panel" style={{ marginBlock: 0 }}>
          <strong>UNKNOWN</strong> — no read model is registered, so nothing is shown as healthy.
        </p>
      )}
      {dash?.projections.map((p) => <Row key={`${p.projection}:${p.version}`} p={p} />)}
      {dash && dash.warnings.length > 0 && (
        <ul aria-label="Projection warnings" style={{ marginBlock: 0, paddingInlineStart: 'var(--sp-5)' }}>
          {dash.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </section>
  );
}

function Row({ p }: { p: Health }) {
  const idle = p.freshness === 'stale' && p.eventsBehind === 0;
  return (
    <article className="portal-panel" aria-label={`${p.freshness} ${p.projection}`} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      <strong>{p.freshness.toUpperCase()} · {p.projection} v{p.version}</strong>
      <div style={{ color: 'var(--app-dim)' }}>
        worker {p.workerStatus} · last event {when(p.lastEventAt, 'never')} · lag {span(p.lagSeconds)} of {span(p.freshnessSloSeconds)} allowed
      </div>
      {p.eventSourceMapped ? (
        <div>
          Behind {figure(p.eventsBehind)}{p.oldestPendingSeconds !== null ? ` (oldest ${span(p.oldestPendingSeconds)})` : ''} · dead letters {figure(p.deadLetters)}
          {idle && ' · idle, nothing is waiting'}
        </div>
      ) : (
        <div>No event source is mapped to this model, so events behind, dead letters and last error are not reported.</div>
      )}
      {p.lastError && <div><strong>Last error:</strong> {p.lastError}</div>}
      <div>
        Last rebuild: {p.lastRebuild
          ? `${p.lastRebuild.status} (${p.lastRebuild.mode}), ${p.lastRebuild.parityOk === null ? 'parity not checked' : p.lastRebuild.parityOk ? 'parity matched' : 'parity did not match'}`
          : 'never rebuilt'}
      </div>
    </article>
  );
}
