import type { SavedComparison } from '../lib/comparison-actions';
/** Immutable context stays readable even if the original candidate is removed. */
export function ComparisonHistory({ snapshots }: { snapshots: SavedComparison[] }) {
  if (!snapshots.length) return null;
  return <details><summary>Saved comparison history ({snapshots.length})</summary>{[...snapshots].reverse().map(s => <article key={s.id}>
    <h4>{s.title}</h4><p>{s.at} · {s.chosen ? `Personal choice: ${s.options.find(o => o.id === s.chosen)?.label}` : 'All options retained'}</p>
    {s.options.map(o => <details key={o.id}><summary>{o.label}</summary><ul>{o.context.map((line, i) => <li key={i}>{line}</li>)}</ul></details>)}
  </article>)}</details>;
}
