import { useState } from 'react';
import { toast } from 'sonner';
import { migrations } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STAGES = ['inventory', 'mapping', 'validation', 'dual_run', 'awaiting_approval', 'rollback_window', 'completed'];
const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';

function useRun(reload: () => void) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await migrations({ op: 'run', commandKey: key, ...input } as never) as { resultCode: string; message: string; replay: boolean };
      (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
      if (r.resultCode === 'OK') { setKey(crypto.randomUUID()); reload(); return true; }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    return false;
  };
  return { run, busy };
}

function Create({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ tenantId: '', domain: 'registrar', title: '' });
  const { run, busy } = useRun(reload);
  return (
    <Panel title="New migration">
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'create', ...f })) setF({ ...f, title: '' }); }}>
        <select aria-label="Institution" className={sel} value={f.tenantId} onChange={(e) => setF({ ...f, tenantId: e.target.value })}><option value="">Institution…</option>{d.institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}{i.sample ? ' (sample)' : ''}</option>)}</select>
        <select aria-label="Domain" className={sel} value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })}>{['registrar', 'student_accounts', 'courses', 'identity', 'campus_services', 'other'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select>
        <Input aria-label="Title" placeholder="e.g. Registrar sections from Banner" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Button type="submit" disabled={busy || !f.tenantId || f.title.trim().length < 5}>Create</Button>
      </form>
    </Panel>
  );
}

