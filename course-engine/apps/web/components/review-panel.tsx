"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileCheck2, PencilLine, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { SourceStatusBadge } from "./source-status";
import { EmptyState } from "./workspace-states";
import type { Review } from "./workspace-types";

function ReviewCard({ courseId, review }: { courseId: string; review: Review }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [correction, setCorrection] = useState(JSON.stringify(review.payload, null, 2));
  const [note, setNote] = useState(review.resolution_note ?? "");
  const [validationError, setValidationError] = useState("");
  const mutation = useMutation({
    mutationFn: (payload: { status: "confirmed" | "rejected"; resolution_note?: string; corrected_payload?: Record<string, unknown> }) => api<Review>(`/review-items/${review.id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reviews", courseId] }),
        client.invalidateQueries({ queryKey: ["course", courseId] }),
      ]);
    },
  });

  function resolve(status: "confirmed" | "rejected", includeCorrection = false) {
    setValidationError("");
    let correctedPayload: Record<string, unknown> | undefined;
    if (includeCorrection) {
      try {
        const parsed: unknown = JSON.parse(correction);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Correction must be a JSON object.");
        correctedPayload = parsed as Record<string, unknown>;
      } catch (error) {
        setValidationError(error instanceof Error ? error.message : "Correction must be valid JSON.");
        return;
      }
    }
    mutation.mutate({ status, resolution_note: note.trim() || undefined, corrected_payload: correctedPayload });
  }

  return <article className="panel p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="flex gap-3"><FileCheck2 aria-hidden="true" className="mt-1 text-[color:var(--semester-700)]" size={18} /><div><p className="eyebrow">{review.item_type.replaceAll("_", " ")}</p><h2 className="mt-2 font-semibold">{review.title}</h2></div></div><SourceStatusBadge status={review.status} /></div>
    <details className="mt-5 border-t border-[color:var(--border-default)] pt-4"><summary className="cursor-pointer text-sm font-medium">Inspect extracted details</summary><pre className="mt-4 overflow-auto rounded bg-[color:var(--surface-canvas)] p-4 text-xs text-[color:var(--text-secondary)]">{JSON.stringify(review.payload, null, 2)}</pre></details>
    {editing ? <div className="mt-5 grid gap-3 border-t border-[color:var(--border-default)] pt-5"><label className="grid gap-2 text-sm font-medium" htmlFor={`correction-${review.id}`}>Corrected details<textarea className="min-h-40 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-3 font-[family-name:var(--font-mono)] text-xs" id={`correction-${review.id}`} onChange={(event) => setCorrection(event.target.value)} spellCheck={false} value={correction} /></label><label className="grid gap-2 text-sm font-medium" htmlFor={`note-${review.id}`}>Decision note <span className="muted font-normal">(optional)</span><textarea className="min-h-20 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-3 text-sm" id={`note-${review.id}`} onChange={(event) => setNote(event.target.value)} value={note} /></label>{validationError ? <p className="text-sm text-[color:var(--danger)]" role="alert">{validationError}</p> : null}<p className="muted text-xs">This records the reviewed payload and decision. It does not silently rewrite the preserved source file.</p><div className="flex flex-wrap gap-2"><button className="button button-primary" disabled={mutation.isPending} onClick={() => resolve("confirmed", true)} type="button"><Check aria-hidden="true" size={16} />Save correction and confirm</button><button className="button button-secondary" disabled={mutation.isPending} onClick={() => setEditing(false)} type="button">Cancel</button></div></div> : <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--border-default)] pt-5"><button className="button button-primary" disabled={mutation.isPending || review.status === "confirmed"} onClick={() => resolve("confirmed")} type="button"><Check aria-hidden="true" size={16} />Confirm extracted details</button><button className="button button-secondary" disabled={mutation.isPending} onClick={() => setEditing(true)} type="button"><PencilLine aria-hidden="true" size={16} />Correct details</button><button className="button button-secondary" disabled={mutation.isPending || review.status === "rejected"} onClick={() => resolve("rejected")} type="button"><X aria-hidden="true" size={16} />Reject</button></div>}
    {mutation.isError ? <p className="mt-3 text-sm text-[color:var(--danger)]" role="alert">{mutation.error instanceof Error ? mutation.error.message : "The review decision could not be saved."}</p> : null}
    {mutation.isPending ? <p aria-live="polite" className="muted mt-3 text-xs">Saving review decision…</p> : null}
  </article>;
}

export function ReviewPanel({ courseId, reviews }: { courseId: string; reviews: Review[] }) {
  if (!reviews.length) return <EmptyState detail="Low-confidence extraction, conflicting dates, unsupported files, and unreadable text will appear here." title="Review queue is clear" />;
  return <section className="grid gap-4">{reviews.map((review) => <ReviewCard courseId={courseId} key={review.id} review={review} />)}</section>;
}
