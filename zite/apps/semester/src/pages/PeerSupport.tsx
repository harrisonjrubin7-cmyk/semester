import { useState } from 'react';
import { toast } from 'sonner';
import { support } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const lbl = (s: string) => s.replace(/_/g, ' ');

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await support(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}
type P = { d: any; act: ReturnType<typeof useAct> };

function Match({ x, d, act }: { x: any } & P) {
  const [ci, setCi] = useState({ mood: 'good', note: '' });
  const [goal, setGoal] = useState('');
  const [prog, setProg] = useState<Record<number, string>>({});
  const [esc, setEsc] = useState({ category: 'wellbeing', note: '' });
  const [res, setRes] = useState<Record<number, string>>({});
  const active = x.state === 'active';
  return (
    <div className="border-b border-border py-2 text-sm">
      <p><span className="font-medium">{x.iMentor ? `Mentoring ${x.mentee}` : x.iMentee ? `Mentor: ${x.mentor}` : `${x.mentor} → ${x.mentee}`}</span> <Status value={x.state} /></p>
      {x.goals.map((g: any) => <div key={g.id} className="flex flex-wrap items-center gap-2 text-xs"><span>{g.title}</span><Status value={g.state} />{g.progress && <span>· {g.progress}</span>}
        {active && g.state === 'open' && (x.iMentor || x.iMentee) && <><Input aria-label="Progress" placeholder="Progress" className="h-7 w-40" value={prog[g.id] ?? ''} onChange={(e) => setProg({ ...prog, [g.id]: e.target.value })} />
          <Button size="sm" variant="ghost" disabled={!prog[g.id]} onClick={() => act({ action: 'goal', matchId: x.id, goalId: g.id, progress: prog[g.id] }, 'Progress saved.')}>Save</Button></>}
        {active && g.state === 'open' && x.iMentee && <><Button size="sm" variant="ghost" onClick={() => act({ action: 'goal', matchId: x.id, goalId: g.id, state: 'met' }, 'Goal met.')}>Met</Button>
          <Button size="sm" variant="ghost" onClick={() => act({ action: 'goal', matchId: x.id, goalId: g.id, state: 'dropped' }, 'Dropped.')}>Drop</Button></>}</div>)}
      {active && x.iMentee && <div className="mt-1 flex gap-2"><Input aria-label="New goal" placeholder="New goal" className="h-8 w-56" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <Button size="sm" variant="outline" disabled={goal.length < 3} onClick={async () => { if (await act({ action: 'goal', matchId: x.id, title: goal }, 'Goal added.')) setGoal(''); }}>Add goal</Button></div>}
      {x.checkins.map((c: any, i: number) => <p key={i} className="text-xs">{fmt(c.at)} · <Status value={c.mood} /> {c.note}</p>)}
      {active && x.iMentor && <div className="mt-1 flex flex-wrap gap-2"><select aria-label="How they are doing" className={sel} value={ci.mood} onChange={(e) => setCi({ ...ci, mood: e.target.value })}>{['good', 'okay', 'struggling'].map((m) => <option key={m}>{m}</option>)}</select>
        <Input aria-label="Check-in note" placeholder="Brief note" maxLength={500} className="h-8 w-56" value={ci.note} onChange={(e) => setCi({ ...ci, note: e.target.value })} />
        <Button size="sm" variant="outline" onClick={async () => { if (await act({ action: 'checkin', matchId: x.id, ...ci }, 'Check-in logged.')) setCi({ mood: 'good', note: '' }); }}>Log check-in</Button></div>}
      {x.escalations.map((e: any) => <div key={e.id} className="text-xs"><Status value={e.state} /> {lbl(e.category)}: {e.note}{e.resolution ? ` → ${e.resolution}` : ''}
        {d.sup && e.state === 'open' && !e.mine && <span className="ml-2 inline-flex gap-1"><Input aria-label="Resolution" placeholder="What was done" className="h-7 w-48" value={res[e.id] ?? ''} onChange={(ev) => setRes({ ...res, [e.id]: ev.target.value })} />
          <Button size="sm" variant="ghost" disabled={(res[e.id] ?? '').length < 5} onClick={() => act({ action: 'resolve', id: e.id, text: res[e.id] }, 'Resolved.')}>Resolve</Button></span>}</div>)}
      {active && x.iMentor && <div className="mt-1 flex flex-wrap gap-2"><select aria-label="Escalation category" className={sel} value={esc.category} onChange={(e) => setEsc({ ...esc, category: e.target.value })}>{['wellbeing', 'academic', 'conduct', 'boundary', 'other'].map((c) => <option key={c}>{c}</option>)}</select>
        <Input aria-label="Escalation note" placeholder="Escalate to a supervisor (brief, no private detail)" className="h-8 w-64" value={esc.note} onChange={(e) => setEsc({ ...esc, note: e.target.value })} />
        <Button size="sm" variant="outline" disabled={esc.note.length < 10} onClick={async () => { if (await act({ action: 'escalate', matchId: x.id, ...esc }, 'Sent to supervisors.')) setEsc({ ...esc, note: '' }); }}>Escalate</Button></div>}
      {active && (x.iMentor || x.iMentee || d.sup) && <Button size="sm" variant="ghost" onClick={() => act({ action: 'end', matchId: x.id }, 'Match ended.')}>End match</Button>}
    </div>
  );
}

