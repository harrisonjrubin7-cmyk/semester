import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { curriculum } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { syllabusBlocker, CODE_RE, Assessment } from '../lib/curriculumRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE: Record<string, string> = {
  submitted: 'With the department chair', chair_endorsed: 'With the curriculum committee', committee_approved: 'Filed to the catalog', returned: 'Returned for changes', withdrawn: 'Withdrawn',
  proposed: 'waiting for registrar publication', approved: 'published', rejected: 'not published by the registrar', superseded: 'superseded by a later version',
};
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';

function Propose({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ departmentId: d.departments.find((x: any) => x.chair)?.id ?? 0, code: '', title: '', credits: 3, description: '', effectiveTerm: '', rationale: '' });
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>(['']);
  const [assess, setAssess] = useState<Assessment[]>([{ name: 'Final project', weight: 100 }]);
  const [weeks, setWeeks] = useState(15);
  const [policies, setPolicies] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const syl = { weeks, assessments: assess, policies };
  const block = !CODE_RE.test(f.code.trim().toUpperCase()) ? 'Use a course code like HIST 214.' : f.title.trim().length < 3 ? 'Add a title.' : f.description.trim().length < 20 ? 'Write a catalog description (20+ characters).'
    : f.rationale.trim().length < 20 ? 'Explain why the course is needed (20+ characters).' : f.effectiveTerm.trim().length < 3 ? 'Say which term it takes effect.' : syllabusBlocker(syl, outcomes.filter((o) => o.trim()));
  const send = async () => {
    try {
      const r: any = await curriculum({ action: 'submit', requestKey: key, ...f, code: f.code.trim().toUpperCase(), prereqs, outcomes: outcomes.filter((o) => o.trim()), syllabus: syl });
      toast(r.result?.replayed ? 'Already sent.' : 'Sent to the department chair.'); setKey(crypto.randomUUID()); reload();
    } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">Department<select className={sel} value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: Number(e.target.value) })}>
          {d.departments.map((x: any) => <option key={x.id} value={x.id} disabled={!x.chair}>{x.name}{x.chair ? ` · chair ${x.chair}` : ' · no chair yet'}</option>)}</select></label>
        <label className="text-xs">Course code<Input className="mt-1" placeholder="ECON 3010" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
        <label className="text-xs">Title<Input className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-xs">Credits<Input className="mt-1" type="number" min={0.5} max={12} step={0.5} value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) })} /></label>
        <label className="text-xs">Takes effect<Input className="mt-1" placeholder="Fall 2027" value={f.effectiveTerm} onChange={(e) => setF({ ...f, effectiveTerm: e.target.value })} /></label>
        <label className="text-xs">Weeks<Input className="mt-1" type="number" min={1} max={30} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></label>
        <label className="text-xs sm:col-span-3">Catalog description<Textarea className="mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="text-xs sm:col-span-3">Why it is needed (reviewers read this)<Textarea className="mt-1" value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} /></label>
      </div>
      <fieldset><legend className="text-xs font-medium">Prerequisites (published courses only)</legend>
        <div className="mt-1 flex flex-wrap gap-2">{prereqs.map((p) => <Button key={p} size="sm" variant="outline" aria-label={`Remove prerequisite ${p}`} onClick={() => setPrereqs(prereqs.filter((x) => x !== p))}>{p} ×</Button>)}
          <select aria-label="Add prerequisite" className="rounded-md border border-border bg-background p-2 text-sm" value="" onChange={(e) => e.target.value && setPrereqs([...prereqs, e.target.value])}>
            <option value="">Add…</option>{d.catalogCodes.filter((c: string) => !prereqs.includes(c)).map((c: string) => <option key={c} value={c}>{c}</option>)}</select></div></fieldset>
      <fieldset><legend className="text-xs font-medium">Learning outcomes</legend>
        {outcomes.map((o, i) => <div key={i} className="mt-1 flex gap-2"><Input aria-label={`Outcome ${i + 1}`} placeholder="Students will be able to…" value={o} onChange={(e) => setOutcomes(outcomes.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button size="sm" variant="ghost" aria-label={`Remove outcome ${i + 1}`} disabled={outcomes.length === 1} onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>Remove</Button></div>)}
        <Button size="sm" variant="outline" className="mt-1" disabled={outcomes.length >= 12} onClick={() => setOutcomes([...outcomes, ''])}>Add outcome</Button></fieldset>
      <fieldset><legend className="text-xs font-medium">Assessments (weights total {assess.reduce((t, a) => t + a.weight, 0)}%)</legend>
        {assess.map((a, i) => <div key={i} className="mt-1 grid grid-cols-[1fr_6rem_auto] gap-2"><Input aria-label={`Assessment ${i + 1}`} value={a.name} onChange={(e) => setAssess(assess.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input aria-label={`Weight ${i + 1}`} type="number" min={1} max={100} value={a.weight} onChange={(e) => setAssess(assess.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
          <Button size="sm" variant="ghost" aria-label={`Remove assessment ${i + 1}`} disabled={assess.length === 1} onClick={() => setAssess(assess.filter((_, j) => j !== i))}>Remove</Button></div>)}
        <Button size="sm" variant="outline" className="mt-1" disabled={assess.length >= 12} onClick={() => setAssess([...assess, { name: '', weight: 0 }])}>Add assessment</Button></fieldset>
      <label className="block text-xs">Course policies<Textarea className="mt-1" placeholder="Attendance, late work, academic integrity, accessibility statement" value={policies} onChange={(e) => setPolicies(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={!!block} onClick={send}>Send for review</Button>{block && <span className="text-xs text-muted-foreground">{block}</span>}</div>
    </div>
  );
}

function Card({ p, reload }: { p: any; reload: () => void }) {
  const [note, setNote] = useState('');
  const act = async (step: 'endorse' | 'approve' | 'return' | 'withdraw') => { try { await curriculum({ action: 'step', id: p.id, step, expectedVersion: p.version, note }); toast('Recorded.'); setNote(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const label = { endorse: 'Endorse as chair', approve: 'Approve for the committee', return: 'Return for changes', withdraw: 'Withdraw' } as const;
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.code} · {p.title} · {p.credits} cr · {p.dept}</span>
        <Status value={`${STATE[p.state] ?? p.state}${p.catalog ? ` — ${STATE[p.catalog.state] ?? p.catalog.state}` : ''}`} /></div>
      <p className="text-xs text-muted-foreground">By {p.role === 'author' ? 'you' : p.author} · takes effect {p.effectiveTerm} · updated {fmt(p.updatedAt)}</p>
      <details className="mt-1"><summary className="cursor-pointer text-xs">Proposal details</summary>
        <div className="mt-1 space-y-1 text-xs"><p>{p.description}</p><p><span className="font-medium">Why:</span> {p.rationale}</p>
          <p><span className="font-medium">Prerequisites:</span> {p.prereqs.length ? p.prereqs.join(', ') : 'none'}</p>
          <p className="font-medium">Outcomes</p><ol className="list-decimal pl-5">{p.outcomes.map((o: string, i: number) => <li key={i}>{o}</li>)}</ol>
          <p className="font-medium">Syllabus: {p.syllabus.weeks} weeks</p><ul className="list-disc pl-5">{p.syllabus.assessments.map((a: any, i: number) => <li key={i}>{a.name} — {a.weight}%</li>)}</ul>
          <p className="whitespace-pre-wrap">{p.syllabus.policies}</p></div></details>
      {p.note && <p className="mt-1 text-xs">Reviewer note: {p.note}</p>}
      {p.steps.length > 0 && <div className="mt-2 space-y-2">
        {p.steps.includes('return') && <Input aria-label="Note to the author" placeholder="Note to the author (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} />}
        <div className="flex flex-wrap gap-2">{p.steps.map((s: keyof typeof label) => <Button key={s} size="sm" variant={s === 'return' || s === 'withdraw' ? 'outline' : 'default'} disabled={s === 'return' && note.trim().length < 10} onClick={() => act(s)}>{label[s]}</Button>)}</div>
      </div>}
      {p.catalog?.state === 'proposed' && <p className="mt-1 text-xs text-muted-foreground">A registrar other than the author publishes it on the <Link className="underline" to="/staff/catalog">Catalog</Link> page.</p>}
    </li>
  );
}

function Committee({ d, reload }: { d: any; reload: () => void }) {
  const [email, setEmail] = useState('');
  const set = async (on: boolean) => { try { await curriculum({ action: 'setCommittee', email, on }); toast('Saved.'); setEmail(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Curriculum committee">
      {d.committee.length ? <ul className="mb-2 space-y-1 text-sm">{d.committee.map((c: any, i: number) => <li key={i}>{c.name}</li>)}</ul> : <Empty>No members yet. Endorsed proposals wait until someone is added.</Empty>}
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={!email.includes('@')} onClick={() => set(true)}>Add</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => set(false)}>Remove</Button></div>
    </Panel>
  );
}

export default function Curriculum() {
  const s = useLoad(() => curriculum({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Institution" title="Curriculum" sub="Course proposals move from faculty to the department chair, then the curriculum committee, then the registrar publishes them in the catalog." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.proposals.filter((p: any) => p.role === 'author');
        const review = d.proposals.filter((p: any) => p.role !== 'author');
        return (
          <div className="space-y-4">
            {review.length > 0 && <Panel title={`To review · ${review.filter((p: any) => p.steps.length).length}`}><ul className="space-y-2">{review.map((p: any) => <Card key={p.id} p={p} reload={s.reload} />)}</ul></Panel>}
            {d.isFaculty && <Panel title="My proposals">{mine.length ? <ul className="space-y-2">{mine.map((p: any) => <Card key={p.id} p={p} reload={s.reload} />)}</ul> : <Empty>You have not proposed a course.</Empty>}</Panel>}
            {d.isFaculty && (d.departments.some((x: any) => x.chair) ? <Panel title="Propose a course or a new version"><Propose d={d} reload={s.reload} /></Panel>
              : <Panel title="Propose a course"><Empty>No department has a chair yet. An administrator sets chairs on the Section requests page.</Empty></Panel>)}
            {!d.isFaculty && !review.length && <Empty>Nothing here for your role yet.</Empty>}
            {d.isAdmin && <Committee d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
