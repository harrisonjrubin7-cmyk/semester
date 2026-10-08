/**
 * Weighted benchmark scoring.
 *
 *  - Each grader scores 0-5 per criterion (null = not scored).
 *  - Per criterion, scores are averaged across graders.
 *  - The task score is the weighted mean of the criteria that have a score;
 *    weights are renormalised over those criteria and the result is flagged
 *    "partial" until every criterion with weight > 0 is scored.
 *  - score100 = score5 * 20.
 *
 * Only "complete" results are ranked, so a platform cannot win by leaving its
 * weak criteria blank.
 */
import { CRITERIA, DEFAULT_WEIGHT_PERCENTS, type Criterion, type WeightPercents } from "./benchmark.config";
import { PLATFORM_IDS, type PlatformId } from "@/lib/workflow-router/platforms";

export type ScoreMap = Partial<Record<Criterion, number | null>>;
export type GradeInput = { graderId: string; scores: ScoreMap };

export type ResultStatus = "missing" | "partial" | "complete";

export type TaskScore = {
  score5: number | null;
  score100: number | null;
  graderCount: number;
  status: ResultStatus;
  missing: Criterion[];
  perCriterion: Record<Criterion, number | null>;
};

const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export function weightsSum(w: WeightPercents): number {
  return CRITERIA.reduce((a, c) => a + (w[c] ?? 0), 0);
}

/** Returns an array of problems; empty means the weights are usable. */
export function validateWeights(w: Partial<Record<Criterion, number>>): string[] {
  const problems: string[] = [];
  for (const c of CRITERIA) {
    const v = w[c];
    if (v === undefined || !Number.isFinite(v)) problems.push(`Weight for ${c} is missing.`);
    else if (v < 0 || v > 100) problems.push(`Weight for ${c} must be between 0 and 100.`);
  }
  if (problems.length === 0) {
    const sum = weightsSum(w as WeightPercents);
    if (Math.abs(sum - 100) > 1e-9) problems.push(`Weights must total 100 (got ${sum}).`);
  }
  return problems;
}

export function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5;
}

export function scoreTask(weights: WeightPercents, grades: GradeInput[]): TaskScore {
  const perCriterion = {} as Record<Criterion, number | null>;
  for (const c of CRITERIA) {
    const values = grades.map((g) => g.scores[c]).filter(isValidScore);
    perCriterion[c] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  const graderCount = new Set(grades.filter((g) => CRITERIA.some((c) => isValidScore(g.scores[c]))).map((g) => g.graderId)).size;

  const weighted = CRITERIA.filter((c) => (weights[c] ?? 0) > 0);
  const scored = weighted.filter((c) => perCriterion[c] !== null);
  const missing = weighted.filter((c) => perCriterion[c] === null);

  if (scored.length === 0) {
    return { score5: null, score100: null, graderCount, status: "missing", missing, perCriterion };
  }
  const totalWeight = scored.reduce((a, c) => a + weights[c], 0);
  const score5 = scored.reduce((a, c) => a + (perCriterion[c] as number) * weights[c], 0) / totalWeight;
  return {
    score5: round(score5),
    score100: round(score5 * 20, 2),
    graderCount,
    status: missing.length === 0 ? "complete" : "partial",
    missing,
    perCriterion,
  };
}

export function defaultWeights(): WeightPercents {
  return { ...DEFAULT_WEIGHT_PERCENTS };
}

export type RunWithGrades = { platform: PlatformId; attempt: number; runId: string; grades: GradeInput[] };

/** The latest attempt per platform is the one that counts. */
export function latestRunPerPlatform<T extends { platform: PlatformId; attempt: number }>(runs: T[]): Partial<Record<PlatformId, T>> {
  const out: Partial<Record<PlatformId, T>> = {};
  for (const r of runs) {
    const cur = out[r.platform];
    if (!cur || r.attempt > cur.attempt) out[r.platform] = r;
  }
  return out;
}

export type PlatformTaskResult = {
  platform: PlatformId;
  runId: string | null;
  attempt: number | null;
  score: TaskScore | null; // null: no run recorded
  rank: number | null;
};

/** Per-workflow leaderboard: one row per platform, ranked on complete results only. */
export function workflowLeaderboard(weights: WeightPercents, runs: RunWithGrades[]): PlatformTaskResult[] {
  const latest = latestRunPerPlatform(runs);
  const rows: PlatformTaskResult[] = PLATFORM_IDS.map((platform) => {
    const run = latest[platform];
    return {
      platform,
      runId: run?.runId ?? null,
      attempt: run?.attempt ?? null,
      score: run ? scoreTask(weights, run.grades) : null,
      rank: null,
    };
  });
  const ranked = rows
    .filter((r) => r.score?.status === "complete")
    .sort((a, b) => (b.score!.score100 as number) - (a.score!.score100 as number));
  let rank = 0;
  let prev: number | null = null;
  ranked.forEach((r, idx) => {
    const v = r.score!.score100 as number;
    if (prev === null || Math.abs(v - prev) > 1e-9) rank = idx + 1;
    r.rank = rank;
    prev = v;
  });
  return rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || PLATFORM_IDS.indexOf(a.platform) - PLATFORM_IDS.indexOf(b.platform));
}

