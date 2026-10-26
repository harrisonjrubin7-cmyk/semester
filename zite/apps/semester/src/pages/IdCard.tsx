import { useState } from 'react';
import { toast } from 'sonner';
import { idCard } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `idc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const CSTATE: Record<string, string> = { active: 'Active', revoke_requested: 'Being cancelled — not yet confirmed', revoked: 'Cancelled' };
const GLABEL: Record<string, string> = { approve: 'Approve', deny: 'Deny', confirm: 'Record door-system confirmation', revoke: 'Remove access' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Grant({ g, reload }: { g: any; reload: () => void }) {
  const act = useAct(reload);
  const [ref, setRef] = useState('');
  return (
    <li className="border-t border-border py-2 text-sm first:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b>{g.zone}</b>{g.restricted ? ' · restricted' : ''}{g.holder ? ` · ${g.holder}` : ''}{g.card ? ` · ${g.card}` : ''}<span className="block text-xs text-muted-foreground">{g.reason}{g.pendingSince && (g.state === 'provision_requested' || g.state === 'revoke_requested') ? ` · waiting since ${fmt(g.pendingSince)}` : ''}</span></span>
        <span className="flex items-center gap-2">{g.stale && <Status value="Unconfirmed over 24h — check the door system" />}<Status value={g.status} /></span>
      </div>
      {g.steps.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">
        {g.steps.includes('confirm') && <Input aria-label="Confirmation reference" placeholder="Door system confirmation ref" className="h-8 max-w-xs" value={ref} onChange={(e) => setRef(e.target.value)} />}
        {g.steps.map((s: string) => <Button key={s} size="sm" variant={s === 'approve' || s === 'confirm' ? 'default' : 'outline'} disabled={s === 'confirm' && ref.trim().length < 3}
          onClick={() => act(() => idCard({ action: 'grantStep', id: g.id, step: s as never, expectedVersion: g.version, ref }), s === 'approve' ? 'Approved. Now waiting for the door system to confirm.' : 'Recorded.')}>{GLABEL[s]}</Button>)}
      </div>}
    </li>
  );
}

function MyCard({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const card = d.myCards.find((c: any) => c.state !== 'revoked') ?? d.myCards[0];
  const [zone, setZone] = useState('');
  const [reason, setReason] = useState('');
  const [lost, setLost] = useState(false);
  const [why, setWhy] = useState('');
  if (!card) return <Empty>You do not have a campus card in Semester yet. The card office issues it.</Empty>;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span>Card <b className="tabular-nums">{card.ref}</b> · {card.affiliation}{card.validTo ? ` · valid to ${card.validTo}` : ''}</span><Status value={CSTATE[card.state] ?? card.state} /></div>
      {card.state === 'revoke_requested' && <p className="text-xs">Cancellation requested ({card.revokeReason}). Until the card office confirms it, treat the card as possibly still working.</p>}
      {card.state === 'active' && (lost ? (
        <div className="flex flex-wrap gap-2"><Input aria-label="What happened" placeholder="Lost, stolen…" className="max-w-xs" value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button size="sm" variant="destructive" disabled={why.trim().length < 4} onClick={() => act(() => idCard({ action: 'cardStep', id: card.id, step: 'revoke', expectedVersion: card.version, note: why }), 'Cancellation requested. All door access on this card is being removed.')}>Cancel my card</Button></div>
      ) : <Button size="sm" variant="outline" onClick={() => setLost(true)}>Report lost or stolen</Button>)}
      <div><p className="text-xs font-medium">Door access</p>{d.myGrants.length ? <ul>{d.myGrants.map((g: any) => <Grant key={g.id} g={g} reload={reload} />)}</ul> : <p className="text-xs text-muted-foreground">No door access yet.</p>}</div>
      {card.state === 'active' && d.zones.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Request access to<select className={sel} value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Choose…</option>{d.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}{z.restricted ? ' (restricted)' : ''}</option>)}</select></label>
        <Input aria-label="Why you need it" placeholder="Why you need it" className="max-w-xs" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" disabled={!zone || reason.trim().length < 5} onClick={async () => { if (await act(() => idCard({ action: 'requestGrant', cardId: card.id, zoneId: Number(zone), reason }), 'Requested.')) { setZone(''); setReason(''); } }}>Request</Button></div>}
    </div>
  );
}

function Office({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [f, setF] = useState({ email: '', cardRef: '', affiliation: 'student', eligibilityNote: '', validTo: '', replacesId: '' });
  const [k, setK] = useState(key());
  const [refs, setRefs] = useState<Record<number, string>>({});
  const [q, setQ] = useState('');
  const shown = d.cards.filter((c: any) => !q || `${c.ref} ${c.holder}`.toLowerCase().includes(q.toLowerCase())).slice(0, 100);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="text-xs font-medium sm:col-span-2">Issue a card</p>
        <Input aria-label="Holder email" placeholder="Holder email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input aria-label="Card reference" placeholder="Office reference, e.g. VU-2026-0412 (never the card number)" value={f.cardRef} onChange={(e) => setF({ ...f, cardRef: e.target.value })} />
        <select aria-label="Affiliation" className={sel} value={f.affiliation} onChange={(e) => setF({ ...f, affiliation: e.target.value })}><option value="student">Student</option><option value="staff">Staff</option><option value="faculty">Faculty</option><option value="visitor">Visitor</option></select>
        <Input aria-label="Valid to" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} />
        <Input aria-label="Eligibility check" className="sm:col-span-2" placeholder="How eligibility was checked" value={f.eligibilityNote} onChange={(e) => setF({ ...f, eligibilityNote: e.target.value })} />
        <Input aria-label="Replaces card number" inputMode="numeric" placeholder="Replaces card # (for a replacement)" value={f.replacesId} onChange={(e) => setF({ ...f, replacesId: e.target.value.replace(/\D/g, '') })} />
        <div><Button size="sm" disabled={!f.email.includes('@') || f.cardRef.trim().length < 3 || f.eligibilityNote.trim().length < 5} onClick={async () => { if (await act(() => idCard({ action: 'issue', requestKey: k, email: f.email, cardRef: f.cardRef, affiliation: f.affiliation as never, eligibilityNote: f.eligibilityNote, validTo: f.validTo || null, replacesId: f.replacesId ? Number(f.replacesId) : null }), 'Card issued.')) { setK(key()); setF({ ...f, email: '', cardRef: '', eligibilityNote: '', replacesId: '' }); } }}>Issue card</Button></div>
      </div>
      <div>
        <Input aria-label="Search cards" placeholder="Search reference or holder" className="mb-2 max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        {shown.length ? <ul>{shown.map((c: any) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-0">
            <span>#{c.id} <b className="tabular-nums">{c.ref}</b> · {c.holder} · {c.affiliation}{c.replacesId ? ` · replaces #${c.replacesId}` : ''}{c.revokeReason ? <span className="block text-xs text-muted-foreground">{c.revokeReason}</span> : null}</span>
            <span className="flex flex-wrap items-center gap-2">{c.stale && <Status value="Unconfirmed over 24h" />}<Status value={CSTATE[c.state] ?? c.state} />
              {c.state === 'revoke_requested' && <><Input aria-label="Card system confirmation" placeholder="Card system ref" className="h-8 w-36" value={refs[c.id] ?? ''} onChange={(e) => setRefs({ ...refs, [c.id]: e.target.value })} />
                <Button size="sm" disabled={(refs[c.id] ?? '').trim().length < 3} onClick={() => act(() => idCard({ action: 'cardStep', id: c.id, step: 'confirm_revoke', expectedVersion: c.version, ref: refs[c.id] }), 'Cancellation confirmed.')}>Confirm cancelled</Button></>}</span>
          </li>))}</ul> : <Empty>No cards.</Empty>}
      </div>
    </div>
  );
}

