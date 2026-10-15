import { Badge, PlatformBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import type { Recommendation } from "@/lib/workflow-router/engine";
import { PLATFORMS } from "@/lib/workflow-router/platforms";

export function RecommendationPanel({ rec }: { rec: Recommendation }) {
  const primary = PLATFORMS[rec.primary];
  const secondary = PLATFORMS[rec.secondary];
  const summary = `${primary.name} (primary), ${secondary.name} (secondary), confidence ${rec.confidence}%`;

  return (
    <section aria-labelledby="rec-title" className="space-y-5 rounded-xl border border-line bg-surface p-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rec-title" className="text-lg font-semibold">Recommendation</h2>
          <p className="text-sm text-muted">{rec.forcedByV0Rules ? "A v0 rule was triggered by your selections." : "Chosen by weighted scoring."}</p>
        </div>
        <CopyButton text={summary} label="Copy summary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Primary</p>
          <p className="mt-1 flex items-center gap-2 text-xl font-semibold">{primary.name}</p>
          <p className="mt-1 text-sm text-muted">{primary.tagline}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Secondary</p>
          <p className="mt-1 text-xl font-semibold">{secondary.name}</p>
          <p className="mt-1 text-sm text-muted">{secondary.tagline}</p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span id="confidence-label" className="font-medium">Confidence</span>
          <span className="font-mono">{rec.confidence}%</span>
        </div>
        <div role="meter" aria-labelledby="confidence-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rec.confidence} className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${rec.confidence}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          Scores — {Object.entries(rec.scores).map(([id, s]) => `${PLATFORMS[id as keyof typeof PLATFORMS].name}: ${s}`).join(" · ")}
        </p>
      </div>

      {rec.escalation.level === "required" && (
        <div role="alert" className="rounded-lg border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Production escalation required</p>
          <p className="mt-1">{rec.escalation.warning}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">Escalate-to-production checklist ({rec.escalation.checklist.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {rec.escalation.checklist.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </details>
        </div>
      )}

      {rec.triggers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">v0 triggers</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rec.triggers.map((t) => <Badge key={t.id} tone="accent" title={t.detail}>{t.label}</Badge>)}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">Why</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {rec.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Execution / sandbox limitations — {primary.name}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {rec.limitations.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Best initial output</dt>
          <dd className="text-muted">{rec.bestInitialOutput}</dd>
        </div>
        <div>
          <dt className="font-semibold">Best export / handoff format</dt>
          <dd className="text-muted">{rec.bestExportFormat}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-semibold">Suggested workflow</h3>
        <ol className="mt-2 space-y-2 text-sm">
          {rec.handoffSteps.map((s) => (
            <li key={s.step} className="flex gap-3">
              <span className="font-mono text-xs text-muted">{s.step}.</span>
              <span>
                {s.platform === "github" || s.platform === "vercel" ? <Badge>{s.platform}</Badge> : <PlatformBadge platform={s.platform} />}{" "}
                {s.action}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
