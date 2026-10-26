import { useState } from 'react';
import { toast } from 'sonner';
import { facilities } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `fac-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const CATS: Record<string, string> = { plumbing: 'Plumbing', electrical: 'Electrical', heating_cooling: 'Heating or cooling', lighting: 'Lighting', doors_locks: 'Doors and locks', cleaning: 'Cleaning', grounds: 'Grounds', safety_hazard: 'Safety hazard', other: 'Other' };
const OSTATE: Record<string, string> = { new: 'New', authorized: 'Authorized', assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed — to inspect', closed: 'Closed', cancelled: 'Cancelled' };
const OLABEL: Record<string, string> = { authorize: 'Authorize', assign: 'Assign', start: 'Start work', complete: 'Mark complete', close: 'Inspect and close', reopen: 'Reopen', cancel: 'Cancel' };
const PRI: Record<string, string> = { p1: 'Urgent', p2: 'High', p3: 'Normal', p4: 'Low' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Report({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [f, setF] = useState({ locationId: '', category: 'other', description: '' });
  const [k, setK] = useState(key());
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Where<select className={sel} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Choose…</option>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
      <label className="text-xs">What kind<select className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <Textarea aria-label="What's wrong" className="sm:col-span-2" placeholder="What's wrong, and exactly where" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      {f.category === 'safety_hazard' && <p className="text-xs text-muted-foreground sm:col-span-2">If anyone is in danger, call campus emergency services now — Semester is not an emergency line.</p>}
      <div><Button size="sm" disabled={!f.locationId || f.description.trim().length < 10} onClick={async () => { if (await act(() => facilities({ action: 'report', requestKey: k, locationId: Number(f.locationId), category: f.category as never, description: f.description }), 'Reported. You will see its status here.')) { setK(key()); setF({ ...f, description: '' }); } }}>Report problem</Button></div>
    </div>
  );
}

function Triage({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [open, setOpen] = useState<number | null>(null);
  const [f, setF] = useState({ title: '', priority: 'p3', note: '', dup: '' });
  return d.queue.length ? (
    <ul className="space-y-2">{d.queue.map((q: any) => (
      <li key={q.id} className="rounded-md border border-border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><span><b>#{q.id} {CATS[q.category]}</b> · {q.location}<span className="block text-xs text-muted-foreground">{q.requester} · {fmt(q.createdAt)}</span></span><Status value={q.state === 'open' ? 'New' : 'Reviewed'} /></div>
        <p className="mt-1 text-xs">{q.description}</p>
        {q.similar.length > 0 && <p className="mt-1 text-xs">Possibly the same as #{q.similar.join(', #')}.</p>}
        <Button size="sm" variant="outline" className="mt-2" onClick={() => { setOpen(open === q.id ? null : q.id); setF({ title: '', priority: q.category === 'safety_hazard' ? 'p1' : 'p3', note: '', dup: q.similar[0] ? String(q.similar[0]) : '' }); }}>Triage</Button>
        {open === q.id && (
          <div className="mt-2 grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2">
            <Input aria-label="Work order title" placeholder={`Title (default: ${CATS[q.category]})`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <select aria-label="Priority" className="rounded-md border border-border bg-background p-2 text-sm" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{Object.entries(PRI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <Button size="sm" onClick={() => act(() => facilities({ action: 'triage', id: q.id, expectedVersion: q.version, step: 'convert', title: f.title, priority: f.priority as never }), 'Work order created.')}>Create work order</Button>
            <div className="flex gap-2"><Input aria-label="Duplicate of report number" inputMode="numeric" placeholder="Same as report #" value={f.dup} onChange={(e) => setF({ ...f, dup: e.target.value.replace(/\D/g, '') })} />
              <Button size="sm" variant="outline" disabled={!f.dup} onClick={() => act(() => facilities({ action: 'triage', id: q.id, expectedVersion: q.version, step: 'duplicate', duplicateOf: Number(f.dup) }), 'Marked as a duplicate.')}>Duplicate</Button></div>
            <Input aria-label="Reason" className="sm:col-span-2" placeholder="Reason (needed to decline)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <Button size="sm" variant="ghost" disabled={f.note.trim().length < 5} onClick={() => act(() => facilities({ action: 'triage', id: q.id, expectedVersion: q.version, step: 'decline', note: f.note }), 'Declined.')}>Decline</Button>
          </div>)}
      </li>))}</ul>
  ) : <Empty>No new reports.</Empty>;
}

function Order({ o, d, reload }: { o: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [who, setWho] = useState('');
  const need = open === 'complete' ? 20 : open === 'reopen' || open === 'cancel' ? 5 : 0;
  const workers = d.workers.filter((w: any) => !(o.restricted && w.kind === 'contractor'));
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b>WO-{o.id} {o.title}</b><span className="block text-xs text-muted-foreground">{o.location}{o.restricted ? ' · restricted' : ''} · {PRI[o.priority]}{o.planned ? ` · planned, due ${o.dueDate}` : ''}{o.assignee ? ` · ${o.assignee}` : ''}</span></span>
        <Status value={OSTATE[o.state] ?? o.state} />
      </div>
      {o.detail && <p className="mt-1 text-xs">{o.detail}</p>}
      {o.evidence && <p className="mt-1 text-xs"><b>Completion evidence:</b> {o.evidence}</p>}
      {o.note && <p className="mt-1 text-xs"><b>Note:</b> {o.note}</p>}
      {o.closedBy && <p className="mt-1 text-xs">Inspected and closed by {o.closedBy}.</p>}
      {o.steps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{o.steps.map((s: string) => <Button key={s} size="sm" variant={open === s ? 'default' : 'outline'} onClick={() => { setOpen(open === s ? null : s); setNote(''); }}>{OLABEL[s]}</Button>)}</div>}
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border p-2">
          {open === 'assign' && <select aria-label="Assign to" className={sel} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose…</option>{workers.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.kind}{w.until ? `, until ${fmt(w.until)}` : ''})</option>)}</select>}
          {open === 'assign' && o.restricted && <p className="text-xs text-muted-foreground">Restricted location: contractors are not listed.</p>}
          {need > 0 && <Textarea aria-label={OLABEL[open]} placeholder={open === 'complete' ? 'What was done and how it was checked' : 'Reason'} value={note} onChange={(e) => setNote(e.target.value)} />}
          {open === 'close' && <p className="text-xs">Close only after checking the completion evidence above.</p>}
          <Button size="sm" disabled={note.trim().length < need || (open === 'assign' && !who)} onClick={async () => { if (await act(() => facilities({ action: 'ostep', id: o.id, step: open as never, expectedVersion: o.version, note, assigneeId: open === 'assign' ? who : null }), 'Recorded.')) setOpen(null); }}>{OLABEL[open]}</Button>
        </div>)}
    </li>
  );
}

function Setup({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [loc, setLoc] = useState({ building: '', area: '', restricted: false });
  const [wo, setWo] = useState({ locationId: '', title: '', detail: '', priority: 'p3' });
  const [pl, setPl] = useState({ locationId: '', title: '', everyDays: 90, firstDue: new Date().toISOString().slice(0, 10) });
  const [st, setSt] = useState({ email: '', kind: 'technician', expiresOn: '' });
  const locSel = (v: string, on: (v: string) => void) => <select aria-label="Location" className={sel} value={v} onChange={(e) => on(e.target.value)}><option value="">Location…</option>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.label}{l.restricted ? ' (restricted)' : ''}</option>)}</select>;
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      {d.kind === 'coordinator' && <>
        <div className="space-y-2"><p className="text-xs font-medium">Location</p>
          <div className="flex gap-2"><Input aria-label="Building" placeholder="Building" value={loc.building} onChange={(e) => setLoc({ ...loc, building: e.target.value })} /><Input aria-label="Area" placeholder="Room / area" value={loc.area} onChange={(e) => setLoc({ ...loc, area: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={loc.restricted} onChange={(e) => setLoc({ ...loc, restricted: e.target.checked })} /> Restricted (no contractors)</label>
          <Button size="sm" disabled={!loc.building.trim()} onClick={() => act(() => facilities({ action: 'location', ...loc }), 'Location saved.')}>Save location</Button></div>
        <div className="space-y-2"><p className="text-xs font-medium">New work order</p>
          {locSel(wo.locationId, (v) => setWo({ ...wo, locationId: v }))}
          <Input aria-label="Title" placeholder="Title" value={wo.title} onChange={(e) => setWo({ ...wo, title: e.target.value })} />
          <select aria-label="Priority" className={sel} value={wo.priority} onChange={(e) => setWo({ ...wo, priority: e.target.value })}>{Object.entries(PRI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <Button size="sm" disabled={!wo.locationId || wo.title.trim().length < 3} onClick={async () => { if (await act(() => facilities({ action: 'createOrder', locationId: Number(wo.locationId), title: wo.title, detail: wo.detail, priority: wo.priority as never }), 'Work order created.')) setWo({ ...wo, title: '' }); }}>Create</Button></div>
        <div className="space-y-2"><p className="text-xs font-medium">Planned maintenance · {d.plans.length}</p>
          <ul className="text-xs">{d.plans.map((p: any) => <li key={p.id}>{p.title} · {p.location} · every {p.everyDays} days · next {p.nextDue}</li>)}</ul>
          {locSel(pl.locationId, (v) => setPl({ ...pl, locationId: v }))}
          <Input aria-label="Plan title" placeholder="What to do" value={pl.title} onChange={(e) => setPl({ ...pl, title: e.target.value })} />
          <div className="flex gap-2"><label className="text-xs">Every (days)<Input type="number" min={1} className="mt-1" value={pl.everyDays} onChange={(e) => setPl({ ...pl, everyDays: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label className="text-xs">First due<Input type="date" className="mt-1" value={pl.firstDue} onChange={(e) => setPl({ ...pl, firstDue: e.target.value })} /></label></div>
          <div className="flex gap-2"><Button size="sm" disabled={!pl.locationId || pl.title.trim().length < 3} onClick={() => act(() => facilities({ action: 'plan', locationId: Number(pl.locationId), title: pl.title, everyDays: pl.everyDays, firstDue: pl.firstDue }), 'Plan created.')}>Add plan</Button>
            <Button size="sm" variant="outline" onClick={() => act(() => facilities({ action: 'generate' }), 'Due planned work generated.')}>Generate due work</Button></div></div>
      </>}
      {d.isAdmin && <div className="space-y-2"><p className="text-xs font-medium">Facilities access</p>
        <ul className="text-xs">{d.staff.map((s: any, i: number) => <li key={i}>{s.name} — {s.kind}{s.until ? ` until ${fmt(s.until)}` : ''}</li>)}</ul>
        <Input aria-label="Member email" placeholder="Member email" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
        <div className="flex gap-2"><select aria-label="Role" className={sel} value={st.kind} onChange={(e) => setSt({ ...st, kind: e.target.value })}><option value="coordinator">Coordinator</option><option value="technician">Technician</option><option value="contractor">Contractor</option><option value="none">Remove access</option></select>
          {st.kind === 'contractor' && <label className="text-xs">Access ends<Input type="date" className="mt-1" value={st.expiresOn} onChange={(e) => setSt({ ...st, expiresOn: e.target.value })} /></label>}</div>
        <Button size="sm" disabled={!st.email.includes('@') || (st.kind === 'contractor' && !st.expiresOn)} onClick={() => act(() => facilities({ action: 'setStaff', email: st.email, kind: st.kind as never, expiresOn: st.kind === 'contractor' ? st.expiresOn : null }), 'Saved.')}>Save</Button>
        <p className="text-xs text-muted-foreground">Contractor access stops on its end date. You cannot change your own access.</p></div>}
    </div>
  );
}

export default function Facilities() {
  const s = useLoad(() => facilities({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="Facilities" sub="Report something broken in a campus building and follow its status. Problems in your residence hall go to Housing." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Report a problem">{d.locations.length ? <Report d={d} reload={s.reload} /> : <Empty>Facilities has not listed any locations yet.</Empty>}</Panel>
          <Panel title={`My reports · ${d.myReports.length}`}>{d.myReports.length ? <ul>{d.myReports.map((r: any) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
              <span>{CATS[r.category]} · {r.location}<span className="block text-xs text-muted-foreground">{fmt(r.createdAt)} · {r.description.slice(0, 120)}</span></span><Status value={r.status} /></li>))}</ul> : <Empty>You have not reported anything.</Empty>}</Panel>
          {d.kind === 'coordinator' && <Panel title={`New reports · ${d.queue.length}`}><Triage d={d} reload={s.reload} /></Panel>}
          {d.kind && <Panel title={d.kind === 'coordinator' ? 'Work orders' : 'My assigned work'}>{d.orders.length ? <ul className="space-y-2">{d.orders.map((o: any) => <Order key={o.id} o={o} d={d} reload={s.reload} />)}</ul> : <Empty>No work orders.</Empty>}</Panel>}
          {(d.kind === 'coordinator' || d.isAdmin) && <Panel title="Set up"><Setup d={d} reload={s.reload} /></Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
