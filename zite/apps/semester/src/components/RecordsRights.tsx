import { useState } from 'react';
import { toast } from 'sonner';
import { recordsRights, institutionConsole } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, fmtDay, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const KIND: Record<string, string> = { inspect: 'See my education record', amend: 'Correct my record', directory_optout: 'Withhold my directory information', restrict_disclosure: 'Restrict disclosure to others' };
const run = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => { try { await fn(); toast(ok); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };

/** Student side: ask, track the 45-day clock, read the answer. Rendered on You → Privacy & data. */
export function MyRecordsRights() {
  const s = useLoad(() => recordsRights({ action: 'get' }));
  const [kind, setKind] = useState('inspect');
  const [detail, setDetail] = useState('');
  return (
    <Panel title="Your records rights" className="lg:col-span-2">
      <p className="text-sm text-muted-foreground">You can ask to see your education record, ask for a correction, withhold directory information, or restrict disclosure. Your institution's records office answers within 45 days.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select aria-label="Request type" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Input aria-label="Details" placeholder="Which record, and what you are asking for" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <Button disabled={detail.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'submit', id: crypto.randomUUID(), kind: kind as never, detail }), 'Sent to the records office.', () => { setDetail(''); s.reload(); })}>Send</Button>
      </div>
      <Loadable state={s}>{(d: any) => !d.mine.length ? <div className="mt-3"><Empty>No requests yet.</Empty></div> : (
        <div className="mt-3">{d.mine.map((r: any) => (
          <div key={r.id} className="border-t border-border py-2 text-sm">
            <p className="flex flex-wrap items-center gap-2"><Status value={r.overdue ? 'overdue' : r.state} /> {KIND[r.kind]} · sent {fmtDay(r.createdAt)} · answer due {fmtDay(r.dueAt)}</p>
            <p className="mt-1 text-muted-foreground">{r.detail}</p>
            {r.outcome && <p className="mt-1">Answer: {r.outcome}</p>}
            {['submitted', 'acknowledged'].includes(r.state) && <Button size="sm" variant="ghost" onClick={() => run(() => recordsRights({ action: 'withdraw', id: r.id }), 'Withdrawn.', s.reload)}>Withdraw</Button>}
          </div>))}</div>)}
      </Loadable>
    </Panel>
  );
}

function Handle({ r, reload }: { r: any; reload: () => void }) {
  const [note, setNote] = useState('');
  if (r.own) return <p className="mt-1 text-xs text-muted-foreground">This is your own request; another member of the office answers it.</p>;
  const cannotDeny = ['directory_optout', 'restrict_disclosure'].includes(r.kind);
  return (
    <div className="mt-2 space-y-2">
      {r.state === 'submitted' && <Button size="sm" variant="outline" onClick={() => run(() => recordsRights({ action: 'handle', id: r.id, version: r.version, decision: 'acknowledge', note: '' }), 'Acknowledged.', reload)}>Acknowledge</Button>}
      <Textarea aria-label="Outcome" rows={2} placeholder="What was done, or why not (10+ characters). The student reads this." value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={note.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'handle', id: r.id, version: r.version, decision: 'fulfill', note }), 'Fulfilled. The student was notified.', reload)}>Fulfilled</Button>
        {!cannotDeny && <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'handle', id: r.id, version: r.version, decision: 'deny', note }), 'Denied. The student was notified.', reload)}>Deny</Button>}
      </div>
      {r.kind === 'amend' && <p className="text-xs text-muted-foreground">A denial automatically tells the student they may request a hearing. The correction itself goes through the registrar or grade-change workflow.</p>}
    </div>
  );
}

