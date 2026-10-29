import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { degreePlan } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
type T = { term: string; courseIds: string[] };
const STATE: Record<string, string> = { draft: 'Draft', submitted: 'With your advisor', changes_requested: 'Changes requested', approved: 'Approved', none: 'No plan yet' };
const sel = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

function Check({ d }: { d: any }) {
  return (
    <Panel title={d.check.complete ? 'This plan completes every requirement' : 'What this plan leaves short'}>
      <ul className="space-y-1 text-sm">
        {d.check.requirements.map((r: any) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2"><span>{r.name}</span>
            <span className="text-muted-foreground">{r.earned} earned · {r.pending} in progress · {r.planned} planned of {r.required}{r.short ? ` · ${r.short} short` : ' · met'}</span></li>
        ))}
      </ul>
      {d.check.issues.length > 0 && <><p className="mt-3 text-xs font-medium">Will not work as written</p>
        <ul className="mt-1 list-disc pl-5 text-sm">{d.check.issues.map((i: any, n: number) => <li key={n}>{i.text}</li>)}</ul></>}
      <p className="mt-2 text-xs text-muted-foreground">A plan is advice. It does not register you; registration still checks seats, holds and prerequisites.</p>
    </Panel>
  );
}

function Editor({ d, reload }: { d: any; reload: () => void }) {
  const [terms, setTerms] = useState<T[]>(d.terms);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTerms(d.terms), [d.terms]);
  const code = (id: string) => d.catalog.find((c: any) => c.id === id);
  const editable = !d.plan || d.plan.state !== 'submitted';
  const set = (i: number, t: T) => setTerms(terms.map((x, j) => (j === i ? t : x)));
  const save = async () => {
    setBusy(true);
    try { await degreePlan({ action: 'save', terms, version: d.plan?.version ?? 0 } as never); toast('Plan saved.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const step = async (s: string, ok: string) => {
    setBusy(true);
    try { await degreePlan({ action: 'step', step: s, id: d.plan.id, version: d.plan.version, note: '' } as never); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const dirty = JSON.stringify(terms) !== JSON.stringify(d.terms);
  return (
    <Panel title="Your terms" action={d.plan && <Status value={STATE[d.plan.state]} />}>
      {d.plan?.state === 'changes_requested' && <p className="mb-2 rounded-md border border-border p-2 text-sm">{d.plan.reviewedBy}: {d.plan.reviewNote}</p>}
      {!terms.length && <Empty>No terms yet. Add the next term you will take classes in.</Empty>}
      <div className="space-y-3">
        {terms.map((t, i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Term name" className="h-8 max-w-[12rem]" value={t.term} disabled={!editable} onChange={(e) => set(i, { ...t, term: e.target.value })} placeholder="Fall 2027" />
              <span className="text-xs text-muted-foreground">{d.check.terms[i]?.credits ?? 0} credits</span>
              {editable && <Button size="sm" variant="ghost" onClick={() => setTerms(terms.filter((_, j) => j !== i))}>Remove term</Button>}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {t.courseIds.map((id) => (
                <li key={id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">{code(id)?.code ?? 'Unknown course'} <span className="text-muted-foreground">{code(id)?.credits ?? ''}</span>
                  {editable && <button type="button" aria-label={`Remove ${code(id)?.code ?? 'course'}`} className="ml-1 text-muted-foreground" onClick={() => set(i, { ...t, courseIds: t.courseIds.filter((x) => x !== id) })}>×</button>}</li>
              ))}
            </ul>
            {editable && t.courseIds.length < 10 && (
              <select aria-label={`Add a course to ${t.term || 'this term'}`} className={`${sel} mt-2`} value="" onChange={(e) => e.target.value && set(i, { ...t, courseIds: [...t.courseIds, e.target.value] })}>
                <option value="">Add a course…</option>
                {d.catalog.filter((c: any) => !t.courseIds.includes(c.id)).map((c: any) => <option key={c.id} value={c.id}>{c.code} · {c.title} ({c.credits})</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      {editable && <div className="mt-3 flex flex-wrap gap-2">
        {terms.length < 12 && <Button size="sm" variant="outline" onClick={() => setTerms([...terms, { term: '', courseIds: [] }])}>Add term</Button>}
        <Button size="sm" disabled={busy || !dirty} onClick={save}>Save plan</Button>
        {d.plan && ['draft', 'changes_requested'].includes(d.plan.state) && <Button size="sm" disabled={busy || dirty || !d.terms.length} onClick={() => step('submit', 'Sent to your advisor.')}>Send to advisor</Button>}
      </div>}
      {d.plan?.state === 'submitted' && <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => step('recall', 'Recalled. You can edit again.')}>Recall to edit</Button>}
      {dirty && <p className="mt-2 text-xs text-muted-foreground">Unsaved changes. The check below reflects the saved plan.</p>}
    </Panel>
  );
}

function Review({ d, reload }: { d: any; reload: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (s: string, ok: string) => {
    setBusy(true);
    try { await degreePlan({ action: 'step', step: s, id: d.plan.id, version: d.plan.version, note } as never); toast(ok); setNote(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const code = (id: string) => d.catalog.find((c: any) => c.id === id)?.code ?? 'Unknown course';
  return (
    <Panel title={`${d.studentName}'s plan`} action={<Status value={STATE[d.plan?.state ?? 'none']} />}>
      {!d.terms.length ? <Empty>No terms planned yet.</Empty> : <ul className="space-y-1 text-sm">{d.terms.map((t: T, i: number) => <li key={i}><strong>{t.term}</strong> · {t.courseIds.map(code).join(', ') || 'no courses'} · {d.check.terms[i]?.credits ?? 0} credits</li>)}</ul>}
      {d.plan?.state === 'submitted' && <div className="mt-3 space-y-2">
        <Textarea aria-label="Note to the student" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the student (needed when asking for changes)" />
        <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => go('approve', 'Plan approved.')}>Approve plan</Button>
          <Button size="sm" variant="outline" disabled={busy || note.trim().length < 10} onClick={() => go('changes', 'Changes requested.')}>Ask for changes</Button></div>
      </div>}
    </Panel>
  );
}

export default function DegreePlan() {
  const [who, setWho] = useState<string | undefined>(undefined);
  const s = useLoad(() => degreePlan({ action: 'get', studentId: who } as never) as Promise<any>, [who]);
  return (
    <>
      <PageHeader eyebrow="Plan" title="Degree plan" sub="Lay out your remaining terms, see what each requirement would look like, and send the plan to an advisor you have shared your degree progress or registration plan with." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.queue.length > 0 && <Panel title="Advisees who shared their plan">
            <ul className="space-y-1 text-sm">{d.queue.map((q: any) => (
              <li key={q.studentId} className="flex flex-wrap items-center justify-between gap-2"><span>{q.name} <Status value={STATE[q.state]} /></span>
                <Button size="sm" variant={d.target === q.studentId ? 'default' : 'outline'} onClick={() => setWho(q.studentId)}>Open</Button></li>))}
              {!d.own && <li><Button size="sm" variant="ghost" onClick={() => setWho(undefined)}>Back to my own plan</Button></li>}
            </ul></Panel>}
          {d.own ? <Editor d={d} reload={s.reload} /> : <Review d={d} reload={s.reload} />}
          <Check d={d} />
          {d.plan?.approvedTerms && d.plan.state !== 'approved' && <Panel title={`Last approved plan · ${d.plan.approvedBy ?? 'Advisor'} · ${fmt(d.plan.approvedAt)}`}>
            <ul className="text-sm">{d.plan.approvedTerms.map((t: T, i: number) => <li key={i}><strong>{t.term}</strong> · {t.courseIds.map((id) => d.catalog.find((c: any) => c.id === id)?.code ?? 'Unknown course').join(', ')}</li>)}</ul></Panel>}
        </div>
      )}</Loadable>
    </>
  );
}
