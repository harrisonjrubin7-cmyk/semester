import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth, loginWithRedirect } from 'zitejs/auth';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Building2, GraduationCap, Users, ListChecks } from 'lucide-react';
import { AppShell, type NavGroup } from '../../semester/src/components/AppShell';
import { employer, EmployerOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { DatePicker } from '@project/components/ui/date-picker';
import { Skeleton } from '@project/components/ui/skeleton';
import { Toaster } from '@project/components/ui/sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { Wordmark } from '@project/components/brand/Mark';
import Scholarships from './Scholarships';
import Partners from './Partners';

type Opp = NonNullable<EmployerOutputType['opportunities']>[number];
type Draft = { id?: string; version?: number; title: string; kind: 'Internship' | 'Job' | 'Research' | 'Mentorship'; employerName: string; description: string; location: string; closesOn: string | null };
const KINDS = ['Internship', 'Job', 'Research', 'Mentorship'] as const;
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That didn’t go through');

function Editor({ draft, onSave, onCancel }: { draft: Draft; onSave: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const ok = d.title.trim().length >= 3 && d.employerName.trim().length >= 2;
  return (
    <section className="mb-6 rounded-md border border-border bg-card p-4">
      <h2 className="text-lg">{d.id ? 'Edit opportunity' : 'Post an opportunity'}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Title, e.g. Data analyst intern" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <Select value={d.kind} onValueChange={(k) => setD({ ...d, kind: k as Draft['kind'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Organization name" value={d.employerName} onChange={(e) => setD({ ...d, employerName: e.target.value })} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input placeholder="Location, e.g. Remote or Chicago, IL" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
        <DatePicker value={d.closesOn ? new Date(d.closesOn + 'T12:00:00') : undefined} onChange={(x) => setD({ ...d, closesOn: x ? x.toISOString().slice(0, 10) : null })} />
      </div>
      <Textarea className="mt-3" rows={4} placeholder="What the role involves and who should apply" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      {!ok && <p className="mt-2 text-xs text-muted-foreground">Add a title (3+ characters) and your organization name.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Students at partner institutions see this in Semester → Career.</p>
      <div className="mt-3 flex gap-2"><Button disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onSave(d); } finally { setBusy(false); } }}>{busy ? 'Saving…' : d.id ? 'Save changes' : 'Post'}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </section>
  );
}

function Applicants({ o, onDecide }: { o: Opp; onDecide: (applicant: string, version: number, decision: 'Shortlisted' | 'Declined' | 'Reset') => void }) {
  if (!o.applicants.length) return <p className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">○ No applicants yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {o.applicants.map((a) => (
        <li key={a.id} className="py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{a.name} {a.email && <a className="ml-2 text-xs text-muted-foreground underline" href={`mailto:${a.email}`}>{a.email}</a>}</p>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-border px-2 py-0.5 text-xs">{a.stage === 'Shortlisted' ? '✓ Shortlisted' : a.stage === 'Declined' ? '⊘ Declined' : '○ New'}</span>
              {a.stage !== 'Shortlisted' && <Button size="sm" variant="outline" onClick={() => onDecide(a.id, a.version, 'Shortlisted')}>Shortlist</Button>}
              {a.stage !== 'Declined' && <Button size="sm" variant="ghost" onClick={() => onDecide(a.id, a.version, 'Declined')}>Decline</Button>}
              {a.stage !== 'New' && <Button size="sm" variant="ghost" onClick={() => onDecide(a.id, a.version, 'Reset')}>Undo</Button>}
            </div>
          </div>
          {a.portfolio.length ? <ul className="mt-2 space-y-1">{a.portfolio.map((p) => <li key={p.id} className="text-xs"><span className="mr-1">○</span>{p.title}{p.file && <a href={p.file} target="_blank" rel="noreferrer" className="ml-2 underline">Open</a>}{p.body && <span className="block text-muted-foreground">{p.body}</span>}{(p as { verified?: { statement: string; by: string }[] }).verified?.map((v, i) => <span key={i} className="mt-0.5 block">✓ Verified by {v.by}: {v.statement}</span>)}</li>)}</ul>
            : <p className="mt-1 text-xs text-muted-foreground">⊘ Nothing shared. Students choose what employers can see when they apply.</p>}
        </li>
      ))}
    </ul>
  );
}

