import { useState } from 'react';
import { toast } from 'sonner';
import { researchPartner } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { useLoad } from '../hooks';
import { errorMessage } from '../util';

type Cell = { label: string; display: string; suppressed: boolean };
type Snap = { id: number; defId: number; dataset: string; codeVersion: string; minCell: number; output: { tables?: { key: string; label: string; cells: Cell[]; totalDisplay: string }[] }; outputHash: string; runAt: string | null };
type Protocol = { id: number; institution: string; organization: string; title: string; aims: string; ethicsRef: string; datasetIds: number[]; datasets: string[]; retentionDays: number; state: string; reviewNote: string; createdAt: string | null };
type Agreement = { id: number; protocolId: number; terms: string; termsHash: string; days: number; issuedAt: string | null; acceptedAt: string | null; expiresAt: string | null; revokedAt: string | null; revokedReason: string | null; active: boolean };
type Output = { id: number; protocolId: number; title: string; body: string; cites: number[]; smallNumbers: boolean; state: string; reviewNote: string; createdAt: string | null };
type D = { institutions: { id: string; name: string }[]; offered: { id: number; title: string; purpose: string; version: number }[]; protocols: Protocol[]; agreements: Agreement[]; outputs: Output[]; snapshots: Snap[] };

const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-lg border bg-card p-4"><h3 className="eyebrow mb-3">{title}</h3>{children}</section>;
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

function SnapshotView({ s }: { s: Snap }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">{s.dataset} <span className="text-xs text-muted-foreground">· run {fmt(s.runAt)} · code {s.codeVersion} · cells under {s.minCell} hidden · snapshot #{s.id}</span></p>
      {(s.output.tables ?? []).length === 0 ? <Muted>This snapshot has no tables.</Muted> : (s.output.tables ?? []).map((t) => (
        <table key={t.key} className="mt-2 w-full text-left text-xs"><caption className="text-left font-medium">{t.label} (total {t.totalDisplay})</caption>
          <tbody>{t.cells.map((c) => <tr key={c.label} className="border-t"><td className="py-1">{c.label}</td><td className="py-1 text-right">{c.suppressed ? <span title="Too few people to show">Hidden (fewer than {s.minCell})</span> : c.display}</td></tr>)}</tbody></table>))}
    </div>
  );
}

