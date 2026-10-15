import { describe, expect, it } from "vitest";
import { findSecretLeaks, scoreSourceStructure } from "@/lib/benchmark/probes/source-structure";

describe("scoreSourceStructure", () => {
  it("reports nothing found for an empty capture, rather than passing", () => {
    const r = scoreSourceStructure([]);
    expect(r).toMatchObject({ passed: false, score: 0, max: 6 });
    expect(r.evidence).toEqual(["No source files were captured."]);
  });

  it("detects each structural signal independently (with a control)", () => {
    const only = (path: string, content: string) => scoreSourceStructure([{ path, content }]).checks.filter((c) => c.found).map((c) => c.id);
    expect(only("README.md", "# hi")).toEqual(["readme"]);
    expect(only("a.ts", "const x = 1")).toEqual(["typescript"]);
    expect(only("a.js", "try {} catch (e) {}")).toEqual(["error-state"]);
    expect(only("a.js", "const isLoading = true")).toEqual(["loading-state"]);
    expect(only("a.js", "schema.safeParse(body)")).toEqual(["validation"]);
    expect(only("a.test.ts", "x")).toEqual(expect.arrayContaining(["tests", "typescript"]));
    // control: plain prose triggers nothing
    expect(only("notes.txt", "nothing relevant here")).toEqual([]);
  });

  it("passes at three signals and fails at two", () => {
    const three = scoreSourceStructure([{ path: "README.md", content: "" }, { path: "a.ts", content: "z.object({}).safeParse(x)" }]);
    expect(three.score).toBe(3);
    expect(three.passed).toBe(true);
    expect(scoreSourceStructure([{ path: "README.md", content: "" }, { path: "a.ts", content: "" }]).passed).toBe(false);
  });
});

describe("findSecretLeaks", () => {
  it("flags secret-looking public variables, service-role in client code, and key literals", () => {
    const hits = findSecretLeaks([
      { path: ".env", content: "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=abc" },
      { path: "c.tsx", content: '"use client"; const k = process.env.SERVICE_ROLE; // service_role' },
      { path: "k.ts", content: "const key = 'sb_secret_abcdefghijkl'" },
    ]);
    expect(hits).toHaveLength(3);
  });
  it("does not flag the publishable key or server-only service-role mentions", () => {
    expect(findSecretLeaks([
      { path: ".env.example", content: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x" },
      { path: "server.ts", content: "// never use service_role in the browser" },
    ])).toEqual([]);
  });
});
