import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { ShieldAlert, Inbox, Clock, CircleHelp } from 'lucide-react';

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
}

export function DeniedOrError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <Inbox className="h-7 w-7 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Stale — data on screen is the last version that loaded; say when it is from and offer a retry. */
export function StaleNote({ when, onRetry }: { when?: string | null; onRetry?: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="status">
      <Clock className="h-3.5 w-3.5" />
      <span>Showing the last version{when ? ` from ${when}` : ''} — it may be out of date.</span>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Uncertain — the value shown is provisional or not yet confirmed by its owner. Name what would settle it. */
export function UncertainNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="note">
      <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span><span className="font-medium text-foreground">Not settled yet. </span>{children}</span>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {action}
    </div>
  );
}