function Mentoring({ d, act }: P) {
  const [interests, setInterests] = useState('');
  const [m, setM] = useState({ mentorId: '', menteeId: '' });
  const has = (role: string) => d.myRoles.find((r: any) => r.role === role && r.state !== 'withdrawn');
  return (
    <Panel title="Peer mentoring">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Input aria-label="Interests" placeholder="Interests (optional)" className="w-56" value={interests} onChange={(e) => setInterests(e.target.value)} />
        {has('mentee') ? <Button size="sm" variant="outline" onClick={() => act({ action: 'join', role: 'mentee', on: false }, 'Opted out.')}>Stop looking for a mentor</Button>
          : <Button size="sm" onClick={() => act({ action: 'join', role: 'mentee', interests, on: true }, 'Opted in. A supervisor will match you.')}>Find a mentor</Button>}
        {has('mentor') ? <span className="text-xs">Mentor: <Status value={has('mentor').state} /> <Button size="sm" variant="ghost" onClick={() => act({ action: 'join', role: 'mentor', on: false }, 'Withdrawn.')}>Withdraw</Button></span>
          : <Button size="sm" variant="outline" onClick={() => act({ action: 'join', role: 'mentor', interests, on: true }, 'Application sent to supervisors.')}>Offer to mentor</Button>}
      </div>
      {!d.matches.length ? <Empty>No matches yet.</Empty> : d.matches.map((x: any) => <Match key={x.id} x={x} d={d} act={act} />)}
      {d.sup && <div className="mt-3 space-y-1 text-sm"><p className="text-xs font-medium">Supervisor</p>
        {d.pendingMentors.map((p: any) => <p key={p.id} className="text-xs">{p.name}{p.interests ? ` · ${p.interests}` : ''} {p.id !== d.me && <Button size="sm" variant="ghost" onClick={() => act({ action: 'approve', userId: p.id }, 'Approved.')}>Approve mentor</Button>}</p>)}
        <div className="flex flex-wrap gap-2"><select aria-label="Mentor" className={sel} value={m.mentorId} onChange={(e) => setM({ ...m, mentorId: e.target.value })}><option value="">Mentor…</option>{d.mentors.filter((x: any) => x.id !== d.me).map((x: any) => <option key={x.id} value={x.id}>{x.name}{x.interests ? ` (${x.interests})` : ''}</option>)}</select>
          <select aria-label="Mentee" className={sel} value={m.menteeId} onChange={(e) => setM({ ...m, menteeId: e.target.value })}><option value="">Mentee…</option>{d.mentees.filter((x: any) => x.id !== d.me).map((x: any) => <option key={x.id} value={x.id}>{x.name}{x.interests ? ` (${x.interests})` : ''}</option>)}</select>
          <Button size="sm" disabled={!m.mentorId || !m.menteeId} onClick={() => act({ action: 'match', ...m }, 'Matched.')}>Match</Button></div></div>}
    </Panel>
  );
}

function TaQuestions({ d, act }: P) {
  const [f, setF] = useState({ sectionId: '', topic: 'grading', question: '' });
  const [ans, setAns] = useState<Record<number, string>>({});
  if (!d.delegated.length && !d.questions.length) return null;
  return (
    <Panel title="Teaching assistant questions">
      {d.delegated.length > 0 && <div className="space-y-1"><div className="flex flex-wrap gap-2"><select aria-label="Section" className={sel} value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })}><option value="">Section…</option>{d.delegated.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select aria-label="Topic" className={sel} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>{['grading', 'integrity_concern', 'student_request', 'content', 'other'].map((t) => <option key={t} value={t}>{lbl(t)}</option>)}</select></div>
        <Textarea aria-label="Question" rows={2} placeholder="Question for the instructor" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
        <Button size="sm" disabled={!f.sectionId || f.question.length < 10} onClick={async () => { if (await act({ action: 'ask', ...f }, 'Sent to the instructor.')) setF({ ...f, question: '' }); }}>Ask the instructor</Button></div>}
      {d.questions.map((q: any) => <div key={q.id} className="mt-2 border-b border-border pb-1 text-sm"><p><Status value={q.state} /> {q.section} · {lbl(q.topic)} · {q.ta}</p><p className="text-xs">{q.question}</p>
        {q.answer && <p className="text-xs">→ {q.answer} <span className="text-muted-foreground">({q.answeredBy})</span></p>}
        {q.canAnswer && q.state === 'open' && <div className="flex gap-2"><Input aria-label="Answer" className="h-8 w-64" value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} />
          <Button size="sm" disabled={(ans[q.id] ?? '').length < 3} onClick={() => act({ action: 'answer', id: q.id, answer: ans[q.id] }, 'Answered.')}>Answer</Button></div>}</div>)}
    </Panel>
  );
}

