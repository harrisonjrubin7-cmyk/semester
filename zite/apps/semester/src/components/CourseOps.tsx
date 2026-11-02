import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { teaching } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { DateTimePicker, DatePicker } from '@project/components/ui/date-picker';
import { Panel, Empty, fmt, useLoad, Loadable, errMsg } from './kit';

export function NewAssignment({ sectionId, onDone }: { sectionId: string; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<Date | undefined>();
  const [points, setPoints] = useState('100');
  const [rubric, setRubric] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = title.trim().length >= 2 && !!due && due > new Date() && Number(points) >= 0;
  const save = async () => {
    setBusy(true);
    try {
      const r = await teaching({ action: 'createAssignment', sectionId, title: title.trim(), dueAt: due!.toISOString(), points: Number(points), rubric });
      toast.success(`Published to ${r.assigned} students`);
      setTitle(''); setDue(undefined); setRubric(''); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel title="New assignment">
      <div className="space-y-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2"><div className="flex-1"><DateTimePicker value={due} onChange={setDue} /></div><Input className="w-28" type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points" /></div>
        {due && due <= new Date() && <p className="text-xs text-destructive">Due date must be in the future.</p>}
        <Textarea placeholder="Rubric, one criterion per line" value={rubric} onChange={(e) => setRubric(e.target.value)} />
        <p className="text-xs text-muted-foreground">Publishing posts it to every enrolled student as ◆ Official and notifies them.</p>
        <Button size="sm" disabled={!valid || busy} onClick={save}>{busy ? 'Publishing…' : 'Publish assignment'}</Button>
      </div>
    </Panel>
  );
}

const MARKS = ['Present', 'Late', 'Absent', 'Excused'] as const;
type Mark = (typeof MARKS)[number];

export function Attendance({ sectionId, isTeacher }: { sectionId: string; isTeacher: boolean }) {
  const [date, setDate] = useState<Date>(new Date());
  const iso = date.toLocaleDateString('en-CA');
  const state = useLoad(() => teaching({ action: 'attendance', sectionId, date: iso }), [sectionId, iso]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMarks({}); }, [iso]);
  if (!isTeacher) return (
    <Panel title="Your attendance"><Loadable state={state}>{(d) => !d.mine?.length ? <Empty>No attendance recorded yet.</Empty> : d.mine.map((m: { date: string; status: string }) => <div key={m.date} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>{fmt(m.date)}</span><span>{m.status === 'Present' ? '✓' : m.status === 'Absent' ? '!' : '…'} {m.status}</span></div>)}</Loadable></Panel>
  );
  return (
    <Panel title="Attendance" action={<div className="w-44"><DatePicker value={date} onChange={(d) => d && setDate(d)} /></div>}>
      <Loadable state={state}>{(d) => !d.rows?.length ? <Empty>No enrolled students.</Empty> : (<>
        {d.rows.map((r: { id: string; name: string; status: Mark | null }) => {
          const cur = marks[r.id] ?? r.status;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
              <span>{r.name}</span>
              <div className="flex gap-1">{MARKS.map((m) => <Button key={m} size="sm" variant={cur === m ? 'default' : 'outline'} onClick={() => setMarks((p) => ({ ...p, [r.id]: m }))}>{m}</Button>)}</div>
            </div>
          );
        })}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(d.rows.map((r: { id: string }) => [r.id, 'Present'])))}>Mark all present</Button>
          <Button size="sm" disabled={busy || Object.keys(marks).length === 0} onClick={async () => {
            setBusy(true);
            try { await teaching({ action: 'saveAttendance', sectionId, date: iso, marks: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }); toast.success('Attendance saved'); setMarks({}); await state.reload(); }
            catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
          }}>Save attendance</Button>
        </div>
      </>)}</Loadable>
    </Panel>
  );
}

export function Discussion({ sectionId }: { sectionId: string }) {
  const state = useLoad(() => teaching({ action: 'discussion', sectionId }), [sectionId]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="Course discussion">
      <Loadable state={state}>{(d) => !d.posts.length ? <Empty>No posts yet. Start the conversation.</Empty> : (
        <div className="space-y-3">{d.posts.map((p: { id: string; body: string; author: string; instructor: boolean; at: string | null }) => (
          <div key={p.id} className="border-b border-border pb-2 text-sm last:border-0">
            <p className="text-xs text-muted-foreground">{p.author}{p.instructor ? ' · Instructor' : ''} · {fmt(p.at)}</p>
            <p className="whitespace-pre-wrap">{p.body}</p>
          </div>))}</div>
      )}</Loadable>
      <div className="mt-3 space-y-2">
        <Textarea placeholder="Write a post visible to everyone in this section" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button size="sm" disabled={!body.trim() || busy} onClick={async () => {
          setBusy(true);
          try { await teaching({ action: 'post', sectionId, body: body.trim() }); setBody(''); await state.reload(); }
          catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
        }}>Post</Button>
      </div>
    </Panel>
  );
}
