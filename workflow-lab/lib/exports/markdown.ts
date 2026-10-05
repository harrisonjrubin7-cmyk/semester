import { CRITERIA, CRITERION_LABELS } from "@/lib/benchmark/benchmark.config";
import { formatScore100, formatScore5, type PlatformTaskResult } from "@/lib/benchmark/scoring";
import type { SuiteSummary, TaskSummary } from "@/lib/benchmark/summary";
import { PLATFORMS, PLATFORM_LABELS } from "@/lib/workflow-router/platforms";
import type { Recommendation } from "@/lib/workflow-router/engine";
import { labelFor } from "@/lib/workflow-router/inputs";
import { buildPrompt, githubPlan, supabasePrompt } from "@/lib/workflow-router/prompts";

/** Escape text for a Markdown table cell. */
export const mdCell = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function recommendationToMarkdown(r: Recommendation, task?: string): string {
  const lines: string[] = [];
  lines.push("# Workflow recommendation", "");
  lines.push(`**Primary:** ${PLATFORMS[r.primary].name}  `);
  lines.push(`**Secondary:** ${PLATFORMS[r.secondary].name}  `);
  lines.push(`**Confidence:** ${r.confidence}%${r.forcedByV0Rules ? " (v0 rule triggered)" : ""}`, "");
  lines.push("## Selections", "");
  lines.push(`- Deliverable: ${labelFor("deliverable", r.inputs.deliverable)}`);
  lines.push(`- Interaction: ${labelFor("interaction", r.inputs.interaction)}`);
  lines.push(`- Backend: ${labelFor("backend", r.inputs.backend)}`);
  lines.push(`- Technology target: ${labelFor("tech", r.inputs.tech)}`);
  lines.push(`- Persistence / access: ${labelFor("persistence", r.inputs.persistence)}`);
  lines.push(`- Handoff: ${labelFor("handoff", r.inputs.handoff)}`, "");
  lines.push("## Why", "", ...r.reasons.map((x) => `- ${x}`), "");
  lines.push("## Sandbox limitations", "", ...r.limitations.map((x) => `- ${x}`), "");
  lines.push("## Output", "", `- Best initial output: ${r.bestInitialOutput}`, `- Best export / handoff format: ${r.bestExportFormat}`, "");
  if (r.escalation.level === "required") {
    lines.push("## Production escalation", "", `> **Warning:** ${r.escalation.warning}`, "", ...r.escalation.checklist.map((c) => `- [ ] ${c}`), "");
  }
  lines.push("## Recommended workflow", "", ...r.handoffSteps.map((s) => `${s.step}. **${s.platform}** — ${s.action}`), "");
  lines.push("## Build prompt", "", "```text", buildPrompt(r, task).trimEnd(), "```", "");
  lines.push("## GitHub handoff plan", "", githubPlan(r), "");
  const sp = supabasePrompt(r);
  if (sp) lines.push("## Supabase implementation prompt", "", "```text", sp.trimEnd(), "```", "");
  return lines.join("\n");
}

function boardTable(board: PlatformTaskResult[]): string[] {
  const out = ["| Rank | Platform | Attempt | Graders | Status | Score /5 | Score /100 |", "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const b of board)
    out.push(
      `| ${b.rank ?? "—"} | ${PLATFORM_LABELS[b.platform]} | ${b.attempt ?? "—"} | ${b.score?.graderCount ?? 0} | ${b.score?.status ?? "no run"} | ${formatScore5(b.score?.score5 ?? null)} | ${formatScore100(b.score?.score100 ?? null)} |`,
    );
  return out;
}

export function benchmarkReportMarkdown(s: SuiteSummary): string {
  const lines: string[] = [];
  lines.push(`# ${mdCell(s.suiteName)} — benchmark report`, "");
  lines.push(`${s.tasks.length} workflows · ${s.runCount} runs · ${s.gradeCount} grades`, "");
  lines.push("Only complete results (every weighted criterion scored) are ranked. Persistence grades are capped by the recorded persistence test.", "");
  lines.push("## Aggregate platform leaderboard", "");
  lines.push("| Rank | Platform | Workflows scored | Mean /100 (own) | Like-for-like mean /100 | Shared workflows | Graders |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const a of s.aggregate)
    lines.push(
      `| ${a.rank ?? "—"} | ${PLATFORM_LABELS[a.platform]} | ${a.tasksScored}/${a.tasksTotal} | ${a.mean100 ?? "—"} | ${a.sharedMean100 ?? "—"} | ${a.sharedTasks} | ${a.graderCount} |`,
    );
  lines.push("");
  if (s.aggregate.every((a) => a.rank === null)) lines.push("No platform is ranked yet: a result is ranked only when every weighted criterion has been scored.", "");
  for (const t of s.tasks) lines.push(...taskSection(t));
  return lines.join("\n");
}

function taskSection(t: TaskSummary): string[] {
  const lines = [`## ${t.task.number}. ${mdCell(t.task.title)}`, ""];
  lines.push(`Category: ${mdCell(t.task.category)} · Recommended: ${PLATFORM_LABELS[t.task.recommendedPlatform]} · Status: ${t.status} · Persistence required: ${t.task.requiresPersistence ? "yes" : "no"}`, "");
  lines.push(...boardTable(t.board), "");
  const crit = ["| Criterion | Weight | " + t.board.map((b) => PLATFORM_LABELS[b.platform]).join(" | ") + " |", "| --- | --- | " + t.board.map(() => "---").join(" | ") + " |"];
  for (const c of CRITERIA) {
    if (t.task.weights[c] === 0) continue;
    crit.push(`| ${CRITERION_LABELS[c]} | ${t.task.weights[c]}% | ${t.board.map((b) => (b.score?.perCriterion[c] ?? null) === null ? "—" : (b.score!.perCriterion[c] as number).toFixed(2)).join(" | ")} |`);
  }
  lines.push(...crit, "");
  return lines;
}

/** A compact, paste-ready grading summary for one platform/task result. */
export function gradeSummaryText(t: TaskSummary, platform: PlatformTaskResult["platform"]): string {
  const row = t.board.find((b) => b.platform === platform)!;
  const run = t.runs.find((r) => r.id === row.runId);
  const lines = [
    `Workflow ${t.task.number}: ${t.task.title}`,
    `Platform: ${PLATFORM_LABELS[platform]}${run ? ` (attempt ${run.attempt}${run.modelName ? `, ${run.modelName}${run.modelVersion ? " " + run.modelVersion : ""}` : ""})` : " — no run recorded"}`,
    `Weighted score: ${formatScore5(row.score?.score5 ?? null)} / 5 (${formatScore100(row.score?.score100 ?? null)} / 100) — ${row.score?.status ?? "missing"}, ${row.score?.graderCount ?? 0} grader(s)`,
  ];
  for (const c of CRITERIA) {
    if (t.task.weights[c] === 0) continue;
    const v = row.score?.perCriterion[c];
    lines.push(`- ${CRITERION_LABELS[c]} (${t.task.weights[c]}%): ${v === null || v === undefined ? "not scored" : v.toFixed(2)}`);
  }
  if (run && t.task.requiresPersistence)
    lines.push(`Persistence: mode ${run.persistenceMode}, tested ${run.persistenceTested ? "yes" : "no"}, survived reload ${run.persistenceSurvivedReload === null ? "unknown" : run.persistenceSurvivedReload ? "yes" : "no"}`);
  return lines.join("\n");
}
