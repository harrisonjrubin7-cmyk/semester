import { useState } from 'react';
import { toast } from 'sonner';
import { assessments } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg, ActionPreview } from './kit';
import { ConfirmAction } from './overlays';
import { validateQuestions, totalPoints, Question, QType } from '../lib/assessRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Q = Question;
const blank = (n: number): Q => ({ id: `q${n}`, type: 'single', prompt: '', options: ['', ''], answer: [0], points: 1 });

function QuestionEditor({ initial, onPublish }: { initial: Q[]; onPublish: (qs: Q[]) => void }) {
  const [qs, setQs] = useState<Q[]>(initial.length ? initial : [blank(1)]);
  const set = (i: number, p: Partial<Q>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const problem = validateQuestions(qs);
  return (
    <div className="space-y-3">
      {qs.map((q, i) => (
        <fieldset key={i} className="rounded-md border border-border p-3 text-sm">
          <legend className="px-1 text-xs text-muted-foreground">Question {i + 1}</legend>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs">Type <select className="ml-1 rounded border border-border bg-background p-1" value={q.type} onChange={(e) => { const t = e.target.value as QType; set(i, t === 'short' ? { type: t, options: [], answer: [] } : { type: t, options: q.options.length ? q.options : ['', ''], answer: q.answer.length ? q.answer.slice(0, t === 'single' ? 1 : 10) : [0] }); }}>
              <option value="single">One correct option</option><option value="multi">Several correct options</option><option value="short">Short answer (graded by hand)</option></select></label>
            <label className="text-xs">Points <Input type="number" className="ml-1 inline-block w-20" value={q.points} onChange={(e) => set(i, { points: Number(e.target.value) })} /></label>
            <Button size="sm" variant="ghost" onClick={() => setQs(qs.filter((_, j) => j !== i))} disabled={qs.length === 1}>Remove</Button>
          </div>
          <Textarea aria-label={`Prompt for question ${i + 1}`} rows={2} className="mt-2" placeholder="Prompt" value={q.prompt} onChange={(e) => set(i, { prompt: e.target.value })} />
          {q.type !== 'short' && <div className="mt-2 space-y-1">
            {q.options.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={`key-${i}`} aria-label={`Option ${k + 1} is correct`} checked={q.answer.includes(k)}
                  onChange={(e) => set(i, { answer: q.type === 'single' ? [k] : e.target.checked ? [...q.answer, k] : q.answer.filter((x) => x !== k) })} />
                <Input aria-label={`Option ${k + 1}`} value={o} onChange={(e) => set(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                <Button size="sm" variant="ghost" disabled={q.options.length <= 2} onClick={() => set(i, { options: q.options.filter((_, m) => m !== k), answer: q.answer.filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)) })}>×</Button>
              </div>))}
            {q.options.length < 10 && <Button size="sm" variant="ghost" onClick={() => set(i, { options: [...q.options, ''] })}>Add option</Button>}
          </div>}
        </fieldset>))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={qs.length >= 100} onClick={() => setQs([...qs, blank(Math.max(0, ...qs.map((q) => Number(q.id.slice(1)) || 0)) + 1)])}>Add question</Button>
        <span className="text-xs text-muted-foreground">{totalPoints(qs)} points</span>
        {problem ? <span role="status" className="text-xs">! {problem}</span> : (
          <ConfirmAction trigger={<Button size="sm">Publish</Button>} title="Publish this version?" confirmLabel="Publish" onConfirm={() => onPublish(qs)}>
            <ActionPreview says="Students in this section can take it while it is open. This version is frozen; once anyone submits, it cannot be changed." stays="Earlier versions stay on record." recovery={{ kind: 'request', how: 'publish a new assessment.' }} />
          </ConfirmAction>)}
      </div>
    </div>
  );
}

