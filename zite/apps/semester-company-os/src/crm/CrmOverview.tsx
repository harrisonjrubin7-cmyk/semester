import { Skeleton } from '@project/components/ui/skeleton';
import { useData } from './data';
import { money } from './config';

const STAGES = [
  { label: 'Qualified deals', key: 'deals', test: (r: any) => !['Won', 'Lost'].includes(r.stage) },
  { label: 'Awaiting approval', key: 'deals', test: (r: any) => r.stage === 'Commercial Approval' && !r.approvedAt },
  { label: 'Won deals', key: 'deals', test: (r: any) => r.stage === 'Won' },
  { label: 'Active contracts', key: 'contracts', test: (r: any) => r.state === 'Active' },
  { label: 'In implementation', key: 'projects', test: (r: any) => !['Activated', 'On Hold'].includes(r.state) },
  { label: 'Activated cohorts', key: 'projects', test: (r: any) => r.state === 'Activated' },
] as const;

export default function Overview() {
  const { data, error } = useData();
  if (error) return <p className="text-sm text-destructive">Overview didn't load: {error}</p>;
  if (!data) return <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  const pipeline = data.deals.filter((d) => !['Won', 'Lost'].includes(d.stage)).reduce((s, d) => s + (d.amountMinor ?? 0), 0);
  const arr = data.contracts.filter((c) => c.state === 'Active').reduce((s, c) => s + (c.annualValueMinor ?? 0), 0);
  const openTickets = data.tickets.filter((t) => !['Resolved', 'Closed'].includes(t.state));
  const sev1 = openTickets.filter((t) => t.severity === 'Sev 1').length;
  const anySample = [...data.accounts, ...data.deals, ...data.contracts].some((r) => r.isSample);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Company OS · Restricted</p>
        <h1 className="font-display text-3xl">Sale to activation</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every figure below is calculated from records in this workspace. Nothing is estimated or imported.
          {anySample && ' Some records are marked Sample (synthetic) and are included in these totals.'}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Open pipeline', money(pipeline)],
          ['Contracted annual value', money(arr)],
          ['Open tickets', String(openTickets.length)],
          ['Open Sev 1', String(sev1)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-card p-4">
            <p className="eyebrow">{l}</p>
            <p className="font-mono text-2xl mt-1">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-xl mb-3">Lifecycle</h2>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s, i) => (
            <li key={s.label} className="rounded-md border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground font-mono">{String(i + 1).padStart(2, '0')}</p>
              <p className="font-display text-2xl">{(data[s.key] as any[]).filter(s.test).length}</p>
              <p className="text-xs">{s.label}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground mt-3">
          Rules enforced on the server: deals need approval from someone other than the owner before Won · a won deal opens a draft contract ·
          activating a contract needs a signed document and makes the account a Customer and opens an implementation project ·
          cohort activation needs all 8 launch gates and an Active contract.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl mb-3">Recent activity</h2>
        {data.audit.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {data.audit.slice(0, 8).map((a) => (
              <li key={a.id} className="px-3 py-2 text-sm flex justify-between gap-3">
                <span><b>{a.actorName ?? 'System'}</b> {a.action} a {String(a.targetTable).replace(/s$/, '')}</span>
                <span className="text-xs text-muted-foreground font-mono">{new Date(a.occurredAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
