import { useCallback, useEffect, useState } from 'react';
import { getLabData, GetLabDataOutputType } from 'zitejs/api';
import { toast } from 'sonner';

export type LabData = GetLabDataOutputType;

export function useLabData() {
  const [data, setData] = useState<LabData | null>(null);
  const reload = useCallback(async () => {
    try { setData(await getLabData({})); } catch (e) { toast.error('Could not load lab data'); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}
