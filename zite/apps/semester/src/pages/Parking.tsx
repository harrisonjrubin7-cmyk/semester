import { useState } from 'react';
import { toast } from 'sonner';
import { parking } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmtDay } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `prk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const money = (c: number | null) => (c === null ? '—' : `$${(c / 100).toFixed(2)}`);
const PSTATE: Record<string, string> = { applied: 'Applied', waitlisted: 'On the waitlist', issued: 'Issued', declined: 'Declined', revoked: 'Revoked', withdrawn: 'Withdrawn', expired: 'Expired' };
const PLABEL: Record<string, string> = { allocate: 'Issue permit', waitlist: 'Waitlist', decline: 'Decline', revoke: 'Revoke', withdraw: 'Withdraw' };
const CSTATE: Record<string, string> = { issued: 'Issued', appealed: 'Under appeal', upheld: 'Appeal upheld the citation', dismissed: 'Dismissed on appeal', reduced: 'Reduced on appeal', voided: 'Voided' };
const CLABEL: Record<string, string> = { appeal: 'Appeal', upheld: 'Uphold', dismissed: 'Dismiss', reduced: 'Reduce', void: 'Void', correct_plate: 'Correct plate' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Vehicles({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [f, setF] = useState({ plate: '', region: '', description: '' });
  return (
    <div className="space-y-2 text-sm">
      {d.vehicles.length ? <ul>{d.vehicles.map((v: any) => (
        <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-0">
          <span><b className="tabular-nums">{v.plate}</b> · {v.region}{v.description && ` · ${v.description}`}</span>
          {v.active ? <Button size="sm" variant="ghost" onClick={() => act(() => parking({ action: 'vehicle', id: v.id, plate: v.plate, region: v.region, description: v.description, active: false }), 'Vehicle removed.')}>Remove</Button> : <Status value="Removed" />}
        </li>))}</ul> : <Empty>No vehicles registered.</Empty>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Plate" placeholder="Plate" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} />
        <Input aria-label="State or region" placeholder="State / region" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        <Input aria-label="Description" placeholder="Make, colour (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <Button size="sm" disabled={f.plate.trim().length < 2 || f.region.trim().length < 2} onClick={async () => { if (await act(() => parking({ action: 'vehicle', id: null, ...f, active: true }), 'Vehicle registered.')) setF({ plate: '', region: '', description: '' }); }}>Register vehicle</Button>
    </div>
  );
}

function PermitStep({ p, step, reload }: { p: any; step: string; reload: () => void }) {
  const act = useAct(reload);
  const [note, setNote] = useState('');
  const need = step === 'decline' || step === 'revoke' ? 5 : 0;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      {need > 0 && <Input aria-label="Reason" placeholder="Reason" className="max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} />}
      <Button size="sm" variant={step === 'allocate' ? 'default' : 'outline'} disabled={note.trim().length < need} onClick={() => act(() => parking({ action: 'pstep', id: p.id, step: step as never, expectedVersion: p.version, note }), 'Recorded.')}>{PLABEL[step]}</Button>
    </div>
  );
}

function Permits({ d, reload, staffView }: { d: any; reload: () => void; staffView: boolean }) {
  const act = useAct(reload);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ zoneId: '', vehicleId: '', term: '', validFrom: today, validTo: '' });
  const [k, setK] = useState(key());
  const list = d.permits.filter((p: any) => (staffView ? !p.mine : p.mine));
  return (
    <div className="space-y-3 text-sm">
      {list.length ? <ul>{list.map((p: any) => (
        <li key={p.id} className="border-t border-border py-2 first:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>{p.zone}</b> · {p.vehicle} · {p.term}<span className="block text-xs text-muted-foreground">{staffView ? `${p.holder} · ` : ''}{p.validFrom} to {p.validTo}{p.note ? ` · ${p.note}` : ''}</span></span>
            <Status value={PSTATE[p.state] ?? p.state} />
          </div>
          {p.steps.length > 0 && <div className="flex flex-wrap gap-2">{p.steps.map((s: string) => <PermitStep key={s} p={p} step={s} reload={reload} />)}</div>}
        </li>))}</ul> : <Empty>{staffView ? 'No applications.' : 'No permits yet.'}</Empty>}
      {!staffView && (d.vehicles.some((v: any) => v.active) && d.zones.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs">Zone<select className={sel} value={f.zoneId} onChange={(e) => setF({ ...f, zoneId: e.target.value })}><option value="">Choose…</option>{d.zones.filter((z: any) => z.active).map((z: any) => <option key={z.id} value={z.id}>{z.name} — {Math.max(0, z.capacity - z.issued)} free</option>)}</select></label>
          <label className="text-xs">Vehicle<select className={sel} value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })}><option value="">Choose…</option>{d.vehicles.filter((v: any) => v.active).map((v: any) => <option key={v.id} value={v.id}>{v.plate} ({v.region})</option>)}</select></label>
          <Input aria-label="Term" placeholder="Term, e.g. Spring 2027" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
          <div className="flex gap-2"><label className="text-xs">From<Input type="date" className="mt-1" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} /></label>
            <label className="text-xs">To<Input type="date" className="mt-1" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></label></div>
          <div><Button size="sm" disabled={!f.zoneId || !f.vehicleId || f.term.trim().length < 2 || !f.validTo} onClick={async () => { if (await act(() => parking({ action: 'apply', requestKey: k, zoneId: Number(f.zoneId), vehicleId: Number(f.vehicleId), term: f.term, validFrom: f.validFrom, validTo: f.validTo }), 'Application sent.')) { setK(key()); setF({ ...f, term: '', validTo: '' }); } }}>Apply for a permit</Button></div>
        </div>) : <p className="text-xs text-muted-foreground">{d.zones.length ? 'Register a vehicle to apply for a permit.' : 'No parking zones are set up yet.'}</p>)}
    </div>
  );
}

function CitationStep({ c, step, reload }: { c: any; step: string; reload: () => void }) {
  const act = useAct(reload);
  const [note, setNote] = useState('');
  const [cents, setCents] = useState('');
  const [plate, setPlate] = useState('');
  const [region, setRegion] = useState('');
  const need = step === 'appeal' ? 20 : step === 'void' || step === 'correct_plate' ? 5 : 10;
  const go = () => act(() => parking({ action: 'cstep', id: c.id, step: step as never, expectedVersion: c.version, note, newCents: step === 'reduced' ? Math.round(Number(cents) * 100) : null, plate, region }), step === 'appeal' ? 'Appeal sent. Someone other than the issuing officer will decide it.' : 'Recorded.');
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2">
      {step === 'correct_plate' && <div className="flex gap-2"><Input aria-label="Correct plate" placeholder="Correct plate" value={plate} onChange={(e) => setPlate(e.target.value)} /><Input aria-label="Region" placeholder="Region (blank = same)" value={region} onChange={(e) => setRegion(e.target.value)} /></div>}
      {step === 'reduced' && <Input aria-label="New amount in dollars" inputMode="decimal" placeholder={`New amount, below ${money(c.amountCents)}`} value={cents} onChange={(e) => setCents(e.target.value.replace(/[^\d.]/g, ''))} />}
      <Textarea aria-label={CLABEL[step]} placeholder={step === 'appeal' ? 'Why this citation is wrong' : 'Reason'} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" disabled={note.trim().length < need || (step === 'correct_plate' && plate.trim().length < 2) || (step === 'reduced' && !cents)} onClick={go}>{CLABEL[step]}</Button>
    </div>
  );
}

function Citations({ d, reload, staffView }: { d: any; reload: () => void; staffView: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = d.citations.filter((c: any) => (staffView ? !c.mine : c.mine));
  return list.length ? (
    <ul className="space-y-2 text-sm">{list.map((c: any) => (
      <li key={c.id} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span><b className="tabular-nums">{c.plate}</b>{c.zone && ` · ${c.zone}`} · {money(c.finalCents ?? c.amountCents)}<span className="block text-xs text-muted-foreground">Issued {fmtDay(c.issuedAt)} · {c.reason}{c.unmatched && staffView ? ' · no registered vehicle matches' : ''}</span></span>
          <Status value={CSTATE[c.state] ?? c.state} />
        </div>
        {c.appealText && <p className="mt-1 text-xs"><b>Appeal:</b> {c.appealText}</p>}
        {c.decisionNote && <p className="mt-1 text-xs"><b>Decision:</b> {c.decisionNote}</p>}
        {c.mine && c.state === 'issued' && <p className="mt-1 text-xs text-muted-foreground">You can appeal until {fmtDay(c.appealBy)}. Pay through the parking office — Semester does not take payments.</p>}
        {c.steps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.steps.map((s: string) => <Button key={s} size="sm" variant={open === `${c.id}:${s}` ? 'default' : 'outline'} onClick={() => setOpen(open === `${c.id}:${s}` ? null : `${c.id}:${s}`)}>{CLABEL[s]}</Button>)}</div>}
        {open?.startsWith(`${c.id}:`) && <CitationStep c={c} step={open.split(':')[1]} reload={() => { setOpen(null); reload(); }} />}
      </li>))}</ul>
  ) : <Empty>{staffView ? 'No citations.' : 'No citations on your vehicles.'}</Empty>;
}

function StaffTools({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [z, setZ] = useState({ name: '', capacity: 50 });
  const [c, setC] = useState({ plate: '', region: '', zoneId: '', reason: '', amount: '' });
  const [k, setK] = useState(key());
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium">Zones</p>
        <ul className="text-xs">{d.zones.map((x: any) => <li key={x.id}>{x.name}: {x.issued} of {x.capacity} issued{x.waiting ? `, ${x.waiting} waiting` : ''}{x.active ? '' : ' (inactive)'}</li>)}</ul>
        <div className="flex gap-2"><Input aria-label="Zone name" placeholder="Zone name" value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} />
          <Input aria-label="Capacity" type="number" min={0} className="w-24" value={z.capacity} onChange={(e) => setZ({ ...z, capacity: Math.max(0, Number(e.target.value) || 0) })} /></div>
        <Button size="sm" disabled={!z.name.trim()} onClick={() => act(() => parking({ action: 'zone', id: null, name: z.name, capacity: z.capacity, active: true }), 'Zone added.')}>Add zone</Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Issue a citation</p>
        <div className="flex gap-2"><Input aria-label="Plate" placeholder="Plate" value={c.plate} onChange={(e) => setC({ ...c, plate: e.target.value })} /><Input aria-label="Region" placeholder="Region" value={c.region} onChange={(e) => setC({ ...c, region: e.target.value })} /></div>
        <label className="block text-xs">Zone<select className={sel} value={c.zoneId} onChange={(e) => setC({ ...c, zoneId: e.target.value })}><option value="">None</option>{d.zones.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <Input aria-label="Reason" placeholder="Reason" value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} />
        <Input aria-label="Amount in dollars" inputMode="decimal" placeholder="Amount ($)" value={c.amount} onChange={(e) => setC({ ...c, amount: e.target.value.replace(/[^\d.]/g, '') })} />
        <Button size="sm" disabled={c.plate.trim().length < 2 || c.region.trim().length < 2 || c.reason.trim().length < 5 || !c.amount} onClick={async () => { if (await act(() => parking({ action: 'cite', requestKey: k, plate: c.plate, region: c.region, zoneId: c.zoneId ? Number(c.zoneId) : null, reason: c.reason, amountCents: Math.round(Number(c.amount) * 100) }), 'Citation issued.')) { setK(key()); setC({ plate: '', region: '', zoneId: '', reason: '', amount: '' }); } }}>Issue citation</Button>
      </div>
    </div>
  );
}

function Access({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState('staff');
  return (
    <div className="space-y-2 text-sm">
      <ul className="text-xs">{d.staff.map((s: any, i: number) => <li key={i}>{s.name} — {s.kind === 'staff' ? 'parking staff' : 'appeal adjudicator'}</li>)}</ul>
      <div className="flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select aria-label="Role" className="rounded-md border border-border bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}><option value="staff">Parking staff</option><option value="adjudicator">Appeal adjudicator</option><option value="none">Remove access</option></select>
        <Button size="sm" disabled={!email.includes('@')} onClick={() => act(() => parking({ action: 'setStaff', email, kind: kind as never }), 'Saved.')}>Save</Button></div>
      <p className="text-xs text-muted-foreground">Staff issue citations; adjudicators decide appeals. A person holds one of the two, so nobody decides an appeal on their own citation. You cannot change your own access.</p>
    </div>
  );
}

export default function Parking() {
  const s = useLoad(() => parking({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="Parking" sub="Register your vehicle, apply for a permit, and see or appeal citations. Semester takes no payments and does not track where you park." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="My vehicles"><Vehicles d={d} reload={s.reload} /></Panel>
          <Panel title="My permits"><Permits d={d} reload={s.reload} staffView={false} /></Panel>
          <Panel title="Citations on my vehicles"><Citations d={d} reload={s.reload} staffView={false} /></Panel>
          {d.kind === 'staff' && <Panel title="Permit applications"><Permits d={d} reload={s.reload} staffView /></Panel>}
          {d.kind && <Panel title={d.kind === 'adjudicator' ? 'Appeals' : 'All citations'}><Citations d={d} reload={s.reload} staffView /></Panel>}
          {d.kind === 'staff' && <Panel title="Zones and citations"><StaffTools d={d} reload={s.reload} /></Panel>}
          {d.isAdmin && <Panel title="Parking access"><Access d={d} reload={s.reload} /></Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