function Take({ sectionId, id, onDone }: { sectionId: string; id: number; onDone: () => void }) {
  const [att, setAtt] = useState<{ attemptId: number; limitMin: number | null; extraMin: number; questions: Omit<Q, 'answer'>[] } | null>(null);
  const [ans, setAns] = useState<Record<string, number[] | string>>({});
  if (!att) return <Button size="sm" onClick={async () => { try { setAtt(await assessments({ action: 'start', sectionId, id }) as any); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Start or resume</Button>;
  return (
    <form className="mt-2 space-y-3 text-sm" onSubmit={(e) => e.preventDefault()}>
      {att.limitMin != null && <p role="status" className="text-xs">Your time limit: {att.limitMin + att.extraMin} minutes{att.extraMin > 0 ? ` (includes ${att.extraMin} minutes of approved extended time)` : ''}. The clock started when you first opened this attempt.</p>}
      {att.questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Question {i + 1} · {q.points} pts</legend>
          <p className="mb-2 whitespace-pre-wrap">{q.prompt}</p>
          {q.type === 'short' ? <Textarea aria-label={`Answer to question ${i + 1}`} rows={4} value={(ans[q.id] as string) ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} /> :
            q.options.map((o, k) => {
              const cur = (ans[q.id] as number[]) ?? [];
              return (<label key={k} className="flex items-center gap-2"><input type={q.type === 'single' ? 'radio' : 'checkbox'} name={`a-${q.id}`} checked={cur.includes(k)}
                onChange={(e) => setAns({ ...ans, [q.id]: q.type === 'single' ? [k] : e.target.checked ? [...cur, k] : cur.filter((x) => x !== k) })} />{o}</label>);
            })}
        </fieldset>))}
      <ConfirmAction trigger={<Button size="sm">Submit</Button>} title="Submit your answers?" confirmLabel="Submit" onConfirm={async () => { try { await assessments({ action: 'submit', sectionId, attemptId: att.attemptId, answers: ans }); toast('Submitted. Your score appears when your instructor releases it.'); setAtt(null); onDone(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>
        <p className="text-sm">You cannot change answers after submitting.</p>
      </ConfirmAction>
    </form>
  );
}

/** Second-person review of a graded attempt: agree, or adjust the total with a reason. Draft until released. */
function Moderate({ t, total, onModerate }: { t: any; total: number | null; onModerate: (decision: 'agree' | 'adjust', score: number | null, note: string) => void }) {
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const current = (t.moderations ?? []).filter((m: any) => m.current);
  return (
    <div className="mb-2 ml-2 border-l border-border pl-3 text-xs">
      {t.gradedBy && <p className="text-muted-foreground">Graded by {t.gradedBy}</p>}
      {(t.moderations ?? []).map((m: any, i: number) => <p key={i} className={m.current ? '' : 'text-muted-foreground line-through'}>{m.decision === 'agree' ? '✓ Agreed' : `≠ Adjusted to ${m.score}`} by {m.by} · {fmt(m.at)}{m.note ? ` · ${m.note}` : ''}{!m.current && ' (re-graded since)'}</p>)}
      {t.canModerate && !current.length && <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onModerate('agree', null, note)}>Agree</Button>
        <Input aria-label="Adjusted total" type="number" className="w-24" placeholder={total != null ? `0–${total}` : 'Total'} value={score} onChange={(e) => setScore(e.target.value)} />
        <Input aria-label="Reason" placeholder="Reason (needed to adjust)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!score || note.trim().length < 10} onClick={() => onModerate('adjust', Number(score), note)}>Adjust</Button>
      </div>}
    </div>
  );
}

function GradeAttempt({ t, total, onGrade }: { t: any; total: number | null; onGrade: (manual: number, fb: string) => void }) {
  const [m, setM] = useState(t.manual?.toString() ?? '0');
  const [fb, setFb] = useState(t.feedback ?? '');
  return (
    <div className="border-t border-border py-2 text-sm first:border-0">
      <p>{t.student} · <Status value={t.state} />{t.late && ' · late'}{t.extended && ' · extended time applied'} · automatic {t.auto ?? '—'}{total != null && ` / ${total}`}</p>
      {Object.entries(t.answers ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => <p key={k} className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-xs">{k}: {String(v)}</p>)}
      {t.state !== 'released' && t.state !== 'in_progress' && <div className="mt-1 flex flex-wrap gap-2">
        <Input aria-label="Hand-graded points" type="number" className="w-24" value={m} onChange={(e) => setM(e.target.value)} />
        <Input aria-label="Feedback" placeholder="Feedback" value={fb} onChange={(e) => setFb(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => onGrade(Number(m), fb)}>Save grade</Button>
      </div>}
    </div>
  );
}

/** Section tab: assessments. Instructors author, grade and release; enrolled students take them. */
export default function Assessments({ sectionId }: { sectionId: string }) {
  const s = useLoad(() => assessments({ action: 'list', sectionId }), [sectionId]);
  const [form, setForm] = useState({ title: '', opensAt: '', closesAt: '', timeLimitMin: '', attemptsAllowed: '1' });
  const call = async (body: any, ok: string) => { try { await assessments(body); toast(ok); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-3">
        {d.teaching && <Panel title="New assessment">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Title<Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="text-xs">Attempts allowed<Input type="number" min={1} max={10} className="mt-1" value={form.attemptsAllowed} onChange={(e) => setForm({ ...form, attemptsAllowed: e.target.value })} /></label>
            <label className="text-xs">Opens<Input type="datetime-local" className="mt-1" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></label>
            <label className="text-xs">Closes<Input type="datetime-local" className="mt-1" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></label>
            <label className="text-xs">Time limit in minutes (optional)<Input type="number" className="mt-1" value={form.timeLimitMin} onChange={(e) => setForm({ ...form, timeLimitMin: e.target.value })} /></label>
          </div>
          <Button size="sm" className="mt-2" disabled={form.title.trim().length < 3 || !form.opensAt || !form.closesAt} onClick={() => call({ action: 'create', sectionId, title: form.title, opensAt: new Date(form.opensAt).toISOString(), closesAt: new Date(form.closesAt).toISOString(), timeLimitMin: form.timeLimitMin ? Number(form.timeLimitMin) : null, attemptsAllowed: Number(form.attemptsAllowed) }, 'Draft created. Add questions and publish.')}>Create draft</Button>
        </Panel>}
        {!d.assessments.length ? <Empty>{d.teaching ? 'No assessments yet.' : 'No assessments are open in this course.'}</Empty> : d.assessments.map((x: any) => (
          <Panel key={x.id} title={x.title} action={<Status value={x.state} />}>
            <p className="text-xs text-muted-foreground">{fmt(x.opensAt)} – {fmt(x.closesAt)}{x.timeLimitMin ? ` · ${x.timeLimitMin} min` : ''} · {x.attemptsAllowed} attempt{x.attemptsAllowed > 1 ? 's' : ''}{x.total != null && ` · ${x.total} pts`}{d.teaching && ` · version ${x.version}`}</p>
            {d.grader ? (<div className="mt-2 space-y-3">
              {d.teaching && <details><summary className="cursor-pointer text-sm">Questions</summary>
                <QuestionEditor initial={x.questions} onPublish={(qs) => call({ action: 'publish', sectionId, id: x.id, questions: qs, expectedVersion: x.version }, 'Published.')} /></details>}
              <div>
                <div className="flex items-center justify-between"><p className="text-sm font-medium">Attempts · {x.attempts.length}</p>
                  {d.teaching && <Button size="sm" variant="outline" onClick={() => call({ action: 'release', sectionId, id: x.id }, 'Graded scores released.')}>Release graded scores</Button>}</div>
                {d.teaching ? <label className="mt-1 block text-xs">Second-person review before release
                  <select className="ml-2 rounded-md border border-border bg-background p-1 text-sm" value={x.moderationPct}
                    onChange={(e) => call({ action: 'setModeration', sectionId, id: x.id, pct: Number(e.target.value) }, 'Moderation updated.')}>
                    {[0, 10, 20, 25, 50, 100].map((p) => <option key={p} value={p}>{p === 0 ? 'Off' : `${p}% of graded attempts`}</option>)}
                  </select></label> : x.moderationPct > 0 && <p className="mt-1 text-xs">This assessment needs a second-person review of {x.moderationPct}% of graded attempts before release.</p>}
                {!x.attempts.length ? <Empty>No attempts yet.</Empty> : x.attempts.map((t: any) => <div key={t.id}><GradeAttempt t={t} total={x.total} onGrade={(manual, feedback) => call({ action: 'grade', sectionId, attemptId: t.id, manual, feedback }, 'Grade saved, not released.')} />
                  <Moderate t={t} total={x.total} onModerate={(decision, score, note) => call({ action: 'moderate', sectionId, attemptId: t.id, decision, score, note }, decision === 'agree' ? 'Review recorded.' : 'Score adjusted and review recorded.')} /></div>)}
              </div>
            </div>) : (<div className="mt-2 space-y-2 text-sm">
              {x.attempts.map((t: any) => <p key={t.id}><Status value={t.state === 'released' ? 'Released' : t.state === 'in_progress' ? 'In progress' : 'Submitted'} />{t.late && ' · late'}{t.state === 'released' && ` · ${t.score}${x.total != null ? ` / ${x.total}` : ''}${t.feedback ? ` · ${t.feedback}` : ''}`}</p>)}
              {x.state === 'published' && <Take sectionId={sectionId} id={x.id} onDone={s.reload} />}
            </div>)}
          </Panel>))}
      </div>)}
    </Loadable>
  );
}
