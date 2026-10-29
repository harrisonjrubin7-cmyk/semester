import { ReactNode, useCallback, useEffect, useState } from 'react';
import { cn } from '@project/components/lib/utils';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => { setLoading(true); setError(null); fn().then(setData, (e) => setError(e instanceof Error ? e.message : 'Could not load this.')).finally(() => setLoading(false)); }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run };
}

export function Loadable<T>({ state, children }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; children: (d: T) => ReactNode }) {
  if (state.error) return <div role="alert" className="rounded-[3px] border border-destructive/40 bg-destructive/5 p-4 text-sm">! {friendly(state.error)} <button onClick={state.reload} className="ml-2 underline">Try again</button></div>;
  if (!state.data) return <p role="status" className="p-4 text-sm text-muted-foreground">Loading…</p>;
  return <>{children(state.data)}</>;
}

export function Header({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">{eyebrow}</p><h1 className="mt-1 text-3xl">{title}</h1>{sub && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sub}</p>}</div>
      {right}
    </header>
  );
}

export function Panel({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn('rounded-[3px] border border-border bg-card p-4', className)}>{title && <h2 className="mb-3 text-lg">{title}</h2>}{children}</section>;
}

export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="rounded-[3px] border border-border bg-card p-4"><p className="eyebrow">{label}</p><p className="font-display mt-1 text-3xl tabular-nums">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div>;
}

const TONE: Record<string, string> = {
  verified_in_test: 'border-[hsl(var(--chart-2))]/50 text-[hsl(var(--chart-2))]', pilot_enabled: 'border-primary/50 text-primary', production_operated: 'border-primary text-primary',
  implemented_unverified: 'border-[hsl(var(--chart-3))]/60 text-[hsl(var(--chart-3))]', specified: 'border-border text-muted-foreground', not_started: 'border-border text-muted-foreground',
  Open: 'border-destructive/50 text-destructive', Mitigating: 'border-[hsl(var(--chart-3))]/60 text-[hsl(var(--chart-3))]', Accepted: 'border-border text-muted-foreground', Closed: 'border-[hsl(var(--chart-2))]/50 text-[hsl(var(--chart-2))]',
  New: 'border-destructive/50 text-destructive', Contacted: 'border-primary/50 text-primary', Qualified: 'border-[hsl(var(--chart-2))]/50 text-[hsl(var(--chart-2))]',
  Estimate: 'border-[hsl(var(--chart-3))]/60 text-[hsl(var(--chart-3))]', Sample: 'border-border text-muted-foreground',
};
/** A status chip: always a word, never colour alone. */
export function Chip({ value }: { value: string }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium', TONE[value] ?? 'border-border text-muted-foreground')}>{value.replace(/_/g, ' ')}</span>;
}

export const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
/** Turns 'API call failed (403): {"message":"…"}' into the server's own sentence; access refusals say so plainly. */
export function friendly(raw: string): string {
  const m = raw.match(/^API call failed \((\d{3})\):\s*(\{.*\})\s*$/s);
  if (!m) return raw;
  let msg = '';
  try { const j = JSON.parse(m[2]) as { message?: string; userFacingMessage?: string }; msg = j.userFacingMessage ?? j.message ?? ''; } catch { /* not JSON */ }
  if (m[1] === '403') return `You don’t have access to this yet. ${msg || 'Your role does not allow it.'} Ask the founder to grant the role.`;
  if (m[1] === '401') return 'Your session ended. Sign in again.';
  return msg || `Something went wrong (error ${m[1]}).`;
}
export const errMsg = (e: unknown) => (e instanceof Error ? friendly(e.message) : 'That didn’t go through.');
