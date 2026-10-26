import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SyllabusTab, MaterialsTab } from '../components/CourseStudio';
import { toast } from 'sonner';
import { learn } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Markdown } from '@project/components/markdown';
import { ArrowLeft } from 'lucide-react';
import { NewAssignment, Attendance, Discussion } from '../components/CourseOps';
import Assessments from '../components/Assessments';
import { PageHeader, Panel, Empty, SourceTag, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';
import { uploadPrivate, saveBytes } from '../lib/fileClient';
import { MIME_ALLOW, MAX_BYTES } from '../lib/fileRules';

type Sub = { id: string; taskId: string; taskTitle: string; student: string; state: string; score: number | null; feedback: string; files: { name: string; url: string }[]; attachments: { fileId: string; name: string; size: number }[] };
type Asg = { id: string; title: string; dueAt: string | null; points: number | null; rubric: string; source: string };

const openAtt = async (submissionId: string, fileId: string) => { try { saveBytes((await learn({ action: 'openAttachment', submissionId, fileId })) as never); } catch (e) { toast.error(errMsg(e)); } };
const AttList = ({ s, onDetach }: { s: Sub; onDetach?: (fileId: string) => void }) => (<>{(s.attachments ?? []).map((f) => (
  <span key={f.fileId} className="flex items-center gap-2 text-xs"><button className="text-primary underline" onClick={() => openAtt(s.id, f.fileId)}>{f.name}</button>
    {onDetach && <button className="text-muted-foreground underline" onClick={() => onDetach(f.fileId)}>Remove</button>}</span>))}</>);

function GradeRow({ s, onSave }: { s: Sub; onSave: (score: number, fb: string) => void }) {
  const [score, setScore] = useState(s.score?.toString() ?? '');
  const [fb, setFb] = useState(s.feedback);
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex justify-between"><span className="font-medium">{s.student} · {s.taskTitle}</span><Status value={s.state} /></div>
      {s.files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="block text-xs text-primary underline">{f.name}</a>)}
      <AttList s={s} />
      <div className="mt-2 flex gap-2"><Input className="w-24" type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} /><Input placeholder="Feedback" value={fb} onChange={(e) => setFb(e.target.value)} /><Button size="sm" variant="outline" disabled={score === ''} onClick={() => onSave(Number(score), fb)}>Save</Button></div>
    </div>
  );
}

function Assignment({ a, sub, onUpload, onSubmit, onAttach, onDetach, busy }: { a: Asg; sub?: Sub; onUpload: () => void; onSubmit: (id: string) => void; onAttach: (f: File) => void; onDetach: (fileId: string) => void; busy: boolean }) {
  return (
    <Panel>
      <div className="flex justify-between gap-2"><p className="eyebrow">Assignment</p><SourceTag source={a.source} /></div>
      <p className="font-display text-xl">{a.title}</p>
      <p className="text-sm text-muted-foreground">{fmt(a.dueAt)}{a.points ? ` · ${a.points} pts` : ''}</p>
      {a.rubric && <div className="mt-2 text-xs text-muted-foreground"><p className="font-medium text-foreground">Rubric</p>{a.rubric.split('\n').map((l) => <p key={l}>{l}</p>)}</div>}
      {sub && sub.state !== 'Private Draft' ? (
        <div className="mt-3 text-sm"><Status value={sub.state} />{sub.state === 'Released' && <p className="mt-1">Score {sub.score}{a.points ? ` / ${a.points}` : ''} · {sub.feedback}</p>}{sub.state !== 'Released' && <p className="text-xs text-muted-foreground">Grades appear when your instructor releases them.</p>}</div>
      ) : (
        <div className="mt-3 space-y-2">
          {!sub && <Button size="sm" variant="outline" disabled={busy} onClick={onUpload}>Start a private draft</Button>}
          {sub?.files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="block text-xs text-primary underline">○ {f.name}</a>)}
          {sub && <AttList s={sub} onDetach={onDetach} />}
          <label className="block text-xs">Attach a file (private; your instructor sees it after you submit, up to {MAX_BYTES / 1024 / 1024} MB)
            <input type="file" className="mt-1 block text-xs" accept={Object.keys(MIME_ALLOW).join(',')} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ''; }} /></label>
          {sub && <Button size="sm" onClick={() => onSubmit(sub.id)}>Submit</Button>}
        </div>
      )}
    </Panel>
  );
}

