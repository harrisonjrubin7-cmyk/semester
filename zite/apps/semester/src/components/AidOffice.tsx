import { useState } from 'react';
import { toast } from 'sonner';
import { aidOffice } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Loadable, useLoad, Status, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const $ = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const cents = (s: string) => Math.round(Number(s || 0) * 100);
const KINDS = ['tax_return', 'verification_worksheet', 'identity', 'dependency', 'other'];

/** Documents, eligibility, awards and appeals. Students see only their own; aid staff see the office queue. */
export default function AidOffice() {
  const s = useLoad(() => aidOffice({ action: 'get' }));
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); s.reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); s.reload(); return false; } };
  const [ref, setRef] = useState<Record<number, string>>({});
  const [ap, setAp] = useState({ term: '', kind: 'sap', reason: '' });
  const [rq, setRq] = useState({ email: '', term: '', kind: 'tax_return', required: true });
  const [el, setEl] = useState({ studentId: '', term: '', coa: '', sai: '', enrollment: 'full', reference: '', sap: 'good', sapNote: '' });
  const [pr, setPr] = useState({ studentId: '', term: '', fund: '', amount: '', key: crypto.randomUUID() });
  const [fd, setFd] = useState({ code: '', name: '', needBased: true, budget: '' });
  return (
    <Loadable state={s}>{(d: any) => {
      const students = [...new Map(d.eligibility.concat(d.docs).filter((x: any) => x.studentId).map((x: any) => [x.studentId, x.student])).entries()];
      const curElig = d.eligibility.find((x: any) => x.studentId === el.studentId && x.term === el.term);
      return (
        <div className="space-y-4">
          <Panel title="Aid documents">
            <p className="mb-2 text-xs text-muted-foreground">Submit documents in the aid portal; record only the reference it gives you. Semester never stores the document.</p>
            {d.docs.length ? <ul className="space-y-1 text-sm">{d.docs.map((x: any) => <li key={x.id} className="flex flex-wrap items-center gap-2">
              {d.staff && <b>{x.student}</b>}{x.term} · {x.kind.replace('_', ' ')}{x.required ? '' : ' (optional)'} · <Status value={x.state} />{x.reference ? ` · ${x.reference}` : ''}{x.note ? ` — ${x.note}` : ''}
              {(x.mine || d.staff) && ['requested', 'rejected'].includes(x.state) && <><Input aria-label="Aid-system reference" placeholder="Aid-system reference" className="h-8 w-44" value={ref[x.id] ?? ''} onChange={(e) => setRef({ ...ref, [x.id]: e.target.value })} />
                <Button size="sm" variant="outline" onClick={() => act(() => aidOffice({ action: 'docStep', docId: x.id, step: 'received', reference: ref[x.id] ?? '' }), 'Recorded.')}>Mark submitted</Button></>}
              {d.staff && !x.mine && x.state === 'received' && <><Button size="sm" variant="outline" onClick={() => act(() => aidOffice({ action: 'docStep', docId: x.id, step: 'accept' }), 'Accepted.')}>Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt('What needs fixing?'); if (n) act(() => aidOffice({ action: 'docStep', docId: x.id, step: 'reject', note: n }), 'Returned to the student.'); }}>Return</Button></>}
            </li>)}</ul> : <Empty>No documents requested.</Empty>}
            {d.staff && <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Student email" placeholder="Student email" className="h-8 max-w-xs" value={rq.email} onChange={(e) => setRq({ ...rq, email: e.target.value })} />
              <Input aria-label="Term" placeholder="Term (e.g. F26)" className="h-8 w-28" value={rq.term} onChange={(e) => setRq({ ...rq, term: e.target.value })} />
              <select aria-label="Kind" className={sel} value={rq.kind} onChange={(e) => setRq({ ...rq, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={rq.required} onChange={(e) => setRq({ ...rq, required: e.target.checked })} />Required for verification</label>
              <Button size="sm" variant="outline" disabled={!rq.email.includes('@') || rq.term.length < 2} onClick={() => act(() => aidOffice({ action: 'requestDoc', ...rq, kind: rq.kind as never }), 'Requested; the student was notified.')}>Request</Button></div>}
          </Panel>
          <Panel title="Eligibility and academic progress">
            {d.eligibility.length ? <ul className="text-sm">{d.eligibility.map((x: any, i: number) => <li key={i}>{d.staff && <b>{x.student} · </b>}{x.term}: cost {$(x.coa)} · SAI {$(x.sai)} · {x.enrollment.replace('_', ' ')} · remaining need {$(x.needLeft)} · progress <Status value={x.sap} />{x.sapNote ? ` — ${x.sapNote}` : ''}</li>)}</ul> : <Empty>No eligibility recorded yet.</Empty>}
            {d.staff && <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <select aria-label="Student" className={sel} value={el.studentId} onChange={(e) => setEl({ ...el, studentId: e.target.value })}><option value="">Student…</option>{students.map(([id, n]: any) => <option key={id} value={id}>{n}</option>)}</select>
              <Input aria-label="Term" placeholder="Term" value={el.term} onChange={(e) => setEl({ ...el, term: e.target.value })} />
              <Input aria-label="Cost of attendance" type="number" placeholder="Cost of attendance ($)" value={el.coa} onChange={(e) => setEl({ ...el, coa: e.target.value })} />
              <Input aria-label="Student aid index" type="number" placeholder="Student aid index ($)" value={el.sai} onChange={(e) => setEl({ ...el, sai: e.target.value })} />
              <select aria-label="Enrollment" className={sel} value={el.enrollment} onChange={(e) => setEl({ ...el, enrollment: e.target.value })}>{['full', 'three_quarter', 'half', 'less_than_half'].map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select>
              <Input aria-label="Aid-system reference" placeholder="Aid-system reference (e.g. ISIR id)" value={el.reference} onChange={(e) => setEl({ ...el, reference: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!el.studentId || !el.term || !el.reference} onClick={() => act(() => aidOffice({ action: 'eligibility', studentId: el.studentId, term: el.term, coa: cents(el.coa), sai: cents(el.sai), enrollment: el.enrollment as never, reference: el.reference, expectedVersion: curElig?.version ?? 0 }), 'Eligibility recorded.')}>Record eligibility</Button>
              <span />
              <select aria-label="Progress status" className={sel} value={el.sap} onChange={(e) => setEl({ ...el, sap: e.target.value })}>{['good', 'warning', 'probation', 'ineligible'].map((k) => <option key={k}>{k}</option>)}</select>
              <Input aria-label="Progress basis" placeholder="Basis (GPA, pace, timeframe)" className="sm:col-span-2" value={el.sapNote} onChange={(e) => setEl({ ...el, sapNote: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!el.studentId || !el.term || el.sapNote.length < 5} onClick={() => act(() => aidOffice({ action: 'sap', studentId: el.studentId, term: el.term, sap: el.sap as never, note: el.sapNote }), 'Progress status saved.')}>Save progress review</Button>
            </div>}
          </Panel>
          <Panel title="Awards">
            {d.awards.length ? <ul className="space-y-1 text-sm">{d.awards.map((w: any) => <li key={w.id} className="flex flex-wrap items-center gap-2">
              {d.staff && <b>{w.student}</b>}{w.term} · {w.fund} · {$(w.amount)} · <Status value={w.state} />{w.reference ? ` · ${w.reference}` : ''}{w.note ? ` — ${w.note}` : ''}
              {w.mine && w.state === 'offered' && <><Button size="sm" onClick={() => act(() => aidOffice({ action: 'awardStep', awardId: w.id, step: 'accept' }), 'Accepted.')}>Accept</Button><Button size="sm" variant="outline" onClick={() => act(() => aidOffice({ action: 'awardStep', awardId: w.id, step: 'decline' }), 'Declined.')}>Decline</Button></>}
              {d.staff && !w.mine && w.state === 'proposed' && !w.proposedByMe && <Button size="sm" variant="outline" onClick={() => act(() => aidOffice({ action: 'awardStep', awardId: w.id, step: 'approve' }), 'Approved.')}>Approve</Button>}
              {d.staff && !w.mine && w.state === 'approved' && <><Input aria-label="Packaging reference" placeholder="Aid-system packaging reference" className="h-8 w-52" value={ref[-w.id] ?? ''} onChange={(e) => setRef({ ...ref, [-w.id]: e.target.value })} />
                <Button size="sm" variant="outline" onClick={() => act(() => aidOffice({ action: 'awardStep', awardId: w.id, step: 'offer', reference: ref[-w.id] ?? '' }), 'Offered to the student.')}>Offer</Button></>}
              {d.staff && !w.mine && !['declined', 'cancelled'].includes(w.state) && <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt('Why cancel this award?'); if (n) act(() => aidOffice({ action: 'awardStep', awardId: w.id, step: 'cancel', note: n }), 'Cancelled.'); }}>Cancel</Button>}
            </li>)}</ul> : <Empty>No awards.</Empty>}
            {d.staff && <div className="mt-2 flex flex-wrap gap-2">
              <select aria-label="Student" className={sel} value={pr.studentId} onChange={(e) => setPr({ ...pr, studentId: e.target.value })}><option value="">Student…</option>{students.map(([id, n]: any) => <option key={id} value={id}>{n}</option>)}</select>
              <Input aria-label="Term" placeholder="Term" className="h-8 w-24" value={pr.term} onChange={(e) => setPr({ ...pr, term: e.target.value })} />
              <select aria-label="Fund" className={sel} value={pr.fund} onChange={(e) => setPr({ ...pr, fund: e.target.value })}><option value="">Fund…</option>{d.funds.map((f: any) => <option key={f.code} value={f.code}>{f.code} ({$(f.budget - f.used)} left)</option>)}</select>
              <Input aria-label="Amount" type="number" placeholder="$" className="h-8 w-28" value={pr.amount} onChange={(e) => setPr({ ...pr, amount: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!pr.studentId || !pr.term || !pr.fund || !pr.amount} onClick={async () => { if (await act(() => aidOffice({ action: 'propose', studentId: pr.studentId, term: pr.term, fund: pr.fund, amount: cents(pr.amount), requestKey: pr.key }), 'Proposed; another officer approves.')) setPr({ ...pr, amount: '', key: crypto.randomUUID() }); }}>Propose award</Button></div>}
          </Panel>
          <Panel title="Appeals">
            {d.appeals.length ? <ul className="space-y-1 text-sm">{d.appeals.map((p: any) => <li key={p.id}>{d.staff && <b>{p.student} · </b>}{p.term} · {p.kind.replace(/_/g, ' ')} · <Status value={p.state} /> — {p.reason}{p.decision ? ` · Decision: ${p.decision}` : ''}
              {d.staff && !p.mine && p.state === 'submitted' && (p.originalIsMe ? <span className="text-xs text-muted-foreground"> · another officer decides (you made the original decision)</span> : <span className="ml-2"><Button size="sm" variant="outline" onClick={() => { const n = window.prompt('Decision and conditions'); if (n) act(() => aidOffice({ action: 'decideAppeal', appealId: p.id, grant: true, decision: n }), 'Granted.'); }}>Grant</Button>
                <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt('Reason for denial'); if (n) act(() => aidOffice({ action: 'decideAppeal', appealId: p.id, grant: false, decision: n }), 'Denied.'); }}>Deny</Button></span>)}</li>)}</ul> : <Empty>No appeals.</Empty>}
            {!d.staff && <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <Input aria-label="Term" placeholder="Term" value={ap.term} onChange={(e) => setAp({ ...ap, term: e.target.value })} />
              <select aria-label="Appeal about" className={sel} value={ap.kind} onChange={(e) => setAp({ ...ap, kind: e.target.value })}><option value="sap">Academic progress</option><option value="award">My award</option><option value="cost_of_attendance">Cost of attendance</option></select>
              <Textarea aria-label="Reason" placeholder="What happened and what changed (at least 20 characters)" className="sm:col-span-3" value={ap.reason} onChange={(e) => setAp({ ...ap, reason: e.target.value })} />
              <div><Button size="sm" disabled={!ap.term || ap.reason.length < 20} onClick={async () => { if (await act(() => aidOffice({ action: 'appeal', term: ap.term, kind: ap.kind as never, reason: ap.reason }), 'Appeal submitted.')) setAp({ term: '', kind: 'sap', reason: '' }); }}>Submit appeal</Button></div></div>}
          </Panel>
          {(d.staff || d.isAdmin) && <Panel title="Funds and reconciliation">
            {d.funds.length ? <ul className="text-sm">{d.funds.map((f: any) => <li key={f.code}><b>{f.code}</b> {f.name}{f.needBased ? ' (need-based)' : ''}: budget {$(f.budget)} · committed {$(f.used)} · left {$(f.budget - f.used)}</li>)}</ul> : <Empty>No funds set up.</Empty>}
            <p className="mt-2 text-xs">{d.reconciliation.overCommitted.length ? `Over-committed: ${d.reconciliation.overCommitted.join(', ')}` : 'No fund is over-committed.'} {d.reconciliation.ineligibleWithAwards.length ? `${d.reconciliation.ineligibleWithAwards.length} live award(s) belong to students now failing academic progress:` : 'No live awards for students failing academic progress.'}</p>
            {d.reconciliation.ineligibleWithAwards.length > 0 && <ul className="text-xs">{d.reconciliation.ineligibleWithAwards.map((x: any) => <li key={x.id}>{x.student} · {x.term} · {x.fund} · {$(x.amount)}</li>)}</ul>}
            {d.isAdmin && <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Fund code" placeholder="Fund code" className="h-8 w-32" value={fd.code} onChange={(e) => setFd({ ...fd, code: e.target.value.toUpperCase() })} />
              <Input aria-label="Fund name" placeholder="Name" className="h-8 max-w-xs" value={fd.name} onChange={(e) => setFd({ ...fd, name: e.target.value })} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={fd.needBased} onChange={(e) => setFd({ ...fd, needBased: e.target.checked })} />Need-based</label>
              <Input aria-label="Budget" type="number" placeholder="Budget ($)" className="h-8 w-32" value={fd.budget} onChange={(e) => setFd({ ...fd, budget: e.target.value })} />
              <Button size="sm" variant="outline" disabled={fd.code.length < 2 || fd.name.length < 2} onClick={() => act(() => aidOffice({ action: 'fund', code: fd.code, name: fd.name, needBased: fd.needBased, budget: cents(fd.budget) }), 'Fund saved.')}>Save fund</Button></div>}
          </Panel>}
        </div>
      );
    }}</Loadable>
  );
}
