import { FileCheck2 } from "lucide-react";
import { EmptyState } from "./workspace-states";
import { SourceStatusBadge } from "./source-status";
import type { Review } from "./workspace-types";

export function ReviewPanel({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <EmptyState detail="Low-confidence extraction, conflicting dates, unsupported files, and unreadable text will appear here." title="Review queue is clear" />;
  return <section className="grid gap-4">{reviews.map((review) => <article className="panel p-5" key={review.id}><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="flex gap-3"><FileCheck2 aria-hidden="true" className="mt-1 text-[color:var(--semester-700)]" size={18} /><div><p className="eyebrow">{review.item_type.replaceAll("_", " ")}</p><h2 className="mt-2 font-semibold">{review.title}</h2></div></div><SourceStatusBadge status={review.status} /></div><details className="mt-5 border-t border-[color:var(--border-default)] pt-4"><summary className="cursor-pointer text-sm font-medium">Inspect extracted details</summary><pre className="mt-4 overflow-auto rounded bg-[color:var(--surface-canvas)] p-4 text-xs text-[color:var(--text-secondary)]">{JSON.stringify(review.payload, null, 2)}</pre></details></article>)}</section>;
}
