import { describe, expect, it } from "vitest";
import { BENCHMARK_WORKFLOWS, CRITERIA } from "@/lib/benchmark/benchmark.config";
import { localTemplateBundle } from "@/lib/benchmark/repository";
import { buildSummary } from "@/lib/benchmark/summary";
import type { GradeRecord, RunRecord, SuiteBundle } from "@/lib/benchmark/types";
import { BENCHMARK_CSV_HEADER, benchmarkCsv, csvCell, toCsv } from "@/lib/exports/csv";
import { safeFilename } from "@/lib/exports/download";
import { benchmarkToJson, recommendationDocument, recommendationToJson } from "@/lib/exports/json";
import { benchmarkReportMarkdown, gradeSummaryText, mdCell, recommendationToMarkdown } from "@/lib/exports/markdown";
import { recommend } from "@/lib/workflow-router/engine";

const rec = recommend({ deliverable: "full-stack-feature", interaction: "multi-user", backend: "auth-secrets", tech: "next-supabase", persistence: "multi-tenant", handoff: "vercel" });

describe("CSV", () => {
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(false)).toBe("false");
    expect(csvCell(Number.NaN)).toBe("");
  });
  it("neutralises spreadsheet formula injection in text cells but leaves numbers alone", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])
      expect(csvCell(evil).replace(/^"/, "")).toMatch(/^'/);
    expect(csvCell(-5)).toBe("-5");
  });
  it("toCsv uses CRLF and ends with a newline", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

function bundleWithData(): SuiteBundle {
  const b = localTemplateBundle();
  const t1 = b.tasks.find((t) => t.number === 1)!;
  const t10 = b.tasks.find((t) => t.number === 10)!;
  const mkRun = (taskId: string, platform: RunRecord["platform"], over: Partial<RunRecord> = {}): RunRecord => ({
    id: `${taskId}-${platform}`, taskId, suiteId: b.suite.id, platform, attempt: 1, status: "completed", executedPrompt: "p",
    modelName: "=evil, model", modelVersion: "1", runtimeNotes: null, outputUrl: "https://example.test/a", outputText: null,
    sourceManifest: [], consoleNotes: null, durationSeconds: 42, persistenceMode: "none", persistenceTested: false,
    persistenceSurvivedReload: null, persistenceEvidence: null, persistenceEvidenceUrl: null, persistenceFailureNotes: null,
    recordedBy: "u", createdAt: "2026-01-01T00:00:00Z", ...over,
  });
  const g = (runId: string, n: number): GradeRecord => ({
    id: `g-${runId}`, runId, graderId: "u1", scores: Object.fromEntries(CRITERIA.map((c) => [c, n])) as GradeRecord["scores"],
    criterionNotes: {}, evidenceUrls: [], evaluatorNotes: null, createdAt: "2026-01-01T00:00:00Z",
  });
  const runs = [mkRun(t1.id, "claude-artifacts"), mkRun(t1.id, "chatgpt-canvas"), mkRun(t1.id, "v0"), mkRun(t10.id, "v0", { persistenceMode: "database", persistenceTested: true, persistenceSurvivedReload: true, persistenceEvidence: "row 1" })];
  return { ...b, runs, grades: [g(runs[0]!.id, 5), g(runs[1]!.id, 3), g(runs[2]!.id, 4), g(runs[3]!.id, 5)] };
}

describe("benchmark CSV", () => {
  const summary = buildSummary(bundleWithData());
  const csv = benchmarkCsv(summary);
  const lines = csv.trimEnd().split("\r\n");

  it("has one row per workflow x platform (36) plus the header", () => {
    expect(lines).toHaveLength(1 + 12 * 3);
    expect(lines[0]).toBe(BENCHMARK_CSV_HEADER.join(","));
    expect(BENCHMARK_CSV_HEADER).toEqual(expect.arrayContaining(CRITERIA.map((c) => `score_${c}`)));
  });
  it("includes scores, rank and status for graded rows and 'not-run' for the rest", () => {
    const col = (row: string, name: string) => parseCsvLine(row)[BENCHMARK_CSV_HEADER.indexOf(name)];
    const claude1 = lines.find((l) => l.startsWith("1,Sortable artifact tracker,React UI,Claude Artifacts"))!;
    expect(col(claude1, "weighted_score_5")).toBe("5");
    expect(col(claude1, "weighted_score_100")).toBe("100");
    expect(col(claude1, "rank")).toBe("1");
    expect(col(claude1, "result_status")).toBe("complete");
    const canvas1 = lines.find((l) => l.startsWith("1,Sortable artifact tracker,React UI,ChatGPT Canvas"))!;
    expect(col(canvas1, "weighted_score_100")).toBe("60");
    expect(col(canvas1, "rank")).toBe("3");
    const none = lines.find((l) => l.startsWith("2,Interactive onboarding prototype,Product design,Claude Artifacts"))!;
    expect(col(none, "run_status")).toBe("not-run");
    expect(col(none, "result_status")).toBe("missing");
  });
  it("neutralises hostile model names and survives round-tripping through a CSV parser", () => {
    expect(csv).toContain(`"'=evil, model"`);
    for (const l of lines) expect(parseCsvLine(l)).toHaveLength(BENCHMARK_CSV_HEADER.length);
  });
  it("records persistence facts per run", () => {
    const row = lines.filter((x) => x.startsWith("10,")).find((x) => x.includes(",v0 Sandbox,"))!;
    const get = (name: string) => parseCsvLine(row)[BENCHMARK_CSV_HEADER.indexOf(name)];
    expect(get("persistence_required")).toBe("true");
    expect(get("persistence_mode")).toBe("database");
    expect(get("persistence_survived_reload")).toBe("true");
  });
});

/** Minimal RFC 4180 line parser for the test (fields here contain no newlines except quoted ones we do not generate). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

describe("recommendation exports", () => {
  it("Markdown contains the selections, reasons, escalation checklist, prompts and Supabase prompt", () => {
    const md = recommendationToMarkdown(rec, "Build the thing");
    for (const s of ["# Workflow recommendation", "**Primary:** v0 Sandbox", "## Selections", "## Why", "## Sandbox limitations", "## Production escalation", "- [ ]", "## Build prompt", "Build the thing", "## GitHub handoff plan", "## Supabase implementation prompt"])
      expect(md).toContain(s);
    expect(md).toContain("Multi-tenant workspace");
  });
  it("omits the escalation and Supabase sections when they do not apply", () => {
    const md = recommendationToMarkdown(recommend({ deliverable: "diagram", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "share-immediately" }));
    expect(md).not.toContain("## Production escalation");
    expect(md).not.toContain("## Supabase implementation prompt");
  });
  it("JSON is valid, versioned and round-trips the decision", () => {
    const parsed = JSON.parse(recommendationToJson(rec));
    expect(parsed.schema).toBe("semester.workflow-recommendation/v1");
    expect(parsed.inputs).toEqual(rec.inputs);
    expect(parsed.recommendation.primary).toEqual({ id: "v0", name: "v0 Sandbox" });
    expect(parsed.recommendation.escalation.level).toBe("required");
    expect(parsed.prompts.supabase).toContain("@supabase/ssr");
    expect(recommendationDocument(rec).prompts.build).toBe(parsed.prompts.build);
  });
});

describe("benchmark report exports", () => {
  const summary = buildSummary(bundleWithData());
  it("Markdown report has the aggregate table and a section per workflow", () => {
    const md = benchmarkReportMarkdown(summary);
    expect(md).toContain("## Aggregate platform leaderboard");
    for (const w of BENCHMARK_WORKFLOWS) expect(md).toContain(`## ${w.number}. ${w.title}`);
    expect(md).toContain("| 1 | Claude Artifacts |");
  });
  it("JSON report is valid and carries weights and per-platform results", () => {
    const j = JSON.parse(benchmarkToJson(summary));
    expect(j.schema).toBe("semester.benchmark-report/v1");
    expect(j.workflows).toHaveLength(12);
    expect(j.workflows[0].results).toHaveLength(3);
    expect(j.counts).toEqual({ runs: 4, grades: 4 });
  });
  it("grading summary text is paste-ready and states missing scores honestly", () => {
    const t = summary.tasks.find((x) => x.task.number === 1)!;
    const text = gradeSummaryText(t, "claude-artifacts");
    expect(text).toContain("Workflow 1: Sortable artifact tracker");
    expect(text).toContain("5.00 / 5 (100.0 / 100)");
    const none = gradeSummaryText(summary.tasks.find((x) => x.task.number === 2)!, "v0");
    expect(none).toContain("no run recorded");
    expect(none).toContain("not scored");
  });
  it("the empty template exports cleanly", () => {
    const empty = buildSummary(localTemplateBundle());
    expect(benchmarkCsv(empty).trimEnd().split("\r\n")).toHaveLength(37);
    expect(() => JSON.parse(benchmarkToJson(empty))).not.toThrow();
    expect(benchmarkReportMarkdown(empty)).toContain("No platform");
  });
});

describe("small helpers", () => {
  it("mdCell escapes pipes and newlines", () => expect(mdCell("a|b\nc")).toBe("a\\|b c"));
  it("mdCell escapes backslashes first, so a trailing backslash cannot un-escape the pipe after it", () => {
    expect(mdCell("a\\|b")).toBe("a\\\\\\|b");
    expect(mdCell("C:\\dir\\")).toBe("C:\\\\dir\\\\");
  });
  it("safeFilename strips path and control characters", () => {
    expect(safeFilename("../../Etc/Passwd \"x\"")).toBe("etc-passwd-x");
    expect(safeFilename("a..b...c")).toBe("a.b.c");
    expect(safeFilename("")).toBe("export");
  });
});
