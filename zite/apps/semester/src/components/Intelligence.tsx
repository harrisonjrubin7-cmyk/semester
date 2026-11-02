import { useState, Fragment } from 'react';
import { intelligence } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Panel, Empty, Status, SourceTag, fmtDay, useLoad, Loadable } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AskMode = 'tutor' | 'course_guide' | undefined;

/** Mode bar for Ask Semester: one assistant, labelled functional modes. Disabled modes say why. */
export function ModeBar({ mode, setMode }: { mode: AskMode | 'executive_assistant' | 'workflow_concierge'; setMode: (m: AskMode | 'executive_assistant' | 'workflow_concierge') => void }) {
  const s = useLoad(() => intelligence({ action: 'me' }));
  return (
    <Loadable state={s}>{(d: any) => (
      <Panel className="mb-4" title="Semester Intelligence">
        <div role="radiogroup" aria-label="Assistant mode" className="flex flex-wrap gap-2">
          <Button size="sm" role="radio" aria-checked={!mode} variant={!mode ? 'default' : 'outline'} onClick={() => setMode(undefined)}>General</Button>
          {d.specialists.map((m: any) => (
            <Button key={m.key} size="sm" role="radio" aria-checked={mode === m.key} disabled={!m.enabled} title={m.enabled ? m.question : `Not available yet: ${m.why}`}
              variant={mode === m.key ? 'default' : 'outline'} onClick={() => setMode(m.key)}>{m.label}{!m.enabled && ' · soon'}</Button>))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">A mode changes the style of help, not what Semester may read or do. {d.memory} {d.companions.length > 0 && `Role context: ${d.companions.map((c: any) => c.persona).join(', ')} (separate; permissions never merge).`}</p>
        {mode && <p className="mt-1 text-xs text-muted-foreground">{d.specialists.find((m: any) => m.key === mode)?.why}</p>}
      </Panel>)}
    </Loadable>
  );
}

/** Executive Assistant: computed on the server from your own tasks. Proposals only. */
export function ExecutiveBrief() {
  const s = useLoad(() => intelligence({ action: 'brief' }));
  const row = (t: any) => <li key={t.id} className="flex justify-between gap-3 py-1"><span>{t.title}</span><span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDay(t.due)}</span></li>;
  return (
    <Panel className="mb-4" title="Executive Assistant · today and this week">
      <Loadable state={s}>{(b: any) => (
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium">Priorities</p>
            {b.priorities.overdue.length > 0 && <><p className="mt-2 text-xs text-muted-foreground"><Status value="overdue" /> Past due</p><ul>{b.priorities.overdue.map(row)}</ul></>}
            {b.priorities.dueToday.length > 0 && <><p className="mt-2 text-xs text-muted-foreground">Due today</p><ul>{b.priorities.dueToday.map(row)}</ul></>}
            <p className="mt-2 text-xs text-muted-foreground">Next 7 days</p>
            {b.priorities.thisWeek.length ? <ul>{b.priorities.thisWeek.map(row)}</ul> : <Empty>Nothing dated this week.</Empty>}
          </div>
          <div>
            <p className="font-medium">Feasible plan</p>
            {b.plan.length ? <ol className="ml-4 list-decimal">{b.plan.map((p: string) => <li key={p}>{p}</li>)}</ol> : <Empty>Nothing pressing.</Empty>}
            {b.conflicts.length > 0 && <><p className="mt-3 font-medium">Crowded days</p><ul>{b.conflicts.map((c: string) => <li key={c}>{c}</li>)}</ul></>}
            {b.proposedActions.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Proposed, not done: {b.proposedActions.map((x: any) => x.proposal).join('; ')}.</p>}
            <p className="mt-3 text-xs text-muted-foreground">Uncertainty: {b.uncertainty.join(' ')} Computed inside Semester; nothing was sent to an AI provider.</p>
          </div>
        </div>)}
      </Loadable>
    </Panel>
  );
}

