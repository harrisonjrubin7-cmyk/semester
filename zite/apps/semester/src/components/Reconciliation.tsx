import { useState } from 'react';
import { toast } from 'sonner';
import { reconciliation } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Badge } from '@project/components/ui/badge';
import { Panel, Empty, Metric, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const call = async (input: any, ok: (r: any) => string, reload: () => void) => { try { const r = await reconciliation(input); toast(ok(r)); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };

function ScopeRow({ c, reload }: { c: any; reload: () => void }) {
  const [sel, setSel] = useState<string[]>(c.granted ?? c.required);
  const [reason, setReason] = useState(c.reason ?? '');
  const writes = sel.some((s) => c.writeScopes.includes(s));
  const changed = JSON.stringify([...sel].sort()) !== JSON.stringify([...(c.granted ?? [])].sort());
  return (
    <div className="border-t border-border py-3 text-sm first:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{c.connector}</span>
        <span className="text-xs text-muted-foreground">{c.granted ? `Set by ${c.by} · ${fmt(c.at)}` : 'Not set — connector should not sync yet'}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {c.allowed.map((s: string) => (
          <label key={s} className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={sel.includes(s)} disabled={c.required.includes(s)} onCheckedChange={(v) => setSel(v ? [...sel, s] : sel.filter((x) => x !== s))} />
            {s}{c.required.includes(s) && <span className="text-muted-foreground">(required)</span>}{c.writeScopes.includes(s) && <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">writes</Badge>}
          </label>))}
      </div>
      <div className="mt-2 flex gap-2">
        {writes && <Input aria-label="Why it writes" className="max-w-sm" placeholder="Why this connector writes to an official system" value={reason} onChange={(e) => setReason(e.target.value)} />}
        <Button size="sm" variant="outline" disabled={!changed || (writes && reason.trim().length < 10)} onClick={() => call({ action: 'setScopes', connector: c.connector, scopes: sel, reason: writes ? reason : '' }, () => `${c.connector} scopes saved.`, reload)}>Save scopes</Button>
      </div>
    </div>
  );
}

/** Console tab (Integration Admin): least-privilege scopes and registrar reconciliation runs. */
export default function Reconciliation() {
  const s = useLoad(() => reconciliation({ action: 'get' }));
  const [busy, setBusy] = useState(false);
  const run = async (repair: boolean) => { setBusy(true); await call({ action: 'run', repair }, (r) => `Checked ${r.lastRun.seats} seats: ${r.lastRun.findings} findings, ${r.lastRun.repaired} repaired, ${r.lastRun.flagged} flagged.`, s.reload); setBusy(false); };
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="grid gap-4">
        <Panel title="Reconciliation" action={<div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(false)}>Check only</Button>
          <Button size="sm" disabled={busy} onClick={() => run(true)}>Run and repair</Button></div>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Registrar updates waiting" value={d.outboxPending} />
            <Metric label="Last run" value={d.runs[0] ? fmt(d.runs[0].at) : '—'} />
            <Metric label="Last run findings" value={d.runs[0] ? d.runs[0].findings.length : '—'} />
          </div>
          {d.outboxError && <p className="mt-2 text-xs text-destructive">Last delivery error: {d.outboxError}</p>}
          <p className="mt-2 text-xs text-muted-foreground">A run retries waiting registrar updates, then compares ledger seats with enrollment records. Repair only marks a student Enrolled where the ledger holds their seat. Records marked Enrolled with no ledger seat are flagged for a person to review — they may come from the student information system.</p>
        </Panel>
        <Panel title={`Run history · ${d.runs.length}`}>
          {!d.runs.length ? <Empty>No runs yet.</Empty> : d.runs.map((r: any) => (
            <details key={r.id} className="border-t border-border py-2 text-sm first:border-0">
              <summary className="cursor-pointer">#{r.id} · {fmt(r.at)} · {r.by} · {r.seats} seats · {r.findings.length} findings · {r.repaired} repaired · {r.flagged} flagged · updates {r.outboxDispatched} sent / {r.outboxFailed} failed</summary>
              {r.findings.length ? <ul className="mt-1 text-xs">{r.findings.map((f: any, i: number) => (
                <li key={i} className="py-0.5">{f.kind === 'missing_in_records' ? 'Ledger seat, record not Enrolled' : 'Enrolled record, no ledger seat'} · {f.student} · {f.section}</li>))}</ul>
                : <p className="mt-1 text-xs text-muted-foreground">Ledger and records match.</p>}
            </details>))}
        </Panel>
        <Panel title="Connector scopes">
          <p className="mb-1 text-xs text-muted-foreground">Grant each connector only what it needs. Required scopes are always on; write access needs a reason. Every change is kept in history and the audit log.</p>
          {d.scopes.map((c: any) => <ScopeRow key={`${c.connector}-${c.at}`} c={c} reload={s.reload} />)}
        </Panel>
      </div>)}
    </Loadable>
  );
}
