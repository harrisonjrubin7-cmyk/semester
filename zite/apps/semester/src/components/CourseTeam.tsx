import { useState } from 'react';
import { toast } from 'sonner';
import { courseTeam } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, fmtDay, useLoad, Loadable, errMsg, ActionPreview } from './kit';
import { ConfirmAction } from './overlays';
import { validateRubric, rubricMax, Criterion } from '../lib/rubricRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const newCrit = (n: number): Criterion => ({ id: `c${n}`, name: '', levels: [{ label: 'Beginning', points: 0 }, { label: 'Meets', points: 5 }] });

function RubricEditor({ onPublish }: { onPublish: (key: string, title: string, cs: Criterion[]) => void }) {
  const [title, setTitle] = useState('');
  const [cs, setCs] = useState<Criterion[]>([newCrit(1)]);
  const set = (i: number, c: Criterion) => setCs(cs.map((x, j) => (j === i ? c : x)));
  const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const problem = key.length < 2 ? 'Give the rubric a title.' : validateRubric(title, cs);
  return (
    <div className="space-y-2 text-sm">
      <label className="text-xs">Title<Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      {cs.map((c, i) => (
        <fieldset key={i} className="rounded-md border border-border p-2">
          <legend className="px-1 text-xs text-muted-foreground">Criterion {i + 1}</legend>
          <Input aria-label={`Criterion ${i + 1} name`} placeholder="What is assessed" value={c.name} onChange={(e) => set(i, { ...c, name: e.target.value })} />
          {c.levels.map((l, k) => (
            <div key={k} className="mt-1 flex gap-2">
              <Input aria-label={`Level ${k + 1} label`} value={l.label} onChange={(e) => set(i, { ...c, levels: c.levels.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} />
              <Input aria-label={`Level ${k + 1} points`} type="number" className="w-24" value={l.points} onChange={(e) => set(i, { ...c, levels: c.levels.map((x, m) => (m === k ? { ...x, points: Number(e.target.value) } : x)) })} />
            </div>))}
          <div className="mt-1 flex gap-2">
            {c.levels.length < 6 && <Button size="sm" variant="ghost" onClick={() => set(i, { ...c, levels: [...c.levels, { label: '', points: 0 }] })}>Add level</Button>}
            {c.levels.length > 2 && <Button size="sm" variant="ghost" onClick={() => set(i, { ...c, levels: c.levels.slice(0, -1) })}>Remove last level</Button>}
            {cs.length > 1 && <Button size="sm" variant="ghost" onClick={() => setCs(cs.filter((_, j) => j !== i))}>Remove criterion</Button>}
          </div>
        </fieldset>))}
      <div className="flex flex-wrap items-center gap-2">
        {cs.length < 20 && <Button size="sm" variant="outline" onClick={() => setCs([...cs, newCrit(Math.max(0, ...cs.map((c) => Number(c.id.slice(1)) || 0)) + 1)])}>Add criterion</Button>}
        <span className="text-xs text-muted-foreground">Up to {cs.every((c) => c.levels.length) ? rubricMax(cs) : 0} points</span>
        {problem ? <span role="status" className="text-xs">! {problem}</span> : <Button size="sm" onClick={() => onPublish(key, title, cs)}>Publish rubric</Button>}
      </div>
    </div>
  );
}

/** Section tab: grading delegates and rubrics. Delegates see rubrics; only instructors change the team or publish. */
export default function CourseTeam({ sectionId }: { sectionId: string }) {
  const s = useLoad(() => courseTeam({ action: 'get', sectionId }), [sectionId]);
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(120);
  const call = async (body: any, ok: string) => { try { await courseTeam(body); toast(ok); s.reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-3">
        {d.role === 'instructor' && <Panel title="Grading delegates">
          <p className="mb-2 text-xs text-muted-foreground">A delegate can see submitted work and grade it in this section until the date you set. Delegates never release grades.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">Member's email<Input type="email" className="mt-1 w-64" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="text-xs">Days<Input type="number" min={1} max={180} className="mt-1 w-20" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
            <ConfirmAction trigger={<Button size="sm" disabled={!email.includes('@') || days < 1 || days > 180}>Delegate grading</Button>} title="Let this person grade in this section?" confirmLabel="Delegate" onConfirm={async () => { if (await call({ action: 'delegate', sectionId, email: email.trim(), days }, 'Delegated.')) setEmail(''); }}>
              <ActionPreview says={`They can read submitted work, assessment attempts and attached files in this section, and grade them, for ${days} days.`} stays="Releasing grades, changing the course and other sections." recovery={{ kind: 'undo', how: 'end the delegation here at any time.' }} />
            </ConfirmAction>
          </div>
          {!d.delegations.length ? <Empty>No delegates.</Empty> : <ul className="mt-2 text-sm">{d.delegations.map((x: any) => (
            <li key={x.id} className="flex items-center justify-between border-t border-border py-1.5 first:border-0"><span>{x.name} · {x.live ? `until ${fmtDay(x.until)}` : 'ended'}</span>
              {x.live && <Button size="sm" variant="ghost" onClick={() => call({ action: 'revoke', sectionId, delegationId: x.id }, 'Delegation ended.')}>End</Button>}</li>))}</ul>}
        </Panel>}
        <Panel title="Rubrics">
          {!d.rubrics.length ? <Empty>No rubrics yet.</Empty> : <ul className="space-y-2 text-sm">{d.rubrics.map((r: any) => (
            <li key={r.key}><p className="font-medium">{r.title} <span className="text-xs text-muted-foreground">v{r.version} · {r.max} points</span></p>
              <ul className="text-xs text-muted-foreground">{r.criteria.map((c: any) => <li key={c.id}>{c.name}: {c.levels.map((l: any) => `${l.label} (${l.points})`).join(' · ')}</li>)}</ul></li>))}</ul>}
          {d.role === 'instructor' && <details className="mt-3"><summary className="cursor-pointer text-sm">New rubric</summary>
            <RubricEditor onPublish={(key, title, criteria) => { const cur = d.rubrics.find((r: any) => r.key === key); call({ action: 'publishRubric', sectionId, key, title, criteria, expectedVersion: cur?.version ?? 0 }, cur ? 'Published a new version.' : 'Published.'); }} /></details>}
        </Panel>
      </div>)}
    </Loadable>
  );
}