function NewProtocol({ d, inst, setInst, onDone }: { d: D; inst: string; setInst: (v: string) => void; onDone: (x: D) => void }) {
  const [f, setF] = useState({ organization: '', title: '', aims: '', ethicsRef: '', retentionDays: 365 });
  const [pick, setPick] = useState<number[]>([]);
  const [key] = useState(() => `rp-${crypto.randomUUID()}`);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const x = await researchPartner({ action: 'submit', requestKey: key, institutionId: inst, ...f, datasets: pick }); toast.success('Protocol submitted for governance review'); onDone(x as D); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Section title="Request access">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="rp-inst">Institution</Label>
          <select id="rp-inst" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={inst} onChange={(e) => { setInst(e.target.value); setPick([]); }}>
            <option value="">Choose…</option>{d.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="rp-org">Your organization</Label><Input id="rp-org" value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="rp-title">Study title</Label><Input id="rp-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="rp-aims">Research aims</Label><Textarea id="rp-aims" rows={3} value={f.aims} onChange={(e) => setF({ ...f, aims: e.target.value })} aria-describedby="rp-aims-h" /><p id="rp-aims-h" className="text-xs text-muted-foreground">At least 40 characters. The data steward approves exactly what you write here.</p></div>
        <div className="space-y-1"><Label htmlFor="rp-eth">Ethics / IRB reference</Label><Input id="rp-eth" value={f.ethicsRef} onChange={(e) => setF({ ...f, ethicsRef: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="rp-days">Retention (days, 30–1095)</Label><Input id="rp-days" type="number" min={30} max={1095} value={f.retentionDays} onChange={(e) => setF({ ...f, retentionDays: Number(e.target.value) })} /></div>
      </div>
      <fieldset className="mt-3"><legend className="text-sm font-medium">Approved datasets</legend>
        {!inst ? <Muted>Choose an institution to see the datasets its data stewards have approved.</Muted> : d.offered.length === 0 ? <Muted>This institution has no approved datasets yet.</Muted> :
          d.offered.map((o) => <label key={o.id} className="mt-1 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={pick.includes(o.id)} onChange={(e) => setPick(e.target.checked ? [...pick, o.id] : pick.filter((x) => x !== o.id))} /><span><span className="font-medium">{o.title} v{o.version}</span> — {o.purpose}</span></label>)}
      </fieldset>
      <Button className="mt-3" disabled={busy || !inst || pick.length === 0} onClick={submit}>Submit for review</Button>
      <p className="mt-2 text-xs text-muted-foreground">Access only covers aggregate snapshots that the institution has already run with small-cell suppression. No student-level data is ever available here.</p>
    </Section>
  );
}

function ProtocolCard({ p, d, set }: { p: Protocol; d: D; set: (x: D) => void }) {
  const ag = d.agreements.filter((g) => g.protocolId === p.id);
  const live = ag.find((g) => !g.revokedAt);
  const snaps = d.snapshots.filter((s) => p.datasetIds.includes(s.defId));
  const outs = d.outputs.filter((o) => o.protocolId === p.id);
  const [o, setO] = useState({ title: '', body: '' });
  const [cite, setCite] = useState<number[]>([]);
  const call = async (input: Record<string, unknown>, ok: string) => { try { set((await researchPartner(input as never)) as D); toast.success(ok); return true; } catch (e) { toast.error(errorMessage(e)); return false; } };
  return (
    <Section title={`${p.title} · ${p.institution}`}>
      <p className="text-sm">State: <span className="font-medium">{p.state}</span>{p.reviewNote ? ` — “${p.reviewNote}”` : ''}</p>
      <p className="text-xs text-muted-foreground">{p.organization} · {p.ethicsRef} · datasets: {p.datasets.join(', ')} · retention {p.retentionDays} days · submitted {fmt(p.createdAt)}</p>
      {(p.state === 'submitted' || p.state === 'approved') && <Button size="sm" variant="outline" className="mt-2" onClick={() => call({ action: 'withdraw', id: p.id, reason: 'Closed by the partner' }, p.state === 'approved' ? 'Protocol closed; access ended' : 'Protocol withdrawn')}>{p.state === 'approved' ? 'Close protocol' : 'Withdraw'}</Button>}

      {p.state === 'approved' && <div className="mt-3 space-y-2">
        <h4 className="text-sm font-medium">Data-use agreement</h4>
        {!live ? <Muted>Waiting for the data steward to issue the agreement.</Muted> : live.acceptedAt ? (
          <p className="text-sm">{live.active ? `Active until ${fmt(live.expiresAt)}.` : `Expired ${fmt(live.expiresAt)}.`}</p>
        ) : (<div className="rounded-md border p-3 text-sm"><p className="whitespace-pre-wrap">{live.terms}</p><p className="mt-1 text-xs text-muted-foreground">Runs {live.days} days from acceptance.</p>
          <Button size="sm" className="mt-2" onClick={() => call({ action: 'accept', agreementId: live.id, seenHash: live.termsHash }, 'Agreement accepted')}>I accept these terms</Button></div>)}
        {ag.filter((g) => g.revokedAt).map((g) => <p key={g.id} className="text-xs text-muted-foreground">Agreement #{g.id} ended {fmt(g.revokedAt)}{g.revokedReason ? `: ${g.revokedReason}` : ''}</p>)}
      </div>}

      {live?.active && <div className="mt-3 space-y-2">
        <h4 className="text-sm font-medium">Secure analysis</h4>
        {snaps.length === 0 ? <Muted>No snapshot has been run yet for these datasets. The institution's researchers run them.</Muted> : snaps.map((s) => <SnapshotView key={s.id} s={s} />)}
        <h4 className="pt-2 text-sm font-medium">Submit an output for release review</h4>
        <Input aria-label="Output title" placeholder="Title" value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} />
        <Textarea aria-label="Text to release" rows={3} placeholder="The exact text you want to publish" value={o.body} onChange={(e) => setO({ ...o, body: e.target.value })} />
        <div className="flex flex-wrap gap-3">{snaps.map((s) => <label key={s.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cite.includes(s.id)} onChange={(e) => setCite(e.target.checked ? [...cite, s.id] : cite.filter((x) => x !== s.id))} />cites snapshot #{s.id}</label>)}</div>
        <Button size="sm" disabled={cite.length === 0} onClick={async () => { if (await call({ action: 'submitOutput', protocolId: p.id, ...o, cites: cite }, 'Sent for output review')) { setO({ title: '', body: '' }); setCite([]); } }}>Submit for review</Button>
      </div>}

      {outs.length > 0 && <div className="mt-3"><h4 className="text-sm font-medium">Outputs</h4>{outs.map((x) => <p key={x.id} className="border-t py-1 text-sm">{x.title} — <span className="font-medium">{x.state === 'approved' ? 'cleared for release' : x.state}</span>{x.smallNumbers ? ' · contains small numbers' : ''}{x.reviewNote ? ` · “${x.reviewNote}”` : ''}</p>)}</div>}
    </Section>
  );
}

export function ResearchPartner() {
  const [inst, setInst] = useState('');
  const s = useLoad(() => researchPartner({ action: 'get' }));
  if (s.error) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{s.error} <Button size="sm" variant="link" onClick={s.reload}>Retry</Button></p>;
  if (!s.data) return <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  const d = s.data as D;
  const choose = async (v: string) => { setInst(v); if (v) try { s.setData((await researchPartner({ action: 'get', institutionId: v })) as never); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="space-y-4">
      <NewProtocol d={d} inst={inst} setInst={choose} onDone={(x) => s.setData(x as never)} />
      {d.protocols.length === 0 ? <Muted>You have no research protocols yet.</Muted> : d.protocols.map((p) => <ProtocolCard key={p.id} p={p} d={d} set={(x) => s.setData(x as never)} />)}
    </div>
  );
}
