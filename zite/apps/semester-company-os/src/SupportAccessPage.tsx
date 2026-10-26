import { useState } from 'react';
import { toast } from 'sonner';
import { supportAccess } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL: Record<string, string> = { configuration: 'Institution configuration', integration_status: 'Integration status', course_catalog: 'Course catalog' };

function RequestForm({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ tenantId: '', ticketRef: '', purpose: '', scopes: [] as string[], hours: 2 });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const ok = f.tenantId && f.ticketRef.trim() && f.purpose.trim().length >= 20 && f.scopes.length;
  return (
    <Panel title="Request access for a ticket">
      <form className="space-y-2" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { const r = await supportAccess({ op: 'request', requestId: key, ...f } as never) as { message: string }; toast.success(r.message); setKey(crypto.randomUUID()); setF({ ...f, purpose: '', scopes: [] }); reload(); }
        catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
      }}>
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Institution" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={f.tenantId} onChange={(e) => setF({ ...f, tenantId: e.target.value })}>
            <option value="">Institution…</option>{d.institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}{i.sample ? ' (sample)' : ''}</option>)}</select>
          <Input aria-label="Ticket" placeholder="Ticket reference" value={f.ticketRef} onChange={(e) => setF({ ...f, ticketRef: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">Hours<Input type="number" min={1} max={8} value={f.hours} onChange={(e) => setF({ ...f, hours: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} className="w-20" /></label>
        </div>
        <Textarea aria-label="Purpose" rows={2} placeholder="Why you need access and what you will look at (20+ characters)" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
        <fieldset className="flex flex-wrap gap-4"><legend className="sr-only">Scopes</legend>{d.scopes.map((s: string) => (
          <label key={s} className="flex items-center gap-2 text-sm"><Checkbox checked={f.scopes.includes(s)} onCheckedChange={(c) => setF({ ...f, scopes: c ? [...f.scopes, s] : f.scopes.filter((x) => x !== s) })} />{LABEL[s]}</label>))}</fieldset>
        <Button type="submit" disabled={busy || !ok}>Request access</Button>
        <p className="text-xs text-muted-foreground">Support has no standing access to any institution, and student records are never available through support access.</p>
      </form>
    </Panel>
  );
}

function View({ r }: { r: any }) {
  const [out, setOut] = useState<{ scope: string; rows: any[] } | null>(null);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">{r.scopes.map((s: string) => <Button key={s} size="sm" variant="outline" onClick={async () => {
        try { setOut(await supportAccess({ op: 'view', tenantId: r.tenantId, scope: s as never }) as any); } catch (e) { toast.error(errMsg(e)); setOut(null); }
      }}>View {LABEL[s].toLowerCase()}</Button>)}</div>
      {out && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{Object.keys(out.rows[0] ?? {}).map((k) => <th key={k} className="pr-3 text-left">{k}</th>)}</tr></thead>
        <tbody>{out.rows.map((row, i) => <tr key={i} className="border-t border-border">{Object.values(row).map((v, j) => <td key={j} className="py-1 pr-3">{String(v ?? '—')}</td>)}</tr>)}</tbody></table>
        {!out.rows.length && <p className="text-xs text-muted-foreground">Nothing to show.</p>}</div>}
      <p className="text-xs text-muted-foreground">Each view is checked against the grant and logged where the institution can see it.</p>
    </div>
  );
}

export default function SupportAccessPage() {
  const s = useLoad(() => supportAccess({ op: 'list' }) as Promise<any>, []);
  return (
    <div className="mx-auto max-w-5xl">
      <Header eyebrow="Support" title="Support access" sub="Time-limited, purpose-bound access to one institution for one ticket, approved by that institution and logged on every view." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <RequestForm d={d} reload={s.reload} />
          {d.requests.map((r: any) => (
            <Panel key={r.id} title={<span className="flex flex-wrap items-center gap-2">#{r.number} {r.tenant} · {r.ticket} <Chip value={r.active ? 'active' : r.state} /></span>}>
              <p className="text-sm">{r.purpose}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.scopes.map((x: string) => LABEL[x]).join(', ')} · {r.hours} h{r.expiresAt ? ` · expires ${fmt(r.expiresAt)}` : ''}{r.note ? ` · “${r.note}”` : ''}</p>
              {r.active && <View r={r} />}
              {(r.active || r.state === 'pending') && <Button size="sm" variant="outline" className="mt-2" onClick={async () => {
                try { await supportAccess({ op: 'revoke', id: r.id }); toast.success(r.state === 'pending' ? 'Withdrawn.' : 'Access revoked.'); s.reload(); } catch (e) { toast.error(errMsg(e)); }
              }}>{r.state === 'pending' ? 'Withdraw request' : 'End access now'}</Button>}
              <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">{r.events.map((e: any, i: number) => <li key={i}>{fmt(e.at)} · {e.action}{e.detail ? ` · ${e.detail}` : ''}</li>)}</ol>
            </Panel>))}
        </div>)}
      </Loadable>
    </div>
  );
}
