import { useState } from 'react';
import { toast } from 'sonner';
import { registrationChanges } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg, ActionPreview } from './kit';
import { ConfirmAction } from './overlays';

/* eslint-disable @typescript-eslint/no-explicit-any */
const call = async (input: any, ok: string, reload: () => void) => {
  try { const r = await registrationChanges(input); toast(r?.message ?? ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); }
};

/** Student: confirmed seats (drop or swap requests), waitlists with position, and change history. */
export function MyRegistrationChanges({ term }: { term: string }) {
  const s = useLoad(() => registrationChanges({ action: 'mine', term }));
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-4">
        <Panel title="Confirmed seats">
          {!d.seats.length ? <Empty>No seats confirmed by the Registrar yet.</Empty> : <ul className="divide-y divide-border text-sm">{d.seats.map((x: any) => (
            <li key={x.sectionId} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="font-medium">{x.label}</span> <span className="text-xs text-muted-foreground">{x.times}</span></span>
                {x.pending ? <Status value="Change waiting for Registrar" /> : <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setSwapFrom(swapFrom === x.sectionId ? null : x.sectionId); setSwapTo(''); setReason(''); }} aria-expanded={swapFrom === x.sectionId}>Swap</Button>
                  <ConfirmAction trigger={<Button size="sm" variant="ghost">Drop</Button>} title={`Ask to drop ${x.label}?`} confirmLabel="Send drop request" onConfirm={() => call({ action: 'requestDrop', sectionId: x.sectionId, reason: '' }, 'Drop request sent to the Registrar.', s.reload)}>
                    <ActionPreview says="The Registrar reviews it. You keep the seat until they confirm." stays="Your other classes." recovery={{ kind: 'undo', how: 'withdraw the request before the Registrar acts.' }} />
                  </ConfirmAction></span>}
              </div>
              {swapFrom === x.sectionId && <div className="mt-2 grid gap-2">
                <label className="text-xs" htmlFor={`swap-${x.sectionId}`}>Swap into</label>
                <select id={`swap-${x.sectionId}`} className="rounded-md border border-border bg-background p-2 text-sm" value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>
                  <option value="">Choose a section</option>
                  {d.options.map((o: any) => <option key={o.sectionId} value={o.sectionId}>{o.label} · {o.times} · seats {o.seats}{o.full ? ' (full)' : ''}</option>)}
                </select>
                <Textarea aria-label="Reason for the swap" rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <p className="text-xs text-muted-foreground">All or nothing: if the new section is full when the Registrar decides, you keep your current seat.</p>
                <Button size="sm" disabled={!swapTo} onClick={() => { call({ action: 'requestSwap', fromSectionId: x.sectionId, toSectionId: swapTo, reason }, 'Swap request sent to the Registrar.', s.reload); setSwapFrom(null); }}>Send swap request</Button>
              </div>}
            </li>))}</ul>}
        </Panel>
        <Panel title="Waitlists">
          {d.waitlists.length > 0 && <ul className="mb-3 divide-y divide-border text-sm">{d.waitlists.map((w: any) => (
            <li key={w.sectionId} className="flex items-center justify-between gap-2 py-2"><span>{w.label} · position {w.position}</span>
              <Button size="sm" variant="ghost" onClick={() => call({ action: 'leaveWaitlist', sectionId: w.sectionId }, 'Left the waitlist.', s.reload)}>Leave</Button></li>))}</ul>}
          {(() => { const full = d.options.filter((o: any) => o.full && !o.waiting); return !full.length ? <Empty>{d.waitlists.length ? 'No other full sections this term.' : 'No full sections this term.'}</Empty> : (
            <ul className="text-sm">{full.map((o: any) => (
              <li key={o.sectionId} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-0"><span>{o.label} <span className="text-xs text-muted-foreground">{o.times} · full ({o.seats})</span></span>
                <ConfirmAction trigger={<Button size="sm" variant="outline">Join waitlist</Button>} title={`Join the waitlist for ${o.label}?`} confirmLabel="Join waitlist" onConfirm={() => call({ action: 'joinWaitlist', sectionId: o.sectionId }, 'Added to the waitlist.', s.reload)}>
                  <ActionPreview says="If a seat opens, the Registrar's system enrolls the first student waiting, in order. You'll get a notification." stays="Your current schedule and credit limit checks for other requests." recovery={{ kind: 'undo', how: 'leave the waitlist at any time.' }} />
                </ConfirmAction></li>))}</ul>); })()}
        </Panel>
        {d.changes.length > 0 && <Panel title="Change requests">
          <ul className="divide-y divide-border text-sm">{d.changes.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{c.kind === 'swap' ? `Swap ${c.from} → ${c.to}` : `Drop ${c.from}`}{c.message && <span className="block text-xs text-muted-foreground">{c.message}</span>}</span>
              <span className="flex items-center gap-2"><Status value={c.state === 'requested' ? 'Waiting for Registrar' : c.state} />
                {c.state === 'requested' && <Button size="sm" variant="ghost" onClick={() => call({ action: 'withdraw', id: c.id }, 'Request withdrawn.', s.reload)}>Withdraw</Button>}</span>
            </li>))}</ul>
        </Panel>}
      </div>)}
    </Loadable>
  );
}

