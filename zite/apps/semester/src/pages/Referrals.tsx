import { useState } from 'react';
import { toast } from 'sonner';
import { referrals } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';

export default function Referrals() {
  const s = useLoad(() => referrals({ action: 'get' }));
  const [f, setF] = useState({ studentId: '', fromApp: '', toApp: '', purpose: '', summary: '' });
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <>
      <PageHeader eyebrow="Help" title="Referrals" sub="Connect a student with another office. The student approves what is shared; the office accepts and closes the loop; every step gets a receipt." />
      <Loadable state={s}>{(d: any) => {
        const cmd = async (h: any, c: string, ok: string) => {
          try { const r: any = await referrals({ action: 'command', key: crypto.randomUUID(), epoch: d.epoch, id: h.id, version: h.version, cmd: c as never, text: notes[h.id] ?? null }); toast(`${ok} Receipt ${r.receipt}.`); s.reload(); }
          catch (e) { toast(`! ${errMsg(e)}`); }
        };
        const Row = ({ h, children }: { h: any; children?: any }) => (
          <div className="border-t border-border py-3 text-sm first:border-0">
            <p className="flex flex-wrap items-center gap-2"><Status value={h.state.replace('_', ' ')} /> #{h.number} · {h.from} → {h.to} · {h.student} · from {h.sender}{h.recipient && ` · with ${h.recipient}`}</p>
            <p className="mt-1">{h.purpose}</p>
            {h.summary ? <p className="mt-1 text-muted-foreground">Shared: {h.summary}</p> : <p className="mt-1 text-xs text-muted-foreground">Details appear once the student approves sharing.</p>}
            {h.outcome && <p className="mt-1">Outcome: {h.outcome}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{fmt(h.createdAt)}{['awaiting_consent', 'queued'].includes(h.state) && ` · expires ${fmt(h.expiresAt)}`}</p>
            {children}
          </div>
        );
        return (
          <div className="grid gap-4">
            {d.mine.length > 0 && <Panel title="Referrals about you">{d.mine.map((h: any) => (
              <Row key={h.id} h={h}>{h.state === 'awaiting_consent' && <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => cmd(h, 'consent', 'Shared with the office.')}>Share this with {h.to}</Button>
                <Button size="sm" variant="outline" onClick={() => cmd(h, 'refuse', 'Not shared.')}>Don't share</Button></div>}</Row>))}</Panel>}
            {d.queue.length > 0 && <Panel title="Incoming to your office">{d.queue.map((h: any) => (
              <Row key={h.id} h={h}>
                {(h.state === 'queued' || h.mineToResolve && h.state === 'accepted') && <Input aria-label="Note" className="mt-2" placeholder={h.state === 'queued' ? 'Reason, if declining' : 'Outcome for the student'} value={notes[h.id] ?? ''} onChange={(e) => setNotes({ ...notes, [h.id]: e.target.value })} />}
                {h.state === 'queued' && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => cmd(h, 'accept', 'Accepted.')}>Accept</Button><Button size="sm" variant="outline" onClick={() => cmd(h, 'decline', 'Declined.')}>Decline</Button></div>}
                {h.mineToResolve && h.state === 'accepted' && <Button className="mt-2" size="sm" onClick={() => cmd(h, 'resolve', 'Resolved.')}>Resolve</Button>}
              </Row>))}</Panel>}
            {d.students.length > 0 && <Panel title="Refer a student">
              <div className="grid gap-2 md:grid-cols-3">
                <select aria-label="Student" className={sel} value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}><option value="">Student…</option>{d.students.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <select aria-label="From" className={sel} value={f.fromApp} onChange={(e) => setF({ ...f, fromApp: e.target.value })}><option value="">From your app…</option>{d.fromApps.map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                <select aria-label="To" className={sel} value={f.toApp} onChange={(e) => setF({ ...f, toApp: e.target.value })}><option value="">To office…</option>{d.toApps.map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
              </div>
              <Input aria-label="Purpose" className="mt-2" placeholder="Why (the student sees this first)" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
              <Textarea aria-label="Minimum summary" className="mt-2" rows={2} placeholder="The least the office needs to know. Shared only if the student agrees." value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
              <Button className="mt-2" size="sm" disabled={!f.studentId || !f.fromApp || !f.toApp || f.purpose.trim().length < 10 || f.summary.trim().length < 10}
                onClick={async () => { try { const r: any = await referrals({ action: 'propose', key: crypto.randomUUID(), epoch: d.epoch, id: crypto.randomUUID(), ...f }); toast(`Sent to the student for approval. Receipt ${r.receipt}.`); setF({ studentId: '', fromApp: '', toApp: '', purpose: '', summary: '' }); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Propose referral</Button>
            </Panel>}
            {d.sent.length > 0 && <Panel title="Referrals you sent">{d.sent.map((h: any) => (
              <Row key={h.id} h={h}>{['awaiting_consent', 'queued'].includes(h.state) && <Button className="mt-2" size="sm" variant="ghost" onClick={() => cmd(h, 'withdraw', 'Withdrawn.')}>Withdraw</Button>}</Row>))}</Panel>}
            {!d.mine.length && !d.queue.length && !d.sent.length && !d.students.length && <Empty>No referrals.</Empty>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
