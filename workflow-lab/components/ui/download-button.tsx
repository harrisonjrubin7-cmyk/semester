"use client";

/** Client-side download of text the page already holds (no server round trip). */
export function DownloadButton({ filename, mime, getText, label, className = "" }: {
  filename: string;
  mime: string;
  getText: () => string;
  label: string;
  className?: string;
}) {
  function download() {
    const blob = new Blob([getText()], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" onClick={download} className={`inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2 ${className}`}>
      {label}
    </button>
  );
}
