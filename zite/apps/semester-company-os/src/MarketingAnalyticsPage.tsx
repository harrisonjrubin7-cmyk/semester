import { useState } from 'react';
import { toast } from 'sonner';
import { marketingAnalytics } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Figure, Loadable, useLoad, fmt, errMsg } from './ui';

type Reports = { funnel: { stage: string; people: number; ofPrevious: number | null }[]; attribution: { campaign: string; source: string; people: number; qualified: number; rate: number | null }[]; cohorts: { month: string; people: number; qualified: number; rate: number | null }[] };
type Exp = { id: number; name: string; hypothesis: string; armA: string; armB: string; minPerArm: number; state: string; mine: boolean; leadsA: number; leadsB: number; decision: string | null; note: string; startedAt: string | null };
type Exp2 = { id: number; report: string; snapshot: unknown; hash: string; purpose: string; state: string; mine: boolean; decidedAt: string | null; note: string; downloads: number; expired: boolean };
type D = { analyst: boolean; approver: boolean; consentRole: boolean; downloaded: unknown; audience: number; withdrawn: number; reports: Reports; campaigns: { id: string; label: string; tag: string }[]; experiments: Exp[]; exports: Exp2[] };

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
const downloadCsv = (name: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]); const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([[cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
};

function Experiments({ d, run }: { d: D; run: (i: Record<string, unknown>, ok: string) => Promise<unknown> }) {
  const [f, setF] = useState({ name: '', hypothesis: '', armA: '', armB: '', minPerArm: 20 }); const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <Panel title="Experiments">
      {d.experiments.length === 0 ? <p className="text-sm text-muted-foreground">No experiments yet.</p> : d.experiments.map((e) => (
        <div key={e.id} className="border-b py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{e.name}</p><Chip value={e.state === 'decided' ? `decided: ${e.decision === 'no_clear_difference' ? 'no clear difference' : e.decision === 'a' ? 'A' : 'B'}` : e.state} /></div>
          <p className="text-xs text-muted-foreground">{e.hypothesis}</p>
          <p>A {e.armA}: <b>{e.leadsA}</b> leads · B {e.armB}: <b>{e.leadsB}</b> leads · minimum {e.minPerArm} per arm · since {fmt(e.startedAt)}</p>
          {e.note && <p className="text-xs">“{e.note}”</p>}
          {e.state === 'running' && d.analyst && (e.mine ? <p className="text-xs text-muted-foreground">Another analyst decides this experiment.</p> :
            <div className="mt-1 flex flex-wrap items-center gap-2"><Input aria-label="Reasoning" className="h-8 w-72" placeholder="Reasoning (10+ characters)" value={notes[e.id] ?? ''} onChange={(x) => setNotes({ ...notes, [e.id]: x.target.value })} />
              {(['a', 'b', 'no_clear_difference'] as const).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => run({ action: 'experiment', step: 'decide', id: e.id, decision: k, note: notes[e.id] }, 'Decision recorded')}>{k === 'no_clear_difference' ? 'No clear difference' : `${k.toUpperCase()} wins`}</Button>)}</div>)}
        </div>))}
      {d.analyst && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input aria-label="Experiment name" className="h-8" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input aria-label="Minimum leads per arm" type="number" className="h-8" value={f.minPerArm} onChange={(e) => setF({ ...f, minPerArm: Number(e.target.value) })} />
        <Textarea aria-label="Hypothesis" className="sm:col-span-2" rows={2} placeholder="Hypothesis (20+ characters)" value={f.hypothesis} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} />
        {(['armA', 'armB'] as const).map((k) => <select key={k} aria-label={k === 'armA' ? 'Arm A' : 'Arm B'} className="h-8 rounded-md border bg-background px-2 text-sm" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
          <option value="">{k === 'armA' ? 'Arm A campaign…' : 'Arm B campaign…'}</option>{d.campaigns.map((c) => <option key={c.id} value={c.id}>{c.label} (tag {c.tag})</option>)}</select>)}
        <Button size="sm" className="w-fit" onClick={() => run({ action: 'experiment', step: 'start', id: null, ...f }, 'Experiment started')}>Start experiment</Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">Leads are attributed when a site link carries utm_campaign set to the campaign's tag. A winner needs the minimum in both arms and more leads.</p></div>}
    </Panel>
  );
}

