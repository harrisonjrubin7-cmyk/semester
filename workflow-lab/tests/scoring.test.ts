import { describe, expect, it } from "vitest";
import { BENCHMARK_WORKFLOWS, CRITERIA, DEFAULT_WEIGHT_PERCENTS, type WeightPercents } from "@/lib/benchmark/benchmark.config";
import {
  aggregateLeaderboard,
  latestRunPerPlatform,
  scoreTask,
  validateWeights,
  weightsSum,
  workflowLeaderboard,
  workflowStatus,
  type GradeInput,
  type RunWithGrades,
} from "@/lib/benchmark/scoring";

const all = (n: number): GradeInput["scores"] => Object.fromEntries(CRITERIA.map((c) => [c, n]));
const grade = (graderId: string, scores: GradeInput["scores"]): GradeInput => ({ graderId, scores });

describe("default weights", () => {
  it("are the specified percentages and total 100", () => {
    expect(DEFAULT_WEIGHT_PERCENTS).toMatchObject({ correctness: 25, code_quality: 20, rendering: 15, state_management: 15, maintainability: 10, handoff: 10, sandbox_fit: 5 });
    expect(weightsSum(DEFAULT_WEIGHT_PERCENTS)).toBe(100);
  });
  it("every canonical workflow's weights total 100 and validate", () => {
    for (const w of BENCHMARK_WORKFLOWS) {
      expect(weightsSum(w.weights), `workflow ${w.number}`).toBe(100);
      expect(validateWeights(w.weights), `workflow ${w.number}`).toEqual([]);
    }
  });
  it("persistence carries weight exactly on the workflows that require it", () => {
    for (const w of BENCHMARK_WORKFLOWS) expect(w.weights.persistence > 0, `workflow ${w.number}`).toBe(w.requiresPersistence);
  });
});

describe("validateWeights", () => {
  it("rejects totals other than 100, negatives and missing criteria", () => {
    expect(validateWeights({ ...DEFAULT_WEIGHT_PERCENTS, correctness: 30 })[0]).toMatch(/total 100/);
    expect(validateWeights({ ...DEFAULT_WEIGHT_PERCENTS, correctness: -5, code_quality: 50 })[0]).toMatch(/between 0 and 100/);
    const { persistence: _p, ...missing } = DEFAULT_WEIGHT_PERCENTS;
    expect(validateWeights(missing)[0]).toMatch(/persistence is missing/);
  });
});