function Setup({ d, reload }: { d: any; reload: () => void }) {
  const act = useAct(reload);
  const [z, setZ] = useState({ name: '', restricted: false });
  const [s, setS] = useState({ email: '', kind: 'officer' });
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      {d.kind && <div className="space-y-2"><p className="text-xs font-medium">Access zones · {d.zones.length}</p>
        <ul className="text-xs">{d.zones.map((x: any) => <li key={x.id}>{x.name}{x.restricted ? ' (restricted)' : ''}</li>)}</ul>
        <Input aria-label="Zone name" placeholder="Zone name" value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} />
        {d.kind === 'security' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={z.restricted} onChange={(e) => setZ({ ...z, restricted: e.target.checked })} /> Restricted — security approves access</label>}
        <Button size="sm" disabled={z.name.trim().length < 2} onClick={() => act(() => idCard({ action: 'zone', ...z }), 'Zone added.')}>Add zone</Button></div>}
      {d.isAdmin && <div className="space-y-2"><p className="text-xs font-medium">Card office and security</p>
        <ul className="text-xs">{d.staff.map((x: any, i: number) => <li key={i}>{x.name} — {x.kind}</li>)}</ul>
        <Input aria-label="Member email" placeholder="Member email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} />
        <select aria-label="Role" className={sel} value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value })}><option value="officer">Card-office officer</option><option value="security">Security approver</option><option value="none">Remove access</option></select>
        <Button size="sm" disabled={!s.email.includes('@')} onClick={() => act(() => idCard({ action: 'setStaff', email: s.email, kind: s.kind as never }), 'Saved.')}>Save</Button>
        <p className="text-xs text-muted-foreground">You cannot change your own access.</p></div>}
    </div>
  );
}

export default function IdCard() {
  const s = useLoad(() => idCard({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="ID card" sub="Your campus card and door access. Semester records requests and confirmations; it does not switch doors on or off, so nothing shows as done until the door or card system confirms it." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="My card"><MyCard d={d} reload={s.reload} /></Panel>
          {d.kind && <Panel title={`Access waiting · ${d.queue.length}`}>{d.queue.length ? <ul>{d.queue.map((g: any) => <Grant key={g.id} g={g} reload={s.reload} />)}</ul> : <Empty>Nothing waiting.</Empty>}</Panel>}
          {d.kind === 'officer' && <Panel title="Card office"><Office d={d} reload={s.reload} /></Panel>}
          {(d.kind || d.isAdmin) && <Panel title="Set up"><Setup d={d} reload={s.reload} /></Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
