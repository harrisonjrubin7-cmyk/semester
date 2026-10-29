import { useState } from 'react';
import { toast } from 'sonner';
import { myApps, MyAppsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { useLoad, act } from '../hooks';

type D = MyAppsOutputType;
const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-lg border bg-card p-4"><h3 className="eyebrow mb-3">{title}</h3>{children}</section>;

export function MyApps() {
  const s = useLoad(() => myApps({ action: 'list' }));
  const [confirm, setConfirm] = useState('');
  if (s.error) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{s.error} <Button size="sm" variant="link" onClick={s.reload}>Retry</Button></p>;
  if (!s.data) return <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  const d: D = s.data;
  if (!d.ready) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{d.message}</p>;
  const suspend = (appId: string) => act(() => myApps({ action: 'suspendOwn', appId }), (r) => { s.setData(r); setConfirm(''); toast.success(r.message); });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Your production apps — registered through Developer apps at your institution. Sandbox test apps live under Sandbox. Tokens belong to each institution's install: their admins mint, rotate and revoke them, and you see status and call counts here, never a token.</p>
      {d.apps.length === 0 ? <Section title="No production apps yet"><p className="text-sm text-muted-foreground">Ask an administrator at your institution to register your app under Developer apps in Semester. It can be installed at your institution straight away; other institutions need Semester review first.</p></Section>
      : d.apps.map((a) => (
        <Section key={a.id} title={a.name}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-0.5">{a.status === 'suspended' ? 'Suspended' : 'Live'}</span>
            <span className="rounded-full border px-2 py-0.5">Review: {a.review}</span>
            <span>{a.installs} installs · {a.activeTokens} active tokens</span>
            <span className="font-mono">{a.scopes.join(' · ') || 'no scopes'}</span>
            {a.status !== 'suspended' && (confirm === a.id
              ? <span className="ml-auto flex gap-2"><Button size="sm" variant="destructive" onClick={() => suspend(a.id)}>Confirm suspend</Button><Button size="sm" variant="outline" onClick={() => setConfirm('')}>Keep</Button></span>
              : <Button size="sm" variant="outline" className="ml-auto" onClick={() => setConfirm(a.id)}>Suspend app</Button>)}
          </div>
          {a.reviewNote && <p className="mt-2 text-xs text-muted-foreground">Reviewer note: {a.reviewNote}</p>}
          {a.review === 'unreviewed' && <p className="mt-2 text-xs text-muted-foreground">Waiting for Semester review before other institutions can install it. Changing requested scopes restarts review.</p>}
        </Section>
      ))}
      {d.installs.length > 0 && <Section title="Installs at institutions">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2"><th>App</th><th>Institution</th><th>Scopes</th><th>Status</th><th>Token expires</th><th>Last call</th><th className="text-right">Calls / denied</th></tr></thead>
          <tbody>{d.installs.map((i) => (
            <tr key={i.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2.5 align-top">
              <td className="font-medium">{d.apps.find((a) => a.id === i.appId)?.name ?? i.appId}</td>
              <td>{i.institution}</td>
              <td className="font-mono text-[11px]">{i.scopes.join(' · ')}</td>
              <td>{i.status}</td>
              <td className="text-xs">{fmt(i.expiresAt)}</td>
              <td className="text-xs">{fmt(i.lastCall)}</td>
              <td className="text-right tabular-nums">{i.calls} / {i.denied}</td>
            </tr>))}</tbody>
        </table></div>
      </Section>}
    </div>
  );
}
