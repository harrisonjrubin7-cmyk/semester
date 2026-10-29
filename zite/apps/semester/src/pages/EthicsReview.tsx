import { useState } from 'react';
import { toast } from 'sonner';
import { ethics } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function ProtocolCard({ p, d, reload }: { p: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [rev, setRev] = useState({ position: 'approve', note: '' });
  const [dec, setDec] = useState({ note: '', expiresOn: '', conditions: '' });
  const onCommittee = d.myRole !== null;
  const isChair = d.myRole === 'chair';
  const myReview = p.reviews.some((r: any) => r.mine);
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{p.title} <span className="text-xs font-normal text-muted-foreground">· {p.submitter}{p.projectCode ? ` · project ${p.projectCode}` : ''} · subjects: {p.subjects} · risk: {p.risk === 'greater' ? 'greater than minimal' : 'minimal'}</span></p>
        <Status value={p.state} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>
      {p.consent && <p className="mt-1 text-xs text-muted-foreground"><b>Consent:</b> {p.consent}</p>}
      {p.state === 'conditions' && <p className="mt-1 text-xs"><b>Conditions:</b> {p.conditionsText}</p>}
      {(p.state === 'approved' || p.state === 'conditions') && <p className="mt-1 text-xs text-muted-foreground">Approved until {p.expiresOn}{p.decidedBy ? ` · decided by ${p.decidedBy}` : ''}</p>}
      {p.state === 'declined' && <p className="mt-1 text-xs text-muted-foreground">Declined{p.decidedBy ? ` by ${p.decidedBy}` : ''}: {p.decisionNote}</p>}
      {p.reviews.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{p.reviews.map((r: any, i: number) => <li key={i}><b>{r.reviewer}</b> — {r.position}: {r.note}</li>)}</ul>}
      {onCommittee && p.state === 'submitted' && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => act(() => ethics({ action: 'begin', id: p.id }), 'Review opened.')}>Open review</Button></div>}
      {onCommittee && p.state === 'under_review' && !p.submitterMe && !myReview && <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="Your position" className={sel} value={rev.position} onChange={(e) => setRev({ ...rev, position: e.target.value })}><option value="approve">Approve</option><option value="conditions">Approve with conditions</option><option value="decline">Decline</option></select>
        <Input aria-label="Review note" placeholder="Your review note" className="max-w-sm flex-1" value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} />
        <Button size="sm" disabled={rev.note.trim().length < 5} onClick={() => act(() => ethics({ action: 'review', id: p.id, position: rev.position as never, note: rev.note }), 'Review recorded.')}>Record review</Button>
      </div>}
      {onCommittee && p.state === 'under_review' && p.submitterMe && <p className="mt-2 text-xs text-muted-foreground">This is your protocol — the committee reviews it without you.</p>}
      {isChair && p.state === 'under_review' && !p.submitterMe && <div className="mt-3 space-y-2 border-t border-border pt-2">
        <p className="text-xs text-muted-foreground">Chair decision — needs at least two recorded reviews ({p.reviews.length} so far).</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Approval expiry" type="date" value={dec.expiresOn} onChange={(e) => setDec({ ...dec, expiresOn: e.target.value })} />
          <Input aria-label="Decision note" placeholder="Note (required to decline)" className="max-w-xs flex-1" value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} />
        </div>
        <Textarea aria-label="Conditions" rows={2} placeholder="Conditions (required for a conditional approval)" value={dec.conditions} onChange={(e) => setDec({ ...dec, conditions: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!dec.expiresOn || p.reviews.length < 2} onClick={() => act(() => ethics({ action: 'decide', id: p.id, decision: 'approve', note: dec.note, expiresOn: dec.expiresOn || null, conditions: '' }), 'Protocol approved.')}>Approve</Button>
          <Button size="sm" variant="outline" disabled={!dec.expiresOn || dec.conditions.trim().length < 10 || p.reviews.length < 2} onClick={() => act(() => ethics({ action: 'decide', id: p.id, decision: 'conditions', note: dec.note, expiresOn: dec.expiresOn || null, conditions: dec.conditions }), 'Approved with conditions.')}>Approve with conditions</Button>
          <Button size="sm" variant="outline" disabled={dec.note.trim().length < 5 || p.reviews.length < 2} onClick={() => act(() => ethics({ action: 'decide', id: p.id, decision: 'decline', note: dec.note, expiresOn: null, conditions: '' }), 'Protocol declined.')}>Decline</Button>
        </div>
      </div>}
      {(p.state === 'approved' || p.state === 'conditions') && (p.submitterMe || onCommittee) && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => act(() => ethics({ action: 'close', id: p.id }), 'Protocol closed.')}>Close protocol</Button></div>}
    </li>
  );
}

