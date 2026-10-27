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

/** Student side: ask, track the 45-day clock, open the approved response (14 days), request a hearing; record owners
 *  also see records they need to collect. Rendered on You → Privacy & data. */
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
            {r.response?.open && <Package id={r.id} />}
            {r.response?.expired && <p className="mt-1 text-xs text-muted-foreground">Your records were available to open for 14 days. Ask the records office to send them again.</p>}
            {r.hearing && <p className="mt-1 text-xs">Hearing requested {fmtDay(r.hearing.requestedAt)}{r.hearing.outcome ? ` · decided: ${r.hearing.outcome === 'amended' ? 'your record will be corrected' : 'the record stands'} — ${r.hearing.note}` : ' · waiting for a decision'}</p>}
            {r.canRequestHearing && <HearingRequest id={r.id} reload={s.reload} />}
            {['submitted', 'acknowledged'].includes(r.state) && <Button size="sm" variant="ghost" onClick={() => run(() => recordsRights({ action: 'withdraw', id: r.id }), 'Withdrawn.', s.reload)}>Withdraw</Button>}
          </div>))}</div>)}
      </Loadable>
      <Loadable state={s}>{(d: any) => d.ownerTasks?.length > 0 && <OwnerTasks tasks={d.ownerTasks} reload={s.reload} />}
      </Loadable>
    </Panel>
  );
}

