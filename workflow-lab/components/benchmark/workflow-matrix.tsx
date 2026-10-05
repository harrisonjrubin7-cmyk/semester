"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, PlatformBadge, StatusBadge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/form-bits";
import { SortHeader, useTableSort } from "@/components/ui/use-table-sort";
import { formatScore100 } from "@/lib/benchmark/scoring";
import type { TaskSummary } from "@/lib/benchmark/summary";
import { PLATFORM_IDS, PLATFORM_LABELS, type PlatformId } from "@/lib/workflow-router/platforms";

export function WorkflowMatrix({ tasks, onOpenTask, onOpenRun }: {
  tasks: TaskSummary[];
  onOpenTask: (n: number) => void;
  onOpenRun: (n: number, p: PlatformId) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TaskSummary["status"]>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (!q || `${t.task.number} ${t.task.title} ${t.task.category} ${t.task.prompt} ${PLATFORM_LABELS[t.task.recommendedPlatform]}`.toLowerCase().includes(q)),
    );
  }, [tasks, query, status]);

  const read = useCallback((t: TaskSummary, key: string) => {
    switch (key) {
      case "number": return t.task.number;
      case "title": return t.task.title;
      case "category": return t.task.category;
      case "recommended": return PLATFORM_LABELS[t.task.recommendedPlatform];
      case "status": return t.status;
      case "persistence": return t.task.requiresPersistence ? 1 : 0;
      default: {
        const row = t.board.find((b) => b.platform === key);
        return row?.score?.score100 ?? null;
      }
    }
  }, []);
  const { sorted, toggle, ariaSort } = useTableSort(rows, read, { key: "number", dir: "asc" });

  return (
    <section aria-labelledby="wm-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wm-title" className="text-lg font-semibold">Twelve-workflow matrix</h2>
          <p className="text-sm text-muted">Open a workflow for its prompt, rubric and runs; open a platform cell for that run.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-64">
            <label htmlFor="wm-search" className="sr-only">Search workflows</label>
            <input id="wm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workflows" className={inputClass} />
          </div>
          <div>
            <label htmlFor="wm-status" className="sr-only">Filter by status</label>
            <select id="wm-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
              <option value="all">All statuses</option>
              <option value="not-started">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="graded">Graded</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <caption className="sr-only">The 12 canonical workflows with per-platform weighted scores</caption>
          <thead>
            <tr>
              <SortHeader label="#" sortKey="number" ariaSort={ariaSort("number")} onToggle={toggle} />
              <SortHeader label="Workflow" sortKey="title" ariaSort={ariaSort("title")} onToggle={toggle} />
              <SortHeader label="Category" sortKey="category" ariaSort={ariaSort("category")} onToggle={toggle} />
              <SortHeader label="Recommended" sortKey="recommended" ariaSort={ariaSort("recommended")} onToggle={toggle} />
              <SortHeader label="Persistence" sortKey="persistence" ariaSort={ariaSort("persistence")} onToggle={toggle} />
              <SortHeader label="Status" sortKey="status" ariaSort={ariaSort("status")} onToggle={toggle} />
              {PLATFORM_IDS.map((p) => <SortHeader key={p} label={`${PLATFORM_LABELS[p]} /100`} sortKey={p} ariaSort={ariaSort(p)} onToggle={toggle} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.task.id} className="align-middle hover:bg-surface-2/50">
                <td className="border-b border-line px-3 py-2 font-mono text-muted">{String(t.task.number).padStart(2, "0")}</td>
                <th scope="row" className="border-b border-line px-3 py-2 text-left">
                  <button type="button" onClick={() => onOpenTask(t.task.number)} className="text-left font-medium underline decoration-dotted underline-offset-4 hover:text-accent">
                    {t.task.title}
                  </button>
                </th>
                <td className="border-b border-line px-3 py-2 text-muted">{t.task.category}</td>
                <td className="border-b border-line px-3 py-2"><PlatformBadge platform={t.task.recommendedPlatform} /></td>
                <td className="border-b border-line px-3 py-2">{t.task.requiresPersistence ? <Badge tone="accent">required</Badge> : <span className="text-muted">—</span>}</td>
                <td className="border-b border-line px-3 py-2"><StatusBadge status={t.status} /></td>
                {PLATFORM_IDS.map((p) => {
                  const b = t.board.find((x) => x.platform === p)!;
                  return (
                    <td key={p} className="border-b border-line px-3 py-2">
                      <button type="button" onClick={() => onOpenRun(t.task.number, p)} className="w-full rounded-md px-2 py-1 text-left hover:bg-surface-2" aria-label={`${PLATFORM_LABELS[p]}, workflow ${t.task.number}: ${b.score ? `${b.score.status}, ${formatScore100(b.score.score100)}` : "no run"}`}>
                        {b.score ? (
                          <span className="flex items-center gap-2">
                            <span className="font-semibold tabular-nums">{formatScore100(b.score.score100)}</span>
                            {b.score.status !== "complete" && <StatusBadge status={b.score.status} />}
                            {b.rank === 1 && <Badge tone="ok">best</Badge>}
                          </span>
                        ) : <span className="text-muted">no run</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">No workflow matches the current search and filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
