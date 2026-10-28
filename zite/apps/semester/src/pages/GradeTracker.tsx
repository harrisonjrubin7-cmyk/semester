import { useState } from 'react';
import { toast } from 'sonner';
import { gradeTracker } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { computeCourse, computeGpa, CoursePlan, DEFAULT_THRESHOLDS, STATUSES, GpaCourse, Prior } from '../lib/gradeCalc';

/* eslint-disable @typescript-eslint/no-explicit-any */
const words = (s: string) => s.replace(/_/g, ' ');
const sel = 'rounded-md border border-border bg-background p-1.5 text-sm';
const uid = () => Math.random().toString(36).slice(2, 10);
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const newCourse = (name: string): Omit<CoursePlan, 'id' | 'name'> => ({
  credits: 3, mode: 'weighted', missingPolicy: 'exclude', extraCredit: false, thresholds: DEFAULT_THRESHOLDS, unsupportedRules: [],
  categories: [{ id: 'c1', name: 'Assignments', weight: 50 }, { id: 'c2', name: 'Exams', weight: 50 }],
  assignments: [{ id: uid(), name: `${name} — first assignment`, category: 'c1', status: 'not_started', earned: null, possible: 100, whatIf: null }],
});

function Result({ r, title }: { r: ReturnType<typeof computeCourse>; title: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl tabular-nums">{r.estimate === null ? '—' : `${r.estimate}%`}{r.letter && r.valid ? <span className="ml-2 text-base">{r.letter}</span> : null}</p>
      <p className="text-xs">{r.label}</p>
      {r.coverage !== null && <p className="text-xs text-muted-foreground">Weight covered by graded work: {Math.round(r.coverage * 100)}%</p>}
      {r.errors.map((e, i) => <p key={i} className="text-xs font-medium">! {e}</p>)}
    </div>
  );
}

