import { useState } from 'react';
import { toast } from 'sonner';
import { savePolicy, SavePolicyInputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { useLabData } from '../lib/useLabData';
import { PageHeader, StatusBadge } from '../components/Badges';

const EMPTY: SavePolicyInputType = { name: '', scope: 'user', capacity: 10, refillPerSecond: 1, cost: 1, version: 'v1', status: 'draft' };

export default function PoliciesPage() {
  const { data, reload } = useLabData();
  const [edit, setEdit] = useState<SavePolicyInputType | null>(null);
  const valid = !!edit && edit.name.trim() && edit.capacity > 0 && edit.refillPerSecond > 0 && edit.cost > 0 && edit.cost <= edit.capacity;
  const save = async () => {
    if (!edit) return;
    try { await savePolicy(edit); toast.success('Policy saved'); setEdit(null); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
  };
  const f = (k: keyof SavePolicyInputType, v: unknown) => setEdit((p) => (p ? { ...p, [k]: v } : p));
  return (
    <div>
      <PageHeader title="Policy registry" sub="Rate-limit policies, layered: pre-auth IP → user → validated tenant → AI cost → export concurrency. Tenant limits apply only after membership is validated. Change the version when the meaning of a policy changes.">
        <Button onClick={() => setEdit(EMPTY)}>New policy</Button>
      </PageHeader>
      <Card className="overflow-x-auto">
        {!data ? <Skeleton className="m-4 h-40" /> :
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Scope</TableHead><TableHead className="text-right">Capacity</TableHead><TableHead className="text-right">Refill/s</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{data.policies.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell><TableCell className="font-mono text-xs">{p.scope}</TableCell>
              <TableCell className="text-right font-mono">{p.capacity}</TableCell><TableCell className="text-right font-mono">{p.refillPerSecond}</TableCell><TableCell className="text-right font-mono">{p.cost}</TableCell>
              <TableCell className="font-mono text-xs">{p.version}</TableCell><TableCell><StatusBadge value={p.status} /></TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit({ id: p.id, name: p.name ?? '', scope: (p.scope ?? 'user') as 'user', capacity: p.capacity ?? 1, refillPerSecond: p.refillPerSecond ?? 1, cost: p.cost ?? 1, version: p.version ?? 'v1', status: (p.status ?? 'draft') as 'draft' })}>Edit</Button></TableCell>
            </TableRow>))}
          </TableBody>
        </Table>}
      </Card>
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit policy' : 'New policy'}</DialogTitle></DialogHeader>
          {edit && <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Name</Label><Input value={edit.name} onChange={(e) => f('name', e.target.value)} /></div>
            {(['capacity', 'refillPerSecond', 'cost'] as const).map((k) => <div key={k} className="space-y-1"><Label>{k}</Label><Input type="number" value={edit[k]} onChange={(e) => f(k, Number(e.target.value))} /></div>)}
            <div className="space-y-1"><Label>Version</Label><Input value={edit.version} onChange={(e) => f('version', e.target.value)} /></div>
            <div className="space-y-1"><Label>Scope</Label><Select value={edit.scope} onValueChange={(v) => f('scope', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['ip', 'user', 'tenant', 'ai', 'export'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Status</Label><Select value={edit.status} onValueChange={(v) => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">draft</SelectItem><SelectItem value="approved">approved</SelectItem></SelectContent></Select></div>
            {!valid && <p className="col-span-2 text-xs text-destructive">Name required; values positive; cost ≤ capacity.</p>}
            <Button className="col-span-2" disabled={!valid} onClick={save}>Save</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
