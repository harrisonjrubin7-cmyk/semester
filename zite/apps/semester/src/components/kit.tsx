import { friendlyError } from '../lib/clientError';
import { freshnessOf, routeLoadError, STALE_AFTER_MS } from '../lib/freshness';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { contextSession } from '../lib/contextSession';
import { format } from 'date-fns';
import { cn } from '@project/components/lib/utils';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';

const SOURCE: Record<string, { g: string; dashed?: boolean }> = {
  'Official': { g: '◆' }, 'Connected': { g: '⇄' }, 'Made Here': { g: '◇' }, 'Yours': { g: '○' },
  'Sample': { g: '◌', dashed: true }, 'AI Assisted': { g: '✦' },
};
export function SourceTag({ source }: { source: string }) {
  const s = SOURCE[source] ?? { g: '○' };
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border border-border bg-background/60 px-1.5 py-px text-[11px] text-muted-foreground', s.dashed && 'border-dashed')}>
      <span aria-hidden>{s.g}</span>{source}
    </span>
  );
}

const STATUS: Record<string, string> = {
  Open: '○', Done: '✓', 'Pending Approval': '…', Approved: '✓', Rejected: '✕', Sent: '…', Received: '◐', Resolved: '✓', Ready: '○',
  Booked: '✓', 'Private Draft': '○', Submitted: '…', Graded: '◐', Released: '✓', Active: '✓', Pending: '…', Suspended: '✕',
  'Never Run': '○', Synced: '✓', 'Sync Error': '!', Retrying: '⇄', 'Rolled Back': '↺', Hold: '!',
};
export function Status({ value, className }: { value: string; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 text-xs', value === 'Sync Error' || value === 'Rejected' ? 'text-destructive' : 'text-muted-foreground', className)}><span aria-hidden>{STATUS[value] ?? '·'}</span>{value}</span>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('rounded-md border border-border bg-card p-4', className)}>
      {title && <div className="mb-3 flex items-center justify-between"><h2 className="text-lg">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-sm border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export const fmt = (iso?: string | null) => (iso ? format(new Date(iso), 'EEE d MMM · HH:mm') : '—');
export const fmtDay = (iso?: string | null) => (iso ? format(new Date(iso), 'EEE d MMM') : '—');

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const dataRef = useRef<T | null>(null);
  const reload = useCallback(async () => {
    // Responses that arrive after a context switch are dropped (lib/contextSession.ts), so one app's data never shows in another.
    const { token } = contextSession.begin();
    try {
      const v = await fn();
      if (contextSession.accept(token)) { dataRef.current = v; setData(v); setLoadedAt(Date.now()); setError(null); setRefreshError(null); }
    } catch (e) {
      // A failed refresh keeps the last good data on screen (it becomes the stale state); only a first-load
      // failure is the page error.
      if (contextSession.accept(token)) {
        const routed = routeLoadError(dataRef.current != null, e instanceof Error ? e.message : 'Something went wrong');
        setError(routed.error); setRefreshError(routed.refreshError);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, refreshError, loadedAt, reload };
}

/** Stale — the data on screen is the last version that loaded; say when it is from and offer a retry. */
export function StaleNote({ when, problem, onRetry }: { when?: string | null; problem?: string | null; onRetry?: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="status">
      <span>↻ Showing the last version{when ? ` from ${when}` : ''} — it may be out of date.{problem ? ` ${problem}` : ''}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Uncertain — the value shown is provisional, estimated or not yet confirmed by its owner. Name what would settle it. */
export function UncertainNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 rounded-md border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="note">
      <span className="font-medium text-foreground">? Not settled yet. </span>{children}
    </div>
  );
}

export function Loadable<T>({ state, staleAfterMs = STALE_AFTER_MS, children }: { state: { data: T | null; error: string | null; refreshError?: string | null; loadedAt?: number | null; reload: () => void }; staleAfterMs?: number; // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (d: any) => ReactNode }) {
  if (state.error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="rounded-md border border-border bg-card p-6 text-sm">
        <p className="font-medium">{offline ? '⇄ You are offline' : /access|role|workspace|allow/i.test(state.error) ? '⊘ You don’t have access to this' : '! This didn’t load'}</p>
        <p className="mt-1 text-muted-foreground">{state.error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={state.reload}>Try again</Button>
      </div>
    );
  }
  if (!state.data) return <div className="space-y-3"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  const stale = state.refreshError != null || freshnessOf(state.loadedAt ?? null, Date.now(), staleAfterMs) === 'stale';
  return (
    <>
      {stale && <StaleNote when={state.loadedAt ? fmt(new Date(state.loadedAt).toISOString()) : null} problem={state.refreshError ? `The refresh didn't go through: ${state.refreshError}` : null} onRetry={state.reload} />}
      {children(state.data)}
    </>
  );
}

/** Source Line — a statement, a thin editorial rule, its source chip. Only where a real source exists. */
export function SourceLine({ children, source, by, when }: { children: ReactNode; source: string; by?: string; when?: string }) {
  return (
    <div className="border-l-2 border-border pl-3">
      {children}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden className="h-px w-8 bg-[hsl(var(--editorial))]" /><SourceTag source={source} />{by && <span>{by}</span>}{when && <span>· {when}</span>}
      </div>
    </div>
  );
}

/** Auditable timeline: who did what, when, under which authority. */
export function DecisionTrail({ items, label = 'Decision trail' }: { label?: string; items: { title: string; who?: string; when?: string; detail?: string; state?: 'done' | 'current' | 'waiting' | 'blocked' }[] }) {
  if (!items.length) return <Empty>No decisions recorded yet.</Empty>;
  return (
    <ol aria-label={label} className="space-y-3">
      {items.map((i, n) => (
        <li key={n} className="relative flex gap-3 pl-1">
          <span aria-hidden className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border', i.state === 'waiting' ? 'border-border' : i.state === 'current' ? 'border-primary' : i.state === 'blocked' ? 'border-destructive bg-destructive' : 'border-foreground bg-foreground')} />
          <div className="text-sm">
            <p>{i.title}{i.state === 'blocked' && <span className="ml-1 text-destructive">· ! Blocked</span>}</p>
            {(i.who || i.when) && <p className="text-xs text-muted-foreground">{[i.who, i.when].filter(Boolean).join(' · ')}</p>}
            {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** What is about to happen, said before it happens. */
export function ActionPreview({ subject, says, exactly, stays, recovery }: { subject?: string; says: ReactNode; exactly?: ReactNode; stays?: ReactNode; recovery: { kind: 'undo' | 'request' | 'none'; how?: string } }) {
  const Row = ({ k, v }: { k: string; v: ReactNode }) => <div><p className="text-[11px] text-muted-foreground">{k}</p><p className="text-sm">{v}</p></div>;
  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-4">
      {subject && <p className="font-display text-base font-semibold">{subject}</p>}
      <Row k="What happens" v={says} />
      {exactly && <Row k="Exactly what" v={exactly} />}
      {stays && <Row k="What stays the same" v={stays} />}
      <Row k="Taking it back" v={recovery.kind === 'undo' ? `You can undo this${recovery.how ? `: ${recovery.how}` : '.'}` : recovery.kind === 'request' ? `This can be reversed on request: ${recovery.how}` : `This can’t be undone here.${recovery.how ? ` ${recovery.how}` : ''}`} />
    </div>
  );
}

/** Process shown in named steps — no spinners, no shimmer. */
export function StepStatus({ steps }: { steps: { label: string; state: 'waiting' | 'working' | 'done' | 'failed' }[] }) {
  const g = { waiting: '○', working: '…', done: '✓', failed: '!' };
  return (
    <ul className="space-y-1 text-sm" aria-live="polite">
      {steps.map((s) => <li key={s.label} className={cn(s.state === 'waiting' && 'text-muted-foreground', s.state === 'failed' && 'text-destructive')}><span aria-hidden className="mr-2 inline-block w-3">{g[s.state]}</span>{s.label}</li>)}
    </ul>
  );
}

/** One figure worth reading first, with unit, source and age. */
export function Metric({ label, value, unit, source, updated }: { label: string; value: string | number; unit?: string; source?: string; updated?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}{unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}</p>
      {(source || updated) && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{source && <SourceTag source={source} />}{updated}</div>}
    </div>
  );
}

/** Safe text for any endpoint failure (lib/clientError.ts): never internal authz strings, SQL or stack traces. */
export function errMsg(e: unknown) { return friendlyError(e); }
