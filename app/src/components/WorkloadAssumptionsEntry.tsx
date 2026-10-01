import { lazy, Suspense, useState } from 'react';
const Editor = lazy(() => import('./WorkloadAssumptions').then(m => ({ default: m.WorkloadAssumptions })));
export function WorkloadAssumptionsEntry() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Course and time assumptions</button>
    {open && <Suspense fallback={<p role="status">Loading assumptions…</p>}><Editor /></Suspense>}
  </>;
}
