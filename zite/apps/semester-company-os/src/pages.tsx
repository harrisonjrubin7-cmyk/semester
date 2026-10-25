import { useState } from 'react';
import { toast } from 'sonner';
import { companyOps } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Chip, Figure, Header, Loadable, Panel, errMsg, fmt, useLoad } from './ui';

type Tenant = { id: string; name: string; isSample: boolean; activation: string; members: { active: number; pending: number; suspended: number }; integrations: { connector: string; enabled: boolean; authorized: boolean; sync: string; last: string | null }[]; activity7d: { auditEvents: number; last: string | null } };
type Overview = { tenants: Tenant[]; features: Record<string, number>; requests: Record<string, number>; risks: { status: string; impact: string; n: number }[] };

export function OverviewPage() {
  const s = useLoad(() => companyOps({ action: 'overview' }) as Promise<Overview>);
  return (
    <>
      <Header eyebrow="Executive" title="Overview" sub="Tenant status, activation and safe diagnostics. Company staff see counts and statuses only, never student names, notes, grades or case content." />
      <Loadable state={s}>{(d) => {
        const verified = (d.features.verified_in_test ?? 0) + (d.features.pilot_enabled ?? 0) + (d.features.production_operated ?? 0);
        const total = Object.values(d.features).reduce((a, b) => a + b, 0);
        const openRisks = d.risks.filter((r) => r.status === 'Open').reduce((a, r) => a + r.n, 0);
        const criticalOpen = d.risks.filter((r) => r.status === 'Open' && r.impact === 'Critical').reduce((a, r) => a + r.n, 0);
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Tenants" value={d.tenants.length} note={`${d.tenants.filter((t) => t.isSample).length} sample`} />
              <Figure label="Capabilities verified in test" value={`${verified}/${total}`} note="From Feature Status. None pilot-enabled or in production." />
              <Figure label="New inbound requests" value={d.requests.New ?? 0} note={`${Object.values(d.requests).reduce((a, b) => a + b, 0)} total`} />
              <Figure label="Open risks" value={openRisks} note={`${criticalOpen} critical`} />
            </div>
            <Panel title="Tenants">
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Institution</th><th>Activation</th><th>Members (active · pending · suspended)</th><th>Connections</th><th>Audit events, 7 days</th></tr></thead>
                <tbody>{d.tenants.map((t) => (
                  <tr key={t.id} className="border-t border-border align-top">
                    <td className="py-2 font-medium">{t.name} {t.isSample && <Chip value="Sample" />}</td>
                    <td>{t.activation}</td>
                    <td className="tabular-nums">{t.members.active} · {t.members.pending} · {t.members.suspended}</td>
                    <td><ul className="space-y-0.5 text-xs">{t.integrations.length ? t.integrations.map((i) => <li key={i.connector}>{i.connector}: {i.enabled ? 'on' : 'off'}, {i.authorized ? 'authorized' : 'not authorized'}, {i.sync}</li>) : <li className="text-muted-foreground">None</li>}</ul></td>
                    <td className="tabular-nums">{t.activity7d.auditEvents}<span className="block text-xs text-muted-foreground">last {fmt(t.activity7d.last)}</span></td>
                  </tr>))}</tbody>
              </table></div>
            </Panel>
          </div>
        );
      }}</Loadable>
    </>
  );
}

type Req = { id: string; name: string; email: string; institution: string; role: string; kind: string; message: string; status: string; note: string; receivedAt: string | null };
const REQ_STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'] as const;

