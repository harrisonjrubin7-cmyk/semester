import { useState } from 'react';
import { toast } from 'sonner';
import { registrarLedger } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Panel, Empty, Loadable, useLoad, fmtDay, errMsg } from './kit';

export default function RegistrarLedger() {
  const s = useLoad(() => registrarLedger({}));
  const [busy, setBusy] = useState(false);
  const reconcile = async () => {
    setBusy(true);
    try {
      const r = await registrarLedger({ reconcile: true });
      toast(r.failed ? `! ${r.dispatched} applied, ${r.failed} still pending` : `✓ ${r.dispatched} pending update(s) applied`);
      s.reload();
    } catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Loadable state={s}>{(d) => (
      <Panel title={`Registrar ledger · ${d.pending} pending update${d.pending === 1 ? '' : 's'}`}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground">Each decision is saved in the controlled Postgres backend in one transaction: seat, receipt, audit entry and outbox. Student records update from the outbox; anything that fails stays pending here.</p>
          <Button size="sm" variant="outline" disabled={busy || d.pending === 0} onClick={reconcile}>Reconcile</Button>
        </div>
        {d.receipts.length ? (
          <table className="w-full text-sm"><tbody>{d.receipts.map((r) => (
            <tr key={r.commandKey} className="border-t border-border">
              <td className="py-1.5 pr-3 font-mono text-[11px]">{r.commandKey.slice(0, 22)}</td>
              <td className="pr-3">{r.state} <span className="font-mono text-xs text-muted-foreground">{r.resultCode}</span></td>
              <td className="pr-3 text-xs">{r.outbox === 'dispatched' ? 'Applied' : <span className="text-destructive" title={r.lastError}>Pending{r.lastError ? ` · ${r.lastError}` : ''}</span>}</td>
              <td className="text-right text-xs text-muted-foreground">{fmtDay(r.createdAt)}</td>
            </tr>
          ))}</tbody></table>
        ) : <Empty>No receipts yet.</Empty>}
      </Panel>
    )}</Loadable>
  );
}
