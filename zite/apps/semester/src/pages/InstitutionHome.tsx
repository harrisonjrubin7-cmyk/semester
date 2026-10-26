import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sectionRequests } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, DecisionTrail, StepStatus, errMsg, fmt } from '../components/kit';
import { useWorkspace } from '../lib/workspace';
import { validateDraft, nextState } from '../lib/sectionRequestRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE_WORDS: Record<string, string> = {
  submitted: 'Waiting for chair', chair_approved: 'Waiting for registrar', authorized: 'Authorized, not yet created', creating: 'Creating section',
  created: 'Created, check pending', reconciled: 'Open for registration', rejected: 'Declined', withdrawn: 'Withdrawn',
};

// Semester Institution: the institution's command center. Links appear for the roles you hold; every page and endpoint
// still checks permission itself (hidden navigation is not authorization).
const MODULES: { title: string; to: string; roles: string[]; note: string }[] = [
  { title: 'New course sections', to: '/institution/sections', roles: ['Faculty', 'Staff', 'Administrator'], note: 'Department requests, chair review, registrar authorization' },
  { title: 'Registrar desk', to: '/staff/registrar', roles: ['Staff', 'Administrator'], note: 'Registration requests and records' },
  { title: 'Catalog and rules', to: '/staff/catalog', roles: ['Staff', 'Administrator'], note: 'Courses, prerequisites, registration rules' },
  { title: 'Academic calendar', to: '/staff/calendar', roles: ['Staff', 'Administrator'], note: 'Terms and registration windows' },
  { title: 'Registration holds', to: '/staff/holds', roles: ['Staff', 'Administrator'], note: 'Holds and releases' },
  { title: 'Admissions', to: '/staff/admissions', roles: ['Staff', 'Administrator'], note: 'Applications and decisions' },
  { title: 'Student accounts', to: '/staff/accounts', roles: ['Staff', 'Administrator'], note: 'Statements and disputes' },
  { title: 'Analytics', to: '/staff/analytics', roles: ['Staff', 'Administrator'], note: 'Small-cell–protected institutional counts' },
  { title: 'Configuration and access', to: '/console', roles: ['Administrator'], note: 'Members, integrations, mappings, readiness' },
];