export function RequestsPage() {
  const s = useLoad(() => companyOps({ action: 'requests' }) as Promise<{ items: Req[] }>);
  const [filter, setFilter] = useState<string>('Open');
  return (
    <>
      <Header eyebrow="Revenue · Support" title="Inbound requests" sub="Pilot, pricing, security-document, accessibility and contact requests from the public site. Reply from your own email; status changes are audited." />
      <Loadable state={s}>{(d) => {
        const items = d.items.filter((r) => filter === 'All' || (filter === 'Open' ? r.status !== 'Closed' : r.status === filter));
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">{['Open', ...REQ_STATUSES, 'All'].map((f) => <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</Button>)}</div>
            {items.length ? items.map((r) => <RequestRow key={r.id} r={r} onDone={s.reload} />) : <Panel><p className="text-sm text-muted-foreground">No requests here yet. Requests from the public site’s pilot, pricing, trust and contact forms appear here.</p></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}

function RequestRow({ r, onDone }: { r: Req; onDone: () => void }) {
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.note);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await companyOps({ action: 'updateRequest', id: r.id, status: status as (typeof REQ_STATUSES)[number], note }); toast('Saved.'); onDone(); } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{r.kind} · {r.name}{r.institution && ` · ${r.institution}`}{r.role && <span className="text-muted-foreground"> ({r.role})</span>}</p>
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Chip value={r.status} />{fmt(r.receivedAt)}</span>
      </div>
      <p className="mt-1 select-all text-sm text-primary">{r.email}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <div><Label htmlFor={`st-${r.id}`} className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}><SelectTrigger id={`st-${r.id}`} className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{REQ_STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor={`nt-${r.id}`} className="text-xs">Internal note</Label><Textarea id={`nt-${r.id}`} rows={1} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <Button onClick={save} disabled={busy || (status === r.status && note === r.note)}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </Panel>
  );
}

type Risk = { id: string; risk: string; likelihood: string; impact: string; mitigation: string; owner: string; status: string; source: string; note: string };
const RISK_STATUSES = ['Open', 'Mitigating', 'Accepted', 'Closed'] as const;

export function RisksPage() {
  const s = useLoad(() => companyOps({ action: 'risks' }) as Promise<{ items: Risk[] }>);
  return (
    <>
      <Header eyebrow="Risk and continuity" title="Risk register" sub="Company risks from Book 1 plus the platform risks found in the Zite capability assessment. Changes are audited." />
      <Loadable state={s}>{(d) => (
        <div className="overflow-x-auto rounded-[3px] border border-border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="p-3">Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th><th>Owner</th><th className="pr-3">Status</th></tr></thead>
            <tbody>{d.items.map((r) => <RiskRow key={r.id} r={r} onDone={s.reload} />)}</tbody>
          </table>
        </div>
      )}</Loadable>
    </>
  );
}

function RiskRow({ r, onDone }: { r: Risk; onDone: () => void }) {
  const change = async (status: string) => {
    try { await companyOps({ action: 'updateRisk', id: r.id, status: status as (typeof RISK_STATUSES)[number] }); toast(`Marked ${status}.`); onDone(); } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <tr className="border-t border-border align-top">
      <td className="p-3"><p className="font-medium">{r.risk}</p><p className="text-xs text-muted-foreground">{r.source}</p>{r.note && <p className="mt-1 text-xs">{r.note}</p>}</td>
      <td className="py-3">{r.likelihood}</td><td className="py-3">{r.impact}</td>
      <td className="py-3 pr-3 text-muted-foreground">{r.mitigation}</td><td className="py-3">{r.owner}</td>
      <td className="py-3 pr-3"><Select value={r.status} onValueChange={change}><SelectTrigger aria-label={`Status of ${r.risk}`} className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{RISK_STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
    </tr>
  );
}

type Ev = { id: string; feature: string; status: string; evidence: string; tests: string; blocker: string; lastVerified: string | null; next: string; deployed: boolean; authorized: boolean };

export function EvidencePage() {
  const s = useLoad(() => companyOps({ action: 'evidence' }) as Promise<{ items: Ev[] }>);
  return (
    <>
      <Header eyebrow="Product and engineering" title="Release evidence" sub="Readiness of each capability, using the six status levels. A page existing is not evidence. Nothing here is pilot-enabled or in production." />
      <Loadable state={s}>{(d) => (
        <div className="space-y-3">{d.items.map((f) => (
          <Panel key={f.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{f.feature}</p><span className="flex items-center gap-2 text-xs text-muted-foreground"><Chip value={f.status} />{f.lastVerified ? `verified ${f.lastVerified}` : 'not re-verified'}</span></div>
            {f.evidence && <p className="mt-1 text-sm">{f.evidence}</p>}
            {f.tests && <pre className="mt-2 whitespace-pre-wrap rounded-[3px] bg-muted/50 p-2 font-mono text-xs">{f.tests}</pre>}
            <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {f.blocker && <p><span className="font-medium">Blocker:</span> {f.blocker}</p>}
              {f.next && <p><span className="font-medium">Next:</span> {f.next}</p>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Deployed: {f.deployed ? 'yes' : 'no'} · Institution authorized: {f.authorized ? 'yes' : 'no'}</p>
          </Panel>))}</div>
      )}</Loadable>
    </>
  );
}
