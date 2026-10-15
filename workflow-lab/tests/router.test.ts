import { describe, expect, it } from "vitest";
import { BENCHMARK_WORKFLOWS } from "@/lib/benchmark/benchmark.config";
import { needsSupabasePrompt, recommend, v0Triggers } from "@/lib/workflow-router/engine";
import { BACKENDS, DEFAULT_INPUTS, DELIVERABLES, HANDOFFS, INTERACTIONS, PERSISTENCE, TECH_TARGETS, type RouterInputs } from "@/lib/workflow-router/inputs";
import { buildPrompt, githubPlan, supabasePrompt } from "@/lib/workflow-router/prompts";

const base: RouterInputs = { deliverable: "interactive-tool", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "share-immediately" };
const with_ = (o: Partial<RouterInputs>): RouterInputs => ({ ...base, ...o });

describe("each of the 12 canonical workflows routes to its recommended platform", () => {
  for (const w of BENCHMARK_WORKFLOWS)
    it(`${w.number}. ${w.title} → ${w.recommendedPlatform}`, () => {
      expect(recommend(w.scenario).primary).toBe(w.recommendedPlatform);
    });
});

describe("v0 is forced by every v0 trigger", () => {
  const cases: Array<[string, Partial<RouterInputs>, string]> = [
    ["Next.js", { tech: "nextjs" }, "nextjs"],
    ["Next.js + Postgres", { tech: "next-postgres" }, "postgres"],
    ["Next.js + Supabase", { tech: "next-supabase" }, "supabase"],
    ["database backend", { backend: "database" }, "postgres"],
    ["persistent records (database)", { persistence: "database" }, "persistent-records"],
    ["persistent records (storage)", { persistence: "storage" }, "persistent-records"],
    ["persistent records (realtime)", { persistence: "realtime" }, "persistent-records"],
    ["authentication (backend)", { backend: "auth-secrets" }, "authentication"],
    ["authentication (persistence)", { persistence: "auth" }, "authentication"],
    ["server API / webhooks", { backend: "server-api" }, "server-api"],
    ["private server secrets", { backend: "auth-secrets" }, "private-secrets"],
    ["multi-user collaboration", { interaction: "multi-user" }, "multi-user"],
    ["organization membership", { persistence: "multi-tenant" }, "organization-membership"],
    ["role-based access", { persistence: "multi-tenant" }, "role-based-access"],
    ["Row Level Security", { persistence: "multi-tenant" }, "row-level-security"],
    ["GitHub-backed deployment", { handoff: "github" }, "github"],
    ["Vercel deployment", { handoff: "vercel" }, "vercel"],
    ["full-stack feature", { deliverable: "full-stack-feature" }, "full-stack-feature"],
  ];
  for (const [name, o, trigger] of cases)
    it(`${name} → v0 (trigger ${trigger})`, () => {
      const r = recommend(with_(o));
      expect(r.primary).toBe("v0");
      expect(r.forcedByV0Rules).toBe(true);
      expect(r.triggers.map((t) => t.id)).toContain(trigger);
      expect(r.escalation.level).toBe("required");
      expect(r.secondary).not.toBe("v0");
    });

  it("holds even where the deliverable would otherwise favour another platform", () => {
    // A document that needs Supabase and Vercel is still a v0 job.
    expect(recommend(with_({ deliverable: "document", tech: "next-supabase", handoff: "vercel" })).primary).toBe("v0");
    expect(recommend(with_({ deliverable: "presentation", persistence: "multi-tenant" })).primary).toBe("v0");
    expect(recommend(with_({ deliverable: "diagram", backend: "database" })).primary).toBe("v0");
  });

  it("exhaustive: no combination containing a v0 trigger ever routes elsewhere", () => {
    // Sample the whole input space deterministically (full product is 9*4*5*6*6*4 = 25,920).
    let checked = 0;
    for (const deliverable of DELIVERABLES)
      for (const interaction of INTERACTIONS)
        for (const backend of BACKENDS)
          for (const tech of TECH_TARGETS)
            for (const persistence of PERSISTENCE)
              for (const handoff of HANDOFFS) {
                const i: RouterInputs = { deliverable, interaction, backend, tech, persistence, handoff };
                const forced = v0Triggers(i).length > 0;
                const r = recommend(i);
                if (forced) expect(r.primary, JSON.stringify(i)).toBe("v0");
                else expect(r.primary, JSON.stringify(i)).not.toBe("v0");
                expect(r.confidence).toBeGreaterThanOrEqual(0);
                expect(r.confidence).toBeLessThanOrEqual(100);
                expect(r.secondary).not.toBe(r.primary);
                checked++;
              }
    expect(checked).toBe(25920);
  });
});

