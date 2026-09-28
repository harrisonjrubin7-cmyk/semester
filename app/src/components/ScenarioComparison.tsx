import { useId, useState } from 'react';
import type { Plan, Scenario } from '../lib/graduation';
import { WIDE, useMedia } from '../lib/media';
import { compareRows, limits } from '../lib/scenario-compare';
import { SourceBadge } from './SourceBadge';
import { Segmented } from './ui';

/**
 * Current plan against one proposed change (DESIGN-SYSTEM-IMPROVEMENTS §4.11).
 *
 * At the `WIDE` width (840px) and up, a real table — the data is tabular, so a screen reader
 * gets its headers — with the change in words and a sign in its own column.
 * On a phone, the rows that changed come first as "What changes", and a
 * switch shows the whole of either plan: two columns side by side do not
 * fit at 390px, and a table scrolled sideways loses its labels.
 *
 * Every figure is labelled Estimated, the card says "Planning guidance only",
 * and what the table cannot see is listed under it rather than left out.
 */
export function ScenarioComparison({ plan, done, scenario }: { plan: Plan; done: number; scenario: Scenario }) {
  const wide = useMedia(WIDE);
  const [view, setView] = useState<'current' | 'proposed'>('proposed');
  const titleId = useId();
  const rows = compareRows(plan, done, scenario);
  const changed = rows.filter((r) => r.changed);

  return (
    <section className="portal-panel scenario-compare" aria-labelledby={titleId}>
      <h3 id={titleId}>{scenario.name} compared with your current plan</h3>
      <p className="portal-muted">
        <SourceBadge label="estimated" /> Planning guidance only. Not a degree audit, not a bill, and not a promise of when
        you finish.
      </p>

      {wide ? (
        <table className="scenario-table">
          <caption className="sr-only">
            {scenario.name} compared with your current plan. Estimates from the numbers you entered.
          </caption>
          <thead>
            <tr>
              <th scope="col">Estimate</th>
              <th scope="col">Current plan</th>
              <th scope="col">{scenario.name}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.changed ? 'is-changed' : undefined}>
                <th scope="row">{r.label}</th>
                <td>{r.current}</td>
                <td>{r.proposed}</td>
                <td>{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <h4>What changes</h4>
          {changed.length ? (
            <ul className="scenario-changes">
              {changed.map((r) => (
                <li key={r.id}>
                  <strong>{r.label}:</strong> {r.current} → {r.proposed} <span className="portal-muted">({r.change})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-muted">Nothing changes from your current plan.</p>
          )}
          <Segmented
            options={[
              { id: 'current', label: 'Current plan' },
              { id: 'proposed', label: scenario.name },
            ]}
            value={view}
            onChange={setView}
          />
          <dl className="scenario-list" aria-label={view === 'current' ? 'Current plan' : scenario.name}>
            {rows.map((r) => (
              <div key={r.id}>
                <dt>{r.label}</dt>
                <dd>{view === 'current' ? r.current : r.proposed}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h4>What this can’t tell you</h4>
      <ul className="scenario-limits">
        {limits(plan, scenario).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
