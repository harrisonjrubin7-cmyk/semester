import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth, loginWithRedirect } from 'zitejs/auth';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Compass, PenLine } from 'lucide-react';
import { AppShell, type NavGroup } from '../../semester/src/components/AppShell';
import RecommendationsToWrite, { ApplicantRecommendations } from './Recommendations';
import { applications, ApplicationsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Toaster } from '@project/components/ui/sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Wordmark } from '@project/components/brand/Mark';

type D = NonNullable<ApplicationsOutputType>;
type App = NonNullable<D['applications']>[number];
const GL: Record<string, string> = { Draft: '○', Submitted: '…', 'Under Review': '…', Admitted: '✓', Waitlisted: '?', Declined: '!', Withdrawn: '⊘' };
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That didn’t work');

// Arriving from a published program on the public site (?institution=…&program=…): keep the choice through sign-in.
const START_KEY = 'semester.applicants.start';
function startChoice(): { institutionId: string; program: string } | null {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('institution')) sessionStorage.setItem(START_KEY, JSON.stringify({ institutionId: q.get('institution'), program: (q.get('program') ?? '').slice(0, 120) }));
    const v = sessionStorage.getItem(START_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
const clearStart = () => { try { sessionStorage.removeItem(START_KEY); history.replaceState(null, '', location.pathname); } catch { /* storage unavailable */ } };
const START = startChoice();

const toB64 = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => bad(r.error); r.readAsDataURL(f); });
async function openDoc(appId: string, fileId: string) {
  const r = await applications({ action: 'openDocument', id: appId, fileId }) as { name: string; mime: string; base64: string };
  const bin = atob(r.base64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  window.open(URL.createObjectURL(new Blob([u8], { type: r.mime })), '_blank', 'noopener');
}

function Editor({ d, app, onDone }: { d: D; app: App | null; onDone: () => void }) {
  const [f, setF] = useState({ institutionId: app?.institutionId ?? (START && (d.institutions ?? []).some((i) => i.id === START.institutionId) ? START.institutionId : ''), program: app?.program ?? (START?.program ?? ''), entryTerm: app?.entryTerm ?? 'Fall 2027', statement: app?.statement ?? '' });
  const [docs, setDocs] = useState(app?.documents ?? []);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await applications({ action: 'save', id: app?.id, ...f }); toast('Draft saved. Only you can see it until you submit.'); onDone(); } catch (e) { toast(`! ${msg(e)}`); } setBusy(false); };
  const add = async (file: File) => {
    if (!app) return;
    setBusy(true);
    try { const r = await applications({ action: 'addDocument', id: app.id, name: file.name, mime: file.type || 'application/octet-stream', base64: await toB64(file) }) as { fileId: string }; setDocs((x) => [...x, { fileId: r.fileId, filename: file.name }]); toast('Document checked and stored privately.'); }
    catch (e) { toast(`! ${msg(e)}`); } finally { setBusy(false); }
  };
  const remove = async (fileId: string) => { if (!app) return; try { await applications({ action: 'removeDocument', id: app.id, fileId }); setDocs((x) => x.filter((y) => y.fileId !== fileId)); } catch (e) { toast(`! ${msg(e)}`); } };
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <p className="eyebrow">{app ? 'Edit draft' : 'New application'}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select value={f.institutionId} onValueChange={(v) => setF({ ...f, institutionId: v })}>
          <SelectTrigger aria-label="Institution"><SelectValue placeholder="Institution" /></SelectTrigger>
          <SelectContent>{(d.institutions ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}{i.sample ? ' · ◌ Sample' : ''}</SelectItem>)}</SelectContent>
        </Select>
        <Input aria-label="Program" placeholder="Program, e.g. Computer Science BS" value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} />
        <Input aria-label="Entry term" placeholder="Entry term" value={f.entryTerm} onChange={(e) => setF({ ...f, entryTerm: e.target.value })} />
      </div>
      <Textarea aria-label="Personal statement" className="mt-3 min-h-40" placeholder="Personal statement (at least 200 characters)" value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} />
      <p className="mt-1 text-xs text-muted-foreground">{f.statement.length} characters</p>
      <div className="mt-3 text-sm">
        {docs.map((doc) => <p key={doc.fileId} className="flex justify-between border-b border-border py-1.5"><button className="underline" onClick={() => app && openDoc(app.id, doc.fileId).catch((e) => toast(`! ${msg(e)}`))}>{doc.filename}</button><button className="text-xs text-muted-foreground" onClick={() => remove(doc.fileId)}>Remove</button></p>)}
        {app ? <label className="mt-2 inline-block cursor-pointer rounded-sm border border-dashed border-border px-3 py-2 text-xs">{busy ? 'Working…' : '+ Add transcript or document'}
          <input type="file" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) add(file); e.target.value = ''; }} />
        </label> : <p className="mt-2 text-xs text-muted-foreground">Save the draft first, then add documents.</p>}
        <p className="mt-1 text-xs text-muted-foreground">Documents are checked for safety and stored privately. Only you can open them; admissions staff at this institution can open them after you submit.</p>
        {app && app.legacyDocuments.length > 0 && <p className="mt-1 text-xs">Earlier uploads ({app.legacyDocuments.join(', ')}) were stored at a public link and are not sent with your application. Add them again here.</p>}
      </div>
      <div className="mt-4 flex gap-2"><Button disabled={!f.institutionId || busy} onClick={save}>Save draft</Button><Button variant="ghost" onClick={onDone}>Cancel</Button></div>
    </section>
  );
}

