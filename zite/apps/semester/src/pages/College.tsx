import { useState } from 'react';
import { toast } from 'sonner';
import { deans } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Goal = { goal: string; measure: string };
type Plan = { id: number; level: string; deptId: number | null; unitId: number | null; scope: string; year: string; title: string; goals: Goal[]; hash: string; state: string; mine: boolean; author: string | null; decider: string | null; note: string; rev: number; canDecide: boolean };
type Req = { id: number; deptId: number; dept: string; year: string; kind: string; amountMinor: number; justification: string; state: string; mine: boolean; requester: string | null; decider: string | null; note: string; rev: number; canDecide: boolean };
type Esc = { id: number; dept: string; category: string; detail: string; state: string; raisedBy: string | null; handledBy: string | null; note: string; createdAt: string | null; overdue: boolean; canHandle: boolean };
type Motion = { id: number; unit: string; title: string; body: string; electorate: number; votes: number; myVote: string | null; canVote: boolean; isDean: boolean; closesAt: string | null; state: string; outcome: string };
type Data = { isAdmin: boolean; deanUnits: { id: number; name: string }[]; chairOf: { id: number; name: string }[];
  health: { deptId: number; dept: string; sectionsWaiting: number; openNeeds: number; formsWaiting: number; escalationsOpen: number; escalationsOverdue: number; requestsWaiting: number; planState: string | null; planYear: string | null }[];
  plans: Plan[]; requests: Req[]; escalations: Esc[]; allocations: { unitId: number; unit: string; year: string; amountMinor: number; usedMinor: number }[]; motions: Motion[]; units: { id: number; name: string; deans: string[] }[] };

