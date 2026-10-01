import { ROWS, type Comparison } from '../lib/decision-compare';
import { HumanTable } from './HumanTable';

/** Canonical comparison facts stay unranked, including unknowns and official next steps. */
export function DecisionTable({ comparison }: { comparison: Comparison }) {
  return (
    <section aria-label="Decision comparison" className="today-why">
      <HumanTable
        viewLabel="Comparison view"
        id={`decision-${comparison.kind}`}
        label={comparison.title}
        rows={comparison.rows}
        persistSearchValues={ROWS.map((row) => row.label)}
        rowId={(row) => row.id}
        summaryPrimary={(row) =>
          ['requirementFit', 'scheduleImpact', 'costTime', 'sourceAndFreshness', 'officialNextStep'].includes(row.id)
        }
        renderCards={(visibleRows) => (
          <ul aria-label={`${comparison.title} cards`} style={{ listStyle: 'none', padding: 0 }}>
            {comparison.options.map((option, index) => (
              <li key={option.id}>
                <article aria-label={option.label}>
                  <h3>{option.label}</h3>
                  <dl>
                    {visibleRows.map((row) => (
                      <div key={row.id}>
                        <dt>{row.label}</dt>
                        <dd>
                          {row.cells[index]?.lines.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        )}
        columns={[
          {
            id: 'question',
            label: 'Question',
            value: (row) => row.label,
            persistFilterValues: ROWS.map((row) => row.label),
            rowHeader: true,
            summary: true,
          },
          ...comparison.options.map((option, i) => ({
            id: option.id,
            label: option.label,
            value: (row: Comparison['rows'][number]) => row.cells[i]?.lines.join('\n') ?? 'Not known',
            render: (row: Comparison['rows'][number]) => row.cells[i]?.lines.map((line) => <p key={line}>{line}</p>),
            summary: true,
          })),
        ]}
      />
      <p>{comparison.note}</p>
    </section>
  );
}