function Exports({ d, run }: { d: D; run: (i: Record<string, unknown>, ok: string) => Promise<unknown> }) {
  const [report, setReport] = useState('attribution'); const [purpose, setPurpose] = useState(''); const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <Panel title="Approved exports">
      {d.exports.map((x) => (
        <div key={x.id} className="border-b py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{x.report} · {x.purpose}</p><Chip value={x.expired && x.state === 'approved' ? 'expired' : x.state} /></div>
          <p className="text-xs text-muted-foreground">{x.downloads} download(s){x.note ? ` · “${x.note}”` : ''}</p>
          {x.state === 'requested' && d.approver && !x.mine && <div className="mt-1 space-y-1"><pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(x.snapshot, null, 2)}</pre>
            <div className="flex flex-wrap gap-2"><Input aria-label="Decision note" className="h-8 w-64" placeholder="Note (needed to reject)" value={notes[x.id] ?? ''} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} />
              <Button size="sm" onClick={() => run({ action: 'export', step: 'approve', id: x.id, seen: x.hash, note: notes[x.id] }, 'Export approved')}>Approve this snapshot</Button>
              <Button size="sm" variant="outline" onClick={() => run({ action: 'export', step: 'reject', id: x.id, seen: x.hash, note: notes[x.id] }, 'Export rejected')}>Reject</Button></div></div>}
          {x.state === 'approved' && x.mine && !x.expired && <Button size="sm" variant="outline" className="mt-1" onClick={async () => { const r = (await run({ action: 'export', step: 'download', id: x.id }, 'Download recorded')) as D | null; const snap = r?.downloaded as { rows?: Record<string, unknown>[] } | null; if (snap?.rows) downloadCsv(`semester-${x.report}-${x.id}`, snap.rows); }}>Download CSV</Button>}
        </div>))}
      {d.analyst && <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="Report" className="h-8 rounded-md border bg-background px-2 text-sm" value={report} onChange={(e) => setReport(e.target.value)}>{['funnel', 'attribution', 'cohorts'].map((r) => <option key={r}>{r}</option>)}</select>
        <Input aria-label="Purpose" className="h-8 w-80" placeholder="What the export is for (15+ characters)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <Button size="sm" onClick={async () => { if (await run({ action: 'export', step: 'request', id: null, report, purpose }, 'Snapshot taken; a marketing approver decides')) setPurpose(''); }}>Request export</Button>
        <p className="w-full text-xs text-muted-foreground">Exports are aggregate snapshots. A different marketing approver approves the exact snapshot; it can be downloaded for 7 days.</p></div>}
    </Panel>
  );
}

function Consent({ d, run }: { d: D; run: (i: Record<string, unknown>, ok: string) => Promise<unknown> }) {
  const [f, setF] = useState({ email: '', kind: 'withdrawn', source: 'contact_request', note: '' });
  if (!d.consentRole) return null;
  return (
    <Panel title="Consent">
      <p className="text-sm">Contactable audience: <b>{d.audience}</b> people · {d.withdrawn} withdrawn</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input aria-label="Contact's email" className="h-8 w-64" placeholder="Contact's email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select aria-label="Consent change" className="h-8 rounded-md border bg-background px-2 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="withdrawn">Withdraw consent</option><option value="given">Consent given</option></select>
        <select aria-label="Source" className="h-8 rounded-md border bg-background px-2 text-sm" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="contact_request">Contact request</option><option value="event_signup">Event sign-up</option><option value="other">Other</option></select>
        <Input aria-label="Note" className="h-8 w-64" placeholder={f.kind === 'given' ? 'Where consent came from (required)' : 'Note (optional)'} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Button size="sm" onClick={async () => { if (await run({ action: 'consent', ...f }, f.kind === 'withdrawn' ? 'Withdrawal recorded; they are no longer counted' : 'Consent recorded')) setF({ ...f, email: '', note: '' }); }}>Record</Button></div>
      <p className="mt-1 text-xs text-muted-foreground">The ledger keeps a hash of the address, never the address itself. Withdrawals apply to every campaign at once.</p>
    </Panel>
  );
}

export default function MarketingAnalyticsPage() {
  const s = useLoad(() => marketingAnalytics({ action: 'get' }) as Promise<D>);
  const run = async (input: Record<string, unknown>, ok: string) => { try { const r = await marketingAnalytics(input as never); toast.success(ok); s.reload(); return r; } catch (e) { toast.error(errMsg(e)); return null; } };
  return (
    <div className="space-y-4">
      <Header eyebrow="Marketing" title="Analytics and consent" sub="Funnel, attribution and cohorts over business inquiries (aggregates only), experiments, approved exports and the consent ledger." />
      <Loadable state={s}>{(d) => (<>
        <div className="grid gap-3 sm:grid-cols-3">{d.reports.funnel.map((f) => <Figure key={f.stage} label={f.stage} value={f.people} note={f.ofPrevious === null ? 'people' : `${pct(f.ofPrevious)} of previous stage`} />)}</div>
        <Panel title="Attribution">{d.reports.attribution.length === 0 ? <p className="text-sm text-muted-foreground">No inquiries yet.</p> :
          <table className="w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th>Campaign tag</th><th>Source</th><th>People</th><th>Qualified</th><th>Rate</th></tr></thead>
            <tbody>{d.reports.attribution.map((a) => <tr key={`${a.campaign}${a.source}`} className="border-t"><td className="py-1">{a.campaign}</td><td>{a.source}</td><td>{a.people}</td><td>{a.qualified}</td><td>{pct(a.rate)}</td></tr>)}</tbody></table>}</Panel>
        <Panel title="Cohorts by first inquiry month">{d.reports.cohorts.length === 0 ? <p className="text-sm text-muted-foreground">No inquiries yet.</p> :
          <table className="w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th>Month</th><th>People</th><th>Qualified so far</th><th>Rate</th></tr></thead>
            <tbody>{d.reports.cohorts.map((c) => <tr key={c.month} className="border-t"><td className="py-1">{c.month}</td><td>{c.people}</td><td>{c.qualified}</td><td>{pct(c.rate)}</td></tr>)}</tbody></table>}</Panel>
        <Experiments d={d} run={run} />
        <Exports d={d} run={run} />
        <Consent d={d} run={run} />
      </>)}</Loadable>
    </div>
  );
}
