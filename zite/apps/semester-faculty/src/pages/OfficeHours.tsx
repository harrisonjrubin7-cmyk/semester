import { useState } from 'react';
import { officeHours } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Card, CardContent } from '@project/components/ui/card';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useLoad, errMsg, fmtDate } from '../lib/useLoad';
import { loadOh, type Slot } from '../lib/oh';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';
import NewSlotDialog from '../components/NewSlotDialog';

export default function OfficeHours() {
  const q = useLoad(loadOh);
  const [creating, setCreating] = useState(false);
  const [cancel, setCancel] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await q.reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };

  const upcoming = (q.data?.hosting ?? []).filter((s) => new Date(s.end) >= new Date(Date.now() - 864e5 * 7)).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <PageHeader title="Office hours" sub="Open time students can book. Cancelling tells everyone booked." action={q.data?.hostKinds.length ? <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add office hours</Button> : null} />
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : upcoming.length === 0 ? <Empty title="No office hours scheduled" hint="Add a recurring slot so students can book time." /> : (
        <div className="space-y-3">
          {upcoming.map((s) => {
            const past = new Date(s.end) < new Date();
            return (
              <Card key={s.id} className={s.cancelled ? 'opacity-60' : ''}><CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="font-semibold">{fmtDate(s.start)} · {s.section ?? s.kind}</p><p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{s.location || '—'} · {s.bookings.filter((b) => b.state !== 'cancelled').length}/{s.capacity} booked</p></div>
                  {s.cancelled ? <Badge variant="outline">Cancelled</Badge> : !past && <Button size="sm" variant="outline" onClick={() => setCancel(s)}>Cancel</Button>}
                </div>
                {s.bookings.length > 0 && (
                  <div className="mt-3 divide-y divide-border border-t border-border">
                    {s.bookings.map((b) => (
                      <div key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                        <p className="min-w-0 flex-1"><span className="font-medium">{b.student}</span>{b.topic && <span className="text-muted-foreground"> · {b.topic}</span>}</p>
                        {b.state === 'booked' && past ? (
                          <>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => officeHours({ action: 'mark', bookingId: b.id, state: 'attended', followUp: '' }), 'Marked attended.')}>Attended</Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => officeHours({ action: 'mark', bookingId: b.id, state: 'no_show', followUp: '' }), 'Marked no-show.')}>No-show</Button>
                          </>
                        ) : <Badge variant="secondary">{b.state.replace('_', '-')}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>
            );
          })}
        </div>
      )}
      {q.data && <NewSlotDialog open={creating} onOpenChange={setCreating} data={q.data} onDone={q.reload} />}
      <Dialog open={!!cancel} onOpenChange={(o) => !o && setCancel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel office hours</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Reason (sent to booked students)</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>Keep</Button>
            <Button variant="destructive" disabled={busy || !reason.trim()} onClick={async () => { if (await run(() => officeHours({ action: 'cancelSlot', slotId: cancel!.id, reason: reason.trim() }), 'Cancelled and students notified.')) { setCancel(null); setReason(''); } }}>Cancel slot</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
