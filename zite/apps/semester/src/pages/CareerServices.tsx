import { useState } from 'react';
import { toast } from 'sonner';
import { careerServices } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const lbl = (s: string) => s.replace(/_/g, ' ');
const KINDS = ['employed', 'grad_school', 'service', 'military', 'seeking', 'not_seeking'];

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await careerServices(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}
type P = { d: any; act: ReturnType<typeof useAct> };

function PlanAndSharing({ d, act }: P) {
  const [p, setP] = useState(d.plan);
  const [sh, setSh] = useState({ coachId: '', until: '' });
  return (
    <Panel title="Your career plan">
      <Input aria-label="Goal" placeholder="Goal" value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })} />
      <Input aria-label="Target roles" placeholder="Target roles or fields" className="mt-1" value={p.targetRoles} onChange={(e) => setP({ ...p, targetRoles: e.target.value })} />
      <Textarea aria-label="Steps" placeholder="Steps (one per line)" rows={3} className="mt-1" value={p.steps} onChange={(e) => setP({ ...p, steps: e.target.value })} />
      <Button size="sm" className="mt-1" onClick={() => act({ action: 'plan', goal: p.goal, targetRoles: p.targetRoles, steps: p.steps, expectedVersion: d.plan.version }, 'Plan saved.')}>Save plan</Button>
      <p className="mt-3 text-xs font-medium">Share with a career coach</p>
      <p className="text-xs text-muted-foreground">A coach sees your plan and resumes only while you share, and only until the end date.</p>
      {d.shares.map((s: any) => <p key={s.coachId} className="text-xs">{s.coach} until {s.until} <Button size="sm" variant="ghost" onClick={() => act({ action: 'share', coachId: s.coachId, on: false }, 'Sharing stopped.')}>Stop</Button></p>)}
      <div className="mt-1 flex flex-wrap gap-2"><select aria-label="Coach" className={sel} value={sh.coachId} onChange={(e) => setSh({ ...sh, coachId: e.target.value })}><option value="">Coach…</option>{d.coaches.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Input aria-label="Share until" type="date" className="w-40" value={sh.until} onChange={(e) => setSh({ ...sh, until: e.target.value })} />
        <Button size="sm" variant="outline" disabled={!sh.coachId || !sh.until} onClick={() => act({ action: 'share', coachId: sh.coachId, until: sh.until, on: true }, 'Shared.')}>Share</Button></div>
    </Panel>
  );
}

function Resumes({ d, act }: P) {
  const [f, setF] = useState({ label: '', body: '' });
  return (
    <Panel title="Resumes and feedback">
      {!d.resumes.length ? <Empty>No resumes yet. Paste the text of your resume to get coach feedback.</Empty> : d.resumes.map((r: any) => <details key={r.id} className="border-b border-border py-1 text-sm">
        <summary className="cursor-pointer">{r.label} · version {r.version} · {r.feedback.length} comments</summary>
        <pre className="whitespace-pre-wrap text-xs">{r.body}</pre>
        {r.feedback.map((x: any, i: number) => <p key={i} className="text-xs"><span className="font-medium">{x.section}</span> — {x.comment} <span className="text-muted-foreground">({x.coach})</span></p>)}
      </details>)}
      <div className="mt-2 space-y-1"><Input aria-label="Resume label" placeholder="Label (same label saves a new version)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <Textarea aria-label="Resume text" rows={4} placeholder="Resume text" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <Button size="sm" disabled={f.label.length < 2 || f.body.length < 50} onClick={async () => { if (await act({ action: 'resume', ...f }, 'Saved as a new version.')) setF({ label: '', body: '' }); }}>Save version</Button></div>
    </Panel>
  );
}

