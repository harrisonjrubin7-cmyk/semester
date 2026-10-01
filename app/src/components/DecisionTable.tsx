import type { Comparison } from '../lib/decision-compare';
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
        rowId={(row) => row.id}
        columns={[
          { id: 'question', label: 'Question', value: (row) => row.label, rowHeader: true, summary: true },
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
