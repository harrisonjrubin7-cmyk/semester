import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuth, loginWithRedirect } from 'zitejs/auth';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, CalendarDays } from 'lucide-react';
import { AppShell, type NavGroup } from '../../semester/src/components/AppShell';
import { familyView, FamilyViewOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Toaster } from '@project/components/ui/sonner';
import { toast } from 'sonner';
import { Skeleton } from '@project/components/ui/skeleton';
import { cn } from '@project/components/lib/utils';
import { Wordmark } from '@project/components/brand/Mark';

const G: Record<string, string> = { Official: '◆', Connected: '⇄', 'Made Here': '◇', Yours: '○', Sample: '◌', 'AI Assisted': '✦' };
const Tag = ({ s }: { s: string }) => <span className={cn('inline-flex gap-1 rounded-[3px] border border-border px-1.5 text-[11px] text-muted-foreground', s === 'Sample' && 'border-dashed')}>{G[s] ?? '○'} {s}</span>;
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-md border border-border bg-card p-4"><h2 className="mb-3 text-lg">{title}</h2>{children}</section>;
const NotShared = ({ what }: { what: string }) => <p className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">⊘ {what} not shared with you.</p>;

function Note({ studentId, name }: { studentId: string; name: string }) {
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); try { await familyView({ studentId, note: t.trim() }); toast(`Sent to ${name}’s Semester notifications.`); setT(''); } catch (e) { toast(`! ${e instanceof Error ? e.message : 'Not sent'}`); } finally { setBusy(false); } };
  return (
    <Panel title={`Send ${name} a note`}>
      <Textarea rows={3} maxLength={1000} placeholder="A short message. It appears in their Semester notifications." value={t} onChange={(e) => setT(e.target.value)} />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>Notes can’t reach offices or change anything on the record.</span><Button size="sm" disabled={!t.trim() || busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</Button></div>
    </Panel>
  );
}

type Data = FamilyViewOutputType;
const GROUPS: NavGroup[] = [
  { group: null, items: [{ to: '/', label: 'Today', icon: LayoutDashboard, end: true }] },
  { group: 'Shared with you', items: [{ to: '/shared', label: 'Shared record', icon: Users, hint: 'grades holds calendar billing' },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays, hint: 'classes deadlines key dates' }] },
  { group: 'Access', items: [{ to: '/access', label: 'Sharing & access history', icon: ShieldCheck, hint: 'permissions expiry views' }] },
];
const day = (s?: string | null) => (s ? format(new Date(s), 'd MMM yyyy') : '—');

function useFamily(sid?: string) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); familyView({ studentId: sid }).then(setD).catch((e) => setErr(e instanceof Error ? e.message : 'This didn’t load')); };
  useEffect(load, [sid]);
  return { d, err, load };
}

/** The privacy-first empty state, with how sharing works. Never a way to find or pressure a student. */
function NothingShared() {
  return (
    <div className="mt-6 rounded-md border border-border bg-card p-6 text-sm">
      <p className="font-medium">○ Nothing has been shared with you yet</p>
      <p className="mt-1 text-muted-foreground">Students choose what to share and when access ends. Ask your student to open Semester → You → Privacy → Share with family and invite the email you signed in with. The invitation appears here for you to accept.</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>Every category starts off: grades, holds, calendar and billing are each chosen separately.</li>
        <li>Access ends on the date the student sets, and they can stop it at any time.</li>
        <li>The student can see each time you view what they shared.</li>
      </ul>
    </div>
  );
}

