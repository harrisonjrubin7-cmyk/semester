import { useEffect, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { loadFigures, type Figure } from '../../lib/console/client';
import { FIGURE_PROVENANCE } from '../../lib/ops/console';
import { ENVIRONMENT_SHAPE } from '../../lib/environment';
import { Fields, matches, said, when, type ViewProps } from './Fields';

/**
 * Every figure with its provenance: the seven `FIGURE_PROVENANCE` fields, in
 * that order, under every number — and under every non-number, because
 * billing is `not applicable` with a decision as its source (D-009), which is
 * a measurement of the same kind as a count.
 */
export function Figures({ env, filter, onStatus }: ViewProps) {
  const [figures, setFigures] = useState<Figure[] | null>(null);

  // Account-backed data, loaded when the view opens.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    let live = true;
    loadFigures(false).then(
      (rows) => { if (live) setFigures(rows); },
      (e: unknown) => {
        if (!live) return;
        setFigures([]);
        onStatus(said(e, 'Could not read the figures.'));
      },
    );
    return () => { live = false; };
  }, [onStatus]);

  const shown = (figures ?? []).filter((f) => matches(filter, f.figure, f.source, f.ownerSeat));

  const provenance = (f: Figure) => {
    const value: Record<string, string> = {
      Source: f.source,
      'Time window': f.timeWindow,
      Environment: ENVIRONMENT_SHAPE[env],
      Owner: `${f.ownerSeat} seat`,
      'Last refresh': when(f.refreshedAt, 'not refreshed'),
      Evidence: f.evidence,
      'Known limitation': f.limitation,
    };
    return FIGURE_PROVENANCE.map((field) => ({ field, value: value[field] ?? 'Not shown' }));
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>A figure typed into a file is a claim. Each of these is read from the database at open, and carries where it came from.</Notice>
      <SectionLabel aside={`${shown.length}`}>Figures</SectionLabel>
      {figures === null && <p role="status" style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Reading figures…</p>}
      {figures !== null && shown.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No figures match.</p>}
      {shown.map((f) => (
        <article key={f.figure} className="portal-panel" aria-label={`Figure ${f.figure}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <strong>
            {f.figure}: {f.value}
          </strong>
          <Fields label={`Provenance of ${f.figure}`} items={provenance(f)} />
        </article>
      ))}
    </div>
  );
}
