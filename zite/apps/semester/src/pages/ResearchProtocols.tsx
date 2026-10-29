import { useState } from 'react';
import { toast } from 'sonner';
import { researchProtocols } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Protocol = { id: number; partner: string | null; mine: boolean; organization: string; title: string; aims: string; ethicsRef: string; datasets: string[]; retentionDays: number; hash: string; state: string; reviewer: string | null; reviewNote: string; createdAt: string | null };
type Agreement = { id: number; protocolId: number; days: number; issuedBy: string | null; issuedAt: string | null; acceptedAt: string | null; expiresAt: string | null; revokedAt: string | null; revokedReason: string | null; active: boolean };
type Output = { id: number; protocolId: number; mine: boolean; title: string; body: string; cites: number[]; smallNumbers: boolean; state: string; reviewer: string | null; reviewNote: string; createdAt: string | null };
type Data = { protocols: Protocol[]; agreements: Agreement[]; outputs: Output[] };

const run = async (input: Record<string, unknown>, ok: string, reload: () => void) => { try { await researchProtocols(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };

function OutputRow({ o, reload }: { o: Output; reload: () => void }) {
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  return (
    <div className="border-t border-border py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{o.title}</p><Status value={o.state} /></div>
      <p className="whitespace-pre-wrap text-sm">{o.body}</p>
      <p className="text-xs text-muted-foreground">Cites snapshots {o.cites.map((c) => `#${c}`).join(', ')} · {fmt(o.createdAt)}{o.reviewer ? ` · reviewed by ${o.reviewer}` : ''}{o.reviewNote ? ` · “${o.reviewNote}”` : ''}</p>
      {o.state === 'submitted' && !o.mine && <div className="mt-2 space-y-2">
        {o.smallNumbers && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>This text contains a number under 10. I checked it is not a count of people.</span></label>}
        <div className="flex flex-wrap items-center gap-2"><Input aria-label="What you checked" className="h-8 w-72" placeholder="What you checked (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={note.trim().length < 10 || (o.smallNumbers && !ack)} onClick={() => run({ action: 'reviewOutput', id: o.id, step: 'approve', confirmNoSmallCounts: ack, note }, 'Cleared for release', reload)}>Clear for release</Button>
          <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'reviewOutput', id: o.id, step: 'return', note }, 'Returned to the partner', reload)}>Return</Button>
          <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'reviewOutput', id: o.id, step: 'reject', note }, 'Rejected', reload)}>Reject</Button></div>
      </div>}
    </div>
  );
}

function ProtocolCard({ p, d, reload }: { p: Protocol; d: Data; reload: () => void }) {
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  const [days, setDays] = useState(Math.min(180, p.retentionDays));
  const [reason, setReason] = useState('');
  const ag = d.agreements.filter((g) => g.protocolId === p.id);
  const live = ag.find((g) => !g.revokedAt);
  const outs = d.outputs.filter((o) => o.protocolId === p.id);
  return (
    <Panel title={`${p.title} — ${p.organization}`} action={<Status value={p.state} />}>
      <p className="text-sm">{p.aims}</p>
      <p className="mt-1 text-xs text-muted-foreground">Partner {p.mine ? 'you' : p.partner} · ethics {p.ethicsRef} · datasets: {p.datasets.join(', ')} · retention {p.retentionDays} days · submitted {fmt(p.createdAt)}{p.reviewer ? ` · decided by ${p.reviewer}` : ''}{p.reviewNote ? ` · “${p.reviewNote}”` : ''}</p>
      {p.state === 'submitted' && (p.mine ? <p className="mt-2 text-xs text-muted-foreground">You submitted this, so another data steward reviews it.</p> : (
        <div className="mt-2 flex flex-wrap items-center gap-2"><Input aria-label="Governance decision" className="h-8 w-80" placeholder="Governance decision and why (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={note.trim().length < 10} onClick={() => run({ action: 'review', id: p.id, approve: true, seenHash: p.hash, note }, 'Protocol approved', reload)}>Approve this protocol</Button>
          <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'review', id: p.id, approve: false, seenHash: p.hash, note }, 'Protocol rejected', reload)}>Reject</Button></div>))}

      {p.state === 'approved' && <div className="mt-3 space-y-2">
        <h3 className="text-sm font-medium">Data-use agreement</h3>
        {live ? (
          <div className="text-sm"><p>Agreement #{live.id}, {live.days} days, issued by {live.issuedBy} {fmt(live.issuedAt)} — {live.acceptedAt ? (live.active ? `accepted, active until ${fmt(live.expiresAt)}` : `expired ${fmt(live.expiresAt)}`) : 'waiting for the partner to accept'}.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><Input aria-label="Reason for revoking" className="h-8 w-72" placeholder="Reason (the partner sees this)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" variant="outline" disabled={reason.trim().length < 10} onClick={() => run({ action: 'revoke', agreementId: live.id, reason }, 'Agreement revoked; access ended', reload)}>Revoke</Button></div></div>
        ) : (
          <div className="space-y-2"><Label htmlFor={`terms-${p.id}`}>Terms</Label><Textarea id={`terms-${p.id}`} rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} aria-describedby={`terms-h-${p.id}`} />
            <p id={`terms-h-${p.id}`} className="text-xs text-muted-foreground">At least 200 characters. The partner must accept exactly this text. Signing a legal agreement outside Semester is your institution's process; this records the terms and the acceptance.</p>
            <div className="flex flex-wrap items-center gap-2"><Label htmlFor={`days-${p.id}`}>Days</Label><Input id={`days-${p.id}`} type="number" className="h-8 w-24" min={1} max={p.retentionDays} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              <Button size="sm" disabled={terms.trim().length < 200} onClick={() => run({ action: 'issue', protocolId: p.id, terms, days }, 'Agreement issued to the partner', reload)}>Issue agreement</Button></div></div>
        )}
        {ag.filter((g) => g.revokedAt).map((g) => <p key={g.id} className="text-xs text-muted-foreground">Agreement #{g.id} ended {fmt(g.revokedAt)}{g.revokedReason ? `: ${g.revokedReason}` : ''}</p>)}
      </div>}

      {outs.length > 0 && <div className="mt-3"><h3 className="text-sm font-medium">Outputs for release review</h3>{outs.map((o) => <OutputRow key={o.id} o={o} reload={reload} />)}</div>}
    </Panel>
  );
}

export default function ResearchProtocols() {
  const s = useLoad(() => researchProtocols({ action: 'get' }) as Promise<Data>);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Data governance" title="Research partner protocols" sub="Review partner research requests, issue data-use agreements and clear outputs before release. Partners only ever see approved, suppressed aggregate snapshots." />
      <Loadable state={s}>{(d: Data) => d.protocols.length === 0 ? <Empty>No research partner has requested access yet.</Empty> : <>{d.protocols.map((p) => <ProtocolCard key={p.id} p={p} d={d} reload={s.reload} />)}</>}</Loadable>
    </div>
  );
}
