import { useState } from 'react';
import type { Comparison } from '../lib/decision-compare';

/**
 * `compareOptions` output as a table, and nothing more.
 *
 * Options are columns in the order the student listed them; rows are the nine
 * fixed questions. There is no highlighted column, no total and no marker on
 * any cell: a cell that reads "Not known" is drawn exactly like one that
 * holds a fact, with the same weight and the same colour.
 */
export function DecisionTable({ comparison }: { comparison: Comparison }) {
  const [view, setView] = useState<'table' | 'cards' | 'summary'>('table');
  return (
    <section aria-label="Decision comparison" className="today-why">
      <div role="group" aria-label="Comparison view">
        <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table view</button>
        <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Card view</button>
        <button type="button" aria-pressed={view === 'summary'} onClick={() => setView('summary')}>Summary view</button>
      </div>
      {view === 'table' ? <table>
        <caption>{comparison.title}</caption>
        <thead>
          <tr>
            <th scope="col">Question</th>
            {comparison.options.map((o) => (
              <th key={o.id} scope="col">
                {o.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, i) => (
                <td key={comparison.options[i]?.id ?? i}>
                  {cell.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table> : <>
        <h2>{comparison.title}</h2>
        {comparison.options.map((option, index) => <article key={option.id} aria-label={option.label}>
          <h3>{option.label}</h3>
          <dl>{comparison.rows.map(row => <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{view === 'summary' && !['requirementFit', 'scheduleImpact', 'costTime', 'sourceAndFreshness', 'officialNextStep'].includes(row.id)
              ? <details><summary>Show detail</summary>{row.cells[index]?.lines.map(line => <p key={line}>{line}</p>)}</details>
              : row.cells[index]?.lines.map(line => <p key={line}>{line}</p>)}</dd>
          </div>)}</dl>
        </article>)}
      </>}
      <p>{comparison.note}</p>
    </section>
  );
}
