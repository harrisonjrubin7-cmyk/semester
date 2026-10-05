import { CRITERIA } from "@/lib/benchmark/benchmark.config";
import type { SuiteSummary } from "@/lib/benchmark/summary";
import { PLATFORM_LABELS } from "@/lib/workflow-router/platforms";

type Cell = string | number | boolean | null | undefined;

/**
 * RFC 4180 CSV. Text cells that a spreadsheet would execute as a formula
 * (leading = + - @ tab or CR) are prefixed with an apostrophe, so exported
 * model output or notes cannot run in the reader's Excel.
 */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const BENCHMARK_CSV_HEADER = [
  "workflow_number",
  "workflow_title",
  "category",
  "platform",
  "run_attempt",
  "run_status",
  "model_name",
  "model_version",
  "duration_seconds",
  "output_url",
  "persistence_required",
  "persistence_mode",
  "persistence_tested",
  "persistence_survived_reload",
  ...CRITERIA.map((c) => `score_${c}`),
  "grader_count",
  "result_status",
  "weighted_score_5",
  "weighted_score_100",
  "rank",
];

/** One row per workflow x platform, including platforms with no run (so gaps are visible). */
export function benchmarkCsv(summary: SuiteSummary): string {
  const rows: Cell[][] = [];
  for (const t of summary.tasks) {
    for (const row of t.board) {
      const run = t.runs.find((r) => r.id === row.runId);
      rows.push([
        t.task.number,
        t.task.title,
        t.task.category,
        PLATFORM_LABELS[row.platform],
        row.attempt,
        run?.status ?? "not-run",
        run?.modelName,
        run?.modelVersion,
        run?.durationSeconds,
        run?.outputUrl,
        t.task.requiresPersistence,
        run?.persistenceMode,
        run?.persistenceTested,
        run?.persistenceSurvivedReload,
        ...CRITERIA.map((c) => {
          const v = row.score?.perCriterion[c];
          return v === null || v === undefined ? "" : Number(v.toFixed(2));
        }),
        row.score?.graderCount ?? 0,
        row.score?.status ?? "missing",
        row.score?.score5,
        row.score?.score100,
        row.rank,
      ]);
    }
  }
  return toCsv(BENCHMARK_CSV_HEADER, rows);
}
