import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { useUpload } from 'zitejs/upload';
import { applications, ApplicationsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Toaster } from '@project/components/ui/sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Wordmark } from '@project/components/brand/Mark';
import { AppSwitcher } from '../../semester/src/components/AppSwitcher';

type D = NonNullable<ApplicationsOutputType>;
type App = NonNullable<D['applications']>[number];
const GL: Record<string, string> = { Draft: '○', Submitted: '…', 'Under Review': '…', Admitted: '✓', Waitlisted: '?', Declined: '!', Withdrawn: '⊘' };
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That didn’t work');

function Editor({ d, app, onDone }: { d: D; app: App | null; onDone: () => void }) {
  const [f, setF] = useState({ institutionId: app?.institutionId ?? '', program: app?.program ?? '', entryTerm: app?.entryTerm ?? 'Fall 2027', statement: app?.statement ?? '', documents: app?.documents ?? [] });
  const { upload, isUploading } = useUpload();
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await applications({ action: 'save', id: app?.id, ...f }); toast('Draft saved. Only you can see it until you submit.'); onDone(); } catch (e) { toast(`! ${msg(e)}`); } setBusy(false); };
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <p className="eyebrow">{app ? 'Edit draft' : 'New application'}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select value={f.institutionId} onValueChange={(v) => setF({ ...f, institutionId: v })}>
          <SelectTrigger><SelectValue placeholder="Institution" /></SelectTrigger>
          <SelectContent>{(d.institutions ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}{i.sample ? ' · ◌ Sample' : ''}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Program, e.g. Computer Science BS" value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} />
        <Input placeholder="Entry term" value={f.entryTerm} onChange={(e) => setF({ ...f, entryTerm: e.target.value })} />
      </div>
      <Textarea className="mt-3 min-h-40" placeholder="Personal statement (at least 200 characters)" value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} />
      <p className="mt-1 text-xs text-muted-foreground">{f.statement.length} characters</p>
      <div className="mt-3 text-sm">
        {f.documents.map((doc, i) => <p key={i} className="flex justify-between border-b border-border py-1.5"><a className="underline" href={doc.url} target="_blank" rel="noreferrer">{doc.filename}</a><button className="text-xs text-muted-foreground" onClick={() => setF({ ...f, documents: f.documents.filter((_, j) => j !== i) })}>Remove</button></p>)}
        <label className="mt-2 inline-block cursor-pointer rounded-sm border border-dashed border-border px-3 py-2 text-xs">{isUploading ? 'Uploading…' : '+ Upload transcript or document'}
          <input type="file" className="hidden" disabled={isUploading} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const { url } = await upload(file); setF((p) => ({ ...p, documents: [...p.documents, { url, filename: file.name }] })); } catch (err) { toast(`! ${msg(err)}`); } }} />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">{"Demo only: uploaded files are stored at an unlisted link, and anyone who has the link can open them. Don't upload real or private documents."}</p>
      </div>
      <div className="mt-4 flex gap-2"><Button disabled={!f.institutionId || busy} onClick={save}>Save draft</Button><Button variant="ghost" onClick={onDone}>Cancel</Button></div>
    </section>
  );
}

function Card({ a, onEdit, reload }: { a: App; onEdit: () => void; reload: () => void }) {
  const [confirm, setConfirm] = useState<'submit' | 'withdraw' | null>(null);
  const run = async () => { try { await applications({ action: confirm!, id: a.id }); toast(confirm === 'submit' ? `Submitted to ${a.institution}. Next: watch for a decision here.` : 'Application withdrawn.'); reload(); } catch (e) { toast(`! ${msg(e)}`); } setConfirm(null); };
  const open = !['Admitted', 'Declined', 'Withdrawn'].includes(a.status);
  return (
    <article className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="eyebrow">{a.institution} · {a.entryTerm}</p><h2 className="text-lg">{a.program || 'Program not chosen'}</h2></div>
        <span className="rounded-[3px] border border-border px-2 py-0.5 text-xs">{GL[a.status] ?? '○'} {a.status}</span>
      </div>
      {a.submittedAt && <p className="mt-1 text-xs text-muted-foreground">Submitted {format(new Date(a.submittedAt), 'EEE d MMM · HH:mm')}</p>}
      {a.status === 'Draft' && <ul className="mt-3 space-y-1 text-sm">{a.checklist.map((c) => <li key={c.label}>{c.done ? '✓' : '○'} {c.label}</li>)}</ul>}
      {a.decisionNote && <p className="mt-3 border-l-2 border-border pl-3 text-sm">{a.decisionNote}<span className="block text-xs text-muted-foreground">◆ From admissions</span></p>}
      {a.status === 'Admitted' && <p className="mt-3 rounded-sm border border-border p-3 text-sm">✓ Your student membership is active. Sign in to Semester with this same email to open your student workspace.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {a.status === 'Draft' && <><Button size="sm" onClick={() => setConfirm('submit')}>Review &amp; submit</Button><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button></>}
        {open && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm('withdraw')}>Withdraw</Button>}
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'submit' ? `Submit to ${a.institution}?` : `Withdraw from ${a.institution}?`}</AlertDialogTitle>
            <AlertDialogDescription asChild><div className="space-y-2 text-sm">
              {confirm === 'submit' ? <><p><b>What happens:</b> admissions at {a.institution} can read your statement and documents.</p><p><b>What stays the same:</b> nothing else in your account is shared.</p><p><b>Taking it back:</b> you can withdraw, but you can’t edit after submitting.</p></>
                : <><p><b>What happens:</b> your application closes and admissions stops reviewing it.</p><p><b>Taking it back:</b> this can’t be undone here. Start a new application if you change your mind.</p></>}
            </div></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep {confirm === 'submit' ? 'editing' : 'application'}</AlertDialogCancel><AlertDialogAction onClick={run}>{confirm === 'submit' ? 'Submit — confirm' : 'Withdraw — confirm'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<App | 'new' | null>(null);
  const load = () => { setErr(null); applications({ action: 'list' }).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  useEffect(() => { if (user) load(); }, [user]);
  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-sidebar text-lg text-sidebar-foreground"><Wordmark /></div>;
  return (
    <div className="min-h-screen bg-background">
      <AppSwitcher current="applicants" /><Toaster />
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sm text-sidebar-foreground md:px-8">
        <span className="font-display tracking-[0.3em]">SEMESTER <span className="ml-2 text-xs tracking-normal opacity-60">Applicants</span></span>
        <span className="flex items-center gap-3 text-xs"><span className="hidden sm:inline">{user.email}</span><button onClick={() => logout()} className="underline">Sign out</button></span>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <p className="eyebrow">Applicants</p>
        <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="mt-1 text-3xl">Your applications</h1>{d && !editing && <Button onClick={() => setEditing('new')}>Start an application</Button>}</div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Drafts are only visible to you. Each institution decides in its own admissions system; Semester shows the status it sends back.</p>
        {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
        {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
        {d && <div className="mt-6 space-y-4">
          {editing && <Editor d={d} app={editing === 'new' ? null : editing} onDone={() => { setEditing(null); load(); }} />}
          {!editing && (d.applications?.length ? d.applications.map((a) => <Card key={a.id} a={a} onEdit={() => setEditing(a)} reload={load} />)
            : <div className="rounded-md border border-dashed border-border p-6 text-sm"><p className="font-medium">No applications yet</p><p className="mt-1 text-muted-foreground">Start one to choose an institution, write your statement and upload a transcript.</p></div>)}
        </div>}
      </main>
    </div>
  );
}
