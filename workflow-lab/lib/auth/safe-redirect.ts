/** Accepts only same-origin relative paths, so ?next= cannot be used as an open redirect. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://localhost");
    if (u.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
