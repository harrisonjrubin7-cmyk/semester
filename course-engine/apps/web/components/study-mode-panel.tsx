import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { studyAssetTypes } from "./navigation";
import { SourceStatusBadge } from "./source-status";
import { EmptyState } from "./workspace-states";
import type { Asset } from "./workspace-types";

export function StudyModePanel({ assets, courseId, mode }: { assets: Asset[]; courseId: string; mode: string }) {
  const selected = assets.filter((asset) => (studyAssetTypes[mode] ?? []).includes(asset.asset_type));
  if (!selected.length) return <EmptyState action={<Link className="button button-primary no-underline" href={`/courses/${courseId}/uploads`}>Choose sources</Link>} detail="Select a unit with enough confirmed material or add the source documents needed to generate an honest draft." title={`No ${mode.replaceAll("-", " ")} asset yet`} />;
  return <section className="grid gap-4 lg:grid-cols-2">{selected.map((asset) => <article className="panel panel-interactive p-5" key={asset.id}><div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">{asset.asset_type.replaceAll("_", " ")}</p><SourceStatusBadge detail="Generated study assets remain AI-assisted until a student reviews them." status={asset.status === "confirmed" ? "ai_assisted" : asset.status} /></div><h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-semibold">{asset.title}</h2><p className="muted mt-2 text-sm">Versioned, source-linked record · updated <span className="mono">{new Date(asset.updated_at).toLocaleDateString()}</span></p><details className="mt-5 border-t border-[color:var(--border-default)] pt-4"><summary className="button button-primary cursor-pointer">Open material</summary><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-[color:var(--surface-canvas)] p-4 text-sm">{JSON.stringify(asset.content, null, 2)}</pre></details><Link className="button button-secondary mt-3 no-underline" href={`/courses/${courseId}/uploads`}><ExternalLink size={16} /> View source records</Link></article>)}</section>;
}
