import { useState } from 'react';
import { sectionRequests } from 'zitejs/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@project/components/lib/utils';
import { errMsg, fmtDate } from '../lib/useLoad';
import { STATE_LABEL, STEPS, type SreqData, type SreqMe, type SreqRow } from './sreqTypes';

type Props = { row: SreqRow | null; me: SreqMe; onClose: () => void; onDone: (d: SreqData) => void };

export default function RequestSheet({ row, me, onClose, onDone }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, input: Parameters<typeof sectionRequests>[0], ok: string) => {
    setBusy(key);
    try {
      const d = (await sectionRequests(input)) as SreqData;
      onDone(d);
      const res = d.result as { mismatch?: string[] } | null;
      if (res?.mismatch?.length) toast.warning(`Reconciliation found differences: ${res.mismatch.join(', ')}`);
      else toast.success(ok);
      setNote('');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  if (!row) return <Sheet open={false} onOpenChange={() => onClose()}><SheetContent /></Sheet>;
  const isChair = row.state === 'submitted' && me.chairOf.includes(row.departmentId);
  const isReg = row.state === 'chair_approved' && me.isRegistrar;
  const canPublish = ['authorized', 'creating', 'created'].includes(row.state) && me.isRegistrar;
  const canWithdraw = row.mine && ['submitted', 'chair_approved'].includes(row.state);
  const stepIdx = STEPS.indexOf(row.state === 'creating' ? 'authorized' : row.state);
  const decide = (approve: boolean) => run(approve ? 'yes' : 'no',
    { action: isChair ? 'chair' : 'registrar', id: row.id, approve, note, expectedVersion: row.version },
    approve ? (isChair ? 'Approved and sent to the registrar.' : 'Authorized. Section created and reconciled.') : 'Declined.');

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetDescription className="font-mono">{row.ref} · {STATE_LABEL[row.state] ?? row.state}</SheetDescription>
          <SheetTitle className="text-xl">{row.label}</SheetTitle>
        </SheetHeader>
        <ol className="my-5 flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className={cn('h-1.5 flex-1 rounded-full', stepIdx >= i && !['rejected', 'withdrawn'].includes(row.state) ? 'bg-primary' : 'bg-muted')} />
          ))}
        </ol>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[['Department', row.department], ['Requested by', row.requester], ['Instructor', row.instructor], ['Room', row.room],
            ['Meets', row.meetingTimes], ['Capacity', String(row.capacity)]].map(([k, v]) => (
            <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        {row.reason && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{row.reason}</p>}
        {(isChair || isReg) && (
          <div className="mt-6 space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">{isChair ? 'Chair review' : 'Registrar authorization (includes schedule and room checks)'}</p>
            <Textarea placeholder="Note (required to decline)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button disabled={!!busy} onClick={() => decide(true)}>{busy === 'yes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{isChair ? 'Approve' : 'Authorize'}</Button>
              <Button variant="outline" disabled={!!busy || !note.trim()} onClick={() => decide(false)}>Decline</Button>
            </div>
          </div>
        )}
        {canPublish && (
          <Button className="mt-6 w-full" disabled={!!busy} onClick={() => run('pub', { action: 'publish', id: row.id }, 'Section created and reconciled.')}>
            {busy === 'pub' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finish creation and reconcile
          </Button>
        )}
        {canWithdraw && (
          <Button variant="ghost" className="mt-3 w-full" disabled={!!busy} onClick={() => run('wd', { action: 'withdraw', id: row.id, expectedVersion: row.version }, 'Request withdrawn.')}>Withdraw request</Button>
        )}
        <h3 className="mt-8 text-sm font-semibold">History</h3>
        <ol className="mt-3 space-y-3 border-l border-border pl-4">
          {row.events.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{STATE_LABEL[e.state] ?? e.state} <span className="font-normal text-muted-foreground">· {e.who}</span></p>
              {e.note && <p className="text-muted-foreground">{e.note}</p>}
              <p className="font-mono text-xs text-muted-foreground">{fmtDate(e.at)}</p>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
