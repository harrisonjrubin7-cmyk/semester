// Freshness states for loaded data (context/06-system-design.md: every view shows loading, empty, error,
// stale, and permission states). 'stale' is a display state, never a failure: the last good data stays on
// screen, labelled with when it was loaded, and a failed refresh never replaces it with an error panel.
export const STALE_AFTER_MS = 5 * 60 * 1000;

export type Freshness = 'fresh' | 'stale' | 'unknown';

/** How to describe data loaded at `loadedAtMs` as of `nowMs`. Nothing loaded yet (or a broken clock) is
 *  'unknown': the page shows its loading state, not a staleness claim. Exactly at the threshold is stale. */
export function freshnessOf(loadedAtMs: number | null, nowMs: number, staleAfterMs: number = STALE_AFTER_MS): Freshness {
  if (loadedAtMs == null || !Number.isFinite(loadedAtMs) || !Number.isFinite(nowMs)) return 'unknown';
  if (nowMs < loadedAtMs) return 'fresh';
  return nowMs - loadedAtMs >= staleAfterMs ? 'stale' : 'fresh';
}

/** Where a load failure belongs: with nothing on screen it is the page error; with data already shown it is
 *  a refresh error, and the data stays. Decided here so every page behaves the same way. */
export function routeLoadError(hasData: boolean, message: string): { error: string | null; refreshError: string | null } {
  return hasData ? { error: null, refreshError: message } : { error: message, refreshError: null };
}