function Project({ p, reload }: { p: any; reload: () => void }) {
  const { run, busy } = useRun(reload);
  const go = (action: string, extra: Record<string, unknown> = {}) => run({ action, projectId: p.id, version: p.version, ...extra });
  const [inv, setInv] = useState({ item: '', sourceSystem: '', recordCount: '', owner: '' });
  const [plan, setPlan] = useState({ mappingNote: p.mappingNote, rollbackPlan: p.rollbackPlan, rollbackHours: String(p.rollbackHours) });
  const [r, setR] = useState({ source: '', target: '', mismatches: '0', note: '' });
  const [reason, setReason] = useState('');
  const runKind = p.stage === 'validation' ? 'validation' : p.stage === 'dual_run' ? 'dual_run' : p.stage === 'rollback_window' ? 'post_cutover' : null;
  const open = !['completed', 'rolled_back'].includes(p.stage);
  return (
    <div className="space-y-4">
      <Panel title={<span className="flex flex-wrap items-center gap-2">#{p.number} {p.title} <Chip value={p.stage.replace('_', ' ')} /></span>}>
        <p className="text-sm">{p.tenant} · {p.domain.replace('_', ' ')} · lead {p.lead}</p>
        <ol className="mt-3 flex flex-wrap gap-1 text-xs" aria-label="Stages">{STAGES.map((s) => <li key={s} className={`rounded-[3px] border px-2 py-1 ${s === p.stage ? 'border-primary font-medium' : 'border-border text-muted-foreground'}`}>{s.replace('_', ' ')}</li>)}</ol>
        {p.stage === 'rollback_window' && <p className="mt-2 text-sm">Cutover {fmt(p.cutoverAt)}. Rollback window ends {fmt(p.windowEndsAt)}.</p>}
        {p.endedReason && <p className="mt-2 text-sm">Ended: {p.endedReason}</p>}
        <p className="mt-2 text-xs text-muted-foreground">This records and gates the migration. It does not move data; the legacy system stays authoritative until cutover is approved and completed.</p>
      </Panel>

      {open && <Panel title="Next steps">
        <div className="space-y-4">
          {['inventory', 'mapping'].includes(p.stage) && <div className="space-y-2"><p className="text-sm font-medium">Add inventory item</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input aria-label="Item" placeholder="Item (e.g. Sections)" value={inv.item} onChange={(e) => setInv({ ...inv, item: e.target.value })} />
              <Input aria-label="Source system" placeholder="Source system" value={inv.sourceSystem} onChange={(e) => setInv({ ...inv, sourceSystem: e.target.value })} />
              <Input aria-label="Record count" type="number" min={0} placeholder="Records" value={inv.recordCount} onChange={(e) => setInv({ ...inv, recordCount: e.target.value })} />
              <Input aria-label="Owner" placeholder="Data owner" value={inv.owner} onChange={(e) => setInv({ ...inv, owner: e.target.value })} />
            </div>
            <Button size="sm" disabled={busy} onClick={() => go('inventory', { ...inv, recordCount: Number(inv.recordCount) })}>Add</Button></div>}
          {['inventory', 'mapping', 'validation', 'dual_run'].includes(p.stage) && <div className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">Plan</p>
            <Textarea aria-label="Field mapping" rows={2} placeholder="Field mapping version and who approved it" value={plan.mappingNote} onChange={(e) => setPlan({ ...plan, mappingNote: e.target.value })} />
            <Textarea aria-label="Rollback plan" rows={2} placeholder="Rollback plan: how to return to the legacy system and who decides" value={plan.rollbackPlan} onChange={(e) => setPlan({ ...plan, rollbackPlan: e.target.value })} />
            <label className="text-xs">Rollback window (hours)<Input type="number" min={24} max={720} value={plan.rollbackHours} onChange={(e) => setPlan({ ...plan, rollbackHours: e.target.value })} className="mt-1 w-32" /></label>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => go('plan', { ...plan, rollbackHours: Number(plan.rollbackHours) })}>Save plan</Button></div>}
          {runKind && <div className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">Record {runKind.replace('_', ' ')} reconciliation</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input aria-label="Source count" type="number" min={0} placeholder="Source count" value={r.source} onChange={(e) => setR({ ...r, source: e.target.value })} />
              <Input aria-label="Target count" type="number" min={0} placeholder="Semester count" value={r.target} onChange={(e) => setR({ ...r, target: e.target.value })} />
              <Input aria-label="Mismatches" type="number" min={0} placeholder="Mismatches" value={r.mismatches} onChange={(e) => setR({ ...r, mismatches: e.target.value })} />
              <Input aria-label="Run note" placeholder="Note" value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} />
            </div>
            <Button size="sm" disabled={busy} onClick={() => go('record_run', { kind: runKind, sourceCount: Number(r.source), targetCount: Number(r.target), mismatches: Number(r.mismatches), note: r.note })}>Record run</Button></div>}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {['inventory', 'mapping', 'validation', 'dual_run'].includes(p.stage) && <Button size="sm" disabled={busy} onClick={() => go('advance')}>Advance stage</Button>}
            {p.stage === 'awaiting_approval' && <Button size="sm" disabled={busy || !p.evidenceApproved} onClick={() => go('cutover')}>Record cutover</Button>}
            {p.stage === 'awaiting_approval' && !p.evidenceApproved && <p className="text-xs text-muted-foreground">Waiting for the institution's administrator to approve in their Semester console.</p>}
            {p.stage === 'rollback_window' && <Button size="sm" disabled={busy} onClick={() => go('complete')}>Complete</Button>}
          </div>
          {p.stage === 'rollback_window' && <div className="space-y-2"><Input aria-label="Rollback reason" placeholder="Reason to roll back" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => go('rollback', { reason })}>Roll back</Button></div>}
        </div>
      </Panel>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Inventory · ${p.inventory.length}`}>{p.inventory.length ? <ul className="space-y-1 text-sm">{p.inventory.map((x: any, i: number) => <li key={i}>{x.item} · {x.source} · {x.count.toLocaleString()} records · {x.owner}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing inventoried.</p>}</Panel>
        <Panel title={`Reconciliation runs · ${p.runs.length}`}>{p.runs.length ? <ul className="space-y-1 text-sm">{p.runs.map((x: any, i: number) => <li key={i}><Chip value={x.passed ? 'passed' : 'failed'} /> {x.kind.replace('_', ' ')} · {x.source}→{x.target} · {x.mismatches} mismatches · {fmt(x.at)}</li>)}</ul> : <p className="text-sm text-muted-foreground">No runs yet.</p>}</Panel>
      </div>
      {p.approvals.length > 0 && <Panel title="Institution approvals">{p.approvals.map((a: any, i: number) => <p key={i} className="text-sm">{a.by} · {fmt(a.at)} · “{a.note}” {a.current ? '' : '(evidence has since changed)'}</p>)}</Panel>}
      <Panel title="Timeline"><ol className="space-y-1 text-sm">{p.timeline.map((t: any, i: number) => <li key={i}><span className="text-xs text-muted-foreground">{fmt(t.at)} · {t.actor}</span> — {t.action.replace('_', ' ')}{t.detail ? ` · ${t.detail}` : ''}</li>)}</ol></Panel>
    </div>
  );
}

export default function MigrationsPage() {
  const s = useLoad(() => migrations({ op: 'list' }) as Promise<any>, []);
  const [cur, setCur] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-6xl">
      <Header eyebrow="Implementation" title="Domain migrations" sub="Inventory → mapping → validation → dual run → institution approval → cutover → rollback window → complete. A failed reconciliation blocks promotion, and an import alone never counts as done." />
      <Loadable state={s}>{(d: any) => {
        const p = d.projects.find((x: any) => x.id === cur) ?? d.projects[0];
        return (
          <div className="space-y-4">
            <Create d={d} reload={s.reload} />
            {!p ? <Panel><p className="text-sm text-muted-foreground">No migrations yet.</p></Panel> : (
              <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <nav aria-label="Migrations" className="space-y-1">{d.projects.map((x: any) => (
                  <button key={x.id} onClick={() => setCur(x.id)} className={`block w-full rounded-[3px] border p-2 text-left text-sm ${x.id === p.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
                    #{x.number} {x.title}<span className="mt-1 flex gap-1"><Chip value={x.stage.replace('_', ' ')} /></span></button>))}</nav>
                <Project key={`${p.id}:${p.version}`} p={p} reload={s.reload} />
              </div>)}
          </div>
        );
      }}</Loadable>
    </div>
  );
}