describe("non-v0 routing", () => {
  it("self-contained interactive work goes to Claude Artifacts", () => {
    for (const d of ["interactive-tool", "product-prototype", "marketing-page", "diagram"] as const)
      expect(recommend(with_({ deliverable: d, interaction: d === "diagram" ? "none" : "simple-local", tech: "react" })).primary).toBe("claude-artifacts");
  });
  it("documents, decks and data analysis go to Canvas", () => {
    for (const d of ["document", "presentation", "data-analysis"] as const)
      expect(recommend(with_({ deliverable: d, handoff: "document-export" })).primary).toBe("chatgpt-canvas");
  });
  it("is deterministic", () => {
    expect(recommend(DEFAULT_INPUTS)).toEqual(recommend({ ...DEFAULT_INPUTS }));
  });
  it("non-forced recommendations carry no production escalation but still state sandbox limits", () => {
    const r = recommend(with_({ deliverable: "diagram" }));
    expect(r.escalation).toEqual({ level: "none", warning: null, checklist: [] });
    expect(r.limitations.length).toBeGreaterThan(0);
    expect(r.limitations.join(" ")).toMatch(/not a durable backend/i);
  });
  it("the secondary is the better of the other two", () => {
    expect(recommend(with_({ deliverable: "document", handoff: "document-export" })).secondary).toBe("claude-artifacts");
    expect(recommend(with_({ deliverable: "diagram" })).secondary).toBe("chatgpt-canvas");
  });
});

describe("recommendation content", () => {
  const v0Rec = recommend({ deliverable: "full-stack-feature", interaction: "multi-user", backend: "auth-secrets", tech: "next-supabase", persistence: "multi-tenant", handoff: "vercel" });

  it("confidence is higher with more triggers and lower when the deliverable conflicts", () => {
    const one = recommend(with_({ handoff: "github" }));
    expect(v0Rec.confidence).toBeGreaterThan(one.confidence);
    const conflict = recommend(with_({ deliverable: "document", handoff: "github" }));
    expect(conflict.confidence).toBeLessThan(one.confidence);
  });

  it("explains itself: reasons are specific to the triggers", () => {
    expect(v0Rec.reasons.some((r) => /Row Level Security/.test(r))).toBe(true);
    expect(v0Rec.reasons.some((r) => /Vercel/.test(r))).toBe(true);
  });

  it("v0 gets a production escalation warning and checklist covering migrations, RLS, tests and env vars", () => {
    expect(v0Rec.escalation.warning).toMatch(/not a production deployment/);
    const list = v0Rec.escalation.checklist.join(" ");
    for (const w of [/migrations/i, /Row Level Security/i, /tests/i, /environment variables|NEXT_PUBLIC/i, /getUser/]) expect(list).toMatch(w);
  });

  it("the build prompt is platform specific and never promises what the platform cannot do", () => {
    const claude = buildPrompt(recommend(with_({ deliverable: "interactive-tool", interaction: "simple-local", tech: "react" })), "A tracker");
    expect(claude).toMatch(/Claude Artifacts/);
    expect(claude).toMatch(/A tracker/);
    expect(claude).toMatch(/Do not simulate a backend/);
    const canvas = buildPrompt(recommend(with_({ deliverable: "document", handoff: "document-export" })));
    expect(canvas).toMatch(/Canvas/);
    expect(canvas).toMatch(/Do not add anything that requires a server/);
    const v0 = buildPrompt(v0Rec);
    expect(v0).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(v0).toMatch(/Never expose a service-role key/);
  });

  it("the GitHub plan lists every handoff step and Vercel env guidance for v0", () => {
    const plan = githubPlan(v0Rec);
    for (const s of v0Rec.handoffSteps) expect(plan).toContain(s.action);
    expect(plan).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(githubPlan(recommend(with_({ deliverable: "diagram" })))).not.toMatch(/Vercel:/);
  });

  it("a Supabase prompt exists exactly when Supabase is in play, and states the security rules", () => {
    expect(needsSupabasePrompt(v0Rec.inputs)).toBe(true);
    const p = supabasePrompt(v0Rec)!;
    for (const w of [/@supabase\/ssr/, /createBrowserClient/, /createServerClient/, /getUser\(\)/, /NEXT_PUBLIC_SUPABASE_URL/, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/, /Row Level Security/, /owner, admin, member, viewer/, /proxy\.ts/])
      expect(p).toMatch(w);
    expect(supabasePrompt(recommend(with_({ deliverable: "diagram" })))).toBeNull();
    expect(supabasePrompt(recommend(with_({ tech: "nextjs", handoff: "github" })))).toBeNull(); // Next.js alone is not Supabase
    expect(supabasePrompt(recommend(with_({ tech: "next-supabase" })))).not.toBeNull();
  });

  it("a prototype-first handoff is suggested only where Claude is a sensible secondary", () => {
    const proto = recommend({ deliverable: "product-prototype", interaction: "complex-local", backend: "database", tech: "next-supabase", persistence: "database", handoff: "github" });
    expect(proto.handoffSteps[0]!.platform).toBe("claude-artifacts");
    expect(v0Rec.handoffSteps.some((s) => s.platform === "claude-artifacts")).toBe(false);
  });
});
