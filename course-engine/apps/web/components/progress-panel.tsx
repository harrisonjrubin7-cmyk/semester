import { SourceStatusBadge } from "./source-status";
import { EmptyState } from "./workspace-states";
import type { Progress } from "./workspace-types";

export function ProgressPanel({ progress }: { progress?: Progress }) {
  if (!progress?.items.length) return <EmptyState detail="Complete a cited card or quiz session to begin measuring concepts. No score is inferred from unfinished work." title="No learning evidence yet" />;
  return <section className="grid gap-5 lg:grid-cols-[0.65fr_1.35fr]"><article className="panel p-6"><p className="eyebrow">Concept mastery</p><p className="mono mt-4 text-4xl font-semibold">{Math.round(progress.average_mastery * 100)}%</p><p className="muted mt-2 text-sm">Based only on recorded answers; this is not an official grade.</p><div className="mt-5"><SourceStatusBadge status="estimated" /></div></article><article className="panel overflow-hidden"><header className="border-b border-[color:var(--border-default)] p-6"><h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Recent concept evidence</h2></header><div className="divide-y divide-[color:var(--border-default)]">{progress.items.map((item) => <div className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]" key={item.id}><div><p className="font-medium">Concept record</p><p className="muted text-xs">{item.correct_attempts} correct of {item.attempts} attempts</p></div><p className="mono">{Math.round(item.mastery_score * 100)}%</p></div>)}</div></article></section>;
}
