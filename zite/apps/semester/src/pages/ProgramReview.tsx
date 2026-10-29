import { useState } from 'react';
import { toast } from 'sonner';
import { programReview } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Act = { action: string; finding: number; owner: string; due: string };
type Review = { id: number; code: string; program: string; dept: string; cycle: string; due: string; state: string; rev: number; isChair: boolean; isDean: boolean;
  selfStudy: Record<string, string>; selfStudyBy: string | null; selfStudyAt: string | null; reviewer: { name: string; affiliation: string; noConflict: boolean } | null;
  report: string | null; findings: string[]; recommendation: string | null; reportBy: string | null; plan: Act[]; planHash: string | null; planBy: string | null; planMine: boolean; planDecidedBy: string | null; planNote: string;
  closeNote: string; openedBy: string | null; closedBy: string | null; actions: { idx: number; action: string; finding: number; owner: string; due: string; done: boolean; doneNote: string | null; overdue: boolean }[] };
type Data = { isAdmin: boolean; sections: readonly string[]; openable: { code: string; name: string; dept: string }[]; reviews: Review[] };

const label = (s: string) => s.replace(/_/g, ' ');
const STEPS = ['self_study', 'external_review', 'action_plan', 'plan_submitted', 'plan_approved', 'closed'];
const sel = 'h-8 rounded-md border bg-background px-2 text-sm';

