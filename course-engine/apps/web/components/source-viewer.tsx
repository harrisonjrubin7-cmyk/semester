"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileSearch, X } from "lucide-react";
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

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function SourceViewer({ fileId, filename, onClose }: { fileId: string; filename: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const source = useQuery({ queryKey: ["source-view", fileId], queryFn: () => api<SourceView>(`/files/${fileId}/source-view`) });

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
          <div className="mt-6 space-y-3">
            {source.data.chunks.map((chunk) => <article className="panel p-5" key={chunk.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="mono text-xs font-semibold text-[color:var(--semester-700)]">{formatSourceLocation(chunk)}</p><span className="muted text-xs">{Math.round(chunk.confidence * 100)}% extraction confidence</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{chunk.content}</p></article>)}
            {!source.data.chunks.length ? <div className="panel p-6 text-center"><FileSearch aria-hidden="true" className="mx-auto text-[color:var(--text-secondary)]" /><h3 className="mt-3 font-semibold">No extracted text yet</h3><p className="muted mt-2 text-sm">The original is preserved. Processing may still be underway or the file may need review.</p></div> : null}
          </div>
          {source.data.has_more ? <p className="muted mt-4 text-center text-xs">Showing the first {source.data.chunks.length} of {source.data.total} sections.</p> : null}
        </div> : null}
      </div>
    </section>
  </div>;
}
