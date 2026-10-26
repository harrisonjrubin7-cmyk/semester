import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { capabilityEvidence, addCapabilityEvidence, CapabilityEvidenceOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

const STAGES = ['Designed', 'Implemented', 'Tested', 'Deployed', 'Institution-authorized', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'] as const;
const ENVS = ['Synthetic', 'Preview', 'Staging', 'Production'] as const;
type Entry = CapabilityEvidenceOutputType['entries'][0];

function AddForm({ capabilityId, onAdded }: { capabilityId: string; onAdded: () => void }) {
  const [stage, setStage] = useState<(typeof STAGES)[number]>('Implemented');
  const [environment, setEnv] = useState<(typeof ENVS)[number]>('Preview');
  const [reference, setRef] = useState('');
  const [scope, setScope] = useState('');
  const [busy, setBusy] = useState(false);
  const invalid = reference.trim().length < 10 || !scope.trim();
  const submit = async () => {
    setBusy(true);
    try { await addCapabilityEvidence({ capabilityId, stage, environment, reference, scope, summary: '' }); setRef(''); setScope(''); toast.success('Evidence recorded'); onAdded(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not record'); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
      <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <Select value={environment} onValueChange={(v) => setEnv(v as typeof environment)}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{ENVS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <Input className="sm:col-span-2" placeholder="Evidence reference (run ID, test output, approval record)" value={reference} onChange={(e) => setRef(e.target.value)} />
      <Input placeholder="Scope (e.g. tenant A/B, registrar endpoints)" value={scope} onChange={(e) => setScope(e.target.value)} />
      <Button onClick={submit} disabled={busy || invalid}>Record as me</Button>
    </div>
  );
}

export default function StageEvidence({ capabilityId }: { capabilityId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const load = () => capabilityEvidence({ capabilityId }).then((r) => setEntries(r.entries)).catch(() => toast.error('Could not load evidence'));
  useEffect(() => { load(); }, [capabilityId]);
  if (!entries) return <Skeleton className="h-24" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STAGES.map((s) => {
          const latest = entries.find((e) => e.stage === s);
          return (
            <div key={s} className="rounded-md border p-2 text-xs">
              <div className="font-medium">{s}</div>
              {latest ? <div className="text-muted-foreground">{latest.environment} · {latest.reviewer}<br />{new Date(latest.recordedAt).toLocaleDateString()}</div>
                : <Badge variant="outline" className="mt-1">Unknown</Badge>}
            </div>
          );
        })}
      </div>
      {entries.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-auto text-xs">
          {entries.map((e) => <li key={e.id} className="border-l-2 pl-2"><span className="font-medium">{e.stage}</span> · {e.scope} · <span className="font-mono">{e.reference}</span></li>)}
        </ul>
      )}
      <AddForm capabilityId={capabilityId} onAdded={load} />
    </div>
  );
}
