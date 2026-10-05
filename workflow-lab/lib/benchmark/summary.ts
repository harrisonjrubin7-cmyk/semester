import {
  aggregateLeaderboard,
  workflowLeaderboard,
  workflowStatus,
  type AggregateRow,
  type PlatformTaskResult,
  type RunWithGrades,
  type WorkflowStatus,
} from "./scoring";
import type { RunRecord, SuiteBundle, TaskRecord } from "./types";

export type TaskSummary = {
  task: TaskRecord;
  status: WorkflowStatus;
  board: PlatformTaskResult[];
  runs: RunRecord[];
  runsWithGrades: RunWithGrades[];
};

export type SuiteSummary = {
  suiteName: string;
  suiteId: string;
  tasks: TaskSummary[];
  aggregate: AggregateRow[];
  runCount: number;
  gradeCount: number;
};

export function buildSummary(bundle: SuiteBundle): SuiteSummary {
  const tasks = [...bundle.tasks].sort((a, b) => a.number - b.number);
  const summaries: TaskSummary[] = tasks.map((task) => {
    const runs = bundle.runs.filter((r) => r.taskId === task.id);
    const runsWithGrades: RunWithGrades[] = runs.map((r) => ({
      platform: r.platform,
      attempt: r.attempt,
      runId: r.id,
      grades: bundle.grades
        .filter((g) => g.runId === r.id)
        .map((g) => ({ graderId: g.graderId, scores: g.scores })),
    }));
    return {
      task,
      runs,
      runsWithGrades,
      status: workflowStatus(task.weights, runsWithGrades),
      board: workflowLeaderboard(task.weights, runsWithGrades),
    };
  });
  return {
    suiteName: bundle.suite.name,
    suiteId: bundle.suite.id,
    tasks: summaries,
    aggregate: aggregateLeaderboard(summaries.map((s) => ({ number: s.task.number, weights: s.task.weights, runs: s.runsWithGrades }))),
    runCount: bundle.runs.length,
    gradeCount: bundle.grades.length,
  };
}
