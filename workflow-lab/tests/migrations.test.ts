import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BENCHMARK_WORKFLOWS } from "@/lib/benchmark/benchmark.config";
import { createDb, rows, type Db } from "./helpers/db";

let db: Db;
beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

describe("migrations", () => {
  it("apply cleanly in order and create every required table", async () => {
    const t = await rows<{ table_name: string }>(
      db,
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    const names = t.map((r) => r.table_name);
    for (const n of [
      "organizations", "organization_members", "workflow_recommendations",
      "benchmark_suites", "benchmark_tasks", "benchmark_runs", "benchmark_grades",
    ]) expect(names).toContain(n);
  });

  it("enables row level security on every table in the public schema", async () => {
    const r = await rows<{ relname: string; relrowsecurity: boolean }>(
      db,
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(r.length).toBeGreaterThanOrEqual(7);
    expect(r.filter((x) => !x.relrowsecurity)).toEqual([]);
  });

  it("defines the four organization roles", async () => {
    const r = await rows<{ e: string }>(db, "select unnest(enum_range(null::public.org_role))::text as e");
    expect(r.map((x) => x.e)).toEqual(["owner", "admin", "member", "viewer"]);
  });

  it("every policy targets authenticated, never anon or public", async () => {
    const r = await rows<{ tablename: string; policyname: string; roles: string }>(
      db,
      "select tablename, policyname, roles::text from pg_policies where schemaname = 'public'",
    );
    expect(r.length).toBeGreaterThan(20);
    for (const p of r) expect(p.roles, `${p.tablename}.${p.policyname}`).toBe("{authenticated}");
  });

  it("seed.sql loads one template suite containing all 12 workflows, and is idempotent", async () => {
    const seed = (await import("node:fs")).readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
    await db.exec(seed);
    const s = await rows<{ n: string }>(db, "select count(*)::text as n from public.benchmark_suites where is_template");
    expect(s[0]!.n).toBe("1");
    const t = await rows<{ task_number: number; slug: string; requires_persistence: boolean }>(
      db,
      "select task_number, slug, requires_persistence from public.benchmark_tasks order by task_number",
    );
    expect(t.map((x) => x.task_number)).toEqual(BENCHMARK_WORKFLOWS.map((w) => w.number));
    expect(t.map((x) => x.slug)).toEqual(BENCHMARK_WORKFLOWS.map((w) => w.slug));
    expect(t.map((x) => x.requires_persistence)).toEqual(BENCHMARK_WORKFLOWS.map((w) => w.requiresPersistence));
  });

  it("seeded prompts, criteria and weights round-trip byte-for-byte through SQL quoting", async () => {
    const t = await rows<{ task_number: number; prompt: string; title: string; acceptance_criteria: string[]; rubric_weights: Record<string, number>; capabilities: Record<string, boolean> }>(
      db,
      "select task_number, prompt, title, acceptance_criteria, rubric_weights, capabilities from public.benchmark_tasks order by task_number",
    );
    for (const w of BENCHMARK_WORKFLOWS) {
      const row = t.find((x) => x.task_number === w.number)!;
      expect(row.prompt).toBe(w.prompt);
      expect(row.title).toBe(w.title);
      expect(row.acceptance_criteria).toEqual(w.acceptanceCriteria);
      expect(row.rubric_weights).toEqual(w.weights);
      expect(row.capabilities).toEqual(w.capabilities);
    }
  });
});
