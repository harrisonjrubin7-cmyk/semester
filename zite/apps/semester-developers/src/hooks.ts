import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from './util';

export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => { fn().then((d) => { setData(d); setError(''); }).catch((e) => setError(errorMessage(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

export async function act<T>(fn: () => Promise<T>, after: (r: T) => void) {
  try { const r = await fn(); after(r); } catch (e) { toast.error(errorMessage(e)); }
}
