import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { createSuiteSchema, gradeSchema, parseManifest, parseUrlLines, runSchema } from "@/lib/validation/benchmark";
import { fieldErrors, httpUrl } from "@/lib/validation/common";
import { exportFormatSchema, routerInputsSchema, saveRecommendationSchema } from "@/lib/validation/workflow-router";

const uuid = "00000000-0000-4000-8000-000000000001";
const validRun = { suiteId: uuid, taskId: uuid, platform: "v0", status: "completed", executedPrompt: "p", sourceManifest: "" };

describe("router validation", () => {
  const ok = { deliverable: "diagram", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "share-immediately" };
  it("accepts valid selections and rejects unknown values", () => {
    expect(routerInputsSchema.safeParse(ok).success).toBe(true);
    expect(routerInputsSchema.safeParse({ ...ok, tech: "rails" }).success).toBe(false);
    expect(routerInputsSchema.safeParse({ ...ok, handoff: undefined }).success).toBe(false);
  });
  it("save requires a title and a valid optional organization uuid", () => {
    expect(saveRecommendationSchema.safeParse({ title: "  ", inputs: ok }).success).toBe(false);
    expect(saveRecommendationSchema.safeParse({ title: "x", organizationId: "not-a-uuid", inputs: ok }).success).toBe(false);
    const r = saveRecommendationSchema.parse({ title: " x ", organizationId: "", inputs: ok });
    expect(r.title).toBe("x");
    expect(r.organizationId).toBeUndefined();
  });
  it("export format is md or json", () => {
    expect(exportFormatSchema.safeParse("csv").success).toBe(false);
  });
});

describe("httpUrl", () => {
  it("accepts http(s) and rejects script-capable and local schemes", () => {
    for (const u of ["https://v0.app/chat/abc", "http://localhost:3000/x"]) expect(httpUrl.safeParse(u).success, u).toBe(true);
    for (const u of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "ftp://x", "not a url", "//evil.com"]) expect(httpUrl.safeParse(u).success, u).toBe(false);
  });
});

describe("runSchema", () => {
  it("accepts a minimal run and applies defaults", () => {
    const r = runSchema.parse(validRun);
    expect(r).toMatchObject({ attempt: 1, persistenceMode: "none", persistenceTested: false, sourceManifest: [] });
  });
  it("preserves the executed prompt exactly apart from outer whitespace", () => {
    const p = "Build a\n  tracker  with   odd   spacing\t- and tabs";
    expect(runSchema.parse({ ...validRun, executedPrompt: `\n${p}\n` }).executedPrompt).toBe(p);
  });
  it("rejects an empty prompt, bad platform/status and non-http output URLs", () => {
    expect(runSchema.safeParse({ ...validRun, executedPrompt: "  " }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, platform: "bolt" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, status: "great" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, outputUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, suiteId: "x" }).success).toBe(false);
  });
  it("coerces numbers and treats blanks as absent", () => {
    const r = runSchema.parse({ ...validRun, attempt: "3", durationSeconds: "12.5", modelName: "", outputUrl: "" });
    expect(r.attempt).toBe(3);
    expect(r.durationSeconds).toBe(12.5);
    expect(r.modelName).toBeUndefined();
    expect(r.outputUrl).toBeUndefined();
    expect(runSchema.safeParse({ ...validRun, durationSeconds: "-1" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, attempt: "0" }).success).toBe(false);
  });
  it("survival cannot be recorded without a test", () => {
    const bad = runSchema.safeParse({ ...validRun, persistenceSurvivedReload: "true" });
    expect(bad.success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, persistenceTested: "true", persistenceSurvivedReload: "true" }).success).toBe(true);
  });
  it("a failed persistence test must say what failed", () => {
    expect(runSchema.safeParse({ ...validRun, persistenceTested: "true", persistenceSurvivedReload: "false" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, persistenceTested: "true", persistenceSurvivedReload: "false", persistenceFailureNotes: "state reset" }).success).toBe(true);
  });
  it("a completed run cannot claim durable storage without a test", () => {
    expect(runSchema.safeParse({ ...validRun, persistenceMode: "database" }).success).toBe(false);
    expect(runSchema.safeParse({ ...validRun, persistenceMode: "database", status: "manual-review-required" }).success).toBe(true);
  });
  it("parses the file manifest and reports line-level problems", () => {
    const r = runSchema.parse({ ...validRun, sourceManifest: "app/page.tsx | 2310 | tsx | entry\nREADME.md\n\n" });
    expect(r.sourceManifest).toEqual([{ path: "app/page.tsx", bytes: 2310, language: "tsx", note: "entry" }, { path: "README.md" }]);
    expect(parseManifest("a | -3").problems[0]).toMatch(/Line 1/);
    expect(parseManifest("a | zzz").problems).toHaveLength(1);
    expect(runSchema.safeParse({ ...validRun, sourceManifest: "a | zzz" }).success).toBe(false);
  });
});

describe("gradeSchema", () => {
  const base = { runId: uuid };
  it("needs at least one score", () => {
    expect(gradeSchema.safeParse(base).success).toBe(false);
    expect(gradeSchema.safeParse({ ...base, correctness: "" }).success).toBe(false);
    expect(gradeSchema.safeParse({ ...base, correctness: "4" }).success).toBe(true);
  });
  it("0 is a valid score; bounds are 0-5 integers", () => {
    expect(gradeSchema.parse({ ...base, correctness: "0" }).correctness).toBe(0);
    for (const bad of ["6", "-1", "2.5", "abc"]) expect(gradeSchema.safeParse({ ...base, correctness: bad }).success, bad).toBe(false);
  });
  it("collects and validates evidence URLs", () => {
    const g = gradeSchema.parse({ ...base, correctness: "3", evidenceUrls: "https://a.example/x\n\nhttps://b.example/y" });
    expect(g.evidenceUrls).toEqual(["https://a.example/x", "https://b.example/y"]);
    expect(gradeSchema.safeParse({ ...base, correctness: "3", evidenceUrls: "javascript:alert(1)" }).success).toBe(false);
    expect(parseUrlLines(Array.from({ length: 21 }, (_, i) => `https://x.example/${i}`).join("\n")).problems).toContain("At most 20 evidence URLs.");
  });
  it("keeps evaluator notes bounded", () => {
    expect(gradeSchema.safeParse({ ...base, correctness: "3", evaluatorNotes: "x".repeat(10001) }).success).toBe(false);
  });
});

describe("createSuiteSchema and fieldErrors", () => {
  it("name and organization are optional; organization must be a uuid", () => {
    expect(createSuiteSchema.parse({ name: "", organizationId: "" })).toEqual({});
    expect(createSuiteSchema.safeParse({ organizationId: "nope" }).success).toBe(false);
  });
  it("fieldErrors groups messages by path", () => {
    const r = runSchema.safeParse({ ...validRun, executedPrompt: "", platform: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(["executedPrompt", "platform"]);
  });
});

describe("safeNextPath", () => {
  it("allows same-origin paths only", () => {
    expect(safeNextPath("/benchmark/abc?x=1")).toBe("/benchmark/abc?x=1");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "/\u0000x", "///evil.com"])
      expect(safeNextPath(bad), bad).toBe("/");
    expect(safeNextPath("//evil.com", "/home")).toBe("/home");
  });
});
