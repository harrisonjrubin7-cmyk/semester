// Private file store rules (decision D2, 25 Oct). Pure, unit-tested in tests/fileRules.test.ts.
// The database re-enforces size, owner and grant rules (lib/filMigration.ts); these run first for clear messages.
export const MAX_BYTES = 4 * 1024 * 1024;
export const MIME_ALLOW: Record<string, string> = {
  'application/pdf': 'PDF', 'image/png': 'PNG image', 'image/jpeg': 'JPEG image', 'text/plain': 'Text', 'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint deck',
};
export const PURPOSES = ['personal', 'submission', 'evidence', 'shared'] as const;

/** Returns a refusal message, or null. `size` is the decoded byte length. */
export function checkUpload(name: string, mime: string, size: number): string | null {
  const n = name.trim();
  if (!n || n.length > 200) return 'Give the file a name of up to 200 characters.';
  if (/[\\/\u0000-\u001f]/.test(n)) return 'File names cannot contain slashes or control characters.';
  if (!MIME_ALLOW[mime]) return 'That file type is not accepted. Use PDF, an image, text, CSV or an Office document.';
  if (size <= 0) return 'The file is empty.';
  if (size > MAX_BYTES) return `Files can be up to ${MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Decodes base64 strictly; returns null for anything that is not clean base64. */
export function decodeBase64(b64: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return null;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type Grant = { grantee: string; expiresAt: string; revokedAt: string | null };
/** Owner, or a live grant (not revoked, not expired). Mirrors fil_can_read in SQL. */
export function canRead(f: { owner: string; deleted: boolean }, actor: string, grants: Grant[], now: Date): boolean {
  if (f.deleted) return false;
  if (f.owner === actor) return true;
  return grants.some((g) => g.grantee === actor && !g.revokedAt && new Date(g.expiresAt) > now);
}
