import { useState } from 'react';
import { toast } from 'sonner';
import { atlas } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { useLoad, Loadable, Header, Panel, Figure, Chip, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SEV = ['critical', 'high', 'medium', 'low', 'informational'] as const;
const KINDS = ['partnership', 'security', 'accessibility', 'feature_availability', 'production_usage', 'performance', 'replacement', 'ai_capability', 'customer_outcome', 'price'] as const;
const words = (s: string) => s.replace(/_/g, ' ');
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const SHORT: Record<string, string> = { Designed: 'Des', Implemented: 'Impl', Tested: 'Test', Deployed: 'Depl', 'Institution-authorized': 'Auth', 'Production-enabled': 'Prod', 'Operationally accepted': 'Acc', 'Incumbent decommissioned': 'Retired' };

function Gaps({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ subject: '', title: '', detail: '', severity: 'medium' as (typeof SEV)[number], ownerEmail: '' });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState<Record<number, string>>({});
  const open = async () => { try { await atlas({ action: 'openGap', requestKey: key, ...f }); toast.success('Gap recorded.'); setKey(crypto.randomUUID()); setF({ ...f, title: '', detail: '' }); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const step = async (g: any, s: 'start' | 'resolve' | 'accept_risk' | 'reopen') => { try { await atlas({ action: 'gapStep', id: g.id, step: s, expectedVersion: g.version, note: note[g.id] ?? '' }); toast.success('Recorded.'); reload(); } catch (e) { toast.error(errMsg(e)); reload(); } };
  const live = d.gaps.filter((g: any) => !['resolved', 'risk_accepted'].includes(g.state));
  return (
    <Panel title={`Gap register · ${live.length} open`}>
      {d.gaps.length === 0 ? <p className="text-sm text-muted-foreground">No gaps recorded. Record one whenever a required link, test or approval is missing.</p> : (
        <ul className="divide-y divide-border">{d.gaps.map((g: any) => (
          <li key={g.id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{g.title}</span><span className="flex gap-1"><Chip value={g.severity} /><Chip value={words(g.state)} /></span></div>
            <p className="text-xs text-muted-foreground">{g.subject} · owner {g.owner} · opened by {g.openedBy} · {fmt(g.updatedAt)}</p>
            {g.detail && <p className="text-xs">{g.detail}</p>}
            {g.resolution && <p className="text-xs">Last note: {g.resolution}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Note" className="max-w-md" placeholder="Evidence or reason (10+ characters)" value={note[g.id] ?? ''} onChange={(e) => setNote({ ...note, [g.id]: e.target.value })} />
              {g.mine && ['open', 'reopened'].includes(g.state) && <Button size="sm" variant="outline" onClick={() => step(g, 'start')}>Start</Button>}
              {g.mine && !['resolved', 'risk_accepted'].includes(g.state) && <Button size="sm" onClick={() => step(g, 'resolve')}>Resolve with evidence</Button>}
              {!g.mine && g.severity !== 'critical' && !['resolved', 'risk_accepted'].includes(g.state) && <Button size="sm" variant="outline" onClick={() => step(g, 'accept_risk')}>Accept risk</Button>}
              {!g.mine && ['resolved', 'risk_accepted'].includes(g.state) && <Button size="sm" variant="outline" onClick={() => step(g, 'reopen')}>Reopen</Button>}
            </div>
          </li>))}</ul>)}
      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
        <Input aria-label="Subject" placeholder="Subject, e.g. capability:grade-release or app:security-lab" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <Input aria-label="Gap title" placeholder="What is missing" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select aria-label="Severity" className={sel} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as never })}>{SEV.map((s) => <option key={s}>{s}</option>)}</select>
        <Input aria-label="Owner email" placeholder="Owner’s email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} />
        <Textarea aria-label="Detail" className="sm:col-span-2" placeholder="Detail and the evidence that would close it" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
        <div className="sm:col-span-2"><Button size="sm" disabled={f.subject.trim().length < 3 || f.title.trim().length < 5 || !f.ownerEmail.includes('@')} onClick={open}>Record gap</Button>
          <span className="ml-2 text-xs text-muted-foreground">Critical gaps cannot be accepted as risks; high ones need a privacy officer.</span></div>
      </div>
    </Panel>
  );
}

function Claims({ d, reload }: { d: any; reload: () => void }) {
  const next = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({ claim: '', kind: 'feature_availability' as (typeof KINDS)[number], audience: 'Public site', scope: '', evidence: '', reviewBy: next });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState<Record<number, string>>({});
  const [rev, setRev] = useState<Record<number, string>>({});
  const propose = async () => { try { await atlas({ action: 'proposeClaim', requestKey: key, ...f }); toast.success('Claim proposed.'); setKey(crypto.randomUUID()); setF({ ...f, claim: '', evidence: '' }); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const step = async (c: any, s: 'approve' | 'reject' | 'reverify' | 'withdraw') => { try { await atlas({ action: 'claimStep', id: c.id, step: s, expectedVersion: c.version, note: note[c.id] ?? '', reviewBy: s === 'reverify' ? rev[c.id] ?? null : null }); toast.success('Recorded.'); reload(); } catch (e) { toast.error(errMsg(e)); reload(); } };
  return (
    <Panel title="Claims registry">
      <p className="mb-2 text-xs text-muted-foreground">A public post that makes a claim must cite approved, current claims as CLM-number in its sources; Site publications refuses it otherwise.</p>
      {d.claims.length === 0 ? <p className="text-sm text-muted-foreground">No claims yet.</p> : (
        <ul className="divide-y divide-border">{d.claims.map((c: any) => (
          <li key={c.id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{c.ref}: “{c.claim}”</span><span className="flex gap-1"><Chip value={words(c.kind)} /><Chip value={c.state === 'approved' && c.expired ? 'review overdue' : c.state} /></span></div>
            <p className="text-xs text-muted-foreground">For {c.audience} · scope {c.scope} · owner {c.owner}{c.approver ? ` · approved by ${c.approver}` : ''} · review by {c.reviewBy} · needs a {words(c.needs)}</p>
            <p className="text-xs">Evidence: {c.evidence}</p>
            {c.note && <p className="text-xs">Note: {c.note}</p>}
            {!['rejected', 'withdrawn'].includes(c.state) && <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Note" className="max-w-sm" placeholder="What you checked (10+ characters)" value={note[c.id] ?? ''} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} />
              {!c.mine && c.state === 'proposed' && <><Button size="sm" onClick={() => step(c, 'approve')}>Approve</Button><Button size="sm" variant="outline" onClick={() => step(c, 'reject')}>Reject</Button></>}
              {!c.mine && c.state === 'approved' && <><Input aria-label="New review date" type="date" className="w-40" value={rev[c.id] ?? ''} onChange={(e) => setRev({ ...rev, [c.id]: e.target.value })} /><Button size="sm" variant="outline" onClick={() => step(c, 'reverify')}>Re-verify</Button></>}
              <Button size="sm" variant="ghost" onClick={() => step(c, 'withdraw')}>Withdraw</Button>
            </div>}
          </li>))}</ul>)}
      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
        <Textarea aria-label="Exact claim" className="sm:col-span-2" placeholder="The exact sentence that will be published" value={f.claim} onChange={(e) => setF({ ...f, claim: e.target.value })} />
        <select aria-label="Kind" className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as never })}>{KINDS.map((k) => <option key={k} value={k}>{words(k)}</option>)}</select>
        <Input aria-label="Audience" placeholder="Audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} />
        <Input aria-label="Scope" placeholder="Product or institution scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} />
        <label className="text-xs">Review by<Input type="date" className="mt-1" value={f.reviewBy} onChange={(e) => setF({ ...f, reviewBy: e.target.value })} /></label>
        <Textarea aria-label="Evidence" className="sm:col-span-2" placeholder="Evidence references: contract id, audit report, test run, approval record" value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
        <div className="sm:col-span-2"><Button size="sm" disabled={f.claim.trim().length < 10 || f.scope.trim().length < 3 || f.evidence.trim().length < 20} onClick={propose}>Propose claim</Button></div>
      </div>
    </Panel>
  );
}

export default function AtlasPage() {
  const s = useLoad(() => atlas({ action: 'get' }));
  const [q, setQ] = useState('');
  return (
    <div className="space-y-6 p-6">
      <Header eyebrow="Atlas" title="Semester Atlas" sub="What Semester must do, what is built, what evidence exists and what is missing. Atlas tracks and explains; it never runs institutional transactions." />
      <Loadable state={s}>{(d: any) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Role-app capabilities built" value={d.coverage.capabilities} note={`${d.coverage.partial} partial, ${d.coverage.missing} missing, ${d.coverage.blocked} blocked by owner decisions, across ${d.coverage.roleApps} role apps`} />
            <Figure label="Role apps fully built" value={d.coverage.rolesFull} />
            <Figure label="Workflow contracts reviewed" value={d.coverage.workflowContracts} note="No approved workflow scope is recorded yet" />
            <Figure label="Capabilities activated" value={d.coverage.activation} note="No institution has approved activation" />
          </div>
          <Panel title="Capability status by dimension">
            <p className="mb-2 text-xs text-muted-foreground">Each column is satisfied only by evidence recorded for that stage in Security Lab. Synthetic runs never count for deployment, production or acceptance.</p>
            <div className="mb-3 flex flex-wrap gap-2">{d.dimensions.map((dim: string) => <span key={dim} className="rounded border border-border px-2 py-1 text-xs">{dim}: <b className="tabular-nums">{d.dimCounts[dim]}</b></span>)}</div>
            <Input aria-label="Filter capabilities" placeholder="Filter capabilities" className="mb-2 max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="p-1">Capability</th>{d.dimensions.map((dim: string) => <th key={dim} className="p-1" title={dim}>{SHORT[dim]}</th>)}<th className="p-1">Evidence</th></tr></thead>
              <tbody>{d.capabilities.filter((c: any) => !q || `${c.capability} ${c.domain}`.toLowerCase().includes(q.toLowerCase())).slice(0, 300).map((c: any) => (
                <tr key={c.id} className="border-t border-border"><td className="p-1">{c.capability}<span className="block text-muted-foreground">{c.domain}</span></td>
                  {d.dimensions.map((dim: string) => <td key={dim} className="p-1 text-center" aria-label={`${dim}: ${c.dims[dim] ? 'evidence recorded' : 'no evidence'}`}>{c.dims[dim] ? '✓' : '○'}</td>)}<td className="p-1 tabular-nums">{c.evidenceCount}</td></tr>))}</tbody></table></div>
            {d.capabilities.length === 0 && <p className="text-sm text-muted-foreground">The capability register is empty.</p>}
          </Panel>
          <Gaps d={d} reload={s.reload} />
          <Claims d={d} reload={s.reload} />
          <p className="text-xs text-muted-foreground">Your company roles: {d.myRoles.length ? d.myRoles.map(words).join(', ') : 'none'}. Roles are granted only with the founder’s approval.</p>
        </>
      )}</Loadable>
    </div>
  );
}