export function InstitutionHome() {
  const { membership } = useWorkspace();
  const s = useLoad(() => sectionRequests({ action: 'get' }));
  const mods = MODULES.filter((m) => m.roles.some((r) => membership.roles.includes(r)));
  return (
    <>
      <PageHeader eyebrow={membership.institutionName} title="Institution" sub="What is happening, what needs coordination, and where to work. You see only modules your roles open." />
      <Loadable state={s}>{(d: any) => {
        const chairQ = d.requests.filter((r: any) => r.state === 'submitted' && d.me.chairOf.includes(r.departmentId));
        const regQ = d.me.isRegistrar ? d.requests.filter((r: any) => ['chair_approved', 'authorized', 'creating', 'created'].includes(r.state)) : [];
        const mine = d.requests.filter((r: any) => r.mine && !['reconciled', 'rejected', 'withdrawn'].includes(r.state));
        return (
          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Waiting on you">
              <ul className="space-y-1 text-sm">
                <li>Chair reviews: <strong>{chairQ.length}</strong></li>
                {d.me.isRegistrar && <li>Registrar decisions and follow-ups: <strong>{regQ.length}</strong></li>}
                <li>Your open requests: <strong>{mine.length}</strong></li>
              </ul>
              <Button asChild size="sm" className="mt-3"><Link to="/institution/sections">Open section requests</Link></Button>
            </Panel>
            <Panel title="Modules" className="md:col-span-2">
              {mods.length ? <ul className="grid gap-2 sm:grid-cols-2">{mods.map((m) => (
                <li key={m.to}><Link className="block rounded-md border border-border p-3 hover:bg-muted focus-visible:outline-2" to={m.to}>
                  <span className="font-medium">{m.title}</span><span className="block text-xs text-muted-foreground">{m.note}</span></Link></li>))}</ul>
                : <Empty>Your roles do not open any institution modules.</Empty>}
            </Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}

function RequestForm({ d, onDone }: { d: any; onDone: () => void }) {
  const blank = { departmentId: '', courseId: '', termId: '', sectionCode: '', capacity: '30', meetingTimes: '', roomId: '', instructorId: '', reason: '' };
  const [f, setF] = useState(blank);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const room = d.rooms.find((r: any) => String(r.id) === f.roomId && r.active);
  const missing = !f.departmentId || !f.courseId || !f.termId ? 'Choose a department, course and term.' : null;
  const problem = missing ?? validateDraft({ sectionCode: f.sectionCode.trim().toUpperCase(), capacity: Number(f.capacity), meetingTimes: f.meetingTimes.trim(),
    roomCapacity: room ? room.capacity : null, instructorIsFaculty: !!f.instructorId });
  const send = async () => {
    setBusy(true);
    try {
      const r: any = await sectionRequests({ action: 'submit', requestKey: key, departmentId: Number(f.departmentId), courseId: f.courseId, termId: f.termId,
        sectionCode: f.sectionCode, capacity: Number(f.capacity), meetingTimes: f.meetingTimes, roomId: Number(f.roomId), instructorId: f.instructorId, reason: f.reason });
      toast(r.result?.replayed ? 'Already sent. Nothing was duplicated.' : `Sent as SR-${r.result?.id}. The chair has been notified.`);
      setF(blank); setKey(crypto.randomUUID()); onDone();
    } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const sel = (label: string, k: keyof typeof blank, opts: { v: string; t: string }[]) => (
    <label className="text-xs">{label}
      <select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f[k]} onChange={set(k)}>
        <option value="">Choose…</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select></label>);
  if (!d.departments.some((x: any) => x.active) || !d.rooms.some((x: any) => x.active))
    return <Empty>An administrator needs to add at least one department and one room before sections can be requested.</Empty>;
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      {sel('Department', 'departmentId', d.departments.filter((x: any) => x.active).map((x: any) => ({ v: String(x.id), t: `${x.name}${x.chair ? '' : ' (no chair yet)'}` })))}
      {sel('Course', 'courseId', d.courses.map((c: any) => ({ v: c.id, t: `${c.code} · ${c.title}` })))}
      {sel('Term', 'termId', d.terms.map((t: any) => ({ v: t.id, t: t.label })))}
      <label className="text-xs">Section code<Input className="mt-1" value={f.sectionCode} onChange={set('sectionCode')} placeholder="002" /></label>
      <label className="text-xs">Seats<Input className="mt-1" type="number" min={1} max={500} value={f.capacity} onChange={set('capacity')} /></label>
      <label className="text-xs">Meeting time<Input className="mt-1" value={f.meetingTimes} onChange={set('meetingTimes')} placeholder="Mon/Wed 09:00-10:15" /></label>
      {sel('Room', 'roomId', d.rooms.filter((r: any) => r.active).map((r: any) => ({ v: String(r.id), t: `${r.name} (holds ${r.capacity})` })))}
      {sel('Instructor', 'instructorId', d.faculty.map((p: any) => ({ v: p.id, t: p.name })))}
      <label className="text-xs sm:col-span-2">Why it is needed (demand, waitlist, program requirement)<Textarea className="mt-1" value={f.reason} onChange={set('reason')} /></label>
      <div className="sm:col-span-2 flex items-center gap-2">
        {problem ? <span role="status" className="text-xs">! {problem}</span> : <Button size="sm" disabled={busy} onClick={send}>Send to chair</Button>}
      </div>
    </div>
  );
}

function Decide({ r, kind, onDone }: { r: any; kind: 'chair' | 'registrar'; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (approve: boolean) => {
    setBusy(true);
    try { const out: any = await sectionRequests({ action: kind, id: r.id, approve, note, expectedVersion: r.version });
      const res = out.result;
      toast(!approve ? 'Declined. The requester has been told.' : kind === 'chair' ? 'Approved and sent to the registrar.'
        : res?.state === 'reconciled' ? `Authorized. Section created, instructor notified, open for registration. Receipt SR-${r.id}.`
        : res?.mismatch?.length ? `Authorized and created, but the check found: ${res.mismatch.join(', ')}.` : 'Authorized.');
      onDone(); } catch (e) { toast(`! ${errMsg(e)}`); onDone(); } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Note" placeholder={kind === 'chair' ? 'Note for the registrar or the requester (required to decline)' : 'Note (required to decline)'} value={note} onChange={(e) => setNote(e.target.value)} />
      {kind === 'registrar' && <p className="text-xs text-muted-foreground">Authorizing creates the section in your catalog, assigns the instructor and opens it for registration. Room and instructor clashes are checked first.</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => go(true)}>{kind === 'chair' ? 'Approve' : 'Authorize and create'}</Button>
        <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => go(false)}>Decline</Button>
      </div>
    </div>
  );
}

function RequestCard({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const isChair = r.state === 'submitted' && d.me.chairOf.includes(r.departmentId) && !r.mine;
  const isReg = d.me.isRegistrar && r.state === 'chair_approved' && !r.mine;
  const canRetry = d.me.isRegistrar && ['authorized', 'creating', 'created'].includes(r.state);
  const order = ['submitted', 'chair_approved', 'authorized', 'created', 'reconciled'];
  const at = order.indexOf(r.state === 'creating' ? 'authorized' : r.state);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); } catch (e) { toast(`! ${errMsg(e)}`); } reload(); };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{r.ref} · {r.label}</span><Status value={STATE_WORDS[r.state] ?? r.state} />
      </div>
      <p className="text-xs text-muted-foreground">{r.department} · {r.capacity} seats · {r.meetingTimes} · {r.room} · Instructor {r.instructor} · Asked by {r.requester}</p>
      {r.reason && <p className="mt-1 text-xs">Why: {r.reason}</p>}
      {at >= 0 && <div className="mt-2"><StepStatus steps={['Chair review', 'Registrar', 'Section created', 'Checked and open'].map((label, i) => ({ label, state: at > i ? 'done' : at === i ? 'working' : 'waiting' }))} /></div>}
      {r.lastNote && <p className="mt-1 text-xs">Latest note: {r.lastNote}</p>}
      {isChair && <Decide r={r} kind="chair" onDone={reload} />}
      {isReg && <Decide r={r} kind="registrar" onDone={reload} />}
      {canRetry && <Button className="mt-2" size="sm" variant="outline" onClick={() => act(() => sectionRequests({ action: 'publish', id: r.id }), 'Checked again.')}>
        {r.state === 'created' ? 'Re-run the check' : 'Retry creating the section'}</Button>}
      {r.mine && nextState(r.state, 'withdraw') && <Button className="mt-2" size="sm" variant="ghost" onClick={() => act(() => sectionRequests({ action: 'withdraw', id: r.id, expectedVersion: r.version }), 'Withdrawn.')}>Withdraw</Button>}
      {r.sectionId && <Link className="mt-2 block text-xs underline" to={`/learn/${r.sectionId}`}>Open the section</Link>}
      <DecisionTrail label="History" items={r.events.map((e: any) => ({ title: `${e.step.replace(/_/g, ' ')} → ${STATE_WORDS[e.state] ?? e.state}`, who: e.who, when: fmt(e.at), detail: e.note }))} />
    </li>
  );
}

