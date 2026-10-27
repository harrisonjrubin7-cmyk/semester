import { useState } from 'react';
import { toast } from 'sonner';
import { recruiting } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Applicant({ x, s, d, reload }: { x: any; s: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [ev, setEv] = useState({ score: x.myEvaluation?.score ?? 3, notes: x.myEvaluation?.notes ?? '' });
  const [ref, setRef] = useState({ referee: '', body: '' });
  const [why, setWhy] = useState('');
  const hiring = d.roles.includes('hiring');
  return (
    <li className="rounded border border-border p-2 text-xs">
      <p className="text-sm font-medium">{x.applicant} <Status value={x.state} />{x.recusals ? <span className="text-muted-foreground"> · {x.recusals} recusal{x.recusals > 1 ? 's' : ''}</span> : null}</p>
      <p className="whitespace-pre-wrap">{x.statement}</p>
      {x.recused ? <p className="mt-1 text-muted-foreground">You are recused from this applicant: references and evaluations are hidden from you.</p> : <>
        {x.references.map((f: any, i: number) => <p key={i} className="mt-1"><b>Confidential reference</b> — {f.referee}: {f.body}</p>)}
        {x.evaluations.map((e: any, i: number) => <p key={i}>Evaluation by {e.member}: {e.score}/5 — {e.notes}</p>)}
        {s.onCommittee && x.state === 'applied' && ['open', 'selection_pending'].includes(s.state) && <div className="mt-1 flex flex-wrap gap-2">
          <select aria-label="Score" className={sel} value={ev.score} onChange={(e) => setEv({ ...ev, score: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <Input aria-label="Evidence for score" placeholder="Evidence for your score" className="h-8 max-w-md" value={ev.notes} onChange={(e) => setEv({ ...ev, notes: e.target.value })} />
          <Button size="sm" variant="outline" disabled={ev.notes.trim().length < 10} onClick={() => act(() => recruiting({ action: 'evaluate', appId: x.id, score: ev.score, notes: ev.notes }), 'Evaluation saved.')}>Save evaluation</Button>
          <Input aria-label="Conflict" placeholder="Conflict of interest (recuses you)" className="h-8 max-w-xs" value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button size="sm" variant="ghost" disabled={why.trim().length < 5} onClick={() => act(() => recruiting({ action: 'conflict', appId: x.id, reason: why }), 'Recused.')}>Declare conflict</Button>
        </div>}
        {(s.chairIsMe || hiring) && <div className="mt-1 flex flex-wrap gap-2">
          <Input aria-label="Referee" placeholder="Referee" className="h-8 max-w-[12rem]" value={ref.referee} onChange={(e) => setRef({ ...ref, referee: e.target.value })} />
          <Input aria-label="Reference text" placeholder="Reference as received (confidential)" className="h-8 max-w-md" value={ref.body} onChange={(e) => setRef({ ...ref, body: e.target.value })} />
          <Button size="sm" variant="ghost" disabled={ref.referee.length < 3 || ref.body.length < 10} onClick={async () => { if (await act(() => recruiting({ action: 'reference', appId: x.id, ...ref }), 'Reference filed.')) setRef({ referee: '', body: '' }); }}>File reference</Button></div>}
        {s.chairIsMe && s.state === 'open' && x.state === 'applied' && <Button size="sm" className="mt-1" onClick={() => act(() => recruiting({ action: 'select', reqId: s.id, appId: x.id, step: 'propose', expectedVersion: s.version }), 'Selection sent for approval.')}>Propose as selected candidate</Button>}
      </>}
    </li>
  );
}

function Search({ s, d, reload }: { s: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const hiring = d.roles.includes('hiring'), appointment = d.roles.includes('appointment');
  const [stmt, setStmt] = useState('');
  const [cm, setCm] = useState({ email: '', chair: false });
  const [terms, setTerms] = useState('');
  const [why, setWhy] = useState('');
  const latestOffer = s.offers[s.offers.length - 1];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground"><Status value={s.state} /> {s.institution}{s.positionCode ? ` · position ${s.positionCode}` : ''}{s.requestedBy ? ` · requested by ${s.requestedBy}` : ''}{s.approvedBy ? ` · approved by ${s.approvedBy}` : ''}</p>
      {s.description && <p className="whitespace-pre-wrap text-xs">{s.description}</p>}
      {s.justification && <p className="text-xs">Justification: {s.justification}</p>}
      {s.closeReason && <p className="text-xs">Closed: {s.closeReason}</p>}
      {s.myApplication && <div className="rounded border border-border p-2 text-xs">
        <p>Your application: <Status value={s.myApplication.state} /></p>
        {s.myApplication.offer && <div className="mt-1 space-y-1"><p className="font-medium">Offer ({s.myApplication.offer.state})</p><pre className="whitespace-pre-wrap">{s.myApplication.offer.terms}</pre>
          {s.myApplication.offer.state === 'approved' && <div className="flex gap-2"><Button size="sm" onClick={() => act(() => recruiting({ action: 'respond', offerId: s.myApplication.offer.id, hash: s.myApplication.offer.sha256, accept: true }), 'Accepted. HR will be in touch.')}>Accept these terms</Button>
            <Button size="sm" variant="outline" onClick={() => act(() => recruiting({ action: 'respond', offerId: s.myApplication.offer.id, hash: s.myApplication.offer.sha256, accept: false }), 'Declined.')}>Decline</Button></div>}</div>}
        {['applied', 'selected'].includes(s.myApplication.state) && <Button size="sm" variant="ghost" onClick={() => act(() => recruiting({ action: 'withdraw', appId: s.myApplication.id }), 'Withdrawn.')}>Withdraw application</Button>}
      </div>}
      {s.state === 'open' && !s.myApplication && !s.onCommittee && <div className="space-y-2">
        <Textarea aria-label="Application statement" placeholder="Why you are a fit (at least 20 characters)" value={stmt} onChange={(e) => setStmt(e.target.value)} />
        <Button size="sm" disabled={stmt.trim().length < 20} onClick={async () => { if (await act(() => recruiting({ action: 'apply', reqId: s.id, statement: stmt }), 'Applied.')) setStmt(''); }}>Apply</Button></div>}
      {s.inside && <>
        <p className="text-xs">Committee: {s.committee.map((c: any) => `${c.name}${c.chair ? ' (chair)' : ''}`).join(', ') || 'none yet'}</p>
        {hiring && s.state === 'pending' && !s.requestedByMe && <div className="flex gap-2"><Button size="sm" onClick={() => act(() => recruiting({ action: 'reqStep', reqId: s.id, step: 'approve', expectedVersion: s.version }), 'Approved.')}>Approve requisition</Button>
          <Button size="sm" variant="outline" onClick={() => act(() => recruiting({ action: 'reqStep', reqId: s.id, step: 'reject', expectedVersion: s.version }), 'Rejected.')}>Reject</Button></div>}
        {hiring && ['approved', 'open', 'selection_pending', 'offer'].includes(s.state) && <div className="flex flex-wrap gap-2">
          <Input aria-label="Committee member email" placeholder="Committee member email" className="h-8 max-w-xs" value={cm.email} onChange={(e) => setCm({ ...cm, email: e.target.value })} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cm.chair} onChange={(e) => setCm({ ...cm, chair: e.target.checked })} />Chair</label>
          <Button size="sm" variant="outline" disabled={!cm.email.includes('@')} onClick={() => act(() => recruiting({ action: 'committee', reqId: s.id, email: cm.email, chair: cm.chair, on: true }), 'Added.')}>Add</Button>
          <Button size="sm" variant="ghost" disabled={!cm.email.includes('@')} onClick={() => act(() => recruiting({ action: 'committee', reqId: s.id, email: cm.email, chair: false, on: false }), 'Removed.')}>Remove</Button></div>}
        {(hiring || s.chairIsMe) && s.state === 'approved' && <Button size="sm" onClick={() => act(() => recruiting({ action: 'reqStep', reqId: s.id, step: 'publish', expectedVersion: s.version }), 'Published.')}>Publish search</Button>}
        {s.applications.length > 0 && <ul className="space-y-2">{s.applications.map((x: any) => <Applicant key={x.id} x={x} s={s} d={d} reload={reload} />)}</ul>}
        {hiring && s.state === 'selection_pending' && !s.selectionByMe && <div className="flex gap-2"><Button size="sm" onClick={() => act(() => recruiting({ action: 'select', reqId: s.id, appId: null, step: 'approve', expectedVersion: s.version }), 'Selection approved; draft the offer.')}>Approve selection</Button>
          <Button size="sm" variant="outline" onClick={() => act(() => recruiting({ action: 'select', reqId: s.id, appId: null, step: 'return', expectedVersion: s.version }), 'Returned to the committee.')}>Return to committee</Button></div>}
        {s.state === 'offer' && <div className="space-y-2 rounded border border-border p-2">
          {latestOffer && <><p className="text-xs">Offer revision {latestOffer.rev} · <Status value={latestOffer.state} /> · drafted by {latestOffer.draftedBy}{latestOffer.approvedBy ? ` · approved by ${latestOffer.approvedBy}` : ''}</p><pre className="whitespace-pre-wrap text-xs">{latestOffer.terms}</pre>
            {appointment && latestOffer.state === 'draft' && !latestOffer.draftedByMe && <Button size="sm" onClick={() => act(() => recruiting({ action: 'approveOffer', offerId: latestOffer.id, hash: latestOffer.sha256 }), 'Offer approved and sent.')}>Approve this exact offer</Button>}</>}
          {(hiring || s.chairIsMe) && <><Textarea aria-label="Offer terms" placeholder="Offer terms (any change needs approval again)" value={terms} onChange={(e) => setTerms(e.target.value)} />
            <Button size="sm" variant="outline" disabled={terms.trim().length < 20} onClick={async () => { if (await act(() => recruiting({ action: 'offer', reqId: s.id, terms }), 'New offer version drafted; it needs approval.')) setTerms(''); }}>Save offer version</Button></>}
        </div>}
        {hiring && !['filled', 'closed', 'rejected'].includes(s.state) && <div className="flex flex-wrap gap-2"><Input aria-label="Close reason" placeholder="Reason to close the search" className="h-8 max-w-sm" value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button size="sm" variant="ghost" disabled={why.trim().length < 5} onClick={() => act(() => recruiting({ action: 'reqStep', reqId: s.id, step: 'close', note: why, expectedVersion: s.version }), 'Closed; records kept.')}>Close search</Button></div>}
      </>}
    </div>
  );
}

export default function Recruiting() {
  const s = useLoad(() => recruiting({ action: 'get' }));
  const act = useAct(s.reload);
  const [rq, setRq] = useState({ title: '', description: '', justification: '', positionCode: '' });
  const [st, setSt] = useState({ email: '', role: 'hiring' });
  return (
    <>
      <PageHeader eyebrow="Work" title="Recruiting" sub="Open searches, applications, committees and offers. People decide every step; nothing is ranked or chosen automatically." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.searches.length ? d.searches.map((x: any) => <Panel key={x.id} title={x.title}><Search s={x} d={d} reload={s.reload} /></Panel>) : <Panel><Empty>No open searches.</Empty></Panel>}
          {d.hasInstitution && <Panel title="Request a hire">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Input aria-label="Title" placeholder="Role title" value={rq.title} onChange={(e) => setRq({ ...rq, title: e.target.value })} />
              <Input aria-label="Position code" placeholder="HR position code (optional)" value={rq.positionCode} onChange={(e) => setRq({ ...rq, positionCode: e.target.value })} />
              <Textarea aria-label="Description" placeholder="Public description" className="sm:col-span-2" value={rq.description} onChange={(e) => setRq({ ...rq, description: e.target.value })} />
              <Textarea aria-label="Justification" placeholder="Why this hire is needed (internal)" className="sm:col-span-2" value={rq.justification} onChange={(e) => setRq({ ...rq, justification: e.target.value })} />
              <div><Button size="sm" disabled={rq.title.length < 3 || rq.justification.trim().length < 10} onClick={async () => { if (await act(() => recruiting({ action: 'requisition', ...rq }), 'Requested. A hiring authority decides.')) setRq({ title: '', description: '', justification: '', positionCode: '' }); }}>Submit requisition</Button></div>
            </div>
          </Panel>}
          {d.isAdmin && <Panel title="Hiring and appointment authorities">
            <p className="text-xs">{d.team.map((t: any) => `${t.name} (${t.role})`).join(', ') || 'Nobody yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <select aria-label="Authority" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}><option value="hiring">Hiring authority</option><option value="appointment">Appointment authority</option></select>
              <Button size="sm" disabled={!st.email.includes('@')} onClick={() => act(() => recruiting({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => recruiting({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Revoked.')}>Revoke</Button></div>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