const run = async (input: Record<string, unknown>, ok: string, reload: () => void) => { try { await deans(input as never); toast.success(ok); reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
const money = (minor: number) => (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisYear = () => { const d = new Date(); const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
const sel = 'h-8 rounded-md border bg-background px-2 text-sm';

function Health({ d }: { d: Data }) {
  if (!d.deanUnits.length) return null;
  return (
    <Panel title="Department health">
      {d.health.length === 0 ? <Empty>No departments are assigned to your college yet. An administrator assigns them in the control plane.</Empty> : (
        <table className="w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-1">Department</th><th>Section requests</th><th>Open staffing needs</th><th>Form responses</th><th>Escalations</th><th>Resource requests</th><th>Latest plan</th></tr></thead>
          <tbody>{d.health.map((h) => <tr key={h.deptId} className="border-t">
            <td className="py-1 font-medium">{h.escalationsOverdue > 0 ? '▲ ' : ''}{h.dept}</td><td>{h.sectionsWaiting}</td><td>{h.openNeeds}</td><td>{h.formsWaiting}</td>
            <td>{h.escalationsOpen}{h.escalationsOverdue ? ` (${h.escalationsOverdue} waiting over 5 days)` : ''}</td><td>{h.requestsWaiting}</td><td>{h.planState ? `${h.planYear} · ${h.planState}` : 'none'}</td></tr>)}</tbody></table>)}
      <p className="mt-1 text-xs text-muted-foreground">Counts of work waiting, from the department's own records. ▲ marks an escalation unanswered for more than five days.</p>
    </Panel>
  );
}

function GoalsEditor({ goals, set }: { goals: Goal[]; set: (g: Goal[]) => void }) {
  return (<div className="space-y-1">{goals.map((g, i) => <div key={i} className="flex gap-2">
    <Input aria-label={`Goal ${i + 1}`} className="h-8 flex-1" placeholder="Goal" value={g.goal} onChange={(e) => set(goals.map((x, j) => (j === i ? { ...x, goal: e.target.value } : x)))} />
    <Input aria-label={`Measure for goal ${i + 1}`} className="h-8 w-56" placeholder="How it is measured" value={g.measure} onChange={(e) => set(goals.map((x, j) => (j === i ? { ...x, measure: e.target.value } : x)))} />
    <Button size="sm" variant="ghost" aria-label={`Remove goal ${i + 1}`} onClick={() => set(goals.filter((_, j) => j !== i))}>×</Button></div>)}
    {goals.length < 12 && <Button size="sm" variant="outline" onClick={() => set([...goals, { goal: '', measure: '' }])}>Add goal</Button>}</div>);
}

function PlanCard({ p, reload }: { p: Plan; reload: () => void }) {
  const [note, setNote] = useState(''); const [title, setTitle] = useState(p.title); const [goals, setGoals] = useState(p.goals);
  const editable = p.mine && (p.state === 'draft' || p.state === 'returned');
  return (
    <div className="border-b border-border py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{p.title} <span className="text-xs text-muted-foreground">{p.scope} · {p.year} · {p.level}</span></p><Status value={p.state} /></div>
      {editable ? <div className="mt-1 space-y-2"><Input aria-label="Plan title" className="h-8" value={title} onChange={(e) => setTitle(e.target.value)} /><GoalsEditor goals={goals} set={setGoals} />
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => run({ action: 'plan', step: 'edit', id: p.id, expectedVersion: p.rev, title, goals }, 'Saved', reload)}>Save</Button>
          <Button size="sm" onClick={() => run({ action: 'plan', step: 'submit', id: p.id, expectedVersion: p.rev }, p.level === 'college' ? 'Sent to an administrator' : 'Sent to your dean', reload)}>Submit</Button></div></div>
        : <ul className="ml-4 list-disc">{p.goals.map((g, i) => <li key={i}>{g.goal} <span className="text-xs text-muted-foreground">— {g.measure}</span></li>)}</ul>}
      <p className="text-xs text-muted-foreground">by {p.mine ? 'you' : p.author}{p.decider ? ` · decided by ${p.decider}` : ''}{p.note ? ` · “${p.note}”` : ''}</p>
      {p.canDecide && <div className="mt-1 flex flex-wrap items-center gap-2"><Input aria-label="Note" className="h-8 w-72" placeholder="Note (needed to return)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={() => run({ action: 'plan', step: 'approve', id: p.id, expectedVersion: p.rev, seenHash: p.hash, note }, 'Plan approved', reload)}>Approve this plan</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => run({ action: 'plan', step: 'return', id: p.id, expectedVersion: p.rev, seenHash: p.hash, note }, 'Returned', reload)}>Return</Button></div>}
    </div>
  );
}

function Plans({ d, reload }: { d: Data; reload: () => void }) {
  const scopes = [...d.chairOf.map((x) => ({ key: `d${x.id}`, label: `${x.name} (department)`, level: 'department', deptId: x.id })), ...d.deanUnits.map((u) => ({ key: `u${u.id}`, label: `${u.name} (college)`, level: 'college', unitId: u.id }))];
  const [scope, setScope] = useState(scopes[0]?.key ?? ''); const [year, setYear] = useState(thisYear()); const [title, setTitle] = useState(''); const [goals, setGoals] = useState<Goal[]>([{ goal: '', measure: '' }]);
  const s = scopes.find((x) => x.key === scope);
  return (
    <Panel title="Plans">
      {d.plans.length === 0 ? <Empty>No plans yet.</Empty> : d.plans.map((p) => <PlanCard key={`${p.id}-${p.rev}`} p={p} reload={reload} />)}
      {s && <div className="mt-3 space-y-2"><div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="pl-scope">New plan for</Label><select id="pl-scope" className={sel} value={scope} onChange={(e) => setScope(e.target.value)}>{scopes.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
        <div><Label htmlFor="pl-year">Year</Label><Input id="pl-year" className="h-8 w-24" value={year} onChange={(e) => setYear(e.target.value)} /></div>
        <div className="flex-1"><Label htmlFor="pl-title">Title</Label><Input id="pl-title" className="h-8" value={title} onChange={(e) => setTitle(e.target.value)} /></div></div>
        <GoalsEditor goals={goals} set={setGoals} />
        <Button size="sm" onClick={async () => { if (await run({ action: 'plan', step: 'draft', id: null, expectedVersion: null, level: s.level, deptId: 'deptId' in s ? s.deptId : undefined, unitId: 'unitId' in s ? s.unitId : undefined, year, title, goals }, 'Draft saved', reload)) { setTitle(''); setGoals([{ goal: '', measure: '' }]); } }}>Save draft</Button></div>}
    </Panel>
  );
}

function Resources({ d, reload }: { d: Data; reload: () => void }) {
  const [f, setF] = useState({ deptId: d.chairOf[0]?.id ?? 0, year: thisYear(), kind: 'position', amount: '', text: '' });
  const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <Panel title="Resources">
      {d.allocations.length > 0 && <div className="mb-2 text-sm">{d.allocations.map((x) => <p key={`${x.unitId}${x.year}`}>{x.unit} {x.year}: {money(x.usedMinor)} approved of {money(x.amountMinor)} ({money(x.amountMinor - x.usedMinor)} left)</p>)}
        <p className="text-xs text-muted-foreground">Planning figures. Approving a request records the decision; no money moves.</p></div>}
      {d.requests.length === 0 ? <Empty>No resource requests.</Empty> : d.requests.map((r) => (
        <div key={r.id} className="border-b border-border py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{r.dept} · {r.kind} · {money(r.amountMinor)} <span className="text-xs text-muted-foreground">{r.year}</span></p><Status value={r.state} /></div>
          <p>{r.justification}</p><p className="text-xs text-muted-foreground">by {r.mine ? 'you' : r.requester}{r.decider ? ` · decided by ${r.decider}` : ''}{r.note ? ` · “${r.note}”` : ''}</p>
          {r.canDecide && <div className="mt-1 flex flex-wrap items-center gap-2"><Input aria-label="Decision note" className="h-8 w-72" placeholder="Note (needed to decline or return)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <Button size="sm" onClick={() => run({ action: 'request', step: 'approve', id: r.id, expectedVersion: r.rev, text: notes[r.id] ?? '' }, 'Approved against the allocation', reload)}>Approve</Button>
            {(['decline', 'return'] as const).map((st) => <Button key={st} size="sm" variant="outline" disabled={(notes[r.id] ?? '').trim().length < 10} onClick={() => run({ action: 'request', step: st, id: r.id, expectedVersion: r.rev, text: notes[r.id] }, st === 'decline' ? 'Declined' : 'Returned', reload)}>{st === 'decline' ? 'Decline' : 'Return'}</Button>)}</div>}
          {r.mine && r.state === 'submitted' && <Button size="sm" variant="ghost" onClick={() => run({ action: 'request', step: 'withdraw', id: r.id, expectedVersion: r.rev }, 'Withdrawn', reload)}>Withdraw</Button>}
        </div>))}
      {d.chairOf.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <select aria-label="Department" className={sel} value={f.deptId} onChange={(e) => setF({ ...f, deptId: Number(e.target.value) })}>{d.chairOf.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Kind" className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['position', 'budget', 'space', 'equipment'].map((k) => <option key={k}>{k}</option>)}</select>
        <Input aria-label="Year" className="h-8" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
        <Input aria-label="Estimated cost" className="h-8" inputMode="decimal" placeholder="Estimated cost" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Textarea aria-label="Justification" className="sm:col-span-4" rows={2} placeholder="Why the department needs it (30+ characters)" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <Button size="sm" className="w-fit" disabled={f.text.trim().length < 30} onClick={async () => { if (await run({ action: 'request', step: 'submit', id: null, expectedVersion: null, deptId: f.deptId, year: f.year, kind: f.kind, amountMinor: Math.round(Number(f.amount || 0) * 100), text: f.text }, 'Sent to your dean', reload)) setF({ ...f, amount: '', text: '' }); }}>Request</Button></div>}
    </Panel>
  );
}

function Escalations({ d, reload }: { d: Data; reload: () => void }) {
  const [f, setF] = useState({ deptId: d.chairOf[0]?.id ?? 0, category: 'staffing', text: '' }); const [notes, setNotes] = useState<Record<number, string>>({});
  return (
    <Panel title="Escalations">
      {d.escalations.length === 0 ? <Empty>No escalations.</Empty> : d.escalations.map((e) => (
        <div key={e.id} className="border-b border-border py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{e.overdue ? '▲ ' : ''}{e.dept} · {e.category}</p><Status value={e.state} /></div>
          <p>{e.detail}</p><p className="text-xs text-muted-foreground">raised by {e.raisedBy} {fmt(e.createdAt)}{e.overdue ? ' · unanswered over 5 days' : ''}{e.handledBy ? ` · handled by ${e.handledBy}` : ''}{e.note ? ` · “${e.note}”` : ''}</p>
          {e.canHandle && e.state !== 'resolved' && <div className="mt-1 flex flex-wrap items-center gap-2">
            {e.state === 'open' && <Button size="sm" variant="outline" onClick={() => run({ action: 'escalate', step: 'acknowledge', id: e.id }, 'Acknowledged', reload)}>Acknowledge</Button>}
            <Input aria-label="Resolution" className="h-8 w-72" placeholder="How it was resolved" value={notes[e.id] ?? ''} onChange={(x) => setNotes({ ...notes, [e.id]: x.target.value })} />
            <Button size="sm" disabled={(notes[e.id] ?? '').trim().length < 10} onClick={() => run({ action: 'escalate', step: 'resolve', id: e.id, text: notes[e.id] }, 'Resolved', reload)}>Resolve</Button></div>}
        </div>))}
      {d.chairOf.length > 0 && <div className="mt-3 flex flex-wrap items-start gap-2">
        <select aria-label="Department" className={sel} value={f.deptId} onChange={(e) => setF({ ...f, deptId: Number(e.target.value) })}>{d.chairOf.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Category" className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['staffing', 'curriculum', 'facilities', 'conduct', 'budget', 'other'].map((k) => <option key={k}>{k}</option>)}</select>
        <Textarea aria-label="Issue" className="min-w-64 flex-1" rows={2} placeholder="What the dean needs to know (20+ characters)" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <Button size="sm" disabled={f.text.trim().length < 20} onClick={async () => { if (await run({ action: 'escalate', step: 'raise', id: null, ...f }, 'Escalated to your dean', reload)) setF({ ...f, text: '' }); }}>Escalate</Button></div>}
    </Panel>
  );
}

function Governance({ d, reload }: { d: Data; reload: () => void }) {
  const [f, setF] = useState({ unitId: d.deanUnits[0]?.id ?? 0, title: '', text: '', days: 7 });
  if (!d.deanUnits.length && !d.motions.length) return null;
  return (
    <Panel title="College governance">
      {d.motions.length === 0 ? <Empty>No motions yet.</Empty> : d.motions.map((m) => (
        <div key={m.id} className="border-b border-border py-2 text-sm last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{m.title} <span className="text-xs text-muted-foreground">{m.unit}</span></p><Status value={m.state} /></div>
          <p className="whitespace-pre-wrap">{m.body}</p>
          <p className="text-xs text-muted-foreground">{m.state === 'open' ? `${m.votes} of ${m.electorate} chairs have voted · closes ${fmt(m.closesAt)}` : m.outcome}{m.myVote ? ` · your vote: ${m.myVote}` : ''}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {m.canVote && (['yes', 'no', 'abstain'] as const).map((v) => <Button key={v} size="sm" variant={m.myVote === v ? 'default' : 'outline'} onClick={() => run({ action: 'motion', step: 'vote', id: m.id, vote: v }, 'Vote recorded', reload)}>{v}</Button>)}
            {m.isDean && m.state === 'open' && <><Button size="sm" variant="outline" onClick={() => run({ action: 'motion', step: 'close', id: m.id }, 'Motion closed', reload)}>Close and count</Button>
              <Button size="sm" variant="ghost" onClick={() => run({ action: 'motion', step: 'withdraw', id: m.id }, 'Withdrawn', reload)}>Withdraw</Button></>}
          </div>
        </div>))}
      {d.deanUnits.length > 0 && <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2"><select aria-label="Unit" className={sel} value={f.unitId} onChange={(e) => setF({ ...f, unitId: Number(e.target.value) })}>{d.deanUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <Input aria-label="Motion title" className="h-8 flex-1" placeholder="Motion title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input aria-label="Days open" type="number" min={1} max={30} className="h-8 w-20" value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} /></div>
        <Textarea aria-label="Motion text" rows={3} placeholder="The full text the chairs vote on" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <Button size="sm" className="w-fit" onClick={async () => { if (await run({ action: 'motion', step: 'open', id: null, ...f }, 'Motion opened to the chairs', reload)) setF({ ...f, title: '', text: '' }); }}>Open motion</Button>
        <p className="text-xs text-muted-foreground">The chairs of every department in the unit vote. It carries with at least half voting and more yes than no.</p></div>}
    </Panel>
  );
}

function Admin({ d, reload }: { d: Data; reload: () => void }) {
  const [unit, setUnit] = useState(d.units[0]?.id ?? 0); const [email, setEmail] = useState(''); const [al, setAl] = useState({ year: thisYear(), amount: '', reason: '' });
  if (!d.isAdmin) return null;
  return (
    <Panel title="Administrator: deans and allocations">
      {d.units.length === 0 ? <Empty>Create colleges and schools in the control plane first.</Empty> : <>
        {d.units.map((u) => <p key={u.id} className="text-sm">{u.name}: {u.deans.join(', ') || 'no dean'}</p>)}
        <div className="mt-2 flex flex-wrap items-center gap-2"><select aria-label="Unit" className={sel} value={unit} onChange={(e) => setUnit(Number(e.target.value))}>{d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <Input aria-label="Dean's email" className="h-8 w-64" placeholder="Member's email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="sm" onClick={() => run({ action: 'setDean', unitId: unit, email, on: true }, 'Dean appointed', reload)}>Appoint dean</Button>
          <Button size="sm" variant="ghost" onClick={() => run({ action: 'setDean', unitId: unit, email, on: false }, 'Dean removed', reload)}>Remove</Button></div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Input aria-label="Allocation year" className="h-8 w-24" value={al.year} onChange={(e) => setAl({ ...al, year: e.target.value })} />
          <Input aria-label="Allocation amount" className="h-8 w-36" inputMode="decimal" placeholder="Allocation" value={al.amount} onChange={(e) => setAl({ ...al, amount: e.target.value })} />
          <Input aria-label="Source of the figure" className="h-8 w-64" placeholder="Source (budget letter…)" value={al.reason} onChange={(e) => setAl({ ...al, reason: e.target.value })} />
          <Button size="sm" disabled={al.reason.trim().length < 10} onClick={() => run({ action: 'allocate', unitId: unit, year: al.year, amountMinor: Math.round(Number(al.amount || 0) * 100), reason: al.reason }, 'Allocation set', reload)}>Set allocation</Button></div></>}
    </Panel>
  );
}

export default function College() {
  const s = useLoad(() => deans({ action: 'get' }) as Promise<Data>);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Academic leadership" title="College and department" sub="Plans, department health, resources, escalations and college governance for deans and department chairs." />
      <Loadable state={s}>{(d: Data) => (<>
        <Health d={d} />
        <Plans d={d} reload={s.reload} />
        <Resources d={d} reload={s.reload} />
        <Escalations d={d} reload={s.reload} />
        <Governance d={d} reload={s.reload} />
        <Admin d={d} reload={s.reload} />
      </>)}</Loadable>
    </div>
  );
}
