import { useState } from 'react';
import { toast } from 'sonner';
import { design } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { reviewStatus } from '../lib/designRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Request({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const latest = r.drafts[r.drafts.length - 1];
  const [body, setBody] = useState(latest?.body ?? '');
  const [note, setNote] = useState('');
  const [obj, setObj] = useState({ code: '', statement: '', level: 'understand', evidence: '' });
  const [findings, setFindings] = useState('');
  const [impact, setImpact] = useState('');
  const editor = r.instructor || r.mineAsDesigner;
  const open = !['requested', 'released', 'closed'].includes(r.state);
  const st = latest ? reviewStatus(r.reviews.map((v: any) => ({ ...v, at: v.at ?? '' })), latest.id) : null;
  const canReview = d.designer && latest && !latest.authorIsMe && ['building', 'in_review'].includes(r.state);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground"><Status value={r.state} /> {r.stage} · {r.kind === 'revision' ? 'Revision of published material' : 'New material'} · requested by {r.requestedBy}{r.designer ? ` · designer ${r.designer}` : ''}</p>
      <p className="whitespace-pre-wrap text-xs">{r.scope}</p>
      {r.state === 'requested' && d.designer && <Button size="sm" onClick={() => act(() => design({ action: 'claim', requestId: r.id, expectedVersion: r.version }), 'You took this request.')}>Take this request</Button>}
      <div><p className="text-xs font-medium">Learning objectives</p>
        {r.objectives.length ? <ul className="text-xs">{r.objectives.map((o: any) => <li key={o.code}><b>{o.code}</b> ({o.level}) {o.statement}{o.evidence ? ` — evidence: ${o.evidence}` : ''}</li>)}</ul> : <Empty>No objectives mapped yet.</Empty>}
        {editor && open && <div className="mt-1 grid gap-2 sm:grid-cols-4">
          <Input aria-label="Objective code" placeholder="LO1" value={obj.code} onChange={(e) => setObj({ ...obj, code: e.target.value })} />
          <Input aria-label="Objective" placeholder="Students will be able to…" className="sm:col-span-2" value={obj.statement} onChange={(e) => setObj({ ...obj, statement: e.target.value })} />
          <select aria-label="Level" className={sel} value={obj.level} onChange={(e) => setObj({ ...obj, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <Input aria-label="Evidence" placeholder="How it is assessed" className="sm:col-span-3" value={obj.evidence} onChange={(e) => setObj({ ...obj, evidence: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!obj.code || obj.statement.trim().length < 10} onClick={async () => { if (await act(() => design({ action: 'objective', requestId: r.id, ...obj, level: obj.level as never }), 'Objective saved.')) setObj({ code: '', statement: '', level: 'understand', evidence: '' }); }}>Save objective</Button>
        </div>}
      </div>
      <div><p className="text-xs font-medium">Drafts ({r.drafts.length})</p>
        <ul className="text-xs">{r.drafts.map((x: any) => <li key={x.id}>Rev {x.rev} · {x.author} · {fmt(x.at)}{x.note ? ` — ${x.note}` : ''}{x.id === r.approvedDraftId ? ' · approved' : ''}</li>)}</ul>
        {latest && <details className="mt-1"><summary className="cursor-pointer text-xs">Read revision {latest.rev}</summary><pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border p-2 text-xs">{latest.body}</pre></details>}
        {editor && open && <div className="mt-2 space-y-2">
          <Textarea aria-label="Draft" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2"><Input aria-label="Change note" placeholder="What changed" className="max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={body.trim().length < 20} onClick={async () => { if (await act(() => design({ action: 'draft', requestId: r.id, body, note }), r.state === 'approved' ? 'Saved. The earlier approval no longer applies.' : 'Draft saved.')) setNote(''); }}>Save new revision</Button></div>
          <p className="text-xs text-muted-foreground">Drafts never change what students see. Publishing happens only after reviews and the instructor's approval{r.state === 'approved' ? '; saving now cancels the current approval' : ''}.</p>
        </div>}
      </div>
      {latest && <div><p className="text-xs font-medium">Reviews of revision {latest.rev}: accessibility {st?.accessibility} · quality {st?.quality}</p>
        {latest.autoIssues.length > 0 && <ul className="text-xs text-muted-foreground">{latest.autoIssues.map((i: string, k: number) => <li key={k}>Automated check — {i}</li>)}</ul>}
        <ul className="text-xs">{r.reviews.filter((v: any) => v.draftId === latest.id).map((v: any, k: number) => <li key={k}>{v.kind}: {v.passed ? 'passed' : 'changes requested'} by {v.reviewer}{v.findings ? ` — ${v.findings}` : ''}</li>)}</ul>
        {canReview && <div className="mt-1 flex flex-wrap gap-2">
          <Input aria-label="Findings" placeholder="Findings (needed to request changes)" className="max-w-md" value={findings} onChange={(e) => setFindings(e.target.value)} />
          {(['accessibility', 'quality'] as const).map((k) => <span key={k} className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => act(() => design({ action: 'review', requestId: r.id, draftId: latest.id, kind: k, passed: true, findings }), `${k} passed.`)}>Pass {k}</Button>
            <Button size="sm" variant="ghost" disabled={findings.trim().length < 5} onClick={() => act(() => design({ action: 'review', requestId: r.id, draftId: latest.id, kind: k, passed: false, findings }), 'Changes requested.')}>Changes ({k})</Button></span>)}
        </div>}
      </div>}
      {r.instructor && latest && ['in_review', 'building'].includes(r.state) && st?.accessibility === 'passed' && st?.quality === 'passed' &&
        <Button size="sm" onClick={() => act(() => design({ action: 'approve', requestId: r.id, draftId: latest.id, hash: latest.sha256, expectedVersion: r.version }), 'Approved for publication.')}>Approve revision {latest.rev} for publication</Button>}
      {r.instructor && r.state === 'approved' && <div className="space-y-2 rounded border border-border p-2">
        {r.kind === 'revision' && <Textarea aria-label="Impact" placeholder="Impact on students already using the current version (required for revisions)" value={impact} onChange={(e) => setImpact(e.target.value)} />}
        <Button size="sm" disabled={r.kind === 'revision' && impact.trim().length < 10} onClick={() => act(() => design({ action: 'release', requestId: r.id, impact, expectedVersion: r.version }), 'Published to the course. Earlier versions stay in history.')}>Publish to the course</Button>
      </div>}
      {r.state === 'released' && <p className="text-xs">Published as syllabus version {r.releasedVersion}{r.impactNote ? ` — ${r.impactNote}` : ''}.</p>}
    </div>
  );
}

export default function Design() {
  const s = useLoad(() => design({ action: 'get' }));
  const act = useAct(s.reload);
  const [n, setN] = useState({ sectionId: '', scope: '' });
  const [em, setEm] = useState('');
  return (
    <>
      <PageHeader eyebrow="Teaching" title="Instructional design" sub="Request design help, map objectives, draft and review course material, then publish it to the course yourself. Drafts never change what students see." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.requests.map((r: any) => <Panel key={r.id} title={`${r.section} · ${r.kind === 'revision' ? 'revision' : 'design'} request`}><Request r={r} d={d} reload={s.reload} /></Panel>)}
          {!d.requests.length && <Panel><Empty>No design work yet.</Empty></Panel>}
          {d.sections.length > 0 && <Panel title="Request design work">
            <div className="grid gap-2 text-sm">
              <select aria-label="Section" className={sel} value={n.sectionId} onChange={(e) => setN({ ...n, sectionId: e.target.value })}><option value="">Section you teach…</option>{d.sections.map((x: any) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
              <Textarea aria-label="Scope" placeholder="What you need: modules, objectives, assessments, accessibility fixes…" value={n.scope} onChange={(e) => setN({ ...n, scope: e.target.value })} />
              <div><Button size="sm" disabled={!n.sectionId || n.scope.trim().length < 10} onClick={async () => { if (await act(() => design({ action: 'request', ...n }), 'Requested. A designer will pick it up.')) setN({ sectionId: '', scope: '' }); }}>Send request</Button></div>
            </div>
          </Panel>}
          {d.isAdmin && <Panel title="Instructional designers">
            <p className="text-xs">{d.designers.join(', ') || 'Nobody yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={em} onChange={(e) => setEm(e.target.value)} />
              <Button size="sm" disabled={!em.includes('@')} onClick={() => act(() => design({ action: 'setDesigner', email: em, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!em.includes('@')} onClick={() => act(() => design({ action: 'setDesigner', email: em, on: false }), 'Revoked.')}>Revoke</Button></div>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