function Interviews({ d, act }: P) {
  const [b, setB] = useState({ coachId: '', startsAt: '', focus: '' });
  const [sc, setSc] = useState<Record<number, any>>({});
  return (
    <Panel title="Mock interviews">
      {!d.interviews.length ? <Empty>No mock interviews.</Empty> : d.interviews.map((i: any) => { const s = sc[i.id] ?? { structure: '', evidence: '', communication: '', notes: '' };
        return <div key={i.id} className="border-b border-border py-1 text-sm">
          <p>{fmt(i.startsAt)} · {i.asCoach ? i.student : `with ${i.coach}`} · {i.focus} <Status value={lbl(i.state)} /></p>
          {i.scores && <p className="text-xs">Structure {i.scores.structure}/5 · Evidence {i.scores.evidence}/5 · Communication {i.scores.communication}/5 — {i.notes}</p>}
          {i.state === 'booked' && <div className="mt-1 flex flex-wrap gap-2">
            {i.asCoach && i.started && <>{['structure', 'evidence', 'communication'].map((k) => <select key={k} aria-label={k} className={sel} value={s[k]} onChange={(e) => setSc({ ...sc, [i.id]: { ...s, [k]: e.target.value } })}><option value="">{k}…</option>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select>)}
              <Input aria-label="Notes" placeholder="Notes for the student" className="h-8 w-56" value={s.notes} onChange={(e) => setSc({ ...sc, [i.id]: { ...s, notes: e.target.value } })} />
              <Button size="sm" disabled={!s.structure || !s.evidence || !s.communication || s.notes.length < 10} onClick={() => act({ action: 'interviewStep', id: i.id, step: 'score', structure: Number(s.structure), evidence: Number(s.evidence), communication: Number(s.communication), notes: s.notes }, 'Scored.')}>Save scores</Button>
              <Button size="sm" variant="ghost" onClick={() => act({ action: 'interviewStep', id: i.id, step: 'no_show' }, 'Marked no-show.')}>No-show</Button></>}
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'interviewStep', id: i.id, step: 'cancel' }, 'Cancelled.')}>Cancel</Button></div>}
        </div>; })}
      <div className="mt-2 flex flex-wrap gap-2"><select aria-label="Coach" className={sel} value={b.coachId} onChange={(e) => setB({ ...b, coachId: e.target.value })}><option value="">Coach…</option>{d.coaches.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Input aria-label="When" type="datetime-local" className="w-52" value={b.startsAt} onChange={(e) => setB({ ...b, startsAt: e.target.value })} />
        <Input aria-label="Focus" placeholder="Focus (behavioral, case…)" className="w-44" value={b.focus} onChange={(e) => setB({ ...b, focus: e.target.value })} />
        <Button size="sm" disabled={!b.coachId || !b.startsAt || b.focus.length < 3} onClick={() => act({ action: 'book', coachId: b.coachId, startsAt: new Date(b.startsAt).toISOString(), focus: b.focus }, 'Booked.')}>Book</Button></div>
    </Panel>
  );
}

function Actions({ d, act }: P) {
  const [note, setNote] = useState<Record<number, string>>({});
  return (
    <Panel title="Follow-up actions">
      {!d.actions.length ? <Empty>No follow-up actions.</Empty> : d.actions.map((x: any) => <div key={x.id} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-sm">
        <span>{x.title}{x.due ? ` · due ${x.due}` : ''} · {x.asCoach ? x.student : `from ${x.coach}`}</span><Status value={x.state} />{x.note && <span className="text-xs">“{x.note}”</span>}
        {!x.asCoach && x.state === 'open' && <><Input aria-label="Note" placeholder="What you did" className="h-8 w-44" value={note[x.id] ?? ''} onChange={(e) => setNote({ ...note, [x.id]: e.target.value })} />
          <Button size="sm" variant="outline" onClick={() => act({ action: 'actionStep', id: x.id, step: 'done', note: note[x.id] ?? '' }, 'Marked done.')}>Done</Button></>}
        {x.asCoach && x.state === 'done' && <><Button size="sm" onClick={() => act({ action: 'actionStep', id: x.id, step: 'confirm' }, 'Confirmed.')}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => act({ action: 'actionStep', id: x.id, step: 'reopen' }, 'Reopened.')}>Reopen</Button></>}
        {x.asCoach && ['open', 'done'].includes(x.state) && <Button size="sm" variant="ghost" onClick={() => act({ action: 'actionStep', id: x.id, step: 'drop' }, 'Dropped.')}>Drop</Button>}
      </div>)}
    </Panel>
  );
}

