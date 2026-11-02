import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { capabilities, updateCapability, CapabilitiesOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { PageHeader } from '../components/Badges';
import StageEvidence from '../components/StageEvidence';

type Item = CapabilitiesOutputType['items'][0];
const STATUSES = ['Designed', 'Implemented-unverified', 'Tested', 'Institution-approved', 'Production-enabled'] as const;
const LAYERS = ['Shared Platform', 'Student', 'Institution', 'Company'];

function Edit({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(item.status as (typeof STATUSES)[number]);
  const [blockers, setBlockers] = useState(item.blockers);
  const [evidence, setEvidence] = useState(item.evidence);
  const [busy, setBusy] = useState(false);
  const needsEvidence = STATUSES.indexOf(status) >= 2 && evidence.trim().length < 10;
  const save = async () => {
    setBusy(true);
    try { await updateCapability({ id: item.id, status, blockers, evidence }); toast.success('Updated'); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item.capability}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Blockers</Label><Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} /></div>
          <div className="space-y-1"><Label>Evidence</Label><Textarea placeholder="Run ID, test report, approval record…" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
            {needsEvidence && <p className="text-xs text-destructive">This status needs evidence. A page existing isn't proof.</p>}</div>
          <div className="space-y-1"><Label>Stage evidence</Label>
            <p className="text-xs text-muted-foreground">Each stage is tracked on its own. A stage with no entry stays Unknown.</p>
            <StageEvidence capabilityId={item.id} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || needsEvidence}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CapabilitiesPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState('');
  const [layer, setLayer] = useState('all');
  const [status, setStatus] = useState('all');
  const [edit, setEdit] = useState<Item | null>(null);
  const load = () => capabilities({}).then((r) => setItems(r.items)).catch(() => toast.error('Could not load register'));
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (items ?? [])
    .filter((i) => (layer === 'all' || i.layer === layer) && (status === 'all' || i.status === status))
    .filter((i) => `${i.capability} ${i.domain} ${i.app} ${i.routes}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.phase.localeCompare(b.phase) || a.capability.localeCompare(b.capability)), [items, q, layer, status]);
  const counts = STATUSES.map((s) => [s, (items ?? []).filter((i) => i.status === s).length] as const);

  return (
    <div>
      <PageHeader title="Capability register" sub="Phase 0 gate: every planned Semester feature has a current status. Designed ≠ built, and built ≠ tested. Statuses past 'Implemented-unverified' require evidence." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counts.map(([s, n]) => <Card key={s} className="p-3"><div className="text-xs text-muted-foreground">{s}</div><div className="font-mono text-2xl font-semibold">{items ? n : '—'}</div></Card>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input placeholder="Search capability, app, route…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={layer} onValueChange={setLayer}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All layers</SelectItem>{LAYERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card>
        {!items ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Phase</TableHead><TableHead>Capability</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">App / routes</TableHead><TableHead className="hidden lg:table-cell">Blockers</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{i.phase}</TableCell>
                  <TableCell><div className="font-medium">{i.capability}</div><div className="text-xs text-muted-foreground">{i.layer} · {i.domain} · authority: {i.sourceAuthority}</div></TableCell>
                  <TableCell><Badge variant={i.status === 'Designed' ? 'outline' : 'secondary'}>{i.status}</Badge></TableCell>
                  <TableCell className="hidden max-w-xs text-xs md:table-cell"><div>{i.app}</div><div className="font-mono text-muted-foreground">{i.routes}</div></TableCell>
                  <TableCell className="hidden max-w-xs text-xs text-muted-foreground lg:table-cell">{i.blockers}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit(i)}>Edit</Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No capabilities match.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
      {edit && <Edit item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}
