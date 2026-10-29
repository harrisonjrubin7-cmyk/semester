import { useState } from 'react';
import { toast } from 'sonner';
import { research } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Def = { id: number; kind: string; lineage: string; version: number; title: string; purpose: string; spec: { roles?: string[]; term?: string; metrics?: string[]; cohorts?: string[] }; specHash: string; state: string; rev: number; mine: boolean; author: string; approver: string | null; reviewNote: string; size: string | null; updatedAt: string | null };
type Cell = { label: string; display: string; suppressed: boolean };
type Snap = { id: number; defId: number; codeVersion: string; minCell: number; output: { tables: { key: string; label: string; cells: Cell[]; totalDisplay: string }[] }; outputHash: string; matchesPrevious: boolean | null; runBy: string; runAt: string | null };
type Data = { isAdmin: boolean; analyst: boolean; steward: boolean; minCell: number; codeVersion: string; metrics: { id: string; label: string; caveat: string }[]; roles: string[]; analysts: { id: string; name: string }[]; defs: Def[]; snapshots: Snap[] };

const run = async (input: Record<string, unknown>, ok: string, reload: () => Promise<void>) => { try { await research(input as never); toast.success(ok); await reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };

function DefCard({ d, data, reload }: { d: Def; data: Data; reload: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const snaps = data.snapshots.filter((s) => s.defId === d.id);
  const cohortName = (id: string) => data.defs.find((x) => String(x.id) === id)?.title ?? `#${id}`;
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{d.title} <span className="text-xs text-muted-foreground">v{d.version} · {d.kind}</span></p>
        <p className="text-xs text-muted-foreground">{d.purpose}</p>
        <p className="text-xs">{d.kind === 'cohort' ? `Roles: ${(d.spec.roles ?? []).join(', ')}${d.spec.term ? ` · enrolled in ${d.spec.term}` : ''} · size now: ${d.size ?? '—'}` : `Metrics: ${(d.spec.metrics ?? []).map((m) => data.metrics.find((x) => x.id === m)?.label ?? m).join(', ') || 'none'}${(d.spec.cohorts ?? []).length ? ` · cohorts: ${(d.spec.cohorts ?? []).map(cohortName).join(', ')}` : ''}`}</p>
        <p className="text-xs text-muted-foreground">by {d.mine ? 'you' : d.author}{d.approver ? ` · approved by ${d.approver}` : ''}{d.reviewNote ? ` · ${d.reviewNote}` : ''}</p></div><Status value={d.state.replace('_', ' ')} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {d.state === 'draft' && d.mine && <Button size="sm" onClick={() => run({ action: 'def', step: 'submit', id: d.id, expectedVersion: d.rev }, 'Sent to a data steward', reload)}>Send for approval</Button>}
        {d.state === 'in_review' && data.steward && !d.mine && <><Input aria-label="Review note" className="h-8 w-56" placeholder="Note (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" onClick={() => run({ action: 'def', step: 'approve', id: d.id, expectedVersion: d.rev, seenHash: d.specHash, note }, 'Approved', reload)}>Approve this definition</Button><Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'def', step: 'return', id: d.id, expectedVersion: d.rev, seenHash: d.specHash, note }, 'Returned', reload)}>Return</Button></>}
        {d.state === 'approved' && data.analyst && <Button size="sm" variant="outline" onClick={() => run({ action: 'def', step: 'new_version', id: d.id, expectedVersion: d.rev }, 'New version started as a draft', reload)}>New version</Button>}
        {d.state === 'approved' && d.kind === 'dataset' && data.analyst && <Button size="sm" onClick={() => run({ action: 'snapshot', datasetId: d.id, seenHash: d.specHash }, 'Snapshot stored', reload)}>Run snapshot</Button>}
      </div>
      {snaps.length > 0 && <details className="mt-2"><summary className="text-xs">Snapshots ({snaps.length})</summary>{snaps.map((s) => (
        <div key={s.id} className="mt-2 rounded-sm border border-border p-2 text-xs">
          <p>#{s.id} · {fmt(s.runAt)} · {s.runBy} · {s.matchesPrevious === null ? 'first run' : s.matchesPrevious ? '✓ reproduces the previous run' : '! differs from the previous run (data moved)'}</p>
          <p className="break-all font-mono text-muted-foreground">output {s.outputHash} · {s.codeVersion}</p>
          {s.output.tables.map((t) => <div key={t.key} className="mt-1"><p className="font-medium">{t.label} · total {t.totalDisplay}</p><p>{t.cells.map((c) => `${c.label}: ${c.display}`).join(' · ') || 'no records'}</p></div>)}
        </div>))}</details>}
    </div>
  );
}

