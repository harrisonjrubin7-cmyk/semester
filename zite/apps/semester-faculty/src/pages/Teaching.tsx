import { Link } from 'react-router-dom';
import { useState } from 'react';
import { regrade, sectionRequests, facultyToday } from 'zitejs/api';
import { nextMeeting, countLabel, type Widget } from '../../../semester/src/lib/facultyTodayRules';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { useLoad, fmtDate } from '../lib/useLoad';
import { loadOh } from '../lib/oh';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';

export default function Teaching() {
  const oh = useLoad(loadOh);
  const rg = useLoad(() => regrade({ action: 'queue' }) as Promise<{ items: { status: string }[] }>);
  type Today = { sections: Widget<{ count: number; items: { id: string; label: string; times: string }[] }>; toGrade: Widget<{ count: number; items: { submissionId: string; sectionId: string; section: string; task: string; student: string }[] }>;
    finalGrades: Widget<{ count: number; items: { section: string; toPropose: number; toRelease: number; toCertify: number }[] }>; accommodations: Widget<{ count: number; items: { section: string; arrangements: string[] }[] }> };
  const today = useLoad(() => facultyToday({}) as Promise<Today>);
  const sr = useLoad(() => sectionRequests({ action: 'get' }) as Promise<{ requests: { ref: string; label: string; state: string; forMe?: boolean }[] }>);
  const pending = rg.data?.items.filter((i) => i.status === 'Pending').length ?? 0;
  const [term, setTerm] = useState<string>('all');

  if (oh.loading && !oh.data) return <LoadingBlock />;
  // Distinguish "you may not see this" from "it could not load"; neither may look like "you have no sections", and a failure
  // here is shown in the sections card only — the rest of Today keeps working.
  const ohDenied = !!oh.error && /access|role|allow|not allowed|Reference/i.test(oh.error);
  const ohMessage = oh.error ? (ohDenied ? `You don’t have access to teaching information in this workspace. ${oh.error}` : `Your sections could not load, so this page cannot say whether you teach anything this term. ${oh.error}`) : null;
  const d = oh.data ?? { teaching: [], hosting: [], hostKinds: [], now: '', firstSection: null };
  const termOf = (label: string) => label.split('·').pop()!.trim();
  const terms = [...new Set(d.teaching.map((t) => termOf(t.label)))];
  const shown = term === 'all' ? d.teaching : d.teaching.filter((t) => termOf(t.label) === term);
  const settingUp = (sr.data?.requests ?? []).filter((r) => r.forMe && !['created', 'reconciled', 'rejected', 'withdrawn', 'cancelled'].includes(r.state));
  const todayStr = new Date().toDateString();
  const todays = d.hosting.filter((s) => !s.cancelled && new Date(s.start).toDateString() === todayStr);

  return (
    <div>
      <PageHeader title="Teaching" sub="Your sections, today's office hours and what needs your decision. Course grades stay separate from official records until the registrar posts them." />
      <NextUp today={today.data} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Submissions to grade" value={countLabel(today.data?.toGrade as never, today.loading)} to="/queue" note={stateNote(today.data?.toGrade, today.error)} />
        <Stat label="Final grades to release" value={countLabel(today.data?.finalGrades as never, today.loading)} to="/final-grades" note={stateNote(today.data?.finalGrades, today.error)} />
        <Stat label="Accommodation notices to acknowledge" value={countLabel(today.data?.accommodations as never, today.loading)} note={stateNote(today.data?.accommodations, today.error)} />
        <Stat label="Regrades waiting" value={rg.data ? pending : rg.error ? '—' : '…'} to="/regrades" note={rg.error ? 'Could not load.' : undefined} />
      </div>
      {today.data?.toGrade.state === 'ok' && today.data.toGrade.data.items.length > 0 && (
        <Card className="mb-6"><CardHeader><CardTitle className="text-base">Waiting for your grading</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border text-sm">{today.data.toGrade.data.items.map((x) => (
            <Link key={x.submissionId} to={`/course/${x.sectionId}`} className="flex justify-between py-2 hover:text-primary"><span>{x.student} · {x.task}</span><span className="text-muted-foreground">{x.section}</span></Link>))}</CardContent></Card>)}
      {today.data?.accommodations.state === 'ok' && today.data.accommodations.data.items.length > 0 && (
        <Card className="mb-6"><CardHeader><CardTitle className="text-base">Accommodation notices</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{today.data.accommodations.data.items.map((x, i) => <p key={i}>{x.section} · {x.arrangements.join('; ') || 'Arrangements on file'}</p>)}
            <p className="text-xs text-muted-foreground">Only what you need to implement is shown; supporting evidence stays with the accessibility office. Acknowledge each notice in the course's Accessibility tab.</p></CardContent></Card>)}
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
          {ohMessage ? <DeniedOrError message={ohMessage} onRetry={oh.reload} /> : d.teaching.length === 0 ? <Empty title="No assigned sections" hint={settingUp.length ? 'Your proposed sections are listed above; they move here when created.' : 'You are not the instructor of any section in this institution. The registrar assigns instructors when a section is created; ask your department if you expected one.'} />
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

function stateNote(w: Widget<unknown> | undefined, err: string | null): string | undefined {
  if (err) return 'Could not load.';
  if (!w) return undefined;
  return w.state === 'denied' ? 'Not part of your role.' : w.state === 'unavailable' ? 'Could not load.' : undefined;
}

function NextUp({ today }: { today: { sections: Widget<{ items: { id: string; label: string; times: string }[] }> } | null }) {
  if (!today || today.sections.state !== 'ok' || !today.sections.data.items.length) return null;
  const now = new Date();
  const next = today.sections.data.items.map((s) => ({ s, m: nextMeeting(s.times, now) })).filter((x) => x.m).sort((a, b) => a.m!.start.getTime() - b.m!.start.getTime())[0];
  return (
    <Card className="mb-6 border-primary/20">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{next?.m?.inProgress ? 'In class now' : 'Next class'}</p>
          <p className="font-display text-xl">{next ? next.s.label : 'No scheduled meetings'}</p>
          <p className="text-sm text-muted-foreground">{next ? `${next.m!.start.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })} – ${next.m!.end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Your sections have no meeting pattern on file.'}</p></div>
        {next && <Link to={`/course/${next.s.id}`} className="text-sm font-medium text-primary underline">Open course</Link>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, to, note }: { label: string; value: number | string; to?: string; note?: string }) {
  const body = <Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-mono text-3xl font-semibold">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</CardContent></Card>;
  return to ? <Link to={to}>{body}</Link> : body;
}
