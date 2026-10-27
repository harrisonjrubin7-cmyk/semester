import { useState } from 'react';
import { toast } from 'sonner';
import { governance } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const CLASSES = ['public', 'internal', 'confidential', 'restricted'];

function useAct(reload: () => void) {
  return async (body: any, msg: string) => {
    try { const r: any = await governance(body as never); toast(r?.result === 'pending' ? 'Proposed. Another steward confirms a lower classification.' : r?.result === 'ok:fail' ? 'Recorded: below threshold, issue opened.' : msg); reload(); return true; }
    catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; }
  };
}

function Body({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [tm, setTm] = useState({ name: '', definition: '' });
  const [as, setAs] = useState({ name: '', system: '', classification: 'internal', systemOfRecord: '' });
  const [lk, setLk] = useState({ fromId: '', toId: '', transform: '' });
  const [ru, setRu] = useState({ assetId: '', description: '', threshold: '' });
  const [ms, setMs] = useState<Record<number, string>>({});
  const [fix, setFix] = useState<Record<number, string>>({});
  const [rt, setRt] = useState({ assetId: '', days: '', legalMinDays: '', basis: '' });
  const [cf, setCf] = useState({ subject: '', sourceA: '', sourceB: '', detail: '' });
  const [st, setSt] = useState<Record<number, { source: string; rationale: string }>>({});
  const [em, setEm] = useState('');
  const s = d.steward;
  const assetSel = (v: string, on: (x: string) => void, label: string) => <select aria-label={label} className={sel} value={v} onChange={(e) => on(e.target.value)}><option value="">{label}…</option>{d.assets.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Definitions">
        {!d.terms.length ? <Empty>No definitions yet.</Empty> : d.terms.map((t: any) => <div key={t.id} className="border-b border-border py-1 text-sm">
          <p><span className="font-medium">{t.name}</span> <Status value={t.state} /></p><p className="text-xs">{t.definition}</p>
          <p className="text-xs text-muted-foreground">Proposed by {t.proposedBy}{t.approvedBy ? ` · approved by ${t.approvedBy}` : ''}</p>
          {s && <div className="flex gap-2">{t.state === 'proposed' && !t.mine && <Button size="sm" variant="outline" onClick={() => act({ action: 'termStep', id: t.id, step: 'approve', expectedVersion: t.version }, 'Approved.')}>Approve</Button>}
            {t.state === 'proposed' && t.mine && <span className="text-xs text-muted-foreground">Waiting for another steward.</span>}
            {t.state !== 'retired' && <Button size="sm" variant="ghost" onClick={() => act({ action: 'termStep', id: t.id, step: 'retire', expectedVersion: t.version }, 'Retired.')}>Retire</Button>}</div>}
        </div>)}
        {s && <div className="mt-2 space-y-1"><Input aria-label="Term" placeholder="Term (an existing name proposes a revision)" value={tm.name} onChange={(e) => setTm({ ...tm, name: e.target.value })} />
          <Textarea aria-label="Definition" placeholder="Definition" rows={2} value={tm.definition} onChange={(e) => setTm({ ...tm, definition: e.target.value })} />
          <Button size="sm" disabled={tm.name.length < 2 || tm.definition.length < 10} onClick={async () => { if (await act({ action: 'term', ...tm }, 'Proposed for approval.')) setTm({ name: '', definition: '' }); }}>Propose</Button></div>}
      </Panel>
      <Panel title="Datasets: classification, source of record, lineage, retention">
        {!d.assets.length ? <Empty>No datasets registered.</Empty> : d.assets.map((x: any) => <div key={x.id} className="border-b border-border py-1 text-sm">
          <p><span className="font-medium">{x.name}</span> · {x.system} · <Status value={x.classification} /> · system of record: {x.systemOfRecord}</p>
          {x.pending && <p className="text-xs">Lower to {x.pending.to} proposed by {x.pending.by}{s && !x.pending.mine && <Button size="sm" variant="ghost" onClick={() => act({ action: 'classify', id: x.id, classification: x.pending.to, expectedVersion: x.version }, 'Lowered.')}>Confirm</Button>}</p>}
          {s && <select aria-label={`Classification for ${x.name}`} className={sel} value="" onChange={(e) => e.target.value && act({ action: 'classify', id: x.id, classification: e.target.value, expectedVersion: x.version }, 'Classification raised.')}>
            <option value="">Change classification…</option>{CLASSES.filter((c) => c !== x.classification).map((c) => <option key={c}>{c}</option>)}</select>}
          {x.fedBy.map((l: any, k: number) => <p key={k} className="text-xs">← {l.from} ({l.transform})</p>)}
          {x.feeds.map((l: any, k: number) => <p key={k} className="text-xs">→ {l.to} ({l.transform})</p>)}
          <p className="text-xs text-muted-foreground">{x.retention ? `Retain ${x.retention.days} days (legal minimum ${x.retention.legalMin}) · ${x.retention.basis}` : 'No retention policy.'}</p>
        </div>)}
        {s && <><p className="mt-2 text-xs font-medium">Register a dataset</p>
          <div className="flex flex-wrap gap-2"><Input aria-label="Dataset" placeholder="Dataset" className="w-36" value={as.name} onChange={(e) => setAs({ ...as, name: e.target.value })} />
            <Input aria-label="System" placeholder="System" className="w-28" value={as.system} onChange={(e) => setAs({ ...as, system: e.target.value })} />
            <select aria-label="Classification" className={sel} value={as.classification} onChange={(e) => setAs({ ...as, classification: e.target.value })}>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
            <Input aria-label="System of record" placeholder="System of record" className="w-36" value={as.systemOfRecord} onChange={(e) => setAs({ ...as, systemOfRecord: e.target.value })} />
            <Button size="sm" disabled={as.name.length < 2 || !as.system || as.systemOfRecord.length < 2} onClick={() => act({ action: 'asset', ...as }, 'Registered.')}>Register</Button></div>
          <p className="mt-2 text-xs font-medium">Lineage</p>
          <div className="flex flex-wrap gap-2">{assetSel(lk.fromId, (v) => setLk({ ...lk, fromId: v }), 'From')}{assetSel(lk.toId, (v) => setLk({ ...lk, toId: v }), 'To')}
            <Input aria-label="Transform" placeholder="How it flows" className="w-40" value={lk.transform} onChange={(e) => setLk({ ...lk, transform: e.target.value })} />
            <Button size="sm" variant="outline" disabled={!lk.fromId || !lk.toId || lk.transform.length < 3} onClick={() => act({ action: 'link', fromId: Number(lk.fromId), toId: Number(lk.toId), transform: lk.transform }, 'Linked.')}>Link</Button></div>
          <p className="mt-2 text-xs font-medium">Retention</p>
          <div className="flex flex-wrap gap-2">{assetSel(rt.assetId, (v) => setRt({ ...rt, assetId: v }), 'Dataset')}
            <Input aria-label="Days" type="number" placeholder="Days" className="w-24" value={rt.days} onChange={(e) => setRt({ ...rt, days: e.target.value })} />
            <Input aria-label="Legal minimum days" type="number" placeholder="Legal min" className="w-24" value={rt.legalMinDays} onChange={(e) => setRt({ ...rt, legalMinDays: e.target.value })} />
            <Input aria-label="Basis" placeholder="Legal or policy basis" className="w-44" value={rt.basis} onChange={(e) => setRt({ ...rt, basis: e.target.value })} />
            <Button size="sm" variant="outline" disabled={!rt.assetId || !(Number(rt.days) > 0) || rt.basis.length < 5} onClick={() => act({ action: 'retain', assetId: Number(rt.assetId), days: Number(rt.days), legalMinDays: Number(rt.legalMinDays || 0), basis: rt.basis }, 'Retention set. Nothing is deleted from here.')}>Set</Button></div></>}
      </Panel>
      <Panel title="Quality">
        {!d.rules.length ? <Empty>No quality rules.</Empty> : d.rules.map((q: any) => <div key={q.id} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-sm">
          <span>{q.asset}: {q.description} (≥ {q.threshold}%)</span>{q.last && <Status value={q.last.passed ? `pass ${q.last.measured}%` : `fail ${q.last.measured}%`} />}
          {s && <><Input aria-label="Measured percent" type="number" className="h-8 w-20" value={ms[q.id] ?? ''} onChange={(e) => setMs({ ...ms, [q.id]: e.target.value })} />
            <Button size="sm" variant="ghost" disabled={ms[q.id] === undefined || ms[q.id] === ''} onClick={() => act({ action: 'measure', ruleId: q.id, measured: Number(ms[q.id]) }, 'Result recorded: passed.')}>Record</Button></>}</div>)}
        {s && <div className="mt-2 flex flex-wrap gap-2">{assetSel(ru.assetId, (v) => setRu({ ...ru, assetId: v }), 'Dataset')}
          <Input aria-label="Rule" placeholder="Rule" className="w-44" value={ru.description} onChange={(e) => setRu({ ...ru, description: e.target.value })} />
          <Input aria-label="Threshold percent" type="number" placeholder="Threshold %" className="w-24" value={ru.threshold} onChange={(e) => setRu({ ...ru, threshold: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!ru.assetId || ru.description.length < 5 || ru.threshold === ''} onClick={() => act({ action: 'rule', assetId: Number(ru.assetId), description: ru.description, threshold: Number(ru.threshold) }, 'Rule added.')}>Add rule</Button></div>}
        <p className="mt-3 text-xs font-medium">Issues</p>
        {!d.issues.length ? <Empty>No quality issues.</Empty> : d.issues.map((i: any) => <div key={i.id} className="py-1 text-xs"><Status value={i.state} /> {i.asset}: {i.description} at {i.measured}%{i.resolution ? ` → ${i.resolution}` : ''}
          {s && i.state === 'open' && <div className="flex gap-2"><Input aria-label="Fix" placeholder="What fixed it" className="h-8 w-56" value={fix[i.id] ?? ''} onChange={(e) => setFix({ ...fix, [i.id]: e.target.value })} />
            <Button size="sm" variant="outline" disabled={(fix[i.id] ?? '').length < 5} onClick={() => act({ action: 'resolveIssue', id: i.id, text: fix[i.id] }, 'Resolved.')}>Resolve</Button></div>}</div>)}
      </Panel>
      <Panel title="Source conflicts">
        {!d.conflicts.length ? <Empty>No conflicts logged.</Empty> : d.conflicts.map((c: any) => { const f = st[c.id] ?? { source: '', rationale: '' };
          return <div key={c.id} className="border-b border-border py-1 text-sm"><p><Status value={c.state} /> {c.subject}: {c.a} vs {c.b}</p><p className="text-xs">{c.detail}</p>
            {c.authoritative ? <p className="text-xs">Authoritative: {c.authoritative} — {c.rationale} ({c.resolvedBy})</p>
              : s && (c.mine ? <p className="text-xs text-muted-foreground">Another steward settles this.</p> : <div className="flex flex-wrap gap-2">
                <select aria-label="Authoritative source" className={sel} value={f.source} onChange={(e) => setSt({ ...st, [c.id]: { ...f, source: e.target.value } })}><option value="">Authoritative…</option><option>{c.a}</option><option>{c.b}</option></select>
                <Input aria-label="Rationale" placeholder="Why" className="h-8 w-48" value={f.rationale} onChange={(e) => setSt({ ...st, [c.id]: { ...f, rationale: e.target.value } })} />
                <Button size="sm" disabled={!f.source || f.rationale.length < 10} onClick={() => act({ action: 'settle', id: c.id, ...f }, 'Settled.')}>Settle</Button></div>)}</div>; })}
        {s && <div className="mt-2 space-y-1"><div className="flex flex-wrap gap-2"><Input aria-label="Subject" placeholder="Subject" className="w-36" value={cf.subject} onChange={(e) => setCf({ ...cf, subject: e.target.value })} />
          <Input aria-label="Source A" placeholder="Source A" className="w-28" value={cf.sourceA} onChange={(e) => setCf({ ...cf, sourceA: e.target.value })} />
          <Input aria-label="Source B" placeholder="Source B" className="w-28" value={cf.sourceB} onChange={(e) => setCf({ ...cf, sourceB: e.target.value })} /></div>
          <Textarea aria-label="Detail" placeholder="How they disagree" rows={2} value={cf.detail} onChange={(e) => setCf({ ...cf, detail: e.target.value })} />
          <Button size="sm" variant="outline" disabled={cf.subject.length < 3 || !cf.sourceA || !cf.sourceB || cf.detail.length < 10} onClick={() => act({ action: 'conflict', ...cf }, 'Conflict logged.')}>Log conflict</Button></div>}
      </Panel>
      {d.isAdmin && <Panel title="Data stewards (administrators)">
        <div className="flex flex-wrap gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={em} onChange={(e) => setEm(e.target.value)} />
          <Button size="sm" disabled={!em.includes('@')} onClick={() => act({ action: 'steward', email: em, on: true }, 'Appointed.')}>Appoint</Button>
          <Button size="sm" variant="outline" disabled={!em.includes('@')} onClick={() => act({ action: 'steward', email: em, on: false }, 'Removed.')}>Remove</Button></div>
        <p className="mt-1 text-xs">{d.stewards.length ? d.stewards.join(', ') : 'No stewards appointed.'}</p>
      </Panel>}
    </div>
  );
}

export default function Governance() {
  const state = useLoad(() => governance({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Staff" title="Data governance" sub={`Definitions, dataset classification, lineage, quality, retention and source conflicts. Metadata only; no student records appear here.`} />
      <Loadable state={state}>{(d: any) => <Body d={d} act={act} />}</Loadable>
    </div>
  );
}
