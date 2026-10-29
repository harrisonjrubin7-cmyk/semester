import { useState } from 'react';
import { toast } from 'sonner';
import { transition } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import DecisionAck from '../components/DecisionAck';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const CATS = ['housing', 'financial', 'registration', 'technology', 'health_access', 'other'];

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await transition(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
}

function Student({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [term, setTerm] = useState('');
  const [chk, setChk] = useState({ score: '', note: '', shared: false });
  const [blk, setBlk] = useState({ category: 'registration', detail: '' });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Your transition checklist">
        {!d.cohorts.length ? <Empty>You are not in a transition cohort. Your first-year team adds you.</Empty> : d.cohorts.map((c: any) => (
          <div key={c.id} className="mb-3 text-sm"><p className="font-medium">{c.name} · {c.term}</p>
            {c.items.map((i: any) => <div key={i.id} className="flex items-center justify-between gap-2 border-b border-border py-1">
              <span>{i.title}{i.due ? ` · due ${i.due}` : ''}</span>
              {i.verified ? <Status value="verified" /> : i.done ? <Status value={i.verify ? 'awaiting verification' : 'done'} />
                : <Button size="sm" variant="outline" onClick={() => act({ action: 'mark', itemId: i.id, step: 'done' }, 'Marked done.')}>Mark done</Button>}
            </div>)}
          </div>))}
      </Panel>
      <Panel title="Enrollment intent">
        {d.intents.map((i: any) => <p key={i.term} className="text-sm">{i.term}: <Status value={i.intent} /> {i.intent === 'enroll' && (i.deposit ? <Status value="deposit recorded" /> : <span className="text-xs text-muted-foreground">Deposit not recorded yet. It is paid outside Semester; admissions records it here.</span>)}</p>)}
        <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Term" placeholder="Term (e.g. Fall 2026)" className="w-44" value={term} onChange={(e) => setTerm(e.target.value)} />
          {['enroll', 'decline', 'undecided'].map((x) => <Button key={x} size="sm" variant={x === 'enroll' ? 'default' : 'outline'} disabled={term.length < 2} onClick={() => act({ action: 'intent', term, intent: x }, 'Intent saved.')}>{x === 'enroll' ? 'I will enroll' : x === 'decline' ? 'I will not enroll' : 'Undecided'}</Button>)}</div>
        <p className="mt-3 text-xs font-medium">Placement</p>
        {!d.placements.length ? <Empty>No placement recorded.</Empty> : d.placements.map((p: any, k: number) => <p key={k} className="text-sm">{p.subject}: {p.level} <span className="text-xs text-muted-foreground">({p.basis})</span></p>)}
      </Panel>
      <Panel title="Orientation sessions">
        {!d.sessions.length ? <Empty>No orientation sessions scheduled.</Empty> : d.sessions.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between gap-2 border-b border-border py-1 text-sm">
            <span>{s.title} · {fmt(s.startsAt)}{s.location ? ` · ${s.location}` : ''} · {s.n}/{s.capacity}</span>
            {s.mine ? <Button size="sm" variant="outline" onClick={() => act({ action: 'register', sessionId: s.id, on: false }, 'Registration cancelled.')}>Cancel</Button>
              : <Button size="sm" disabled={s.n >= s.capacity} onClick={() => act({ action: 'register', sessionId: s.id, on: true }, 'Registered.')}>{s.n >= s.capacity ? 'Full' : 'Register'}</Button>}
          </div>))}
      </Panel>
      <Panel title="How is it going?">
        <p className="text-xs text-muted-foreground">Staff see only cohort averages of five or more students, unless you choose to share this answer.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label="How connected do you feel (1 to 5)" className={sel} value={chk.score} onChange={(e) => setChk({ ...chk, score: e.target.value })}><option value="">1 (not at all) – 5 (very)</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
          <label className="text-xs"><input type="checkbox" checked={chk.shared} onChange={(e) => setChk({ ...chk, shared: e.target.checked })} /> Share with my first-year team</label></div>
        <Textarea aria-label="Anything to add" placeholder="Anything to add (optional)" rows={2} className="mt-1" value={chk.note} onChange={(e) => setChk({ ...chk, note: e.target.value })} />
        <Button size="sm" className="mt-1" disabled={!chk.score || !d.cohorts.length} onClick={async () => { if (await act({ action: 'checkin', term: d.cohorts[0].term, score: Number(chk.score), note: chk.note, shared: chk.shared }, 'Thanks for checking in.')) setChk({ score: '', note: '', shared: false }); }}>Check in</Button>
        <p className="mt-3 text-xs font-medium">Something blocking you?</p>
        <div className="flex flex-wrap gap-2"><select aria-label="Category" className={sel} value={blk.category} onChange={(e) => setBlk({ ...blk, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
        <Textarea aria-label="What is blocking you" rows={2} className="mt-1" value={blk.detail} onChange={(e) => setBlk({ ...blk, detail: e.target.value })} />
        <Button size="sm" variant="outline" className="mt-1" disabled={blk.detail.length < 5} onClick={async () => { if (await act({ action: 'blocker', ...blk }, 'Sent to your first-year team.')) setBlk({ ...blk, detail: '' }); }}>Raise blocker</Button>
        {d.blockers.map((b: any) => <p key={b.id} className="mt-1 text-xs"><Status value={b.state} /> {b.category.replace('_', ' ')}: {b.detail}{b.resolution ? ` → ${b.resolution}` : ''}
          {b.state === 'open' && !b.escalated && <Button size="sm" variant="ghost" onClick={() => act({ action: 'blockerStep', blockerId: b.id, step: 'escalate' }, 'Escalated.')}>Escalate</Button>}</p>)}
      </Panel>
    </div>
  );
}

function Staff({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const s = d.staff;
  const fy = d.roles.includes('first_year'), leader = d.roles.includes('leader'), adm = d.roles.includes('admissions');
  const [co, setCo] = useState({ name: '', term: '', emails: '' });
  const [it, setIt] = useState<Record<number, { title: string; due: string; verify: boolean }>>({});
  const [out, setOut] = useState({ studentId: '', channel: 'message', note: '', outcome: 'reached', notify: false });
  const [res, setRes] = useState<Record<number, string>>({});
  const [ses, setSes] = useState({ title: '', startsAt: '', location: '', capacity: '', leaders: '' });
  const [dep, setDep] = useState<Record<string, string>>({});
  const [pl, setPl] = useState({ studentId: '', subject: '', level: '', basis: '' });
  const students = (s.cohorts ?? []).flatMap((c: any) => c.students).filter((x: any, i: number, all: any[]) => all.findIndex((y) => y.id === x.id) === i);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {fy && <Panel title="Transition cohorts">
        <div className="flex flex-wrap gap-2"><Input aria-label="Cohort name" placeholder="Cohort name" className="w-48" value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} />
          <Input aria-label="Term" placeholder="Term" className="w-32" value={co.term} onChange={(e) => setCo({ ...co, term: e.target.value })} /></div>
        <Textarea aria-label="Student emails" placeholder="Student emails, one per line (adds to an existing cohort of the same name)" rows={2} className="mt-1" value={co.emails} onChange={(e) => setCo({ ...co, emails: e.target.value })} />
        <Button size="sm" className="mt-1" disabled={co.name.length < 3 || co.term.length < 2} onClick={() => act({ action: 'cohort', name: co.name, term: co.term, emails: co.emails.split(/\s+/).filter(Boolean) }, 'Cohort saved.')}>Save cohort</Button>
        {!s.cohorts.length ? <Empty>No cohorts yet.</Empty> : s.cohorts.map((c: any) => { const f = it[c.id] ?? { title: '', due: '', verify: false };
          return <div key={c.id} className="mt-3 border-t border-border pt-2 text-sm">
            <p className="font-medium">{c.name} · {c.term} · {c.n} students · belonging {c.belonging == null ? <span className="text-xs text-muted-foreground">shown at five or more answers</span> : `${c.belonging}/5`}</p>
            {c.items.map((i: any) => <div key={i.id} className="text-xs"><p>{i.title}{i.due ? ` · due ${i.due}` : ''}{i.verify ? ' · needs verification' : ''} · {c.students.filter((x: any) => x.done.some((y: any) => y.item === i.id)).length}/{c.n} done</p>
              {i.verify && c.students.filter((x: any) => x.done.some((y: any) => y.item === i.id && !y.verified) && x.id !== d.me).map((x: any) => <Button key={x.id} size="sm" variant="ghost" onClick={() => act({ action: 'mark', itemId: i.id, studentId: x.id, step: 'verify' }, 'Verified.')}>Verify {x.name}</Button>)}</div>)}
            <div className="mt-1 flex flex-wrap items-center gap-2"><Input aria-label="Checklist item" placeholder="Checklist item" className="h-8 w-48" value={f.title} onChange={(e) => setIt({ ...it, [c.id]: { ...f, title: e.target.value } })} />
              <Input aria-label="Due" type="date" className="h-8 w-36" value={f.due} onChange={(e) => setIt({ ...it, [c.id]: { ...f, due: e.target.value } })} />
              <label className="text-xs"><input type="checkbox" checked={f.verify} onChange={(e) => setIt({ ...it, [c.id]: { ...f, verify: e.target.checked } })} /> staff verify</label>
              <Button size="sm" variant="outline" disabled={f.title.length < 3} onClick={() => act({ action: 'item', cohortId: c.id, title: f.title, due: f.due || null, verify: f.verify }, 'Item added.')}>Add</Button></div>
          </div>; })}
      </Panel>}
      {fy && <Panel title="Outreach">
        <div className="flex flex-wrap gap-2"><select aria-label="Student" className={sel} value={out.studentId} onChange={(e) => setOut({ ...out, studentId: e.target.value })}><option value="">Student…</option>{students.filter((x: any) => x.id !== d.me).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select aria-label="Channel" className={sel} value={out.channel} onChange={(e) => setOut({ ...out, channel: e.target.value })}>{['message', 'call', 'meeting', 'email'].map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Outcome" className={sel} value={out.outcome} onChange={(e) => setOut({ ...out, outcome: e.target.value })}>{['reached', 'no_response', 'follow_up'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></div>
        <Textarea aria-label="Note" rows={2} className="mt-1" value={out.note} onChange={(e) => setOut({ ...out, note: e.target.value })} />
        <label className="text-xs"><input type="checkbox" checked={out.notify} onChange={(e) => setOut({ ...out, notify: e.target.checked })} /> Also send the student an in-app check-in note</label>
        <Button size="sm" className="mt-1" disabled={!out.studentId || out.note.length < 5} onClick={async () => { if (await act({ action: 'outreach', ...out }, 'Outreach logged.')) setOut({ ...out, note: '' }); }}>Log outreach</Button>
        {s.outreach.slice(0, 15).map((o: any, k: number) => <p key={k} className="mt-1 text-xs">{fmt(o.at)} · {o.staff} → {o.student} · {o.channel} · <Status value={o.outcome.replace('_', ' ')} /> {o.note}</p>)}
        <p className="mt-3 text-xs font-medium">Shared check-ins</p>
        {!s.shared.length ? <Empty>No student has shared a check-in.</Empty> : s.shared.map((x: any, k: number) => <p key={k} className="text-xs">{x.student} · {x.term} · {x.score}/5 {x.note}</p>)}
      </Panel>}
      {(fy || leader) && <Panel title="Onboarding blockers">
        {!s.blockers.length ? <Empty>No blockers.</Empty> : s.blockers.map((b: any) => <div key={b.id} className="border-b border-border py-1 text-xs">
          <p><Status value={b.state} /> {b.escalated && <Status value="escalated" />} {b.student} · {b.category.replace('_', ' ')}: {b.detail} <span className="text-muted-foreground">(raised by {b.raisedBy}{b.assigned ? `, with ${b.assigned}` : ''})</span></p>
          {b.state === 'open' && <div className="mt-1 flex flex-wrap gap-2">
            {leader && !b.escalated && <Button size="sm" variant="outline" onClick={() => act({ action: 'blockerStep', blockerId: b.id, step: 'escalate' }, 'Escalated.')}>Escalate</Button>}
            {fy && !b.mine && <><Button size="sm" variant="ghost" onClick={() => act({ action: 'blockerStep', blockerId: b.id, step: 'claim' }, 'Assigned to you.')}>Take it</Button>
              <Input aria-label="Resolution" placeholder="What resolved it" className="h-8 w-48" value={res[b.id] ?? ''} onChange={(e) => setRes({ ...res, [b.id]: e.target.value })} />
              <Button size="sm" disabled={(res[b.id] ?? '').length < 5} onClick={() => act({ action: 'blockerStep', blockerId: b.id, step: 'resolve', text: res[b.id] }, 'Resolved.')}>Resolve</Button></>}
          </div>}
          {b.resolution && <p>→ {b.resolution}</p>}</div>)}
      </Panel>}
      {(fy || leader) && <Panel title="Orientation logistics and attendance">
        {fy && <><div className="flex flex-wrap gap-2"><Input aria-label="Session title" placeholder="Session title" className="w-44" value={ses.title} onChange={(e) => setSes({ ...ses, title: e.target.value })} />
          <Input aria-label="Starts" type="datetime-local" className="w-52" value={ses.startsAt} onChange={(e) => setSes({ ...ses, startsAt: e.target.value })} />
          <Input aria-label="Location" placeholder="Location" className="w-36" value={ses.location} onChange={(e) => setSes({ ...ses, location: e.target.value })} />
          <Input aria-label="Capacity" type="number" placeholder="Capacity" className="w-24" value={ses.capacity} onChange={(e) => setSes({ ...ses, capacity: e.target.value })} /></div>
          <Input aria-label="Leader emails" placeholder="Orientation leader emails, comma separated" className="mt-1" value={ses.leaders} onChange={(e) => setSes({ ...ses, leaders: e.target.value })} />
          <Button size="sm" className="mt-1" disabled={ses.title.length < 3 || !ses.startsAt || !(Number(ses.capacity) > 0)} onClick={() => act({ action: 'session', title: ses.title, startsAt: new Date(ses.startsAt).toISOString(), location: ses.location, capacity: Number(ses.capacity), leaderEmails: ses.leaders.split(/[\s,]+/).filter(Boolean) }, 'Session scheduled.')}>Schedule session</Button></>}
        {d.sessions.filter((x: any) => x.leading).map((x: any) => <div key={x.id} className="mt-2 text-xs"><p className="font-medium">{x.title} · {fmt(x.startsAt)} · {x.n}/{x.capacity}</p>
          {s.attendance.filter((r: any) => r.session === x.id).map((r: any) => <div key={r.studentId} className="flex items-center gap-2"><span>{r.student}</span>{r.attended != null && <Status value={r.attended ? 'present' : 'absent'} />}
            {r.studentId !== d.me && <><Button size="sm" variant="ghost" onClick={() => act({ action: 'attend', sessionId: x.id, studentId: r.studentId, attended: true }, 'Marked present.')}>Present</Button>
              <Button size="sm" variant="ghost" onClick={() => act({ action: 'attend', sessionId: x.id, studentId: r.studentId, attended: false }, 'Marked absent.')}>Absent</Button></>}</div>)}</div>)}
      </Panel>}
      {adm && <Panel title="Admitted students: intent, deposit and placement">
        {!s.intents.length ? <Empty>No admitted student has recorded an intent.</Empty> : s.intents.map((i: any) => <div key={i.studentId + i.term} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-xs">
          <span>{i.student} · {i.term} · <Status value={i.intent} /></span>
          {i.deposit ? <Status value={`deposit ${i.deposit}`} /> : i.intent === 'enroll' && i.studentId !== d.me && <><Input aria-label="Payment reference" placeholder="Payment-system reference" className="h-8 w-48" value={dep[i.studentId + i.term] ?? ''} onChange={(e) => setDep({ ...dep, [i.studentId + i.term]: e.target.value })} />
            <Button size="sm" variant="outline" disabled={(dep[i.studentId + i.term] ?? '').length < 3} onClick={() => act({ action: 'deposit', studentId: i.studentId, term: i.term, reference: dep[i.studentId + i.term] }, 'Deposit recorded.')}>Record deposit</Button></>}</div>)}
        <p className="mt-3 text-xs font-medium">Record placement</p>
        <div className="flex flex-wrap gap-2"><select aria-label="Student" className={sel} value={pl.studentId} onChange={(e) => setPl({ ...pl, studentId: e.target.value })}><option value="">Student…</option>{s.intents.filter((x: any) => x.studentId !== d.me).map((x: any) => <option key={x.studentId + x.term} value={x.studentId}>{x.student}</option>)}</select>
          <Input aria-label="Subject" placeholder="Subject" className="w-28" value={pl.subject} onChange={(e) => setPl({ ...pl, subject: e.target.value })} />
          <Input aria-label="Level" placeholder="Level" className="w-28" value={pl.level} onChange={(e) => setPl({ ...pl, level: e.target.value })} />
          <Input aria-label="Basis" placeholder="Basis (exam, score)" className="w-40" value={pl.basis} onChange={(e) => setPl({ ...pl, basis: e.target.value })} />
          <Button size="sm" disabled={!pl.studentId || pl.subject.length < 2 || !pl.level || pl.basis.length < 3} onClick={() => act({ action: 'placement', ...pl }, 'Placement recorded.')}>Record</Button></div>
      </Panel>}
    </div>
  );
}

function Admin({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [f, setF] = useState({ email: '', role: 'first_year' });
  return (
    <Panel title="Transition roles (administrators)">
      <div className="flex flex-wrap gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select aria-label="Role" className={sel} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="first_year">First-year staff</option><option value="leader">Orientation leader</option><option value="admissions">Admissions</option></select>
        <Button size="sm" disabled={!f.email.includes('@')} onClick={() => act({ action: 'staff', ...f, on: true }, 'Granted.')}>Grant</Button>
        <Button size="sm" variant="outline" disabled={!f.email.includes('@')} onClick={() => act({ action: 'staff', ...f, on: false }, 'Revoked.')}>Revoke</Button></div>
      {d.staffList.map((x: any, k: number) => <p key={k} className="text-xs">{x.name} · {x.role.replace('_', ' ')}</p>)}
    </Panel>
  );
}

export default function Transition() {
  const state = useLoad(() => transition({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Plan" title="Transition and orientation" sub="Your first-year checklist, orientation sessions, enrollment intent and placement. Staff tools appear for first-year staff, orientation leaders and admissions." />
      <div className="mb-4 space-y-4"><DecisionAck /></div>
      <Loadable state={state}>{(d: any) => <>
        <Student d={d} act={act} />
        {d.staff && <Staff d={d} act={act} />}
        {d.isAdmin && <Admin d={d} act={act} />}
      </>}</Loadable>
    </div>
  );
}