function Setup({ d, reload }: { d: any; reload: () => void }) {
  const [dept, setDept] = useState({ name: '', chairEmail: '' });
  const [room, setRoom] = useState({ name: '', capacity: '30' });
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Departments">
        <ul className="mb-2 space-y-1 text-sm">{d.departments.map((x: any) => <li key={x.id} className="flex justify-between gap-2"><span>{x.name}{x.active ? '' : ' (inactive)'}</span><span className="text-xs text-muted-foreground">Chair: {x.chair ?? 'none'}</span></li>)}</ul>
        <div className="space-y-2 text-sm">
          <Input aria-label="Department name" placeholder="Department name" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
          <Input aria-label="Chair email" placeholder="Chair’s email (a member of your institution)" value={dept.chairEmail} onChange={(e) => setDept({ ...dept, chairEmail: e.target.value })} />
          <Button size="sm" disabled={dept.name.trim().length < 2} onClick={() => act(() => sectionRequests({ action: 'saveDepartment', name: dept.name, chairEmail: dept.chairEmail.trim() || undefined, active: true }), 'Department saved.').then(() => setDept({ name: '', chairEmail: '' }))}>Add department</Button>
        </div>
      </Panel>
      <Panel title="Rooms">
        <ul className="mb-2 space-y-1 text-sm">{d.rooms.map((x: any) => <li key={x.id} className="flex justify-between"><span>{x.name}{x.active ? '' : ' (inactive)'}</span><span className="text-xs text-muted-foreground">holds {x.capacity}</span></li>)}</ul>
        <div className="flex gap-2 text-sm">
          <Input aria-label="Room name" placeholder="Room" value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} />
          <Input aria-label="Room capacity" type="number" className="w-24" value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: e.target.value })} />
          <Button size="sm" disabled={room.name.trim().length < 2} onClick={() => act(() => sectionRequests({ action: 'saveRoom', name: room.name, capacity: Number(room.capacity), active: true }), 'Room saved.').then(() => setRoom({ name: '', capacity: '30' }))}>Add</Button>
        </div>
      </Panel>
    </div>
  );
}

export function SectionRequests() {
  const s = useLoad(() => sectionRequests({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Institution" title="New course sections" sub="A department asks, the chair reviews, the registrar authorizes. Semester then creates the section, assigns the instructor, opens it for registration and checks it matches." />
      <Loadable state={s}>{(d: any) => {
        const live = d.requests.filter((r: any) => !['reconciled', 'rejected', 'withdrawn'].includes(r.state));
        const done = d.requests.filter((r: any) => ['reconciled', 'rejected', 'withdrawn'].includes(r.state));
        return (
          <div className="space-y-4">
            {d.me.canRequest && <Panel title="Request a section"><RequestForm d={d} onDone={s.reload} /></Panel>}
            <Panel title={`In progress · ${live.length}`}>{live.length ? <ul className="space-y-2">{live.map((r: any) => <RequestCard key={r.id} r={r} d={d} reload={s.reload} />)}</ul> : <Empty>Nothing in progress.</Empty>}</Panel>
            {done.length > 0 && <Panel title={`Finished · ${done.length}`}><ul className="space-y-2">{done.map((r: any) => <RequestCard key={r.id} r={r} d={d} reload={s.reload} />)}</ul></Panel>}
            {d.me.isAdmin && <Setup d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
