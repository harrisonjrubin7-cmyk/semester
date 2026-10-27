import { useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { appDirectory } from 'zitejs/api';
import { appLink, type AppKey } from '../lib/appDirectoryRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
// One switcher in every Semester app: the same account opens each of them. Shown only to signed-in people; the list comes
// from the server (lib/appDirectoryRules.ts). Company staff can set each app's address here.
export function AppSwitcher({ current }: { current: AppKey }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<any>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const load = () => appDirectory({ action: 'get', current } as never).then((r: any) => { setD(r); setErr(''); }).catch(() => setD(null));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if ((e as KeyboardEvent).key === 'Escape' || ((e as MouseEvent).target && !ref.current?.contains((e as MouseEvent).target as Node))) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  if (!d) return null;
  const save = async (app: string) => {
    try { await appDirectory({ action: 'setUrl', app, url: draft[app]?.trim() || null } as never); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
  };
  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 text-sm print:hidden">
      {open && <div role="dialog" aria-label="Semester apps" className="mb-2 max-h-[70vh] w-80 overflow-auto rounded-md border border-border bg-card p-3 shadow-lg">
        <p className="mb-2 text-xs text-muted-foreground">One account works in every Semester app.</p>
        {d.apps.filter((a: any) => a.visible).map((a: any) => { const href = appLink(a.url);
          return <div key={a.key} className="border-b border-border py-2 last:border-0">
            {a.current ? <p className="font-medium">{a.name} <span className="text-xs text-muted-foreground">(you are here)</span></p>
              : href ? <a className="font-medium underline-offset-2 hover:underline" href={href}>{a.name}</a> : <p className="font-medium">{a.name} <span className="text-xs text-muted-foreground">(address not set yet)</span></p>}
            <p className="text-xs text-muted-foreground">{a.purpose}</p>
          </div>; })}
        {d.canSetUrls && <details className="mt-2"><summary className="cursor-pointer text-xs">App addresses (company staff)</summary>
          {d.apps.map((a: any) => <div key={a.key} className="mt-1 flex gap-1"><input aria-label={`${a.name} address`} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
            placeholder="https://…" defaultValue={a.url ?? ''} onChange={(e) => setDraft({ ...draft, [a.key]: e.target.value })} />
            <button type="button" className="rounded-md border border-border px-2 text-xs" onClick={() => save(a.key)}>Save</button></div>)}
          {err && <p role="alert" className="mt-1 text-xs">! {err}</p>}</details>}
      </div>}
      <button type="button" aria-expanded={open} aria-label="Semester apps" onClick={() => setOpen(!open)} className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 shadow-md">
        <LayoutGrid className="h-4 w-4" aria-hidden /> Apps
      </button>
    </div>
  );
}
