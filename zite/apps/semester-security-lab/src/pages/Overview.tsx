import { Link } from 'react-router-dom';
import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { useLabData } from '../lib/useLabData';
import { ModeBadge, PageHeader, StatusBadge } from '../components/Badges';

const MATRIX = [
  ['Lab screens, records, workflows', 'Native Zite', 'Verified'],
  ['JWT & token-bucket simulators', 'In-app simulation', 'Verified (simulation only)'],
  ['Internal access (SSO + allowlist)', 'Native Zite', 'Configured (denied-user test not yet run)'],
  ['PostgreSQL RLS audit', 'Disposable Postgres 16 (docs/execution/rls)', 'Verified in test (28 + 21 checks, mutation-checked); not run on a Semester database'],
  ['Redis token bucket (TypeScript; Go not run)', 'Disposable Redis (docs/execution/rls/api)', 'Verified in test (6 tests + 2-instance load test); Go version blocked'],
  ['Tenant isolation E2E', 'Staging HTTP runner', 'Blocked'],
];

export default function Overview() {
  const { data } = useLabData();
  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div>;
  const stats = [
    ['Open critical/high findings', data.findings.filter((f) => f.remediation !== 'fixed' && (f.severity === 'critical' || f.severity === 'high')).length, '/rls'],
    ['Isolation tests passed', `${data.isolation.filter((t) => t.result === 'passed').length}/${data.isolation.length}`, '/isolation'],
    ['Gates satisfied', `${data.gates.filter((g) => g.status === 'satisfied').length}/${data.gates.length}`, '/gates'],
    ['Blocked suites', data.suites.filter((s) => s.runnerStatus === 'Blocked').length, '/suites'],
  ] as const;
  return (
    <div>
      <PageHeader title="Overview" sub="Shows what is proven, what is only simulated, and what is blocked until an external runner is connected." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([l, v, to]) => (
          <Link key={l} to={to}><Card className="p-4 transition-shadow hover:shadow-md"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-mono text-3xl font-semibold">{v}</div></Card></Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Capability matrix</h2>
          <div className="divide-y text-sm">
            {MATRIX.map(([c, w, s]) => (
              <div key={c} className="flex items-center justify-between gap-3 py-2"><div><div>{c}</div><div className="text-xs text-muted-foreground">{w}</div></div>
                <StatusBadge value={s.startsWith('Blocked') ? 'blocked' : s.startsWith('Verified') ? 'passed' : 'pending'} /></div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Recent runs</h2>
          {data.runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet. Save a simulator result or request a suite run.</p> :
            <div className="divide-y text-sm">{data.runs.slice(0, 7).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 py-2"><span className="truncate">{r.title}</span><span className="flex shrink-0 gap-1"><ModeBadge mode={r.mode} /><StatusBadge value={r.status} /></span></div>
            ))}</div>}
        </Card>
      </div>
    </div>
  );
}