function NewDef({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<'cohort' | 'dataset'>('dataset');
  const [f, setF] = useState({ title: '', purpose: '', term: '' });
  const [roles, setRoles] = useState<string[]>(['Student']); const [metrics, setMetrics] = useState<string[]>([]); const [cohorts, setCohorts] = useState<string[]>([]);
  const approvedCohorts = data.defs.filter((d) => d.kind === 'cohort' && d.state === 'approved');
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = async () => {
    const spec = kind === 'cohort' ? { roles, ...(f.term.trim() ? { term: f.term.trim() } : {}) } : { metrics, cohorts };
    if (await run({ action: 'def', step: 'draft', id: null, expectedVersion: null, kind, title: f.title, purpose: f.purpose, spec }, 'Draft saved', reload)) setF({ title: '', purpose: '', term: '' });
  };
  return (
    <Panel title="New cohort or dataset">
      <fieldset className="text-xs"><legend>Kind</legend><label className="mr-3"><input type="radio" checked={kind === 'dataset'} onChange={() => setKind('dataset')} /> Dataset</label><label><input type="radio" checked={kind === 'cohort'} onChange={() => setKind('cohort')} /> Cohort</label></fieldset>
      <Label htmlFor="nd-t" className="mt-3 block">Title</Label><Input id="nd-t" className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Label htmlFor="nd-p" className="mt-3 block">Purpose</Label><Textarea id="nd-p" className="mt-1" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Why it is needed and who will see the results (20+ characters)" />
      {kind === 'cohort' ? <>
        <fieldset className="mt-3 text-xs"><legend>Roles</legend><div className="flex flex-wrap gap-3">{data.roles.map((r) => <label key={r}><input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(roles, setRoles, r)} /> {r}</label>)}</div></fieldset>
        <Label htmlFor="nd-term" className="mt-3 block">Enrolled in term (optional)</Label><Input id="nd-term" className="mt-1" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="Fall 2026" />
      </> : <>
        <fieldset className="mt-3 text-xs"><legend>Metrics</legend><div className="space-y-1">{data.metrics.map((m) => <label key={m.id} className="block"><input type="checkbox" checked={metrics.includes(m.id)} onChange={() => toggle(metrics, setMetrics, m.id)} /> {m.label}</label>)}</div></fieldset>
        <fieldset className="mt-3 text-xs"><legend>Approved cohorts</legend>{approvedCohorts.length === 0 ? <p className="text-muted-foreground">None approved yet.</p> : <div className="space-y-1">{approvedCohorts.map((c) => <label key={c.id} className="block"><input type="checkbox" checked={cohorts.includes(String(c.id))} onChange={() => toggle(cohorts, setCohorts, String(c.id))} /> {c.title} v{c.version}</label>)}</div>}</fieldset>
      </>}
      <Button className="mt-3 w-full" disabled={f.title.trim().length < 5 || f.purpose.trim().length < 20 || (kind === 'cohort' ? roles.length === 0 : metrics.length + cohorts.length === 0)} onClick={save}>Save draft</Button>
    </Panel>
  );
}

export default function Research() {
  const state = useLoad(() => research({ action: 'get' }) as Promise<Data>);
  const [email, setEmail] = useState('');
  return (
    <>
      <PageHeader eyebrow="Staff" title="Research datasets" sub="Cohorts and datasets approved by a data steward, run as reproducible aggregate snapshots. No person-level data leaves the server." />
      <Loadable state={state}>{(d: Data) => (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Datasets">{d.defs.filter((x) => x.kind === 'dataset').length === 0 ? <Empty>No datasets yet.</Empty> : d.defs.filter((x) => x.kind === 'dataset').map((x) => <DefCard key={x.id} d={x} data={d} reload={state.reload} />)}</Panel>
            <Panel title="Cohorts">{d.defs.filter((x) => x.kind === 'cohort').length === 0 ? <Empty>No cohorts yet.</Empty> : d.defs.filter((x) => x.kind === 'cohort').map((x) => <DefCard key={x.id} d={x} data={d} reload={state.reload} />)}</Panel>
            <p className="text-xs text-muted-foreground">Counts under {d.minCell} show as “&lt;{d.minCell}”, with a second cell hidden where needed so they can’t be worked out. Snapshots record the exact definition and code version ({d.codeVersion}).</p>
          </div>
          <div className="space-y-4">
            {d.analyst && <NewDef data={d} reload={state.reload} />}
            {d.isAdmin && <Panel title="Institutional researchers (administrators)">
              <ul className="text-sm">{d.analysts.map((x) => <li key={x.id}>{x.name}</li>)}</ul>{!d.analysts.length && <Empty>None yet.</Empty>}
              <Label htmlFor="ra-e" className="mt-3 block">Email</Label><Input id="ra-e" className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="mt-2 flex gap-2"><Button size="sm" disabled={!email.includes('@')} onClick={() => run({ action: 'setAnalyst', email, on: true }, 'Appointed', state.reload)}>Appoint</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => run({ action: 'setAnalyst', email, on: false }, 'Removed', state.reload)}>Remove</Button></div>
              <p className="mt-2 text-xs text-muted-foreground">Approvals come from data stewards (Data governance).</p>
            </Panel>}
          </div>
        </div>
      )}</Loadable>
    </>
  );
}
