import { useState } from 'react';
import { toast } from 'sonner';
import { decideGate } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useLabData } from '../lib/useLabData';
import { ModeBadge, PageHeader, StatusBadge } from '../components/Badges';

export default function GatesPage() {
  const { data, reload } = useLabData();
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!data) return <Skeleton className="h-60" />;
  const decide = async (gateId: string, decision: 'satisfied' | 'rejected' | 'pending') => {
    try { await decideGate({ gateId, decision, runId: pick[gateId] }); toast.success(`Gate ${decision}`); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Not allowed'); }
  };
  return (
    <div>
      <PageHeader title="Release gates" sub="A gate is satisfied only by a passed run in its required mode. The server enforces this: simulation results are always rejected." />
      <div className="space-y-4">
        {data.gates.map((g) => {
          const eligible = data.runs.filter((r) => r.mode !== 'simulation');
          return (
            <Card key={g.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="font-semibold">{g.gate}</div><p className="mt-1 text-sm text-muted-foreground">{g.requiredEvidence}</p></div>
                <div className="flex gap-1"><ModeBadge mode={g.requiredMode} /><StatusBadge value={g.status} /></div>
              </div>
              {g.evidenceRunId && <div className="mt-2 font-mono text-xs text-muted-foreground">evidence run: {g.evidenceRunId}</div>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select value={pick[g.id]} onValueChange={(v) => setPick((p) => ({ ...p, [g.id]: v }))}>
                  <SelectTrigger className="w-80"><SelectValue placeholder={eligible.length ? 'Choose evidence run' : 'No non-simulation runs yet'} /></SelectTrigger>
                  <SelectContent>{eligible.map((r) => <SelectItem key={r.id} value={r.id}>{r.title} · {r.mode} · {r.status}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={!pick[g.id]} onClick={() => decide(g.id, 'satisfied')}>Satisfy</Button>
                <Button size="sm" variant="outline" onClick={() => decide(g.id, 'rejected')}>Reject</Button>
                {g.status !== 'pending' && <Button size="sm" variant="ghost" onClick={() => decide(g.id, 'pending')}>Reset</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
