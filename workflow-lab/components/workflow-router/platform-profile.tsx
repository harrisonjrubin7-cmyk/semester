import { Badge } from "@/components/ui/badge";
import { FEATURE_COLUMNS, PLATFORMS, type PlatformId } from "@/lib/workflow-router/platforms";

export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" role="img" aria-label={`${level} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-2 w-3 rounded-sm ${n <= level ? "bg-accent" : "bg-surface-2 border border-line"}`} />
      ))}
    </span>
  );
}

export function PlatformProfile({ id }: { id: PlatformId }) {
  const p = PLATFORMS[id];
  return (
    <div className="space-y-5">
      <p className="text-sm">{p.primaryUse}</p>
      <section>
        <h3 className="text-sm font-semibold">Execution model</h3>
        <p className="mt-1 text-sm text-muted">{p.executionModel}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Sandbox limits</h3>
        <p className="mt-1 text-sm text-muted">{p.sandboxLimits}</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Strengths</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{p.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Boundaries</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{p.boundaries.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Export formats</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">{p.exportFormats.map((f) => <Badge key={f}>{f}</Badge>)}</div>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Capabilities</h3>
        <dl className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
          {FEATURE_COLUMNS.filter((c) => c.kind === "level").map((c) => {
            const v = c.read(p);
            return (
              <div key={c.key} className="grid grid-cols-[10rem_1fr] gap-3 px-3 py-2">
                <dt className="font-medium">{c.label}</dt>
                <dd className="space-y-0.5"><LevelMeter level={Number(v.sort)} /><div className="text-muted">{v.text}</div></dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Best Semester use</h3>
        <p className="mt-1 text-sm text-muted">{p.bestSemesterUse}</p>
      </section>
    </div>
  );
}
