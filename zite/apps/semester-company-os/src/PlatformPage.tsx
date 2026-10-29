import { useState } from 'react';
import { toast } from 'sonner';
import { platformAdmin } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

type Mod = { module: string; granted: boolean; seatLimit: number | null; apiCallsDay: number | null; rev: number; note: string; stage: string };
type Tenant = { id: string; name: string; modules: Mod[]; overrides: { key: string; on: boolean; reason: string }[]; inMaintenance: boolean };
type Flag = { key: string; description: string; defaultOn: boolean; killed: boolean; proposedOn: boolean | null; proposedByMe: boolean; rev: number; overrides: { tenantId: string; institution: string; on: boolean; reason: string }[] };
type D = { fleet: Tenant[]; flags: Flag[]; maintenance: { id: number; scope: string; title: string; impact: string; startsAt: string | null; endsAt: string | null }[];
  events: { institution: string; mine: boolean; area: string; action: string; target: string; detail: string; at: string | null }[] };

const label = (s: string) => s.replace(/_/g, ' ');
const call = async (input: Record<string, unknown>, ok: string, set: (d: D) => void) => { try { set((await platformAdmin(input as never)) as D); toast.success(ok); return true; } catch (e) { toast.error(errMsg(e)); return false; } };

function EntRow({ t, m, set }: { t: Tenant; m: Mod; set: (d: D) => void }) {
  const [seats, setSeats] = useState(m.seatLimit ? String(m.seatLimit) : ''); const [calls, setCalls] = useState(m.apiCallsDay ? String(m.apiCallsDay) : ''); const [note, setNote] = useState('');
  const go = (granted: boolean) => call({ action: 'entitle', tenantId: t.id, module: m.module, granted, seatLimit: seats ? Number(seats) : null, apiCallsDay: calls ? Number(calls) : null, expectedVersion: m.rev, note }, granted ? 'Entitlement saved' : 'Entitlement revoked; rollout turned off', set);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t py-1 text-xs">
      <span className="w-36 font-medium">{label(m.module)}</span><Chip value={m.granted ? `granted · ${m.stage}` : 'not granted'} />
      <Input aria-label={`Seat limit for ${label(m.module)}`} className="h-7 w-20" placeholder="seats" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} />
      <Input aria-label={`API calls per day for ${label(m.module)}`} className="h-7 w-24" placeholder="calls/day" value={calls} onChange={(e) => setCalls(e.target.value.replace(/\D/g, ''))} />
      <Input aria-label={`Reference for ${label(m.module)}`} className="h-7 w-48" placeholder="Order or contract reference" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => go(true)}>{m.granted ? 'Update' : 'Grant'}</Button>
      {m.granted && <Button size="sm" variant="ghost" disabled={note.trim().length < 10} onClick={() => go(false)}>Revoke</Button>}
    </div>
  );
}

