import { useState } from 'react';
import { toast } from 'sonner';
import { council } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await council(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Pkg({ k, d, act }: { k: any; d: any; act: ReturnType<typeof useAct> }) {
  const [rv, setRv] = useState({ score: '', met: '', note: '' });
  const [note, setNote] = useState('');
  const [who, setWho] = useState('');
  const [cf, setCf] = useState('');
  const open = ['submitted', 'appealed'].includes(k.state);
  const step = (s: string, msg: string) => act({ action: 'step', packageId: k.id, step: s, note, expectedVersion: k.version }, msg);
  return (
    <div className="border-b border-border py-2 text-sm">
      <p><span className="font-medium">{k.title}</span> · {k.credential} · rubric {k.rubric} <Status value={k.state.replace('_', ' ')} /></p>
      <p className="text-xs">{k.summary}</p>
      <p className="text-xs text-muted-foreground">Submitted by {k.submittedBy}{k.decidedBy ? ` · decided by ${k.decidedBy}` : ''}{k.decisionNote ? `: ${k.decisionNote}` : ''}{k.appealReason ? ` · appeal: ${k.appealReason}` : ''}</p>
      {k.assigned.length > 0 && <p className="text-xs">Reviewers: {k.assigned.map((r: any) => `${r.name}${r.reviewed ? ' ✓' : ''}`).join(', ')}</p>}
      {k.reviews.map((r: any, i: number) => <p key={i} className="text-xs"><Status value={r.met ? 'met' : 'not met'} /> {r.score}/4 · {r.note}</p>)}
      {open && k.myAssignment && !k.myReview && <div className="mt-1 flex flex-wrap gap-2">
        <select aria-label="Score" className={sel} value={rv.score} onChange={(e) => setRv({ ...rv, score: e.target.value })}><option value="">Score 0–4</option>{[0, 1, 2, 3, 4].map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Standard met" className={sel} value={rv.met} onChange={(e) => setRv({ ...rv, met: e.target.value })}><option value="">Standard…</option><option value="yes">Met</option><option value="no">Not met</option></select>
        <Input aria-label="Review note" placeholder="Reasoning against the rubric" className="w-64" value={rv.note} onChange={(e) => setRv({ ...rv, note: e.target.value })} />
        <Button size="sm" disabled={!rv.score || !rv.met || rv.note.length < 10} onClick={() => act({ action: 'review', packageId: k.id, score: Number(rv.score), met: rv.met === 'yes', note: rv.note }, 'Review recorded.')}>Submit review</Button></div>}
      {open && !k.mine && !k.myConflict && !k.iReviewed && (d.inPool || k.myAssignment) && <div className="mt-1 flex gap-2">
        <Input aria-label="Conflict reason" placeholder="Declare a conflict (reason)" className="h-8 w-56" value={cf} onChange={(e) => setCf(e.target.value)} />
        <Button size="sm" variant="ghost" disabled={cf.length < 5} onClick={() => act({ action: 'declare', packageId: k.id, reason: cf }, 'Conflict declared; you are off this package.')}>Declare</Button></div>}
      {d.role && open && <div className="mt-1 flex flex-wrap gap-2">
        <select aria-label="Reviewer" className={sel} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Assign reviewer…</option>
          {d.pool.filter((p: any) => !k.assigned.some((x: any) => x.id === p.id) && !k.conflicted.includes(p.id)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <Button size="sm" variant="outline" disabled={!who} onClick={() => act({ action: 'assign', packageId: k.id, reviewerId: who }, 'Assigned.')}>Assign</Button></div>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {(d.role && (open || k.state === 'validated')) || (k.mine && k.state === 'not_validated' && !k.appealed) ? <Input aria-label="Note" placeholder={k.mine && k.state === 'not_validated' ? 'Grounds for appeal' : 'Decision note'} className="h-8 w-60" value={note} onChange={(e) => setNote(e.target.value)} /> : null}
        {d.role && open && <Button size="sm" onClick={() => step('close_review', 'Review closed.')}>{k.state === 'appealed' ? 'Decide appeal' : 'Close review'}</Button>}
        {d.role === 'chair' && k.state === 'validated' && !k.mine && <Button size="sm" onClick={() => step('recommend', 'Recommended to the registrar.')}>Recommend credential</Button>}
        {k.mine && k.state === 'not_validated' && !k.appealed && <Button size="sm" variant="outline" disabled={note.length < 20} onClick={() => step('appeal', 'Appeal filed.')}>Appeal</Button>}
        {(k.mine || d.role) && !['recommended', 'closed'].includes(k.state) && <Button size="sm" variant="ghost" onClick={() => step('close', 'Closed.')}>Close</Button>}
      </div>
    </div>
  );
}

function Body({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [rb, setRb] = useState({ name: '', criteria: '' });
  const [pk, setPk] = useState({ title: '', credential: '', rubricId: '', summary: '' });
  const [rvE, setRvE] = useState('');
  const [mem, setMem] = useState({ email: '', role: 'member' });
  const adopted = d.rubrics.filter((r: any) => r.state === 'adopted');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Evidence packages">
        {!d.packages.length ? <Empty>No packages you can see.</Empty> : d.packages.map((k: any) => <Pkg key={k.id} k={k} d={d} act={act} />)}
        <p className="mt-3 text-xs font-medium">Submit a program evidence package</p>
        <p className="text-xs text-muted-foreground">Program-level evidence only; do not include individual student records.</p>
        <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Title" placeholder="Title" className="w-44" value={pk.title} onChange={(e) => setPk({ ...pk, title: e.target.value })} />
          <Input aria-label="Credential" placeholder="Credential" className="w-36" value={pk.credential} onChange={(e) => setPk({ ...pk, credential: e.target.value })} />
          <select aria-label="Rubric" className={sel} value={pk.rubricId} onChange={(e) => setPk({ ...pk, rubricId: e.target.value })}><option value="">Rubric…</option>{adopted.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <Textarea aria-label="Evidence summary" placeholder="Evidence summary mapped to the rubric" rows={3} className="mt-1" value={pk.summary} onChange={(e) => setPk({ ...pk, summary: e.target.value })} />
        <Button size="sm" className="mt-1" disabled={pk.title.length < 3 || pk.credential.length < 2 || !pk.rubricId || pk.summary.length < 20} onClick={async () => { if (await act({ action: 'submit', ...pk, rubricId: Number(pk.rubricId) }, 'Submitted to the council.')) setPk({ title: '', credential: '', rubricId: '', summary: '' }); }}>Submit</Button>
      </Panel>
      <Panel title="Rubrics">
        {!d.rubrics.length ? <Empty>No rubrics yet.</Empty> : d.rubrics.map((r: any) => <div key={r.id} className="border-b border-border py-1 text-sm">
          <p><span className="font-medium">{r.name}</span> <Status value={r.state} /></p><p className="whitespace-pre-wrap text-xs">{r.criteria}</p>
          <p className="text-xs text-muted-foreground">Drafted by {r.author}{r.adoptedBy ? ` · adopted by ${r.adoptedBy}` : ''}</p>
          {d.role && r.state === 'draft' && (r.mine ? <span className="text-xs text-muted-foreground">Waiting for another member to adopt.</span> : <Button size="sm" variant="outline" onClick={() => act({ action: 'rubricStep', id: r.id, step: 'adopt', expectedVersion: r.version }, 'Adopted.')}>Adopt</Button>)}
          {d.role && r.state === 'adopted' && <Button size="sm" variant="ghost" onClick={() => act({ action: 'rubricStep', id: r.id, step: 'retire', expectedVersion: r.version }, 'Retired.')}>Retire</Button>}
        </div>)}
        {d.role && <div className="mt-2 space-y-1"><Input aria-label="Rubric name" placeholder="Rubric name" value={rb.name} onChange={(e) => setRb({ ...rb, name: e.target.value })} />
          <Textarea aria-label="Criteria" placeholder="Criteria and performance levels" rows={3} value={rb.criteria} onChange={(e) => setRb({ ...rb, criteria: e.target.value })} />
          <Button size="sm" disabled={rb.name.length < 3 || rb.criteria.length < 20} onClick={async () => { if (await act({ action: 'rubric', ...rb }, 'Draft saved; another member adopts it.')) setRb({ name: '', criteria: '' }); }}>Save draft</Button></div>}
      </Panel>
      {d.role && <Panel title="Reviewer pool">
        <p className="text-xs">{d.pool.length ? d.pool.map((p: any) => p.name).join(', ') : 'No reviewers yet.'}</p>
        <div className="mt-1 flex gap-2"><Input aria-label="Reviewer email" placeholder="Email" className="w-56" value={rvE} onChange={(e) => setRvE(e.target.value)} />
          <Button size="sm" disabled={!rvE.includes('@')} onClick={() => act({ action: 'reviewer', email: rvE, on: true }, 'Added to the pool.')}>Add</Button>
          <Button size="sm" variant="outline" disabled={!rvE.includes('@')} onClick={() => act({ action: 'reviewer', email: rvE, on: false }, 'Removed from the pool.')}>Remove</Button></div>
      </Panel>}
      {d.isAdmin && <Panel title="Council membership (administrators)">
        <div className="flex flex-wrap gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={mem.email} onChange={(e) => setMem({ ...mem, email: e.target.value })} />
          <select aria-label="Role" className={sel} value={mem.role} onChange={(e) => setMem({ ...mem, role: e.target.value })}><option value="member">Member</option><option value="chair">Chair</option><option value="none">Remove</option></select>
          <Button size="sm" disabled={!mem.email.includes('@')} onClick={() => act({ action: 'member', ...mem }, 'Saved.')}>Save</Button></div>
        {d.members.map((m: any, i: number) => <p key={i} className="text-xs">{m.name} · {m.role}</p>)}
      </Panel>}
    </div>
  );
}

export default function Council() {
  const state = useLoad(() => council({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Staff" title="Portfolio council" sub="Rubrics, reviewers, conflicts, validation, credential recommendations and appeals for program evidence packages. Recommendations go to the registrar; nothing is awarded here." />
      <Loadable state={state}>{(d: any) => <Body d={d} act={act} />}</Loadable>
    </div>
  );
}
