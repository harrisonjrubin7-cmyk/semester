import { useState } from 'react';
import { toast } from 'sonner';
import { integrity } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, DecisionTrail, errMsg, fmt } from '../components/kit';
import { CATEGORIES, next, Step, State, Actor } from '../lib/integrityRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const words = (s: string) => s.replace(/_/g, ' ');
const STATE: Record<string, string> = {
  reported: 'Waiting for the student', responded: 'Student responded', proposed: 'Course resolution offered', resolved_course: 'Resolved in the course',
  referred: 'With the integrity office', decided: 'Decided', appealed: 'Appeal pending', closed: 'Closed', withdrawn: 'Withdrawn',
};
const COURSE = ['warning', 'redo', 'grade_penalty', 'zero_on_work', 'none'];
const FORMAL = ['warning', 'redo', 'grade_penalty', 'zero_on_work', 'course_failure_recommended'];
const LABEL: Record<Step, string> = {
  respond: 'Send my response', propose: 'Offer a course-level resolution', accept: 'Accept the resolution', decline: 'Decline and send to the integrity office',
  refer: 'Send to the integrity office', decide: 'Record the decision', appeal: 'Appeal', decide_appeal: 'Decide the appeal', withdraw: 'Withdraw the report', close: 'Close without appeal',
};
const NEED: Partial<Record<Step, number>> = { respond: 10, propose: 10, refer: 10, withdraw: 10, decide: 20, appeal: 20, decide_appeal: 20 };

function Act({ c, step, reload }: { c: any; step: Step; reload: () => void }) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState(step === 'propose' ? 'redo' : step === 'decide' ? 'responsible:warning' : step === 'decide_appeal' ? 'upheld' : '');
  const need = NEED[step] ?? 0;
  const go = async () => {
    try { await integrity({ action: 'step', id: c.id, step, expectedVersion: c.version, text, choice }); toast('Recorded.'); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  const select = (opts: { v: string; t: string }[]) => <select aria-label="Choice" className="rounded-md border border-border bg-background p-2 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)}>{opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</select>;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2">
      {step === 'propose' && select(COURSE.map((s) => ({ v: s, t: words(s) })))}
      {step === 'decide' && select([{ v: 'not_responsible', t: 'Not responsible' }, ...FORMAL.map((s) => ({ v: `responsible:${s}`, t: `Responsible: ${words(s)}` }))])}
      {step === 'decide_appeal' && select([{ v: 'upheld', t: 'Uphold' }, { v: 'overturned', t: 'Overturn (not responsible)' }, ...['warning', 'redo', 'grade_penalty', 'zero_on_work'].map((s) => ({ v: `modified:${s}`, t: `Modify to ${words(s)}` }))])}
      {need > 0 && <Textarea aria-label="Reason" placeholder={step === 'respond' ? 'Your account of what happened' : 'Reason (the other parties will see it)'} value={text} onChange={(e) => setText(e.target.value)} />}
      <Button size="sm" variant={step === 'withdraw' || step === 'decline' ? 'outline' : 'default'} disabled={text.trim().length < need} onClick={go}>{LABEL[step]}</Button>
      {need > 0 && text.trim().length < need && <span className="ml-2 text-xs text-muted-foreground">At least {need} characters.</span>}
    </div>
  );
}

function CaseCard({ c, reload }: { c: any; reload: () => void }) {
  const steps = (Object.keys(LABEL) as Step[]).filter((s) => next(c.state as State, s, c.role as Actor)
    && !(c.role === 'officer' && s === 'decide_appeal' && c.decidedByMe));
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{c.ref} · {c.section} · {words(c.category)}</span><Status value={STATE[c.state] ?? c.state} /></div>
      <p className="text-xs text-muted-foreground">Student: {c.student} · Reported by {c.reporter}{c.workRef ? ` · ${c.workRef}` : ''} · You are the {c.role === 'reporter' ? 'reporting instructor' : c.role === 'officer' ? 'integrity office' : 'student'}</p>
      <p className="mt-2 whitespace-pre-wrap">{c.allegation}</p>
      {c.statement && <p className="mt-2 text-xs"><span className="font-medium">Student’s response:</span> {c.statement}</p>}
      {c.proposedSanction && <p className="mt-1 text-xs"><span className="font-medium">Course resolution offered:</span> {words(c.proposedSanction)} — {c.proposalNote}</p>}
      {c.finding && <p className="mt-1 text-xs"><span className="font-medium">Decision:</span> {words(c.finding)}{c.sanction && c.sanction !== 'none' ? `, ${words(c.sanction)}` : ''} — {c.decisionNote}</p>}
      {c.appealNote && <p className="mt-1 text-xs"><span className="font-medium">Appeal:</span> {c.appealNote}{c.appealOutcome ? ` · Outcome: ${c.appealOutcome}` : ''}</p>}
      {c.role === 'student' && c.state === 'decided' && <p className="mt-1 text-xs">You can appeal within 14 days of the decision. A different officer will hear it.</p>}
      <p className="mt-1 text-xs text-muted-foreground">An outcome does not change any grade by itself; any grade change is a separate step by your instructor.</p>
      {steps.map((s) => <Act key={s} c={c} step={s} reload={reload} />)}
      <details className="mt-2"><summary className="cursor-pointer text-xs">History</summary>
        <DecisionTrail label="Case history" items={c.events.map((e: any) => ({ title: `${words(e.step)} → ${STATE[e.state] ?? e.state}`, who: e.by === 'officer' ? 'Integrity office' : e.by === 'reporter' ? 'Instructor' : 'Student', when: fmt(e.at), detail: e.note }))} />
      </details>
    </li>
  );
}

