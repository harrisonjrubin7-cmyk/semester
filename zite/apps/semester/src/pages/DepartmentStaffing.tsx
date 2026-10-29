import { useState } from 'react';
import { toast } from 'sonner';
import { departmentStaffing } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Need = { id: number; departmentId: number; department: string; term: string; course: string; role: string; hours: number; slots: number; note: string; state: string; version: number; manage: boolean; admin: boolean; chair: boolean };
type Offer = { id: number; needId: number; person: string; mineToAnswer: boolean; offeredBy: string; offeredByMe: boolean; approvedBy: string | null; state: string; note: string; version: number; at: string | null };
type Row = { id: string; label: string; term: string; capacity: number | null; seated: number; waiting: number; fill: number | null; signal: string };
type Course = { course: string; term: string; sections: number; capacity: number; seated: number; waiting: number; seatsShort: number };
type Data = { me: string; isAdmin: boolean; departments: { id: number; name: string; admin: boolean; chair: boolean }[]; needs: Need[]; offers: Offer[]; demand: { sections: Row[]; courses: Course[]; source: string } | null };

const ROLE: Record<string, string> = { teaching_assistant: 'Teaching assistant', grader: 'Grader', lab_instructor: 'Lab instructor', instructor: 'Instructor' };
const SIGNAL: Record<string, string> = { waitlisted: '! Waitlist', full: 'Full', near_full: 'Near full', open: 'Open', low: 'Low enrollment', closed: 'Closed', no_capacity: 'No capacity set' };

function NeedCard({ n, d, reload }: { n: Need; d: Data; reload: () => Promise<void> }) {
  const [email, setEmail] = useState(''); const [note, setNote] = useState('');
  const offers = d.offers.filter((o) => o.needId === n.id);
  const run = async (input: Record<string, unknown>) => { try { await departmentStaffing(input as never); toast.success('Saved'); setNote(''); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  const filled = offers.filter((o) => o.state === 'accepted').length;
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{n.course} · {ROLE[n.role]} · {n.hours} h/week</p><p className="text-xs text-muted-foreground">{n.department} · {n.term} · {filled} of {n.slots} filled{n.note ? ` · ${n.note}` : ''}</p></div><Status value={n.state} /></div>
      {offers.length > 0 && <ul className="mt-2 space-y-1">{offers.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{o.person} · offered by {o.offeredByMe ? 'you' : o.offeredBy}{o.approvedBy ? ` · approved by ${o.approvedBy}` : ''} · {fmt(o.at)}{o.note ? ` · ${o.note}` : ''}</span>
          <span className="flex items-center gap-2"><Status value={o.state} />
            {n.chair && o.state === 'proposed' && !o.offeredByMe && <><Button size="sm" onClick={() => run({ action: 'offer', step: 'approve', id: o.id, expectedVersion: o.version, note })}>Approve</Button><Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'offer', step: 'reject', id: o.id, expectedVersion: o.version, note })}>Reject</Button></>}
            {n.admin && (o.state === 'proposed' || o.state === 'approved') && <Button size="sm" variant="ghost" disabled={note.trim().length < 10} onClick={() => run({ action: 'offer', step: 'withdraw', id: o.id, expectedVersion: o.version, note })}>Withdraw</Button>}
          </span></li>))}</ul>}
      {n.state === 'open' && n.manage && <div className="mt-2 flex flex-wrap items-center gap-2">
        {n.admin && <><Input aria-label="Email of the person to offer it to" className="h-8 w-56" type="email" placeholder="Offer to (email)" value={email} onChange={(e) => setEmail(e.target.value)} /><Button size="sm" disabled={!email.includes('@')} onClick={() => run({ action: 'offer', step: 'offer', id: null, expectedVersion: null, needId: n.id, email, note: '' })}>Offer</Button></>}
        <Input aria-label="Note or reason" className="h-8 w-56" placeholder="Note / reason (10+ for reject, withdraw, cancel)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'need', step: 'cancel', id: n.id, expectedVersion: n.version, note })}>Cancel need</Button>
      </div>}
    </div>
  );
}