function Tutoring({ d, act }: P) {
  const [r, setR] = useState<Record<string, { score: string; comment: string }>>({});
  const [rv, setRv] = useState<Record<string, { note: string; outcome: string }>>({});
  if (!d.toRate.length && !d.center) return null;
  return (
    <Panel title="Tutoring quality">
      {d.toRate.map((s: any) => { const f = r[s.id] ?? { score: '', comment: '' };
        return <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-sm"><span>{s.subject} with {s.tutor}{s.at ? ` · ${fmt(s.at)}` : ''}</span>
          {s.score ? <Status value={`rated ${s.score}/5`} /> : <><select aria-label="Rating" className={sel} value={f.score} onChange={(e) => setR({ ...r, [s.id]: { ...f, score: e.target.value } })}><option value="">Rate 1–5</option>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select>
            <Input aria-label="Comment" placeholder="Comment (optional)" className="h-8 w-48" value={f.comment} onChange={(e) => setR({ ...r, [s.id]: { ...f, comment: e.target.value } })} />
            <Button size="sm" variant="outline" disabled={!f.score} onClick={() => act({ action: 'rate', requestId: s.id, score: Number(f.score), comment: f.comment }, 'Thanks for rating.')}>Rate</Button></>}</div>; })}
      {d.center && <><p className="mt-3 text-xs font-medium">Tutors (averages shown at three or more ratings)</p>
        {!d.tutors.length ? <Empty>No ratings yet.</Empty> : d.tutors.map((t: any) => { const f = rv[t.id] ?? { note: '', outcome: 'no_action' };
          return <div key={t.id} className="border-b border-border py-1 text-xs"><p>{t.name} · {t.n} ratings · {t.avg == null ? 'average hidden' : `${t.avg}/5`}</p>
            {!t.self && <div className="flex flex-wrap gap-2"><Input aria-label="Review note" placeholder="Review note" className="h-8 w-56" value={f.note} onChange={(e) => setRv({ ...rv, [t.id]: { ...f, note: e.target.value } })} />
              <select aria-label="Outcome" className={sel} value={f.outcome} onChange={(e) => setRv({ ...rv, [t.id]: { ...f, outcome: e.target.value } })}>{['no_action', 'coaching', 'observe', 'pause'].map((o) => <option key={o} value={o}>{lbl(o)}</option>)}</select>
              <Button size="sm" variant="outline" disabled={f.note.length < 10} onClick={() => act({ action: 'review', tutorId: t.id, note: f.note, outcome: f.outcome }, 'Review recorded.')}>Record review</Button></div>}</div>; })}
        {d.reviews.slice(0, 10).map((x: any, i: number) => <p key={i} className="text-xs">{fmt(x.at)} · {x.reviewer} on {x.tutor}: {lbl(x.outcome)} — {x.note}</p>)}</>}
    </Panel>
  );
}

function Admin({ d, act }: P) {
  const [em, setEm] = useState('');
  return (
    <Panel title="Mentoring supervisors (administrators)">
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={em} onChange={(e) => setEm(e.target.value)} />
        <Button size="sm" disabled={!em.includes('@')} onClick={() => act({ action: 'supervisor', email: em, on: true }, 'Appointed.')}>Appoint</Button>
        <Button size="sm" variant="outline" disabled={!em.includes('@')} onClick={() => act({ action: 'supervisor', email: em, on: false }, 'Removed.')}>Remove</Button></div>
      <p className="mt-1 text-xs">{d.supervisors.length ? d.supervisors.join(', ') : 'No supervisors yet.'}</p>
    </Panel>
  );
}

export default function PeerSupport() {
  const state = useLoad(() => support({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Help" title="Peer support" sub="Peer mentoring, questions from teaching assistants to instructors, and tutoring feedback." />
      <Loadable state={state}>{(d: any) => <div className="grid gap-4 lg:grid-cols-2">
        <Mentoring d={d} act={act} /><TaQuestions d={d} act={act} /><Tutoring d={d} act={act} />{d.isAdmin && <Admin d={d} act={act} />}
      </div>}</Loadable>
    </div>
  );
}
