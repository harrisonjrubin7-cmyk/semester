/**
 * A syllabus shared into the app from somewhere else on the phone.
 *
 * Getting a syllabus in used to be six steps: open Brightspace, download the
 * PDF, find it in Files, open Semester, tap Import, tap Choose file, find it
 * again. Six steps for the app's single most important action and the first
 * one a new student ever takes.
 *
 * A share target collapses it to two. The PDF is open in Brightspace or in
 * Mail, you tap Share, Semester is in the list, and the file arrives in the
 * importer already loaded.
 *
 * ## Why a cache and not a query string
 *
 * The share arrives as a POST with the file in a multipart body. A service
 * worker cannot hand a `File` to a page directly and a URL cannot carry
 * megabytes, so the worker stashes the body in the Cache API under a known
 * key and redirects to a plain GET; the page picks it up from there and
 * deletes it. See `public/sw.js`.
 *
 * The same channel carries a file opened *with* the app — `file_handlers` in
 * the manifest — which arrives through the launch queue rather than a POST
 * but wants to end up in exactly the same place.
 */

/** Where the worker leaves a shared file, and where the page looks for it. */
export const SHARE_CACHE = 'semester-shared';
export const SHARE_KEY = './__shared';

/** The marker the worker redirects with, so the page knows to look. */
export const SHARE_FLAG = 'shared';

/** Whether this load was a share, without touching the cache. */
export function arrivedByShare(): boolean {
  try {
    return new URLSearchParams(window.location.search).get(SHARE_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Take the shared file, if there is one.
 *
 * Deletes as it reads: a share is a one-time hand-off, and a file left in the
 * cache would arrive again on the next launch as a mystery.
 */
export async function takeShared(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(SHARE_CACHE);
    const hit = await cache.match(SHARE_KEY);
    if (!hit) return [];
    const name = hit.headers.get('x-shared-name') || 'shared';
    const type = hit.headers.get('x-shared-type') || 'application/octet-stream';
    const blob = await hit.blob();
    await cache.delete(SHARE_KEY);
    if (blob.size === 0) return [];
    return [new File([blob], name, { type })];
  } catch {
    // A browser with no Cache API, or a private window. The importer's own
    // file picker still works, which is the whole fallback needed.
    return [];
  }
}

/**
 * Clear the marker out of the address bar.
 *
 * Without this a reload re-runs the share, finds an empty cache, and lands
 * you on the importer for no reason.
 */
export function forgetShare(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SHARE_FLAG)) return;
    url.searchParams.delete(SHARE_FLAG);
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* no history to rewrite */
  }
}