function FlagCard({ f, d, set }: { f: Flag; d: D; set: (d: D) => void }) {
  const [why, setWhy] = useState(''); const [tenant, setTenant] = useState(''); const [on, setOn] = useState('true');
  const base = { action: 'flag', key: f.key, expectedVersion: f.rev, tenantId: null, on: null, text: why };
  return (
    <div className="border-t py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><p><span className="font-mono">{f.key}</span> — {f.description}</p>
        <Chip value={f.killed ? 'killed' : f.defaultOn ? 'default on' : 'default off'} /></div>
      {f.proposedOn !== null && <p className="text-xs">Proposed: default on. {f.proposedByMe ? 'Another platform admin approves it.' : <Button size="sm" variant="link" onClick={() => call({ ...base, step: 'approve' }, 'Default turned on', set)}>Approve</Button>}</p>}
      {f.overrides.map((o) => <p key={o.tenantId} className="text-xs text-muted-foreground">{o.institution}: {o.on ? 'on' : 'off'} — {o.reason} <Button size="sm" variant="link" onClick={() => call({ ...base, step: 'clear', tenantId: o.tenantId }, 'Override cleared', set)}>Clear</Button></p>)}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Input aria-label={`Reason for ${f.key}`} className="h-8 w-60" placeholder="Why (10+ characters)" value={why} onChange={(e) => setWhy(e.target.value)} />
        {f.killed ? <Button size="sm" variant="outline" disabled={why.trim().length < 10} onClick={() => call({ ...base, step: 'unkill' }, 'Kill switch released', set)}>Release kill switch</Button>
          : <Button size="sm" variant="destructive" disabled={why.trim().length < 10} onClick={() => call({ ...base, step: 'kill' }, 'Flag killed everywhere', set)}>Kill switch</Button>}
        {!f.defaultOn && f.proposedOn === null && <Button size="sm" variant="outline" disabled={why.trim().length < 10} onClick={() => call({ ...base, step: 'propose', on: true }, 'Proposed; another platform admin approves', set)}>Propose default on</Button>}
        {f.defaultOn && <Button size="sm" variant="outline" disabled={why.trim().length < 10} onClick={() => call({ ...base, step: 'propose', on: false }, 'Default turned off', set)}>Turn default off</Button>}
        <select aria-label="Institution for override" className="h-8 rounded-md border bg-background px-2 text-sm" value={tenant} onChange={(e) => setTenant(e.target.value)}><option value="">Override for…</option>{d.fleet.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select aria-label="Override value" className="h-8 rounded-md border bg-background px-2 text-sm" value={on} onChange={(e) => setOn(e.target.value)}><option value="true">on</option><option value="false">off</option></select>
        <Button size="sm" variant="outline" disabled={!tenant || why.trim().length < 10} onClick={() => call({ ...base, step: 'override', tenantId: tenant, on: on === 'true' }, 'Override saved', set)}>Set override</Button>
      </div>
    </div>
  );
}

export default function PlatformPage() {
  const s = useLoad(() => platformAdmin({ action: 'get' }) as Promise<D>);
  const [nf, setNf] = useState({ key: '', text: '' });
  const [mw, setMw] = useState({ tenantId: '', title: '', impact: '', startsAt: '', endsAt: '' });
  return (
    <div className="space-y-4">
      <Header eyebrow="Operations" title="Platform" sub="Tenant fleet, entitlements and quotas, feature flags and maintenance. Configuration only — no student records are loaded here." />
      <Loadable state={s}>{(d) => { const set = (_x: D) => s.reload(); return (<>
        <Panel title="Tenant fleet">{d.fleet.length === 0 ? <p className="text-sm text-muted-foreground">No institutions yet.</p> : d.fleet.map((t) => (
          <div key={t.id} className="border-b py-3 last:border-0"><p className="text-sm font-medium">{t.name} {t.inMaintenance && <Chip value="in maintenance" />}</p>
            {t.overrides.length > 0 && <p className="text-xs text-muted-foreground">Flag overrides: {t.overrides.map((o) => `${o.key}=${o.on ? 'on' : 'off'}`).join(', ')}</p>}
            {t.modules.map((m) => <EntRow key={m.module} t={t} m={m} set={set} />)}</div>))}</Panel>
        <Panel title="Feature flags">
          {d.flags.length === 0 ? <p className="text-sm text-muted-foreground">No flags defined.</p> : d.flags.map((f) => <FlagCard key={f.key} f={f} d={d} set={set} />)}
          <div className="mt-3 flex flex-wrap gap-2"><Input aria-label="New flag key" className="h-8 w-56" placeholder="key, e.g. grading.new_editor" value={nf.key} onChange={(e) => setNf({ ...nf, key: e.target.value })} />
            <Input aria-label="New flag description" className="h-8 flex-1" placeholder="What it changes" value={nf.text} onChange={(e) => setNf({ ...nf, text: e.target.value })} />
            <Button size="sm" onClick={async () => { if (await call({ action: 'flag', step: 'define', key: nf.key, expectedVersion: null, on: null, tenantId: null, text: nf.text }, 'Flag defined (default off)', set)) setNf({ key: '', text: '' }); }}>Define flag</Button></div>
        </Panel>
        <Panel title="Maintenance windows">
          {d.maintenance.map((m) => <p key={m.id} className="border-b py-1 text-sm">{m.title} · {m.scope} · {fmt(m.startsAt)} – {fmt(m.endsAt)} · {m.impact} <Button size="sm" variant="link" onClick={() => call({ action: 'maintenance', step: 'cancel', id: m.id, tenantId: null, title: null, impact: null, startsAt: null, endsAt: null }, 'Window cancelled', set)}>Cancel</Button></p>)}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select aria-label="Maintenance scope" className="h-8 rounded-md border bg-background px-2 text-sm" value={mw.tenantId} onChange={(e) => setMw({ ...mw, tenantId: e.target.value })}><option value="">All institutions</option>{d.fleet.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <Input aria-label="Maintenance title" className="h-8" placeholder="Title" value={mw.title} onChange={(e) => setMw({ ...mw, title: e.target.value })} />
            <Input aria-label="What people will notice" className="h-8 sm:col-span-2" placeholder="What people will notice" value={mw.impact} onChange={(e) => setMw({ ...mw, impact: e.target.value })} />
            <Input aria-label="Starts" type="datetime-local" className="h-8" value={mw.startsAt} onChange={(e) => setMw({ ...mw, startsAt: e.target.value })} />
            <Input aria-label="Ends" type="datetime-local" className="h-8" value={mw.endsAt} onChange={(e) => setMw({ ...mw, endsAt: e.target.value })} />
          </div>
          <Button size="sm" className="mt-2" disabled={!mw.startsAt || !mw.endsAt} onClick={() => call({ action: 'maintenance', step: 'schedule', id: null, tenantId: mw.tenantId || null, title: mw.title, impact: mw.impact, startsAt: new Date(mw.startsAt).toISOString(), endsAt: new Date(mw.endsAt).toISOString() }, 'Window scheduled; shown in-app only', set)}>Schedule window</Button>
          <p className="mt-1 text-xs text-muted-foreground">At least an hour ahead, at most 8 hours long. Shown on each institution's control plane; nothing is emailed.</p>
        </Panel>
        <Panel title="Recent changes">{d.events.map((e, i) => <p key={i} className="border-b py-1 text-xs last:border-0">{fmt(e.at)} · {e.mine ? 'you' : 'platform admin'} · {e.institution} · {e.area} {e.action} {e.target}{e.detail ? ` — ${e.detail}` : ''}</p>)}</Panel>
      </>); }}</Loadable>
    </div>
  );
}
