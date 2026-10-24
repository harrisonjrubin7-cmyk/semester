import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { FinanceOutputType } from 'zitejs/api';
import { Chip, fmt } from './ui';
import { Inv, money, run } from './FinancePage';

type Audit = FinanceOutputType['audit'];

export default function InvoiceDetail({ inv, me, audit, onClose, onChanged }: { inv: Inv; me: string; audit: Audit; onClose: () => void; onChanged: () => void }) {
  // One key per (invoice, action, snapshot): repeat clicks replay the stored receipt.
  const key = (a: string) => `${a}:${inv.id}:${inv.snapshot.slice(0, 10)}:${inv.updatedAt}`;
  const [pay, setPay] = useState({ amount: '', ref: '' });
  const [payKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<boolean>) => { setBusy(true); if (await fn()) onChanged(); setBusy(false); };
  const mine = inv.createdBy === me;
  const amt = Math.round(Number(pay.amount) * 100);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>INV-{inv.number} · {inv.customer}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-2"><Chip value={inv.status} /><span className="text-xs text-muted-foreground">Synthetic record · issuing and sending disabled</span></div>
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Amount</dt><dd className="tabular-nums">{money(inv.amountMinor, inv.currency)}</dd>
            <dt className="text-muted-foreground">Payments recorded</dt><dd className="tabular-nums">{money(inv.paidMinor, inv.currency)}</dd>
            <dt className="text-muted-foreground">Memo</dt><dd>{inv.memo || '—'}</dd>
            <dt className="text-muted-foreground">Approved by</dt><dd>{inv.approvedBy || '—'}</dd>
          </dl>

          {(inv.status === 'Draft' || inv.status === 'Rejected') && mine && <Button disabled={busy} onClick={() => act(() => run({ action: 'submit', invoiceId: inv.id }, key('submit')))}>Submit for approval</Button>}

          {inv.status === 'Pending approval' && (mine
            ? <p className="rounded-[3px] border border-border p-3 text-xs">Waiting for another person. You can't approve an invoice you created.</p>
            : <div className="space-y-2 rounded-[3px] border border-border p-3">
                <p className="eyebrow">Approval preview</p>
                <p>You are approving exactly: <b>{inv.customer}</b>, <b>{money(inv.amountMinor, inv.currency)}</b>, memo “{inv.memo || '—'}”.</p>
                <p className="font-mono text-[11px] text-muted-foreground">Bound to snapshot {inv.snapshot.slice(0, 16)}. If anything changes before you confirm, the approval is refused.</p>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => act(() => run({ action: 'approve', invoiceId: inv.id, snapshot: inv.snapshot }, key('approve')))}>Approve exactly this</Button>
                  <Button variant="outline" disabled={busy} onClick={() => act(() => run({ action: 'reject', invoiceId: inv.id, snapshot: inv.snapshot }, key('reject')))}>Reject</Button>
                </div>
              </div>)}

          {(inv.status === 'Approved' || inv.status === 'Mismatch' || inv.status === 'Paid') && (
            <div className="space-y-2 rounded-[3px] border border-border p-3">
              <p className="eyebrow">Reconciliation</p>
              {inv.status !== 'Paid' && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => run({ action: 'payment', invoiceId: inv.id, amountMinor: amt, reference: pay.ref.trim() }, payKey)); }}>
                  <Input aria-label="Payment amount" inputMode="decimal" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  <Input aria-label="Payment reference" placeholder="Synthetic ref" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />
                  <Button type="submit" variant="outline" disabled={busy || amt <= 0 || !pay.ref.trim()}>Record</Button>
                </form>
              )}
              <Button disabled={busy} onClick={() => act(() => run({ action: 'reconcile', invoiceId: inv.id }, `reconcile:${inv.id}:${inv.updatedAt}:${inv.paidMinor}`))}>Reconcile now</Button>
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">Audit timeline</p>
            <ol className="space-y-2 border-l border-border pl-3">
              {audit.map((a, i) => <li key={i} className="text-xs"><span className="font-medium">{a.action}</span> · {a.actor} · <span className="text-muted-foreground">{fmt(a.at)}</span><div className="text-muted-foreground">{a.detail}</div></li>)}
              {!audit.length && <li className="text-xs text-muted-foreground">No entries.</li>}
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
