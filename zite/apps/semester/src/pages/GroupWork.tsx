import { useState } from 'react';
import { toast } from 'sonner';
import { groupWork } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['To do', 'In progress', 'Needs review', 'Done'] as const;
const sel = 'rounded-md border border-border bg-background p-1 text-sm';
const today = () => new Date().toISOString().slice(0, 10);
type Draft = { id: number | null; title: string; ownerId: string | null; status: string; due: string; note: string; version: number };
const blank = (): Draft => ({ id: null, title: '', ownerId: null, status: 'To do', due: '', note: '', version: 0 });

function GroupPanel({ g, reload }: { g: any; reload: () => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const call = async (body: object, ok: string) => { try { await groupWork(body as never); toast(ok); setD(null); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const counts = STATUSES.map((s) => [s, g.parts.filter((p: any) => p.status === s).length] as const);
  const unowned = g.parts.filter((p: any) => !p.ownerId && p.status !== 'Done').length;
  const late = g.parts.filter((p: any) => p.due && p.due < today() && p.status !== 'Done').length;
  return (
    <Panel title={`${g.name} · ${g.set}`} action={<span className="text-xs text-muted-foreground">{g.section}{g.readOnly ? ' · you teach this course (read only)' : ''}</span>}>
      <p className="text-xs">Members: {g.members.map((m: any) => m.name).join(', ') || '—'}</p>
      <p className="mt-1 text-xs">{counts.map(([s, n]) => `${s} ${n}`).join(' · ')}{unowned ? ` · ${unowned} without an owner` : ''}{late ? ` · ! ${late} past due` : ''}</p>
      {!g.parts.length ? <Empty>{g.readOnly ? 'This group has not listed any parts yet.' : 'No parts yet. Split the project into parts and give each one an owner.'}</Empty> : (
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Parts for {g.name}</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Part</th><th className="p-1">Owner</th><th className="p-1">Status</th><th className="p-1">Due</th><th className="p-1">Last change</th>{!g.readOnly && <th className="p-1"><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>{g.parts.map((p: any) => (
            <tr key={p.id} className="border-t border-border align-top">
              <td className="p-1"><span className={p.status === 'Done' ? 'line-through' : ''}>{p.title}</span>{p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}</td>
              <td className="p-1">{p.owner ?? <span className="text-muted-foreground">Nobody yet</span>}</td>
              <td className="p-1"><Status value={p.status} /></td>
              <td className="p-1">{p.due ? <>{p.due}{p.due < today() && p.status !== 'Done' && <span className="text-destructive"> ! past due</span>}</> : '—'}</td>
              <td className="p-1 text-xs text-muted-foreground">{p.updatedBy}, {new Date(p.updatedAt).toLocaleDateString()}</td>
              {!g.readOnly && <td className="p-1"><Button size="sm" variant="ghost" onClick={() => setD({ id: p.id, title: p.title, ownerId: p.ownerId, status: p.status, due: p.due ?? '', note: p.note, version: p.version })}>Edit</Button>
                {p.mineToRemove && <Button size="sm" variant="ghost" onClick={() => call({ action: 'delete', groupId: g.id, id: p.id }, 'Part removed.')}>Remove</Button>}</td>}
            </tr>))}</tbody></table></div>)}
      {!g.readOnly && (d ? (
        <div className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="text-xs" htmlFor={`gw-t-${g.id}`}>Part</label><Input id={`gw-t-${g.id}`} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Literature review" /></div>
          <div><label className="text-xs" htmlFor={`gw-o-${g.id}`}>Owner</label><select id={`gw-o-${g.id}`} className={`${sel} w-full`} value={d.ownerId ?? ''} onChange={(e) => setD({ ...d, ownerId: e.target.value || null })}><option value="">Nobody yet</option>{g.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="text-xs" htmlFor={`gw-s-${g.id}`}>Status</label><select id={`gw-s-${g.id}`} className={`${sel} w-full`} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs" htmlFor={`gw-d-${g.id}`}>Due</label><Input id={`gw-d-${g.id}`} type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-xs" htmlFor={`gw-n-${g.id}`}>Note</label><Textarea id={`gw-n-${g.id}`} rows={2} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></div>
          <div className="flex gap-2 sm:col-span-2"><Button size="sm" disabled={!d.title.trim()} onClick={() => call({ action: 'save', groupId: g.id, id: d.id, title: d.title, ownerId: d.ownerId, status: d.status, due: d.due || null, note: d.note, expectedVersion: d.version }, 'Saved.')}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setD(null)}>Cancel</Button></div>
        </div>) : <Button size="sm" className="mt-3" onClick={() => setD(blank())}>Add a part</Button>)}
      <details className="mt-3"><summary className="cursor-pointer text-xs">Change log ({g.log.length})</summary>
        {!g.log.length ? <p className="text-xs text-muted-foreground">No changes yet.</p> : <ul className="mt-1 space-y-0.5 text-xs">{g.log.map((l: any, i: number) => <li key={i}>{new Date(l.at).toLocaleString()} — {l.who} {l.what}</li>)}</ul>}</details>
    </Panel>
  );
}

export default function GroupWork() {
  const s = useLoad(() => groupWork({ action: 'list' } as never) as Promise<any>, []);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Campus" title="Group work" sub="A shared list of parts for each course group you are in: who owns each part, its status and due date. Your group and your instructor can see it; changes are logged." />
      <Loadable state={s}>{(d: any) => !d.groups.length
        ? <Empty>You are not in a course group yet. Instructors set groups up in the course's Groups tab; in self-signup courses you can join one there.</Empty>
        : <div className="space-y-4">{d.groups.map((g: any) => <GroupPanel key={g.id} g={g} reload={s.reload} />)}</div>}</Loadable>
    </div>
  );
}