export type AggregateRow = {
  platform: PlatformId;
  tasksScored: number;
  tasksTotal: number;
  /** Mean score/100 over the tasks this platform has a complete result for. */
  mean100: number | null;
  /** Mean score/100 over only the tasks complete for EVERY platform (like-for-like). */
  sharedMean100: number | null;
  sharedTasks: number;
  graderCount: number;
  rank: number | null;
};

export type TaskForAggregate = { number: number; weights: WeightPercents; runs: RunWithGrades[] };

export function aggregateLeaderboard(tasks: TaskForAggregate[]): AggregateRow[] {
  const perTask = tasks.map((t) => ({ number: t.number, board: workflowLeaderboard(t.weights, t.runs) }));
  const completeFor = (platform: PlatformId, n: number): number | null => {
    const row = perTask.find((t) => t.number === n)!.board.find((r) => r.platform === platform);
    return row?.score?.status === "complete" ? (row.score.score100 as number) : null;
  };
  const sharedNumbers = tasks
    .map((t) => t.number)
    .filter((n) => PLATFORM_IDS.every((p) => completeFor(p, n) !== null));

  const rows: AggregateRow[] = PLATFORM_IDS.map((platform) => {
    const own = tasks.map((t) => completeFor(platform, t.number)).filter((v): v is number => v !== null);
    const shared = sharedNumbers.map((n) => completeFor(platform, n) as number);
    const graders = new Set<string>();
    for (const t of tasks) for (const r of t.runs) if (r.platform === platform) r.grades.forEach((g) => graders.add(g.graderId));
    return {
      platform,
      tasksScored: own.length,
      tasksTotal: tasks.length,
      mean100: own.length ? round(own.reduce((a, b) => a + b, 0) / own.length, 2) : null,
      sharedMean100: shared.length ? round(shared.reduce((a, b) => a + b, 0) / shared.length, 2) : null,
      sharedTasks: shared.length,
      graderCount: graders.size,
      rank: null,
    };
  });

  const useShared = sharedNumbers.length > 0;
  const key = (r: AggregateRow) => (useShared ? r.sharedMean100 : r.mean100);
  const ranked = rows.filter((r) => key(r) !== null).sort((a, b) => (key(b) as number) - (key(a) as number));
  let rank = 0;
  let prev: number | null = null;
  ranked.forEach((r, idx) => {
    const v = key(r) as number;
    if (prev === null || Math.abs(v - prev) > 1e-9) rank = idx + 1;
    r.rank = rank;
    prev = v;
  });
  return rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || PLATFORM_IDS.indexOf(a.platform) - PLATFORM_IDS.indexOf(b.platform));
}

export type WorkflowStatus = "not-started" | "in-progress" | "graded";

/** "graded" means every platform has a run with a complete weighted result. */
export function workflowStatus(weights: WeightPercents, runs: RunWithGrades[]): WorkflowStatus {
  if (runs.length === 0) return "not-started";
  const board = workflowLeaderboard(weights, runs);
  return board.every((r) => r.score?.status === "complete") ? "graded" : "in-progress";
}

export function formatScore5(n: number | null): string {
  return n === null ? "—" : n.toFixed(2);
}
export function formatScore100(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}
