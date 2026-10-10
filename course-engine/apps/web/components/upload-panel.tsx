"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Files, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { api, API, token } from "@/lib/api";
import { SourceStatusBadge } from "./source-status";
import { SourceViewer } from "./source-viewer";
import type { BackgroundJob, SourceFile } from "./workspace-types";

type UploadState = { id: string; name: string; status: string; failed?: boolean };

export function UploadPanel({ courseId, files, jobs, offline }: { courseId: string; files: SourceFile[]; jobs: BackgroundJob[]; offline: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [selectedFile, setSelectedFile] = useState<SourceFile | null>(null);
  const [actingJob, setActingJob] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const closeSourceViewer = useCallback(() => setSelectedFile(null), []);

  function update(id: string, status: string, failed = false) {
    setUploads((current) => current.map((item) => item.id === id ? { ...item, status, failed } : item));
  }

  async function upload(selected: FileList | null) {
    if (!selected || offline) return;
    for (const file of Array.from(selected)) {
      const id = crypto.randomUUID();
      setUploads((current) => [...current, { id, name: file.name, status: "Checking file" }]);
      try {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const sha256 = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
        update(id, "Uploading original");
        const init = await api<{ document_id: string; upload_url: string; upload_headers: Record<string, string> }>(`/courses/${courseId}/uploads/initiate`, { method: "POST", body: JSON.stringify({ filename: file.name, size_bytes: file.size, mime_type: file.type || "application/octet-stream", sha256 }) });
        const target = init.upload_url.startsWith("http") ? init.upload_url : `${new URL(API).origin}${init.upload_url}`;
        const response = await fetch(target, { method: "PUT", body: file, headers: { Authorization: `Bearer ${token()}`, ...init.upload_headers } });
        if (!response.ok) throw new Error(await response.text());
        const completed = await api<{ document: SourceFile; job: BackgroundJob }>(`/courses/${courseId}/uploads/complete`, { method: "POST", body: JSON.stringify({ document_id: init.document_id }) });
        client.setQueryData<BackgroundJob[]>(["jobs", courseId], (current = []) => [completed.job, ...current.filter((job) => job.id !== completed.job.id)]);
        setUploads((current) => current.filter((item) => item.id !== id));
      } catch (error) {
        update(id, error instanceof Error ? error.message : "Upload failed", true);
      }
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: ["files", courseId] }),
      client.invalidateQueries({ queryKey: ["jobs", courseId] }),
      client.invalidateQueries({ queryKey: ["course", courseId] }),
    ]);
  }

  async function refreshAfterJobAction() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["jobs", courseId] }),
      client.invalidateQueries({ queryKey: ["files", courseId] }),
      client.invalidateQueries({ queryKey: ["course", courseId] }),
    ]);
  }

  async function cancel(job: BackgroundJob) {
    setActingJob(job.id);
    setActionError("");
    try {
      await api(`/jobs/${job.id}/cancel`, { method: "POST" });
      await refreshAfterJobAction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not cancel extraction");
    } finally {
      setActingJob(null);
    }
  }

  async function retry(file: SourceFile) {
    setActingJob(file.id);
    setActionError("");
    try {
      const replacement = await api<BackgroundJob>(`/files/${file.id}/retry-extraction`, { method: "POST" });
      client.setQueryData<BackgroundJob[]>(["jobs", courseId], (current = []) => [replacement, ...current]);
      await refreshAfterJobAction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not retry extraction");
    } finally {
      setActingJob(null);
    }
  }

  function jobStatus(job?: BackgroundJob) {
    if (!job) return null;
    if (job.status === "queued") return "Queued for extraction";
    if (job.status === "running") return `Extracting · ${job.progress}%`;
    if (job.status === "completed") return "Extraction complete";
    return job.error || "Extraction failed";
  }

  return <><section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
    <div>
      <div className="panel grid min-h-72 place-items-center border-dashed p-8 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
        <div><FileUp aria-hidden="true" className="mx-auto text-[color:var(--semester-700)]" size={34} /><h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-semibold">Add course materials</h2><p className="muted reading-width mt-2 text-sm">PDF, Office, text, spreadsheet, image, EPUB, ZIP, audio, or video. Unsupported and protected files move to Review; they are never silently ignored.</p><input className="sr-only" disabled={offline} id="source-files" multiple onChange={(event) => void upload(event.target.files)} ref={input} type="file" /><button className="button button-primary mt-5" disabled={offline} onClick={() => input.current?.click()} type="button">Choose files</button>{offline ? <p className="muted mt-3 text-xs">Reconnect before uploading. Existing local work remains unchanged.</p> : null}</div>
      </div>
      <div aria-live="polite" className="mt-4 space-y-2">
        {uploads.map((item) => <div className="panel flex items-center justify-between gap-4 p-3 text-sm" key={item.id}><span className="min-w-0 truncate">{item.name}</span><span className={item.failed ? "text-[color:var(--danger)]" : "muted"}>{item.status}</span></div>)}
        {files.map((file) => {
          const job = jobs.find((candidate) => candidate.document_id === file.id && candidate.job_type === "extract");
          const status = jobStatus(job);
          const active = job?.status === "queued" || job?.status === "running";
          return <div className="panel flex flex-wrap items-center justify-between gap-4 p-3 text-sm" key={file.id}><div className="min-w-0 flex-1"><span className="block truncate">{file.filename}</span><span className="muted text-xs">{file.classification} · {(file.size_bytes / 1024).toFixed(1)} KB</span>{status ? <span className={job?.status === "failed" ? "mt-1 block text-xs text-[color:var(--danger)]" : "muted mt-1 block text-xs"}>{status}</span> : null}</div><div className="flex flex-wrap items-center gap-2"><SourceStatusBadge status={file.status} />{active && job ? <button aria-label={`Cancel extraction for ${file.filename}`} className="button button-secondary min-h-9 px-3 py-2 text-xs" disabled={offline || actingJob === job.id} onClick={() => void cancel(job)} type="button"><XCircle aria-hidden="true" size={15} />Cancel</button> : null}{job?.status === "failed" ? <button aria-label={`Retry extraction for ${file.filename}`} className="button button-secondary min-h-9 px-3 py-2 text-xs" disabled={offline || actingJob === file.id} onClick={() => void retry(file)} type="button"><RotateCcw aria-hidden="true" size={15} />Retry</button> : null}<button className="button button-secondary min-h-9 px-3 py-2 text-xs" onClick={() => setSelectedFile(file)} type="button"><Eye aria-hidden="true" size={15} />View source</button></div></div>;
        })}
        {actionError ? <p className="text-sm text-[color:var(--danger)]" role="alert">{actionError}</p> : null}
        {!uploads.length && !files.length ? <p className="muted p-4 text-sm">No source files have been added.</p> : null}
      </div>
    </div>
    <aside className="panel h-fit p-6"><p className="eyebrow">Processing contract</p><ol className="mt-4 space-y-4 text-sm">{["Verify actual file type, size, and checksum", "Preserve the original file", "Extract page, slide, cell, or timestamp chunks", "Create citations and route uncertainty to Review", "Publish only supported course knowledge"].map((item, index) => <li className="flex gap-3" key={item}><span aria-hidden="true" className="mono text-[color:var(--semester-700)]">0{index + 1}</span><span>{item}</span></li>)}</ol><div className="mt-6 border-t border-[color:var(--border-default)] pt-5"><p className="flex items-center gap-2 text-sm font-medium"><Files aria-hidden="true" size={17} /> Source authority</p><p className="muted mt-2 text-xs">An upload is student-provided until an institutional connection verifies it.</p></div></aside>
  </section>{selectedFile ? <SourceViewer fileId={selectedFile.id} filename={selectedFile.filename} onClose={closeSourceViewer} /> : null}</>;
}
