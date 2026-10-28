import { useState } from 'react';
import { toast } from 'sonner';
import { admissions } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt, Status, errMsg } from '../components/kit';

type Review = { reviewer: string; mine: boolean; state: string; version: number; decision: string | null; internalNote: string; message: string };
type Item = { id: string; applicant: string; applicantId: string; program: string; entryTerm: string; status: string; statement: string; documents: { fileId: string; filename: string }[]; recommendations: { id: number; name: string; state: string; waived: boolean }[]; submittedAt: string | null; review: Review | null };
const DECISIONS = ['Admitted', 'Waitlisted', 'Declined'] as const;
async function openDoc(id: string, fileId: string, requestId?: number) {
  try {
    const r = await (requestId ? admissions({ action: 'openLetter', id, requestId }) : admissions({ action: 'openDocument', id, fileId })) as { mime: string; base64: string };
    const bin = atob(r.base64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([u8], { type: r.mime })), '_blank', 'noopener');
  } catch (e) { toast(`! ${errMsg(e)}`); }
}

function Decide({ item, isAdmin, reviewers, done }: { item: Item; isAdmin: boolean; reviewers: { id: string; name: string }[]; done: () => void }) {
  const r = item.review;
  const [reviewer, setReviewer] = useState('');
  const [decision, setDecision] = useState<typeof DECISIONS[number]>((r?.decision as typeof DECISIONS[number]) ?? 'Admitted');
  const [internal, setInternal] = useState(r?.internalNote ?? '');
  const [message, setMessage] = useState(r?.message ?? '');
  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); toast(ok); done(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const canDraft = !!r && r.state !== 'Released' && (r.mine || isAdmin);
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3 text-sm">
      {isAdmin && r?.state !== 'Released' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">Reviewer
            <select className="rounded border border-border bg-background px-2 py-1.5" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option value="">Choose…</option>{reviewers.filter((x) => x.id !== item.applicantId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select></label>
          <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => run(() => admissions({ action: 'assign', id: item.id, reviewerId: reviewer }), 'Reviewer assigned. The applicant sees “Under review”.')}>{r ? 'Reassign' : 'Assign'}</Button>
        </div>
      )}
      {r ? <p className="text-muted-foreground">Reviewer: {r.reviewer} · {r.state}{r.decision ? ` · draft: ${r.decision}` : ''}</p> : <p className="text-muted-foreground">No reviewer assigned yet.</p>}
      {canDraft && <>
        <fieldset className="flex flex-wrap gap-3"><legend className="sr-only">Decision</legend>
          {DECISIONS.map((d) => <label key={d} className="flex items-center gap-1"><input type="radio" name={`d-${item.id}`} checked={decision === d} onChange={() => setDecision(d)} />{d}</label>)}</fieldset>
        <label className="grid gap-1">Internal note (staff only, never shown to the applicant)<Textarea value={internal} onChange={(e) => setInternal(e.target.value)} /></label>
        <label className="grid gap-1">Message to the applicant<Textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => run(() => admissions({ action: 'draft', id: item.id, decision, internalNote: internal, message, expectedVersion: r!.version }), 'Draft saved. The applicant does not see it yet.')}>Save draft</Button>
          {r!.state === 'Drafted' && <Button size="sm" onClick={() => run(() => admissions({ action: 'release', id: item.id, expectedVersion: r!.version }), 'Released. The applicant can now read the decision.')}>Release {r!.decision} to applicant</Button>}
        </div>
        {r!.state === 'Drafted' && <p className="text-xs text-muted-foreground">Release sends the saved draft. Save again first if you changed anything above.</p>}
      </>}
    </div>
  );
}

export default function Admissions() {
  const s = useLoad(() => admissions({ action: 'list' }));
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Staff" title="Admissions" sub="Administrators assign each application to a reviewer. Decisions stay private until released; you can’t review your own." />
      <Loadable state={s}>{(d) => {
        const items: Item[] = d.items; const cur = items.find((i) => i.id === sel) ?? items[0];
        return items.length ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Panel title={`${d.isAdmin ? 'All applications' : 'Assigned to you'} · ${items.length}`}><ul className="divide-y divide-border">{items.map((i) => (
              <li key={i.id}><button onClick={() => setSel(i.id)} className={`flex w-full justify-between py-2.5 text-left text-sm ${cur?.id === i.id ? 'border-l-[3px] border-primary pl-2 font-medium' : ''}`}>
                <span>{i.applicant}<span className="block text-xs text-muted-foreground">{i.program} · {i.entryTerm}</span></span><Status value={i.review?.state === 'Drafted' ? 'Draft decision' : i.status} /></button></li>))}</ul></Panel>
            {cur && <Panel title={cur.applicant}>
              <p className="text-xs text-muted-foreground">{cur.program} · {cur.entryTerm} · Submitted {fmt(cur.submittedAt)}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{cur.statement}</p>
              <div className="mt-3 text-sm">{cur.documents.map((f) => <button key={f.fileId} className="block underline" onClick={() => openDoc(cur.id, f.fileId)}>{f.filename}</button>)}</div>
              {cur.recommendations.length > 0 && <div className="mt-3 text-sm"><p className="font-medium">Recommendations</p>{cur.recommendations.map((r) => <p key={r.id}>{r.name} · {r.state}{r.waived ? ' · applicant waived access' : ''}{r.state === 'Submitted' && <button className="ml-2 underline" onClick={() => openDoc(cur.id, '', r.id)}>Open letter</button>}</p>)}</div>}
              <Decide key={`${cur.id}-${cur.review?.version ?? 0}`} item={cur} isAdmin={d.isAdmin} reviewers={d.reviewers} done={s.reload} />
            </Panel>}
          </div>
        ) : <Empty>{d.isAdmin ? 'No submitted applications yet.' : 'No applications are assigned to you.'}</Empty>;
      }}</Loadable>
    </>
  );
}
