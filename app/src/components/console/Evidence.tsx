import { Notice, SectionLabel } from '../ui';
import { ESCALATION } from '../../lib/ops/console';
import { EVIDENCE, evidenceState } from '../../lib/ops/evidence';
import { Fields, matches, type ViewProps } from './Fields';
import { useNow } from '../../state/store';

/**
 * The evidence register: each artifact that exists, when it was produced,
 * how long it is good for, and which public claims rest on it. The state —
 * current, expiring, expired — and the escalation step come from
 * `evidenceState` in `lib/ops/evidence.ts`, the same function the register
 * test and the claims test use, so this view cannot say "current" about a
 * record the register calls expired.
 */
export function Evidence({ filter, today: suppliedToday }: ViewProps & { today?: string }) {
  const currentTime = useNow();
  const today = suppliedToday ?? currentTime.toISOString().slice(0, 10);
  const rows = EVIDENCE.map((r) => ({ r, s: evidenceState(r, today) })).filter(({ r }) => matches(filter, r.artifact, r.id, r.owner, r.path, ...r.claims));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Escalation: {ESCALATION.map((e) => `${e.daysLeft === 0 ? 'at expiry' : `${e.daysLeft} days before`} — ${e.action}`).join(' · ')}
      </Notice>
      <SectionLabel aside={`${rows.length}`}>Artifacts</SectionLabel>
      {rows.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No evidence records match.</p>}
      {rows.map(({ r, s }) => (
        <article key={r.id} className="portal-panel" aria-label={`Evidence ${r.id}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <strong>
            {r.id} · {r.artifact} — {s.state}
          </strong>
          <Fields
            label={`Evidence ${r.id} details`}
            items={[
              { field: 'Path', value: r.path },
              { field: 'Produced', value: r.produced },
              { field: 'Valid for', value: `${r.validFor} days` },
              { field: 'Expires', value: `${s.expires} (${s.daysLeft} days left)` },
              { field: 'Owner', value: `${r.owner} seat` },
              { field: 'Escalation', value: s.step ? s.step.action : 'none yet' },
              { field: 'Claims resting on it', value: r.claims.length ? r.claims.join(', ') : 'none' },
              { field: 'Register rows', value: r.rows.length ? r.rows.join(', ') : 'none' },
            ]}
          />
        </article>
      ))}
    </div>
  );
}