type Inv = { id: number; student: string; categories: string[]; expiresOn: string; invitedAt: string };
/** Invitations sent to the email this account signed in with. Nothing is visible until accepted. */
function Invitations({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<Inv[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = () => { (familyView({ invitations: true }) as Promise<{ invitations: Inv[] }>).then((r) => setRows(r.invitations)).catch(() => setRows([])); };
  useEffect(load, []);
  const answer = async (id: number, accept: boolean) => {
    setBusy(id);
    try { await familyView({ respond: { id, accept } }); toast(accept ? 'Accepted. You can now see what was shared.' : 'Declined. Nothing was shared.'); load(); onChange(); }
    catch (e) { toast(`! ${e instanceof Error ? e.message : 'That didn’t work'}`); } finally { setBusy(null); }
  };
  if (!rows || !rows.length) return null;
  return (
    <div className="mt-6"><Panel title="Invitations">
      <ul className="space-y-3 text-sm">{rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
          <span><span className="font-medium">{r.student}</span> invites you to see {r.categories.join(', ').toLowerCase()} until {day(r.expiresOn)}. They will see each time you look.</span>
          <span className="flex gap-2"><Button size="sm" disabled={busy === r.id} onClick={() => answer(r.id, true)}>Accept</Button>
            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => answer(r.id, false)}>Decline</Button></span>
        </li>))}</ul>
    </Panel></div>
  );
}

function Today() {
  const { d, err, load } = useFamily();
  const v = d?.view;
  const soon = v?.expiresOn && (new Date(v.expiresOn).getTime() - Date.now()) < 7 * 864e5;
  return (
    <>
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 text-3xl">Today</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Only what a student chose to share with you, while their sharing is active.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Try again</Button></div>}
      {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div>}
      <Invitations onChange={load} />
      {d && !v && <NothingShared />}
      {d && v && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="Sharing">
            <p className="text-sm">{(d.students ?? []).length === 1 ? `${v.name} shares ${v.categories.join(', ')} with you.` : `${(d.students ?? []).length} students share with you.`}</p>
            <p className={cn('mt-1 text-sm', soon ? 'font-medium' : 'text-muted-foreground')}>{v.expiresOn ? `Until ${day(v.expiresOn)}${soon ? ' — ending within a week' : ''}` : 'No end date'}</p>
            <Link to="/shared" className="mt-2 inline-block text-sm text-primary underline">Open the shared record</Link>
          </Panel>
          <Panel title="Next up">{v.upcoming ? (v.upcoming.length ? <p className="text-sm">{v.upcoming[0].title} · {day(v.upcoming[0].dueAt)}</p> : <p className="text-sm text-muted-foreground">Nothing coming up in what is shared.</p>) : <NotShared what="The calendar is" />}</Panel>
          {v.holds && v.holds.length > 0 && <Panel title="Needs attention"><p className="text-sm">{v.holds.length} hold{v.holds.length === 1 ? '' : 's'} on the record. Only the owning office can lift a hold.</p></Panel>}
          {v.billing && v.billing.some((b: { balance: number }) => b.balance > 0) && <Panel title="Balance due"><p className="text-sm">{v.billing.filter((b: { balance: number }) => b.balance > 0).map((b: { term: string; balance: number; nextDue: string | null }) => `${b.term}: ${b.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}${b.nextDue ? ` by ${day(b.nextDue)}` : ''}`).join(' · ')}</p></Panel>}
        </div>
      )}
    </>
  );
}

