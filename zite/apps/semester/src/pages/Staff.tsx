import { useState } from 'react';
import { toast } from 'sonner';
import { staff, help } from 'zitejs/api';
import { PaymentPlansPanel } from '../components/PaymentPlans';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmtDay, Status, SourceTag, ActionPreview, errMsg } from '../components/kit';
import { ConfirmAction } from '../components/overlays';
import RegistrationQueue from '../components/RegistrationQueue';

const run = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => { try { await fn(); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
const Scope = ({ see, approve, cannot }: { see: string; approve: string; cannot: string }) => <p className="mb-4 rounded-[3px] border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Can see: {see} · Can approve: {approve} · Cannot: {cannot}</p>;

export function Gradebook() {
  const s = useLoad(() => staff({ action: 'gradebook' }));
  return (
    <>
      <PageHeader eyebrow="Faculty" title="Gradebook" sub="Scores and final grades for the sections you teach. Students see nothing until you release grades from the course page." />
      <Scope see="students in your sections" approve="final grades before release" cannot="change released grades (that’s a regrade request)" />
      <Loadable state={s}>{(d) => d.sections.length ? d.sections.map((sec: { id: string; label: string; term: string; assignments: { id: string; title: string; points: number }[]; roster: { enrollmentId: string; student: string; finalGrade: string; released: boolean; scores: Record<string, { score: number | null; state: string } | null> }[] }) => (
        <Panel key={sec.id} title={`${sec.label} · ${sec.term}`} className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1 pr-3">Student</th>{sec.assignments.map((a) => <th key={a.id} className="pr-3">{a.title}<span className="block normal-case tracking-normal">/{a.points}</span></th>)}<th>Final</th></tr></thead>
              <tbody>{sec.roster.map((r) => (
                <tr key={r.enrollmentId} className="border-t border-border">
                  <td className="py-2 pr-3">{r.student}</td>
                  {sec.assignments.map((a) => { const x = r.scores[a.id]; return <td key={a.id} className="pr-3 tabular-nums">{x ? (x.score ?? <Status value={x.state} />) : <span className="text-muted-foreground">— missing</span>}</td>; })}
                  <td>{r.released ? <span>{r.finalGrade} <span className="text-xs text-muted-foreground">✓ Released</span></span> : (
                    <Select value={r.finalGrade || undefined} onValueChange={(g) => run(() => staff({ action: 'setFinal', enrollmentId: r.enrollmentId, grade: g }), 'Final grade saved. Hidden until you release it.', s.reload)}>
                      <SelectTrigger className="h-8 w-20"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{d.grades.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>)}</td>
                </tr>))}</tbody>
            </table>
            {!sec.roster.length && <Empty>No students enrolled.</Empty>}
          </div>
        </Panel>
      )) : <Empty>You aren’t listed as an instructor on any section. Open a course and choose “I teach this” to add yourself.</Empty>}</Loadable>
    </>
  );
}

export function TAQueue() {
  const s = useLoad(() => staff({ action: 'taQueue' }));
  return (
    <>
      <PageHeader eyebrow="Faculty · TA" title="Grading queue" sub="Submissions waiting for a score, oldest due date first. Grade them from the course page with the rubric." />
      <Loadable state={s}>{(d) => (
        <Panel action={<span className="text-xs text-muted-foreground">{d.graded} graded, not yet released</span>} title={`${d.queue.length} waiting`}>
          {d.queue.length ? <ul>{[...d.queue].sort((a: { due: string | null }, b: { due: string | null }) => (a.due ?? '').localeCompare(b.due ?? '')).map((q: { id: string; student: string; task: string; section: string; due: string | null; points: number; file: string | null }) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
              <span><span className="font-medium">{q.student}</span> · {q.task}<span className="block text-xs text-muted-foreground">{q.section} · due {fmtDay(q.due)} · {q.points} pts</span></span>
              <span className="flex gap-2">{q.file && <Button asChild size="sm" variant="outline"><a href={q.file} target="_blank" rel="noreferrer">Open file</a></Button>}<Status value="Submitted" /></span>
            </li>))}</ul> : <Empty>Nothing waiting. New submissions appear here as students submit.</Empty>}
        </Panel>
      )}</Loadable>
    </>
  );
}

export function RegistrarDesk() {
  const s = useLoad(() => staff({ action: 'registrar' }));
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader eyebrow="Staff · Registrar" title="Registrar desk" sub="Registration requests from students, waitlists, planned enrollments and prerequisite overrides. Each change is written to the audit log first. Record official enrollments in your SIS too: it is not connected." />
      <Scope see="enrollments across your institution" approve="enrollment status changes" cannot="change your own enrollment" />
      <RegistrationQueue />
      <Loadable state={s}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Enrollment queue">
            <Input placeholder="Filter by student or section" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
            {d.enrollments.length ? <table className="w-full text-sm"><tbody>{d.enrollments.filter((e: { student: string; section: string }) => `${e.student} ${e.section}`.toLowerCase().includes(q.toLowerCase())).map((e: { id: string; student: string; section: string; status: string; source: string; self: boolean }) => (
              <tr key={e.id} className="border-t border-border"><td className="py-2">{e.student}<span className="block text-xs text-muted-foreground">{e.section}</span></td><td><Status value={e.status} /></td>
                <td className="text-right">{e.self ? <span className="text-xs text-muted-foreground">Your own</span> : (
                  <ConfirmAction trigger={<Button size="sm" variant="outline">Enroll</Button>} title={`Enroll ${e.student} in ${e.section}?`} confirmLabel="Enroll — confirm" keepLabel="Keep as is" onConfirm={() => run(() => staff({ action: 'setEnrollment', enrollmentId: e.id, status: 'Enrolled' }), 'Enrolled in Semester. Record it in the SIS too: it is still the official record.', s.reload)}>
                    <ActionPreview says={`${e.student} is enrolled in ${e.section} and it appears on their schedule as Official.`} stays="Their other enrollments and holds." recovery={{ kind: 'request', how: 'set the enrollment to Dropped from this desk.' }} />
                  </ConfirmAction>)}</td></tr>))}</tbody></table> : <Empty>No waitlisted or planned enrollments.</Empty>}
          </Panel>
          <Panel title="Override requests">{d.overrides.length ? <ul className="space-y-2 text-sm">{d.overrides.map((o: { id: string; title: string; status: string; by: string }) => <li key={o.id}>{o.title}<span className="block text-xs text-muted-foreground">{o.by} · <Status value={o.status} /></span></li>)}</ul> : <Empty>No override requests.</Empty>}
            <p className="mt-3 text-xs text-muted-foreground">Decide overrides in the Approvals queue on Help — the approver must differ from the requester.</p></Panel>
        </div>
      )}</Loadable>
    </>
  );
}

