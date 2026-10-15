import Link from "next/link";
import { PlatformBadge } from "@/components/ui/badge";
import { BENCHMARK_WORKFLOWS } from "@/lib/benchmark/benchmark.config";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/workflow-router/platforms";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-4">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Put each workflow where it belongs: Artifacts, Canvas, or v0.
        </h1>
        <p className="max-w-2xl text-muted">
          Answer six questions to get a routed recommendation with reasons, sandbox limits and a ready-to-paste prompt — then benchmark all three platforms on the same 12 workflows and grade what they actually produce.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/workflow-router" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">Open the router</Link>
          <Link href="/benchmark" className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2">Open the benchmark</Link>
        </div>
      </section>

      <section aria-labelledby="platforms" className="space-y-3">
        <h2 id="platforms" className="text-lg font-semibold">Three platforms, three jobs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLATFORM_IDS.map((id) => (
            <article key={id} className="rounded-xl border border-line bg-surface p-4">
              <PlatformBadge platform={id} />
              <p className="mt-3 text-sm font-medium">{PLATFORMS[id].tagline}</p>
              <p className="mt-2 text-sm text-muted">{PLATFORMS[id].primaryUse}</p>
              <p className="mt-3 text-xs text-muted"><strong className="text-ink">Boundary:</strong> {PLATFORMS[id].boundaries[0]}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="suite" className="space-y-3">
        <h2 id="suite" className="text-lg font-semibold">The 12-workflow benchmark</h2>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BENCHMARK_WORKFLOWS.map((w) => (
            <li key={w.number} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <span><span className="mr-2 font-mono text-xs text-muted">{String(w.number).padStart(2, "0")}</span>{w.title}</span>
              <PlatformBadge platform={w.recommendedPlatform} label={w.recommendedPlatform === "v0" ? "v0" : w.recommendedPlatform === "chatgpt-canvas" ? "Canvas" : "Artifacts"} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
