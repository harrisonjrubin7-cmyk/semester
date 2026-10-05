'use client';
import { PLATFORM_LABEL } from '@/lib/benchmark/benchmark.config';
import type { Recommendation } from '@/lib/workflow-router/engine';
export function RecommendationPanel({ r }: { r: Recommendation }) {
  return (<section aria-labelledby="rec-h" className="rounded-md border border-neutral-300 bg-white p-5">
    <p className="text-xs uppercase tracking-wider text-neutral-600">Recommendation · confidence {Math.round(r.confidence * 100)}%</p>
    <h2 id="rec-h" className="mt-1 text-2xl font-semibold">{PLATFORM_LABEL[r.primary]} <span className="text-base font-normal text-neutral-600">then {PLATFORM_LABEL[r.secondary]}</span></h2>
    {r.escalation && <p role="status" className="mt-3 rounded border border-amber-600/50 bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>! Production escalation:</strong> {r.escalationReasons.join('; ')}</p>}
    <h3 className="mt-4 text-sm font-semibold">Why</h3><ul className="mt-1 list-disc pl-5 text-sm">{r.reasons[r.primary].map((x) => <li key={x}>{x}</li>)}</ul>
    <h3 className="mt-4 text-sm font-semibold">Limitations</h3><ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">{r.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
    <p className="mt-4 text-sm"><strong>Handoff:</strong> {r.handoffFormat}</p>
    <div className="mt-3 flex gap-3 text-xs text-neutral-600 tabular-nums">{Object.entries(r.scores).map(([p, s]) => <span key={p}>{PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL]} {s}</span>)}</div>
  </section>);
}