function Package({ id }: { id: string }) {
  const [pkg, setPkg] = useState<any>(null);
  if (!pkg) return <Button size="sm" className="mt-2" onClick={async () => { try { const r: any = await recordsRights({ action: 'view', id }); setPkg(r.result); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Open my records</Button>;
  return (
    <div className="mt-2 space-y-1 rounded-[3px] bg-muted p-2 text-xs">
      {pkg.records.map((x: any, i: number) => <p key={i}><b>{x.source}{x.redacted ? ' (parts removed to protect others)' : ''}:</b> {x.content}</p>)}
      {pkg.withheld.map((x: any, i: number) => <p key={`w${i}`}><b>{x.source}:</b> not released — {x.reason}</p>)}
    </div>
  );
}

function HearingRequest({ id, reload }: { id: string; reload: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Input aria-label="Why the record is wrong" placeholder="Why the record is inaccurate or misleading" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button size="sm" variant="outline" disabled={reason.trim().length < 20} onClick={() => run(() => recordsRights({ action: 'hearingRequest', id, reason }), 'Hearing requested.', reload)}>Request a hearing</Button>
    </div>
  );
}

function OwnerTasks({ tasks, reload }: { tasks: any[]; reload: () => void }) {
  const [v, setV] = useState<Record<number, { note: string; third: boolean }>>({});
  const get = (id: number) => v[id] ?? { note: '', third: false };
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-sm font-medium">Records you keep that a request needs · {tasks.length}</p>
      {tasks.map((t) => (
        <div key={t.itemId} className="mt-2 space-y-2 text-sm">
          <p>Request #{t.number} from {t.student}: {t.source} — {t.description}</p>
          <Input aria-label="What you found" placeholder="What you found and where it is kept" value={get(t.itemId).note} onChange={(e) => setV({ ...v, [t.itemId]: { ...get(t.itemId), note: e.target.value } })} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={get(t.itemId).third} onChange={(e) => setV({ ...v, [t.itemId]: { ...get(t.itemId), third: e.target.checked } })} /> It also mentions other people</label>
          <Button size="sm" disabled={get(t.itemId).note.trim().length < 5} onClick={() => run(() => recordsRights({ action: 'collect', itemId: t.itemId, note: get(t.itemId).note, thirdParty: get(t.itemId).third }), 'Recorded.', reload)}>Mark collected</Button>
        </div>))}
    </div>
  );
}

const DEC: Record<string, string> = { release: 'Release', redact: 'Release with redactions', withhold: 'Withhold' };

function Item({ i, reload }: { i: any; reload: () => void }) {
  const [dec, setDec] = useState(i.decision ?? '');
  const [reason, setReason] = useState(i.reason);
  const [red, setRed] = useState(i.redaction);
  return (
    <li className="border-t border-border py-2 text-xs first:border-0">
      <p><b>{i.source}</b> — {i.description} · {i.owner} · {i.collected ? `collected: ${i.collectedNote}` : 'waiting for the owner'}{i.thirdParty ? ' · mentions others' : ''}</p>
      {i.decision && <p>Decision: {DEC[i.decision]}{i.reason ? ` — ${i.reason}` : ''}{i.redaction ? ` · student sees: ${i.redaction}` : ''}</p>}
      {i.collected && <div className="mt-1 flex flex-wrap items-end gap-2">
        <select aria-label="Decision" className="rounded-[3px] border border-input bg-background p-1 text-xs" value={dec} onChange={(e) => setDec(e.target.value)}><option value="">Decide…</option>{Object.entries(DEC).filter(([k]) => k !== 'release' || !i.thirdParty).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {dec === 'withhold' && <Input aria-label="Reason" className="h-8 max-w-xs" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />}
        {dec === 'redact' && <Input aria-label="What the student sees" className="h-8 max-w-sm" placeholder="What the student will see" value={red} onChange={(e) => setRed(e.target.value)} />}
        <Button size="sm" variant="outline" disabled={!dec} onClick={() => run(() => recordsRights({ action: 'decideItem', itemId: i.id, decision: dec as never, reason, redaction: red }), 'Saved. Any prepared response must be prepared and approved again.', reload)}>Save</Button>
      </div>}
    </li>
  );
}

function Inspect({ r, people, reload }: { r: any; people: any[]; reload: () => void }) {
  const [f, setF] = useState({ source: '', description: '', ownerId: '' });
  const resp = r.response;
  return (
    <div className="mt-2 space-y-2">
      {r.items.length > 0 && <ul>{r.items.map((i: any) => <Item key={i.id} i={i} reload={reload} />)}</ul>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Where the record is kept" className="h-8" placeholder="Where (e.g. Advising)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
        <Input aria-label="Which record" className="h-8" placeholder="Which record" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <select aria-label="Record owner" className="rounded-[3px] border border-input bg-background p-1 text-sm" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">Owner…</option>{people.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <Button size="sm" variant="outline" disabled={f.source.trim().length < 2 || f.description.trim().length < 5 || !f.ownerId} onClick={() => run(() => recordsRights({ action: 'route', id: r.id, ...f }), 'Routed to the owner.', () => { setF({ source: '', description: '', ownerId: '' }); reload(); })}>Route record</Button>
      </div>
      <p className="text-xs text-muted-foreground">{!resp ? 'Not prepared yet.' : resp.approved ? 'Approved — you can now mark it fulfilled; the student can open it for 14 days.' : resp.preparedByMe ? 'Prepared by you — another office member approves it.' : 'Prepared — waiting for approval.'}</p>
      <div className="flex gap-2">
        {r.items.length > 0 && (!resp || !resp.approved) && <Button size="sm" variant="outline" onClick={() => run(() => recordsRights({ action: 'prepare', id: r.id }), 'Prepared for approval.', reload)}>Prepare response</Button>}
        {resp && !resp.approved && !resp.preparedByMe && <Button size="sm" onClick={() => run(() => recordsRights({ action: 'approve', id: r.id }), 'Approved.', reload)}>Approve response</Button>}
      </div>
    </div>
  );
}

function Hearing({ r, reload }: { r: any; reload: () => void }) {
  const [note, setNote] = useState('');
  if (!r.hearing || r.hearing.outcome) return r.hearing ? <p className="mt-1 text-xs">Hearing decided: {r.hearing.outcome} — {r.hearing.note}</p> : null;
  if (r.hearing.deniedByMe) return <p className="mt-1 text-xs text-muted-foreground">Hearing requested. You denied the amendment, so another office member decides it.</p>;
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs">Hearing requested: {r.hearing.reason}</p>
      <Textarea aria-label="Hearing outcome" rows={2} placeholder="Outcome and reasons" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" disabled={note.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'hearingDecide', id: r.id, outcome: 'amended', note }), 'Recorded: amend the record through the registrar workflow.', reload)}>Amend the record</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'hearingDecide', id: r.id, outcome: 'upheld', note }), 'Recorded: the record stands.', reload)}>Record stands</Button></div>
    </div>
  );
}

function Holds({ d, reload }: { d: any; reload: () => void }) {
  const [h, setH] = useState({ subjectId: '', reason: '' });
  const [rel, setRel] = useState<Record<number, string>>({});
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">A hold keeps a student's records exactly as they are (for example during a grievance). While it is active, amendments cannot be fulfilled. Another office member releases it.</p>
      {d.holds.map((x: any) => <div key={x.id} className="flex flex-wrap items-center gap-2 border-t border-border py-1 text-xs">{x.student}: {x.reason} · by {x.placedBy} {fmtDay(x.placedAt)}
        {!x.placedByMe && <><Input aria-label="Release reason" className="h-7 w-48" placeholder="Release reason" value={rel[x.id] ?? ''} onChange={(e) => setRel({ ...rel, [x.id]: e.target.value })} />
          <Button size="sm" variant="ghost" disabled={(rel[x.id] ?? '').trim().length < 10} onClick={() => run(() => recordsRights({ action: 'release', holdId: x.id, reason: rel[x.id] }), 'Released.', reload)}>Release</Button></>}</div>)}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label="Student" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={h.subjectId} onChange={(e) => setH({ ...h, subjectId: e.target.value })}><option value="">Student…</option>{d.people.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <Input aria-label="Hold reason" placeholder="Reason for the hold" value={h.reason} onChange={(e) => setH({ ...h, reason: e.target.value })} />
        <Button size="sm" disabled={!h.subjectId || h.reason.trim().length < 10} onClick={() => run(() => recordsRights({ action: 'hold', ...h }), 'Hold placed.', () => { setH({ subjectId: '', reason: '' }); reload(); })}>Place hold</Button>
      </div>
    </div>
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
              {r.held && <p className="mt-1 text-xs">Records hold active for this student.</p>}
              {r.kind === 'inspect' && !r.own && ['submitted', 'acknowledged'].includes(r.state) && <Inspect r={r} people={d.people} reload={s.reload} />}
              {['submitted', 'acknowledged'].includes(r.state) && <Handle r={r} reload={s.reload} />}
              {!r.own && <Hearing r={r} reload={s.reload} />}
            </div>))}
        </Panel> : <Panel title="Records-rights requests"><Empty>Only members of the records-privacy office see this queue.</Empty></Panel>}
        {d.office && <Panel title={`Records holds · ${d.holds.length}`}><Holds d={d} reload={s.reload} /></Panel>}
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
