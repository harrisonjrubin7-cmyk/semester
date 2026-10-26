import { useCallback, useEffect, useState } from 'react';

export const errMsg = (e: unknown) =>
  (e as { userFacingMessage?: string })?.userFacingMessage || (e instanceof Error ? e.message : 'Something went wrong.');

/** Loads data once and on demand; keeps the last good value while refreshing. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(null); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export const fmtDate = (s: string) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