function ReviewCard({ r, d, reload }: { r: Review; d: Data; reload: () => void }) {
  const go = async (step: string, extra: Record<string, unknown>, ok: string) => { try { await programReview({ action: 'step', id: r.id, expectedVersion: r.rev, step, ...extra } as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
  const [secs, setSecs] = useState<Record<string, string>>(r.selfStudy);
  const [rev, setRev] = useState({ name: r.reviewer?.name ?? '', affiliation: r.reviewer?.affiliation ?? '', noConflict: r.reviewer?.noConflict ?? false });
  const [rep, setRep] = useState({ report: '', findings: [''], recommendation: 'continue' });
  const [plan, setPlan] = useState<Act[]>(r.plan.length ? r.plan : r.findings.map((_, i) => ({ action: '', finding: i, owner: '', due: '' })));
  const [note, setNote] = useState('');
  const at = STEPS.indexOf(r.state);
  return (
    <Panel title={`${r.program} (${r.code}) · ${r.cycle}`} action={<Status value={label(r.state)} />}>
      <p className="text-xs text-muted-foreground">{r.dept} · opened by {r.openedBy} · self-study due {r.due}</p>
      <ol className="my-2 flex flex-wrap gap-2 text-xs" aria-label="Review progress">{STEPS.map((s, i) => <li key={s} className={i <= at ? 'font-medium' : 'text-muted-foreground'}>{i < at ? '✓' : i === at ? '●' : '○'} {label(s)}</li>)}</ol>

      <h3 className="mt-2 text-sm font-medium">Self-study</h3>
      {r.state === 'self_study' && r.isChair ? <div className="space-y-2">{d.sections.map((s) => <div key={s}><Label htmlFor={`s-${r.id}-${s}`}>{label(s)}</Label>
        <Textarea id={`s-${r.id}-${s}`} rows={3} value={secs[s] ?? ''} onChange={(e) => setSecs({ ...secs, [s]: e.target.value })} /></div>)}
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => go('save_self_study', { sections: secs }, 'Saved')}>Save</Button>
          <Button size="sm" onClick={() => go('submit_self_study', { sections: secs }, 'Self-study submitted to the dean')}>Submit self-study</Button></div>
        <p className="text-xs text-muted-foreground">Each section needs at least 50 characters before you submit.</p></div>
        : Object.keys(r.selfStudy).length ? <dl className="text-sm">{d.sections.map((s) => <div key={s} className="mt-1"><dt className="text-xs font-medium">{label(s)}</dt><dd className="whitespace-pre-wrap">{r.selfStudy[s] || '—'}</dd></div>)}
          <p className="text-xs text-muted-foreground">{r.selfStudyAt ? `Submitted ${fmt(r.selfStudyAt)} by ${r.selfStudyBy}` : 'Draft'}</p></dl> : <Empty>The department chair has not started the self-study.</Empty>}

      {at >= 1 && <><h3 className="mt-3 text-sm font-medium">External review</h3>
        {r.state === 'external_review' && r.isDean ? <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Input aria-label="Reviewer name" className="h-8 w-56" placeholder="Reviewer name" value={rev.name} onChange={(e) => setRev({ ...rev, name: e.target.value })} />
            <Input aria-label="Reviewer affiliation" className="h-8 w-56" placeholder="Affiliation" value={rev.affiliation} onChange={(e) => setRev({ ...rev, affiliation: e.target.value })} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={rev.noConflict} onChange={(e) => setRev({ ...rev, noConflict: e.target.checked })} />The reviewer declared no conflict of interest</label>
            <Button size="sm" variant="outline" onClick={() => go('set_reviewer', rev, 'Reviewer recorded')}>Save reviewer</Button></div>
          {r.reviewer && <div className="space-y-2"><Textarea aria-label="Reviewer's report" rows={5} placeholder="Paste the reviewer's full report" value={rep.report} onChange={(e) => setRep({ ...rep, report: e.target.value })} />
            {rep.findings.map((f, i) => <Input key={i} aria-label={`Finding ${i + 1}`} className="h-8" placeholder={`Finding ${i + 1}`} value={f} onChange={(e) => setRep({ ...rep, findings: rep.findings.map((x, j) => (j === i ? e.target.value : x)) })} />)}
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setRep({ ...rep, findings: [...rep.findings, ''] })}>Add finding</Button>
              <select aria-label="Recommendation" className={sel} value={rep.recommendation} onChange={(e) => setRep({ ...rep, recommendation: e.target.value })}>{['continue', 'continue_with_conditions', 'revise', 'consider_closure'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
              <Button size="sm" onClick={() => go('record_report', { ...rep, findings: rep.findings.filter((x) => x.trim()) }, 'Report recorded; the chair writes the action plan')}>Record report</Button></div></div>}
          <p className="text-xs text-muted-foreground">Semester records the reviewer; contacting them happens outside the platform.</p></div>
          : r.reviewer ? <div className="text-sm"><p>{r.reviewer.name}, {r.reviewer.affiliation} · {r.reviewer.noConflict ? 'declared no conflict' : 'conflict declaration missing'}</p>
            {r.report && <><p className="mt-1 whitespace-pre-wrap">{r.report}</p><ol className="ml-4 mt-1 list-decimal">{r.findings.map((f, i) => <li key={i}>{f}</li>)}</ol>
              <p className="text-xs">Recommendation (advisory): <span className="font-medium">{label(r.recommendation ?? '')}</span> · recorded by {r.reportBy}</p></>}</div> : <Empty>Waiting for the dean to record the external reviewer.</Empty>}</>}

      {at >= 2 && <><h3 className="mt-3 text-sm font-medium">Action plan</h3>
        {r.planNote && r.state === 'action_plan' && <p className="text-xs">Returned: “{r.planNote}”</p>}
        {r.state === 'action_plan' && r.isChair ? <div className="space-y-2">{plan.map((p, i) => <div key={i} className="flex flex-wrap gap-2">
          <select aria-label={`Finding for action ${i + 1}`} className={sel} value={p.finding} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, finding: Number(e.target.value) } : x)))}>{r.findings.map((f, k) => <option key={k} value={k}>Finding {k + 1}</option>)}</select>
          <Input aria-label={`Action ${i + 1}`} className="h-8 flex-1" placeholder="Action" value={p.action} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))} />
          <Input aria-label={`Owner for action ${i + 1}`} className="h-8 w-40" placeholder="Owner" value={p.owner} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))} />
          <Input aria-label={`Due date for action ${i + 1}`} type="date" className="h-8 w-40" value={p.due} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} /></div>)}
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setPlan([...plan, { action: '', finding: 0, owner: '', due: '' }])}>Add action</Button>
            <Button size="sm" variant="outline" onClick={() => go('save_plan', { plan }, 'Saved')}>Save</Button>
            <Button size="sm" onClick={() => go('submit_plan', { plan }, 'Plan sent to the dean')}>Submit plan</Button></div>
          <p className="text-xs text-muted-foreground">Every finding needs at least one action with an owner and a due date.</p></div>
          : r.plan.length ? <ul className="ml-4 list-disc text-sm">{r.plan.map((p, i) => <li key={i}>Finding {p.finding + 1}: {p.action} — {p.owner}, due {p.due}</li>)}</ul> : <Empty>The chair has not written the action plan yet.</Empty>}
        {r.state === 'plan_submitted' && r.isDean && (r.planMine ? <p className="text-xs text-muted-foreground">You wrote this plan, so another dean decides it.</p> :
          <div className="mt-1 flex flex-wrap items-center gap-2"><Input aria-label="Plan decision note" className="h-8 w-72" placeholder="Note (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" onClick={() => go('approve_plan', { seen: r.planHash, note }, 'Plan approved; actions are now tracked')}>Approve this plan</Button>
            <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => go('return_plan', { seen: r.planHash, note }, 'Returned to the chair')}>Return</Button></div>)}</>}

      {r.actions.length > 0 && <><h3 className="mt-3 text-sm font-medium">Follow-up</h3>{r.actions.map((x) => <ActionRow key={x.idx} x={x} canMark={r.isChair && r.state === 'plan_approved'} done={(n) => go('action_done', { idx: x.idx, note: n }, 'Marked done')} />)}</>}
      {r.state === 'plan_approved' && r.isDean && <div className="mt-2 flex flex-wrap items-center gap-2"><Input aria-label="Closing note" className="h-8 w-80" placeholder="Closing note (needed if actions are still open)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => go('close', { note }, 'Review closed')}>Close review</Button></div>}
      {(r.state === 'closed' || r.state === 'cancelled') && <p className="mt-2 text-xs text-muted-foreground">{label(r.state)} by {r.closedBy}{r.closeNote ? ` — ${r.closeNote}` : ''}</p>}
    </Panel>
  );
}

