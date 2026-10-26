import { useState } from 'react';
import { toast } from 'sonner';
import { courseGroups } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Section tab: groups. Instructors set up and assign; students see their group and, in self-signup sets, choose one. */
export default function CourseGroups({ sectionId }: { sectionId: string }) {
  const s = useLoad(() => courseGroups({ action: 'get', sectionId }), [sectionId]);
  const [f, setF] = useState({ name: '', selfSignup: false, maxSize: 4, groups: 4 });
  const [pick, setPick] = useState<Record<number, string>>({});
  const call = async (body: any, ok: string) => { try { await courseGroups(body); toast(ok); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="space-y-3">
        {d.role === 'instructor' && <Panel title="New group set">
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label>Name<Input className="mt-1 w-56" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Groups<Input type="number" min={1} max={50} className="mt-1 w-20" value={f.groups} onChange={(e) => setF({ ...f, groups: Number(e.target.value) })} /></label>
            <label>Max per group<Input type="number" min={2} max={50} className="mt-1 w-20" value={f.maxSize} onChange={(e) => setF({ ...f, maxSize: Number(e.target.value) })} /></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={f.selfSignup} onChange={(e) => setF({ ...f, selfSignup: e.target.checked })} />Students choose their group</label>
            <Button size="sm" disabled={f.name.trim().length < 2} onClick={() => call({ action: 'createSet', sectionId, ...f }, 'Group set created.')}>Create</Button>
          </div>
        </Panel>}
        {!d.sets.length ? <Empty>No groups in this course.</Empty> : d.sets.map((set: any) => {
          const mine = set.groups.find((g: any) => g.mine);
          return (
            <Panel key={set.id} title={set.name} action={<span className="text-xs text-muted-foreground">{set.selfSignup ? 'Students choose' : 'Assigned by instructor'} · up to {set.maxSize}</span>}>
              {d.role === 'student' && mine && set.selfSignup && <Button size="sm" variant="ghost" onClick={() => call({ action: 'leave', sectionId, setId: set.id }, 'Left the group.')}>Leave {mine.name}</Button>}
              <ul className="grid gap-2 sm:grid-cols-2">{set.groups.map((g: any) => (
                <li key={g.id} className="rounded-md border border-border p-2 text-sm">
                  <p className="font-medium">{g.name} <span className="text-xs text-muted-foreground">{g.size}/{set.maxSize}{g.mine ? ' · your group' : ''}</span></p>
                  {g.members.length > 0 && <ul className="text-xs">{g.members.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between">{m.name}
                      {d.role === 'instructor' && <button className="text-muted-foreground underline" onClick={() => call({ action: 'remove', sectionId, setId: set.id, studentId: m.id }, 'Removed.')}>Remove</button>}</li>))}</ul>}
                  {d.role === 'student' && set.selfSignup && !g.mine && g.size < set.maxSize && <Button size="sm" variant="outline" className="mt-1" onClick={() => call({ action: 'join', sectionId, groupId: g.id }, `Joined ${g.name}.`)}>{mine ? 'Switch here' : 'Join'}</Button>}
                  {d.role === 'instructor' && <div className="mt-1 flex gap-1">
                    <select aria-label={`Add a student to ${g.name}`} className="rounded border border-border bg-background p-1 text-xs" value={pick[g.id] ?? ''} onChange={(e) => setPick({ ...pick, [g.id]: e.target.value })}>
                      <option value="">Add a student…</option>{d.students.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>
                    <Button size="sm" variant="outline" disabled={!pick[g.id]} onClick={() => call({ action: 'assign', sectionId, groupId: g.id, studentId: pick[g.id] }, 'Added.')}>Add</Button></div>}
                </li>))}</ul>
            </Panel>);
        })}
      </div>)}
    </Loadable>
  );
}
