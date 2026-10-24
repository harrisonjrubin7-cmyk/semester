import { securityOps } from 'zitejs/api';
import { Panel, Empty, Loadable, useLoad, fmt, Metric, DecisionTrail } from './kit';
import { StudentAffairs } from '../pages/Staff';

export function SecurityOps() {
  const s = useLoad(() => securityOps({}));
  return (
    <Loadable state={s}>{(d) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Events · 7 days" value={d.totals.week} />
          <Metric label="Sensitive · 7 days" value={d.totals.sensitive} />
          <Metric label="Via assistant" value={d.totals.assistant} />
          <Metric label="Active admins" value={d.totals.admins} />
          <Metric label="Pending joins" value={d.totals.pending} />
          <Metric label="Suspended" value={d.totals.suspended} />
        </div>
        {d.totals.admins < 2 && <p className="rounded-[3px] border border-border bg-card px-3 py-2 text-sm">! Only {d.totals.admins} active administrator. Two-person duty needs a second admin to approve role changes and hold releases.</p>}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Sensitive actions · decision trail">
            <DecisionTrail items={d.sensitive.map((e: { action: string; actor: string; when: string; ref: string; authority: string; viaAssistant: boolean }) => ({ title: e.action, who: `${e.actor}${e.authority ? ` · ${e.authority}` : ''}${e.viaAssistant ? ' · ✦ via assistant' : ''}`, when: fmt(e.when), detail: e.ref }))} />
          </Panel>
          <Panel title="Most active · 7 days">{d.actors.length ? <ul className="space-y-1 text-sm">{d.actors.map((a: { name: string; count: number }) => <li key={a.name} className="flex justify-between"><span>{a.name}</span><span className="tabular-nums text-muted-foreground">{a.count}</span></li>)}</ul> : <Empty>No activity this week.</Empty>}</Panel>
        </div>
      </div>
    )}</Loadable>
  );
}

export const SupportQueue = StudentAffairs;