/** Workflow Concierge: safe status projections for your own cases. Read-only. */
export function WorkflowConcierge() {
  const s = useLoad(() => intelligence({ action: 'workflows' }));
  return (
    <Panel className="mb-4" title="Workflow Concierge · who owns it and what happens next">
      <Loadable state={s}>{(d: any) => (
        <div className="text-sm">
          {d.items.length === 0 ? <Empty>You have no open or past Help cases.</Empty> : (
            <ul className="divide-y">{d.items.map((w: any) => (
              <li key={w.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{w.process}</span><Status value={w.status} /></div>
                <p className="text-xs text-muted-foreground">Owner: {w.owner} · You: {w.yourRole}{w.reference && ` · Ref ${w.reference}`}</p>
                <p className="mt-1">Next: {w.nextStep}</p>
                {w.uncertainty && <p className="text-xs text-muted-foreground">{w.uncertainty}</p>}
              </li>))}
            </ul>)}
          <p className="mt-3 text-xs text-muted-foreground">Uncertainty: {d.uncertainty.join(' ')} Computed inside Semester; nothing was sent to an AI provider and nothing was changed.</p>
        </div>)}
      </Loadable>
    </Panel>
  );
}

/** Institution Console tab: the read-only registry of all role profiles, prompts, manifests, tool mappings and acceptance evidence. */
export default function IntelligenceRegistry() {
  const s = useLoad(() => intelligence({ action: 'registry' }));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Loadable state={s}>{(d: any) => !d.allowed ? <Panel><Empty>Administrators only.</Empty></Panel> : (
      <div className="grid gap-4">
        <Panel title={`Role-agent registry · ${d.profiles.length} profiles · pack ${d.version}`}>
          <p className="text-sm text-muted-foreground">Proposed configurations, not installed agents. Every profile is production-off, reads only what its person may read, and cannot act. Prompts are not security controls; the server enforces scope.</p>
          <Input className="mt-3" aria-label="Filter profiles" placeholder="Filter by role or group" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Profile</th><th>Group</th><th>Boundary</th><th>Mode</th><th>Production</th><th /></tr></thead>
            <tbody>{d.profiles.filter((p: any) => !q || `${p.persona} ${p.group} ${p.id}`.toLowerCase().includes(q.toLowerCase())).map((p: any) => (<Fragment key={p.id}>
              <tr className="border-t border-border align-top">
                <td className="py-2">{p.persona}<div className="font-mono text-[11px] text-muted-foreground">{p.id}</div></td>
                <td className="py-2">{p.group}</td><td className="py-2">{p.boundary}</td>
                <td className="py-2">{p.adapter ? 'Machine adapter' : 'Companion + delegate'}</td>
                <td className="py-2"><Status value="off" /></td>
                <td className="py-2"><Button size="sm" variant="ghost" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide' : 'Details'}</Button></td>
              </tr>
              {open === p.id && <tr><td colSpan={6} className="bg-muted/30 p-3 text-xs">
                <p><b>Workflow family:</b> {p.family}{d.approvalFamilies.includes(p.family) ? ' (independent human approval required)' : ''}. <b>Mission:</b> {p.mission}. <b>Deliverables:</b> {p.deliverables}.</p>
                <p className="mt-1"><b>Status:</b> designed: {p.status.designed} · implemented: {p.status.implemented} · tested: {p.status.tested} · deployed: {p.status.deployed} · institution-authorized: {p.status.institutionAuthorized}</p>
                <p className="mt-1"><b>Activation gate:</b> {p.status.gate.join(' → ')}</p>
                <details className="mt-2"><summary>Manifest</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(p.manifest, null, 2)}</pre></details>
                <details className="mt-1"><summary>Delegate prompt</summary><pre className="mt-1 whitespace-pre-wrap">{p.delegatePrompt}</pre></details>
                {p.companionPrompt && <details className="mt-1"><summary>Companion prompt</summary><pre className="mt-1 whitespace-pre-wrap">{p.companionPrompt}</pre></details>}
              </td></tr>}
            </Fragment>))}</tbody>
          </table></div>
        </Panel>
        <Panel title="Run-state graph and handoffs (reference contract)">
          <p className="text-sm">NEW → AUTHORIZED → RUNNING → COMPLETED (read/draft) · or → PROPOSED → AWAITING_APPROVAL → APPROVED → EXECUTING → RECONCILING → COMPLETED. Timeouts go to OUTCOME_UNKNOWN, never a blind retry. Cancel or revoke before dispatch ends the run; after dispatch it reconciles. Handoffs: proposed → disclosure approval → queued → accepted → in progress → delivered.</p>
          <p className="mt-1 text-xs text-muted-foreground">Reducer in lib/agentRuntime.ts with 22 tests. No runtime executes it yet. Model-facing tools: {d.modelTools.join(', ')}. Families: {d.families.join(', ')}.</p>
          <details className="mt-2 text-xs"><summary>Undergraduate companion prompt (full)</summary><pre className="mt-1 whitespace-pre-wrap">{d.undergradPrompt}</pre></details>
        </Panel>
        <Panel title="Logical tools → existing services">
          <ul className="text-sm">{d.tools.map((t: any) => <li key={t.tool} className="border-t border-border py-2 first:border-0"><span className="font-mono">{t.tool}</span> <Status value={t.state} /> <span className="text-muted-foreground">{t.contract}</span><div className="text-xs">{t.service ?? 'No service'} · {t.note}</div></li>)}</ul>
        </Panel>
        <Panel title={`Modes · ${d.specialists.length + d.extraModes.length}`}>
          <ul className="text-sm">{d.specialists.map((m: any) => <li key={m.key} className="py-1"><Status value={m.enabled ? 'enabled' : 'off'} /> {m.label} <span className="text-xs text-muted-foreground">({m.engine}) {m.why}</span></li>)}
            {d.extraModes.map((m: any) => <li key={m.id} className="py-1"><Status value="off" /> {m.label} <span className="text-xs text-muted-foreground">{m.mission}. {m.boundary}.</span></li>)}</ul>
        </Panel>
        <Panel title={`Acceptance scenarios · ${d.acceptance.filter((a: any) => a.evidence).length} of ${d.acceptance.length} with evidence`}>
          <ul className="text-sm">{d.acceptance.map((a: any, i: number) => <li key={i} className="border-t border-border py-2 first:border-0"><SourceTag source={a.family} /> {a.scenario} → <span className="text-muted-foreground">{a.expected}</span><div className="text-xs">{a.evidence ? `Evidence: ${a.evidence}` : '! No evidence yet — launch gate open'}</div></li>)}</ul>
        </Panel>
      </div>)}
    </Loadable>
  );
}