describe("scoreTask", () => {
  it("a perfect grader gives 5/5 and 100/100", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", all(5))]);
    expect(s).toMatchObject({ score5: 5, score100: 100, status: "complete", graderCount: 1, missing: [] });
  });

  it("computes the weighted mean by hand: 4*.25+3*.20+5*.15+2*.15+4*.10+3*.10+5*.05 = 3.6", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [
      grade("a", { correctness: 4, code_quality: 3, rendering: 5, state_management: 2, maintainability: 4, handoff: 3, sandbox_fit: 5 }),
    ]);
    expect(s.score5).toBe(3.6);
    expect(s.score100).toBe(72);
    expect(s.status).toBe("complete"); // persistence has weight 0, so it is not required
  });

  it("score100 is exactly 20 x score5", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", { correctness: 1, code_quality: 2, rendering: 3, state_management: 4, maintainability: 5, handoff: 0, sandbox_fit: 1 })]);
    expect(s.score100).toBeCloseTo((s.score5 as number) * 20, 2);
  });

  it("averages each criterion across graders before weighting", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", all(5)), grade("b", all(1))]);
    expect(s.perCriterion.correctness).toBe(3);
    expect(s.score5).toBe(3);
    expect(s.graderCount).toBe(2);
  });

  it("averages only the graders who scored a criterion", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", { ...all(4) }), grade("b", { correctness: 2 })]);
    expect(s.perCriterion.correctness).toBe(3);
    expect(s.perCriterion.rendering).toBe(4);
  });

  it("is order-independent across graders", () => {
    const a = grade("a", all(2));
    const b = grade("b", { ...all(5), rendering: 0 });
    expect(scoreTask(DEFAULT_WEIGHT_PERCENTS, [a, b])).toEqual(scoreTask(DEFAULT_WEIGHT_PERCENTS, [b, a]));
  });

  it("reports missing scores and marks the result partial, renormalising over what was scored", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", { correctness: 4, code_quality: 4 })]);
    expect(s.status).toBe("partial");
    expect(s.missing).toEqual(["rendering", "state_management", "maintainability", "handoff", "sandbox_fit"]);
    expect(s.score5).toBe(4); // (4*25+4*20)/45
  });

  it("no scores at all is the missing state, with null scores", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, []);
    expect(s).toMatchObject({ status: "missing", score5: null, score100: null, graderCount: 0 });
    expect(scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", {})]).graderCount).toBe(0);
  });

  it("ignores out-of-range and non-integer scores rather than letting them distort the result", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", { ...all(4), correctness: 9, rendering: 2.5 as number })]);
    expect(s.perCriterion.correctness).toBeNull();
    expect(s.perCriterion.rendering).toBeNull();
    expect(s.status).toBe("partial");
  });

  it("a zero score counts (0 is not 'missing')", () => {
    const s = scoreTask(DEFAULT_WEIGHT_PERCENTS, [grade("a", all(0))]);
    expect(s).toMatchObject({ score5: 0, status: "complete" });
  });

  it("a task weight override changes the result, and persistence becomes required when weighted", () => {
    const rendering: WeightPercents = { correctness: 0, code_quality: 0, rendering: 100, state_management: 0, maintainability: 0, handoff: 0, sandbox_fit: 0, persistence: 0 };
    expect(scoreTask(rendering, [grade("a", { ...all(1), rendering: 5 })]).score5).toBe(5);

    const withPersistence: WeightPercents = { ...DEFAULT_WEIGHT_PERCENTS, correctness: 15, persistence: 10 };
    const noPersistenceScore = scoreTask(withPersistence, [grade("a", { ...all(5), persistence: undefined })]);
    expect(noPersistenceScore.status).toBe("partial");
    expect(noPersistenceScore.missing).toEqual(["persistence"]);
    expect(scoreTask(withPersistence, [grade("a", all(5))]).status).toBe("complete");
  });

  it("does not mutate its inputs", () => {
    const w = { ...DEFAULT_WEIGHT_PERCENTS };
    const g = [grade("a", all(3))];
    const before = JSON.stringify([w, g]);
    scoreTask(w, g);
    expect(JSON.stringify([w, g])).toBe(before);
  });
});

const run = (platform: RunWithGrades["platform"], scores: number | null, attempt = 1): RunWithGrades => ({
  platform,
  attempt,
  runId: `${platform}-${attempt}`,
  grades: scores === null ? [] : [grade("g1", all(scores))],
});

describe("workflowLeaderboard", () => {
  it("ranks complete results by score, best first", () => {
    const b = workflowLeaderboard(DEFAULT_WEIGHT_PERCENTS, [run("claude-artifacts", 3), run("chatgpt-canvas", 5), run("v0", 4)]);
    expect(b.map((r) => [r.platform, r.rank])).toEqual([["chatgpt-canvas", 1], ["v0", 2], ["claude-artifacts", 3]]);
  });

  it("gives tied scores the same rank", () => {
    const b = workflowLeaderboard(DEFAULT_WEIGHT_PERCENTS, [run("claude-artifacts", 4), run("chatgpt-canvas", 4), run("v0", 2)]);
    expect(b.find((r) => r.platform === "claude-artifacts")!.rank).toBe(1);
    expect(b.find((r) => r.platform === "chatgpt-canvas")!.rank).toBe(1);
    expect(b.find((r) => r.platform === "v0")!.rank).toBe(3);
  });

  it("does not rank partial results, and platforms with no run have no score", () => {
    const partial: RunWithGrades = { platform: "v0", attempt: 1, runId: "p", grades: [grade("g", { correctness: 5 })] };
    const b = workflowLeaderboard(DEFAULT_WEIGHT_PERCENTS, [run("claude-artifacts", 3), partial]);
    expect(b.find((r) => r.platform === "v0")!.rank).toBeNull();
    expect(b.find((r) => r.platform === "v0")!.score?.status).toBe("partial");
    expect(b.find((r) => r.platform === "chatgpt-canvas")!.score).toBeNull();
    expect(b.find((r) => r.platform === "claude-artifacts")!.rank).toBe(1);
  });

  it("uses the latest attempt per platform", () => {
    const b = workflowLeaderboard(DEFAULT_WEIGHT_PERCENTS, [run("v0", 1, 1), run("v0", 5, 2)]);
    expect(b.find((r) => r.platform === "v0")!.score?.score5).toBe(5);
    expect(latestRunPerPlatform([run("v0", 1, 1), run("v0", 5, 3), run("v0", 2, 2)]).v0?.attempt).toBe(3);
  });
});

