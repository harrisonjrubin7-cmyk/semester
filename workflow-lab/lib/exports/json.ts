import { PLATFORMS } from "@/lib/workflow-router/platforms";
import type { Recommendation } from "@/lib/workflow-router/engine";
import { buildPrompt, githubPlan, supabasePrompt } from "@/lib/workflow-router/prompts";
import type { SuiteSummary } from "@/lib/benchmark/summary";

export function recommendationDocument(r: Recommendation, task?: string) {
  return {
    schema: "semester.workflow-recommendation/v1",
    inputs: r.inputs,
    recommendation: {
      primary: { id: r.primary, name: PLATFORMS[r.primary].name },
      secondary: { id: r.secondary, name: PLATFORMS[r.secondary].name },
      confidence: r.confidence,
      forcedByV0Rules: r.forcedByV0Rules,
      triggers: r.triggers,
      reasons: r.reasons,
      limitations: r.limitations,
      bestInitialOutput: r.bestInitialOutput,
      bestExportFormat: r.bestExportFormat,
      escalation: r.escalation,
      handoffSteps: r.handoffSteps,
      scores: r.scores,
    },
    prompts: {
      build: buildPrompt(r, task),
      githubPlan: githubPlan(r),
      supabase: supabasePrompt(r),
    },
  };
}

export function recommendationToJson(r: Recommendation, task?: string): string {
  return JSON.stringify(recommendationDocument(r, task), null, 2) + "\n";
}

export function benchmarkToJson(summary: SuiteSummary): string {
  return (
    JSON.stringify(
      {
        schema: "semester.benchmark-report/v1",
        suite: { id: summary.suiteId, name: summary.suiteName },
        counts: { runs: summary.runCount, grades: summary.gradeCount },
        aggregateLeaderboard: summary.aggregate,
        workflows: summary.tasks.map((t) => ({
          number: t.task.number,
          title: t.task.title,
          category: t.task.category,
          status: t.status,
          weights: t.task.weights,
          requiresPersistence: t.task.requiresPersistence,
          results: t.board.map((b) => ({
            platform: b.platform,
            rank: b.rank,
            attempt: b.attempt,
            score: b.score,
          })),
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
