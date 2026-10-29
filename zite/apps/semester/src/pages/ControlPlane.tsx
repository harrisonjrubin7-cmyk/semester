import { useState } from 'react';
import { toast } from 'sonner';
import { controlPlane } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Unit = { id: number; name: string; kind: string; parentId: number | null; rev: number };
type Dept = { id: number; name: string; active: boolean; unitId: number | null };
type Policy = { id: number; key: string; version: number; title: string; body: string; hash: string; state: string; mine: boolean; author: string | null; approver: string | null; approvedAt: string | null; rev: number };
type Setting = { key: string; value: unknown; version: number; updatedAt: string | null };
type Mod = { module: string; entitled: boolean; seatLimit: number | null; apiCallsDay: number | null; stage: string; pilotRoles: string[]; pilotBy: string | null; pilotMine: boolean; pilotAt: string | null; rev: number };
type Data = { roles: readonly string[]; units: Unit[]; departments: Dept[]; policies: Policy[]; settings: Setting[]; moduleState: Mod[]; maintenance: { id: number; title: string; impact: string; startsAt: string | null; endsAt: string | null }[];
  events: { who: string | null; area: string; action: string; target: string; detail: string; at: string | null }[] };

const run = async (input: Record<string, unknown>, ok: string, reload: () => void) => { try { await controlPlane(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
const label = (s: string) => s.replace(/_/g, ' ');
const SETTING_HELP: Record<string, string> = { timezone: 'IANA name, e.g. America/Chicago', week_start: 'monday or sunday', grade_scale: 'letter, percent or pass_fail', late_grace_days: 'whole number 0–14', default_locale: 'e.g. en or en-US' };

function Structure({ d, reload }: { d: Data; reload: () => void }) {
  const [name, setName] = useState(''); const [kind, setKind] = useState('college'); const [parent, setParent] = useState('');
  const tree = (pid: number | null, depth: number): React.ReactNode => d.units.filter((u) => u.parentId === pid).map((u) => (
    <div key={u.id} style={{ paddingLeft: `${depth * 1.25}rem` }} className="border-b border-border py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><p><span className="font-medium">{u.name}</span> <span className="text-xs text-muted-foreground">{u.kind}</span></p>
        <Button size="sm" variant="ghost" onClick={() => run({ action: 'unit', step: 'archive', id: u.id, expectedVersion: u.rev }, 'Archived', reload)}>Archive</Button></div>
      <p className="text-xs text-muted-foreground">Departments: {d.departments.filter((x) => x.unitId === u.id).map((x) => x.name).join(', ') || 'none'}</p>
      {tree(u.id, depth + 1)}
    </div>));
  const unassigned = d.departments.filter((x) => x.active && x.unitId == null);
  return (
    <Panel title="Structure">
      {d.units.length === 0 ? <Empty>No colleges or schools yet.</Empty> : tree(null, 0)}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div><Label htmlFor="u-name">New unit</Label><Input id="u-name" className="h-8 w-56" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="u-kind">Kind</Label><select id="u-kind" className="h-8 rounded-md border bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}><option>college</option><option>school</option><option>division</option></select></div>
        <div><Label htmlFor="u-parent">Inside</Label><select id="u-parent" className="h-8 rounded-md border bg-background px-2 text-sm" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">(top level)</option>{d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <Button size="sm" disabled={name.trim().length < 2} onClick={async () => { if (await run({ action: 'unit', step: 'create', id: null, expectedVersion: null, name, kind, parentId: parent ? Number(parent) : null }, 'Unit added', reload)) setName(''); }}>Add unit</Button>
      </div>
      {unassigned.length > 0 && d.units.length > 0 && <div className="mt-3 space-y-1"><p className="text-sm font-medium">Departments without a unit</p>
        {unassigned.map((x) => <div key={x.id} className="flex items-center gap-2 text-sm"><span className="w-48">{x.name}</span>
          <select aria-label={`Unit for ${x.name}`} className="h-8 rounded-md border bg-background px-2 text-sm" defaultValue="" onChange={(e) => e.target.value && run({ action: 'unit', step: 'assign_dept', id: Number(e.target.value), expectedVersion: null, deptId: x.id }, 'Department assigned', reload)}>
            <option value="">Assign to…</option>{d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>)}</div>}
    </Panel>
  );
}

function Policies({ d, reload }: { d: Data; reload: () => void }) {
  const [f, setF] = useState({ key: '', title: '', body: '' });
  return (
    <Panel title="Policies">
      {d.policies.length === 0 ? <Empty>No policies yet.</Empty> : d.policies.map((p) => (
        <div key={p.id} className="border-b border-border py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{p.title} <span className="text-xs text-muted-foreground">{p.key} v{p.version}</span></p><Status value={p.state} /></div>
          <p className="whitespace-pre-wrap text-sm">{p.body}</p>
          <p className="text-xs text-muted-foreground">by {p.mine ? 'you' : p.author}{p.approver ? ` · approved by ${p.approver} ${fmt(p.approvedAt)}` : ''}</p>
          {p.state === 'draft' && (p.mine ? <p className="text-xs text-muted-foreground">Another administrator approves this version.</p> :
            <Button size="sm" className="mt-1" onClick={() => run({ action: 'policy', step: 'approve', id: p.id, expectedVersion: p.rev, seenHash: p.hash }, 'Policy approved', reload)}>Approve this version</Button>)}
          {p.state === 'approved' && <Button size="sm" variant="ghost" onClick={() => setF({ key: p.key, title: p.title, body: p.body })}>Start a new version</Button>}
        </div>))}
      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2"><Input aria-label="Policy key" className="h-8 w-56" placeholder="key, e.g. academic_integrity" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
          <Input aria-label="Policy title" className="h-8 flex-1" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <Textarea aria-label="Policy text" rows={4} placeholder="Full policy text" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <Button size="sm" className="w-fit" disabled={f.body.trim().length < 40} onClick={async () => { if (await run({ action: 'policy', step: 'draft', id: null, expectedVersion: null, ...f }, 'Draft saved; another administrator approves it', reload)) setF({ key: '', title: '', body: '' }); }}>Save draft</Button>
      </div>
    </Panel>
  );
}

function SettingRow({ s, reload }: { s: Setting; reload: () => void }) {
  const [v, setV] = useState(s.value == null ? '' : String(s.value)); const [why, setWhy] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm last:border-0">
      <span className="w-36 font-medium">{label(s.key)}</span>
      <Input aria-label={label(s.key)} className="h-8 w-48" placeholder={SETTING_HELP[s.key]} value={v} onChange={(e) => setV(e.target.value)} />
      <Input aria-label={`Reason for ${label(s.key)}`} className="h-8 w-56" placeholder="Why (10+ characters)" value={why} onChange={(e) => setWhy(e.target.value)} />
      <Button size="sm" disabled={why.trim().length < 10} onClick={() => run({ action: 'set', key: s.key, value: s.key === 'late_grace_days' ? Number(v) : v, expectedVersion: s.version, reason: why }, 'Saved', reload)}>Save</Button>
      <span className="text-xs text-muted-foreground">{s.updatedAt ? `changed ${fmt(s.updatedAt)}` : 'default'}</span>
    </div>
  );
}

function ModuleRow({ m, d, reload }: { m: Mod; d: Data; reload: () => void }) {
  const [roles, setRoles] = useState<string[]>(m.pilotRoles); const [why, setWhy] = useState('');
  const go = (stage: string) => run({ action: 'roll', module: m.module, stage, roles, expectedVersion: m.rev, reason: why }, stage === 'off' ? 'Turned off' : stage === 'pilot' ? 'Pilot started' : 'On for everyone', reload);
  return (
    <div className="border-b border-border py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{label(m.module)}</p>
        <span className="text-xs">{m.entitled ? `Entitled${m.seatLimit ? ` · ${m.seatLimit} seats` : ''}${m.apiCallsDay ? ` · ${m.apiCallsDay} API calls/day` : ''}` : 'Not in your plan'} · <Status value={m.stage} /></span></div>
      {m.stage === 'pilot' && <p className="text-xs text-muted-foreground">Pilot for {m.pilotRoles.join(', ')} since {fmt(m.pilotAt)} by {m.pilotMine ? 'you' : m.pilotBy}{m.pilotMine ? ' — another administrator turns it on for everyone' : ''}</p>}
      {m.entitled && <div className="mt-1 flex flex-wrap items-center gap-2">
        {m.stage !== 'all' && <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Pilot roles</legend>{d.roles.map((r) => <label key={r} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />{r}</label>)}</fieldset>}
        <Input aria-label={`Reason for ${label(m.module)}`} className="h-8 w-56" placeholder="Why (10+ characters)" value={why} onChange={(e) => setWhy(e.target.value)} />
        {m.stage !== 'all' && <Button size="sm" variant="outline" disabled={why.trim().length < 10 || roles.length === 0} onClick={() => go('pilot')}>{m.stage === 'pilot' ? 'Update pilot' : 'Start pilot'}</Button>}
        {m.stage === 'pilot' && <Button size="sm" disabled={why.trim().length < 10 || m.pilotMine} onClick={() => go('all')}>Turn on for everyone</Button>}
        {m.stage !== 'off' && <Button size="sm" variant="ghost" disabled={why.trim().length < 10} onClick={() => go('off')}>Turn off</Button>}
      </div>}
    </div>
  );
}

export default function ControlPlane() {
  const s = useLoad(() => controlPlane({ action: 'get' }) as Promise<Data>);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Institution console" title="Control plane" sub="Structure, policies, configuration and which modules are on. Entitlements come from your Semester agreement; changes here are recorded." />
      <Loadable state={s}>{(d: Data) => (<>
        {d.maintenance.length > 0 && <Panel title="Scheduled maintenance">{d.maintenance.map((m) => <p key={m.id} className="text-sm"><span className="font-medium">{m.title}</span> · {fmt(m.startsAt)} – {fmt(m.endsAt)} · {m.impact}</p>)}<p className="mt-1 text-xs text-muted-foreground">Rollout changes are paused while a window is in progress.</p></Panel>}
        <Structure d={d} reload={s.reload} />
        <Policies d={d} reload={s.reload} />
        <Panel title="Configuration">{d.settings.map((x) => <SettingRow key={x.key} s={x} reload={s.reload} />)}</Panel>
        <Panel title="Entitlements and rollout">{d.moduleState.map((m) => <ModuleRow key={m.module} m={m} d={d} reload={s.reload} />)}</Panel>
        <Panel title="Recent changes">{d.events.length === 0 ? <Empty>No changes yet.</Empty> : d.events.map((e, i) => <p key={i} className="border-b border-border py-1 text-xs last:border-0">{fmt(e.at)} · {e.who} · {e.area} {e.action} {e.target}{e.detail ? ` — ${e.detail}` : ''}</p>)}</Panel>
      </>)}</Loadable>
    </div>
  );
}
