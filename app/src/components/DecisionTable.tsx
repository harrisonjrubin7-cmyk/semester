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
  return (
    <section aria-label="Decision comparison" className="today-why">
      <table>
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
      </table>
      <p>{comparison.note}</p>
    </section>
  );
}