function Report({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ sectionId: d.teaching[0]?.id ?? '', studentId: '', category: 'plagiarism', allegation: '', workRef: '' });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const students = d.teaching.find((s: any) => s.id === f.sectionId)?.students ?? [];
  const send = async () => {
    try { const r: any = await integrity({ action: 'report', requestKey: key, ...f } as any); toast(r.result?.replayed ? 'Already sent.' : `Reported as AI-${r.result?.id}. The student was notified without details.`);
      setF({ ...f, studentId: '', allegation: '', workRef: '' }); setKey(crypto.randomUUID()); reload(); } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Section<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value, studentId: '' })}>
        {d.teaching.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="text-xs">Student<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
        <option value="">Choose…</option>{students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-xs">Concern<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{words(c)}</option>)}</select></label>
      <label className="text-xs">Which work (optional)<Input className="mt-1" placeholder="e.g. Essay 2" value={f.workRef} onChange={(e) => setF({ ...f, workRef: e.target.value })} /></label>
      <label className="text-xs sm:col-span-2">What you observed (the student will read this)<Textarea className="mt-1" value={f.allegation} onChange={(e) => setF({ ...f, allegation: e.target.value })} /></label>
      <div className="sm:col-span-2">{f.studentId && f.allegation.trim().length >= 20 ? <Button size="sm" onClick={send}>Report</Button> : <span className="text-xs text-muted-foreground">Choose a student and describe the concern (20+ characters).</span>}</div>
    </div>
  );
}

function Office({ d, reload }: { d: any; reload: () => void }) {
  const [email, setEmail] = useState('');
  const set = async (on: boolean, em: string) => { try { await integrity({ action: 'setOfficer', email: em, on }); toast('Saved.'); setEmail(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Integrity office members">
      {d.officers.length ? <ul className="mb-2 space-y-1 text-sm">{d.officers.map((o: any) => <li key={o.id}>{o.name}</li>)}</ul> : <Empty>No officers yet. Referred cases wait until one is added.</Empty>}
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={!email.includes('@')} onClick={() => set(true, email)}>Add</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => set(false, email)}>Remove</Button></div>
    </Panel>
  );
}

export default function Integrity() {
  const s = useLoad(() => integrity({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Academic integrity" title="Integrity cases" sub="Only the student, the reporting instructor and the integrity office can see a case. Every decision gives its reason." />
      <Loadable state={s}>{(d: any) => {
        const open = d.cases.filter((c: any) => !['resolved_course', 'closed', 'withdrawn'].includes(c.state));
        const done = d.cases.filter((c: any) => ['resolved_course', 'closed', 'withdrawn'].includes(c.state));
        return (
          <div className="space-y-4">
            {d.teaching.length > 0 && <Panel title="Report a concern"><Report d={d} reload={s.reload} /></Panel>}
            <Panel title={`Open · ${open.length}`}>{open.length ? <ul className="space-y-2">{open.map((c: any) => <CaseCard key={c.id} c={c} reload={s.reload} />)}</ul> : <Empty>No open cases.</Empty>}</Panel>
            {done.length > 0 && <Panel title={`Finished · ${done.length}`}><ul className="space-y-2">{done.map((c: any) => <CaseCard key={c.id} c={c} reload={s.reload} />)}</ul></Panel>}
            {d.isAdmin && <Office d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