describe("aggregateLeaderboard", () => {
  const w = DEFAULT_WEIGHT_PERCENTS;
  it("averages complete workflow scores per platform and ranks on the like-for-like mean", () => {
    const rows = aggregateLeaderboard([
      { number: 1, weights: w, runs: [run("claude-artifacts", 5), run("chatgpt-canvas", 3), run("v0", 4)] },
      { number: 2, weights: w, runs: [run("claude-artifacts", 3), run("chatgpt-canvas", 3), run("v0", 5)] },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.platform, r]));
    expect(by["claude-artifacts"]!.sharedMean100).toBe(80); // (100+60)/2
    expect(by["chatgpt-canvas"]!.sharedMean100).toBe(60);
    expect(by.v0!.sharedMean100).toBe(90);
    expect(rows.map((r) => r.platform)).toEqual(["v0", "claude-artifacts", "chatgpt-canvas"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("a platform cannot climb by skipping a hard workflow", () => {
    const rows = aggregateLeaderboard([
      { number: 1, weights: w, runs: [run("claude-artifacts", 5), run("chatgpt-canvas", 5), run("v0", 5)] },
      { number: 2, weights: w, runs: [run("claude-artifacts", 5), run("chatgpt-canvas", 1)] }, // v0 skipped #2
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.platform, r]));
    expect(by.v0!.tasksScored).toBe(1);
    expect(by["claude-artifacts"]!.tasksScored).toBe(2);
    // Ranking uses only workflow 1, the one every platform completed: Canvas's weak #2 is not
    // counted against it and v0's missing #2 is not counted for it.
    expect(by.v0!.sharedTasks).toBe(1);
    expect(by["chatgpt-canvas"]!.sharedMean100).toBe(100);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
    // Their own means still show the gap honestly.
    expect(by["chatgpt-canvas"]!.mean100).toBe(60);
  });

  it("falls back to each platform's own mean when no workflow is complete for all", () => {
    const rows = aggregateLeaderboard([{ number: 1, weights: w, runs: [run("claude-artifacts", 4)] }]);
    expect(rows[0]).toMatchObject({ platform: "claude-artifacts", rank: 1, mean100: 80, sharedMean100: null });
  });

  it("counts graders per platform and reports an empty board cleanly", () => {
    const two: RunWithGrades = { platform: "v0", attempt: 1, runId: "x", grades: [grade("a", all(3)), grade("b", all(4))] };
    const rows = aggregateLeaderboard([{ number: 1, weights: w, runs: [two] }]);
    expect(rows.find((r) => r.platform === "v0")!.graderCount).toBe(2);
    expect(aggregateLeaderboard([{ number: 1, weights: w, runs: [] }]).every((r) => r.rank === null && r.mean100 === null)).toBe(true);
  });
});

describe("workflowStatus", () => {
  const w = DEFAULT_WEIGHT_PERCENTS;
  it("not-started / in-progress / graded", () => {
    expect(workflowStatus(w, [])).toBe("not-started");
    expect(workflowStatus(w, [run("v0", 4)])).toBe("in-progress");
    expect(workflowStatus(w, [run("claude-artifacts", 4), run("chatgpt-canvas", 4), run("v0", null)])).toBe("in-progress");
    expect(workflowStatus(w, [run("claude-artifacts", 4), run("chatgpt-canvas", 4), run("v0", 4)])).toBe("graded");
  });
});
