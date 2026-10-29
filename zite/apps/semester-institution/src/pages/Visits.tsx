import { useState } from 'react';
import { admissionsVisits } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { toast } from 'sonner';
import { useLoad, errMsg, fmtDate } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Slot = any;
const KIND: Record<string, string> = { tour: 'Campus tour', info_session: 'Information session', interview: 'Interview' };
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

export default function Visits() {
  const q = useLoad(() => admissionsVisits({ action: 'get' }) as Promise<any>);
  const [f, setF] = useState({ startsAt: '', kind: 'tour', capacity: '20', location: '', note: '' });
  const [email, setEmail] = useState('');
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); q.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const d = q.data;
  return (
    <>
      <PageHeader title="Visit slots" sub="Tours, information sessions and interviews that prospective students can book in the Applicants portal. Bookings count guests against each slot's capacity." />
      {q.loading && !d ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : (
        <div className="space-y-6">
          {d.isStaff && (
            <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
              <p className="font-medium">Publish a slot</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label htmlFor="vs-when">Starts</Label><Input id="vs-when" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></div>
                <div><Label htmlFor="vs-kind">Kind</Label><select id="vs-kind" className={`${sel} w-full`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><Label htmlFor="vs-cap">Capacity (people)</Label><Input id="vs-cap" type="number" min={1} max={500} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
                <div><Label htmlFor="vs-loc">Location</Label><Input id="vs-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={120} placeholder="Welcome center" /></div>
                <div className="md:col-span-2"><Label htmlFor="vs-note">Note for visitors</Label><Input id="vs-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} placeholder="Meet at the welcome desk; parking in Lot B." /></div>
              </div>
              <Button size="sm" disabled={!f.startsAt} onClick={() => run(() => admissionsVisits({ action: 'createSlot', startsAt: new Date(f.startsAt).toISOString(), kind: f.kind as never, capacity: Number(f.capacity) || 1, location: f.location, note: f.note }), 'Slot published.')}>Publish slot</Button>
            </div>
          )}
          {!d.slots.length ? <Empty title="No visit slots yet." hint={d.isStaff ? 'Publish the first one above.' : 'Admissions staff publish visit slots here.'} /> : (
            <ul className="space-y-2">{d.slots.map((s: Slot) => (
              <li key={s.id} className="rounded-md border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><b>{KIND[s.kind]}</b> · {fmtDate(s.startsAt)}{s.location ? ` · ${s.location}` : ''}</p>
                  <span className="flex items-center gap-2"><Badge variant="secondary">{s.seatsTaken}/{s.capacity} booked</Badge><Badge>{s.state}</Badge></span>
                </div>
                {s.note && <p className="mt-1 text-muted-foreground">{s.note}</p>}
                {s.bookings.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Coming: {s.bookings.map((b: any) => `${b.name} (${b.guests})`).join(', ')}</p>}
                {d.isStaff && s.state === 'open' && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => run(() => admissionsVisits({ action: 'closeSlot', id: s.id }), 'Slot closed.')}>Close slot</Button></div>}
              </li>
            ))}</ul>
          )}
          {d.isAdmin && (
            <div className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
              <p className="font-medium">Admissions staff</p>
              <p className="text-xs text-muted-foreground">{d.staff.map((m: any) => m.name).join(', ') || 'No admissions staff yet.'}</p>
              <div className="flex flex-wrap gap-2">
                <Input aria-label="Staff email" placeholder="Email" className="max-w-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => run(() => admissionsVisits({ action: 'setStaff', email, on: true }), 'Admissions staff granted.')}>Grant</Button>
                <Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => run(() => admissionsVisits({ action: 'setStaff', email, on: false }), 'Admissions staff removed.')}>Remove</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
