import { useState } from 'react';
import { toast } from 'sonner';
import { assets } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `ast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const ASTATE: Record<string, string> = { in_service: 'In service', in_repair: 'In repair', retire_requested: 'Disposal requested', disposed: 'Disposed' };
const ALABEL: Record<string, string> = { repair: 'Send to repair', restore: 'Back in service', request_disposal: 'Request disposal', approve_disposal: 'Approve disposal', reject_disposal: 'Reject disposal' };
const RSTATE: Record<string, string> = { reserved: 'Reserved — ready to collect', issued: 'Issued', returned: 'Returned', cancelled: 'Cancelled' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Asset({ x, d, reload }: { x: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [to, setTo] = useState('');
  const [loc, setLoc] = useState(String(x.locationId ?? ''));
  const staff = !!d.kind;
  const need = open === 'request_disposal' || open === 'reject_disposal' ? 10 : open === 'needs_repair' ? 5 : 0;
  const run = () => {
    if (open === 'transfer') return act(() => assets({ action: 'transfer', id: x.id, expectedVersion: x.version, toEmail: to, locationId: loc ? Number(loc) : null, note }), 'Custody recorded.');
    if (open === 'ok' || open === 'needs_repair') return act(() => assets({ action: 'inspect', id: x.id, expectedVersion: x.version, result: open as never, note }), 'Inspection recorded.');
    return act(() => assets({ action: 'astep', id: x.id, step: open as never, expectedVersion: x.version, note }), 'Recorded.');
  };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b className="tabular-nums">{x.tag}</b> · {x.name}<span className="block text-xs text-muted-foreground">{x.category && `${x.category} · `}{x.location ?? 'No location'} · {x.custodian ? `with ${x.custodian}` : 'in store'}</span></span>
        <Status value={ASTATE[x.state] ?? x.state} />
      </div>
      {x.state === 'retire_requested' && <p className="mt-1 text-xs">Disposal requested by {x.disposalRequestedBy}: {x.disposalReason}</p>}
      {staff && x.state !== 'disposed' && (
        <div className="mt-2 flex flex-wrap gap-1">
          {['transfer', 'ok', 'needs_repair', ...x.steps].map((s: string) => (
            <Button key={s} size="sm" variant={open === s ? 'default' : 'outline'} onClick={() => { setOpen(open === s ? null : s); setNote(''); }}>
              {s === 'transfer' ? 'Change custody' : s === 'ok' ? 'Inspected: OK' : s === 'needs_repair' ? 'Inspected: needs repair' : ALABEL[s]}</Button>))}
        </div>)}
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border p-2">
          {open === 'transfer' && <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="Give to (email)" placeholder="Give to (email) — blank returns it to store" value={to} onChange={(e) => setTo(e.target.value)} />
            <label className="text-xs">Location<select className={sel} value={loc} onChange={(e) => setLoc(e.target.value)}><option value="">None</option>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          </div>}
          <Input aria-label="Note" placeholder={need ? 'Reason' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
          {open === 'approve_disposal' && <p className="text-xs text-muted-foreground">Accounting treatment is decided by Finance outside Semester.</p>}
          <Button size="sm" disabled={note.trim().length < need} onClick={async () => { if (await run()) setOpen(null); }}>Confirm</Button>
        </div>)}
      {staff && x.history.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer">Custody history</summary><ul className="mt-1">{x.history.map((h: any, i: number) => <li key={i}>{fmt(h.at)} · {h.from} → {h.to}{h.location ? ` @ ${h.location}` : ''} · by {h.by}{h.note ? ` · ${h.note}` : ''}</li>)}</ul>
        {x.inspections.length > 0 && <ul className="mt-1">{x.inspections.map((h: any, i: number) => <li key={i}>{fmt(h.at)} · inspection {h.result.replace('_', ' ')}{h.note ? ` · ${h.note}` : ''} · {h.by}</li>)}</ul>}</details>}
    </li>
  );
}

function Stock({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [req, setReq] = useState<{ itemId: number; locationId: number } | null>(null);
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [count, setCount] = useState<Record<string, string>>({});
  const [k, setK] = useState(key());
  return d.items.length ? (
    <ul>{d.items.map((i: any) => (
      <li key={i.id} className="border-t border-border py-2 text-sm first:border-0">
        <b>{i.name}</b> <span className="text-xs text-muted-foreground">{i.sku} · per {i.unit}</span>
        <ul className="mt-1">{i.stock.map((s: any) => {
          const id = `${i.id}:${s.locationId}`;
          return (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
              <span>{s.location}: {s.free} available{d.kind ? ` (${s.onHand} on hand, ${s.reserved} reserved)` : ''}</span>
              <span className="flex flex-wrap items-center gap-2">
                {s.free > 0 && <Button size="sm" variant="outline" onClick={() => { setReq(req && req.itemId === i.id && req.locationId === s.locationId ? null : { itemId: i.id, locationId: s.locationId }); setQty(1); }}>Request</Button>}
                {d.kind && <><Input aria-label={`Count at ${s.location}`} inputMode="numeric" placeholder="Counted" className="h-8 w-24" value={count[id] ?? ''} onChange={(e) => setCount({ ...count, [id]: e.target.value.replace(/\D/g, '') })} />
                  <Button size="sm" variant="ghost" disabled={!count[id]} onClick={async () => { if (await act(() => assets({ action: 'count', itemId: i.id, locationId: s.locationId, counted: Number(count[id]), note: '' }), 'Count recorded. A difference waits for a controller.')) setCount({ ...count, [id]: '' }); }}>Record count</Button></>}
              </span>
              {req && req.itemId === i.id && req.locationId === s.locationId && (
                <span className="flex w-full flex-wrap items-center gap-2">
                  <Input aria-label="Quantity" type="number" min={1} max={s.free} className="h-8 w-20" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                  <Input aria-label="Purpose" placeholder="What it's for" className="h-8 max-w-xs" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                  <Button size="sm" onClick={async () => { if (await act(() => assets({ action: 'reserve', requestKey: k, itemId: i.id, locationId: s.locationId, qty, purpose }), 'Reserved. Collect it from inventory staff.')) { setReq(null); setK(key()); setPurpose(''); } }}>Reserve {qty}</Button>
                </span>)}
            </li>);
        })}{i.stock.length === 0 && <li className="text-xs text-muted-foreground">Not stocked anywhere yet.</li>}</ul>
      </li>))}</ul>
  ) : <Empty>No stock items yet.</Empty>;
}

function Requests({ d, reload, staffView }: { d: any; reload: () => void; staffView: boolean }) {
  const act = useAct(reload);
  const [ret, setRet] = useState<Record<number, string>>({});
  const list = d.reservations.filter((r: any) => (staffView ? !r.mine : r.mine));
  return list.length ? (
    <ul>{list.map((r: any) => (
      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
        <span>{r.qty} × {r.item} @ {r.location}<span className="block text-xs text-muted-foreground">{staffView ? `${r.requester} · ` : ''}{r.purpose}{r.returnedQty ? ` · ${r.returnedQty} returned` : ''}</span></span>
        <span className="flex flex-wrap items-center gap-2"><Status value={RSTATE[r.state] ?? r.state} />
          {staffView && r.state === 'reserved' && <Button size="sm" onClick={() => act(() => assets({ action: 'rstep', id: r.id, step: 'issue', expectedVersion: r.version, qty: null }), 'Issued.')}>Issue</Button>}
          {r.state === 'reserved' && <Button size="sm" variant="ghost" onClick={() => act(() => assets({ action: 'rstep', id: r.id, step: 'cancel', expectedVersion: r.version, qty: null }), 'Cancelled.')}>Cancel</Button>}
          {staffView && r.state === 'issued' && <><Input aria-label="Quantity returned" inputMode="numeric" className="h-8 w-16" placeholder="Qty" value={ret[r.id] ?? ''} onChange={(e) => setRet({ ...ret, [r.id]: e.target.value.replace(/\D/g, '') })} />
            <Button size="sm" variant="outline" disabled={!ret[r.id]} onClick={() => act(() => assets({ action: 'rstep', id: r.id, step: 'return', expectedVersion: r.version, qty: Number(ret[r.id]) }), 'Return recorded.')}>Record return</Button></>}
        </span>
      </li>))}</ul>
  ) : <Empty>{staffView ? 'No requests.' : 'You have no stock requests.'}</Empty>;
}

function Adjustments({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [note, setNote] = useState<Record<number, string>>({});
  return d.adjustments.length ? (
    <ul>{d.adjustments.map((j: any) => (
      <li key={j.id} className="border-t border-border py-2 text-sm first:border-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><span>{j.item} @ {j.location}: counted {j.counted}, system had {j.onHandAtCount} ({j.delta > 0 ? '+' : ''}{j.delta})<span className="block text-xs text-muted-foreground">by {j.countedBy} · {fmt(j.at)}{j.decidedBy ? ` · ${j.state} by ${j.decidedBy}` : ''}</span></span><Status value={j.state} /></div>
        {j.state === 'pending' && d.kind === 'controller' && !j.mine && <div className="mt-1 flex flex-wrap gap-2">
          <Input aria-label="Note" placeholder="Note (required to reject)" className="h-8 max-w-xs" value={note[j.id] ?? ''} onChange={(e) => setNote({ ...note, [j.id]: e.target.value })} />
          <Button size="sm" onClick={() => act(() => assets({ action: 'adjust', id: j.id, approve: true, note: note[j.id] ?? '' }), 'Adjustment applied.')}>Approve</Button>
          <Button size="sm" variant="outline" disabled={(note[j.id] ?? '').trim().length < 5} onClick={() => act(() => assets({ action: 'adjust', id: j.id, approve: false, note: note[j.id] ?? '' }), 'Rejected.')}>Reject</Button></div>}
        {j.state === 'pending' && j.mine && <p className="text-xs text-muted-foreground">Waiting for another controller.</p>}
      </li>))}</ul>
  ) : <Empty>No count differences.</Empty>;
}

function Setup({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [loc, setLoc] = useState('');
  const [it, setIt] = useState({ sku: '', name: '', unit: 'each' });
  const [as, setAs] = useState({ tag: '', name: '', category: '', locationId: '' });
  const [rs, setRs] = useState({ itemId: '', locationId: '', qty: 1 });
  const [k1, setK1] = useState(key()); const [k2, setK2] = useState(key());
  const [email, setEmail] = useState(''); const [kind, setKind] = useState('clerk');
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      {d.kind && <>
        <div className="space-y-2"><p className="text-xs font-medium">Receive an asset</p>
          <div className="flex gap-2"><Input aria-label="Tag" placeholder="Tag" value={as.tag} onChange={(e) => setAs({ ...as, tag: e.target.value })} /><Input aria-label="Category" placeholder="Category" value={as.category} onChange={(e) => setAs({ ...as, category: e.target.value })} /></div>
          <Input aria-label="Asset name" placeholder="Name" value={as.name} onChange={(e) => setAs({ ...as, name: e.target.value })} />
          <select aria-label="Location" className={sel} value={as.locationId} onChange={(e) => setAs({ ...as, locationId: e.target.value })}><option value="">No location</option>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Button size="sm" disabled={as.tag.trim().length < 2 || as.name.trim().length < 2} onClick={async () => { if (await act(() => assets({ action: 'receiveAsset', requestKey: k1, tag: as.tag, name: as.name, category: as.category, locationId: as.locationId ? Number(as.locationId) : null }), 'Asset received.')) { setK1(key()); setAs({ tag: '', name: '', category: '', locationId: as.locationId }); } }}>Receive asset</Button></div>
        <div className="space-y-2"><p className="text-xs font-medium">Receive stock</p>
          <select aria-label="Item" className={sel} value={rs.itemId} onChange={(e) => setRs({ ...rs, itemId: e.target.value })}><option value="">Item…</option>{d.items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}</select>
          <select aria-label="Location" className={sel} value={rs.locationId} onChange={(e) => setRs({ ...rs, locationId: e.target.value })}><option value="">Location…</option>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Input aria-label="Quantity" type="number" min={1} value={rs.qty} onChange={(e) => setRs({ ...rs, qty: Math.max(1, Number(e.target.value) || 1) })} />
          <Button size="sm" disabled={!rs.itemId || !rs.locationId} onClick={async () => { if (await act(() => assets({ action: 'receiveStock', requestKey: k2, itemId: Number(rs.itemId), locationId: Number(rs.locationId), qty: rs.qty }), 'Stock received.')) setK2(key()); }}>Receive stock</Button></div>
      </>}
      {d.kind === 'controller' && <>
        <div className="space-y-2"><p className="text-xs font-medium">Locations · {d.locations.length}</p>
          <div className="flex gap-2"><Input aria-label="Location name" placeholder="Location name" value={loc} onChange={(e) => setLoc(e.target.value)} /><Button size="sm" disabled={!loc.trim()} onClick={async () => { if (await act(() => assets({ action: 'location', name: loc }), 'Location added.')) setLoc(''); }}>Add</Button></div></div>
        <div className="space-y-2"><p className="text-xs font-medium">New stock item</p>
          <div className="flex gap-2"><Input aria-label="SKU" placeholder="SKU" value={it.sku} onChange={(e) => setIt({ ...it, sku: e.target.value })} /><Input aria-label="Unit" placeholder="Unit" value={it.unit} onChange={(e) => setIt({ ...it, unit: e.target.value })} /></div>
          <Input aria-label="Item name" placeholder="Name" value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} />
          <Button size="sm" disabled={it.sku.trim().length < 2 || it.name.trim().length < 2} onClick={async () => { if (await act(() => assets({ action: 'item', ...it }), 'Item added.')) setIt({ sku: '', name: '', unit: 'each' }); }}>Add item</Button></div>
      </>}
      {d.isAdmin && <div className="space-y-2 md:col-span-2"><p className="text-xs font-medium">Inventory access</p>
        <ul className="text-xs">{d.staff.map((s: any, i: number) => <li key={i}>{s.name} — {s.kind}</li>)}</ul>
        <div className="flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select aria-label="Role" className="rounded-md border border-border bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}><option value="clerk">Clerk</option><option value="controller">Controller</option><option value="none">Remove access</option></select>
          <Button size="sm" disabled={!email.includes('@')} onClick={() => act(() => assets({ action: 'setStaff', email, kind: kind as never }), 'Saved.')}>Save</Button></div>
        <p className="text-xs text-muted-foreground">Controllers approve disposals and count adjustments raised by someone else. You cannot change your own access.</p></div>}
    </div>
  );
}

export default function Inventory() {
  const s = useLoad(() => assets({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="Inventory" sub="Request supplies and see equipment in your care. Inventory staff track custody, stock and counts." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.assets.filter((x: any) => x.mine);
        return (
          <div className="space-y-4">
            <Panel title="Supplies"><Stock d={d} reload={s.reload} /></Panel>
            <Panel title="My requests"><Requests d={d} reload={s.reload} staffView={false} /></Panel>
            <Panel title={`Equipment in my care · ${mine.length}`}>{mine.length ? <ul className="space-y-2">{mine.map((x: any) => <Asset key={x.id} x={x} d={d} reload={s.reload} />)}</ul> : <Empty>Nothing is signed out to you.</Empty>}</Panel>
            {d.kind && <>
              <Panel title="Stock requests"><Requests d={d} reload={s.reload} staffView /></Panel>
              <Panel title={`Assets · ${d.assets.length}`}>{d.assets.length ? <ul className="space-y-2">{d.assets.map((x: any) => <Asset key={x.id} x={x} d={d} reload={s.reload} />)}</ul> : <Empty>No assets yet.</Empty>}</Panel>
              <Panel title="Count differences"><Adjustments d={d} reload={s.reload} /></Panel>
            </>}
            {(d.kind || d.isAdmin) && <Panel title="Set up"><Setup d={d} reload={s.reload} /></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