function ActionRow({ x, canMark, done }: { x: Review['actions'][number]; canMark: boolean; done: (note: string) => Promise<boolean> }) {
  const [n, setN] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 border-t py-1 text-sm">
      <span className="flex-1">{x.done ? '✓' : x.overdue ? '▲' : '○'} {x.action} <span className="text-xs text-muted-foreground">— {x.owner}, due {x.due}{x.overdue ? ' (overdue)' : ''}{x.doneNote ? ` · ${x.doneNote}` : ''}</span></span>
      {canMark && !x.done && <><Input aria-label={`What was done for: ${x.action}`} className="h-8 w-60" placeholder="What was done" value={n} onChange={(e) => setN(e.target.value)} />
        <Button size="sm" variant="outline" disabled={n.trim().length < 10} onClick={() => done(n)}>Mark done</Button></>}
    </div>
  );
}

export default function ProgramReview() {
  const s = useLoad(() => programReview({ action: 'get' }) as Promise<Data>);
  const [f, setF] = useState({ code: '', cycle: '', due: '' });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Academic leadership" title="Program review" sub="Periodic review of published programs: self-study, external reviewer, action plan and follow-up. Recommendations are advisory and never change a program by themselves." />
      <Loadable state={s}>{(d: Data) => (<>
        {d.openable.length > 0 && <Panel title="Start a review"><div className="flex flex-wrap items-end gap-2">
          <div><Label htmlFor="pr-code">Program</Label><select id="pr-code" className={sel} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}><option value="">Choose…</option>{d.openable.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.dept})</option>)}</select></div>
          <div><Label htmlFor="pr-cycle">Cycle</Label><Input id="pr-cycle" className="h-8 w-24" placeholder="2026-27" value={f.cycle} onChange={(e) => setF({ ...f, cycle: e.target.value })} /></div>
          <div><Label htmlFor="pr-due">Self-study due</Label><Input id="pr-due" type="date" className="h-8" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
          <Button size="sm" disabled={!f.code} onClick={async () => { try { await programReview({ action: 'open', ...f }); toast.success('Review opened; the chair writes the self-study'); s.reload(); } catch (e) { toast.error(errMsg(e)); } }}>Open review</Button></div></Panel>}
        {d.reviews.length === 0 ? <Empty>No program reviews yet. A dean opens one for a published program in their college.</Empty> : d.reviews.map((r) => <ReviewCard key={`${r.id}-${r.rev}`} r={r} d={d} reload={s.reload} />)}
      </>)}</Loadable>
    </div>
  );
}