function FairsAndOutcomes({ d, act }: P) {
  const center = d.roles.includes('center');
  const [f, setF] = useState({ title: '', startsAt: '', location: '', employers: '', capacity: '' });
  const [o, setO] = useState({ cohort: '', kind: 'employed', organization: '' });
  return (
    <Panel title="Career fairs and outcomes">
      {!d.fairs.length ? <Empty>No career fairs scheduled.</Empty> : d.fairs.map((x: any) => <div key={x.id} className="border-b border-border py-1 text-sm">
        <p>{x.title} · {fmt(x.startsAt)}{x.location ? ` · ${x.location}` : ''} · {x.n}/{x.capacity}</p>{x.employers && <p className="text-xs">Employers: {x.employers}</p>}
        {x.mine ? <Button size="sm" variant="outline" onClick={() => act({ action: 'fairReg', fairId: x.id, on: false }, 'Registration cancelled.')}>Cancel registration</Button>
          : <Button size="sm" disabled={x.n >= x.capacity} onClick={() => act({ action: 'fairReg', fairId: x.id, on: true }, 'Registered.')}>{x.n >= x.capacity ? 'Full' : 'Register'}</Button>}
        {x.registrants.map((r: any) => <span key={r.id} className="mr-2 text-xs">{r.name} {r.checkedIn ? '✓' : r.id !== d.me && <Button size="sm" variant="ghost" onClick={() => act({ action: 'checkin', fairId: x.id, studentId: r.id }, 'Checked in.')}>Check in</Button>}</span>)}
      </div>)}
      {center && <div className="mt-2 space-y-1"><p className="text-xs font-medium">Schedule a fair</p>
        <div className="flex flex-wrap gap-2"><Input aria-label="Title" placeholder="Title" className="w-40" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input aria-label="Starts" type="datetime-local" className="w-52" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          <Input aria-label="Location" placeholder="Location" className="w-32" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          <Input aria-label="Capacity" type="number" placeholder="Capacity" className="w-24" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
        <Input aria-label="Employers" placeholder="Employers attending (comma separated)" value={f.employers} onChange={(e) => setF({ ...f, employers: e.target.value })} />
        <Button size="sm" disabled={f.title.length < 3 || !f.startsAt || !(Number(f.capacity) > 0)} onClick={() => act({ action: 'fair', ...f, startsAt: new Date(f.startsAt).toISOString(), capacity: Number(f.capacity) }, 'Fair scheduled.')}>Schedule</Button></div>}
      <p className="mt-3 text-xs font-medium">Your outcome</p>
      {d.outcomes.map((x: any) => <p key={x.cohort} className="text-xs">{x.cohort}: {lbl(x.kind)}{x.organization ? ` at ${x.organization}` : ''} <Status value={x.verified ? 'verified' : 'unverified'} /></p>)}
      <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Graduating class" placeholder="Class (e.g. 2026)" className="w-28" value={o.cohort} onChange={(e) => setO({ ...o, cohort: e.target.value })} />
        <select aria-label="Outcome" className={sel} value={o.kind} onChange={(e) => setO({ ...o, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{lbl(k)}</option>)}</select>
        <Input aria-label="Organization" placeholder="Organization (optional)" className="w-44" value={o.organization} onChange={(e) => setO({ ...o, organization: e.target.value })} />
        <Button size="sm" variant="outline" disabled={o.cohort.length < 2} onClick={() => act({ action: 'outcome', ...o }, 'Outcome saved.')}>Save</Button></div>
      {center && <><p className="mt-3 text-xs font-medium">Verify outcomes</p>
        {!d.toVerify.length ? <Empty>Nothing to verify.</Empty> : d.toVerify.map((x: any) => <p key={x.studentId + x.cohort} className="text-xs">{x.student} · {x.cohort} · {lbl(x.kind)}{x.organization ? ` at ${x.organization}` : ''}
          <Button size="sm" variant="ghost" onClick={() => act({ action: 'verify', studentId: x.studentId, cohort: x.cohort }, 'Verified.')}>Verify</Button></p>)}
        <p className="mt-3 text-xs font-medium">Outcome report (groups under five hidden)</p>
        {Object.entries(d.report).map(([c, rows]: any) => <p key={c} className="text-xs">{c}: {rows.map((r: any) => `${lbl(r.kind)} ${r.n ?? '<5'}`).join(' · ')}</p>)}</>}
    </Panel>
  );
}

function Coach({ d, act }: P) {
  const [c, setC] = useState<Record<number, { section: string; comment: string }>>({});
  const [ac, setAc] = useState<Record<string, { title: string; due: string }>>({});
  return (
    <Panel title="Students sharing with you">
      {!d.shared.length ? <Empty>No students are sharing their materials with you.</Empty> : d.shared.map((s: any) => { const a = ac[s.id] ?? { title: '', due: '' };
        return <div key={s.id} className="border-b border-border py-2 text-sm">
          <p className="font-medium">{s.name} <span className="text-xs text-muted-foreground">shared until {s.until}</span></p>
          <p className="text-xs">Goal: {s.plan.goal || '—'} · Roles: {s.plan.targetRoles || '—'}</p>{s.plan.steps && <pre className="whitespace-pre-wrap text-xs">{s.plan.steps}</pre>}
          {s.resumes.map((r: any) => { const f = c[r.id] ?? { section: '', comment: '' };
            return <details key={r.id} className="text-xs"><summary className="cursor-pointer">{r.label} v{r.version}</summary><pre className="whitespace-pre-wrap">{r.body}</pre>
              <div className="flex flex-wrap gap-2"><Input aria-label="Section" placeholder="Section" className="h-8 w-28" value={f.section} onChange={(e) => setC({ ...c, [r.id]: { ...f, section: e.target.value } })} />
                <Input aria-label="Comment" placeholder="Comment" className="h-8 w-64" value={f.comment} onChange={(e) => setC({ ...c, [r.id]: { ...f, comment: e.target.value } })} />
                <Button size="sm" disabled={f.section.length < 2 || f.comment.length < 5} onClick={async () => { if (await act({ action: 'comment', resumeId: r.id, ...f }, 'Feedback added.')) setC({ ...c, [r.id]: { section: '', comment: '' } }); }}>Add</Button></div></details>; })}
          <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Follow-up action" placeholder="Follow-up action" className="h-8 w-56" value={a.title} onChange={(e) => setAc({ ...ac, [s.id]: { ...a, title: e.target.value } })} />
            <Input aria-label="Due" type="date" className="h-8 w-36" value={a.due} onChange={(e) => setAc({ ...ac, [s.id]: { ...a, due: e.target.value } })} />
            <Button size="sm" variant="outline" disabled={a.title.length < 3} onClick={() => act({ action: 'assign', studentId: s.id, title: a.title, due: a.due || null }, 'Action added.')}>Assign</Button></div>
        </div>; })}
    </Panel>
  );
}

function Admin({ d, act }: P) {
  const [f, setF] = useState({ email: '', role: 'coach' });
  return (
    <Panel title="Career roles (administrators)">
      <div className="flex flex-wrap gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select aria-label="Role" className={sel} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="coach">Career coach</option><option value="center">Career center staff</option></select>
        <Button size="sm" disabled={!f.email.includes('@')} onClick={() => act({ action: 'staff', ...f, on: true }, 'Granted.')}>Grant</Button>
        <Button size="sm" variant="outline" disabled={!f.email.includes('@')} onClick={() => act({ action: 'staff', ...f, on: false }, 'Revoked.')}>Revoke</Button></div>
      {d.staffList.map((x: any, i: number) => <p key={i} className="text-xs">{x.name} · {x.role}</p>)}
    </Panel>
  );
}

export default function CareerServices() {
  const state = useLoad(() => careerServices({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Plan" title="Career services" sub="Your career plan, resume feedback, mock interviews, follow-up actions, career fairs and outcomes. Coaches see your materials only while you share them." />
      <Loadable state={state}>{(d: any) => <div className="grid gap-4 lg:grid-cols-2">
        <PlanAndSharing d={d} act={act} /><Resumes d={d} act={act} /><Interviews d={d} act={act} /><Actions d={d} act={act} /><FairsAndOutcomes d={d} act={act} />
        {d.roles.includes('coach') && <Coach d={d} act={act} />}{d.isAdmin && <Admin d={d} act={act} />}
      </div>}</Loadable>
    </div>
  );
}
