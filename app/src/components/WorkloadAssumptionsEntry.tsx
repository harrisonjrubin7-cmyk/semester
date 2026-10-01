import type { NativeAssumptionRequest } from './AssumptionEditor';
import { lazy, Suspense, useState } from 'react';
const Editor = lazy(() => import('./WorkloadAssumptions').then(m => ({ default: m.WorkloadAssumptions })));
export function WorkloadAssumptionsEntry() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Course and time assumptions</button>
    {open && <Suspense fallback={<p role="status">Loading assumptions…</p>}><Editor /></Suspense>}
  </>;
}


export function useNativeWorkload(scope: string) {
  const [request, setRequest] = useState<(NativeAssumptionRequest & { scope: string }) | null>(null);
  const [previousScope, setPreviousScope] = useState(scope);
  if (scope !== previousScope) { setPreviousScope(scope); setRequest(null); }
  const visible = request?.scope === scope ? request : null;
  return {
    edit: (id: string, value: string) => setRequest(old => ({ id, value, scope, token: (old?.token ?? 0) + 1 })),
    editor: visible ? <Suspense fallback={<p role="status">Loading assumption preview…</p>}><Editor key={visible.token} request={visible} onClose={() => setRequest(null)} /></Suspense> : null,
  };
}
