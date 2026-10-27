import { useState } from 'react';
import { toast } from 'sonner';
import { continuing } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { summary, money } from '../lib/continuingRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Sessions({ list }: { list: any[] }) {
  return <ul className="text-xs text-muted-foreground">{list.map((s) => <li key={s.id} className={s.cancelled ? 'line-through' : ''}>{fmt(s.startsAt)} – {fmt(s.endsAt)}{s.location ? ` · ${s.location}` : ''}{s.cancelled ? ' (cancelled)' : ''}</li>)}</ul>;
}

function MyEnrollment({ e, reload }: { e: any; reload: () => void }) {
  const act = useAct(reload);
  const [why, setWhy] = useState('');
  return (
    <li className="rounded border border-border p-3 text-sm">
      <p className="font-medium">{e.title} <span className="text-xs text-muted-foreground">· {e.code} · {e.institution}</span></p>
      <p className="text-xs">{summary({ state: e.state, payment: e.payment, completion: e.completion, refund: e.refund })}{e.feeCents ? ` · fee ${money(e.feeCents)}` : ''}</p>
      {e.offeringState === 'cancelled' && <p className="text-xs">Cancelled by the institution: {e.cancelReason}</p>}
      {e.state === 'enrolled' && e.completion === 'in_progress' && <p className="text-xs text-muted-foreground">Attendance so far {e.pct}% (needs {e.minAttendance}%)</p>}
      {e.completionNote && <p className="text-xs">Note: {e.completionNote}</p>}
      {e.refund !== 'none' && <p className="text-xs">Refund {e.refund}{e.refundCents != null ? ` · ${money(e.refundCents)}` : ''}{e.refundRef ? ` · ref ${e.refundRef}` : ''}{e.refundReason ? ` — ${e.refundReason}` : ''}</p>}
      {e.credential && <p className="mt-1 text-xs"><b>Credential</b> · verification code <span className="font-mono">{e.credential.code}</span>{e.credential.revoked ? ` · revoked: ${e.revokeReason}` : ` · issued ${fmt(e.issuedAt)}`}</p>}
      <Sessions list={e.sessions} />
      <div className="mt-2 flex flex-wrap gap-2">
        {e.state === 'enrolled' && e.completion === 'in_progress' && <Button size="sm" variant="outline" onClick={() => act(() => continuing({ action: 'withdraw', enrollmentId: e.id }), 'Withdrawn. If you paid and nothing had started, a refund was requested.')}>Withdraw</Button>}
        {e.paidCents > 0 && e.completion !== 'completed' && (e.refund === 'none' || e.refund === 'denied') && <>
          <Input aria-label="Refund reason" placeholder="Why you are asking for a refund" className="h-8 max-w-sm" value={why} onChange={(x) => setWhy(x.target.value)} />
          <Button size="sm" variant="outline" disabled={why.trim().length < 10} onClick={() => act(() => continuing({ action: 'requestRefund', enrollmentId: e.id, reason: why }), 'Refund requested.')}>Request refund</Button></>}
      </div>
    </li>
  );
}