function Shared() {
  const [sid, setSid] = useState<string | undefined>();
  const { d, err } = useFamily(sid);
  const v = d?.view;
  return (
    <>
        <p className="eyebrow">Family</p>
        <h1 className="mt-1 text-3xl">{v ? `${v.name}’s shared record` : 'Shared with you'}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">You see only what a student chose to share, until the date they set. They can see each time you look, and can stop sharing at any time.</p>
        {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={() => setSid(sid)}>Try again</Button></div>}
        {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>}
        {d && !v && <NothingShared />}
        {d && v && (
          <>
            {(d.students ?? []).length > 1 && <div className="mt-4 flex flex-wrap gap-2">{(d.students ?? []).map((s: { id: string; name: string }) => <Button key={s.id} size="sm" variant={s.id === v.id ? 'default' : 'outline'} onClick={() => setSid(s.id)}>{s.name}</Button>)}</div>}
            <p className="mt-4 rounded-[3px] border border-border bg-accent px-3 py-2 text-xs text-accent-foreground">Shared: {v.categories.join(', ')} · until {v.expiresOn ? format(new Date(v.expiresOn), 'EEE d MMM yyyy') : 'revoked'} · This view is recorded in {v.name}’s access history</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {v.billing && <div className="lg:col-span-2"><Panel title="Account balance">{v.billing.length ? <table className="w-full text-sm"><caption className="sr-only">Balance by term</caption><thead><tr className="text-left text-muted-foreground"><th className="py-1 font-normal">Term</th><th className="font-normal">Balance</th><th className="font-normal">Next due</th></tr></thead><tbody>{v.billing.map((b: { term: string; balance: number; nextDue: string | null }) => <tr key={b.term} className="border-t border-border"><td className="py-1.5">{b.term}</td><td>{b.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td><td>{b.nextDue ?? '—'}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">No charges on the account.</p>}<p className="mt-2 text-xs text-muted-foreground">Shared by the student: totals only. Payments are made by the student through the institution.</p></Panel></div>}
              <Panel title="Holds">{v.holds ? (v.holds.length ? v.holds.map((h: { id: string; title: string; office: string; source: string }) => <p key={h.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>! {h.title}<span className="block text-xs text-muted-foreground">Owned by {h.office}. Only {v.name} or that office can resolve it.</span></span><Tag s={h.source} /></p>) : <p className="text-sm text-muted-foreground">✓ No holds.</p>) : <NotShared what="Holds" />}</Panel>
              <Panel title="Coming up">{v.upcoming ? (v.upcoming.length ? v.upcoming.map((t: { id: string; title: string; dueAt: string | null; done: boolean; source: string }) => <p key={t.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>{t.done ? '✓' : '○'} {t.title}<span className="block text-xs text-muted-foreground">{t.dueAt ? format(new Date(t.dueAt), 'EEE d MMM · HH:mm') : ''}</span></span><Tag s={t.source} /></p>) : <p className="text-sm text-muted-foreground">Nothing due soon.</p>) : <NotShared what="Calendar" />}</Panel>
              <div className="lg:col-span-2"><Panel title="Released grades">{v.grades ? (v.grades.length ? <table className="w-full text-sm"><tbody>{v.grades.map((g: { id: string; code: string; title: string; term: string; grade: string; source: string }) => <tr key={g.id} className="border-t border-border first:border-0"><td className="py-2 font-mono">{g.code}</td><td>{g.title}<span className="block text-xs text-muted-foreground">{g.term}</span></td><td className="font-display text-lg">{g.grade}</td><td><Tag s={g.source} /></td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">No grades released yet.</p>) : <NotShared what="Grades" />}</Panel></div>
              <div className="lg:col-span-2"><Note studentId={v.id} name={v.name} /></div>
            </div>
          </>
        )}
          </>
  );
}

type SchedClass = { id: string; code: string; title: string; term: string; times: string };
type KeyDate = { term: string; regOpens: string; regCloses: string; addDropEnds: string; classesStart: string; classesEnd: string };

function Schedule() {
  const [sid, setSid] = useState<string | undefined>();
  const { d, err } = useFamily(sid);
  const v = d?.view;
  const sch = (v as { schedule?: { classes: SchedClass[]; keyDates: KeyDate[] } | null } | undefined)?.schedule;
  const terms = [...new Set((sch?.classes ?? []).map((c) => c.term))];
  const dateOnly = (s: string) => day(`${s}T12:00:00`);
  return (
    <>
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 text-3xl">{v ? `${v.name}’s schedule` : 'Schedule'}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Classes, deadlines and key term dates — shown only while your student shares their calendar with you.</p>
      {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={() => setSid(sid)}>Try again</Button></div>}
      {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>}
      {d && !v && <NothingShared />}
      {d && v && (
        <>
          {(d.students ?? []).length > 1 && <div className="mt-4 flex flex-wrap gap-2">{(d.students ?? []).map((s: { id: string; name: string }) => <Button key={s.id} size="sm" variant={s.id === v.id ? 'default' : 'outline'} onClick={() => setSid(s.id)}>{s.name}</Button>)}</div>}
          {!sch ? <div className="mt-6"><NotShared what="The calendar is" /></div> : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Panel title="Classes">
                {sch.classes.length ? terms.map((t) => (
                  <div key={t} className="mb-3 last:mb-0">
                    <p className="eyebrow">{t}</p>
                    {sch.classes.filter((c) => c.term === t).map((c) => <p key={c.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span><span className="font-mono">{c.code}</span> {c.title}</span><span className="text-muted-foreground">{c.times || 'Times to be announced'}</span></p>)}
                  </div>
                )) : <p className="text-sm text-muted-foreground">No enrolled classes to show.</p>}
              </Panel>
              <Panel title="Coming up">{v.upcoming ? (v.upcoming.length ? v.upcoming.map((t: { id: string; title: string; dueAt: string | null; done: boolean; source: string }) => <p key={t.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>{t.done ? '✓' : '○'} {t.title}<span className="block text-xs text-muted-foreground">{t.dueAt ? format(new Date(t.dueAt), 'EEE d MMM · HH:mm') : ''}</span></span><Tag s={t.source} /></p>) : <p className="text-sm text-muted-foreground">Nothing due soon.</p>) : <NotShared what="Calendar" />}</Panel>
              <div className="lg:col-span-2"><Panel title="Key dates">
                {sch.keyDates.length ? sch.keyDates.map((k) => (
                  <div key={k.term} className="border-b border-border py-2 text-sm last:border-0">
                    <p className="eyebrow">{k.term}</p>
                    <p>Classes {dateOnly(k.classesStart)} → {dateOnly(k.classesEnd)} · Add/drop ends {dateOnly(k.addDropEnds)}</p>
                    <p className="text-xs text-muted-foreground">Registration {day(k.regOpens)} → {day(k.regCloses)} · From the institution's approved academic calendar</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No approved term calendar to show yet.</p>}
              </Panel></div>
            </div>
          )}
        </>
      )}
    </>
  );
}

type Hist = { at: string; student: string; categories: string };
function Access() {
  const { d, load } = useFamily();
  const leave = async (ids: number[], name: string) => { try { for (const id of ids) await familyView({ leave: id }); toast(`You no longer see what ${name} shared.`); load(); } catch (e) { toast(`! ${e instanceof Error ? e.message : 'That didn’t work'}`); } };
  const [h, setH] = useState<Hist[] | null>(null);
  useEffect(() => { (familyView({ history: true }) as Promise<{ history: Hist[] }>).then((r) => setH(r.history)).catch(() => setH([])); }, []);
  return (
    <>
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 text-3xl">Sharing & access history</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">What you can see and until when. Only the student can change this; the student sees this same history.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Active sharing">{!d ? <Skeleton className="h-16" /> : (d.students ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nothing is shared with you.</p> :
          <ul className="space-y-2 text-sm">{(d.students ?? []).map((s: { id: string; name: string; categories: string[]; expiresOn: string | null; inviteIds: number[] }) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2"><span><span className="font-medium">{s.name}</span>: {s.categories.join(', ')} · until {day(s.expiresOn)}</span><Button size="sm" variant="outline" onClick={() => leave(s.inviteIds, s.name)}>Stop seeing this</Button></li>)}</ul>}</Panel>
        <Panel title="Your recent views">{!h ? <Skeleton className="h-16" /> : h.length === 0 ? <p className="text-sm text-muted-foreground">No views yet.</p> :
          <ul className="space-y-1 text-sm">{h.map((x, i) => <li key={i}>{format(new Date(x.at), 'd MMM yyyy, HH:mm')} · {x.student} · {x.categories}</li>)}</ul>}</Panel>
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
      <AppShell app="Family" appKey="family" institutionName="Family workspace" role="Family member" roles={[]} isSample={false} groups={GROUPS}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/shared" element={<Shared />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/access" element={<Access />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AppShell>
    </BrowserRouter>
  );
}
