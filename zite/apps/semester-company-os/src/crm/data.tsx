import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { companyData, companyMutate, CompanyDataOutputType, CompanyMutateInputType } from 'zitejs/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rows = { [K in keyof CompanyDataOutputType]: Record<string, any>[] };
type Ctx = {
  data: Rows | null;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (i: CompanyMutateInputType, ok?: string) => Promise<boolean>;
};
const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Rows | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setData((await companyData({})) as unknown as Rows); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load data.'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const mutate = useCallback(async (i: CompanyMutateInputType, ok?: string) => {
    try {
      const r = await companyMutate(i);
      if (ok) toast.success(ok);
      r.notes.forEach((n) => toast(n));
      await refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Change was not saved.');
      return false;
    }
  }, [refresh]);
  return <DataCtx.Provider value={{ data, error, refresh, mutate }}>{children}</DataCtx.Provider>;
}

export const useData = () => {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData outside provider');
  return c;
};
