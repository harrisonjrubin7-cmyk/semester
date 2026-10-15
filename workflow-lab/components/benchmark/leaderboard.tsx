import { Badge, PlatformBadge, StatusBadge } from "@/components/ui/badge";
import { formatScore100, formatScore5, type AggregateRow, type PlatformTaskResult } from "@/lib/benchmark/scoring";

const rankLabel = (r: number | null) => (r === null ? "—" : `#${r}`);

export function AggregateLeaderboard({ rows }: { rows: AggregateRow[] }) {
  const anyRanked = rows.some((r) => r.rank !== null);
  return (
    <section aria-labelledby="agg-title" className="space-y-2">
      <h2 id="agg-title" className="text-lg font-semibold">Aggregate platform leaderboard</h2>
      <div className="table-wrap rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Platforms ranked by mean weighted score across complete workflow results</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              {["Rank", "Platform", "Workflows scored", "Like-for-like mean /100", "Own mean /100", "Graders"].map((h) => (
                <th key={h} scope="col" className="border-b border-line bg-surface-2 px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.platform}>
                <td className="border-b border-line px-3 py-2 font-mono">{rankLabel(r.rank)}</td>
                <th scope="row" className="border-b border-line px-3 py-2 text-left"><PlatformBadge platform={r.platform} /></th>
                <td className="border-b border-line px-3 py-2">{r.tasksScored} / {r.tasksTotal}</td>
                <td className="border-b border-line px-3 py-2 font-semibold">{r.sharedMean100 ?? "—"} <span className="font-normal text-muted">{r.sharedTasks > 0 ? `(${r.sharedTasks} shared)` : ""}</span></td>
                <td className="border-b border-line px-3 py-2">{r.mean100 ?? "—"}</td>
                <td className="border-b border-line px-3 py-2">{r.graderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!anyRanked && (
        <p className="text-sm text-muted">No platform is ranked yet. A result is ranked only when every weighted criterion has been scored for that run.</p>
      )}
      <p className="text-xs text-muted">“Like-for-like” averages only the workflows that every platform has a complete result for, so a platform cannot rank higher by skipping hard tasks.</p>
    </section>
  );
}

export function WorkflowLeaderboard({ board }: { board: PlatformTaskResult[] }) {
  return (
    <div className="table-wrap rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Per-platform result for this workflow</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {["Rank", "Platform", "Attempt", "Graders", "State", "/5", "/100"].map((h) => <th key={h} scope="col" className="border-b border-line bg-surface-2 px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {board.map((b) => (
            <tr key={b.platform}>
              <td className="border-b border-line px-3 py-2 font-mono">{rankLabel(b.rank)}</td>
              <th scope="row" className="border-b border-line px-3 py-2 text-left"><PlatformBadge platform={b.platform} /></th>
              <td className="border-b border-line px-3 py-2">{b.attempt ?? "—"}</td>
              <td className="border-b border-line px-3 py-2">{b.score?.graderCount ?? 0}</td>
              <td className="border-b border-line px-3 py-2">
                {b.score ? (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <StatusBadge status={b.score.status} />
                    {b.score.missing.length > 0 && b.score.status !== "missing" && <Badge tone="warn" title={b.score.missing.join(", ")}>{b.score.missing.length} unscored</Badge>}
                  </span>
                ) : <Badge>no run</Badge>}
              </td>
              <td className="border-b border-line px-3 py-2">{formatScore5(b.score?.score5 ?? null)}</td>
              <td className="border-b border-line px-3 py-2 font-semibold">{formatScore100(b.score?.score100 ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
