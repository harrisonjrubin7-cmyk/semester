import { Link } from 'react-router-dom';
import { useState } from 'react';
import { regrade, sectionRequests } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { useLoad, fmtDate, readError } from '../lib/useLoad';
import { loadOh } from '../lib/oh';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

export default function Teaching() {
  const oh = useLoad(loadOh);
  const rg = useLoad(() => regrade({ action: 'queue' }) as Promise<{ items: { status: string }[] }>);
  const sr = useLoad(() => sectionRequests({ action: 'get' }) as Promise<{ requests: { ref: string; label: string; state: string; forMe?: boolean }[] }>);
  const pending = rg.data?.items.filter((i) => i.status === 'Pending').length ?? 0;
  const [term, setTerm] = useState<string>('all');

  if (oh.loading && !oh.data) return <LoadingBlock />;
  // Distinguish "you may not see this" from "it could not load"; neither may look like "you have no sections".
  if (oh.error) {
    const denied = /access|role|allow|not allowed|Reference/i.test(oh.error);
    return <DeniedOrError message={denied ? `You don’t have access to teaching information in this workspace. ${oh.error}` : `Your sections could not load, so this page cannot say whether you teach anything this term. ${oh.error}`} onRetry={oh.reload} />;
  }
  const d = oh.data!;
  const termOf = (label: string) => label.split('·').pop()!.trim();
  const terms = [...new Set(d.teaching.map((t) => termOf(t.label)))];
  const shown = term === 'all' ? d.teaching : d.teaching.filter((t) => termOf(t.label) === term);
  const settingUp = (sr.data?.requests ?? []).filter((r) => r.forMe && !['created', 'reconciled', 'rejected', 'withdrawn', 'cancelled'].includes(r.state));
  const today = new Date().toDateString();
  const todays = d.hosting.filter((s) => !s.cancelled && new Date(s.start).toDateString() === today);

  return (
    <div>
      <PageHeader title="Teaching" sub="Your sections, today's office hours and what needs your decision. Course grades stay separate from official records until the registrar posts them." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Sections you teach" value={d.teaching.length} />
        <Stat label="Office hours today" value={todays.length} to="/office-hours" />
        <Stat label="Regrades waiting" value={rg.data ? pending : rg.error ? '—' : '…'} to="/regrades" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Your sections</CardTitle>
          {terms.length > 1 && <select aria-label="Term" className="rounded-md border border-input bg-background p-1.5 text-sm" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="all">All terms</option>{terms.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
        </CardHeader>
        <CardContent>
          {settingUp.length > 0 && <div className="mb-3 rounded-md border border-dashed border-border p-3 text-sm">
            <p className="font-medium">Being set up for you</p>
            {settingUp.map((r) => <p key={r.ref} className="text-muted-foreground">{r.label} · {r.ref} · {r.state.replace(/_/g, ' ')} — it appears here once the registrar creates the section.</p>)}
          </div>}
          {sr.error && <p className="mb-3 text-xs text-muted-foreground">! Pending section requests could not load, so sections still being set up may not be listed.</p>}
          {d.teaching.length === 0 ? <Empty title="No assigned sections" hint={settingUp.length ? 'Your proposed sections are listed above; they move here when created.' : 'You are not the instructor of any section in this institution. The registrar assigns instructors when a section is created; ask your department if you expected one.'} />
          : shown.length === 0 ? <Empty title={`No sections in ${term}`} hint="Choose another term or All terms." /> : (
            <div className="divide-y divide-border">
              {shown.map((t) => (
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
