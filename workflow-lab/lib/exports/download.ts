/** Shared helpers for download responses and client-side downloads. */
export const EXPORT_TYPES = {
  md: { mime: "text/markdown; charset=utf-8", ext: "md" },
  json: { mime: "application/json; charset=utf-8", ext: "json" },
  csv: { mime: "text/csv; charset=utf-8", ext: "csv" },
} as const;
export type ExportFormat = keyof typeof EXPORT_TYPES;

export function safeFilename(base: string): string {
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").replace(/\.{2,}/g, ".").slice(0, 80) || "export";
}

export function downloadResponse(body: string, format: ExportFormat, baseName: string): Response {
  return new Response(body, {
    headers: {
      "content-type": EXPORT_TYPES[format].mime,
      "content-disposition": `attachment; filename="${safeFilename(baseName)}.${EXPORT_TYPES[format].ext}"`,
      "cache-control": "no-store",
    },
  });
}

export function jsonError(status: number, message: string, details?: unknown): Response {
  return Response.json({ error: { message, details } }, { status, headers: { "cache-control": "no-store" } });
}