export function StudentAccounts() {
  const s = useLoad(() => staff({ action: 'accounts' }));
  const [reason, setReason] = useState('');
  return (
    <>
      <PageHeader eyebrow="Staff · Finance" title="Student accounts" sub="Holds, official balances and payment plan requests. Releasing a hold needs a second approver; Semester never processes payments." />
      <Scope see="holds across your institution" approve="nothing on your own — releases need a second person" cannot="take or refund payments" />
      <Loadable state={s}>{(d) => (
        <Panel title="Holds">
          {d.holds.length ? <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Student</th><th>Hold</th><th>Office</th><th>Status</th><th /></tr></thead><tbody>{d.holds.map((h: { id: string; student: string; title: string; office: string; status: string; source: string; releasePending: boolean }) => (
            <tr key={h.id} className="border-t border-border"><td className="py-2">{h.student}</td><td>{h.title} <SourceTag source={h.source || 'Official'} /></td><td>{h.office}</td><td><Status value={h.status === 'Open' ? 'Hold' : h.status} /></td>
              <td className="text-right">{h.status === 'Open' && (h.releasePending ? <span className="text-xs text-muted-foreground">… Pending second approver</span> : (
                <ConfirmAction trigger={<Button size="sm" variant="outline">Request release</Button>} title={`Release ${h.title}?`} confirmLabel="Send for approval" onConfirm={() => run(() => staff({ action: 'requestHoldRelease', holdId: h.id, reason: reason || 'Balance resolved' }), 'Release requested. A second approver decides in Approvals.', s.reload)}>
                  <ActionPreview says="A release request goes to the approvals queue. The hold stays until someone other than you approves it." stays="The student’s balance and records in your finance system." recovery={{ kind: 'request', how: 'the approver can reject it.' }} />
                  <Textarea rows={2} placeholder="Reason (e.g. balance paid in TouchNet on 20 Oct)" value={reason} onChange={(e) => setReason(e.target.value)} />
                </ConfirmAction>))}</td></tr>))}</tbody></table> : <Empty>No holds on file.</Empty>}
        </Panel>
      )}</Loadable>
      <PaymentPlansPanel />
    </>
  );
}

export function StudentAffairs() {
  const s = useLoad(() => staff({ action: 'affairs' }));
  const [cat, setCat] = useState('All');
  return (
    <>
      <PageHeader eyebrow="Staff · Student affairs" title="Support requests" sub="Service requests, referrals and moderation reports. Every record view is logged." />
      <Loadable state={s}>{(d) => {
        const cats = ['All', 'Service Request', 'Referral', 'Academic', 'Moderation Report'];
        const rows = d.cases.filter((c: { category: string }) => cat === 'All' || c.category === cat);
        return (
          <Panel action={<Select value={cat} onValueChange={setCat}><SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger><SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>} title={`${rows.filter((c: { status: string }) => c.status !== 'Resolved').length} open`}>
            {rows.length ? <ul>{rows.map((c: { id: string; title: string; category: string; status: string; reference: string; student: string; assignedTo: string; notes: string; mine: boolean }) => (
              <li key={c.id} className="border-b border-border py-3 text-sm last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{c.title} <span className="font-mono text-xs text-muted-foreground">{c.reference}</span></span><Status value={c.status} /></div>
                <p className="text-xs text-muted-foreground">{c.category} · {c.student} · Assigned: {c.assignedTo}</p>
                {c.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{c.notes}</p>}
                {c.status !== 'Resolved' && <div className="mt-2 flex gap-2">
                  {c.mine
                    ? <span className="text-xs text-muted-foreground">Yours · record a term review or close it with an outcome from your caseload (Help › Advising)</span>
                    : c.assignedTo === 'Unassigned'
                      ? <Button size="sm" variant="outline" onClick={() => run(() => help({ action: 'claim', id: c.id }), 'Claimed. It is in your caseload.', s.reload)}>Claim</Button>
                      : <span className="text-xs text-muted-foreground">○ Assigned to {c.assignedTo} · view only</span>}
                </div>}
              </li>))}</ul> : <Empty>No requests in this category.</Empty>}
          </Panel>
        );
      }}</Loadable>
    </>
  );
}