const GROUPS: NavGroup[] = [
  { group: null, items: [{ to: '/', label: 'Today', icon: LayoutDashboard, end: true }] },
  { group: 'Recruit', items: [{ to: '/opportunities', label: 'Opportunities & applicants', icon: Briefcase, hint: 'postings candidates shortlist' },
    { to: '/candidates', label: 'Candidates', icon: Users, hint: 'students who opted in' },
    { to: '/pipeline', label: 'Pipeline', icon: ListChecks, hint: 'stages across postings' }] },
  { group: 'Connect', items: [{ to: '/institutions', label: 'Institutions', icon: Building2, hint: 'partnership approval' }] },
  { group: 'Fund', items: [{ to: '/scholarships', label: 'Scholarships', icon: GraduationCap, hint: 'sponsor review' }] },
];

type Inst = { id: string; name: string; status: string };
/** What needs the recruiting team's attention. Every count is from this account's own postings and requests. */
function Today() {
  const [d, setD] = useState<EmployerOutputType | null>(null);
  const [inst, setInst] = useState<Inst[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    employer({ action: 'list' }).then(setD).catch((e) => setErr(msg(e)));
    (employer({ action: 'partners' }) as Promise<{ institutions: Inst[] }>).then((r) => setInst(r.institutions)).catch(() => setInst([]));
  }, []);
  const opps = d?.opportunities ?? [];
  const apps = opps.flatMap((o) => o.applicants);
  const fresh = apps.filter((a) => a.stage === 'New').length;
  const approved = (inst ?? []).filter((i) => i.status === 'Approved').length;
  const pending = (inst ?? []).filter((i) => i.status === 'Pending').length;
  const closing = opps.filter((o) => o.closesOn && (new Date(o.closesOn).getTime() - Date.now()) < 7 * 864e5).length;
  const steps = [
    { done: (inst ?? []).some((i) => i.status !== 'Not requested'), label: 'Ask an institution to approve you', to: '/institutions' },
    { done: approved > 0, label: 'Be approved by at least one institution', to: '/institutions' },
    { done: opps.length > 0, label: 'Post your first opportunity', to: '/opportunities' },
  ];
  const next = fresh ? { text: `${fresh} new application${fresh === 1 ? '' : 's'} to review`, to: '/opportunities' } : steps.find((s) => !s.done) ? { text: steps.find((s) => !s.done)!.label, to: steps.find((s) => !s.done)!.to } : null;
  return (
    <>
      <p className="eyebrow">Employers</p><h1 className="mt-1 text-3xl">Today</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Students see your opportunities only at institutions that approved you, and you see only what each applicant chose to share.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err}</div>}
      {!d && !err ? <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div> : d && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border bg-card p-4 lg:col-span-2"><h2 className="text-lg">Next action</h2>
            {next ? <Link to={next.to} className="mt-1 inline-block text-sm text-primary underline">{next.text}</Link> : <p className="mt-1 text-sm text-muted-foreground">Nothing needs you right now.</p>}</section>
          <section className="rounded-md border border-border bg-card p-4"><h2 className="text-lg">Opportunities</h2>
            <p className="mt-1 text-sm">{opps.length} live · {apps.length} application{apps.length === 1 ? '' : 's'} · {fresh} new{closing ? ` · ${closing} closing within a week` : ''}</p></section>
          <section className="rounded-md border border-border bg-card p-4"><h2 className="text-lg">Institutions</h2>
            <p className="mt-1 text-sm">{inst ? `${approved} approved · ${pending} pending` : 'Loading…'}</p></section>
          <section className="rounded-md border border-border bg-card p-4 lg:col-span-2"><h2 className="text-lg">Setup</h2>
            <ul className="mt-1 space-y-1 text-sm">{steps.map((s) => <li key={s.label}>{s.done ? '✓' : '○'} <Link to={s.to} className="underline-offset-2 hover:underline">{s.label}</Link></li>)}</ul></section>
        </div>
      )}
    </>
  );
}

