import type { Metadata } from "next";
import Link from "next/link";
import { CreateSuiteForm } from "@/components/benchmark/create-suite-form";
import { Badge } from "@/components/ui/badge";
import { BENCHMARK_EXECUTION_CONFIG, BENCHMARK_WORKFLOWS } from "@/lib/benchmark/benchmark.config";
import { LOCAL_SUITE_ID, listMyOrganizations, listSuites } from "@/lib/benchmark/repository";
import type { SuiteRecord } from "@/lib/benchmark/types";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Benchmark · Semester Workflow Lab" };
export const dynamic = "force-dynamic";

export default async function BenchmarkIndexPage() {
  const { supabase, user } = await getUser();
  let suites: SuiteRecord[] = [];
  let orgs: Array<{ id: string; name: string; role: string }> = [];
  let error: string | null = null;
  if (supabase && user) {
    try {
      [suites, orgs] = await Promise.all([listSuites(supabase), listMyOrganizations(supabase)]);
    } catch {
      error = "Suites could not be loaded. Check that the migrations and seed have been applied.";
    }
  }
  const mine = suites.filter((s) => !s.isTemplate);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmark lab</h1>
        <p className="max-w-3xl text-sm text-muted">
          Run the same {BENCHMARK_WORKFLOWS.length} workflow prompts on Claude Artifacts, ChatGPT Canvas and v0, record exactly what was executed, grade the output 0–5 on eight criteria, and compare weighted scores.
        </p>
      </header>

      {error && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <section aria-labelledby="suites" className="space-y-3">
        <h2 id="suites" className="text-lg font-semibold">Suites</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link href={`/benchmark/${LOCAL_SUITE_ID}`} className="font-medium underline decoration-dotted underline-offset-4 hover:text-accent">Canonical 12-workflow definition</Link>
              <p className="text-xs text-muted">Local sample data. Read-only; nothing is stored.</p>
            </div>
            <Badge tone="warn">definition only</Badge>
          </li>
          {mine.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link href={`/benchmark/${s.id}`} className="font-medium underline decoration-dotted underline-offset-4 hover:text-accent">{s.name}</Link>
                <p className="text-xs text-muted">Created {new Date(s.createdAt).toLocaleDateString()}</p>
              </div>
              {s.organizationId ? <Badge tone="accent">organization</Badge> : <Badge>private</Badge>}
            </li>
          ))}
          {user && mine.length === 0 && !error && <li className="px-4 py-3 text-sm text-muted">You have no saved suites yet. Create one below.</li>}
        </ul>
      </section>

      <section aria-labelledby="new" className="max-w-xl space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 id="new" className="text-lg font-semibold">New suite</h2>
        {!supabase && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">Prototype mode: Supabase is not configured, so suites cannot be created. Set the two public Supabase variables (see the README).</p>}
        {supabase && !user && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">Creating and grading suites is protected. <Link href="/auth/sign-in?next=/benchmark" className="font-medium underline">Sign in</Link> to continue.</p>}
        {supabase && user && <CreateSuiteForm organizations={orgs} />}
      </section>

      <section aria-labelledby="protocol" className="space-y-3">
        <h2 id="protocol" className="text-lg font-semibold">Execution protocol</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>One fresh session per platform per workflow. {BENCHMARK_EXECUTION_CONFIG.enforceFreshSession ? "Required." : ""}</li>
          <li>Paste the canonical prompt verbatim. The exact executed text is stored; edited prompts are flagged as not comparable.</li>
          <li>Record model name and version, runtime notes, output URL, source manifest, console notes and duration.</li>
          <li>For workflows that require persistence, reload and open a fresh session, then record the storage mode, whether state survived, and evidence.</li>
          <li>Grade 0–5 on each criterion with notes and evidence URLs. Static probes support, but never replace, human review.</li>
        </ol>
        <p className="max-w-3xl text-sm text-muted">
          No platform is driven automatically: there is no approved programmatic integration for Claude Artifacts, ChatGPT Canvas or v0 here. Each adapter returns <code>manual-review-required</code>, or <code>unsupported</code> with a reason when the task needs a backend the platform does not provide.
        </p>
      </section>
    </div>
  );
}
