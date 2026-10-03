import { dollars } from '../lib/cost';
import { useId, useState } from 'react';
import { LINE_KINDS, MAX_LINES, staleness, totalSource, totals, type CostLine, type CostSource } from '../lib/cost-plan';
import { SourceBadge } from './SourceBadge';
import { useNow } from '../state/store';

const money = dollars;
const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, n)) : 0;
};

/**
 * The cost planner (`cost_planner`, Phase D): what a term costs, line by
 * line, each with where the figure came from.
 *
 * Every change hands the new lines to `onChange`, which also writes their
 * totals into the plan's cost per term and per summer, so the projection and
 * the comparison read the same two numbers they always did.
 *
 * Nothing here is aid, a bill or an official figure. A line copied from a
 * school's published costs is labelled Imported, with where and when it was
 * copied; everything else is the student's own estimate.
 */
export function CostPlanner({
  lines,
  onChange,
  now: suppliedNow,
}: {
  lines: CostLine[];
  onChange: (next: CostLine[]) => void;
  now?: Date;
}) {
  const currentTime = useNow();
  const now = suppliedNow ?? currentTime;
  const [kind, setKind] = useState<string>(LINE_KINDS[0]);
  const headingId = useId();
  const sum = totals(lines);
  const source = totalSource(lines);
  const edit = (id: string, patch: Partial<CostLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <section className="portal-panel cost-planner" aria-labelledby={headingId}>
      <h3 id={headingId}>What a term costs</h3>
      <p className="portal-muted">
        <SourceBadge label="estimated" /> Planning guidance only. These are costs before any aid — Semester does not know your
        aid and does not estimate it. Not a bill.
      </p>

      {lines.length ? (
        <ul className="cost-lines">
          {lines.map((l) => {
            const old = staleness(l, now);
            return (
              <li key={l.id} className="cost-line">
                <div className="portal-filter-row">
                  <label className="portal-check">
                    Item
                    <input
                      className="input"
                      value={l.label}
                      maxLength={60}
                      onChange={(e) => edit(l.id, { label: e.target.value || 'Cost' })}
                    />
                  </label>
                  <label className="portal-check">
                    Amount ($)
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={l.amount}
                      onChange={(e) => edit(l.id, { amount: num(e.target.value) })}
                    />
                  </label>
                  <label className="portal-check">
                    Each
                    <select className="input" value={l.per} onChange={(e) => edit(l.id, { per: e.target.value as CostLine['per'] })}>
                      <option value="term">Fall or spring term</option>
                      <option value="summer">Summer term</option>
                    </select>
                  </label>
                  <label className="portal-check">
                    Where it came from
                    <select
                      className="input"
                      value={l.source}
                      onChange={(e) => edit(l.id, { source: e.target.value as CostSource })}
                    >
                      <option value="student_entered">My own estimate</option>
                      <option value="imported">My school’s published figure</option>
                    </select>
                  </label>
                </div>
                {l.source === 'imported' ? (
                  <div className="portal-filter-row">
                    <label className="portal-check">
                      Copied from
                      <input
                        className="input"
                        maxLength={200}
                        placeholder="e.g. Cost of attendance page, 2026–27"
                        value={l.from ?? ''}
                        onChange={(e) => edit(l.id, { from: e.target.value })}
                      />
                    </label>
                    <label className="portal-check">
                      Copied on
                      <input
                        className="input"
                        type="date"
                        value={l.on ?? ''}
                        onChange={(e) => edit(l.id, { on: e.target.value || undefined })}
                      />
                    </label>
                  </div>
                ) : null}
                <p className="portal-muted">
                  <SourceBadge label={l.source} at={l.on ? Date.parse(l.on) : undefined} now={now.getTime()} />
                  {l.source === 'imported' && l.from ? ` ${l.from}` : ''}
                  {old ? <span className="portal-warning"> {old}</span> : null}
                </p>
                <button type="button" aria-label={`Remove ${l.label}`} onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="portal-muted">Add what a term costs you, one item at a time, to see where a change moves the total.</p>
      )}

      {lines.length < MAX_LINES ? (
        <div className="portal-filter-row">
          <label className="portal-check">
            Add a cost
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {LINE_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              onChange([...lines, { id: crypto.randomUUID(), label: kind, amount: 0, per: 'term', source: 'student_entered' }])
            }
          >
            Add
          </button>
        </div>
      ) : null}

      <div className="portal-stats" aria-label="Cost totals">
        <div>
          <strong>{money(sum.perTerm)}</strong>
          <span>Each fall or spring</span>
        </div>
        <div>
          <strong>{money(sum.summer)}</strong>
          <span>Each summer</span>
        </div>
      </div>
      {source ? (
        <p className="portal-muted">
          Totals: <SourceBadge label={source} />{' '}
          {source === 'student_entered' ? 'At least one line is your own estimate.' : 'Every line copied from published costs.'}
        </p>
      ) : null}
    </section>
  );
}
