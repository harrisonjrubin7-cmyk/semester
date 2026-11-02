import { useMemo, useState } from 'react';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { ROLE_APPS, STAGES, JOURNEYS, GROUP_LABEL, Stage } from './lib/roleRegistry';

const GROUPS = Object.values(GROUP_LABEL);

export default function RoleRegistryPage() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [only, setOnly] = useState<'all' | 'partial' | 'missing'>('all');
  const list = useMemo(() => ROLE_APPS.filter((r) =>
    (!group || r.group === group) && (only === 'all' || r.status === only) &&
    (r.role + r.capabilities + r.host).toLowerCase().includes(q.toLowerCase())), [q, group, only]);
  const partial = ROLE_APPS.filter((r) => r.status === 'partial').length;
  const byStage = (s: Stage) => ROLE_APPS.filter((r) => r.stage === s);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Role app registry</h1>
        <p className="mt-1 text-sm text-muted-foreground">All 69 roles from the build pack, reconciled against what exists in this workspace today. Each role is a connected experience on shared accounts and data, not a separate product. {partial} have a real starting surface; {69 - partial} have none yet. None is verified end to end.</p>
      </header>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Build order</h2>
        <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(STAGES) as unknown as Stage[]).map((s) => {
            const rows = byStage(Number(s) as Stage);
            return <li key={s} className="rounded border border-border p-2"><p className="font-medium">{s}. {STAGES[s]}</p><p className="text-xs text-muted-foreground">{rows.length} roles · {rows.filter((r) => r.status === 'partial').length} started</p></li>;
          })}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search roles or capabilities" value={q} onChange={(e) => setQ(e.target.value)} />
        {(['all', 'partial', 'missing'] as const).map((o) => <Button key={o} size="sm" variant={only === o ? 'default' : 'outline'} onClick={() => setOnly(o)}>{o === 'all' ? 'All' : o === 'partial' ? 'Started' : 'Not started'}</Button>)}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={!group ? 'default' : 'outline'} onClick={() => setGroup(null)}>All groups</Button>
        {GROUPS.map((g) => <Button key={g} size="sm" variant={group === g ? 'default' : 'outline'} onClick={() => setGroup(g)}>{g}</Button>)}
      </div>

      {list.length === 0 ? <p className="text-sm text-muted-foreground">No roles match.</p> : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">#</th><th className="p-2">Role</th><th className="p-2">Hosted in</th><th className="p-2">Exists today</th><th className="p-2">Stage</th><th className="p-2">Status</th></tr></thead>
            <tbody className="divide-y divide-border">{list.map((r) => (
              <tr key={r.n} className="align-top">
                <td className="p-2 text-muted-foreground">{r.n}</td>
                <td className="p-2"><p className="font-medium">{r.role}</p><p className="text-xs text-muted-foreground">{r.capabilities}</p></td>
                <td className="p-2 whitespace-nowrap">{r.host}</td>
                <td className="p-2 text-xs">{r.existing ?? <span className="text-muted-foreground">Nothing yet</span>}</td>
                <td className="p-2 whitespace-nowrap text-xs">{r.stage}. {STAGES[r.stage]}</td>
                <td className="p-2"><Badge variant={r.status === 'partial' ? 'secondary' : 'outline'}>{r.status === 'partial' ? 'Started' : 'Not started'}</Badge></td>
              </tr>))}</tbody>
          </table>
        </div>)}

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="mb-2 font-medium">Proof journeys</h2>
        <p className="mb-3 text-xs text-muted-foreground">An app counts as built only when these cross-app journeys pass. Acceptance evidence: none yet.</p>
        <ul className="space-y-2 text-sm">{JOURNEYS.map((j) => <li key={j.name}><span className="font-medium">{j.name}:</span> {j.roles.join(' → ')}</li>)}</ul>
      </section>
    </div>
  );
}
