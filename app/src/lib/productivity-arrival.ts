const KEY = 'semester.browser-capture.pending';
export function incomingCapture(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function retainIncomingCapture(): void {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.split('?')[1] || '');
  const raw =
    hash.get('semesterCapture') || url.searchParams.get('semesterCapture');
  if (!raw) return;
  if (raw.length <= 10000) {
    try {
      sessionStorage.setItem(KEY, raw);
    } catch {
      /* The review is unavailable when session storage is blocked. */
    }
  }
  url.searchParams.delete('semesterCapture');
  url.hash = '#pathway';
  history.replaceState(null, '', url.href);
}
export function discardIncomingCapture(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing was retained. */
  }
}
