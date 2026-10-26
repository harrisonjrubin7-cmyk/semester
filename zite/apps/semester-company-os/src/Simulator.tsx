import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { scenarios } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Chip, Header, Loadable, Panel, errMsg, fmt, useLoad } from './ui';
import { NODES, byId, missingFor, prerequisites, STACK_AREAS, STACK_OPTIONS, ZITE_FIT, FLOW, Node } from './lib/systemMap';
import { estimate, emptyInputs, BOOK1_PLANNING_REVENUE, CostInputs, Money } from './lib/costModel';
import { SCENARIOS, runScenario, QUOTE, SUBSCRIPTION, INVOICE, PAYMENT } from './lib/billingSim';
import { KINDS, Kind, Stack } from './lib/scenario';

const LAYERS: Node['layer'][] = ['Education Experience', 'Institution OS', 'Company OS', 'Shared platform', 'Data & workers', 'External'];
const money = (n: number | null | undefined, c: string) => (n === null || n === undefined ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${c}`);
const download = (name: string, text: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };

function SystemMap() {
  const [sel, setSel] = useState<string>('student');
  const n = byId[sel];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">{LAYERS.map((l) => (
        <Panel key={l} title={l}><div className="flex flex-wrap gap-2">{NODES.filter((x) => x.layer === l).map((x) => (
          <Button key={x.id} size="sm" variant={x.id === sel ? 'default' : 'outline'} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>{x.name}</Button>))}</div></Panel>))}
      </div>
      {n && (
        <Panel title={n.name} className="h-fit lg:sticky lg:top-4">
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
            {[['Purpose', n.purpose], ['Owner', n.owner], ['Data class', n.dataClass], ['Permission', n.permission], ['Deployment', n.deployment]].map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}
            <dt className="text-muted-foreground">Status</dt><dd><Chip value={n.status} /></dd>
            <dt className="text-muted-foreground">Verification</dt><dd>{n.verification}</dd>
            <dt className="text-muted-foreground">Needs</dt><dd>{prerequisites(n.id).map((p) => byId[p]?.name).join(', ') || 'Nothing'}</dd>
          </dl>
        </Panel>
      )}
    </div>
  );
}

function StackConfigurator({ stack, setStack }: { stack: Stack; setStack: (s: Stack) => void }) {
  return (
    <Panel title="Choose an approach for each area">
      <p className="mb-3 text-sm text-muted-foreground">“Zite-native” shows what was verified in this workspace on 22 Oct 2026. Labels are not upgraded without evidence.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Area</th><th>Approach</th><th>Zite today</th></tr></thead>
        <tbody>{STACK_AREAS.map((a) => (
          <tr key={a} className="border-t border-border"><td className="py-2 font-medium">{a}</td>
            <td><Select value={stack[a] ?? 'Not yet selected'} onValueChange={(v) => setStack({ ...stack, [a]: v as (typeof STACK_OPTIONS)[number] })}><SelectTrigger aria-label={`Approach for ${a}`} className="h-8 w-48"><SelectValue /></SelectTrigger><SelectContent>{STACK_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></td>
            <td className="text-xs">{ZITE_FIT[a].verification}<span className="block text-muted-foreground">{ZITE_FIT[a].note}</span>{stack[a] === 'Zite-native' && ZITE_FIT[a].verification === 'Not supported on Zite' && <span className="block font-medium text-destructive">! Not supported on Zite: choose another approach</span>}</td></tr>))}</tbody>
      </table></div>
    </Panel>
  );
}

function ModulePlanner() {
  const modules = NODES.filter((n) => ['Education Experience', 'Institution OS', 'Company OS'].includes(n.layer) || ['billing', 'integrations', 'files', 'sso'].includes(n.id));
  const [on, setOn] = useState<string[]>(['student', 'advisor', 'registrar']);
  const res = missingFor(on);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Modules to enable">
        <div className="grid gap-1.5">{modules.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={on.includes(m.id)} onChange={(e) => setOn(e.target.checked ? [...on, m.id] : on.filter((x) => x !== m.id))} />{m.name} <Chip value={m.status} /></label>))}</div>
      </Panel>
      <Panel title="Missing prerequisites">
        {res.every((r) => !r.missing.length) ? <p className="text-sm">Every prerequisite for the chosen modules exists in this build (they may still be unverified end to end).</p> : (
          <ul className="space-y-2 text-sm">{res.filter((r) => r.missing.length).map((r) => <li key={r.module}><span className="font-medium">{byId[r.module].name}</span> needs: {r.missing.map((x) => `${x.name} (${x.why})`).join('; ')}</li>)}</ul>)}
      </Panel>
    </div>
  );
}

function MoneyField({ id, label, m, onChange }: { id: string; label: string; m: Money; onChange: (m: Money) => void }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-1">
        <Input id={id} inputMode="decimal" className="h-8" placeholder="enter price" value={m.amount ?? ''} onChange={(e) => onChange({ ...m, amount: e.target.value === '' ? null : Number(e.target.value) })} />
        <Input aria-label={`${label} currency`} className="h-8 w-16" value={m.currency} maxLength={3} onChange={(e) => onChange({ ...m, currency: e.target.value.toUpperCase() })} />
        <Select value={m.period ?? 'month'} onValueChange={(v) => onChange({ ...m, period: v as 'month' | 'year' })}><SelectTrigger aria-label={`${label} period`} className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">/ month</SelectItem><SelectItem value="year">/ year</SelectItem></SelectContent></Select>
      </div>
    </div>
  );
}

const NUM: [keyof CostInputs, string][] = [['institutions', 'Institutions'], ['activeStudents', 'Students'], ['staff', 'Staff users'], ['monthlyActiveShare', 'Monthly active share (0–1)'], ['requestsPerActiveUser', 'Requests per active user / month'], ['aiRequestsPerActiveUser', 'AI requests per active user / month'], ['tokensPerAiRequest', 'Tokens per AI request'], ['fileStorageGb', 'File storage (GB)'], ['egressGb', 'Egress (GB / month)'], ['jobsPerMonth', 'Background jobs / month'], ['supportHoursPerMonth', 'Support hours / month'], ['implementationHoursPerInstitution', 'Implementation hours / institution']];
const PRICES: [keyof CostInputs['prices'], string][] = [['platformBase', 'Platform base'], ['perMillionRequests', 'Per million requests'], ['perMillionAiTokens', 'Per million AI tokens'], ['perGbStorage', 'Per GB-month storage'], ['perGbEgress', 'Per GB egress'], ['perThousandJobs', 'Per thousand jobs'], ['supportHourly', 'Support hourly'], ['implementationHourly', 'Implementation hourly']];

function CostModel({ inputs, setInputs }: { inputs: CostInputs; setInputs: (i: CostInputs) => void }) {
  const r = useMemo(() => estimate(inputs), [inputs]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <Panel title="Usage"><div className="grid gap-3 sm:grid-cols-2">{NUM.map(([k, l]) => (
          <div key={k}><Label htmlFor={`n-${k}`} className="text-xs">{l}</Label><Input id={`n-${k}`} inputMode="decimal" className="mt-1 h-8" value={String(inputs[k])} onChange={(e) => setInputs({ ...inputs, [k]: Number(e.target.value) || 0 })} /></div>))}
          <div><Label htmlFor="cur" className="text-xs">Base currency</Label><Input id="cur" className="mt-1 h-8 w-24" maxLength={3} value={inputs.currency} onChange={(e) => setInputs({ ...inputs, currency: e.target.value.toUpperCase() })} /></div>
        </div></Panel>
        <Panel title="Provider prices (yours to enter: none are pre-filled)"><div className="grid gap-3 sm:grid-cols-2">{PRICES.map(([k, l]) => (
          <MoneyField key={k} id={`p-${k}`} label={l} m={inputs.prices[k]} onChange={(m) => setInputs({ ...inputs, prices: { ...inputs.prices, [k]: m } })} />))}</div></Panel>
        <Panel title="Revenue assumptions">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField id="r-ps" label="Per enrolled student" m={inputs.revenue.perStudent} onChange={(m) => setInputs({ ...inputs, revenue: { ...inputs.revenue, perStudent: m } })} />
            <MoneyField id="r-fl" label="Floor per institution" m={inputs.revenue.floorPerInstitution} onChange={(m) => setInputs({ ...inputs, revenue: { ...inputs.revenue, floorPerInstitution: m } })} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setInputs({ ...inputs, revenue: { perStudent: BOOK1_PLANNING_REVENUE.perStudent, floorPerInstitution: BOOK1_PLANNING_REVENUE.floorPerInstitution } })}>Use Book 1 planning assumptions</Button>
          <p className="mt-1 text-xs text-muted-foreground">{BOOK1_PLANNING_REVENUE.label}</p>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title={<span className="flex items-center gap-2">Results <Chip value="Estimate" /></span>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Monthly recurring cost', money(r.monthlyRecurring, r.currency)], ['One-time implementation', money(r.oneTimeImplementation, r.currency)], ['Cost per active user / month', money(r.costPerActiveUser, r.currency)], ['Cost per institution / month', money(r.costPerInstitution, r.currency)], ['Monthly revenue', money(r.monthlyRevenue, r.currency)], ['Gross margin', r.grossMarginPct === null ? '—' : `${r.grossMarginPct.toFixed(1)}%`], ['Active users / month', r.activeUsers.toLocaleString()], ['AI cost / month', money(r.lines.find((l) => l.key === 'ai')?.monthly, r.currency)]].map(([k, v]) => (
              <div key={k} className="rounded-[3px] border border-border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-display mt-1 text-xl tabular-nums">{v}</dd></div>))}
          </dl>
        </Panel>
        <Panel title="How each line is worked out">
          <ul className="space-y-1.5 text-sm">{r.lines.map((l) => <li key={l.key} className="flex justify-between gap-3"><span>{l.label}<span className="block text-xs text-muted-foreground">{l.formula}</span></span><span className="tabular-nums">{money(l.monthly, r.currency)}</span></li>)}</ul>
        </Panel>
        {r.warnings.length > 0 && <Panel title="Warnings"><ul role="status" className="list-disc space-y-1 pl-5 text-sm">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Panel>}
      </div>
    </div>
  );
}

function BillingSim() {
  return (
    <div className="space-y-4">
      <Panel title="State machines">
        <div className="grid gap-3 text-xs sm:grid-cols-2">{([['Quote', QUOTE], ['Subscription', SUBSCRIPTION], ['Invoice', INVOICE], ['Payment', PAYMENT]] as const).map(([n, m]) => (
          <div key={n}><p className="mb-1 font-medium text-sm">{n}</p><ul className="space-y-0.5 font-mono">{Object.entries(m).map(([s, t]) => <li key={s}>{s}{Object.keys(t).length ? ` → ${Object.entries(t).map(([e, x]) => `${x} (${e})`).join(', ')}` : ' (final)'}</li>)}</ul></div>))}</div>
        <p className="mt-3 text-xs text-muted-foreground">Entitlement follows subscription state: trialing or active → active; past due → grace; suspended → suspended; cancelled or ended → revoked. A failed payment never erases academic records.</p>
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">{SCENARIOS.map((s) => { const l = runScenario(s); return (
        <Panel key={s.name} title={s.name}>
          <ol className="list-decimal space-y-0.5 pl-5 font-mono text-xs">{l.log.map((x, i) => <li key={i}>{x}</li>)}</ol>
          <p className="mt-2 text-sm">Ends: subscription <span className="font-medium">{l.subscription}</span>, entitlement <span className="font-medium">{l.entitlement}</span>, paid {(l.paidMinor / 100).toFixed(2)}, refunded {(l.refundedMinor / 100).toFixed(2)}</p>
        </Panel>); })}</div>
    </div>
  );
}

function DataFlow() {
  return (
    <Panel title="Registration request: one workflow, end to end, as built today">
      <ol className="space-y-2">{FLOW.map((f, i) => (
        <li key={f.step} className="grid gap-1 rounded-[3px] border border-border p-3 text-sm sm:grid-cols-[28px_140px_1fr_auto]">
          <span className="font-mono text-xs text-muted-foreground">{i + 1}</span><span className="font-medium">{f.step}</span>
          <span>{f.detail}<span className="block font-mono text-xs text-muted-foreground">{f.where}</span></span>
          {f.boundary && <Chip value={f.boundary === 'Gap' ? 'not_started' : f.boundary} />}
        </li>))}</ol>
    </Panel>
  );
}

export default function Simulator() {
  const list = useLoad(() => scenarios({ action: 'list' }) as Promise<{ items: { id: string; name: string; kind: Kind; inputs: CostInputs | null; error: string | null; stack: Stack; updatedAt: string | null }[] }>);
  const [kind, setKind] = useState<Kind>('Lean pilot');
  const [inputs, setInputs] = useState<CostInputs>(emptyInputs('Lean pilot'));
  const [stack, setStack] = useState<Stack>({});
  const [name, setName] = useState('Lean pilot');
  const [currentId, setCurrentId] = useState<string | undefined>();
  const save = async (asNew: boolean) => {
    try { const r = await scenarios({ action: 'save', id: asNew ? undefined : currentId, name, kind, inputs, stack }); setCurrentId(r.id); toast('Scenario saved.'); list.reload(); } catch (e) { toast(`! ${errMsg(e)}`); }
  };
  const exportJson = () => download(`${name.replace(/\W+/g, '-')}.json`, JSON.stringify({ name, kind, inputs, stack, result: estimate(inputs), exportedAt: new Date().toISOString() }, null, 2), 'application/json');
  const exportCsv = () => { const r = estimate(inputs); download(`${name.replace(/\W+/g, '-')}.csv`, ['line,monthly,currency,formula', ...r.lines.map((l) => `"${l.label}",${l.monthly ?? ''},${r.currency},"${l.formula.replace(/"/g, "'")}"`), `"Monthly recurring (Estimate)",${r.monthlyRecurring},${r.currency},`].join('\n'), 'text/csv'); };
  return (
    <>
      <Header eyebrow="Planning tool" title="Architecture and Launch Simulator" sub="A planning tool, not an infrastructure control panel: no deployments, credentials, purchases or customer records. All figures are estimates from the inputs you enter." />
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div><Label htmlFor="sc-name" className="text-xs">Scenario name</Label><Input id="sc-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="sc-kind" className="text-xs">Type</Label><Select value={kind} onValueChange={(v) => { setKind(v as Kind); if (!currentId) { setInputs(emptyInputs(v as Kind)); setName(v); } }}><SelectTrigger id="sc-kind" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => save(false)}>{currentId ? 'Save' : 'Save scenario'}</Button>{currentId && <Button variant="outline" onClick={() => save(true)}>Save as new</Button>}<Button variant="ghost" onClick={exportJson}>Export JSON</Button><Button variant="ghost" onClick={exportCsv}>Export CSV</Button></div>
        </div>
        <Loadable state={list}>{(d) => d.items.length ? (
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Saved scenarios</caption>
            <thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Saved scenario</th><th>Type</th><th>Monthly cost (Estimate)</th><th>Margin</th><th>Updated</th><th /></tr></thead>
            <tbody>{d.items.map((s) => { const r = s.inputs ? estimate(s.inputs) : null; return (
              <tr key={s.id} className="border-t border-border"><td className="py-2 font-medium">{s.name}{s.error && <span className="block text-xs text-destructive">! {s.error}</span>}</td><td>{s.kind}</td><td className="tabular-nums">{r ? money(r.monthlyRecurring, r.currency) : '—'}</td><td className="tabular-nums">{r?.grossMarginPct != null ? `${r.grossMarginPct.toFixed(1)}%` : '—'}</td><td className="text-xs">{fmt(s.updatedAt)}</td>
                <td className="text-right"><Button size="sm" variant="ghost" disabled={!s.inputs} onClick={() => { if (s.inputs) { setInputs(s.inputs); setStack(s.stack); setName(s.name); setKind(s.kind); setCurrentId(s.id); toast(`Loaded ${s.name}.`); } }}>Load</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { try { await scenarios({ action: 'delete', id: s.id }); if (currentId === s.id) setCurrentId(undefined); list.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Delete</Button></td></tr>); })}</tbody></table></div>
        ) : <p className="mt-3 text-sm text-muted-foreground">No saved scenarios yet. Adjust the inputs below and save to compare lean pilot, multi-institution and expanded scenarios side by side.</p>}</Loadable>
      </Panel>
      <Tabs defaultValue="cost">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="map">System map</TabsTrigger><TabsTrigger value="stack">Stack</TabsTrigger><TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="cost">Capacity & cost</TabsTrigger><TabsTrigger value="billing">Billing</TabsTrigger><TabsTrigger value="flow">Data flow</TabsTrigger>
        </TabsList>
        <TabsContent value="map"><SystemMap /></TabsContent>
        <TabsContent value="stack"><StackConfigurator stack={stack} setStack={setStack} /></TabsContent>
        <TabsContent value="modules"><ModulePlanner /></TabsContent>
        <TabsContent value="cost"><CostModel inputs={inputs} setInputs={setInputs} /></TabsContent>
        <TabsContent value="billing"><BillingSim /></TabsContent>
        <TabsContent value="flow"><DataFlow /></TabsContent>
      </Tabs>
      <p className="mt-4 text-xs text-muted-foreground">The readiness matrix lives in Release evidence. Exports never include secrets.</p>
    </>
  );
}
