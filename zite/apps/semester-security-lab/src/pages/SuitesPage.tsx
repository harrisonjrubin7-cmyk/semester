import { useState } from 'react';
import { toast } from 'sonner';
import { requestSuiteRun } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { useLabData, LabData } from '../lib/useLabData';
import { ModeBadge, PageHeader, StatusBadge } from '../components/Badges';

type Run = LabData['runs'][0];

export default function SuitesPage() {
  const { data, reload } = useLabData();
  const [open, setOpen] = useState<Run | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string) => {
    setBusy(id);
    try { const r = await requestSuiteRun({ suiteId: id }); toast.message(`Run recorded: ${r.status}`); await reload(); }
    catch { toast.error('Request failed'); } finally { setBusy(null); }
  };
  if (!data) return <Skeleton className="h-60" />;
  return (
    <div>
      <PageHeader title="Suites & runs" sub="Only allowlisted suites can run. No arbitrary SQL, shell commands or database URLs. Without a connected runner, a request is recorded as blocked and nothing is made up." />
      <div className="grid gap-4 md:grid-cols-2">
        {data.suites.map((s) => (
          <Card key={s.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.kind} · {s.version}</div></div><StatusBadge value={s.runnerStatus} /></div>
            <p className="mt-3 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <code className="mt-3 block rounded bg-muted px-2 py-1 font-mono text-xs">{s.runnerReference}</code>
            <Button variant="outline" className="mt-4 self-start" disabled={busy === s.id} onClick={() => run(s.id)}>Request run</Button>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-semibold">Run history</h2>
      <Card className="divide-y">
        {data.runs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No runs yet.</div>}
        {data.runs.map((r) => (
          <button key={r.id} onClick={() => setOpen(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50">
            <div className="min-w-0"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.runType} · {r.environment} · {r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}</div></div>
            <span className="flex shrink-0 gap-1"><ModeBadge mode={r.mode} /><StatusBadge value={r.status} /></span>
          </button>
        ))}
      </Card>
      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open && <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {(['id', 'mode', 'status', 'environment', 'runnerVersion', 'applicationCommit', 'startedAt', 'finishedAt'] as const).map((k) => <div key={k}><span className="text-muted-foreground">{k}: </span>{open[k] ?? '—'}</div>)}
            </div>
            <p>{open.summary}</p>
            {open.evidence && <pre className="max-h-72 overflow-auto rounded bg-secondary p-3 font-mono text-xs text-secondary-foreground">{open.evidence}</pre>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
