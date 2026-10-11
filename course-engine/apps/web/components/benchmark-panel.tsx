"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { api } from "@/lib/api";
import { LoadingState } from "./workspace-states";

export function BenchmarkPanel() {
  const query = useQuery({ queryKey: ["benchmarks"], queryFn: () => api<{ summary: Array<Record<string, number | string>> }>("/benchmarks/latest") });
  if (query.isLoading) return <LoadingState />;
  const rows = query.data?.summary ?? [];
  return <section className="panel p-6"><div className="flex items-center gap-3"><FlaskConical aria-hidden="true" className="text-[color:var(--semester-700)]" /><div><p className="eyebrow">Document rendering lab</p><h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold">100-page benchmark</h2></div></div>{!rows.length ? <p className="muted mt-8 text-sm">No benchmark has run. The dashboard does not invent measurements.</p> : <div className="mt-6 grid gap-4 md:grid-cols-3">{rows.map((row, index) => <article className="rounded border border-[color:var(--border-default)] p-4" key={index}><h3 className="font-semibold">{String(row.renderer)}</h3><dl className="muted mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Median time</dt><dd className="mono">{row.median_render_ms} ms</dd></div><div className="flex justify-between gap-3"><dt>Peak RSS</dt><dd className="mono">{row.median_peak_rss_mb} MB</dd></div><div className="flex justify-between gap-3"><dt>Success</dt><dd className="mono">{row.success_rate}%</dd></div></dl></article>)}</div>}</section>;
}
