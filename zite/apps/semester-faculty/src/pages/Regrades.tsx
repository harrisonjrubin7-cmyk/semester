import { useState } from 'react';
import { regrade } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@project/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLoad, errMsg, fmtDate } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

type Item = { id: string; label: string; status: string; reason: string; gradeAtRequest: string; newGrade: string; student: string; self: boolean; decidedBy: string; note: string; requestedAt: string | null };
type Data = { grades: readonly string[]; items: Item[] };

export default function Regrades() {
  const q = useLoad(() => regrade({ action: 'queue' }) as Promise<Data>);
  const [tab, setTab] = useState('Pending');
  const [open, setOpen] = useState<Item | null>(null);
  const [outcome, setOutcome] = useState<'Grade Changed' | 'Grade Upheld' | ''>('');
  const [grade, setGrade] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = !!outcome && note.trim().length > 0 && (outcome === 'Grade Upheld' || (!!grade && grade !== open?.gradeAtRequest));

  const close = () => { setOpen(null); setOutcome(''); setGrade(''); setNote(''); };
  const decide = async () => {
    if (!open || !outcome) return;
    setBusy(true);
    try {
      await regrade({ action: 'decide', id: open.id, outcome, newGrade: outcome === 'Grade Changed' ? grade : undefined, note: note.trim() });
      toast.success('Decision recorded and the student notified.'); close(); await q.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const items = (q.data?.items ?? []).filter((i) => tab === 'all' || (tab === 'Pending' ? i.status === 'Pending' : i.status !== 'Pending'));

  return (
    <div>
      <PageHeader title="Regrade requests" sub="Students ask for a review of a released grade. Every decision is audited and the student is told the outcome." />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : (
        <>
          <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="Pending">Waiting</TabsTrigger><TabsTrigger value="decided">Decided</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
          {items.length === 0 ? <Empty title="Nothing here" hint={tab === 'Pending' ? 'No regrade requests are waiting.' : undefined} /> : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {items.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.label} <span className="font-normal text-muted-foreground">· {i.student} · grade {i.gradeAtRequest}{i.newGrade && ` → ${i.newGrade}`}</span></p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{i.status === 'Pending' ? i.reason : `${i.decidedBy}: ${i.note}`}</p>
                    <p className="font-mono text-xs text-muted-foreground">{fmtDate(i.requestedAt ?? '')}</p>
                  </div>
                  <Badge variant={i.status === 'Pending' ? 'secondary' : 'outline'}>{i.status}</Badge>
                  {i.status === 'Pending' && <Button size="sm" disabled={i.self} onClick={() => setOpen(i)}>Review</Button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open?.label}</DialogTitle><DialogDescription>{open?.student} · current grade {open?.gradeAtRequest}</DialogDescription></DialogHeader>
          <p className="rounded-lg bg-muted p-3 text-sm">{open?.reason}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Outcome</Label><Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent><SelectItem value="Grade Upheld">Keep grade</SelectItem><SelectItem value="Grade Changed">Change grade</SelectItem></SelectContent></Select></div>
            {outcome === 'Grade Changed' && <div className="space-y-1.5"><Label>New grade</Label><Select value={grade} onValueChange={setGrade}><SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent>{q.data?.grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div className="space-y-1.5"><Label>Explanation to the student</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!valid || busy} onClick={decide}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record decision</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
