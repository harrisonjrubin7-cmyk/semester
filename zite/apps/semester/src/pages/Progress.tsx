import { useState } from 'react';
import { toast } from 'sonner';
import { progress } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Progress as Bar } from '@project/components/ui/progress';
import { PageHeader, Panel, Empty, SourceTag, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';

type Req = { id: string; name: string; required: number; earned: number; pending: number };
type Ach = { id: string; title: string; verification: string; verifiedBy: string; verifiedOn: string | null; evidence: string | null };
const VG: Record<string, string> = { 'Institution Verified': '◆', 'Needs Review': '…', 'Student Entered': '○' };

export default function Progress() {
  const state = useLoad(() => progress({ action: 'get' }));
  const [title, setTitle] = useState('');
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const add = () => act(async () => {
    await progress({ action: 'addAchievement', title });
    setTitle('');
  }, 'Added');

  return (
    <>
      <PageHeader eyebrow="Progress" title="How am I doing?" sub="Your degree path from released grades only." />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel>
              <div className="border-l-2 border-border pl-3"><p className="font-display text-2xl">You need {Math.max(0, d.totalReq - d.totalEarned)} more requirement credits.</p><p className="flex items-center gap-2 text-xs text-muted-foreground"><SourceTag source="Sample" />Degree audit · BS Computer Science</p></div>
              <Bar className="mt-4 h-2" value={d.totalReq ? (d.totalEarned / d.totalReq) * 100 : 0} />
              <div className="mt-4 space-y-2 text-sm">{d.requirements.map((r: Req) => (
                <p key={r.id}>{r.earned >= r.required ? '✓' : r.earned + r.pending > 0 ? '…' : '○'} {r.name} · {r.earned} of {r.required}{r.pending > 0 && <span className="text-muted-foreground"> · {r.pending} in progress</span>}</p>))}</div>
              <p className="mt-4 text-sm">Estimated GPA: <strong>{d.gpa ?? '—'}</strong> <span className="text-xs text-muted-foreground">· Estimated from released grades</span></p>
            </Panel>
            <Panel title="Released grades">
              {d.grades.length === 0 ? <Empty>No released grades yet.</Empty> : d.grades.map((g: { id: string; code: string; title: string; grade: string; term: string; source: string }) => (
                <div key={g.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"><span>{g.code} · {g.title} <span className="text-muted-foreground">· {g.term}</span></span><span className="flex items-center gap-2"><strong className="font-mono">{g.grade}</strong><SourceTag source={g.source} /></span></div>))}
            </Panel>
            {d.isStaff && (
              <Panel title="Achievements to verify">
                {d.review.length === 0 ? <Empty>Nothing waiting for review.</Empty> : (d.review as { id: string; title: string; owner: string; evidence: string | null }[]).map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"><span>{r.title} · {r.owner} {r.evidence && <a href={r.evidence} target="_blank" rel="noreferrer" className="text-primary underline">evidence</a>}</span><Button size="sm" onClick={() => act(() => progress({ action: 'verify', id: r.id }), 'Verified')}>Verify</Button></div>))}
              </Panel>)}
          </div>
          <Panel title="Achievements">
            {d.achievements.length === 0 ? <Empty>None yet.</Empty> : d.achievements.map((a: Ach) => (
              <div key={a.id} className="border-b border-border py-2 text-sm last:border-0">
                <p>{a.title}</p>
                <p className="text-xs text-muted-foreground">{VG[a.verification]} {a.verification}{a.verifiedBy && ` · ${a.verifiedBy}`}{a.verifiedOn && ` · ${fmtDay(a.verifiedOn)}`}</p>
              </div>))}
            <div className="mt-4 space-y-2">
              <Input placeholder="Add an achievement" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button className="w-full" variant="outline" disabled={title.trim().length < 2} onClick={add}>Add</Button>
              <p className="text-xs text-muted-foreground">Evidence uploads are turned off until private storage is in place. Entries stay marked Student Entered.</p>
            </div>
          </Panel>
        </div>
      )}</Loadable>
    </>
  );
}
