import { useState } from 'react';
import { careerPartners } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { toast } from 'sonner';
import { useLoad, errMsg } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

type Partner = { employerId: string; name: string; status: string; version: number; requestedAt: string; decidedBy: string | null; note: string };
type Decision = 'Approved' | 'Declined' | 'Revoked';

export default function Employers() {
  const q = useLoad(() => careerPartners({ action: 'list' }) as Promise<{ partners: Partner[] }>);
  const [pending, setPending] = useState<{ p: Partner; d: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await careerPartners({ action: 'decide', employerId: pending.p.employerId, decision: pending.d, expectedVersion: pending.p.version, note });
      toast.success(`${pending.p.name}: ${pending.d.toLowerCase()}`); setPending(null); setNote(''); q.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Employer partnerships" sub="Students see an employer's opportunities only after you approve it. Revoking hides them again." />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : !q.data?.partners.length ? <Empty title="No employer has asked to reach your students yet." /> : (
        <ul className="space-y-2">
          {q.data.partners.map((p) => (
            <li key={p.employerId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
              <span><span className="font-medium">{p.name}</span> <Badge variant="outline" className="ml-2">{p.status}</Badge>
                <span className="ml-2 text-muted-foreground">asked {new Date(p.requestedAt).toLocaleDateString()}{p.decidedBy ? ` · decided by ${p.decidedBy}` : ''}</span></span>
              <span className="flex gap-2">
                {p.status === 'Pending' && <><Button size="sm" onClick={() => setPending({ p, d: 'Approved' })}>Approve</Button><Button size="sm" variant="outline" onClick={() => setPending({ p, d: 'Declined' })}>Decline</Button></>}
                {p.status === 'Approved' && <Button size="sm" variant="outline" onClick={() => setPending({ p, d: 'Revoked' })}>Revoke</Button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pending?.d === 'Approved' ? 'Approve' : pending?.d === 'Declined' ? 'Decline' : 'Revoke'} {pending?.p.name}?</DialogTitle></DialogHeader>
          <Label htmlFor="partner-note">Note {pending?.d === 'Declined' ? '(the employer sees this)' : '(internal)'}</Label>
          <Textarea id="partner-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <DialogFooter><Button variant="outline" onClick={() => setPending(null)}>Cancel</Button><Button disabled={busy} onClick={decide}>{busy ? 'Saving…' : 'Confirm'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
