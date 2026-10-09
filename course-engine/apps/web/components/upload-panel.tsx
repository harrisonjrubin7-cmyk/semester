"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Files } from "lucide-react";
import { useRef, useState } from "react";
import { api, API, token } from "@/lib/api";
import { SourceStatusBadge } from "./source-status";
import type { SourceFile } from "./workspace-types";

type UploadState = { id: string; name: string; status: string; failed?: boolean };

export function UploadPanel({ courseId, files, offline }: { courseId: string; files: SourceFile[]; offline: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [uploads, setUploads] = useState<UploadState[]>([]);

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
        await api(`/courses/${courseId}/uploads/complete`, { method: "POST", body: JSON.stringify({ document_id: init.document_id }) });
        update(id, "Queued for extraction");
      } catch (error) {
        update(id, error instanceof Error ? error.message : "Upload failed", true);
      }
    }
    await client.invalidateQueries({ queryKey: ["files", courseId] });
  }

  return <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
    <div>
      <div className="panel grid min-h-72 place-items-center border-dashed p-8 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
        <div><FileUp aria-hidden="true" className="mx-auto text-[color:var(--semester-700)]" size={34} /><h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-semibold">Add course materials</h2><p className="muted reading-width mt-2 text-sm">PDF, Office, text, spreadsheet, image, EPUB, ZIP, audio, or video. Unsupported and protected files move to Review; they are never silently ignored.</p><input className="sr-only" disabled={offline} id="source-files" multiple onChange={(event) => void upload(event.target.files)} ref={input} type="file" /><button className="button button-primary mt-5" disabled={offline} onClick={() => input.current?.click()} type="button">Choose files</button>{offline ? <p className="muted mt-3 text-xs">Reconnect before uploading. Existing local work remains unchanged.</p> : null}</div>
      </div>
      <div aria-live="polite" className="mt-4 space-y-2">
        {uploads.map((item) => <div className="panel flex items-center justify-between gap-4 p-3 text-sm" key={item.id}><span className="min-w-0 truncate">{item.name}</span><span className={item.failed ? "text-[color:var(--danger)]" : "muted"}>{item.status}</span></div>)}
        {files.map((file) => <div className="panel flex items-center justify-between gap-4 p-3 text-sm" key={file.id}><div className="min-w-0"><span className="block truncate">{file.filename}</span><span className="muted text-xs">{file.classification} · {(file.size_bytes / 1024).toFixed(1)} KB</span></div><SourceStatusBadge status={file.status} /></div>)}
        {!uploads.length && !files.length ? <p className="muted p-4 text-sm">No source files have been added.</p> : null}
      </div>
    </div>
    <aside className="panel h-fit p-6"><p className="eyebrow">Processing contract</p><ol className="mt-4 space-y-4 text-sm">{["Verify actual file type, size, and checksum", "Preserve the original file", "Extract page, slide, cell, or timestamp chunks", "Create citations and route uncertainty to Review", "Publish only supported course knowledge"].map((item, index) => <li className="flex gap-3" key={item}><span aria-hidden="true" className="mono text-[color:var(--semester-700)]">0{index + 1}</span><span>{item}</span></li>)}</ol><div className="mt-6 border-t border-[color:var(--border-default)] pt-5"><p className="flex items-center gap-2 text-sm font-medium"><Files aria-hidden="true" size={17} /> Source authority</p><p className="muted mt-2 text-xs">An upload is student-provided until an institutional connection verifies it.</p></div></aside>
  </section>;
}
