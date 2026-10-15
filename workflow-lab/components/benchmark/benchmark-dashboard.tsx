"use client";

import { withBasePath } from "@/lib/base-path";
import { useMemo, useState } from "react";
import { Badge, PlatformBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { buildSummary } from "@/lib/benchmark/summary";
import type { SuiteBundle } from "@/lib/benchmark/types";
import { PLATFORM_LABELS, type PlatformId } from "@/lib/workflow-router/platforms";
import { BenchmarkRunDetail } from "./benchmark-run-detail";
import { AggregateLeaderboard } from "./leaderboard";
import { TaskDetail } from "./task-detail";
import { WorkflowMatrix } from "./workflow-matrix";

export type Viewer = {
  userId: string | null;
  /** UI hint only. Row Level Security is the real authorization. */
  canWrite: boolean;
  readOnlyReason: string;
};

type View = { kind: "task"; number: number } | { kind: "run"; number: number; platform: PlatformId } | null;

export function BenchmarkDashboard({ bundle, viewer, exportSuiteId }: { bundle: SuiteBundle; viewer: Viewer; exportSuiteId: string }) {
  const [view, setView] = useState<View>(null);
  const summary = useMemo(() => buildSummary(bundle), [bundle]);
  const current = view ? summary.tasks.find((t) => t.task.number === view.number) : undefined;
  const exportHref = (format: string) => `${withBasePath("/api/exports/benchmark")}?suite=${encodeURIComponent(exportSuiteId)}&format=${format}`;
  const graded = summary.tasks.filter((t) => t.status === "graded").length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{bundle.suite.name}</h1>
          {bundle.suite.description && <p className="max-w-2xl text-sm text-muted">{bundle.suite.description}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {bundle.suite.isTemplate && <Badge tone="warn">read-only template</Badge>}
            {bundle.suite.organizationId && <Badge tone="accent">shared with organization</Badge>}
            {!bundle.suite.isTemplate && !bundle.suite.organizationId && <Badge>private</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["csv", "md", "json"] as const).map((f) => (
            <a key={f} href={exportHref(f)} download className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
              {f === "csv" ? "Download CSV table" : f === "md" ? "Download Markdown report" : "Download JSON"}
            </a>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Workflows", summary.tasks.length],
          ["Fully graded", `${graded} / ${summary.tasks.length}`],
          ["Runs recorded", summary.runCount],
          ["Grades", summary.gradeCount],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-line bg-surface px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {summary.runCount === 0 && (
        <div role="status" className="rounded-xl border border-dashed border-line bg-surface p-5 text-sm">
          <p className="font-medium">No runs recorded yet.</p>
          <p className="mt-1 text-muted">Open a workflow, pick a platform cell, run the canonical prompt there by hand, and record the result. Scores and leaderboards appear as soon as runs are graded.</p>
        </div>
      )}

      <AggregateLeaderboard rows={summary.aggregate} />
      <WorkflowMatrix tasks={summary.tasks} onOpenTask={(n) => setView({ kind: "task", number: n })} onOpenRun={(n, p) => setView({ kind: "run", number: n, platform: p })} />

      <Drawer
        open={view !== null && current !== undefined}
        onClose={() => setView(null)}
        title={current ? `${current.task.number}. ${current.task.title}${view?.kind === "run" ? ` — ${PLATFORM_LABELS[view.platform]}` : ""}` : ""}
        subtitle={current ? (
          <span className="flex flex-wrap items-center gap-2">
            {view?.kind === "run" && <button type="button" className="underline" onClick={() => setView({ kind: "task", number: view.number })}>← Workflow</button>}
            <span>{current.task.category}</span>
            {view?.kind === "run" && <PlatformBadge platform={view.platform} />}
          </span>
        ) : null}
      >
        {current && view?.kind === "task" && <TaskDetail summary={current} onOpenRun={(p) => setView({ kind: "run", number: current.task.number, platform: p })} />}
        {current && view?.kind === "run" && (
          <BenchmarkRunDetail suiteId={bundle.suite.id} summary={current} platform={view.platform} grades={bundle.grades} viewer={viewer} />
        )}
      </Drawer>
    </div>
  );
}
