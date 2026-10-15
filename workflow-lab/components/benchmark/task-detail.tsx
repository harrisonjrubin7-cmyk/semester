"use client";

import { PlatformBadge, StatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { CRITERIA, CRITERION_LABELS } from "@/lib/benchmark/benchmark.config";
import type { TaskSummary } from "@/lib/benchmark/summary";
import { gradeSummaryText } from "@/lib/exports/markdown";
import { PLATFORM_IDS, PLATFORM_LABELS, type PlatformId } from "@/lib/workflow-router/platforms";
import { WorkflowLeaderboard } from "./leaderboard";

export function TaskDetail({ summary, onOpenRun }: { summary: TaskSummary; onOpenRun: (p: PlatformId) => void }) {
  const t = summary.task;
  const all = PLATFORM_IDS.map((p) => gradeSummaryText(summary, p)).join("\n\n");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={summary.status} />
        <span className="text-sm text-muted">Recommended:</span> <PlatformBadge platform={t.recommendedPlatform} />
        {t.requiresPersistence && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">persistence required</span>}
      </div>

      <section className="space-y-1">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Canonical prompt</h3><CopyButton text={t.prompt} label="Copy task prompt" /></div>
        <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm leading-relaxed">{t.prompt}</p>
        <p className="text-xs text-muted">Every platform receives exactly this text, in a fresh session.</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section><h3 className="text-sm font-semibold">Requirements</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{t.requirements.map((r) => <li key={r}>{r}</li>)}</ul></section>
        <section><h3 className="text-sm font-semibold">Acceptance criteria</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{t.acceptanceCriteria.map((r) => <li key={r}>{r}</li>)}</ul></section>
      </div>

      <section>
        <h3 className="text-sm font-semibold">Rubric weights</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {CRITERIA.map((c) => (
            <div key={c} className={t.weights[c] === 0 ? "text-muted" : ""}>
              <dt className="text-xs">{CRITERION_LABELS[c]}</dt>
              <dd className="font-semibold tabular-nums">{t.weights[c]}%</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Leaderboard for this workflow</h3><CopyButton text={all} label="Copy grading summary" /></div>
        <WorkflowLeaderboard board={summary.board} />
      </section>

      <section>
        <h3 className="text-sm font-semibold">Runs</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {PLATFORM_IDS.map((p) => {
            const runs = summary.runs.filter((r) => r.platform === p);
            return (
              <button key={p} type="button" onClick={() => onOpenRun(p)} className="rounded-lg border border-line bg-surface p-3 text-left hover:bg-surface-2">
                <span className="block text-sm font-semibold">{PLATFORM_LABELS[p]}</span>
                <span className="mt-1 block text-xs text-muted">{runs.length ? `${runs.length} attempt${runs.length === 1 ? "" : "s"}` : "No run — open to record"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
