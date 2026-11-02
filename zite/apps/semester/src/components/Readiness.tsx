import { institutionReadiness } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Panel, Empty, Status, fmt, useLoad, Loadable } from './kit';

const MARK = { ok: '✓', blocked: '✕', info: 'i' } as const;

export default function Readiness() {
  const s = useLoad(() => institutionReadiness({}));
  return (
    <Loadable state={s}>{(d) => (
      <div className="space-y-4">
        <Panel title={d.ready ? 'Ready — no blockers' : 'Not ready yet'}>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Read-only check. Nothing here changes a record. Checked {fmt(d.generatedAt)}.</span>
            <Button size="sm" variant="outline" onClick={s.reload}>Re-check</Button>
          </div>
          <ul className="divide-y divide-border">
            {d.checks.map((c) => (
              <li key={c.key} className="flex gap-3 py-2 text-sm">
                <span aria-hidden className={`mt-0.5 w-4 text-center font-mono ${c.state === 'blocked' ? 'text-destructive' : c.state === 'ok' ? 'text-primary' : 'text-muted-foreground'}`}>{MARK[c.state]}</span>
                <span><span className="font-medium">{c.label}</span> <span className="sr-only">({c.state})</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Data sources · freshness">
            {d.sources.length ? <table className="w-full text-sm"><tbody>{d.sources.map((x) => (
              <tr key={x.name} className="border-t border-border"><td className="py-2 pr-3">{x.name}<span className="block text-xs text-muted-foreground">{x.connector} · {x.lastSyncedAt ? fmt(x.lastSyncedAt) : 'never synced'}</span></td>
                <td className="pr-3"><Status value={x.state} /></td><td className="text-xs text-muted-foreground">{x.detail}</td></tr>))}</tbody></table>
              : <Empty>No data sources connected for this institution.</Empty>}
            <p className="mt-2 text-xs text-muted-foreground">A stale or failing SIS pauses Registrar commits until it is fresh again.</p>
          </Panel>
          <Panel title="Source reconciliation">
            {!d.recon.ledgerAvailable ? <Empty>Registrar ledger unreachable.</Empty>
              : d.recon.mismatches.length ? <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Section</th><th className="text-right">App</th><th className="text-right">Ledger</th></tr></thead>
                <tbody>{d.recon.mismatches.map((m) => <tr key={m.sectionId} className="border-t border-border"><td className="py-2">{m.label}</td><td className="text-right tabular-nums">{m.zite}</td><td className="text-right tabular-nums">{m.ledger}</td></tr>)}</tbody></table>
              : <Empty>{d.recon.checked ? `All ${d.recon.checked} section(s) match the registrar ledger.` : 'No ledger decisions yet to compare.'}</Empty>}
          </Panel>
        </div>
      </div>
    )}</Loadable>
  );
}