type Pkg = { package: { recipient: { institution: string }; program: string; entryTerm: string; statement: string; documents: { filename: string }[] }; sha: string; mode: 'native' | 'planning'; notice: string };
function Card({ a, onEdit, reload }: { a: App; onEdit: () => void; reload: () => void }) {
  const [confirm, setConfirm] = useState<'submit' | 'withdraw' | null>(null);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const review = async () => { try { setPkg(await applications({ action: 'preview', id: a.id }) as Pkg); setAttested(false); setConfirm('submit'); } catch (e) { toast(`! ${msg(e)}`); } };
  const run = async () => {
    setBusy(true);
    try {
      if (confirm === 'submit') {
        const r = await applications({ action: 'submit', id: a.id, previewSha: pkg!.sha, attested, requestKey: `apply-${a.id}-${pkg!.sha.slice(0, 16)}` }) as { receipt: string };
        toast(`Received by ${a.institution}. Receipt ${r.receipt}.`);
      } else { await applications({ action: 'withdraw', id: a.id }); toast('Application withdrawn.'); }
      reload(); setConfirm(null);
    } catch (e) { toast(`! ${msg(e)}`); } finally { setBusy(false); }
  };
  const open = !['Admitted', 'Declined', 'Withdrawn'].includes(a.status);
  const dims = a.dimensions;
  return (
    <article className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="eyebrow">{a.institution} · {a.entryTerm}</p><h2 className="text-lg">{a.program || 'Program not chosen'}</h2></div>
        <span className="rounded-[3px] border border-border px-2 py-0.5 text-xs">{GL[a.status] ?? '○'} {a.status}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{a.notice}</p>
      {dims && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">{([['Preparation', dims.preparation], ['Delivery', dims.delivery], ['Processing', dims.processing], ['Decision', dims.decision]] as const).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>}
      {a.receipt && <p className="mt-2 text-xs">◆ Receipt {a.receipt.code} · package version {a.receipt.version} · received {format(new Date(a.receipt.receivedAt), 'EEE d MMM · HH:mm')}</p>}
      {a.status === 'Draft' && <ul className="mt-3 space-y-1 text-sm">{a.checklist.map((c) => <li key={c.label}>{c.done ? '✓' : '○'} {c.label}</li>)}</ul>}
      <ApplicantRecommendations applicationId={a.id} open={!['Withdrawn', 'Admitted', 'Declined'].includes(a.status)} />
      {a.decisionNote && <p className="mt-3 border-l-2 border-border pl-3 text-sm">{a.decisionNote}<span className="block text-xs text-muted-foreground">◆ From admissions</span></p>}
      {a.status === 'Admitted' && <p className="mt-3 rounded-sm border border-border p-3 text-sm">✓ Your student membership is active. Sign in to Semester with this same account to open your student workspace.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {a.status === 'Draft' && <><Button size="sm" onClick={review}>Review &amp; submit</Button><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button></>}
        {open && a.status !== 'Draft' && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm('withdraw')}>Withdraw</Button>}
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'submit' ? `Submit to ${a.institution}?` : `Withdraw from ${a.institution}?`}</AlertDialogTitle>
            <AlertDialogDescription asChild><div className="space-y-2 text-sm">
              {confirm === 'submit' && pkg ? <>
                <p>{pkg.notice}</p>
                <p className="font-medium">Exactly what {pkg.package.recipient.institution} receives:</p>
                <ul className="list-disc pl-5"><li>Program: {pkg.package.program} · {pkg.package.entryTerm}</li><li>Statement: {pkg.package.statement.length} characters</li><li>Documents: {pkg.package.documents.map((d) => d.filename).join(', ')}</li></ul>
                <p>Nothing else in your account is shared. You can withdraw later, but not edit after submitting.</p>
                {pkg.mode === 'native' ? <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={attested} onChange={(e) => setAttested(e.target.checked)} />This application is my own work and is accurate.</label>
                  : <p className="font-medium">This institution does not take applications through Semester, so it can’t be submitted here.</p>}
              </> : <><p><b>What happens:</b> your application closes and admissions stops reviewing it.</p><p><b>Taking it back:</b> this can’t be undone here. Start a new application if you change your mind.</p></>}
            </div></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep {confirm === 'submit' ? 'editing' : 'application'}</AlertDialogCancel>
            <Button disabled={busy || (confirm === 'submit' && (!pkg || pkg.mode !== 'native' || !attested))} onClick={run}>{confirm === 'submit' ? 'Submit this package' : 'Withdraw — confirm'}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

const GROUPS: NavGroup[] = [
  { group: null, items: [{ to: '/', label: 'Today', icon: LayoutDashboard, end: true }] },
  { group: 'Explore', items: [{ to: '/programs', label: 'Programs', icon: Compass, hint: 'institutions published programs' }] },
  { group: 'Apply', items: [{ to: '/applications', label: 'Applications', icon: FileText, hint: 'drafts submitted decisions' },
    { to: '/recommendations', label: 'Recommendations to write', icon: PenLine, hint: 'recommender letters' }] },
];

function useApps() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); applications({ action: 'list' }).then(setD).catch((e) => setErr(msg(e))); };
  useEffect(load, []);
  return { d, err, load };
}

