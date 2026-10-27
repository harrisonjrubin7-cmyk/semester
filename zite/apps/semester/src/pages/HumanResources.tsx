import { useState } from 'react';
import { toast } from 'sonner';
import { hr } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const ACCESS: Record<string, string> = { none: 'no access change', requested: 'access waiting for an administrator', provisioned: 'access active', removal_requested: 'access removal waiting for an administrator', removed: 'access removed' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Employment({ e, d, reload }: { e: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const officer = d.roles.includes('officer'), approver = d.roles.includes('approver');
  const [lv, setLv] = useState({ kind: 'vacation', from: '', to: '', reason: '' });
  const [end, setEnd] = useState({ date: d.today, reason: '' });
  const [doc, setDoc] = useState({ title: '', ref: '' });
  return (
    <li className="rounded border border-border p-3 text-sm">
      <p className="font-medium">{e.person} · {e.position} <span className="text-xs font-normal text-muted-foreground">grants {e.grantsRole}</span></p>
      <p className="text-xs"><Status value={e.state} /> from {e.start}{e.end ? ` to ${e.end}` : ''} · {ACCESS[e.access]}{e.onLeave ? ' · on leave today' : ''}</p>
      {e.proposedBy && <p className="text-xs text-muted-foreground">Proposed by {e.proposedBy}{e.approvedBy ? ` · approved by ${e.approvedBy}` : ''}{e.accessBy ? ` · access by ${e.accessBy}` : ''}{e.endReason ? ` · ended: ${e.endReason}` : ''}</p>}
      {approver && e.state === 'proposed' && !e.proposedByMe && !e.mine && <div className="mt-1 flex gap-2">
        <Button size="sm" onClick={() => act(() => hr({ action: 'decide', employmentId: e.id, approve: true, expectedVersion: e.version }), 'Approved; access request sent to administrators.')}>Approve appointment</Button>
        <Button size="sm" variant="outline" onClick={() => act(() => hr({ action: 'decide', employmentId: e.id, approve: false, expectedVersion: e.version }), 'Withdrawn.')}>Withdraw</Button></div>}
      {e.tasks.length > 0 && <ul className="mt-1 text-xs">{e.tasks.map((t: any) => <li key={t.id} className="flex items-center gap-2">
        <input type="checkbox" aria-label={t.item} checked={t.done} disabled={t.done || !officer || t.item.startsWith('Access')} onChange={() => act(() => hr({ action: 'task', taskId: t.id }), 'Done.')} />{t.kind}: {t.item}{t.doneBy ? ` — ${t.doneBy}` : ''}</li>)}</ul>}
      {e.leave.length > 0 && <ul className="mt-1 text-xs">{e.leave.map((l: any) => <li key={l.id}>{l.kind} {l.from} – {l.to} · <Status value={l.state} />{l.reason ? ` — ${l.reason}` : ''}{l.decidedBy ? ` · ${l.decidedBy}` : ''}{l.note ? `: ${l.note}` : ''}
        {approver && l.state === 'requested' && !l.mine && <span className="ml-2"><Button size="sm" variant="outline" onClick={() => act(() => hr({ action: 'decideLeave', leaveId: l.id, approve: true }), 'Leave approved.')}>Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt('Reason for declining'); if (n) act(() => hr({ action: 'decideLeave', leaveId: l.id, approve: false, note: n }), 'Declined.'); }}>Decline</Button></span>}</li>)}</ul>}
      {e.mine && e.state === 'active' && <div className="mt-2 grid gap-2 sm:grid-cols-5">
        <select aria-label="Leave type" className={sel} value={lv.kind} onChange={(x) => setLv({ ...lv, kind: x.target.value })}>{['vacation', 'sick', 'parental', 'unpaid', 'other'].map((k) => <option key={k}>{k}</option>)}</select>
        <Input aria-label="From" type="date" value={lv.from} onChange={(x) => setLv({ ...lv, from: x.target.value })} />
        <Input aria-label="To" type="date" value={lv.to} onChange={(x) => setLv({ ...lv, to: x.target.value })} />
        <Input aria-label="Reason" placeholder="Reason (optional)" value={lv.reason} onChange={(x) => setLv({ ...lv, reason: x.target.value })} />
        <Button size="sm" variant="outline" disabled={!lv.from || !lv.to} onClick={async () => { if (await act(() => hr({ action: 'leave', employmentId: e.id, kind: lv.kind as never, from: lv.from, to: lv.to, reason: lv.reason }), 'Leave requested.')) setLv({ kind: 'vacation', from: '', to: '', reason: '' }); }}>Request leave</Button>
      </div>}
      {e.docs.length > 0 && <ul className="mt-1 text-xs">{e.docs.map((x: any, i: number) => <li key={i}>Document: {x.title} · {x.ref} · {fmt(x.at)}</li>)}</ul>}
      {officer && !e.mine && <div className="mt-2 flex flex-wrap gap-2">
        <Input aria-label="Document title" placeholder="Document title" className="h-8 max-w-xs" value={doc.title} onChange={(x) => setDoc({ ...doc, title: x.target.value })} />
        <Input aria-label="Document reference" placeholder="Where it is stored (restricted system)" className="h-8 max-w-xs" value={doc.ref} onChange={(x) => setDoc({ ...doc, ref: x.target.value })} />
        <Button size="sm" variant="outline" disabled={doc.title.length < 3 || doc.ref.length < 3} onClick={async () => { if (await act(() => hr({ action: 'doc', employmentId: e.id, ...doc }), 'Filed.')) setDoc({ title: '', ref: '' }); }}>File reference</Button>
        {['approved', 'active'].includes(e.state) && <><Input aria-label="End date" type="date" className="h-8 w-40" value={end.date} onChange={(x) => setEnd({ ...end, date: x.target.value })} />
          <Input aria-label="End reason" placeholder="Reason employment ends" className="h-8 max-w-xs" value={end.reason} onChange={(x) => setEnd({ ...end, reason: x.target.value })} />
          <Button size="sm" variant="outline" disabled={end.reason.trim().length < 5} onClick={() => act(() => hr({ action: 'end', employmentId: e.id, end: end.date, reason: end.reason, expectedVersion: e.version }), 'Ended; access removal sent to administrators.')}>End employment</Button></>}
      </div>}
      {d.isAdmin && !e.mine && (e.access === 'requested' || e.access === 'removal_requested') && <Button size="sm" className="mt-2" onClick={() => act(() => hr({ action: 'access', employmentId: e.id }), 'Access updated.')}>{e.access === 'requested' ? `Grant ${e.grantsRole} access` : `Remove ${e.grantsRole} access (other access stays)`}</Button>}
    </li>
  );
}

