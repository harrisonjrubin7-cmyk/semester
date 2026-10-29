import { useState } from 'react';
import { toast } from 'sonner';
import { budgetPlans } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { money } from '../lib/procureRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const cents = (s: string) => Math.round(Number(s || 0) * 100);
const dollars = (n: number) => String(n / 100);

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function LineEditor({ plan, d, reload }: { plan: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [l, setL] = useState({ code: '', label: '', q1: '', q2: '', q3: '', q4: '' });
  const editable = d.isPlanner && plan.state === 'draft';
  return (
    <div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="eyebrow border-b text-left [&>th]:px-2 [&>th]:py-1.5"><th>Code</th><th>Line</th><th className="text-right">Q1</th><th className="text-right">Q2</th><th className="text-right">Q3</th><th className="text-right">Q4</th><th className="text-right">Year</th>{plan.state === 'approved' && <><th className="text-right">Committed</th><th className="text-right">Remaining</th></>}{editable && <th />}</tr></thead>
        <tbody>{plan.lines.map((x: any) => (
          <tr key={x.code} className="border-b last:border-0 [&>td]:px-2 [&>td]:py-1.5">
            <td className="font-mono text-xs">{x.code}</td><td>{x.label}</td>
            <td className="text-right tabular-nums">{money(x.q1)}</td><td className="text-right tabular-nums">{money(x.q2)}</td><td className="text-right tabular-nums">{money(x.q3)}</td><td className="text-right tabular-nums">{money(x.q4)}</td>
            <td className="text-right font-medium tabular-nums">{money(x.total)}</td>
            {plan.state === 'approved' && <><td className="text-right tabular-nums">{money(x.committed ?? 0)}</td><td className="text-right tabular-nums">{money(x.total - (x.committed ?? 0))}</td></>}
            {editable && <td className="text-right"><Button size="sm" variant="outline" onClick={() => act(() => budgetPlans({ action: 'removeLine', planId: plan.id, code: x.code }), 'Line removed.')}>Remove</Button></td>}
          </tr>))}
          <tr className="[&>td]:px-2 [&>td]:py-1.5 font-medium"><td colSpan={6}>Total</td><td className="text-right tabular-nums">{money(plan.lines.reduce((s: number, x: any) => s + x.total, 0))}</td>{plan.state === 'approved' && <><td className="text-right tabular-nums">{money(plan.lines.reduce((s: number, x: any) => s + (x.committed ?? 0), 0))}</td><td /></>}</tr>
        </tbody></table></div>
      {editable && <div className="mt-3 grid gap-2 sm:grid-cols-7">
        <Input aria-label="Budget code" placeholder="Code (OPS)" value={l.code} onChange={(e) => setL({ ...l, code: e.target.value.toUpperCase() })} />
        <Input aria-label="Line label" placeholder="What it covers" value={l.label} onChange={(e) => setL({ ...l, label: e.target.value })} />
        {(['q1', 'q2', 'q3', 'q4'] as const).map((q, i) => <Input key={q} aria-label={`Quarter ${i + 1} dollars`} type="number" min={0} step={0.01} placeholder={`Q${i + 1} ($)`} value={l[q]} onChange={(e) => setL({ ...l, [q]: e.target.value })} />)}
        <Button size="sm" disabled={l.code.trim().length < 2 || l.label.trim().length < 2} onClick={async () => { if (await act(() => budgetPlans({ action: 'setLine', planId: plan.id, code: l.code, label: l.label, q1: cents(l.q1), q2: cents(l.q2), q3: cents(l.q3), q4: cents(l.q4) }), 'Line saved.')) setL({ code: '', label: '', q1: '', q2: '', q3: '', q4: '' }); }}>Save line</Button>
      </div>}
      {editable && d.budgetCodes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Procurement budget codes: {d.budgetCodes.map((c: any) => `${c.code} (${c.name})`).join(' · ')}</p>}
      {plan.state === 'approved' && <p className="mt-2 text-xs text-muted-foreground">Committed is what Procurement has committed or spent against each code to date, across all years — plans are adopted per year, commitments are recorded as they happen.</p>}
    </div>
  );
}

export default function BudgetPlanning() {
  const s = useLoad(() => budgetPlans({ action: 'get' }));
  const act = useAct(s.reload);
  const [fy, setFy] = useState('');
  const [np, setNp] = useState({ year: '2027', name: '' });
  const [note, setNote] = useState('');
  const [st, setSt] = useState({ email: '', role: 'planner' });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Budget planning" sub="Fiscal-year plans by quarter and budget code. A planner writes the plan; a different approver adopts it. Plans move no money — spending is committed in Procurement." />
      <Loadable state={s}>{(d: any) => {
        const years = [...new Set(d.plans.map((p: any) => p.fy))] as number[];
        const year = fy ? Number(fy) : (years[0] ?? new Date().getFullYear());
        const ofYear = d.plans.filter((p: any) => p.fy === year);
        const current = ofYear.find((p: any) => p.state === 'approved') ?? ofYear.find((p: any) => p.state === 'proposed') ?? ofYear.find((p: any) => p.state === 'draft') ?? ofYear[0];
        const open = ofYear.some((p: any) => ['draft', 'proposed'].includes(p.state));
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Fiscal year</span>
              <select aria-label="Fiscal year" className={sel} value={year} onChange={(e) => setFy(e.target.value)}>
                {[...new Set([...years, year])].sort((a: number, b: number) => b - a).map((y: number) => <option key={y} value={y}>{y}</option>)}
              </select>
              {ofYear.map((p: any) => <span key={p.id} className="text-xs text-muted-foreground">v{p.version} · {p.state}</span>)}
            </div>
            {d.isPlanner && !open && <Panel title={`New plan for ${np.year}`}>
              <div className="flex flex-wrap gap-2">
                <Input aria-label="Plan year" type="number" className="w-24" value={np.year} onChange={(e) => setNp({ ...np, year: e.target.value })} />
                <Input aria-label="Plan name" placeholder="Plan name (e.g. FY27 operating plan)" className="max-w-sm" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
                <Button size="sm" disabled={np.name.trim().length < 3 || !np.year} onClick={async () => { if (await act(() => budgetPlans({ action: 'create', fy: Number(np.year), name: np.name }), 'Plan started as a draft.')) { setFy(np.year); setNp({ year: np.year, name: '' }); } }}>Start draft</Button>
              </div>
            </Panel>}
            {current ? <Panel title={`${current.name} · FY${current.fy} · version ${current.version}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Status value={current.state} />
                <span>by {current.createdBy}</span>
                {current.approvedBy && <span>· approved by {current.approvedBy}</span>}
                {current.decisionNote && <span>· “{current.decisionNote}”</span>}
                {current.state === 'draft' && d.isPlanner && <Button size="sm" className="ml-auto" disabled={!current.lines.length} onClick={() => act(() => budgetPlans({ action: 'propose', planId: current.id }), 'Plan proposed for approval.')}>Propose for approval</Button>}
              </div>
              <LineEditor plan={current} d={d} reload={s.reload} />
              {current.state === 'proposed' && d.isApprover && (current.createdByMe
                ? <p className="mt-3 text-xs text-muted-foreground">You wrote this plan, so another approver must decide it.</p>
                : <div className="mt-3 flex flex-wrap gap-2">
                    <Input aria-label="Decision note" placeholder="Decision note (required to send back)" className="max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} />
                    <Button size="sm" onClick={() => act(() => budgetPlans({ action: 'decide', planId: current.id, approve: true, note }), 'Plan approved and in force.')}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => act(() => budgetPlans({ action: 'decide', planId: current.id, approve: false, note }), 'Plan sent back to draft.')}>Send back</Button>
                  </div>)}
              {current.state === 'proposed' && !d.isApprover && <p className="mt-3 text-xs text-muted-foreground">Waiting for a budget approver who did not write this plan.</p>}
            </Panel> : <Empty>No budget plan for {year} yet.</Empty>}
            {d.isAdmin && <Panel title="Planning roles">
              <p className="text-xs">{d.staff.map((m: any) => `${m.name} (${m.role})`).join(', ') || 'No planners or approvers yet.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input aria-label="Staff email" placeholder="Email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
                <select aria-label="Role" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}><option value="planner">Planner</option><option value="approver">Approver</option></select>
                <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={async () => { if (await act(() => budgetPlans({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Role granted.')) setSt({ email: '', role: 'planner' }); }}>Grant</Button>
                <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => budgetPlans({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Role removed.')}>Remove</Button>
              </div>
            </Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
