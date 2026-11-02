import { Badge } from '@project/components/ui/badge';
import { cn } from '@project/components/lib/utils';

const modeStyle: Record<string, string> = {
  simulation: 'bg-muted text-muted-foreground border-border',
  sandbox: 'bg-accent text-accent-foreground border-primary/20',
  staging: 'bg-primary/10 text-primary border-primary/30',
  production_observation: 'bg-secondary text-secondary-foreground border-secondary',
};
const statusStyle: Record<string, string> = {
  passed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  satisfied: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  fixed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  blocked: 'bg-amber-50 text-amber-800 border-amber-200',
  Blocked: 'bg-amber-50 text-amber-800 border-amber-200',
  Connected: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function ModeBadge({ mode }: { mode?: string }) {
  return <Badge variant="outline" className={cn('font-mono text-[11px] font-medium', modeStyle[mode ?? ''])}>{mode ?? '—'}</Badge>;
}
export function StatusBadge({ value }: { value?: string }) {
  return <Badge variant="outline" className={cn('font-mono text-[11px] font-medium', statusStyle[value ?? ''] ?? 'text-muted-foreground')}>{value ?? '—'}</Badge>;
}
export function PageHeader({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}