function PostNeed({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const depts = d.departments.filter((x) => x.admin);
  const [f, setF] = useState({ departmentId: '', term: '', course: '', role: 'teaching_assistant', hours: '10', slots: '1', note: '' });
  if (!depts.length) return null;
  const save = async () => { try { await departmentStaffing({ action: 'need', step: 'post', id: null, expectedVersion: null, departmentId: Number(f.departmentId), term: f.term, course: f.course, role: f.role as never, hours: Number(f.hours), slots: Number(f.slots), note: f.note }); toast.success('Need posted'); setF({ ...f, course: '', note: '' }); await reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Panel title="Post a staffing need">
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label htmlFor="pn-d">Department</Label><Select value={f.departmentId} onValueChange={(v) => setF({ ...f, departmentId: v })}><SelectTrigger id="pn-d" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{depts.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="pn-t">Term</Label><Input id="pn-t" className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Fall 2026" /></div>
        <div><Label htmlFor="pn-c">Course</Label><Input id="pn-c" className="mt-1" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} placeholder="HIST 300" /></div>
        <div><Label htmlFor="pn-r">Role</Label><Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}><SelectTrigger id="pn-r" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ROLE).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="pn-h">Hours a week</Label><Input id="pn-h" className="mt-1" inputMode="numeric" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
        <div><Label htmlFor="pn-s">Positions</Label><Input id="pn-s" className="mt-1" inputMode="numeric" value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} /></div>
      </div>
      <Label htmlFor="pn-n" className="mt-3 block">Note</Label><Input id="pn-n" className="mt-1" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button className="mt-3" disabled={!f.departmentId || f.term.trim().length < 2 || f.course.trim().length < 2} onClick={save}>Post need</Button>
      <p className="mt-2 text-xs text-muted-foreground">Accepting an offer records the staffing decision only. Course access is added by the instructor in Course team.</p>
    </Panel>
  );
}

export default function DepartmentStaffing() {
  const state = useLoad(() => departmentStaffing({ action: 'get' }) as Promise<Data>);
  return (
    <>
      <PageHeader eyebrow="Institution" title="Staffing & demand" sub="Post teaching staff needs, get the chair's approval, and see where seats are short." />
      <Loadable state={state}>{(d: Data) => {
        const managed = d.needs.filter((n) => n.manage);
        const toAnswer = d.offers.filter((o) => o.mineToAnswer);
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {d.demand && <Panel title="Demand by course">
                <p className="mb-2 text-xs text-muted-foreground">{d.demand.source}</p>
                {d.demand.courses.length === 0 ? <Empty>No sections with registration yet.</Empty> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Course</th><th>Term</th><th>Sections</th><th>Seats</th><th>Seated</th><th>Waiting</th><th>Seats short</th></tr></thead>
                  <tbody>{d.demand.courses.slice(0, 40).map((c) => <tr key={`${c.term}${c.course}`} className="border-t border-border"><td className="py-1">{c.course}</td><td>{c.term}</td><td>{c.sections}</td><td>{c.capacity}</td><td>{c.seated}</td><td>{c.waiting}</td><td className="font-medium">{c.seatsShort > 0 ? `! ${c.seatsShort}` : '—'}</td></tr>)}</tbody></table></div>}
                <details className="mt-2 text-xs"><summary>By section</summary><ul className="mt-1">{d.demand.sections.slice(0, 80).map((s) => <li key={s.id}>{s.label} · {s.term} · {s.seated}/{s.capacity ?? '?'}{s.waiting ? ` · ${s.waiting} waiting` : ''} · {SIGNAL[s.signal]}</li>)}</ul></details>
              </Panel>}
              {managed.length > 0 && <Panel title="Your departments' needs">{managed.map((n) => <NeedCard key={n.id} n={n} d={d} reload={state.reload} />)}</Panel>}
              <PostNeed d={d} reload={state.reload} />
              {!d.demand && managed.length === 0 && <Empty>Staffing is managed by department admins and chairs. Your offers appear here when you receive one.</Empty>}
            </div>
            <Panel title="Offers for you">{toAnswer.length === 0 ? <Empty>No offers.</Empty> : toAnswer.map((o) => {
              const n = d.needs.find((x) => x.id === o.needId);
              const answer = async (step: 'accept' | 'decline') => { try { await departmentStaffing({ action: 'offer', step, id: o.id, expectedVersion: o.version, note: '' }); toast.success(step === 'accept' ? 'Accepted' : 'Declined'); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };
              return <div key={o.id} className="border-b border-border py-2 text-sm last:border-0"><p className="font-medium">{n ? `${n.course} · ${ROLE[n.role]} · ${n.hours} h/week` : 'Position'}</p><p className="text-xs text-muted-foreground">{n?.department} · {n?.term} · <Status value={o.state} /></p>
                {o.state === 'approved' ? <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => answer('accept')}>Accept</Button><Button size="sm" variant="outline" onClick={() => answer('decline')}>Decline</Button></div> : o.state === 'proposed' ? <p className="mt-1 text-xs">Waiting for the chair's approval.</p> : o.note ? <p className="mt-1 text-xs">{o.note}</p> : null}</div>;
            })}</Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}