export default function SectionPage() {
  const { sectionId = '' } = useParams();
  const state = useLoad(() => learn({ action: 'section', sectionId }), [sectionId]);
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <>
      <Link to="/learn" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Courses</Link>
      <Loadable state={state}>{(d) => (<>
        <PageHeader eyebrow={`${d.section.term} · ${d.teaching ? 'Teaching' : 'Enrolled'}`} title={`${d.section.code} · ${d.section.title}`} sub={d.section.times} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="assignments">
              <TabsList><TabsTrigger value="assignments">Assignments</TabsTrigger><TabsTrigger value="assessments">Assessments</TabsTrigger><TabsTrigger value="syllabus">Syllabus</TabsTrigger><TabsTrigger value="materials">Materials</TabsTrigger><TabsTrigger value="discussion">Discussion</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger>{d.teaching && <TabsTrigger value="grading">Grading</TabsTrigger>}</TabsList>
              <TabsContent value="discussion"><Discussion sectionId={sectionId} /></TabsContent>
              <TabsContent value="assessments"><Assessments sectionId={sectionId} /></TabsContent>
              <TabsContent value="attendance"><Attendance sectionId={sectionId} isTeacher={d.teaching} /></TabsContent>
              <TabsContent value="assignments" className="space-y-3">
                {d.teaching && <NewAssignment sectionId={sectionId} onDone={() => state.reload()} />}
                {d.assignments.length === 0 ? <Empty>No assignments posted.</Empty> : d.assignments.map((a: Asg) => (
                  <Assignment key={a.id} a={a} busy={false} sub={d.teaching ? undefined : d.submissions.find((s: Sub) => s.taskId === a.id)}
                    onUpload={() => act(() => learn({ action: 'saveDraft', taskId: a.id }), 'Draft started')}
                    onAttach={(f) => act(async () => { const fileId = await uploadPrivate(f, 'submission'); await learn({ action: 'saveDraft', taskId: a.id, fileId }); }, 'Attached to your draft')}
                    onDetach={(fileId) => { const sub = d.submissions.find((s: Sub) => s.taskId === a.id); if (sub) act(() => learn({ action: 'detachFile', submissionId: sub.id, fileId }), 'Removed from your draft'); }}
                    onSubmit={(id) => act(() => learn({ action: 'submit', submissionId: id }), 'Submitted')} />))}
              </TabsContent>
              <TabsContent value="syllabus"><SyllabusTab d={d} sectionId={sectionId} reload={state.reload} /></TabsContent>
              <TabsContent value="materials"><MaterialsTab d={d} sectionId={sectionId} reload={state.reload} /></TabsContent>
              {d.teaching && <TabsContent value="grading"><Panel title="Submissions" action={<Button size="sm" onClick={() => act(() => learn({ action: 'release', sectionId }), 'Graded work released')}>Release grades</Button>}>
                {d.submissions.length === 0 ? <Empty>No submitted work yet. Drafts stay private to students.</Empty> : d.submissions.map((s: Sub) => <GradeRow key={s.id} s={s} onSave={(score, feedback) => act(() => learn({ action: 'grade', submissionId: s.id, score, feedback }), 'Saved, not released')} />)}
              </Panel></TabsContent>}
            </Tabs>
          </div>
          <div className="space-y-4">
            <Panel title="Course AI policy">
              {d.teaching ? (
                <Select value={d.section.policy} onValueChange={(v) => act(() => learn({ action: 'setPolicy', sectionId, policy: v as 'Allowed' | 'Outlining Only' | 'Not Allowed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Allowed', 'Outlining Only', 'Not Allowed'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="text-sm">{d.section.policy}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Set by the instructor. Ask Semester follows it.</p>
            </Panel>
            {d.teaching && <Panel title="At a glance"><p className="text-sm">{d.submissions.filter((s: Sub) => s.state === 'Submitted').length} to grade · {d.submissions.filter((s: Sub) => s.state === 'Graded').length} graded, unreleased</p></Panel>}
            {!d.teaching && <Panel title="Ask about this course"><Link to="/learn/ask" className="text-sm text-primary underline">Open Ask Semester →</Link></Panel>}
          </div>
        </div>
      </>)}</Loadable>
    </>
  );
}