export default function EthicsReview() {
  const s = useLoad(() => ethics({ action: 'get' }));
  const act = useAct(s.reload);
  const [f, setF] = useState({ projectCode: '', title: '', summary: '', subjects: 'human', risk: 'minimal', consent: '' });
  const [st, setSt] = useState({ email: '', role: 'member' });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Research ethics" sub="Protocol review by the ethics committee. Nobody reviews or decides their own protocol, a decision needs at least two recorded reviews, and every approval carries an expiry date." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Submit a protocol">
            <div className="grid gap-2 sm:grid-cols-3">
              <select aria-label="Project" className={sel} value={f.projectCode} onChange={(e) => setF({ ...f, projectCode: e.target.value })}><option value="">Project (optional)…</option>{d.projects.map((p: any) => <option key={p.code} value={p.code}>{p.code} — {p.title}</option>)}</select>
              <select aria-label="Subjects" className={sel} value={f.subjects} onChange={(e) => setF({ ...f, subjects: e.target.value })}><option value="human">Human subjects</option><option value="animal">Animal subjects</option><option value="both">Human and animal</option><option value="none">No subjects</option></select>
              <select aria-label="Risk" className={sel} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })}><option value="minimal">Minimal risk</option><option value="greater">Greater than minimal risk</option></select>
            </div>
            <Input className="mt-2" aria-label="Title" placeholder="Protocol title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <Textarea className="mt-2" rows={3} aria-label="Summary" placeholder="What will be done, with whom, and how risks are handled (a short paragraph at least)." value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
            <Textarea className="mt-2" rows={2} aria-label="Consent" placeholder="How consent is obtained, or why it is waived (required unless there are no subjects)." value={f.consent} onChange={(e) => setF({ ...f, consent: e.target.value })} />
            <div className="mt-2"><Button size="sm" disabled={f.title.trim().length < 5 || f.summary.trim().length < 50} onClick={async () => { if (await act(() => ethics({ action: 'submit', projectCode: f.projectCode, title: f.title, summary: f.summary, subjects: f.subjects as never, risk: f.risk as never, consent: f.consent }), 'Protocol submitted.')) setF({ projectCode: '', title: '', summary: '', subjects: 'human', risk: 'minimal', consent: '' }); }}>Submit protocol</Button></div>
          </Panel>
          <Panel title={d.myRole ? 'All protocols' : 'Your protocols'}>{d.protocols.length ? <ul className="space-y-2">{d.protocols.map((p: any) => <ProtocolCard key={p.id} p={p} d={d} reload={s.reload} />)}</ul> : <Empty>No protocols yet.</Empty>}</Panel>
          {d.isAdmin && <Panel title="Ethics committee">
            <p className="text-xs">{d.committee.map((m: any) => `${m.name} (${m.role})`).join(', ') || 'No committee members yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Member email" placeholder="Email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <select aria-label="Role" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}><option value="member">Member</option><option value="chair">Chair</option></select>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={async () => { if (await act(() => ethics({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Committee role granted.')) setSt({ email: '', role: 'member' }); }}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => ethics({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Committee role removed.')}>Remove</Button>
            </div>
          </Panel>}
        </div>
      )}</Loadable>
    </>
  );
}
