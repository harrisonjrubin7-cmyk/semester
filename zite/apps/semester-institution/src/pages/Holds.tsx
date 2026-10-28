import { useState } from 'react';
import { z } from 'zod';
import { institutionOps } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLoad, errMsg } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

type Hold = { id: string; student: string; office: string; status: string; message: string; blocks: boolean; mine: boolean; responses: { body: string; at: string | null }[] };
type Data = { students: { id: string; name: string }[]; holds: Hold[] };
const OFFICES = ['Registrar', 'Bursar', 'Advising', 'Student Affairs'] as const;
const placeSchema = z.object({ studentId: z.string().min(1), office: z.enum(OFFICES), message: z.string().trim().min(10).max(400) });

export default function Holds() {
  const q = useLoad(() => institutionOps({ action: 'holds' }) as Promise<Data>);
  const [search, setSearch] = useState('');
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({ studentId: '', office: '', message: '' });
  const [release, setRelease] = useState<Hold | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = placeSchema.safeParse(form).success;

  const act = async (fn: () => Promise<unknown>, ok: string, after: () => void) => {
    setBusy(true);
    try { await fn(); toast.success(ok); after(); await q.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const rows = (q.data?.holds ?? []).filter((h) => `${h.student} ${h.office} ${h.message}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Registration holds" sub="Place and lift holds. Whoever placed a hold can't lift it themselves." action={q.data && <Button onClick={() => setPlacing(true)}><Plus className="mr-2 h-4 w-4" />Place hold</Button>} />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="relative mb-4 w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search holds" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {rows.length === 0 ? <Empty title="No holds" /> : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {rows.map((h) => (
                <div key={h.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1"><p className="font-semibold">{h.student} <span className="font-normal text-muted-foreground">· {h.office}</span></p><p className="text-sm text-muted-foreground">{h.message}</p></div>
                    <Badge variant={h.status === 'Active' ? 'default' : 'outline'}>{h.status}</Badge>
                    {h.status === 'Active' && <Button size="sm" variant="outline" disabled={h.mine} title={h.mine ? 'You placed this hold' : undefined} onClick={() => setRelease(h)}>Lift</Button>}
                  </div>
                  {h.responses.length > 0 && <div className="mt-3 border-l-2 border-border pl-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Student responses</p>
                    <ul className="mt-1 space-y-2">{h.responses.map((r, i) => <li key={i} className="text-sm"><p>{r.body}</p><p className="text-xs text-muted-foreground">{r.at ? new Date(r.at).toLocaleString() : ''}</p></li>)}</ul></div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog open={placing} onOpenChange={setPlacing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place a registration hold</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Student</Label><Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{q.data?.students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Office</Label><Select value={form.office} onValueChange={(v) => setForm({ ...form, office: v })}><SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger><SelectContent>{OFFICES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Message the student will see</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><p className="text-xs text-muted-foreground">10–400 characters. Say what they need to do.</p></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPlacing(false)}>Cancel</Button>
            <Button disabled={!valid || busy} onClick={() => act(() => institutionOps({ action: 'placeHold', studentId: form.studentId, office: form.office as typeof OFFICES[number], message: form.message }), 'Hold placed.', () => { setPlacing(false); setForm({ studentId: '', office: '', message: '' }); })}>Place hold</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!release} onOpenChange={(o) => !o && setRelease(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lift hold for {release?.student}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRelease(null)}>Cancel</Button>
            <Button disabled={reason.trim().length < 5 || busy} onClick={() => act(() => institutionOps({ action: 'releaseHold', holdId: release!.id, reason }), 'Hold lifted.', () => { setRelease(null); setReason(''); })}>Lift hold</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
