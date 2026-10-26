import { Link } from 'react-router-dom';
import { regrade } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { useLoad, fmtDate } from '../lib/useLoad';
import { loadOh } from '../lib/oh';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

export default function Teaching() {
  const oh = useLoad(loadOh);
  const rg = useLoad(() => regrade({ action: 'queue' }) as Promise<{ items: { status: string }[] }>);
  const pending = rg.data?.items.filter((i) => i.status === 'Pending').length ?? 0;

  if (oh.loading && !oh.data) return <LoadingBlock />;
  if (oh.error) return <DeniedOrError message={oh.error} onRetry={oh.reload} />;
  const d = oh.data!;
  const today = new Date().toDateString();
  const todays = d.hosting.filter((s) => !s.cancelled && new Date(s.start).toDateString() === today);

  return (
    <div>
      <PageHeader title="Teaching" sub="Your sections, today's office hours and what needs your decision. Course grades stay separate from official records until the registrar posts them." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Sections you teach" value={d.teaching.length} />
        <Stat label="Office hours today" value={todays.length} to="/office-hours" />
        <Stat label="Regrades waiting" value={rg.data ? pending : '…'} to="/regrades" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Your sections</CardTitle></CardHeader>
        <CardContent>
          {d.teaching.length === 0 ? <Empty title="No sections yet" hint="The registrar assigns you when a section is created." /> : (
            <div className="divide-y divide-border">
              {d.teaching.map((t) => (
                <Link key={t.id} to={`/sections/${t.id}`} className="flex items-center justify-between py-3 font-medium hover:text-primary">
                  {t.label}<ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {todays.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Today</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {todays.map((s) => <p key={s.id}>{fmtDate(s.start)} · {s.section ?? s.kind} · {s.location} · {s.bookings.filter((b) => b.state !== 'cancelled').length}/{s.capacity} booked</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const body = <Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-mono text-3xl font-semibold">{value}</p></CardContent></Card>;
  return to ? <Link to={to}>{body}</Link> : body;
}
