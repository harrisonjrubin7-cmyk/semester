import { useState } from 'react';
import { toast } from 'sonner';
import { tutoring } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await tutoring(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const open = (s: string) => ['requested', 'waitlisted', 'matched', 'scheduled'].includes(s);

function RequestForm({ reload }: { reload: () => void }) {
  const [subject, setSubject] = useState(''); const [goal, setGoal] = useState('');
  return (
    <Panel title="Ask for a tutor">
      <div className="grid gap-2 md:grid-cols-3">
        <Input aria-label="Subject" placeholder="Subject, e.g. Calculus I" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input aria-label="What you want help with" className="md:col-span-2" placeholder="What you want help with (only you and your tutor see this)" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </div>
      <Button className="mt-2" size="sm" disabled={subject.trim().length < 2 || goal.trim().length < 10}
        onClick={async () => { if (await run({ action: 'request', id: crypto.randomUUID(), subject, goal }, 'Request sent to the learning center.', reload)) { setSubject(''); setGoal(''); } }}>Request</Button>
    </Panel>
  );
}

function Close({ r, reload }: { r: any; reload: () => void }) {
  const [summary, setSummary] = useState(''); const [follow, setFollow] = useState('');
  const followups = follow.split('\n').map((x) => x.trim()).filter((x) => x.length >= 2);
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label="Summary for the student" rows={2} placeholder="What you covered (the student reads this; the center does not)" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <Textarea aria-label="Follow-ups" rows={2} placeholder="Next steps for the student, one per line" value={follow} onChange={(e) => setFollow(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={summary.trim().length < 10} onClick={() => run({ action: 'complete', id: r.id, version: r.version, attended: true, summary, followups }, 'Session closed. The student has your summary.', reload)}>Attended · close</Button>
        <Button size="sm" variant="outline" onClick={() => run({ action: 'complete', id: r.id, version: r.version, attended: false, summary: '', followups: [] }, 'Marked as no-show.', reload)}>No-show</Button>
      </div>
    </div>
  );
}

function Schedule({ r, reload }: { r: any; reload: () => void }) {
  const [at, setAt] = useState('');
  return (
    <div className="mt-2 flex gap-2">
      <Input aria-label="Session time" type="datetime-local" className="max-w-xs" value={at} onChange={(e) => setAt(e.target.value)} />
      <Button size="sm" disabled={!at} onClick={() => run({ action: 'schedule', id: r.id, version: r.version, at: new Date(at).toISOString() }, 'Scheduled. The student was told.', reload)}>{r.state === 'scheduled' ? 'Reschedule' : 'Schedule'}</Button>
    </div>
  );
}

function TutorProfile({ p, reload }: { p: any; reload: () => void }) {
  const [subjects, setSubjects] = useState((p?.subjects ?? []).join(', ')); const [availability, setAvailability] = useState(p?.availability ?? '');
  const list = subjects.split(',').map((s: string) => s.trim()).filter((s: string) => s.length >= 2);
  return (
    <Panel title="Your tutor profile">
      {p && <p className="mb-2 text-xs text-muted-foreground"><Status value={p.verified ? 'verified' : 'awaiting verification'} /> {p.verified ? 'The learning center can match you.' : 'The learning center checks your qualifications before you can be matched. Adding a subject asks them again.'}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <Input aria-label="Subjects" placeholder="Subjects, comma separated" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
        <Input aria-label="Availability" placeholder="When you are available" value={availability} onChange={(e) => setAvailability(e.target.value)} />
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!list.length || availability.trim().length < 5} onClick={() => run({ action: 'profile', subjects: list, availability, active: true }, 'Profile saved.', reload)}>{p ? 'Save' : 'Offer to tutor'}</Button>
        {p?.active && <Button size="sm" variant="ghost" onClick={() => run({ action: 'profile', subjects: p.subjects, availability: p.availability, active: false }, 'Paused. You will not get new matches.', reload)}>Pause</Button>}
      </div>
    </Panel>
  );
}

function Match({ r, tutors, reload }: { r: any; tutors: any[]; reload: () => void }) {
  const fit = tutors.filter((t) => t.verified && t.active && t.subjects.some((s: string) => s.toLowerCase() === r.subject.toLowerCase()));
  const [who, setWho] = useState('');
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <select aria-label="Tutor" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">{fit.length ? 'Choose a verified tutor…' : 'No verified tutor for this subject'}</option>{fit.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <Button size="sm" disabled={!who} onClick={() => run({ action: 'match', id: r.id, version: r.version, tutorId: who }, 'Matched. Tutor and student were told.', reload)}>Match</Button>
      {r.state === 'requested' && <Button size="sm" variant="outline" onClick={() => run({ action: 'match', id: r.id, version: r.version, tutorId: null }, 'Waitlisted. The student was told.', reload)}>Waitlist</Button>}
    </div>
  );
}

export default function Tutoring() {
  const s = useLoad(() => tutoring({ action: 'get' }));
  const [who, setWho] = useState('');
  return (
    <>
      <PageHeader eyebrow="Learn" title="Tutoring" sub="Ask for help, tutor others, or run the learning center. Each view shows only what that role needs; tutors never see grades." />
      <Loadable state={s}>{(d: any) => (
        <div className="grid gap-4">
          <RequestForm reload={s.reload} />
          <Panel title="Your requests">
            {!d.mine.length ? <Empty>No requests yet.</Empty> : d.mine.map((r: any) => (
              <div key={r.id} className="border-t border-border py-2 text-sm first:border-0">
                <p className="flex flex-wrap items-center gap-2"><Status value={r.state} /> {r.subject}{r.tutor && ` · with ${r.tutor}`}{r.sessionAt && ` · ${fmt(r.sessionAt)}`}</p>
                <p className="mt-1 text-muted-foreground">{r.goal}</p>
                {r.summary && <p className="mt-1">Summary: {r.summary}</p>}
                {r.followups.length > 0 && <ul className="ml-4 mt-1 list-disc">{r.followups.map((f: string) => <li key={f}>{f}</li>)}</ul>}
                {r.attended === false && <p className="mt-1 text-xs text-muted-foreground">Marked as missed. You can request again.</p>}
                {open(r.state) && <Button size="sm" variant="ghost" onClick={() => run({ action: 'cancel', id: r.id }, 'Cancelled.', s.reload)}>Cancel</Button>}
              </div>))}
          </Panel>
          <TutorProfile p={d.profile} reload={s.reload} />
          {d.profile && <Panel title={`Your tutoring sessions · ${d.assigned.filter((r: any) => r.state !== 'completed').length} open`}>
            {!d.assigned.length ? <Empty>No sessions assigned to you.</Empty> : d.assigned.map((r: any) => (
              <div key={r.id} className="border-t border-border py-3 text-sm first:border-0">
                <p className="flex flex-wrap items-center gap-2"><Status value={r.state} /> {r.subject} · {r.student}{r.sessionAt && ` · ${fmt(r.sessionAt)}`}</p>
                <p className="mt-1 text-muted-foreground">Goal: {r.goal}</p>
                {r.summary && <p className="mt-1">Your summary: {r.summary}</p>}
                {['matched', 'scheduled'].includes(r.state) && <Schedule r={r} reload={s.reload} />}
                {r.state === 'scheduled' && <Close r={r} reload={s.reload} />}
              </div>))}
          </Panel>}
          {d.staff && <>
            <Panel title="Learning center">
              <p className="text-sm">{d.stats.open} open · {d.stats.waitlisted} waitlisted · {d.stats.attended} of {d.stats.completed} completed sessions attended</p>
              <p className="mt-1 text-xs text-muted-foreground">You see subject, state, tutor and attendance. Students' goals and session summaries stay between student and tutor.</p>
              <div className="mt-3">{d.queue.filter((r: any) => open(r.state)).map((r: any) => (
                <div key={r.id} className="border-t border-border py-2 text-sm first:border-0">
                  <p className="flex flex-wrap items-center gap-2"><Status value={r.state} /> #{r.number} · {r.subject}{r.tutor && ` · ${r.tutor}`} · {fmt(r.createdAt)}</p>
                  {['requested', 'waitlisted'].includes(r.state) && <Match r={r} tutors={d.tutors} reload={s.reload} />}
                  <Button size="sm" variant="ghost" onClick={() => run({ action: 'cancel', id: r.id }, 'Cancelled.', s.reload)}>Cancel request</Button>
                </div>))}</div>
            </Panel>
            <Panel title="Tutors and qualifications">
              {!d.tutors.length ? <Empty>No one has offered to tutor yet.</Empty> : <ul className="text-sm">{d.tutors.map((t: any) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-0">
                  <span>{t.name} · {t.subjects.join(', ')} <span className="text-xs text-muted-foreground">· {t.availability}{!t.active && ' · paused'}</span></span>
                  {t.self ? <span className="text-xs text-muted-foreground">Another staff member verifies you</span>
                    : <Button size="sm" variant={t.verified ? 'ghost' : 'outline'} onClick={() => run({ action: 'verify', tutorId: t.id, on: !t.verified }, t.verified ? 'Verification removed.' : 'Verified.', s.reload)}>{t.verified ? 'Remove verification' : 'Verify'}</Button>}
                </li>))}</ul>}
            </Panel>
          </>}
          {d.isAdmin && <Panel title="Learning-center staff">
            <ul className="text-sm">{d.staffList.map((m: any) => <li key={m.id} className="flex items-center justify-between py-1">{m.name}<Button size="sm" variant="ghost" onClick={() => run({ action: 'setStaff', userId: m.id, on: false }, 'Removed.', s.reload)}>Remove</Button></li>)}</ul>
            {!d.staffList.length && <Empty>No learning-center staff yet.</Empty>}
            <div className="mt-2 flex gap-2">
              <select aria-label="Member" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose a member…</option>{d.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <Button size="sm" disabled={!who} onClick={() => run({ action: 'setStaff', userId: who, on: true }, 'Added.', () => { setWho(''); s.reload(); })}>Add</Button>
            </div>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
