import { institutionOps, sectionRequests } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useLoad, errMsg } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, PageHeader } from '../components/States';

type Cell = { label: string; display: string; suppressed: boolean };
type Metric = { id: string; label: string; caveat: string; source: string; totalDisplay: string; cells: Cell[] };
type Req = { state: string; departmentId: number; mine: boolean };

export default function Overview() {
  // Ask only for what this viewer may see (institutionOps 'access'); a viewer without the analytics permission gets a
  // scoped explanation instead of a failed request. Each widget keeps its own loading / unavailable / denied state.
  const access = useLoad(() => institutionOps({ action: 'access' }) as Promise<{ roles: string[]; member: boolean; can: Record<string, boolean> }>);
  const canStats = !!access.data?.can['readiness.read'];
  const analytics = useLoad(async () => {
    const acc = await institutionOps({ action: 'access' }) as { can: Record<string, boolean> };
    if (!acc.can['readiness.read']) return null;
    return institutionOps({ action: 'analytics' }) as Promise<{ institution: string; isSample: boolean; minCell: number; metrics: Metric[] }>;
  });
  const reqs = useLoad(() => sectionRequests({ action: 'get' }) as Promise<{ me: { chairOf: number[]; isRegistrar: boolean }; requests: Req[] }>);

  const waiting = reqs.data ? reqs.data.requests.filter((r) =>
    (r.state === 'submitted' && reqs.data!.me.chairOf.includes(r.departmentId)) ||
    (['chair_approved', 'authorized', 'creating', 'created'].includes(r.state) && reqs.data!.me.isRegistrar)).length : 0;

  const exportCsv = async () => {
    try {
      const out = await institutionOps({ action: 'export' }) as { filename: string; csv: string };
      const url = URL.createObjectURL(new Blob([out.csv], { type: 'text/csv' }));
      Object.assign(document.createElement('a'), { href: url, download: out.filename }).click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded. Small counts are suppressed.');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader title={analytics.data?.institution || 'Institution overview'} sub="What is happening, what needs coordination, and where to work."
        action={analytics.data && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export aggregates</Button>} />
      <Card className="mb-6 border-primary/20 bg-primary text-primary-foreground">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm opacity-80">Action Center</p>
            {reqs.error ? <p className="text-base font-semibold">Section requests could not load. <span className="opacity-80">{reqs.error}</span></p>
              : <p className="text-3xl font-extrabold">{reqs.loading && !reqs.data ? '…' : waiting} <span className="text-base font-semibold opacity-80">section requests waiting on you</span></p>}
          </div>
          <Button asChild variant="secondary"><Link to="/requests">Open queue</Link></Button>
        </CardContent>
      </Card>
      {analytics.data?.isSample && <p className="mb-4 rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground">This institution contains sample data.</p>}
      {access.data && !canStats ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm">
          <p className="font-medium">Institution statistics</p>
          <p className="mt-1 text-muted-foreground">Enrollment, holds and registration counts are shown to registrar and institutional-research staff. Your current role ({access.data.roles.join(', ') || 'none'}) does not include them, so they were not requested. The work you can do is in the menu.</p>
        </div>
      ) : analytics.loading && !analytics.data ? <LoadingBlock /> : analytics.error ? <DeniedOrError message={analytics.error} onRetry={analytics.reload} /> : !analytics.data ? null : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {analytics.data!.metrics.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardDescription>{m.label}</CardDescription>
                <CardTitle className="font-mono text-3xl">{m.totalDisplay}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {m.cells.length === 0 && <p className="text-sm text-muted-foreground">No records yet.</p>}
                {m.cells.map((c) => (
                  <div key={c.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className={c.suppressed ? 'font-mono text-muted-foreground' : 'font-mono font-medium'}>{c.display}</span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">{m.source} · {m.caveat}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