/** What to do next, and why (S-90 §4). Built only from this applicant's own applications. */
function Today() {
  const { d, err, load } = useApps();
  const apps = d?.applications ?? [];
  const drafts = apps.filter((a) => a.status === 'Draft');
  const ready = drafts.find((a) => a.checklist.every((c) => c.done) && a.mode === 'native');
  const incomplete = drafts.find((a) => a.checklist.some((c) => !c.done));
  const decided = apps.filter((a) => ['Admitted', 'Waitlisted', 'Declined'].includes(a.status));
  const next = ready ? { text: `Review and submit ${ready.program} at ${ready.institution}`, why: 'Every requirement is complete and this institution takes applications through Semester.' }
    : incomplete ? { text: `Finish ${incomplete.program || 'your application'} at ${incomplete.institution}`, why: `Still missing: ${incomplete.checklist.filter((c) => !c.done).map((c) => c.label.toLowerCase()).join(', ')}.` }
    : !apps.length ? { text: 'Explore programs and start an application', why: 'You have no applications yet.' } : null;
  return (
    <>
      <p className="eyebrow">Applicants</p><h1 className="mt-1 text-3xl">Today</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Your application work. Official status comes only from each institution.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!d && !err ? <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div> : d && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border bg-card p-4 lg:col-span-2"><h2 className="text-lg">Next</h2>
            {next ? <><Link to={next.text.startsWith('Explore') ? '/programs' : '/applications'} className="mt-1 inline-block text-sm text-primary underline">{next.text}</Link><p className="text-xs text-muted-foreground">{next.why}</p></> : <p className="mt-1 text-sm text-muted-foreground">Nothing needs you right now.</p>}</section>
          <section className="rounded-md border border-border bg-card p-4"><h2 className="text-lg">Your work</h2><p className="mt-1 text-sm">{drafts.length} draft{drafts.length === 1 ? '' : 's'} · {apps.filter((a) => a.receipt).length} received by institutions</p></section>
          <section className="rounded-md border border-border bg-card p-4"><h2 className="text-lg">Recent decisions</h2>{decided.length ? <ul className="mt-1 text-sm">{decided.map((a) => <li key={a.id}>{a.institution}: {a.status}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">No decisions released.</p>}</section>
        </div>
      )}
    </>
  );
}

type Prog = { id: number; institutionId: string; institution: string; name: string; summary: string; entryTerms: string; accepting: boolean; annualCostCents: number | null; durationText: string; format: string; requirements: string; shortlisted: boolean };
const money = (cents: number | null) => (cents == null ? 'Not published' : `$${(cents / 100).toLocaleString('en-US')}`);
function Programs() {
  const [rows, setRows] = useState<Prog[] | null>(null);
  const [q, setQ] = useState('');
  const [inst, setInst] = useState('all');
  const [formatF, setFormatF] = useState('all');
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const load = () => (applications({ action: 'programs' }) as Promise<{ programs: Prog[] }>).then((r) => setRows(r.programs)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const start = (p: Prog) => { try { sessionStorage.setItem(START_KEY, JSON.stringify({ institutionId: p.institutionId, program: p.name })); } catch { /* storage unavailable */ } location.assign('/applications'); };
  const toggle = async (p: Prog) => {
    setRows((rs) => rs?.map((x) => (x.id === p.id ? { ...x, shortlisted: !x.shortlisted } : x)) ?? rs);
    try { await applications({ action: p.shortlisted ? 'shortlistRemove' : 'shortlistAdd', programId: p.id }); }
    catch (e) { toast.error(msg(e)); load(); }
  };
  const needle = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((p) => (inst === 'all' || p.institution === inst) && (formatF === 'all' || p.format === formatF) && (!acceptingOnly || p.accepting)
    && (!needle || `${p.name} ${p.institution} ${p.summary} ${p.requirements}`.toLowerCase().includes(needle)));
  const shortlist = (rows ?? []).filter((p) => p.shortlisted);
  const compared = shortlist.slice(0, 4);
  const insts = [...new Set((rows ?? []).map((p) => p.institution))].sort();
  const sel = 'rounded-[3px] border border-input bg-background p-2 text-sm';
  const cmpRows: { label: string; get: (p: Prog) => string }[] = [
    { label: 'Institution', get: (p) => p.institution },
    { label: 'Published annual cost', get: (p) => money(p.annualCostCents) },
    { label: 'Duration', get: (p) => p.durationText || 'Not stated' },
    { label: 'Format', get: (p) => p.format || 'Not stated' },
    { label: 'Entry terms', get: (p) => p.entryTerms || 'Not stated' },
    { label: 'Requirements', get: (p) => p.requirements || 'Not stated' },
    { label: 'Accepting', get: (p) => (p.accepting ? 'Yes' : 'Not right now') },
  ];
  return (
    <>
      <p className="eyebrow">Explore</p><h1 className="mt-1 text-3xl">Programs</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Programs institutions published on Semester. Each institution sets its own requirements and decides on applications. Costs and details below are published by the institutions themselves — Semester does not set or verify them, so confirm in the official catalog before you apply.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input aria-label="Search programs" className="max-w-xs" placeholder="Search name, institution, topic…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Institution" className={sel} value={inst} onChange={(e) => setInst(e.target.value)}><option value="all">All institutions</option>{insts.map((i) => <option key={i} value={i}>{i}</option>)}</select>
        <select aria-label="Format" className={sel} value={formatF} onChange={(e) => setFormatF(e.target.value)}><option value="all">Any format</option><option>On campus</option><option>Online</option><option>Hybrid</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acceptingOnly} onChange={(e) => setAcceptingOnly(e.target.checked)} />Accepting applications</label>
      </div>
      {!rows ? <div className="mt-6 space-y-3"><Skeleton className="h-24" /></div> : !rows.length ? <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No institution has published a program yet. You can still prepare an application to any institution and submit it through that institution’s own channel.</p> : !shown.length ? <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No published program matches those filters.</p> : (
        <ul className="mt-6 space-y-3">{shown.map((p) => (
          <li key={p.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="eyebrow">{p.institution}</p><h2 className="text-lg">{p.name}</h2></div>
              <Button size="sm" variant={p.shortlisted ? 'default' : 'outline'} onClick={() => toggle(p)}>{p.shortlisted ? '★ Shortlisted' : '☆ Shortlist'}</Button>
            </div>
            {p.entryTerms && <p className="text-xs text-muted-foreground">Entry: {p.entryTerms}</p>}
            <p className="mt-1 text-sm">{p.summary}</p>
            {(p.annualCostCents != null || p.durationText || p.format) && <p className="mt-1 text-xs text-muted-foreground">{[p.annualCostCents != null ? `${money(p.annualCostCents)} / year (published)` : null, p.durationText || null, p.format || null].filter(Boolean).join(' · ')}</p>}
            {p.requirements && <p className="mt-1 text-xs text-muted-foreground">Requirements: {p.requirements}</p>}
            {p.accepting ? <Button size="sm" className="mt-2" onClick={() => start(p)}>Start an application</Button> : <p className="mt-2 text-xs text-muted-foreground">Not accepting applications right now.</p>}
          </li>))}</ul>
      )}
      {compared.length >= 2 && (
        <div className="mt-8">
          <h2 className="text-xl">Compare your shortlist</h2>
          <p className="mt-1 text-xs text-muted-foreground">Side by side, exactly as published. {shortlist.length > 4 ? 'Showing the first 4 of your shortlist.' : ''} Costs are annual figures published by each institution; confirm them in the official catalog before applying.</p>
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead><tr className="bg-card text-left"><th className="p-2" />{compared.map((p) => <th key={p.id} className="p-2 font-medium">{p.name}</th>)}</tr></thead>
              <tbody>{cmpRows.map((r) => <tr key={r.label} className="border-t border-border"><td className="p-2 text-xs text-muted-foreground">{r.label}</td>{compared.map((p) => <td key={p.id} className="p-2 align-top">{r.get(p)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {compared.length === 1 && <p className="mt-6 text-sm text-muted-foreground">Shortlist one more program to compare them side by side.</p>}
    </>
  );
}

function Applications() {
  const { d, err, load } = useApps();
  const [editing, setEditing] = useState<App | 'new' | null>(null);
  const start = startChoice();
  useEffect(() => { if (d && start && !editing) { setEditing('new'); clearStart(); } }, [d]);
  return (
    <>
      <p className="eyebrow">Apply</p>
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="mt-1 text-3xl">Applications</h1>{d && !editing && <Button onClick={() => setEditing('new')}>Start an application</Button>}</div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Drafts are only visible to you. Each application shows how its institution accepts applications, and official status comes only from that institution.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
      {d && <div className="mt-6 space-y-4">
        {editing && <Editor d={d} app={editing === 'new' ? null : editing} onDone={() => { setEditing(null); load(); }} />}
        {!editing && (d.applications?.length ? d.applications.map((a) => <Card key={a.id} a={a} onEdit={() => setEditing(a)} reload={load} />)
          : <div className="rounded-md border border-dashed border-border p-6 text-sm"><p className="font-medium">No applications yet</p><p className="mt-1 text-muted-foreground">Start one to choose an institution, write your statement and upload a transcript.</p></div>)}
      </div>}
    </>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-sidebar text-lg text-sidebar-foreground"><Wordmark /></div>;
  // Arriving with a program choice from the public site goes straight to a new application.
  const landing = START ? '/applications' : '/';
  return (
    <BrowserRouter>
      <AppShell app="Applicants" appKey="applicants" institutionName="Applicant workspace" role="Applicant" roles={[]} isSample={false} groups={GROUPS}>
        <Routes>
          <Route path="/" element={landing === '/' ? <Today /> : <Navigate to="/applications" replace />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/recommendations" element={<RecommendationsToWrite />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AppShell>
    </BrowserRouter>
  );
}