function Roster({ o, d, reload }: { o: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [pay, setPay] = useState<Record<number, { kind: string; ref: string }>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const [ref, setRef] = useState<Record<number, { cents: string; text: string }>>({});
  const live = o.sessions.filter((s: any) => !s.cancelled);
  const fin = d.roles.includes('finance'), auth = d.roles.includes('authority'), coord = d.roles.includes('coordinator');
  if (!o.enrollments.length) return <Empty>No enrollments yet.</Empty>;
  return (
    <ul className="space-y-2">{o.enrollments.map((e: any) => {
      const p = pay[e.id] ?? { kind: 'paid', ref: '' }; const r = ref[e.id] ?? { cents: String((e.refundCents ?? e.paidCents) / 100), text: '' };
      return (
        <li key={e.id} className="rounded border border-border p-2 text-xs">
          <p className="text-sm font-medium">{e.learner} <span className="text-xs font-normal text-muted-foreground">{summary({ state: e.state, payment: e.payment, completion: e.completion, refund: e.refund })} · attendance {e.pct}%</span></p>
          {e.sponsor && <p>Sponsor: {e.sponsor}</p>}{e.paymentRef && <p>Payment ref {e.paymentRef}</p>}
          {coord && e.state === 'enrolled' && e.completion === 'in_progress' && <div className="mt-1 flex flex-wrap gap-2">{live.filter((s: any) => new Date(s.startsAt) <= new Date()).map((s: any) => (
            <label key={s.id} className="flex items-center gap-1"><input type="checkbox" checked={!!e.attendance[s.id]} onChange={(x) => act(() => continuing({ action: 'attend', enrollmentId: e.id, sessionId: s.id, present: x.target.checked }), 'Attendance saved.')} />{fmt(s.startsAt)}</label>))}</div>}
          {e.state === 'enrolled' && e.payment === 'unpaid' && (fin || auth) && !e.mine && <div className="mt-1 flex flex-wrap gap-2">
            <select aria-label="Payment kind" className={sel} value={p.kind} onChange={(x) => setPay({ ...pay, [e.id]: { ...p, kind: x.target.value } })}>{fin && <option value="paid">Paid</option>}{fin && <option value="sponsored">Sponsored</option>}{auth && <option value="waived">Waive fee</option>}</select>
            {p.kind !== 'waived' && <Input aria-label={p.kind === 'paid' ? 'Payment reference' : 'Sponsor'} placeholder={p.kind === 'paid' ? 'Finance system reference' : 'Sponsor name'} className="h-8 max-w-xs" value={p.ref} onChange={(x) => setPay({ ...pay, [e.id]: { ...p, ref: x.target.value } })} />}
            <Button size="sm" variant="outline" onClick={() => act(() => continuing({ action: 'pay', enrollmentId: e.id, kind: p.kind as never, reference: p.kind === 'paid' ? p.ref : '', sponsor: p.kind === 'sponsored' ? p.ref : '', expectedVersion: e.version }), 'Recorded.')}>Record</Button></div>}
          {auth && !e.mine && e.state === 'enrolled' && e.completion === 'in_progress' && <div className="mt-1 flex flex-wrap gap-2">
            <Input aria-label="Completion note" placeholder="Assessment note" className="h-8 max-w-sm" value={note[e.id] ?? ''} onChange={(x) => setNote({ ...note, [e.id]: x.target.value })} />
            <Button size="sm" onClick={() => act(() => continuing({ action: 'complete', enrollmentId: e.id, passed: true, note: note[e.id] ?? '', expectedVersion: e.version }), 'Completed; credential issued.')}>Complete and issue credential</Button>
            <Button size="sm" variant="outline" disabled={(note[e.id] ?? '').trim().length < 5} onClick={() => act(() => continuing({ action: 'complete', enrollmentId: e.id, passed: false, note: note[e.id] ?? '', expectedVersion: e.version }), 'Recorded as not completed.')}>Not completed</Button></div>}
          {e.credential && <p className="mt-1">Credential <span className="font-mono">{e.credential.code}</span>{e.credential.revoked ? ' (revoked)' : ''}
            {auth && !e.credential.revoked && <Button size="sm" variant="ghost" onClick={() => { const why = window.prompt('Reason for revoking this credential'); if (why) act(() => continuing({ action: 'revoke', credentialId: e.credential.id, reason: why }), 'Revoked.'); }}>Revoke</Button>}</p>}
          {fin && (e.refund === 'requested' || e.refund === 'approved') && <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>Refund {e.refund}: {e.refundReason}</span>
            {e.refund === 'requested' && <Input aria-label="Refund amount" type="number" min={0} step={0.01} className="h-8 w-28" value={r.cents} onChange={(x) => setRef({ ...ref, [e.id]: { ...r, cents: x.target.value } })} />}
            <Input aria-label={e.refund === 'approved' ? 'Refund reference' : 'Denial reason'} placeholder={e.refund === 'approved' ? 'Refund reference' : 'Reason (to deny)'} className="h-8 max-w-xs" value={r.text} onChange={(x) => setRef({ ...ref, [e.id]: { ...r, text: x.target.value } })} />
            {e.refund === 'requested' && <><Button size="sm" onClick={() => act(() => continuing({ action: 'refund', enrollmentId: e.id, step: 'approve', cents: Math.round(Number(r.cents) * 100), text: '', expectedVersion: e.version }), 'Refund approved.')}>Approve</Button>
              <Button size="sm" variant="outline" disabled={r.text.trim().length < 5} onClick={() => act(() => continuing({ action: 'refund', enrollmentId: e.id, step: 'deny', text: r.text, expectedVersion: e.version }), 'Refund denied.')}>Deny</Button></>}
            {e.refund === 'approved' && <Button size="sm" disabled={r.text.trim().length < 4} onClick={() => act(() => continuing({ action: 'refund', enrollmentId: e.id, step: 'issued', text: r.text, expectedVersion: e.version }), 'Marked issued.')}>Mark issued</Button>}</div>}
        </li>
      );
    })}</ul>
  );
}

function Offering({ o, d, reload }: { o: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const coord = d.roles.includes('coordinator');
  const [s, setS] = useState({ start: '', end: '', location: '' });
  const [why, setWhy] = useState('');
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground"><Status value={o.state} /> {o.code} · {o.feeCents ? money(o.feeCents) : 'free'} · {o.capacity} seats · attendance ≥ {o.minAttendance}%{o.prereqs.length ? ` · requires ${o.prereqs.join(', ')}` : ''} · {o.openToPublic ? 'open to anyone' : 'members only'}</p>
      {o.cancelReason && <p className="text-xs">Cancelled: {o.cancelReason}</p>}
      <ul className="space-y-1 text-xs">{o.sessions.map((x: any) => (
        <li key={x.id} className={x.cancelled ? 'line-through text-muted-foreground' : ''}>{fmt(x.startsAt)} – {fmt(x.endsAt)}{x.location ? ` · ${x.location}` : ''}
          {coord && !x.cancelled && ['draft', 'published'].includes(o.state) && <Button size="sm" variant="ghost" onClick={() => act(() => continuing({ action: 'changeSession', sessionId: x.id, cancel: true, startsAt: null, endsAt: null, location: null, expectedVersion: x.version }), 'Session cancelled; learners notified.')}>Cancel session</Button>}</li>))}</ul>
      {coord && ['draft', 'published'].includes(o.state) && <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Session start" type="datetime-local" value={s.start} onChange={(x) => setS({ ...s, start: x.target.value })} />
        <Input aria-label="Session end" type="datetime-local" value={s.end} onChange={(x) => setS({ ...s, end: x.target.value })} />
        <Input aria-label="Location" placeholder="Location or link" value={s.location} onChange={(x) => setS({ ...s, location: x.target.value })} />
        <Button size="sm" variant="outline" disabled={!s.start || !s.end} onClick={async () => { if (await act(() => continuing({ action: 'addSession', offeringId: o.id, startsAt: toIso(s.start), endsAt: toIso(s.end), location: s.location }), 'Session added.')) setS({ start: '', end: '', location: '' }); }}>Add session</Button>
      </div>}
      {coord && <div className="flex flex-wrap gap-2">
        {o.state === 'draft' && <Button size="sm" onClick={() => act(() => continuing({ action: 'publish', offeringId: o.id, expectedVersion: o.version }), 'Published.')}>Publish</Button>}
        {['draft', 'published'].includes(o.state) && <><Input aria-label="Cancellation reason" placeholder="Reason learners will see" className="h-8 max-w-sm" value={why} onChange={(x) => setWhy(x.target.value)} />
          <Button size="sm" variant="outline" disabled={why.trim().length < 5} onClick={() => act(() => continuing({ action: 'cancelOffering', offeringId: o.id, reason: why, expectedVersion: o.version }), 'Cancelled; learners notified and payments queued for refund.')}>Cancel offering</Button></>}
      </div>}
      <Roster o={o} d={d} reload={reload} />
    </div>
  );
}

export default function Continuing() {
  const s = useLoad(() => continuing({ action: 'get' }));
  const act = useAct(s.reload);
  const blank = { code: '', title: '', description: '', fee: '0', capacity: '20', prereqs: '', min: '80', pub: true };
  const [f, setF] = useState(blank);
  const [st, setSt] = useState({ email: '', role: 'coordinator' });
  return (
    <>
      <PageHeader eyebrow="Learn" title="Continuing education" sub="Short courses and certificates. Payment, attendance, completion and refunds are tracked separately, so each one is always clear." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Your enrollments">{d.mine.length ? <ul className="space-y-2">{d.mine.map((e: any) => <MyEnrollment key={e.id} e={e} reload={s.reload} />)}</ul> : <Empty>You have not enrolled in anything yet.</Empty>}</Panel>
          <Panel title="Open offerings">
            {d.catalog.length ? <ul className="space-y-2">{d.catalog.map((o: any) => (
              <li key={o.id} className="rounded border border-border p-3 text-sm">
                <p className="font-medium">{o.title} <span className="text-xs text-muted-foreground">· {o.code} · {o.institution}</span></p>
                {o.description && <p className="text-xs">{o.description}</p>}
                <p className="text-xs text-muted-foreground">{o.feeCents ? money(o.feeCents) : 'Free'} · {o.seatsLeft} seats left · attendance ≥ {o.minAttendance}%{o.prereqs.length ? ` · requires ${o.prereqs.join(', ')}` : ''}</p>
                <Sessions list={o.sessions} />
                {o.enrolled ? <p className="mt-1 text-xs">You are enrolled.</p> : <Button size="sm" className="mt-2" disabled={o.seatsLeft <= 0} onClick={() => act(() => continuing({ action: 'enroll', offeringId: o.id }), o.feeCents ? 'Enrolled. Finance will confirm payment or sponsorship.' : 'Enrolled.')}>Enroll</Button>}
              </li>))}</ul> : <Empty>No offerings are open right now.</Empty>}
          </Panel>
          {d.roles.length > 0 && <>
            {d.offerings.map((o: any) => <Panel key={o.id} title={o.title}><Offering o={o} d={d} reload={s.reload} /></Panel>)}
            {d.roles.includes('coordinator') && <Panel title="New offering">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <Input aria-label="Code" placeholder="Code (e.g. PM-101)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
                <Input aria-label="Title" placeholder="Title" className="sm:col-span-2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                <Textarea aria-label="Description" placeholder="Description" className="sm:col-span-3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
                <label className="text-xs">Fee ($)<Input type="number" min={0} step={0.01} value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></label>
                <label className="text-xs">Seats<Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></label>
                <label className="text-xs">Minimum attendance (%)<Input type="number" min={0} max={100} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></label>
                <Input aria-label="Prerequisites" placeholder="Prerequisite codes, comma-separated" className="sm:col-span-2" value={f.prereqs} onChange={(e) => setF({ ...f, prereqs: e.target.value })} />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} />Open to anyone (independent learners)</label>
                <div><Button size="sm" disabled={f.code.length < 3 || f.title.trim().length < 3} onClick={async () => { if (await act(() => continuing({ action: 'saveOffering', id: null, code: f.code, title: f.title, description: f.description, feeCents: Math.round(Number(f.fee) * 100), capacity: Number(f.capacity), prereqs: f.prereqs.split(',').map((x) => x.trim()).filter(Boolean), minAttendance: Number(f.min), openToPublic: f.pub, expectedVersion: 0 }), 'Draft created. Add sessions, then publish.')) setF(blank); }}>Create draft</Button></div>
              </div>
            </Panel>}
          </>}
          {d.isAdmin && <Panel title="Continuing-education roles">
            <p className="text-xs">{d.team.map((t: any) => `${t.name} (${t.role})`).join(', ') || 'Nobody yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <select aria-label="Role" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}><option value="coordinator">Coordinator</option><option value="authority">Completion authority</option><option value="finance">Finance</option></select>
              <Button size="sm" disabled={!st.email.includes('@')} onClick={() => act(() => continuing({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => continuing({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Revoked.')}>Revoke</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Coordinators run offerings and attendance; the completion authority waives fees, decides completion and issues credentials; finance records payments and refunds. Nobody grants themselves.</p>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