function Review({ d, reload }: { d: any; reload: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const rv = d.openReview;
  if (!rv) return (
    <div>
      <p className="text-sm text-muted-foreground">Certify who still needs access. Opening a review snapshots every membership and its roles; each one is kept or removed by an administrator other than that person.</p>
      <Button className="mt-2" size="sm" onClick={() => run(() => recordsRights({ action: 'openReview', id: crypto.randomUUID() }), 'Access review opened.', reload)}>Open access review</Button>
      {d.reviews.length > 0 && <ul className="mt-3 text-xs text-muted-foreground">{d.reviews.map((r: any) => <li key={r.id}>Review #{r.number} · {r.state} · opened {fmtDay(r.openedAt)}{r.closedAt ? ` · closed ${fmtDay(r.closedAt)}` : ''}</li>)}</ul>}
    </div>
  );
  const left = rv.lines.filter((l: any) => !l.decision).length;
  return (
    <div>
      <p className="text-sm">Review #{rv.number} · {left} of {rv.lines.length} still to decide</p>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Member</th><th>Roles</th><th>Decision</th><th /></tr></thead>
        <tbody>{rv.lines.map((l: any) => (
          <tr key={l.membershipId} className="border-t border-border align-top">
            <td className="py-2">{l.name}<div className="text-xs text-muted-foreground">{l.status}{l.currentStatus !== l.status ? ` → now ${l.currentStatus}` : ''}</div></td>
            <td className="py-2">{l.roles.join(', ') || '—'}</td>
            <td className="py-2">{l.decision ? <><Status value={l.decision} /><div className="text-xs text-muted-foreground">{l.decidedBy}{l.note ? ` · ${l.note}` : ''}</div></> : l.self ? <span className="text-xs text-muted-foreground">Another administrator certifies you</span> : '—'}</td>
            <td className="py-2">{!l.self && <div className="flex flex-col gap-1 sm:flex-row">
              <Input aria-label={`Reason for ${l.name}`} className="h-8" placeholder="Reason (needed to remove)" value={notes[l.membershipId] ?? ''} onChange={(e) => setNotes({ ...notes, [l.membershipId]: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => run(() => recordsRights({ action: 'decideLine', reviewId: rv.id, membershipId: l.membershipId, decision: 'keep', note: notes[l.membershipId] ?? '' }), 'Kept.', reload)}>Keep</Button>
              <Button size="sm" variant="outline" onClick={() => run(() => recordsRights({ action: 'decideLine', reviewId: rv.id, membershipId: l.membershipId, decision: 'remove', note: notes[l.membershipId] ?? '' }), 'Marked for removal.', reload)}>Remove</Button>
              {l.decision === 'remove' && l.currentStatus === 'Active' && <Button size="sm" onClick={() => run(() => institutionConsole({ action: 'setMemberStatus', membershipId: l.membershipId, status: 'Suspended' } as never), 'Membership suspended.', reload)}>Suspend now</Button>}
            </div>}</td>
          </tr>))}</tbody>
      </table></div>
      <Button className="mt-3" size="sm" disabled={left > 0} onClick={() => run(() => recordsRights({ action: 'closeReview', reviewId: rv.id }), 'Review closed.', reload)}>Close review</Button>
    </div>
  );
}

/** Institution Console tab: records-privacy queue, access reviews, office membership. */
export default function PrivacyOffice() {
  const s = useLoad(() => recordsRights({ action: 'get' }));
  const [who, setWho] = useState('');
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="grid gap-4">
        {d.office ? <Panel title={`Records-rights requests · ${d.queue.filter((r: any) => ['submitted', 'acknowledged'].includes(r.state)).length} open`}>
          {!d.queue.length ? <Empty>No requests.</Empty> : d.queue.map((r: any) => (
            <div key={r.id} className="border-t border-border py-3 text-sm first:border-0">
              <p className="flex flex-wrap items-center gap-2"><Status value={r.overdue ? 'overdue' : r.state} /> #{r.number} · {r.requester} · {KIND[r.kind]} · due {fmtDay(r.dueAt)}</p>
              <p className="mt-1">{r.detail}</p>
              {r.outcome && <p className="mt-1 text-muted-foreground">Answer ({fmt(r.handledAt)}): {r.outcome}</p>}
              {['submitted', 'acknowledged'].includes(r.state) && <Handle r={r} reload={s.reload} />}
            </div>))}
        </Panel> : <Panel title="Records-rights requests"><Empty>Only members of the records-privacy office see this queue.</Empty></Panel>}
        {d.isAdmin && <Panel title="Access review"><Review d={d} reload={s.reload} /></Panel>}
        {d.isAdmin && <Panel title="Records-privacy office">
          <ul className="text-sm">{d.officeStaff.map((m: any) => <li key={m.id} className="flex items-center justify-between py-1">{m.name}<Button size="sm" variant="ghost" onClick={() => run(() => recordsRights({ action: 'setOffice', userId: m.id, on: false }), 'Removed.', s.reload)}>Remove</Button></li>)}</ul>
          {!d.officeStaff.length && <Empty>No one handles records requests yet.</Empty>}
          <div className="mt-2 flex gap-2">
            <select aria-label="Member" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose a member…</option>{d.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <Button size="sm" disabled={!who} onClick={() => run(() => recordsRights({ action: 'setOffice', userId: who, on: true }), 'Added to the office.', () => { setWho(''); s.reload(); })}>Add</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You cannot add yourself. Office members never answer their own request.</p>
        </Panel>}
      </div>)}
    </Loadable>
  );
}