export default function HumanResources() {
  const s = useLoad(() => hr({ action: 'get' }));
  const act = useAct(s.reload);
  const [p, setP] = useState({ code: '', title: '', department: '', grantsRole: 'Staff', fte: '1' });
  const [ap, setAp] = useState({ positionId: '', email: '', start: '' });
  const [st, setSt] = useState({ email: '', role: 'officer' });
  return (
    <>
      <PageHeader eyebrow="You" title="Work and HR" sub="Your employment, leave and documents. HR records employment; administrators change access; ending a job never removes your student access." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.employments.filter((e: any) => e.mine);
        const others = d.employments.filter((e: any) => !e.mine);
        const officer = d.roles.includes('officer');
        return (
          <div className="space-y-4">
            <Panel title="Your employment">{mine.length ? <ul className="space-y-2">{mine.map((e: any) => <Employment key={e.id} e={e} d={d} reload={s.reload} />)}</ul> : <Empty>No employment records.</Empty>}</Panel>
            {(d.roles.length > 0 || d.isAdmin) && <Panel title={d.roles.length ? 'Appointments' : 'Access changes waiting'}>{others.length ? <ul className="space-y-2">{others.map((e: any) => <Employment key={e.id} e={e} d={d} reload={s.reload} />)}</ul> : <Empty>Nothing here.</Empty>}</Panel>}
            {d.isAdmin && d.drift.length > 0 && <Panel title="Access drift">
              <ul className="text-xs">{d.drift.map((x: any, i: number) => <li key={i}>{x.person}: {x.missing.length ? `missing ${x.missing.join(', ')}` : ''}{x.lingering.length ? ` still has ${x.lingering.join(', ')} after removal` : ''}</li>)}</ul>
              <p className="mt-1 text-xs text-muted-foreground">HR records and memberships disagree. Fix the membership in the Institution console.</p></Panel>}
            {officer && <Panel title="Positions">
              {d.positions.length ? <ul className="text-xs">{d.positions.map((x: any) => <li key={x.id}><b>{x.code}</b> {x.title}{x.department ? ` · ${x.department}` : ''} · grants {x.grantsRole} · {x.fte} FTE · <Status value={x.state} /></li>)}</ul> : <Empty>No positions.</Empty>}
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-6">
                <Input aria-label="Position code" placeholder="Code" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value.toUpperCase() })} />
                <Input aria-label="Position title" placeholder="Title" className="sm:col-span-2" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
                <Input aria-label="Department" placeholder="Department" value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} />
                <select aria-label="Grants role" className={sel} value={p.grantsRole} onChange={(e) => setP({ ...p, grantsRole: e.target.value })}>{['Staff', 'Faculty', 'Tutor', 'Advisor'].map((r) => <option key={r}>{r}</option>)}</select>
                <Input aria-label="FTE" type="number" min={0.05} max={1} step={0.05} value={p.fte} onChange={(e) => setP({ ...p, fte: e.target.value })} />
                <div><Button size="sm" disabled={p.code.length < 2 || p.title.length < 3} onClick={async () => { if (await act(() => hr({ action: 'position', ...p, grantsRole: p.grantsRole as never, fte: Number(p.fte) }), 'Position created.')) setP({ code: '', title: '', department: '', grantsRole: 'Staff', fte: '1' }); }}>Add position</Button></div>
              </div>
              <p className="mt-3 text-xs font-medium">Propose an appointment</p>
              <div className="mt-1 grid gap-2 text-sm sm:grid-cols-4">
                <select aria-label="Position" className={sel} value={ap.positionId} onChange={(e) => setAp({ ...ap, positionId: e.target.value })}><option value="">Open position…</option>{d.positions.filter((x: any) => x.state === 'open').map((x: any) => <option key={x.id} value={x.id}>{x.code} {x.title}</option>)}</select>
                <Input aria-label="Person email" placeholder="Person's email" value={ap.email} onChange={(e) => setAp({ ...ap, email: e.target.value })} />
                <Input aria-label="Start date" type="date" value={ap.start} onChange={(e) => setAp({ ...ap, start: e.target.value })} />
                <div><Button size="sm" disabled={!ap.positionId || !ap.email.includes('@') || !ap.start} onClick={async () => { if (await act(() => hr({ action: 'propose', positionId: Number(ap.positionId), email: ap.email, start: ap.start }), 'Proposed. A different approver decides.')) setAp({ positionId: '', email: '', start: '' }); }}>Propose</Button></div>
              </div>
            </Panel>}
            {d.isAdmin && <Panel title="HR roles">
              <p className="text-xs">{d.staff.map((x: any) => `${x.name} (${x.role})`).join(', ') || 'Nobody yet.'}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
                <select aria-label="Role" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}><option value="officer">HR officer</option><option value="approver">HR approver</option></select>
                <Button size="sm" disabled={!st.email.includes('@')} onClick={() => act(() => hr({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Granted.')}>Grant</Button>
                <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => hr({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Revoked.')}>Revoke</Button></div>
            </Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
