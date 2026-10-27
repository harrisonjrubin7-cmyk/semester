import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
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
import { AppSwitcher } from '../../semester/src/components/AppSwitcher';

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
          {a.portfolio.length ? <ul className="mt-2 space-y-1">{a.portfolio.map((p) => <li key={p.id} className="text-xs"><span className="mr-1">○</span>{p.title}{p.file && <a href={p.file} target="_blank" rel="noreferrer" className="ml-2 underline">Open</a>}{p.body && <span className="block text-muted-foreground">{p.body}</span>}</li>)}</ul>
            : <p className="mt-1 text-xs text-muted-foreground">⊘ No public portfolio items. Students choose what employers can see.</p>}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [d, setD] = useState<EmployerOutputType | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'jobs' | 'scholarships'>(() => (location.hash === '#scholarships' ? 'scholarships' : 'jobs'));
  const pick = (t: 'jobs' | 'scholarships') => { setTab(t); history.replaceState(null, '', t === 'scholarships' ? '#scholarships' : '#'); };
  const load = () => { setErr(null); employer({ action: 'list' }).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  useEffect(() => { if (user) load(); }, [user]);
  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-sidebar text-lg text-sidebar-foreground"><Wordmark /></div>;
  const save = async (x: Draft) => { try { await employer({ action: 'save', ...x }); toast(x.id ? 'Saved.' : 'Posted. Students can now apply.'); setEdit(null); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  const decide = async (o: Opp, applicant: string, version: number, decision: 'Shortlisted' | 'Declined' | 'Reset') => { try { await employer({ action: 'decide', id: o.id, applicant, version, decision }); toast(decision === 'Reset' ? 'Moved back to new.' : `${decision}. The student has been notified in Semester.`); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  const remove = async (o: Opp) => { try { await employer({ action: 'delete', id: o.id, version: o.version }); toast('Opportunity removed.'); load(); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sm text-sidebar-foreground md:px-8">
        <span className="font-display tracking-[0.3em]">SEMESTER <span className="ml-2 text-xs tracking-normal opacity-60">Employers</span></span>
        <span className="flex items-center gap-3 text-xs"><span className="hidden sm:inline">{user.email}</span><button onClick={() => logout()} className="underline">Sign out</button></span>
      </header>
      <nav aria-label="Employer sections" className="mx-auto flex max-w-5xl gap-1 px-4 pt-4 md:px-8">
        {([['jobs', 'Opportunities'], ['scholarships', 'Scholarships']] as const).map(([k, l]) => (
          <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => pick(k)} className={`rounded px-3 py-2 text-sm ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>))}
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {tab === 'scholarships' ? <Scholarships /> : <>
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
        </>}
      </main>
      <AppSwitcher current="employers" /><Toaster />
    </div>
  );
}
