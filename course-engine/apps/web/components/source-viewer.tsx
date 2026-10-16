"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileSearch, PencilLine, ScanSearch, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, API, token } from "@/lib/api";
import { SourceStatusBadge } from "./source-status";
import type { SourceChunk, SourceView } from "./workspace-types";

export function formatSourceLocation(chunk: SourceChunk) {
  const locations = [];
  if (chunk.page_number) locations.push(`Page ${chunk.page_number}`);
  if (chunk.slide_number) locations.push(`Slide ${chunk.slide_number}`);
  if (chunk.sheet_name) locations.push(chunk.sheet_name);
  if (chunk.cell_range) locations.push(chunk.cell_range);
  if (typeof chunk.start_seconds === "number") {
    const end = typeof chunk.end_seconds === "number" ? `–${formatTimestamp(chunk.end_seconds)}` : "";
    locations.push(`${formatTimestamp(chunk.start_seconds)}${end}`);
  }
  return locations.join(" · ") || `Extract ${chunk.chunk_index + 1}`;
}

export function formatExtractionConfidence(confidence: number | null) {
  return confidence === null
    ? "Extraction confidence not measured"
    : `${Math.round(confidence * 100)}% extraction confidence`;
}

export function normalizedBoundingBoxStyle(box: NonNullable<SourceChunk["bounding_box"]>) {
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const percent = (value: number) => `${Math.round(value * 10000) / 100}%`;
  const x = clamp(box.x);
  const y = clamp(box.y);
  return {
    left: percent(x),
    top: percent(y),
    width: percent(Math.min(1 - x, clamp(box.width))),
    height: percent(Math.min(1 - y, clamp(box.height))),
  };
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function SourceViewer({ fileId, filename, onClose }: { fileId: string; filename: string; onClose: () => void }) {
  const client = useQueryClient();
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const source = useQuery({ queryKey: ["source-view", fileId], queryFn: () => api<SourceView>(`/files/${fileId}/source-view`) });
  const selectedChunk = source.data?.chunks.find((chunk) => chunk.id === selectedChunkId) ?? null;
  const correctionMutation = useMutation({
    mutationFn: ({ reviewItemId, content, note }: { reviewItemId: string; content: string; note: string }) => api(`/review-items/${reviewItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "confirmed",
        resolution_note: note,
        corrected_payload: { content },
      }),
    }),
    onSuccess: async () => {
      setEditingChunkId(null);
      setCorrection("");
      setCorrectionNote("");
      await Promise.all([
        source.refetch(),
        client.invalidateQueries({ queryKey: ["reviews"] }),
        client.invalidateQueries({ queryKey: ["course"] }),
      ]);
    },
  });

  useEffect(() => {
    if (selectedChunkId || !source.data) return;
    const firstLocatedChunk = source.data.chunks.find((chunk) => chunk.bounding_box && chunk.page_number);
    if (firstLocatedChunk) setSelectedChunkId(firstLocatedChunk.id);
  }, [selectedChunkId, source.data]);

  useEffect(() => {
    if (!selectedChunk?.bounding_box || !selectedChunk.page_number) {
      setPreviewUrl("");
      setPreviewError("");
      return;
    }
    const controller = new AbortController();
    let objectUrl = "";
    setPreviewUrl("");
    setPreviewError("");
    void fetch(`${API}/files/${fileId}/pages/${selectedChunk.page_number}/preview`, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.text()) || "Page preview unavailable");
      objectUrl = URL.createObjectURL(await response.blob());
      setPreviewUrl(objectUrl);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setPreviewError(error instanceof Error ? error.message : "Page preview unavailable");
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, selectedChunk?.bounding_box, selectedChunk?.page_number]);

  function beginCorrection(chunk: SourceChunk) {
    setEditingChunkId(chunk.id);
    setCorrection(chunk.content);
    setCorrectionNote("");
    correctionMutation.reset();
  }

  function submitCorrection(chunk: SourceChunk) {
    const content = correction.trim();
    const note = correctionNote.trim();
    if (!chunk.review_item_id || !content || !note) return;
    correctionMutation.mutate({ reviewItemId: chunk.review_item_id, content, note });
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = priorOverflow;
      previous?.focus();
    };
  }, [onClose]);

  async function downloadOriginal() {
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(`${API}/files/${fileId}/download`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) throw new Error((await response.text()) || "Download unavailable");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = source.data?.document.filename ?? filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download unavailable");
    } finally {
      setDownloading(false);
    }
  }

  return <div className="source-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-labelledby="source-viewer-title" aria-modal="true" className="source-viewer" ref={dialog} role="dialog">
      <header className="flex items-start justify-between gap-5 border-b border-[color:var(--border-default)] p-5 sm:p-6">
        <div className="min-w-0"><p className="eyebrow">Protected source</p><h2 className="mt-2 truncate font-[family-name:var(--font-heading)] text-2xl font-semibold" id="source-viewer-title">{filename}</h2><p className="muted mt-2 text-sm">Extracted text is shown with its original location. Only the course owner can open this view.</p></div>
        <button aria-label="Close source viewer" className="button button-secondary shrink-0 px-3" onClick={onClose} ref={closeButton} type="button"><X aria-hidden="true" size={18} /></button>
      </header>
      <div className="source-viewer-content">
        {source.isLoading ? <div aria-live="polite" className="space-y-3 p-6"><div className="skeleton h-6 w-40" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div> : null}
        {source.isError ? <div className="p-6" role="alert"><h3 className="font-semibold">Source could not be opened</h3><p className="muted mt-2 text-sm">{source.error instanceof Error ? source.error.message : "Try again."}</p><button className="button button-secondary mt-4" onClick={() => void source.refetch()} type="button">Try again</button></div> : null}
        {source.data ? <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><SourceStatusBadge status={source.data.document.status} /><span className="muted text-xs">{source.data.total} extracted section{source.data.total === 1 ? "" : "s"}</span></div><button className="button button-secondary" disabled={downloading} onClick={() => void downloadOriginal()} type="button"><Download aria-hidden="true" size={17} />{downloading ? "Preparing…" : "Download original"}</button></div>
          {downloadError ? <p className="mt-3 text-sm text-[color:var(--danger)]" role="alert">{downloadError}</p> : null}
          {selectedChunk?.bounding_box && selectedChunk.page_number ? <section aria-label={`Page ${selectedChunk.page_number} source preview`} className="panel mt-6 overflow-hidden p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="eyebrow">Exact source highlight</p><p className="mt-1 text-sm font-medium">Page {selectedChunk.page_number}</p></div><ScanSearch aria-hidden="true" className="text-[color:var(--semester-700)]" size={20} /></div>
            {previewUrl ? <div className="relative mx-auto max-w-3xl overflow-hidden rounded border border-[color:var(--border-strong)] bg-white"><img alt={`Page ${selectedChunk.page_number} of ${filename}`} className="block h-auto w-full" src={previewUrl} /><span aria-hidden="true" className="absolute border-2 border-[color:var(--semester-700)] bg-[color:var(--semester-100)]/40 shadow-[0_0_0_2px_rgba(255,255,255,0.75)]" data-testid="source-highlight" style={normalizedBoundingBoxStyle(selectedChunk.bounding_box)} /></div> : <div aria-live="polite" className="skeleton mx-auto aspect-[3/4] max-w-3xl" />}
            {previewError ? <p className="mt-3 text-sm text-[color:var(--danger)]" role="alert">{previewError}</p> : null}
          </section> : null}
          <div className="mt-6 space-y-3">
            {source.data.chunks.map((chunk) => <article className="panel p-5" key={chunk.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="mono text-xs font-semibold text-[color:var(--semester-700)]">{formatSourceLocation(chunk)}</p><span className="muted text-xs">{formatExtractionConfidence(chunk.confidence)}</span></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{chunk.content}</p>
              {editingChunkId === chunk.id ? <div className="mt-5 grid gap-3 border-t border-[color:var(--border-default)] pt-5">
                <label className="grid gap-2 text-sm font-medium" htmlFor={`source-correction-${chunk.id}`}>Corrected extraction<textarea className="min-h-32 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-3 text-sm" id={`source-correction-${chunk.id}`} onChange={(event) => setCorrection(event.target.value)} value={correction} /></label>
                <label className="grid gap-2 text-sm font-medium" htmlFor={`source-note-${chunk.id}`}>Decision note <span className="muted font-normal">(required)</span><textarea className="min-h-20 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-3 text-sm" id={`source-note-${chunk.id}`} onChange={(event) => setCorrectionNote(event.target.value)} value={correctionNote} /></label>
                <p className="muted text-xs">The correction updates reviewed extracted evidence and dependent citations. The preserved source file is never rewritten.</p>
                <div className="flex flex-wrap gap-2"><button className="button button-primary" disabled={correctionMutation.isPending || !correction.trim() || !correctionNote.trim()} onClick={() => submitCorrection(chunk)} type="button"><Check aria-hidden="true" size={16} />Confirm correction</button><button className="button button-secondary" disabled={correctionMutation.isPending} onClick={() => setEditingChunkId(null)} type="button">Cancel</button></div>
                {correctionMutation.isError ? <p className="text-sm text-[color:var(--danger)]" role="alert">{correctionMutation.error instanceof Error ? correctionMutation.error.message : "Correction could not be saved."}</p> : null}
              </div> : <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--border-default)] pt-4">
                {chunk.bounding_box && chunk.page_number ? <button aria-pressed={selectedChunkId === chunk.id} className="button button-secondary" onClick={() => setSelectedChunkId(chunk.id)} type="button"><ScanSearch aria-hidden="true" size={16} />Show exact location</button> : null}
                <button className="button button-secondary" disabled={!chunk.review_item_id} onClick={() => beginCorrection(chunk)} type="button"><PencilLine aria-hidden="true" size={16} />Correct extraction</button>
              </div>}
            </article>)}
            {!source.data.chunks.length ? <div className="panel p-6 text-center"><FileSearch aria-hidden="true" className="mx-auto text-[color:var(--text-secondary)]" /><h3 className="mt-3 font-semibold">No extracted text yet</h3><p className="muted mt-2 text-sm">The original is preserved. Processing may still be underway or the file may need review.</p></div> : null}
          </div>
          {source.data.has_more ? <p className="muted mt-4 text-center text-xs">Showing the first {source.data.chunks.length} of {source.data.total} sections.</p> : null}
        </div> : null}
      </div>
    </section>
  </div>;
}
