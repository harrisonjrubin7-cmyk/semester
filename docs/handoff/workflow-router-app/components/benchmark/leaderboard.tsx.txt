import type { LeaderRow } from '@/lib/benchmark/scoring';
export function Leaderboard({ title, rows }: { title: string; rows: LeaderRow[] }) {
  return (<section><h2 className="mb-2 text-lg font-semibold">{title}</h2><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-neutral-600"><th>#</th><th>Platform</th><th>Score /5</th><th>Graded</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.key} className="border-t"><td className="py-2 tabular-nums">{i + 1}</td><td>{r.key}</td><td className="tabular-nums">{r.score ?? 'Not graded'}</td><td className="tabular-nums">{r.graded} / {r.tasks}</td></tr>)}</tbody></table></section>);
}