/** Registrar: drop and swap requests decided atomically, and waitlists by section. */
export function RegistrarChanges() {
  const s = useLoad(() => registrationChanges({ action: 'queue' }));
  const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title={`Drops and swaps · ${d.pending.length} waiting`}>
          {!d.pending.length ? <Empty>No drop or swap requests waiting.</Empty> : d.pending.map((c: any) => (
            <div key={c.id} className="border-t border-border py-2 text-sm first:border-0">
              <p><span className="font-medium">{c.student}</span> · {c.kind === 'swap' ? <>swap {c.from} → {c.to} <span className="text-xs text-muted-foreground">(new section seats {c.toSeats})</span></> : <>drop {c.from}</>}</p>
              {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
              <p className="text-xs text-muted-foreground">{fmt(c.at)}</p>
              {c.self ? <p className="text-xs text-muted-foreground">Your own — another registrar decides</p> : <div className="mt-1 flex flex-wrap gap-2">
                <ConfirmAction trigger={<Button size="sm">Confirm</Button>} title={`Confirm ${c.kind} for ${c.student}?`} confirmLabel="Confirm — decide" onConfirm={() => call({ action: 'decide', id: c.id, approve: true, note: notes[c.id] ?? '' }, 'Decided.', s.reload)}>
                  <ActionPreview says={c.kind === 'swap' ? 'One transaction: the old seat is released only if the new seat is granted. A freed seat goes to the first student on that waitlist.' : 'The seat is released and given to the first student on the waitlist, if any.'} stays="The SIS (not connected — record it there too)." recovery={{ kind: 'request', how: 'the student can request the section again or join its waitlist.' }} />
                </ConfirmAction>
                <input aria-label="Decision note" className="max-w-xs rounded-md border border-border bg-background px-2 text-sm" placeholder="Note (needed to decline)" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                <Button size="sm" variant="outline" onClick={() => call({ action: 'decide', id: c.id, approve: false, note: notes[c.id] ?? '' }, 'Declined.', s.reload)}>Decline</Button>
              </div>}
            </div>))}
          {d.decided.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer">Recently decided</summary>
            <ul>{d.decided.map((c: any) => <li key={c.id} className="border-t border-border py-1.5">{c.student} · {c.kind} {c.from}{c.to && ` → ${c.to}`} · <Status value={c.state} /> <span className="text-xs text-muted-foreground">{c.code} {c.message}</span></li>)}</ul></details>}
        </Panel>
        <Panel title="Waitlists">
          {!d.waitlists.length ? <Empty>No one is waiting.</Empty> : <ul className="text-sm">{d.waitlists.map((w: any) => (
            <li key={w.sectionId} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-0">
              <span>{w.section} · {w.waiting} waiting <span className="block text-xs text-muted-foreground">Seats {w.seats} · oldest {fmt(w.oldest)}</span></span>
              <Button size="sm" variant="outline" onClick={() => call({ action: 'promote', sectionId: w.sectionId }, 'Waitlist checked against current capacity.', s.reload)}>Fill open seats</Button>
            </li>))}</ul>}
          <p className="mt-2 text-xs text-muted-foreground">After raising a section's capacity, use Fill open seats so waiting students get the seats before new requests.</p>
        </Panel>
      </div>)}
    </Loadable>
  );
}
