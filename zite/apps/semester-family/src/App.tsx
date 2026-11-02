import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { familyView, FamilyViewOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Toaster } from '@project/components/ui/sonner';
import { toast } from 'sonner';
import { Skeleton } from '@project/components/ui/skeleton';
import { cn } from '@project/components/lib/utils';

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

export default function App() {
  const { user, isLoading } = useAuth();
  const [sid, setSid] = useState<string | undefined>();
  const [d, setD] = useState<FamilyViewOutputType | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  useEffect(() => { if (user) { setErr(null); familyView({ studentId: sid }).then(setD).catch((e) => setErr(e instanceof Error ? e.message : 'This didn’t load')); } }, [user, sid]);
  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-sidebar font-display tracking-[0.3em] text-sidebar-foreground">SEMESTER</div>;
  const v = d?.view;
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sm text-sidebar-foreground md:px-8">
        <span className="font-display tracking-[0.3em]">SEMESTER <span className="ml-2 text-xs tracking-normal opacity-60">Family</span></span>
        <span className="flex items-center gap-3 text-xs"><span className="hidden sm:inline">{user.email}</span><button onClick={() => logout()} className="underline">Sign out</button></span>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <p className="eyebrow">Family</p>
        <h1 className="mt-1 text-3xl">{v ? `${v.name}’s shared record` : 'Shared with you'}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">You see only what a student chose to share, until the date they set. They can see each time you look, and can stop sharing at any time.</p>
        {err && <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">! {err} <Button size="sm" variant="outline" className="ml-2" onClick={() => setSid(sid)}>Try again</Button></div>}
        {!d && !err && <div className="mt-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>}
        {d && !v && <div className="mt-6 rounded-md border border-border bg-card p-6 text-sm"><p className="font-medium">○ Nothing is shared with you yet</p><p className="mt-1 text-muted-foreground">Ask your student to open Semester → You → Share with family and enter <span className="font-mono">{user.email}</span>.</p></div>}
        {d && v && (
          <>
            {d.students.length > 1 && <div className="mt-4 flex flex-wrap gap-2">{d.students.map((s: { id: string; name: string }) => <Button key={s.id} size="sm" variant={s.id === v.id ? 'default' : 'outline'} onClick={() => setSid(s.id)}>{s.name}</Button>)}</div>}
            <p className="mt-4 rounded-[3px] border border-border bg-accent px-3 py-2 text-xs text-accent-foreground">Shared: {v.categories.join(', ')} · until {v.expiresOn ? format(new Date(v.expiresOn), 'EEE d MMM yyyy') : 'revoked'} · This view is recorded in {v.name}’s access history</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Panel title="Holds">{v.holds ? (v.holds.length ? v.holds.map((h: { id: string; title: string; office: string; source: string }) => <p key={h.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>! {h.title}<span className="block text-xs text-muted-foreground">Owned by {h.office}. Only {v.name} or that office can resolve it.</span></span><Tag s={h.source} /></p>) : <p className="text-sm text-muted-foreground">✓ No holds.</p>) : <NotShared what="Holds" />}</Panel>
              <Panel title="Coming up">{v.upcoming ? (v.upcoming.length ? v.upcoming.map((t: { id: string; title: string; dueAt: string | null; done: boolean; source: string }) => <p key={t.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span>{t.done ? '✓' : '○'} {t.title}<span className="block text-xs text-muted-foreground">{t.dueAt ? format(new Date(t.dueAt), 'EEE d MMM · HH:mm') : ''}</span></span><Tag s={t.source} /></p>) : <p className="text-sm text-muted-foreground">Nothing due soon.</p>) : <NotShared what="Calendar" />}</Panel>
              <div className="lg:col-span-2"><Panel title="Released grades">{v.grades ? (v.grades.length ? <table className="w-full text-sm"><tbody>{v.grades.map((g: { id: string; code: string; title: string; term: string; grade: string; source: string }) => <tr key={g.id} className="border-t border-border first:border-0"><td className="py-2 font-mono">{g.code}</td><td>{g.title}<span className="block text-xs text-muted-foreground">{g.term}</span></td><td className="font-display text-lg">{g.grade}</td><td><Tag s={g.source} /></td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">No grades released yet.</p>) : <NotShared what="Grades" />}</Panel></div>
              <div className="lg:col-span-2"><Note studentId={v.id} name={v.name} /></div>
            </div>
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}