type Cand = { id: string; name: string; headline: string; program: string; gradYear: number | null; skills: string; roles: string; applications: { posting: string; stage: string }[] };

function Candidates() {
  const [q, setQ] = useState('');
  const [grad, setGrad] = useState('');
  const [d, setD] = useState<{ approvedInstitutions: number; candidates: Cand[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); (employer({ action: 'candidates', query: q, gradYear: grad.trim() === '' ? null : Number(grad) }) as Promise<{ approvedInstitutions: number; candidates: Cand[] }>).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  return (
    <>
      <p className="eyebrow">Employers</p><h1 className="mt-1 text-3xl">Candidates</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Students who chose to be discoverable, at institutions that approved you. You see only the profile each student wrote for discovery — nothing else from their record.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input aria-label="Search candidates" className="max-w-xs" placeholder="Skill, program, role…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input aria-label="Graduation year" className="max-w-[10rem]" inputMode="numeric" placeholder="Grad year" value={grad} onChange={(e) => setGrad(e.target.value)} />
        <Button variant="outline" onClick={load}>Search</Button>
      </div>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-24" /></div>}
      {d && d.approvedInstitutions === 0 && <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No institution has approved you yet. Ask under Institutions — candidate search only covers institutions that approved you.</p>}
      {d && d.approvedInstitutions > 0 && !d.candidates.length && <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No discoverable students match. Students choose whether to be discoverable, so an empty result is normal.</p>}
      {d && d.candidates.length > 0 && <ul className="mt-6 space-y-3">{d.candidates.map((c) => (
        <li key={c.id} className="rounded-md border border-border bg-card p-4">
          <p className="font-medium">{c.name}</p>
          <p className="text-sm">{c.headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">{[c.program, c.gradYear ? `Class of ${c.gradYear}` : null].filter(Boolean).join(' · ')}</p>
          {c.skills && <p className="mt-1 text-xs text-muted-foreground">Skills: {c.skills}</p>}
          {c.roles && <p className="mt-1 text-xs text-muted-foreground">Looking for: {c.roles}</p>}
          {c.applications.length > 0 && <p className="mt-2 text-xs">{c.applications.map((x, i) => <span key={i} className="mr-2 rounded-[3px] border border-border px-1.5 py-0.5">{x.posting}: {x.stage}</span>)}</p>}
        </li>))}</ul>}
    </>
  );
}

type PipeRow = { applicantId: string; name: string; stage: string; postingId: string; postingTitle: string; kind: string; postingVersion: number };

function Pipeline() {
  const [rows, setRows] = useState<PipeRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); (employer({ action: 'pipeline' }) as Promise<{ pipeline: PipeRow[] }>).then((r) => setRows(r.pipeline)).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  const move = async (r: PipeRow, decision: 'Shortlisted' | 'Declined' | 'Reset') => { try { await employer({ action: 'decide', id: r.postingId, applicant: r.applicantId, version: r.postingVersion, decision }); toast(decision === 'Reset' ? 'Moved back to new. The student has been notified in Semester.' : `${decision}. The student has been notified in Semester.`); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  const stages = ['New', 'Shortlisted', 'Declined'] as const;
  return (
    <>
      <p className="eyebrow">Employers</p><h1 className="mt-1 text-3xl">Pipeline</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Every application to your postings, by stage. Moving a candidate notifies the student in Semester.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!rows && !err && <div className="mt-6 space-y-3"><Skeleton className="h-24" /></div>}
      {rows && !rows.length && <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No applications yet. They appear here as students apply to your postings.</p>}
      {rows && rows.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {stages.map((s) => (
            <section key={s} className="rounded-md border border-border bg-card p-3">
              <h2 className="text-sm font-medium">{s} · {rows.filter((r) => r.stage === s).length}</h2>
              <div className="mt-2 space-y-2">
                {rows.filter((r) => r.stage === s).map((r) => (
                  <div key={`${r.postingId}:${r.applicantId}`} className="rounded-[3px] border border-border p-2 text-sm">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.postingTitle} · {r.kind}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s === 'New' && <><Button size="sm" onClick={() => move(r, 'Shortlisted')}>Shortlist</Button><Button size="sm" variant="outline" onClick={() => move(r, 'Declined')}>Decline</Button></>}
                      {s === 'Shortlisted' && <><Button size="sm" variant="outline" onClick={() => move(r, 'Declined')}>Decline</Button><Button size="sm" variant="outline" onClick={() => move(r, 'Reset')}>Back to new</Button></>}
                      {s === 'Declined' && <Button size="sm" variant="outline" onClick={() => move(r, 'Reset')}>Restore to new</Button>}
                    </div>
                  </div>
                ))}
                {rows.filter((r) => r.stage === s).length === 0 && <p className="text-xs text-muted-foreground">Nobody here.</p>}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Opportunities() {
  const [d, setD] = useState<EmployerOutputType | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => { setErr(null); employer({ action: 'list' }).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  const save = async (x: Draft) => { try { await employer({ action: 'save', ...x }); toast(x.id ? 'Saved.' : 'Posted. Students can now apply.'); setEdit(null); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  const decide = async (o: Opp, applicant: string, version: number, decision: 'Shortlisted' | 'Declined' | 'Reset') => { try { await employer({ action: 'decide', id: o.id, applicant, version, decision }); toast(decision === 'Reset' ? 'Moved back to new.' : `${decision}. The student has been notified in Semester.`); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  const remove = async (o: Opp) => { try { await employer({ action: 'delete', id: o.id, version: o.version }); toast('Opportunity removed.'); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Employers</p><h1 className="mt-1 text-3xl">Your opportunities</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Post roles for students, then review who applied. You only see what each applicant chose to make public.</p></div>
          {!edit && <Button onClick={() => setEdit({ title: '', kind: 'Internship', employerName: d?.opportunities?.[0]?.employerName ?? '', description: '', location: '', closesOn: null })}>Post an opportunity</Button>}
        </div>
        {edit && <Editor draft={edit} onSave={save} onCancel={() => setEdit(null)} />}
        {err && <div className="rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
        {!d && !err && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
        {d && !d.opportunities?.length && !edit && <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">You haven’t posted anything yet. Post your first opportunity to reach students.</p>}
        <div className="space-y-4">
          {d?.opportunities?.map((o) => (
            <section key={o.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="eyebrow">{o.kind}</p><h2 className="mt-1 text-lg">{o.title}</h2><p className="text-xs text-muted-foreground">{o.employerName}{o.location ? ` · ${o.location}` : ''}{o.closesOn ? ` · Closes ${o.closesOn}` : ''} · {o.applicants.filter((a) => a.stage === 'Shortlisted').length} shortlisted of {o.applicants.length} applicant{o.applicants.length === 1 ? '' : 's'}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Hide applicants' : 'Applicants'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit({ id: o.id, version: o.version, title: o.title, kind: o.kind as Draft['kind'], employerName: o.employerName, description: o.description, location: o.location, closesOn: o.closesOn })}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="ghost">Remove</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove “{o.title}”?</AlertDialogTitle><AlertDialogDescription>Students will no longer see it, and its applicant list goes with it. This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => remove(o)}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {open === o.id && <div className="mt-4 border-t border-border pt-3"><Applicants o={o} onDecide={(applicant, version, decision) => decide(o, applicant, version, decision)} /></div>}
            </section>
          ))}
        </div>
            </>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-sidebar text-lg text-sidebar-foreground"><Wordmark /></div>;
  return (
    <BrowserRouter>
      <AppShell app="Employers" appKey="employers" institutionName="Employer workspace" role="Recruiter" roles={[]} isSample={false} groups={GROUPS}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/institutions" element={<Partners />} />
          <Route path="/scholarships" element={<Scholarships />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AppShell>
    </BrowserRouter>
  );
}