function CourseEditor({ plan, official, reload }: { plan: any; official: any[]; reload: () => void }) {
  const [p, setP] = useState<CoursePlan>({ id: String(plan.id), name: plan.name, ...plan.doc });
  const [confirmDel, setConfirmDel] = useState(false);
  const [rule, setRule] = useState('');
  const base = computeCourse(p), what = computeCourse(p, true);
  const delta = base.estimate !== null && what.estimate !== null ? Math.round((what.estimate - base.estimate) * 100) / 100 : null;
  const off = official.find((o) => o.code && p.name.toUpperCase().includes(o.code.toUpperCase()));
  const set = (patch: Partial<CoursePlan>) => setP({ ...p, ...patch });
  const setA = (id: string, patch: any) => set({ assignments: p.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const setC = (id: string, patch: any) => set({ categories: p.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const save = async () => { try { const { id, name, ...doc } = p; await gradeTracker({ action: 'saveCourse', id: Number(id), name, doc: doc as any, expectedVersion: plan.version }); toast('Saved. Planning only; no official grade changed.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const del = async () => {
    try { await gradeTracker({ action: 'delete', id: plan.id, expectedVersion: plan.version });
      toast('Plan deleted.', { action: { label: 'Undo', onClick: async () => { try { await gradeTracker({ action: 'delete', id: plan.id, expectedVersion: plan.version + 1, restore: true }); toast('Restored.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } } } }); reload();
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Course<Input className="mt-1" value={p.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="text-xs">Credits<Input className="mt-1 w-20" type="number" min={0} max={12} value={p.credits} onChange={(e) => set({ credits: Number(e.target.value) })} /></label>
        <label className="text-xs">Grading<select className={`mt-1 block ${sel}`} value={p.mode} onChange={(e) => set({ mode: e.target.value as never })}><option value="weighted">Weighted categories</option><option value="points">Total points</option></select></label>
        <label className="text-xs">Missing work<select className={`mt-1 block ${sel}`} value={p.missingPolicy} onChange={(e) => set({ missingPolicy: e.target.value as never })}><option value="exclude">Leave out</option><option value="zero">Count as zero</option></select></label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.extraCredit} onChange={(e) => set({ extraCredit: e.target.checked })} />Allow extra credit above possible</label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Result r={base} title="Baseline (real scores)" />
        <Result r={what} title="What-if scenario" />
        <div className="min-w-0 rounded-md border border-border p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difference and official grade</p>
          <p className="mt-1 text-2xl tabular-nums">{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta} pts`}</p>
          <p className="text-xs">{off ? `Official released grade: ${off.grade} (read-only)` : 'No released official grade for this course.'}</p>
        </div>
      </div>
      {p.mode === 'weighted' && (
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left text-xs font-medium">Categories</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th>Name</th><th>Weight %</th><th>Score so far</th><th /></tr></thead>
          <tbody>{p.categories.map((c) => { const r = base.categories.find((x) => x.id === c.id); return (
            <tr key={c.id} className="border-t border-border"><td><Input aria-label="Category name" value={c.name} onChange={(e) => setC(c.id, { name: e.target.value })} /></td>
              <td><Input aria-label={`Weight of ${c.name}`} className="w-20" type="number" min={0} max={100} value={c.weight ?? ''} onChange={(e) => setC(c.id, { weight: numOrNull(e.target.value) })} /></td>
              <td className="tabular-nums">{r?.score === null || r === undefined ? 'no graded work' : `${Math.round(r.score * 100) / 100}% (${r.earned}/${r.possible})`}</td>
              <td><Button size="sm" variant="ghost" aria-label={`Remove category ${c.name}`} disabled={p.assignments.some((a) => a.category === c.id)} onClick={() => set({ categories: p.categories.filter((x) => x.id !== c.id) })}>Remove</Button></td></tr>); })}</tbody></table>
          <Button size="sm" variant="outline" onClick={() => set({ categories: [...p.categories, { id: uid(), name: 'New category', weight: 0 }] })}>Add category</Button></div>
      )}
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left text-xs font-medium">Assignments</caption>
        <thead><tr className="text-left text-xs text-muted-foreground"><th>Name</th><th>Category</th><th>Status</th><th>Earned</th><th>Possible</th><th>What-if</th><th /></tr></thead>
        <tbody>{p.assignments.map((a) => (
          <tr key={a.id} className="border-t border-border">
            <td><Input aria-label="Assignment name" value={a.name} onChange={(e) => setA(a.id, { name: e.target.value })} /></td>
            <td><select aria-label="Category" className={sel} value={a.category} onChange={(e) => setA(a.id, { category: e.target.value })}>{p.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
            <td><select aria-label="Status" className={sel} value={a.status} onChange={(e) => setA(a.id, { status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{words(s)}</option>)}</select></td>
            <td><Input aria-label="Earned points" className="w-20" type="number" value={a.earned ?? ''} disabled={a.status !== 'graded'} onChange={(e) => setA(a.id, { earned: numOrNull(e.target.value) })} /></td>
            <td><Input aria-label="Possible points" className="w-20" type="number" min={0} value={a.possible} onChange={(e) => setA(a.id, { possible: Number(e.target.value) })} /></td>
            <td><Input aria-label="What-if score" className="w-20" type="number" value={a.whatIf ?? ''} disabled={a.status === 'graded' || a.status === 'excused'} onChange={(e) => setA(a.id, { whatIf: numOrNull(e.target.value) })} /></td>
            <td><Button size="sm" variant="ghost" aria-label={`Remove ${a.name}`} onClick={() => set({ assignments: p.assignments.filter((x) => x.id !== a.id) })}>Remove</Button></td>
          </tr>))}</tbody></table>
        <Button size="sm" variant="outline" disabled={!p.categories.length} onClick={() => set({ assignments: [...p.assignments, { id: uid(), name: 'New assignment', category: p.categories[0].id, status: 'not_started', earned: null, possible: 100, whatIf: null }] })}>Add assignment</Button></div>
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label>Syllabus rule the calculator cannot apply<Input className="mt-1" placeholder="e.g. Drop the lowest quiz" value={rule} onChange={(e) => setRule(e.target.value)} /></label>
        <Button size="sm" variant="outline" disabled={rule.trim().length < 3} onClick={() => { set({ unsupportedRules: [...p.unsupportedRules, rule.trim()] }); setRule(''); }}>Record limitation</Button>
        {p.unsupportedRules.map((u, i) => <Button key={i} size="sm" variant="ghost" aria-label={`Remove limitation ${u}`} onClick={() => set({ unsupportedRules: p.unsupportedRules.filter((_, j) => j !== i) })}>{u} ×</Button>)}
      </div>
      <details><summary className="cursor-pointer text-xs font-medium">How this was calculated</summary>
        <ul className="mt-1 list-disc pl-5 text-xs">{base.breakdown.map((b, i) => <li key={i}>{b}</li>)}{base.rejected.map((b, i) => <li key={`r${i}`}>Rejected: {b}</li>)}</ul>
        <p className="mt-1 text-xs font-medium">Assumptions</p><ul className="list-disc pl-5 text-xs">{what.assumptions.map((b, i) => <li key={i}>{b}</li>)}</ul>
        {base.limitations.length > 0 && <><p className="mt-1 text-xs font-medium">Limitations</p><ul className="list-disc pl-5 text-xs">{base.limitations.map((b, i) => <li key={i}>{b}</li>)}</ul></>}
      </details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>Save plan</Button>
        {confirmDel ? <><Button size="sm" variant="outline" onClick={del}>Delete “{p.name}”</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>Keep it</Button></>
          : <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)}>Delete plan…</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Last saved {fmt(plan.updatedAt)}. Your edits are private planning data and never change an official grade.</p>
    </div>
  );
}

function Gpa({ d, reload }: { d: any; reload: () => void }) {
  const plan = d.plans.find((x: any) => x.kind === 'gpa');
  const seed = { prior: d.priorExact.credits > 0 ? ({ mode: 'exact', ...d.priorExact } as Prior) : null, courses: d.current.map((c: any) => ({ name: c.code || c.title, credits: c.credits, grade: '', basis: 'graded' })) as GpaCourse[] };
  const [g, setG] = useState<{ prior: Prior; courses: GpaCourse[] }>(plan?.doc ?? seed);
  const r = computeGpa(g.courses, g.prior, d.scale);
  const save = async () => { try { await gradeTracker({ action: 'saveGpa', id: plan?.id ?? null, name: 'GPA scenario', doc: g as any, expectedVersion: plan?.version ?? 0 }); toast('Scenario saved.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const setC = (i: number, patch: Partial<GpaCourse>) => setG({ ...g, courses: g.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <Panel title="GPA simulator">
      <p className="text-xs font-medium">Planning estimate — not an official transcript calculation.</p>
      {d.policyLabel && <p className="text-xs text-muted-foreground">Grade points from {d.policyLabel}{d.policySource === 'sample' ? ' (your institution has not approved its own policy yet)' : ''}. Repeat rules are not applied to estimates.</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Term GPA</p><p className="text-2xl tabular-nums">{r.term ?? '—'}</p></div>
        <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Projected cumulative{r.approximate ? ' (approximate)' : ''}</p><p className="text-2xl tabular-nums">{r.cumulative ?? '—'}</p></div>
        <div className="rounded-md border border-border p-3 text-xs">{g.prior ? (g.prior.mode === 'exact' ? `Starting from your released record: ${g.prior.qualityPoints} quality points over ${g.prior.credits} credits.` : `Starting from a rounded GPA of ${g.prior.gpa} over ${g.prior.credits} credits, so the result is approximate.`) : 'No prior GPA-bearing credits.'}</div>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Course</th><th>Credits</th><th>Expected grade</th><th>Counts toward GPA</th><th /></tr></thead>
        <tbody>{g.courses.map((c, i) => (
          <tr key={i} className="border-t border-border"><td><Input aria-label="Course" value={c.name} onChange={(e) => setC(i, { name: e.target.value })} /></td>
            <td><Input aria-label="Credits" className="w-20" type="number" min={0} max={12} value={c.credits} onChange={(e) => setC(i, { credits: Number(e.target.value) })} /></td>
            <td><select aria-label="Expected grade" className={sel} value={c.grade} onChange={(e) => setC(i, { grade: e.target.value })}><option value="">—</option>{Object.keys(d.scale).map((l) => <option key={l}>{l}</option>)}</select></td>
            <td><select aria-label="Basis" className={sel} value={c.basis} onChange={(e) => setC(i, { basis: e.target.value as never })}><option value="graded">Graded</option><option value="pass_fail">Pass/fail (not counted)</option><option value="excluded">Leave out</option></select></td>
            <td><Button size="sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => setG({ ...g, courses: g.courses.filter((_, j) => j !== i) })}>Remove</Button></td></tr>))}</tbody></table></div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setG({ ...g, courses: [...g.courses, { name: 'Course', credits: 3, grade: '', basis: 'graded' }] })}>Add course</Button>
        <Button size="sm" variant="ghost" onClick={() => setG(seed)}>Reset to my record</Button>
        <Button size="sm" onClick={save}>Save scenario</Button>
      </div>
      <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Included and excluded courses</summary>
        <ul className="mt-1 list-disc pl-5 text-xs">{r.included.map((x, i) => <li key={i}>Included: {x}</li>)}{r.excluded.map((x, i) => <li key={`e${i}`}>Excluded: {x}</li>)}{r.errors.map((x, i) => <li key={`r${i}`}>! {x}</li>)}</ul>
        <p className="mt-1 text-xs text-muted-foreground">{r.note}</p></details>
    </Panel>
  );
}

export default function GradeTracker() {
  const s = useLoad(() => gradeTracker({ action: 'get' }));
  const [open, setOpen] = useState<number | null>(null);
  const [name, setName] = useState('');
  const add = async () => { try { const r: any = await gradeTracker({ action: 'saveCourse', id: null, name, doc: newCourse(name) as any }); setOpen(r.result?.id ?? null); setName(''); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <>
      <PageHeader eyebrow="Progress" title="What-if grade tracker" sub="Track your scores, try what-if scores and plan your GPA. Private to you; it never changes an official grade." />
      <Loadable state={s}>{(d: any) => {
        const courses = d.plans.filter((p: any) => p.kind === 'course');
        return (
          <div className="space-y-4">
            <Panel title={`My courses · ${courses.length}`}>
              {courses.length ? <ul className="space-y-2">{courses.map((p: any) => { const r = computeCourse({ id: String(p.id), name: p.name, ...p.doc }); return (
                <li key={p.id} className="rounded-md border border-border p-3">
                  <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                    <span className="font-medium">{p.name}</span><Status value={r.estimate === null ? r.label : `${r.estimate}%${r.letter && r.valid ? ` ${r.letter}` : ''} · ${r.valid ? 'estimate' : 'check weights'}`} /></button>
                  {open === p.id && <div className="mt-3"><CourseEditor key={`${p.id}-${p.version}`} plan={p} official={d.official} reload={s.reload} /></div>}
                </li>); })}</ul> : <Empty>Add a course to start tracking your scores.</Empty>}
              <div className="mt-3 flex gap-2"><Input aria-label="Course name" placeholder="Course, e.g. ECON 1010" value={name} onChange={(e) => setName(e.target.value)} /><Button size="sm" disabled={!name.trim()} onClick={add}>Add course</Button></div>
            </Panel>
            <Gpa key={d.plans.find((x: any) => x.kind === 'gpa')?.version ?? 0} d={d} reload={s.reload} />
            {d.official.length > 0 && <Panel title="Official released grades (read-only)"><ul className="space-y-1 text-sm">{d.official.map((o: any, i: number) => <li key={i}>{o.code} {o.title} · {o.term} · {o.credits} cr · {o.grade}{o.gpaBearing ? '' : ' (not GPA-bearing)'}</li>)}</ul></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
