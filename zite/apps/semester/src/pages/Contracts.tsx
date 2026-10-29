import { useState } from 'react';
import { toast } from 'sonner';
import { contracts } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { money } from '../lib/procureRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const cents = (s: string) => Math.round(Number(s || 0) * 100);
const KIND: Record<string, string> = { supplier: 'Supplier', service: 'Service', partner: 'Partner', other: 'Other' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function ContractCard({ c, d, reload }: { c: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [p, setP] = useState({ terms: c.terms || '', value: c.valueCents ? String(c.valueCents / 100) : '', startsOn: c.startsOn ?? '', endsOn: c.endsOn ?? '' });
  const canPropose = d.isManager && ['draft', 'proposed', 'active'].includes(c.state);
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{c.title} <span className="text-xs font-normal text-muted-foreground">· {c.org} · {KIND[c.kind]} · {money(c.valueCents)}{c.startsOn ? ` · ${c.startsOn}` : ''}{c.endsOn ? ` → ${c.endsOn}` : ''}</span></p>
        <Status value={c.state} />
      </div>
      {c.state === 'proposed' && <p className="mt-1 text-xs text-muted-foreground">Waiting for an administrator of {c.org} to accept these exact terms · fingerprint {c.termsHash ? c.termsHash.slice(0, 12) : ''}…</p>}
      {c.state === 'active' && <p className="mt-1 text-xs text-muted-foreground">Accepted by {c.acceptedBy ?? 'the organization'} on the exact proposed terms.</p>}
      {canPropose && <div className="mt-2 space-y-2">
        <Textarea aria-label="Contract terms" rows={4} placeholder="The full terms, in plain language. The value and end date are pinned to the terms by a fingerprint, so changing any of them needs a fresh acceptance." value={p.terms} onChange={(e) => setP({ ...p, terms: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-3">
          <Input aria-label="Value in dollars" type="number" min={0} step={0.01} placeholder="Value ($)" value={p.value} onChange={(e) => setP({ ...p, value: e.target.value })} />
          <Input aria-label="Starts on" type="date" value={p.startsOn} onChange={(e) => setP({ ...p, startsOn: e.target.value })} />
          <Input aria-label="Ends on" type="date" value={p.endsOn} onChange={(e) => setP({ ...p, endsOn: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={p.terms.trim().length < 20} onClick={() => act(() => contracts({ action: 'propose', id: c.id, terms: p.terms, valueCents: cents(p.value), startsOn: p.startsOn || null, endsOn: p.endsOn || null }), c.state === 'active' ? 'Amended terms proposed. The current acceptance is void.' : 'Terms proposed.')}>{c.state === 'active' ? 'Propose amended terms' : 'Propose terms'}</Button>
          {c.state === 'active' && <>
            <Button size="sm" variant="outline" onClick={() => act(() => contracts({ action: 'close', id: c.id, step: 'ended' }), 'Contract marked ended.')}>Mark ended</Button>
            <Button size="sm" variant="outline" onClick={() => act(() => contracts({ action: 'close', id: c.id, step: 'terminated' }), 'Contract terminated.')}>Terminate</Button>
          </>}
        </div>
        {c.state === 'active' && <p className="text-xs text-muted-foreground">Amending returns the contract to proposed and voids the acceptance — the organization accepts the new terms again before it is active.</p>}
      </div>}
      {!canPropose && c.terms && <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Read the terms</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{c.terms}</pre></details>}
    </li>
  );
}

export default function Contracts() {
  const s = useLoad(() => contracts({ action: 'get' }));
  const act = useAct(s.reload);
  const [n, setN] = useState({ orgId: '', title: '', kind: 'supplier', value: '', startsOn: '', endsOn: '' });
  const [st, setSt] = useState({ email: '', on: true });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Contracts" sub="Contracts with partner organizations. Terms are pinned by a fingerprint; the organization accepts the exact terms, and any change needs a fresh acceptance." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          {d.isManager && <Panel title="New contract">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <select aria-label="Organization" className={sel} value={n.orgId} onChange={(e) => setN({ ...n, orgId: e.target.value })}><option value="">Organization…</option>{d.orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <Input aria-label="Title" placeholder="Title (e.g. Lab benches supply 2027)" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} />
              <select aria-label="Kind" className={sel} value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <Input aria-label="Value in dollars" type="number" min={0} step={0.01} placeholder="Value ($)" value={n.value} onChange={(e) => setN({ ...n, value: e.target.value })} />
              <Input aria-label="Starts on" type="date" value={n.startsOn} onChange={(e) => setN({ ...n, startsOn: e.target.value })} />
              <Input aria-label="Ends on" type="date" value={n.endsOn} onChange={(e) => setN({ ...n, endsOn: e.target.value })} />
            </div>
            <div className="mt-2"><Button size="sm" disabled={!n.orgId || n.title.trim().length < 3} onClick={async () => { if (await act(() => contracts({ action: 'create', orgId: Number(n.orgId), title: n.title, kind: n.kind as never, valueCents: cents(n.value), startsOn: n.startsOn || null, endsOn: n.endsOn || null }), 'Contract drafted. Propose its terms below.')) setN({ orgId: '', title: '', kind: 'supplier', value: '', startsOn: '', endsOn: '' }); }}>Create draft</Button></div>
            {!d.orgs.length && <p className="mt-1 text-xs text-muted-foreground">No partner organizations yet — contracts need an organization with a relationship here (see Partner organizations).</p>}
          </Panel>}
          <Panel title="Contracts">{d.contracts.length ? <ul className="space-y-2">{d.contracts.map((c: any) => <ContractCard key={c.id} c={c} d={d} reload={s.reload} />)}</ul> : <Empty>No contracts yet.</Empty>}</Panel>
          {d.isAdmin && <Panel title="Contract managers">
            <p className="text-xs">{d.managers.map((m: any) => m.name).join(', ') || 'No contract managers yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Manager email" placeholder="Email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={async () => { if (await act(() => contracts({ action: 'setStaff', email: st.email, on: true }), 'Contract manager granted.')) setSt({ email: '', on: true }); }}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => contracts({ action: 'setStaff', email: st.email, on: false }), 'Contract manager removed.')}>Remove</Button>
            </div>
          </Panel>}
        </div>
      )}</Loadable>
    </>
  );
}
