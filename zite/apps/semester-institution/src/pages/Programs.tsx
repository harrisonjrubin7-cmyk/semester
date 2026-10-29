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

type Program = { id: number; name: string; summary: string; entryTerms: string; accepting: boolean; state: string; version: number; publishedAt: string | null; annualCostCents: number | null; durationText: string; format: string; requirements: string };
type Draft = { id: number | null; name: string; summary: string; entryTerms: string; accepting: boolean; expectedVersion: number; annualCost: string; durationText: string; format: string; requirements: string };
const blank: Draft = { id: null, name: '', summary: '', entryTerms: '', accepting: true, expectedVersion: 0, annualCost: '', durationText: '', format: '', requirements: '' };
const FORMATS = ['', 'On campus', 'Online', 'Hybrid'];

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
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label htmlFor="pp-cost">Published annual cost (USD)</Label><Input id="pp-cost" inputMode="decimal" value={edit.annualCost} onChange={(e) => setEdit({ ...edit, annualCost: e.target.value })} placeholder="e.g. 18500 — blank publishes no cost" /></div>
            <div><Label htmlFor="pp-dur">Duration</Label><Input id="pp-dur" value={edit.durationText} onChange={(e) => setEdit({ ...edit, durationText: e.target.value })} maxLength={120} placeholder="e.g. 4 years, full-time" /></div>
            <div><Label htmlFor="pp-fmt">Format</Label><select id="pp-fmt" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={edit.format} onChange={(e) => setEdit({ ...edit, format: e.target.value })}>{FORMATS.map((f) => <option key={f} value={f}>{f || 'Not stated'}</option>)}</select></div>
          </div>
          <div><Label htmlFor="pp-req">Entry requirements</Label><Textarea id="pp-req" value={edit.requirements} onChange={(e) => setEdit({ ...edit, requirements: e.target.value })} maxLength={1000} placeholder="What an applicant needs: prior study, grades, tests, portfolio…" /></div>
          <p className="text-xs text-muted-foreground">Cost, duration, format and requirements appear on the public listing and in applicants' comparisons, labelled as published by your institution. Publish only figures you can stand behind.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={edit.accepting} onChange={(e) => setEdit({ ...edit, accepting: e.target.checked })} />Accepting applications</label>
          <div className="flex gap-2"><Button size="sm" disabled={edit.annualCost.trim() !== '' && !(Number(edit.annualCost) >= 0)} onClick={() => run(() => publicPrograms({ action: 'save', id: edit.id, name: edit.name, summary: edit.summary, entryTerms: edit.entryTerms, accepting: edit.accepting, expectedVersion: edit.expectedVersion, annualCostCents: edit.annualCost.trim() === '' ? null : Math.round(Number(edit.annualCost) * 100), durationText: edit.durationText, format: edit.format as '' | 'On campus' | 'Online' | 'Hybrid', requirements: edit.requirements }), 'Saved as a draft.')}>Save draft</Button><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      {q.loading && !q.data ? <LoadingBlock /> : q.error ? <DeniedOrError message={q.error} onRetry={q.reload} /> : !q.data?.programs.length ? <Empty title="No public programs yet." hint="Write one, then publish it." /> : (
        <ul className="space-y-2">{q.data.programs.map((p) => (
          <li key={p.id} className="rounded-md border border-border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-medium">{p.name}</span> <Badge variant="outline" className="ml-2">{p.state}</Badge>{!p.accepting && <span className="ml-2 text-muted-foreground">not accepting</span>}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, summary: p.summary, entryTerms: p.entryTerms, accepting: p.accepting, expectedVersion: p.version, annualCost: p.annualCostCents == null ? '' : String(p.annualCostCents / 100), durationText: p.durationText, format: p.format, requirements: p.requirements })}>Edit</Button>
                {p.state !== 'Published' ? <Button size="sm" onClick={() => run(() => publicPrograms({ action: 'publish', id: p.id, expectedVersion: p.version }), 'Published on the public site.')}>Publish</Button>
                  : <Button size="sm" variant="outline" onClick={() => run(() => publicPrograms({ action: 'withdraw', id: p.id, expectedVersion: p.version }), 'Withdrawn from the public site.')}>Withdraw</Button>}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{p.summary}</p>
            {(p.annualCostCents != null || p.durationText || p.format) && <p className="mt-1 text-xs text-muted-foreground">{[p.annualCostCents != null ? `$${(p.annualCostCents / 100).toLocaleString('en-US')} / year` : null, p.durationText || null, p.format || null].filter(Boolean).join(' · ')}</p>}
          </li>
        ))}</ul>
      )}
    </>
  );
}
