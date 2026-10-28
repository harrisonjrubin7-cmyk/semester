import { useState } from 'react';
import { publicPrograms } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { toast } from 'sonner';
import { useLoad, errMsg } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

type Program = { id: number; name: string; summary: string; entryTerms: string; accepting: boolean; state: string; version: number; publishedAt: string | null };
type Draft = { id: number | null; name: string; summary: string; entryTerms: string; accepting: boolean; expectedVersion: number };
const blank: Draft = { id: null, name: '', summary: '', entryTerms: '', accepting: true, expectedVersion: 0 };

export default function Programs() {
  const q = useLoad(() => publicPrograms({ action: 'list' }) as Promise<{ programs: Program[] }>);
  const [edit, setEdit] = useState<Draft | null>(null);
  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); toast.success(ok); setEdit(null); q.reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Public programs" sub="What the public Semester site lists for your institution. Nothing appears until you publish it, and editing takes it back to draft."
        action={!edit && <Button size="sm" onClick={() => setEdit(blank)}>New program</Button>} />
      {edit && (
        <div className="mb-6 space-y-3 rounded-md border border-border bg-card p-4 text-sm">
          <div><Label htmlFor="pp-name">Program name</Label><Input id="pp-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={120} /></div>
          <div><Label htmlFor="pp-sum">Public summary</Label><Textarea id="pp-sum" value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} maxLength={1000} /></div>
          <div><Label htmlFor="pp-terms">Entry terms</Label><Input id="pp-terms" value={edit.entryTerms} onChange={(e) => setEdit({ ...edit, entryTerms: e.target.value })} maxLength={200} placeholder="Fall 2027, Spring 2028" /></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={edit.accepting} onChange={(e) => setEdit({ ...edit, accepting: e.target.checked })} />Accepting applications</label>
          <div className="flex gap-2"><Button size="sm" onClick={() => run(() => publicPrograms({ action: 'save', ...edit }), 'Saved as a draft.')}>Save draft</Button><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : !q.data?.programs.length ? <Empty title="No public programs yet." hint="Write one, then publish it." /> : (
        <ul className="space-y-2">{q.data.programs.map((p) => (
          <li key={p.id} className="rounded-md border border-border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-medium">{p.name}</span> <Badge variant="outline" className="ml-2">{p.state}</Badge>{!p.accepting && <span className="ml-2 text-muted-foreground">not accepting</span>}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, summary: p.summary, entryTerms: p.entryTerms, accepting: p.accepting, expectedVersion: p.version })}>Edit</Button>
                {p.state !== 'Published' ? <Button size="sm" onClick={() => run(() => publicPrograms({ action: 'publish', id: p.id, expectedVersion: p.version }), 'Published on the public site.')}>Publish</Button>
                  : <Button size="sm" variant="outline" onClick={() => run(() => publicPrograms({ action: 'withdraw', id: p.id, expectedVersion: p.version }), 'Withdrawn from the public site.')}>Withdraw</Button>}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{p.summary}</p>
          </li>
        ))}</ul>
      )}
    </>
  );
}
